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

-- Type d'organisation :
--   'interne' = BestaSolar (CRM complet : boutique, partenaires, commissions, équipe)
--   'pro'     = installateur abonné Devis Pro (ses clients, ses devis/factures,
--               le dimensionnement — offre à 5 000 F/mois)
-- Les inscriptions self-service créent toujours des orgs 'pro'.
alter table public.orgs add column if not exists kind text not null default 'pro'
  check (kind in ('interne', 'pro'));
update public.orgs set kind = 'interne' where id = 'org-bestasolar';

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
-- invite_code fourni explicitement : aucune dépendance à la valeur par défaut
-- (robuste quel que soit l'état laissé par une exécution précédente).
insert into public.orgs (id, name, plan, kind, invite_code)
  values ('org-bestasolar', 'BestaSolar', 'active', 'interne',
          upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)))
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

-- 5 bis. Clés primaires PAR ORGANISATION : (org_id, id) au lieu de (id).
-- Indispensable : la dotation de départ (catalogue, formations) porte les
-- mêmes identifiants dans chaque entreprise — avec une clé globale, seule la
-- première entreprise pouvait pousser ses données, la synchronisation des
-- suivantes échouait (voyant « pas en ligne »).
do $$
declare t text;
begin
  foreach t in array array[
    'products','leads','partners','commissions','devis','referrals','orders',
    'formations','formationProgress','subscriptions','subscriptionPayments',
    'companies','factures','proClients'
  ] loop
    if not exists (
      select 1 from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.conrelid = format('public.%I', t)::regclass
        and c.contype = 'p' and a.attname = 'org_id'
    ) then
      execute format('alter table public.%I drop constraint %I', t, t || '_pkey');
      execute format('alter table public.%I add primary key (org_id, id)', t);
    end if;
  end loop;
  -- tombstones : (org_id, id, collection)
  if not exists (
    select 1 from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.tombstones'::regclass
      and c.contype = 'p' and a.attname = 'org_id'
  ) then
    alter table public.tombstones drop constraint tombstones_pkey;
    alter table public.tombstones add primary key (org_id, id, collection);
  end if;
end $$;

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

-- CATALOGUE : actif interne BestaSolar, PARTAGÉ EN LECTURE avec toutes les
-- organisations (boutique en consultation, dimensionnement solaire Pro).
-- Écriture strictement limitée à sa propre org — en pratique, seule l'org
-- interne alimente le catalogue ; les inscrits n'en reçoivent aucune copie.
drop policy if exists "org isolation" on public.products;
drop policy if exists "catalogue lecture partagee" on public.products;
drop policy if exists "catalogue ecriture org" on public.products;
create policy "catalogue lecture partagee" on public.products for select to authenticated
  using (org_id = public.auth_org_id() or org_id = 'org-bestasolar');
create policy "catalogue ecriture org" on public.products
  for all to authenticated
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

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
-- Parrainage : code partenaire (?ref=BESTA-XXX) ayant amené l'inscription.
alter table public.orgs add column if not exists referred_by text;

-- Les anciennes signatures sont supprimées AVANT de recréer la fonction
-- (sinon PostgREST verrait plusieurs fonctions homonymes et rejetterait
-- les appels pour ambiguïté).
drop function if exists public.signup_create_org(text, text);
drop function if exists public.signup_create_org(text, text, text);
create or replace function public.signup_create_org(p_org_name text, p_user_name text, p_ref_code text default null, p_phone text default '')
  returns text language plpgsql security definer set search_path = public as $$
