-- ============================================================
-- Table « pompeKits » : kits de pompage solaire modifiables
-- À exécuter dans le SQL Editor de Supabase (Run). Rejouable.
--
-- Sans cette table, l'application fonctionne quand même (les kits
-- restent sur chaque appareil), mais ils ne se synchronisent pas
-- entre les appareils de l'équipe.
-- ============================================================

create table if not exists public."pompeKits" (
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  org_id text not null,
  primary key (org_id, id)
);
alter table public."pompeKits" enable row level security;

drop policy if exists "org isolation" on public."pompeKits";
create policy "org isolation" on public."pompeKits" for all to authenticated
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

create index if not exists idx_pompeKits_org_updated on public."pompeKits" (org_id, updated_at);

-- Temps réel : les modifications d'un appareil arrivent chez les autres.
do $$
begin
  execute 'alter publication supabase_realtime add table public."pompeKits"';
exception when duplicate_object then null;
end $$;
