-- ============================================================
-- BestaSolar Pro — Schéma Supabase
-- À exécuter dans le SQL Editor du dashboard Supabase (Run).
-- ============================================================

-- Profils des utilisateurs de l'application (liés par email aux comptes Auth)
create table if not exists public.profiles (
  id text primary key,
  email text unique not null,
  name text not null,
  role text not null check (role in ('gerant', 'technicien')),
  phone text default '',
  avatar text default ''
);

-- Collections métier : une ligne par entité, contenu en JSON.
-- (id répliqué en colonne pour l'upsert et les suppressions ciblées)
create table if not exists public.products    (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.leads       (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.partners    (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.commissions (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.devis       (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.referrals   (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.orders      (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.formations  (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public."formationProgress" (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
-- Module Devis Pro (abonnement premium)
create table if not exists public.subscriptions (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public."subscriptionPayments" (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.companies    (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.factures     (id text primary key, data jsonb not null, updated_at timestamptz not null default now());

-- Sécurité : seuls les membres de l'équipe connectés accèdent aux données
alter table public.profiles    enable row level security;
alter table public.products    enable row level security;
alter table public.leads       enable row level security;
alter table public.partners    enable row level security;
alter table public.commissions enable row level security;
alter table public.devis       enable row level security;
alter table public.referrals   enable row level security;
alter table public.orders      enable row level security;
alter table public.formations  enable row level security;
alter table public."formationProgress" enable row level security;
alter table public.subscriptions enable row level security;
alter table public."subscriptionPayments" enable row level security;
alter table public.companies    enable row level security;
alter table public.factures     enable row level security;

drop policy if exists "team read"  on public.profiles;
create policy "team read" on public.profiles for select to authenticated using (true);

do $$
declare t text;
begin
  foreach t in array array['products','leads','partners','commissions','devis','referrals','orders','formations','formationProgress','subscriptions','subscriptionPayments','companies','factures'] loop
    execute format('drop policy if exists "team full access" on public.%I', t);
    execute format('create policy "team full access" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Temps réel : publier les changements de toutes les collections
do $$
declare t text;
begin
  foreach t in array array['products','leads','partners','commissions','devis','referrals','orders','formations','formationProgress','subscriptions','subscriptionPayments','companies','factures'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Tombstones : trace des suppressions pour la synchronisation non-destructive.
-- Un item supprimé localement y est enregistré avant d'être retiré de sa collection.
-- RAPPEL : exécuter ce bloc dans Supabase avant le premier déploiement multi-appareils.
create table if not exists public.tombstones (
  id         text        not null,
  collection text        not null,
  deleted_at timestamptz not null default now(),
  primary key (id, collection)
);
alter table public.tombstones enable row level security;
drop policy if exists "team full access" on public.tombstones;
create policy "team full access" on public.tombstones for all to authenticated using (true) with check (true);

-- Profils de l'équipe (les comptes Auth correspondants sont à créer
-- dans Authentication → Users avec les mêmes emails)
insert into public.profiles (id, email, name, role, phone, avatar) values
  ('u1', 'adam@bestasolar.bj',   'Adam Adébiyi',     'gerant',     '+229 97 12 34 56', 'AA'),
  ('u2', 'fatou@bestasolar.bj',  'Fatou Boko',       'technicien', '+229 96 78 90 12', 'FB'),
  ('u3', 'ibrahim@bestasolar.bj','Ibrahim Dan Djido','technicien', '+229 95 55 66 77', 'ID')
on conflict (id) do nothing;
