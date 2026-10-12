-- ============================================================
--  Connexion et synchronisation plus rapides : index sur lower(email).
--  Indépendant des autres scripts, à passer à tout moment.
--  Rejouable sans danger. Ne change AUCUN droit, aucune donnée.
--  DANS LES DEUX PROJETS : test (recette) ET production.
-- ============================================================
--
-- CE QUE ÇA CORRIGE. Les règles de sécurité retrouvent le profil de la
-- session par `lower(email) = lower(auth.jwt() ->> 'email')` : c'est ce que
-- font auth_org_id(), auth_is_platform_admin(), auth_profile_id() et
-- is_team_member(). Elles sont évaluées pour CHAQUE ligne lue — un client,
-- un devis, un kit — et souvent plusieurs par ligne.
--
-- L'index unique existant porte sur `email` tel quel : il ne sert pas à
-- `lower(email)`. Chaque appel parcourait donc TOUTE la table des profils.
-- Coût : (lignes lues) × (profils inscrits), à chaque connexion et à chaque
-- relecture du serveur (toutes les minutes). Il grandit avec chaque nouveau
-- partenaire inscrit.
--
-- Avec cet index, chaque appel devient une recherche directe.

create index if not exists idx_profiles_email_lower on public.profiles (lower(email));

-- Statistiques à jour : le planificateur choisit l'index tout de suite.
analyze public.profiles;

-- Contrôle : une ligne « ✅ » attendue.
select case when exists (
  select 1 from pg_indexes
  where schemaname = 'public' and tablename = 'profiles' and indexname = 'idx_profiles_email_lower'
) then '✅ index idx_profiles_email_lower en place'
  else '❌ index absent — relancer le script' end as controle;
