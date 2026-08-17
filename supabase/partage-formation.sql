-- ============================================================
-- Partager les cours de formation avec toutes les entreprises
-- (affiliés inscrits par code partenaire compris)
--
-- À exécuter dans le SQL Editor de Supabase (Run), en entier.
-- UNE SEULE CHOSE À MODIFIER : l'email du compte gérant, ligne marquée ⚠.
-- Rejouable sans risque.
-- ============================================================

-- 1. Fonction serveur : « cette organisation est-elle l'organisation
--    interne ? ». SECURITY DEFINER indispensable : la sécurité de la table
--    orgs ne laisse chaque compte lire QUE sa propre entreprise — sans ce
--    détour, la règle de partage ne voyait jamais l'organisation interne et
--    ne partageait rien (cause du « rien ne change »).
create or replace function public.org_est_interne(p_org text)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.orgs where id = p_org and kind = 'interne')
$$;

-- 2. Règles d'accès aux cours : lecture = ses cours + ceux de l'organisation
--    interne ; écriture = uniquement ses propres cours.
drop policy if exists "org isolation" on public.formations;
drop policy if exists "formations lecture partagee" on public.formations;
drop policy if exists "formations ecriture org" on public.formations;
--    Un cours MASQUÉ (brouillon) ne quitte jamais son organisation : il n'est
--    même pas transmis aux affiliés.
create policy "formations lecture partagee" on public.formations for select to authenticated
  using (
    org_id = public.auth_org_id()
    or (public.org_est_interne(org_id) and coalesce(data ->> 'masque', 'false') <> 'true')
  );
create policy "formations ecriture org" on public.formations
  for all to authenticated
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

-- 3. VOTRE entreprise devient l'organisation interne (la source des cours).
--    ⚠ Remplacez l'email si votre compte gérant en utilise un autre.
update public.orgs set kind = 'interne'
 where id = (
   select org_id from public.profiles
    where lower(email) = lower('siddoboubacar66@gmail.com')
 );

-- 4. Une seule source : « org-bestasolar » (coquille créée par le script
--    d'installation) redevient ordinaire si personne n'y travaille. Deux
--    organisations internes enverraient deux copies des mêmes cours aux
--    affiliés, dans un ordre imprévisible.
update public.orgs set kind = 'pro'
 where id = 'org-bestasolar'
   and not exists (select 1 from public.profiles where org_id = 'org-bestasolar')
   and exists (select 1 from public.orgs where kind = 'interne' and id <> 'org-bestasolar');

-- 5. CONTRÔLE — à lire dans le résultat :
--    votre entreprise doit être la SEULE en « interne », avec vos cours.
select o.id, o.name, o.kind,
       count(f.id)                                  as cours,
       (select count(*) from public.profiles p where p.org_id = o.id) as membres
  from public.orgs o
  left join public.formations f on f.org_id = o.id
 group by o.id, o.name, o.kind
 order by o.kind, cours desc;