declare v_org text; v_email text; v_ref text; v_rid text;
begin
  v_email := auth.jwt() ->> 'email';
  if v_email is null then raise exception 'non authentifié'; end if;
  if exists (select 1 from public.profiles where lower(email) = lower(v_email)) then
    raise exception 'profil déjà existant pour cet email';
  end if;
  v_org := 'org-' || replace(gen_random_uuid()::text, '-', '');
  v_ref := nullif(upper(trim(coalesce(p_ref_code, ''))), '');
  insert into public.orgs (id, name, plan, invite_code, referred_by)
    values (v_org, p_org_name, 'trial',
            upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
            v_ref);
  -- Utilisateur CLASSIQUE (pas gérant) : l'inscription self-service ne donne
  -- aucun menu de gestion — l'app simple (tableau de bord, clients, boutique,
  -- formations, espace partenaire) + l'option Pro payante.
  insert into public.profiles (id, email, name, role, org_id, phone)
    values (auth.uid()::text, v_email, p_user_name, 'technicien', v_org, coalesce(trim(p_phone), ''));
  -- ATTRIBUTION du parrainage : trace l'inscription CHEZ LE PARRAIN — une
  -- ligne au registre d'affiliation de SON organisation. C'est ce qui alimente
  -- « Historique de mes parrainages » et le suivi des filleuls du partenaire.
  -- En cas de code présent dans plusieurs orgs (homonymes), le plus ancien gagne.
  if v_ref is not null then
    v_rid := gen_random_uuid()::text;
    insert into public.referrals (org_id, id, data, updated_at)
    select pt.org_id, v_rid, jsonb_build_object(
        'id', v_rid,
        'partnerCode', pt.data->>'code',
        'type', 'inscription',
        'status', 'validé',
        'amount', null,
        'leadId', null,
        'filleulOrg', v_org,
        'filleulName', p_user_name,
        'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ), now()
    from public.partners pt
    where upper(pt.data->>'code') = v_ref
    order by pt.updated_at asc
    limit 1;
  end if;
  return v_org;
end $$;

-- Côté app (Phase 1, self-service) :
--   await supabase.auth.signUp({ email, password })
--   await supabase.rpc('signup_create_org', { p_org_name, p_user_name })
--   -> recharger le profil (AuthContext) ; la nouvelle org démarre VIDE.
-- ============================================================

-- ============================================================
-- PARRAINAGE APRÈS INSCRIPTION : attribution unique, verrouillée.
-- Le gérant d'une entreprise peut saisir le code de son parrain UNE SEULE
-- FOIS (s'il n'est pas venu par le lien). Ensuite, la base refuse tout
-- changement — seule l'admin plateforme (BestaSolar) peut modifier, sur
-- demande expresse du partenaire.
-- ============================================================
create or replace function public.set_org_referral(p_code text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_org text; v_role text; v_existing text; v_code text;
begin
  select org_id, role into v_org, v_role
    from public.profiles where lower(email) = lower(auth.jwt() ->> 'email');
  if v_org is null then raise exception 'non authentifié'; end if;
  -- Autorisé : le gérant, OU l'utilisateur d'un espace SANS gérant (compte
  -- classique seul dans son espace — il en est le propriétaire de fait).
  if v_role <> 'gerant' and exists (
    select 1 from public.profiles where org_id = v_org and role = 'gerant'
  ) then
    raise exception 'seul le gérant de l''entreprise peut attribuer le code de parrainage';
  end if;
  v_code := nullif(upper(trim(coalesce(p_code, ''))), '');
  if v_code is null then raise exception 'code de parrainage vide'; end if;
  select referred_by into v_existing from public.orgs where id = v_org;
  if v_existing is not null then
    raise exception 'code de parrainage déjà attribué (%) — contactez BestaSolar pour le modifier', v_existing;
  end if;
  update public.orgs set referred_by = v_code where id = v_org;
end $$;

-- Modification / correction : admin plateforme uniquement (p_code null = retirer).
create or replace function public.admin_set_org_referral(p_org_id text, p_code text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.auth_is_platform_admin() then
    raise exception 'réservé à l''admin plateforme';
  end if;
  update public.orgs
    set referred_by = nullif(upper(trim(coalesce(p_code, ''))), '')
    where id = p_org_id;
  if not found then raise exception 'organisation inconnue : %', p_org_id; end if;
end $$;

-- ============================================================
-- ÉQUIPE : adhésion par code d'invitation (colonne définie en tête de script).
-- Le gérant partage le code (visible dans l'écran Équipe) ; le technicien
-- s'inscrit avec ce code et rejoint l'org — aucun accès admin requis.
-- ============================================================
drop function if exists public.signup_join_org(text, text);
create or replace function public.signup_join_org(p_invite_code text, p_user_name text, p_phone text default '')
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
  insert into public.profiles (id, email, name, role, org_id, phone)
    values (auth.uid()::text, v_email, p_user_name, 'technicien', v_org, coalesce(trim(p_phone), ''));
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
drop policy if exists "subs insert" on public.subscriptions;
drop policy if exists "subs update" on public.subscriptions;
drop policy if exists "subs delete" on public.subscriptions;
create policy "subs read" on public.subscriptions for select to authenticated
  using (org_id = public.auth_org_id() or public.auth_is_platform_admin());
-- Un membre ne peut jamais ÉCRIRE « actif » (with check), mais il peut
-- PARTIR d'une ligne active (using) : c'est le renouvellement — l'abonnement
-- actif repasse « en_attente_paiement » à la demande suivante.
create policy "subs insert" on public.subscriptions for insert to authenticated
  with check (
    public.auth_is_platform_admin()
    or (org_id = public.auth_org_id() and coalesce(data ->> 'status', '') <> 'actif')
  );
create policy "subs update" on public.subscriptions for update to authenticated
  using (org_id = public.auth_org_id() or public.auth_is_platform_admin())
  with check (
    public.auth_is_platform_admin()
    or (org_id = public.auth_org_id() and coalesce(data ->> 'status', '') <> 'actif')
  );
create policy "subs delete" on public.subscriptions for delete to authenticated
  using (org_id = public.auth_org_id() or public.auth_is_platform_admin());

-- subscriptionPayments : demande de paiement par les membres ; la validation
-- (statut « confirme ») reste à l'admin plateforme. NB : le champ du paiement
-- s'appelle `statut` (celui de l'abonnement s'appelle `status`).
drop policy if exists "org isolation" on public."subscriptionPayments";
drop policy if exists "subpay read" on public."subscriptionPayments";
drop policy if exists "subpay write" on public."subscriptionPayments";
drop policy if exists "subpay insert" on public."subscriptionPayments";
drop policy if exists "subpay update" on public."subscriptionPayments";
drop policy if exists "subpay delete" on public."subscriptionPayments";
create policy "subpay read" on public."subscriptionPayments" for select to authenticated
  using (org_id = public.auth_org_id() or public.auth_is_platform_admin());
-- Un paiement confirmé est un reçu IMMUABLE pour les membres : ni création
-- ni modification d'une ligne « confirme » (l'app ne pousse d'ailleurs plus
-- ces lignes — elles n'appartiennent qu'au serveur).
create policy "subpay insert" on public."subscriptionPayments" for insert to authenticated
  with check (
    public.auth_is_platform_admin()
    or (org_id = public.auth_org_id() and coalesce(data ->> 'statut', '') <> 'confirme')
  );
create policy "subpay update" on public."subscriptionPayments" for update to authenticated
  using (
    public.auth_is_platform_admin()
    or (org_id = public.auth_org_id() and coalesce(data ->> 'statut', '') <> 'confirme')
  )
  with check (
    public.auth_is_platform_admin()
    or (org_id = public.auth_org_id() and coalesce(data ->> 'statut', '') <> 'confirme')
  );
create policy "subpay delete" on public."subscriptionPayments" for delete to authenticated
  using (org_id = public.auth_org_id() or public.auth_is_platform_admin());

-- L'admin plateforme lit les profils de toutes les orgs (écran Abonnements).
drop policy if exists "platform admin read" on public.profiles;
create policy "platform admin read" on public.profiles for select to authenticated
  using (public.auth_is_platform_admin());

-- Se déclarer admin plateforme (à exécuter UNE FOIS, avec ton email) :
--   update public.profiles set is_platform_admin = true where email = 'ton@email';
-- ============================================================

-- ============================================================
-- AFFILIATION CROSS-ORG : suivi des filleuls + commissions d'abonnement.
-- Le partenaire (org A) parraine une inscription (org B) : le suivi et les
-- commissions doivent TRAVERSER les organisations — impossible avec la seule
-- RLS d'isolation, d'où ces fonctions security definer.
-- ============================================================

-- Taux de commission sur chaque paiement d'abonnement d'un filleul (10 % de
-- 5 000 F = 500 F). Modifier ICI puis ré-exécuter le script pour changer.
create or replace function public.referral_commission_rate()
  returns numeric language sql immutable as $$ select 0.10 $$;

-- Filleuls de MON organisation : les entreprises inscrites via un des codes
-- partenaires de mon org, avec leur état d'abonnement Pro. Le tableau de bord
-- partenaire filtre ensuite par code pour n'afficher que SES filleuls.
create or replace function public.my_referred_orgs()
  returns table (partner_code text, org_id text, org_name text, member_name text,
                 inscrit_le timestamptz, pro_actif boolean)
  language sql stable security definer set search_path = public as $$
  select o.referred_by, o.id, o.name,
         (select p.name from public.profiles p where p.org_id = o.id limit 1),
         o.created_at,
         exists (
           select 1 from public.subscriptions s
           where s.org_id = o.id
             and s.data ->> 'status' = 'actif'
             and coalesce(nullif(s.data ->> 'dateFin', ''), '1970-01-01')::timestamptz > now()
         )
  from public.orgs o
  where o.referred_by is not null
    and o.referred_by in (
      select upper(pt.data ->> 'code') from public.partners pt
      where pt.org_id = public.auth_org_id() and coalesce(pt.data ->> 'code', '') <> ''
    )
  order by o.created_at desc
$$;

-- Vue ADMIN : tous les abonnements et paiements de TOUTES les organisations
-- (l'écran « Abonnements Devis Pro » lisait l'état local — il ne voyait donc
-- jamais les demandes des autres entreprises).
create or replace function public.admin_subscriptions_overview()
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.auth_is_platform_admin() then
    raise exception 'réservé à l''admin plateforme';
  end if;
  select jsonb_build_object(
    'subscriptions', coalesce((
      select jsonb_agg(s.data || jsonb_build_object(
        'orgId', s.org_id, 'orgName', o.name, 'referredBy', o.referred_by,
        'memberName', (select p.name from public.profiles p where p.org_id = s.org_id limit 1)
      ) order by s.updated_at desc)
      from public.subscriptions s join public.orgs o on o.id = s.org_id
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(sp.data || jsonb_build_object(
        'orgId', sp.org_id, 'orgName', o.name,
        'memberName', (select p.name from public.profiles p where p.org_id = sp.org_id limit 1)
      ) order by sp.updated_at desc)
      from public."subscriptionPayments" sp join public.orgs o on o.id = sp.org_id
    ), '[]'::jsonb)
  ) into v;
  return v;
end $$;

-- Confirmation d'un paiement par l'admin plateforme :
--   1) le paiement passe « confirme » (reçu immuable),
--   2) l'abonnement de l'org est activé +30 jours (depuis sa fin si elle court),
--   3) le partenaire PARRAIN de l'org touche sa commission (taux ci-dessus),
--      dédupliquée par paiement — reconfirmer ne crée jamais de doublon.
create or replace function public.admin_confirm_subscription_payment(p_org_id text, p_payment_id text)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_pay jsonb; v_sub_id text; v_montant numeric; v_now timestamptz := now();
  v_base timestamptz; v_ref text; v_partner_org text; v_partner_id text;
  v_cid text; v_iso text; v_fin text;
