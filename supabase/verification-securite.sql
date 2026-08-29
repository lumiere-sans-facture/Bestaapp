-- Vérification de sécurité de la base — À EXÉCUTER DANS LES DEUX PROJETS
-- Supabase (recette ET production), après chaque déploiement SQL.
--
-- Ces requêtes ne modifient rien : elles répondent à quatre questions dont la
-- réponse ne se devine pas depuis le code. Le code peut être impeccable et la
-- base rester ouverte si un script n'a pas été rejoué — c'est précisément
-- l'écart que ce fichier sert à détecter.
--
-- ⚠️ Le SQL Editor de Supabase n'affiche que le résultat de la DERNIÈRE
-- instruction d'un script. Coller ce fichier entier ne montrerait donc que le
-- contrôle 4. D'où le BILAN ci-dessous : une requête unique qui réunit les
-- quatre contrôles et se lit d'un coup d'œil. Les quatre requêtes détaillées
-- qui suivent servent au diagnostic, à lancer UNE PAR UNE (sélectionner la
-- requête dans l'éditeur, puis Run) quand le bilan signale quelque chose.

-- ===========================================================================
-- BILAN — la requête à lancer. Sélectionner du `with` au `;` final, puis Run.
--
--   « ✅ aucune anomalie »  →  la base est fermée, rien à faire.
--   une ou plusieurs lignes →  chacune nomme le contrôle, l'objet fautif et
--                              ce que ça ouvre. Le contrôle 3 est le plus
--                              grave : `multitenant.sql` n'est pas passé ici.
-- ===========================================================================
with anomalies as (
  select '1. table sans RLS'::text as controle,
         t.tablename::text as objet,
         'RLS désactivée — lisible par tout porteur de la clé anon (publique)'::text as probleme
  from pg_tables t
  where t.schemaname = 'public' and t.rowsecurity = false

  union all
  select '2. RLS sans policy'::text,
         t.tablename::text,
         'aucune policy — table devenue inaccessible depuis l''app'::text
  from pg_tables t
  where t.schemaname = 'public' and t.rowsecurity = true
    and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename)
    and t.tablename not in ('erreurs', 'paiements_verifies')

  union all
  select '3. policy « tout ouvert »'::text,
         (p.tablename || ' → ' || p.policyname)::text,
         'ancien schéma mono-équipe : CHAQUE entreprise voit toutes les autres'::text
  from pg_policies p
  where p.schemaname = 'public'
    and (p.policyname = 'team full access' or p.qual::text in ('true', '(true)'))
    and p.tablename not in ('profiles')

  union all
  select '4. search_path non figé'::text,
         p.proname::text,
         'fonction security definer détournable par un schéma injecté'::text
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not (p.proconfig is not null and exists (
      select 1 from unnest(p.proconfig) c where c like 'search_path=%'
    ))
)
select controle, objet, probleme from anomalies
union all
select '✅ aucune anomalie', '—', 'les quatre contrôles passent : la base est fermée'
where not exists (select 1 from anomalies)
order by 1, 2;

-- ===========================================================================
-- DÉTAIL — à lancer une requête à la fois, quand le bilan signale un contrôle.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Une table sans RLS est lisible par n'importe quel porteur de la clé anon,
--    laquelle est PUBLIQUE (elle vit dans le bundle du navigateur).
--    Résultat attendu : AUCUNE LIGNE.
-- ---------------------------------------------------------------------------
select tablename as table_sans_rls
from pg_tables
where schemaname = 'public'
  and rowsecurity = false
order by tablename;

-- ---------------------------------------------------------------------------
-- 2. RLS activée MAIS aucune policy = table fermée à tous (sauf service_role).
--    C'est voulu pour `erreurs` et `paiements_verifies` — écrites par le
--    serveur, lues par personne depuis le navigateur. Toute AUTRE table dans
--    cette liste est une donnée devenue inaccessible par accident.
-- ---------------------------------------------------------------------------
select t.tablename as table_sans_policy
from pg_tables t
where t.schemaname = 'public'
  and t.rowsecurity = true
  and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename)
  and t.tablename not in ('erreurs', 'paiements_verifies')
order by t.tablename;

-- ---------------------------------------------------------------------------
-- 3. Policies « tout ouvert à tout authentifié » : c'est l'ancien schéma
--    mono-équipe (`schema.sql`). Si `multitenant.sql` a bien été rejoué, elles
--    ont disparu. Sinon, CHAQUE entreprise voit les données de TOUTES les
--    autres — la fuite la plus grave possible sur ce produit.
--    Résultat attendu : AUCUNE LIGNE.
-- ---------------------------------------------------------------------------
select tablename, policyname, qual::text as condition
from pg_policies
where schemaname = 'public'
  and (policyname = 'team full access' or qual::text in ('true', '(true)'))
  and tablename not in ('profiles')  -- lecture d'annuaire, restreinte par « org read »
order by tablename;

-- ---------------------------------------------------------------------------
-- 4. Fonctions SECURITY DEFINER : elles s'exécutent avec les droits de leur
--    propriétaire et contournent donc la RLS. Chacune doit poser sa propre
--    garde (auth_is_platform_admin, auth_org_id…) et figer son search_path —
--    sans quoi un schéma injecté dans le chemin peut détourner ses appels.
--    Vérifier à l'œil que la colonne `search_path_fige` vaut bien « t ».
-- ---------------------------------------------------------------------------
select p.proname as fonction,
       (p.proconfig is not null and exists (
          select 1 from unnest(p.proconfig) c where c like 'search_path=%'
       )) as search_path_fige
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
order by p.proname;
