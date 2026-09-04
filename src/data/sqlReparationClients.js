// Script de réparation des accès aux clients publics — COPIE GÉNÉRÉE.
//
// Source de vérité : supabase/reparer-clients-publics.sql. Ne pas modifier ici : éditer le .sql, puis
//   node scripts/generer-sql-reparation.mjs
// Un test compare les deux (src/utils/__tests__/sqlReparation.test.js).
//
// Pourquoi embarquer le SQL dans l'app : le gérant lit le refus sur son
// téléphone. Lui demander d'aller chercher un fichier dans le dépôt, c'est lui
// demander un ordinateur. Le bouton du Diagnostic met le script dans son
// presse-papiers, son adresse déjà remplie — il n'a plus qu'à coller.

export const SQL_REPARATION_CLIENTS = `-- ============================================================
--  RÉPARER : « Écriture refusée par la sécurité » sur les clients
--  À exécuter dans le SQL Editor Supabase. Rejouable sans danger.
--  Une seule chose à adapter : l'e-mail du gérant, ligne « MON EMAIL ».
--  (Le bouton « Copier le SQL de réparation », dans Plus › Diagnostic, le
--   remplit déjà avec l'adresse de votre session.)
-- ============================================================
--
-- Ce script fait deux choses d'affilée :
--   1. il (re)pose la règle qui rend les clients PUBLICS visibles au gérant —
--      si elle n'était jamais passée, elle passe maintenant ;
--   2. il affiche un tableau de contrôle qui dit, ligne par ligne, où en est
--      la base. Si le refus persiste après ça, ce tableau contient la cause.
--
-- Le Devis Pro n'est pas touché : les clients Pro restent privés à leur auteur.

-- 1. La règle du propriétaire d'espace (même définition que utils/roles.js) :
--    gérant, admin plateforme, ou inscrit seul dans une org sans gérant.
create or replace function public.auth_est_proprietaire_espace()
  returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.role = 'gerant' or p.is_platform_admin
        or not exists (
          select 1 from public.profiles g
          where g.org_id = p.org_id and g.role = 'gerant'
        )
    from public.profiles p
    where lower(p.email) = lower(auth.jwt() ->> 'email')
  ), false)
$$;

-- 2. Clients publics : le gérant de l'organisation retrouve un accès complet.
--    « client owner access » n'est pas touchée : un partenaire continue
--    d'écrire ses propres clients. Les deux règles s'additionnent.
drop policy if exists "manager client access" on public.leads;
create policy "manager client access" on public.leads
  for all to authenticated
  using (
    public.auth_is_platform_admin()
    or (org_id = public.auth_org_id() and public.auth_est_proprietaire_espace())
  )
  with check (
    public.auth_is_platform_admin()
    or (org_id = public.auth_org_id() and public.auth_est_proprietaire_espace())
  );

-- 3. TABLEAU DE CONTRÔLE.
--    \`auth.jwt()\` est vide dans le SQL Editor : on refait donc le calcul à la
--    main, à partir de l'e-mail ci-dessous. C'est le seul endroit à modifier.
with moi as (
  select p.id, p.email, p.org_id, p.role, coalesce(p.is_platform_admin, false) as admin
  from public.profiles p
  where lower(p.email) = lower('mon.email@exemple.com')   -- MON EMAIL
),
autres_gerants as (
  select count(*)::int as n from public.profiles g
  where g.org_id = (select org_id from moi) and g.role = 'gerant'
),
verdict as (
  select coalesce((
    select m.role = 'gerant' or m.admin or (select n from autres_gerants) = 0 from moi m
  ), false) as ok
),
regles as (
  select policyname, coalesce(with_check, qual, '') as expr
  from pg_policies where schemaname = 'public' and tablename = 'leads'
),
clients as (
  select count(*)::int as total,
         count(*) filter (
           where coalesce(nullif(l.data ->> 'registeredByUserId', ''),
                          nullif(l.data ->> 'assignedTo', ''),
                          nullif(l.data ->> 'userId', ''))
                 is distinct from (select id from moi)
         )::int as autrui
  from public.leads l where l.org_id = (select org_id from moi)
)
select * from (
  select 1 as n, 'Profil' as controle,
         coalesce((select 'e-mail ' || m.email || ' — profil ' || m.id
                        || ' — entreprise ' || m.org_id
                        || ' — rôle « ' || coalesce(m.role, 'aucun') || ' »'
                        || case when m.admin then ' — admin plateforme' else '' end from moi m),
                  'AUCUN PROFIL pour cet e-mail : corrigez l''e-mail ligne « MON EMAIL »') as resultat
  union all
  select 2, 'Gérants dans l''entreprise', (select n from autres_gerants)::text
  union all
  select 3, 'Verdict : propriétaire de l''espace',
         case when not exists (select 1 from moi)
                   then 'INDÉTERMINÉ — aucun profil pour cet e-mail (voir la ligne 1)'
              when (select ok from verdict) then 'OUI — le gérant a bien accès aux clients publics'
              else 'NON — c''est la cause du refus : ce compte n''est ni gérant ni admin plateforme, '
                   || 'et un autre gérant existe dans l''entreprise' end
  union all
  select 4, 'Règle « ' || r.policyname || ' » sur leads', r.expr from regles r
  union all
  select 6, 'Clients publics de l''entreprise',
         (select total from clients)::text || ' au total, dont '
         || (select autrui from clients)::text || ' enregistrés par d''autres membres'
  union all
  select 7, 'Conclusion',
         case when not exists (select 1 from moi)
                   then 'E-mail inconnu. Cherchez le bon avec : select email, role from public.profiles order by email;'
              when (select ok from verdict)
              then 'Réparé. Déconnectez-vous puis reconnectez-vous : la file en attente repartira.'
              else 'Encore refusé. Passez ce compte en gérant : '
                   || 'update public.profiles set role = ''gerant'' where lower(email) = lower('''
                   || (select email from moi) || ''');' end
) t order by n, controle;
`;

// Adresse de démonstration présente dans le script : remplacée par celle de la
// session, pour qu'il n'y ait rien à éditer avant de coller.
export const EMAIL_MODELE = 'mon.email@exemple.com';

/** Le script prêt à coller, avec l'e-mail de la session. */
export const sqlReparationPour = (email) => {
  const propre = String(email || '').trim().toLowerCase().replace(/'/g, '');
  return propre ? SQL_REPARATION_CLIENTS.replaceAll(EMAIL_MODELE, propre) : SQL_REPARATION_CLIENTS;
};
