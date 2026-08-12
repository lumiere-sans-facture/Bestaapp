-- Partage des kits solaires BestaSolar avec les comptes techniciens.
-- À exécuter dans le SQL Editor Supabase après multitenant.sql.
-- Les kits de l'organisation interne deviennent lisibles par tous, mais restent
-- modifiables uniquement par l'organisation qui les possède.

drop policy if exists "org isolation" on public.kits;
drop policy if exists "kits lecture partagee" on public.kits;
drop policy if exists "kits ecriture org" on public.kits;

create policy "kits lecture partagee" on public.kits for select to authenticated
  using (org_id = public.auth_org_id() or public.org_est_interne(org_id));

create policy "kits ecriture org" on public.kits
  for all to authenticated
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());
