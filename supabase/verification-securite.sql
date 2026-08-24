-- Vérification de sécurité de la base — À EXÉCUTER DANS LES DEUX PROJETS
-- Supabase (recette ET production), après chaque déploiement SQL.
--
-- Ces requêtes ne modifient rien : elles répondent à quatre questions dont la
-- réponse ne se devine pas depuis le code. Le code peut être impeccable et la
-- base rester ouverte si un script n'a pas été rejoué — c'est précisément
-- l'écart que ce fichier sert à détecter.

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
