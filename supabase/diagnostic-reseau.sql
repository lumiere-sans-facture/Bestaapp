-- =====================================================================
--  POURQUOI LES CLIENTS DE MES PARTENAIRES NE REMONTENT-ILS PAS ?
--  Script de LECTURE SEULE. Il ne crée, ne modifie, ne supprime rien.
-- =====================================================================
--
-- UNE SEULE CHOSE À MODIFIER : l'e-mail du compte gérant, ligne marquée ⚠.
-- Puis « Run ». Le résultat se lit de haut en bas, en cinq sections.
--
-- POURQUOI CE SCRIPT EXISTE. La section « Clients du réseau » affiche les
-- clients de tout votre arbre d'affiliation : vos filleuls, leurs filleuls, et
-- ainsi de suite. Mais chaque maillon repose sur UN code, posé une seule fois,
-- à l'inscription : la colonne `orgs.referred_by` reçoit le code suivi ou
-- saisi. Un partenaire inscrit sans code n'est rattaché à rien — et il coupe
-- du même coup toute la branche née sous lui.
--
-- Ce script ne peut pas appeler `mes_clients_reseau()` directement : cette
-- fonction s'appuie sur le compte connecté, et l'éditeur SQL n'en a pas. Il
-- refait donc le même calcul à partir de l'e-mail saisi ci-dessous.

with moi as (
  select p.email, p.role, p.org_id, o.name as org_nom
  from public.profiles p
  left join public.orgs o on o.id = p.org_id
  where lower(p.email) = lower('siddoboubacar66@gmail.com')   -- ⚠ VOTRE E-MAIL
),
mes_codes as (
  select public.code_partenaire(pt.data ->> 'code') as code,
         coalesce(pt.data ->> 'name', '(sans nom)') as porteur
  from public.partners pt, moi
  where pt.org_id = moi.org_id
    and coalesce(pt.data ->> 'code', '') <> ''
),
inscrites as (
  select o.id, o.name,
         public.code_partenaire(o.referred_by) as code_utilise,
         coalesce(o.referral_par_defaut, false) as par_defaut,
         exists (select 1 from mes_codes mc where mc.code = public.code_partenaire(o.referred_by)) as est_a_moi,
         (select count(*) from public.leads l where l.org_id = o.id) as nb_clients
  from public.orgs o, moi
  where o.id <> moi.org_id
),
bilan as (
  select
    count(*) filter (where est_a_moi) as orgs_a_moi,
    coalesce(sum(nb_clients) filter (where est_a_moi), 0) as clients_a_moi,
    count(*) filter (where code_utilise is null) as orgs_sans_code,
    count(*) filter (where code_utilise is not null and not est_a_moi) as orgs_code_etranger
  from inscrites
)
select '1. Mon compte' as section,
       moi.email as element,
       'rôle ' || moi.role || ' · entreprise « ' || coalesce(moi.org_nom, '?') || ' »' as detail
from moi
union all
select '1. Mon compte', '(introuvable)',
       '❌ Aucun profil pour cet e-mail. Corrigez la ligne ⚠ ci-dessus.'
where not exists (select 1 from moi)

union all
select '2. Mes codes partenaires', mc.code, 'porté par ' || mc.porteur from mes_codes mc
union all
select '2. Mes codes partenaires', '(aucun)',
       '❌ Sans code, personne ne peut s''inscrire sous votre réseau.'
where not exists (select 1 from mes_codes)

union all
select '3. Entreprises inscrites',
       i.name,
       case
         when i.code_utilise is null then '⚪ inscrite SANS code — rien ne la rattache à vous'
         when i.est_a_moi then '✅ code ' || i.code_utilise
              || case when i.par_defaut then ' (rattachement par défaut, encore corrigeable une fois)' else '' end
              || ' — ' || i.nb_clients || ' client(s) qui doivent remonter'
         else '⚪ code ' || i.code_utilise || ' — appartient à un autre réseau'
       end
from inscrites i

union all
select '4. Total attendu',
       b.clients_a_moi || ' client(s)',
       b.orgs_a_moi || ' entreprise(s) rattachée(s) à vos codes'
from bilan b

union all
select '5. Diagnostic', '→',
       case
         when b.orgs_a_moi > 0 and b.clients_a_moi > 0
           then '✅ Le lien existe. Si l''écran reste vide : rejouez multitenant.sql, puis reconnectez-vous.'
         when b.orgs_a_moi > 0
           then '⚠️ Vos partenaires sont bien rattachés, mais n''ont saisi AUCUN client.'
         when b.orgs_sans_code > 0
           then '❌ ' || b.orgs_sans_code || ' entreprise(s) inscrite(s) SANS code de parrainage. '
                || 'C''est la cause : elles ne vous sont reliées par rien. '
                || 'Corrigez avec admin_set_org_referral(org_id, code) — voir la note en bas de ce script.'
         when b.orgs_code_etranger > 0
           then '❌ Les entreprises inscrites l''ont été sous des codes étrangers à votre réseau. '
                || 'Note : la section 3 ne regarde que le premier maillon ; une entreprise inscrite '
                || 'sous le code d''un de vos filleuls remonte quand même, via l''arbre complet.'
         else '❌ Aucune autre entreprise n''existe dans cette base : vos partenaires n''ont pas de compte.'
       end
from bilan b
order by 1, 2;

-- ---------------------------------------------------------------------
-- SI DES ENTREPRISES SONT INSCRITES SANS CODE
--
-- Le rattachement se répare une entreprise à la fois. Relevez son identifiant
-- dans la section 3 (colonne « element » donne le nom ; la requête ci-dessous
-- retrouve l'identifiant), puis posez le code.
--
--   -- 1. Retrouver l'identifiant de l'entreprise
--   select id, name, referred_by from public.orgs where name ilike '%Fatou%';
--
--   -- 2. Poser le code — UN DE VOS CODES, section 2 ci-dessus
--   update public.orgs set referred_by = 'MAMADOU-K8R4MZ'
--    where id = 'org-xxxxxxxx' and referred_by is null;
--
-- La clause `and referred_by is null` est une sécurité : elle empêche
-- d'écraser un rattachement existant, donc de voler le filleul d'un autre
-- partenaire. Ne la retirez pas.
--
-- POURQUOI PAS `admin_set_org_referral()` ICI : cette fonction vérifie que
-- l'appelant est admin plateforme via son jeton d'authentification. L'éditeur
-- SQL n'en a aucun — elle échouerait avec « réservé à l'admin plateforme ».
-- Elle reste la bonne voie depuis l'APPLICATION ; ici, c'est l'UPDATE direct.
--
-- Après correction, le partenaire doit rafraîchir son application, et vous la
-- vôtre : la liste se relit à l'ouverture de l'écran Clients.
-- ---------------------------------------------------------------------
