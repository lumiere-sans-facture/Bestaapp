-- ============================================================
--  Les clients PUBLICS remontent au gérant. Le Pro reste privé.
--  À exécuter APRÈS 20260902_unify_besta_organization.sql.
--  Rejouable sans danger.
-- ============================================================
--
-- CE QUE ÇA CORRIGE. La fusion des organisations a remplacé l'isolation par
-- entreprise par une règle d'AUTEUR : chacun n'écrit et ne lit que les clients
-- qu'il a lui-même enregistrés, l'accès complet étant réservé au gérant
-- PLATEFORME. Appliquée telle quelle aux deux tables, elle a deux effets :
--
--   1. le gérant ne voit plus les clients que ses partenaires saisissent côté
--      public — alors que c'est précisément ce qu'il attend d'eux ;
--   2. sa file de synchronisation reste bloquée sur
--      « new row violates row-level security policy for table leads », parce
--      qu'elle contient les clients d'autres membres.
--
-- LA RÈGLE MÉTIER, elle, distingue les deux côtés de l'application :
--
--   `leads`      = côté PUBLIC (Clients, Suivi clients). Ce sont les affaires
--                  apportées à BestaSolar : le gérant doit les voir, et elles
--                  partent dans son carnet Google.
--   `proClients` = espace DEVIS PRO, l'entreprise personnelle de l'abonné.
--                  Elle ne regarde que lui. RIEN N'EST CHANGÉ ICI —
--                  volontairement : c'est la confidentialité que la fusion
--                  visait, et elle reste entière.

-- La règle du propriétaire d'espace, au cas où multitenant.sql serait resté
-- en arrière : le gérant, l'admin plateforme, ou l'inscrit seul dans une
-- organisation sans gérant. Même définition que utils/roles.js.
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

-- Clients publics : le gérant de l'organisation retrouve un accès complet.
-- La politique « client owner access » posée par la fusion N'EST PAS touchée :
-- un partenaire continue d'écrire ses propres clients. Les deux règles sont
-- permissives, donc elles s'additionnent — c'est ce qu'on veut.
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

-- CONTRÔLE — doit afficher trois lignes : les deux règles sur `leads`, et
-- celle de `proClients` restée réservée à son auteur.
select tablename, policyname
from pg_policies
where schemaname = 'public' and tablename in ('leads', 'proClients')
order by tablename, policyname;
