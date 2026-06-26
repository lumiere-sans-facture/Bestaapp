-- ============================================================
-- BestaSolar Pro — Migration multi-tenant (SaaS) · Phase 1
-- ============================================================
-- ⚠️  NE PAS exécuter tel quel en production. Conditions :
--   1) base SAUVEGARDÉE au préalable,
--   2) changements APP Phase 1 déployés (voir la liste ci-dessous),
--   3) validé sur un projet de STAGING avec ≥ 2 organisations.
-- Idempotent : ré-exécutable sans danger.
--
-- Changements APP requis AVANT d'activer ce schéma (couplés : le client doit
-- écrire org_id, sinon les écritures sont rejetées par la contrainte/RLS) :
--   • lib/remoteSync.js  : écrire `org_id` sur chaque ligne (pushCollections,
--     pushTombstone) ; le filtrer en lecture est automatique via la RLS.
--   • context/useRemoteSync.js : « base vierge » devient « cette ORG n'a pas
--     encore de données » ; ne plus pousser le seed de démo pour une org neuve.
--   • context/dataState.js : une nouvelle org démarre VIDE — le seed BestaSolar
--     n'est QUE les données de l'org 'org-bestasolar', pas l'état initial universel.
--   • context/AuthContext.jsx : charger `org_id` en même temps que le profil.
-- ============================================================

-- 1. Organisations (entreprises clientes du SaaS)
create table if not exists public.orgs (
  id         text primary key,
  name       text not null,
  plan       text not null default 'trial',   -- trial | active | suspended
  created_at timestamptz not null default now()
);
alter table public.orgs enable row level security;

-- Org par défaut : rattache toutes les données existantes (BestaSolar).
insert into public.orgs (id, name, plan)
  values ('org-bestasolar', 'BestaSolar', 'active')
  on conflict (id) do nothing;

-- 2. Rattachement utilisateur → organisation
alter table public.profiles add column if not exists org_id text references public.orgs(id);
update public.profiles set org_id = 'org-bestasolar' where org_id is null;
alter table public.profiles alter column org_id set not null;

-- 3. Org de l'utilisateur courant.
-- security definer = la fonction lit profiles sans déclencher la RLS de profiles
-- (sinon récursion, car la policy de profiles appelle cette fonction).
create or replace function public.auth_org_id()
  returns text language sql stable security definer set search_path = public as $$
  -- Lien auth↔profil par EMAIL (comme AuthContext.fetchProfile), pour couvrir
  -- aussi les profils existants dont l'id n'est pas l'uid Auth (u1/u2/u3).
  select org_id from public.profiles where lower(email) = lower(auth.jwt() ->> 'email')
$$;

-- 4. org_id sur chaque collection + tombstones : ajout, back-fill, NOT NULL
do $$
declare t text;
begin
  foreach t in array array[
    'products','leads','partners','commissions','devis','referrals','orders',
    'formations','formationProgress','subscriptions','subscriptionPayments',
    'companies','factures','tombstones'
  ] loop
    execute format('alter table public.%I add column if not exists org_id text', t);
    execute format('update public.%I set org_id = ''org-bestasolar'' where org_id is null', t);
    execute format('alter table public.%I alter column org_id set not null', t);
  end loop;
end $$;

-- 5. Index pour les requêtes scopées par org (et la future sync incrémentale)
do $$
declare t text;
begin
  foreach t in array array[
    'products','leads','partners','commissions','devis','referrals','orders',
    'formations','formationProgress','subscriptions','subscriptionPayments',
    'companies','factures'
  ] loop
    execute format('create index if not exists idx_%s_org_updated on public.%I (org_id, updated_at)', t, t);
  end loop;
end $$;
create index if not exists idx_tombstones_org_deleted on public.tombstones (org_id, deleted_at);

-- 6. RLS : isolation stricte par organisation (remplace « team full access »)
do $$
declare t text;
begin
  foreach t in array array[
    'products','leads','partners','commissions','devis','referrals','orders',
    'formations','formationProgress','subscriptions','subscriptionPayments',
    'companies','factures','tombstones'
  ] loop
    execute format('drop policy if exists "team full access" on public.%I', t);
    execute format('drop policy if exists "org isolation" on public.%I', t);
    execute format('create policy "org isolation" on public.%I for all to authenticated using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id())', t);
  end loop;
end $$;

-- profiles : chacun ne lit que les profils de sa propre org
drop policy if exists "team read" on public.profiles;
drop policy if exists "org read" on public.profiles;
create policy "org read" on public.profiles for select to authenticated
  using (org_id = public.auth_org_id());

-- orgs : un utilisateur voit (en lecture) uniquement sa propre organisation
drop policy if exists "own org" on public.orgs;
create policy "own org" on public.orgs for select to authenticated
  using (id = public.auth_org_id());

-- ============================================================
-- Inscription SELF-SERVICE : l'app crée l'org + le profil admin au signup.
-- RPC appelée juste après auth.signUp() — security definer car le nouvel
-- utilisateur n'a pas encore d'org (donc aucune RLS ne le laisserait insérer).
-- ============================================================
create or replace function public.signup_create_org(p_org_name text, p_user_name text)
  returns text language plpgsql security definer set search_path = public as $$
declare v_org text; v_email text;
begin
  v_email := auth.jwt() ->> 'email';
  if v_email is null then raise exception 'non authentifié'; end if;
  if exists (select 1 from public.profiles where lower(email) = lower(v_email)) then
    raise exception 'profil déjà existant pour cet email';
  end if;
  v_org := 'org-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.orgs (id, name, plan) values (v_org, p_org_name, 'trial');
  insert into public.profiles (id, email, name, role, org_id)
    values (auth.uid()::text, v_email, p_user_name, 'gerant', v_org);
  return v_org;
end $$;

-- Côté app (Phase 1, self-service) :
--   await supabase.auth.signUp({ email, password })
--   await supabase.rpc('signup_create_org', { p_org_name, p_user_name })
--   -> recharger le profil (AuthContext) ; la nouvelle org démarre VIDE.
-- Inviter des coéquipiers (techniciens) = flux admin séparé (phase ultérieure).
-- ============================================================
