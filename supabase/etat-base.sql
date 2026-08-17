-- ÉTAT DE LA BASE — script de LECTURE SEULE.
--
-- À exécuter dans le SQL Editor de Supabase pour savoir ce qui manque AVANT
-- de lancer quoi que ce soit. Il ne crée rien, ne modifie rien, ne supprime
-- rien : il se contente de regarder.
--
-- COMMENT S'EN SERVIR : exécuter les blocs UN PAR UN (sélectionner le bloc,
-- puis « Run »). Les blocs 4 et 5 interrogent des colonnes créées par
-- `multitenant.sql` : s'ils renvoient une erreur « column does not exist »,
-- c'est la réponse — ce script n'a pas encore été passé sur cette base.
--
-- À utiliser en particulier sur la base de PRODUCTION avant une mise en
-- ligne : le code déployé attend ces tables, et une table manquante se
-- traduit par une synchronisation en échec, constatée seulement après coup.
--
-- ⚠️ On ne « recopie » JAMAIS une base dans l'autre. Les scripts du dossier
-- `supabase/` sont les mêmes pour les deux environnements ; ils s'exécutent
-- dans chacun et n'ajoutent que ce qui manque. Copier la base de test sur la
-- production effacerait les vrais clients, devis et commissions.

-- ---------------------------------------------------------------------------
-- 1. Quelles tables existent, et laquelle manque ?
-- ---------------------------------------------------------------------------
with attendues(table_name, script) as (
  values
    ('profiles',           '2 · schema.sql'),
    ('leads',              '2 · schema.sql'),
    ('devis',              '2 · schema.sql'),
    ('products',           '2 · schema.sql'),
    ('partners',           '2 · schema.sql'),
    ('commissions',        '2 · schema.sql'),
    ('referrals',          '2 · schema.sql'),
    ('orders',             '2 · schema.sql'),
    ('kits',               '2 · schema.sql'),
    ('inverters',          '2 · schema.sql'),
    ('formations',         '2 · schema.sql'),
    ('tombstones',         '2 · schema.sql — REQUIS pour la suppression multi-appareils'),
    ('orgs',               '3 · multitenant.sql'),
    ('companies',          '3 · multitenant.sql'),
    ('subscriptions',      '3 · multitenant.sql'),
    ('factures',           '3 · multitenant.sql'),
    ('paiementConfigs',    '5 · paiements.sql'),
    ('paiements_verifies', '5 · paiements.sql — verrou anti-rejeu des paiements'),
    ('erreurs',            '6 · erreurs.sql — journal des plantages')
)
select
  a.table_name                                as "table",
  a.script                                    as "vient du script",
  case when t.table_name is null
       then '❌ MANQUANTE' else '✅ présente' end as "état"
from attendues a
left join information_schema.tables t
  on t.table_schema = 'public' and t.table_name = a.table_name
order by (t.table_name is not null), a.table_name;

-- ---------------------------------------------------------------------------
-- 2. L'isolation par entreprise est-elle en place ?
--    (colonne org_id + RLS active : c'est ce qui empêche une entreprise de
--     voir les données d'une autre)
-- ---------------------------------------------------------------------------
select
  t.tablename                                    as "table",
  case when exists (
         select 1 from information_schema.columns c
         where c.table_schema = 'public'
           and c.table_name = t.tablename
           and c.column_name = 'org_id')
       then '✅ org_id' else '— pas de org_id' end as "isolation",
  case when t.rowsecurity then '✅ RLS active'
       else '❌ RLS DÉSACTIVÉE' end                as "sécurité"
from pg_tables t
where t.schemaname = 'public'
order by t.rowsecurity, t.tablename;

-- ---------------------------------------------------------------------------
-- 3. Le temps réel est-il branché ? (sinon les changements d'un appareil
--    n'apparaissent pas tout de suite sur les autres — voir temps-reel.sql)
-- ---------------------------------------------------------------------------
select tablename as "table diffusée en temps réel"
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;

-- ---------------------------------------------------------------------------
-- 4. Qui est admin plateforme ? (le seul à pouvoir activer un abonnement Pro)
--    Aucune ligne = personne : voir § 4 de DEPLOIEMENT.md.
-- ---------------------------------------------------------------------------
select email, name, role
from public.profiles
where is_platform_admin = true;

-- ---------------------------------------------------------------------------
-- 5. Volume réel — pour ne pas confondre les deux bases.
--    Une base de PRODUCTION a des clients ; une base de recette en a peu.
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.profiles) as comptes,
  (select count(*) from public.leads)    as clients,
  (select count(*) from public.devis)    as devis,
  (select count(*) from public.orgs)     as entreprises;