begin
  if not public.auth_is_platform_admin() then
    raise exception 'réservé à l''admin plateforme';
  end if;
  select data into v_pay from public."subscriptionPayments"
    where org_id = p_org_id and id = p_payment_id;
  if v_pay is null then raise exception 'paiement introuvable'; end if;
  if coalesce(v_pay ->> 'statut', '') <> 'initie' then
    raise exception 'paiement déjà traité (statut « % »)', v_pay ->> 'statut';
  end if;
  v_sub_id  := v_pay ->> 'subscriptionId';
  v_montant := coalesce(nullif(v_pay ->> 'montant', '')::numeric, 5000);
  v_iso := to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  update public."subscriptionPayments"
    set data = data || jsonb_build_object('statut', 'confirme'), updated_at = v_now
    where org_id = p_org_id and id = p_payment_id;

  -- +30 jours depuis maintenant, ou depuis la fin actuelle si elle court encore.
  select greatest(v_now, coalesce(nullif(data ->> 'dateFin', '')::timestamptz, v_now))
    into v_base
    from public.subscriptions where org_id = p_org_id and id = v_sub_id;
  if v_base is null then raise exception 'abonnement introuvable (%)', v_sub_id; end if;
  v_fin := to_char((v_base + interval '30 days') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  update public.subscriptions
    set data = data
      || jsonb_build_object('status', 'actif', 'dateFin', v_fin, 'lastPaymentAt', v_iso)
      || case when coalesce(data ->> 'dateDebut', '') = ''
              then jsonb_build_object('dateDebut', v_iso) else '{}'::jsonb end,
        updated_at = v_now
    where org_id = p_org_id and id = v_sub_id;

  -- Commission du parrain, créée DANS SON organisation (elle arrive dans son
  -- espace partenaire à la synchronisation suivante).
  select o.referred_by into v_ref from public.orgs o where o.id = p_org_id;
  if v_ref is not null then
    select pt.org_id, pt.id into v_partner_org, v_partner_id
      from public.partners pt
      where upper(pt.data ->> 'code') = upper(v_ref)
      order by pt.updated_at asc
      limit 1;
    if v_partner_id is not null and not exists (
      select 1 from public.commissions c
      where c.org_id = v_partner_org and c.data ->> 'paymentId' = p_payment_id
    ) then
      v_cid := gen_random_uuid()::text;
      insert into public.commissions (org_id, id, data, updated_at)
      values (v_partner_org, v_cid, jsonb_build_object(
        'id', v_cid,
        'partnerId', v_partner_id,
        'leadId', null,
        'level', 1,
        'amount', round(v_montant * public.referral_commission_rate()),
        'status', 'en_attente',
        'paidAt', null,
        'createdAt', to_char(v_now at time zone 'utc', 'YYYY-MM-DD'),
        'source', 'abonnement',
        'paymentId', p_payment_id,
        'note', 'Abonnement Devis Pro d''un filleul'
      ), v_now);
    end if;
  end if;
end $$;

-- Vue GÉRANT : tous les devis PUBLICS de la plateforme (solaires + comptants),
-- créés par n'importe quel compte. Le nom du client est joint depuis la piste
-- de l'org d'origine ; les devis de l'espace Pro payant (type 'pro') restent
-- STRICTEMENT privés — c'est l'activité propre de l'abonné, jamais remontée.
create or replace function public.admin_public_devis()
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.auth_is_platform_admin() then
    raise exception 'réservé à l''admin plateforme';
  end if;
  select coalesce(jsonb_agg(x.doc order by x.tri desc), '[]'::jsonb) into v
  from (
    select d.updated_at as tri, d.data || jsonb_build_object(
      'orgId', d.org_id,
      'orgName', o.name,
      'authorName', coalesce(
        (select p.name from public.profiles p where p.id = d.data ->> 'createdBy'),
        (select p.name from public.profiles p where p.org_id = d.org_id limit 1)
      ),
      'clientName',  coalesce(nullif(d.data ->> 'clientName', ''),  l.data ->> 'name'),
      'clientPhone', coalesce(nullif(d.data ->> 'clientPhone', ''), l.data ->> 'phone'),
      'clientVille', coalesce(nullif(d.data ->> 'clientVille', ''), l.data ->> 'address')
    ) as doc
    from public.devis d
    join public.orgs o on o.id = d.org_id
    left join public.leads l on l.org_id = d.org_id and l.id = d.data ->> 'leadId'
    where d.org_id <> 'org-bestasolar'
      and coalesce(d.data ->> 'type', '') <> 'pro'
  ) x;
  return v;
end $$;

-- Refus d'un paiement : le reçu passe « rejete » ; l'abonnement en attente
-- retombe sur son état réel (actif si la période payée court encore, sinon expiré).
create or replace function public.admin_reject_subscription_payment(p_org_id text, p_payment_id text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_pay jsonb; v_sub_id text; v_now timestamptz := now();
begin
  if not public.auth_is_platform_admin() then
    raise exception 'réservé à l''admin plateforme';
  end if;
  select data into v_pay from public."subscriptionPayments"
    where org_id = p_org_id and id = p_payment_id;
  if v_pay is null then raise exception 'paiement introuvable'; end if;
  update public."subscriptionPayments"
    set data = data || jsonb_build_object('statut', 'rejete'), updated_at = v_now
    where org_id = p_org_id and id = p_payment_id;
  v_sub_id := v_pay ->> 'subscriptionId';
  update public.subscriptions
    set data = data || jsonb_build_object('status',
        case when coalesce(nullif(data ->> 'dateFin', ''), '1970-01-01')::timestamptz > v_now
             then 'actif' else 'expire' end),
        updated_at = v_now
    where org_id = p_org_id and id = v_sub_id
      and data ->> 'status' = 'en_attente_paiement';
end $$;
-- ============================================================
