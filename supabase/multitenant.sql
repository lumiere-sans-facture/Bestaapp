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

-- Code d'invitation d'équipe : colonne + DÉFAUT défini AVANT toute insertion
-- (la vérification NOT NULL précède la résolution ON CONFLICT — sans défaut,
-- le bootstrap ci-dessous échoue sur une base où la colonne existe déjà).
alter table public.orgs add column if not exists invite_code text unique;
alter table public.orgs alter column invite_code
  set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
update public.orgs
  set invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  where invite_code is null;
alter table public.orgs alter column invite_code set not null;

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
    'companies','factures','proClients','tombstones'
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
    'companies','factures','proClients'
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
    'companies','factures','proClients','tombstones'
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
-- ============================================================

-- ============================================================
-- ÉQUIPE : adhésion par code d'invitation (colonne définie en tête de script).
-- Le gérant partage le code (visible dans l'écran Équipe) ; le technicien
-- s'inscrit avec ce code et rejoint l'org — aucun accès admin requis.
-- ============================================================
create or replace function public.signup_join_org(p_invite_code text, p_user_name text)
  returns text language plpgsql security definer set search_path = public as $$
declare v_org text; v_email text;
begin
  v_email := auth.jwt() ->> 'email';
  if v_email is null then raise exception 'non authentifié'; end if;
  if exists (select 1 from public.profiles where lower(email) = lower(v_email)) then
    raise exception 'profil déjà existant pour cet email';
  end if;
  select id into v_org from public.orgs where invite_code = upper(trim(p_invite_code));
  if v_org is null then raise exception 'code d''invitation invalide'; end if;
  insert into public.profiles (id, email, name, role, org_id)
    values (auth.uid()::text, v_email, p_user_name, 'technicien', v_org);
  return v_org;
end $$;

-- ============================================================
-- ABONNEMENTS DEVIS PRO : vérité côté serveur.
-- Faille corrigée : sans ce bloc, n'importe quel membre peut pousser une ligne
-- subscriptions { status: 'actif' } et s'activer le mode Pro gratuitement.
-- Règle : les membres peuvent créer/modifier une DEMANDE (status ≠ 'actif') ;
-- seul un ADMIN PLATEFORME (toi, l'éditeur de l'app) peut écrire 'actif'.
-- ============================================================
alter table public.profiles add column if not exists is_platform_admin boolean not null default false;

-- Admin plateforme = éditeur du SaaS (accès transverse aux abonnements).
create or replace function public.auth_is_platform_admin()
  returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_platform_admin from public.profiles where lower(email) = lower(auth.jwt() ->> 'email')),
    false
  )
$$;

-- subscriptions : lecture dans son org (+ admin partout) ; écriture 'actif'
-- réservée à l'admin plateforme.
drop policy if exists "org isolation" on public.subscriptions;
drop policy if exists "subs read" on public.subscriptions;
drop policy if exists "subs write" on public.subscriptions;
create policy "subs read" on public.subscriptions for select to authenticated
  using (org_id = public.auth_org_id() or public.auth_is_platform_admin());
create policy "subs write" on public.subscriptions for all to authenticated
  using (
    public.auth_is_platform_admin()
    or (org_id = public.auth_org_id() and coalesce(data ->> 'status', '') <> 'actif')
  )
  with check (
    public.auth_is_platform_admin()
    or (org_id = public.auth_org_id() and coalesce(data ->> 'status', '') <> 'actif')
  );

-- subscriptionPayments : demande de paiement par les membres ; la validation
-- (statut « confirme ») reste à l'admin plateforme. NB : le champ du paiement
-- s'appelle `statut` (celui de l'abonnement s'appelle `status`).
drop policy if exists "org isolation" on public."subscriptionPayments";
drop policy if exists "subpay read" on public."subscriptionPayments";
drop policy if exists "subpay write" on public."subscriptionPayments";
create policy "subpay read" on public."subscriptionPayments" for select to authenticated
  using (org_id = public.auth_org_id() or public.auth_is_platform_admin());
create policy "subpay write" on public."subscriptionPayments" for all to authenticated
  using (
    public.auth_is_platform_admin()
    or (org_id = public.auth_org_id() and coalesce(data ->> 'statut', '') <> 'confirme')
  )
  with check (
    public.auth_is_platform_admin()
    or (org_id = public.auth_org_id() and coalesce(data ->> 'statut', '') <> 'confirme')
  );

-- L'admin plateforme lit les profils de toutes les orgs (écran Abonnements).
drop policy if exists "platform admin read" on public.profiles;
create policy "platform admin read" on public.profiles for select to authenticated
  using (public.auth_is_platform_admin());

-- Se déclarer admin plateforme (à exécuter UNE FOIS, avec ton email) :
--   update public.profiles set is_platform_admin = true where email = 'ton@email';
-- ============================================================
