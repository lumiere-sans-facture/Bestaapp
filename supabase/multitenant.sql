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
-- Bootstrap SEULEMENT : si une autre organisation a été promue interne depuis
-- (cas d'un gérant inscrit en self-service, promu via partage-formation.sql),
-- rejouer ce script ne doit pas créer une DEUXIÈME source interne — deux
-- copies des mêmes cours partiraient vers les affiliés, dans un ordre
-- indéterminé.
update public.orgs set kind = 'interne'
 where id = 'org-bestasolar'
   and not exists (select 1 from public.orgs where kind = 'interne' and id <> 'org-bestasolar');

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

-- 3 bis. Kits solaires : collection née après le schéma initial. Créée ici
-- aussi, pour que ce fichier reste exécutable seul sur une base déjà en place.
create table if not exists public.kits (
  id text primary key, data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.kits enable row level security;

-- 3 ter. Onduleurs : suggérés en remplacement de celui d'un kit, même génération.
create table if not exists public.inverters (
  id text primary key, data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.inverters enable row level security;

-- Kits pompage (assistant Pompe solaire) : même génération.
create table if not exists public."pompeKits" (
  id text primary key, data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public."pompeKits" enable row level security;

-- Demandes de paiement des commissions (« retraits ») : même génération.
create table if not exists public."payoutRequests" (
  id text primary key, data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public."payoutRequests" enable row level security;

-- 4. org_id sur chaque collection + tombstones : ajout, back-fill, NOT NULL
do $$
declare t text;
begin
  foreach t in array array[
    'products','kits','inverters','pompeKits','leads','partners','commissions','devis','referrals','orders',
    'formations','formationProgress','subscriptions','subscriptionPayments',
    'companies','factures','proClients','payoutRequests','tombstones'
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
    'products','kits','inverters','pompeKits','leads','partners','commissions','devis','referrals','orders',
    'formations','formationProgress','subscriptions','subscriptionPayments',
    'companies','factures','proClients','payoutRequests'
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
    'products','kits','inverters','pompeKits','leads','partners','commissions','devis','referrals','orders',
    'formations','formationProgress','subscriptions','subscriptionPayments',
    'companies','factures','proClients','payoutRequests'
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
    'products','kits','inverters','pompeKits','leads','partners','commissions','devis','referrals','orders',
    'formations','formationProgress','subscriptions','subscriptionPayments',
    'companies','factures','proClients','payoutRequests','tombstones'
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

-- FORMATION : les cours BestaSolar sont, comme le catalogue, un actif interne
-- PARTAGÉ EN LECTURE avec toutes les organisations — y compris celles nées
-- d'une inscription par code partenaire. Sans cela, chaque entreprise ne
-- voyait que sa propre copie des cours livrés avec l'application, et le
-- contenu ajouté par BestaSolar ne lui parvenait jamais.
-- L'écriture reste limitée à sa propre organisation : une entreprise crée ses
-- cours à elle, elle ne modifie pas ceux de BestaSolar.
-- L'org source est désignée par son TYPE (kind = 'interne') et non par un
-- identifiant en dur : le partage suit l'organisation interne, quelle qu'elle
-- soit. L'avancement (formationProgress) n'est PAS partagé — la progression
-- de chacun reste dans son organisation.
-- SECURITY DEFINER indispensable : la RLS de `orgs` (policy « own org ») ne
-- laisse chacun lire QUE sa propre organisation. Une sous-requête directe
-- dans la policy s'exécuterait avec les droits de l'appelant et ne verrait
-- jamais l'org interne — le partage serait mort pour tout le monde. Même
-- mécanisme que auth_org_id / auth_is_platform_admin.
create or replace function public.org_est_interne(p_org text)
  returns boolean language sql stable security definer set search_path = public as
  'select exists (select 1 from public.orgs where id = p_org and kind = ''interne'')';

-- KITS SOLAIRES : les compositions ajoutées par BestaSolar sont proposées aux
-- techniciens de toutes les organisations. Elles sont partagées en lecture seule :
-- chaque organisation peut conserver ses propres variantes, sans pouvoir modifier
-- les kits officiels ni les recopier dans son périmètre.
drop policy if exists "org isolation" on public.kits;
drop policy if exists "kits lecture partagee" on public.kits;
drop policy if exists "kits ecriture org" on public.kits;
create policy "kits lecture partagee" on public.kits for select to authenticated
  using (org_id = public.auth_org_id() or public.org_est_interne(org_id));
create policy "kits ecriture org" on public.kits
  for all to authenticated
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

drop policy if exists "org isolation" on public.formations;
drop policy if exists "formations lecture partagee" on public.formations;
drop policy if exists "formations ecriture org" on public.formations;
-- Un cours MASQUÉ (brouillon du gérant) ne quitte jamais son organisation :
-- filtré ici, il n'est même pas transmis aux affiliés — le masquage ne
-- repose pas sur la seule bonne volonté de l'affichage client. Sa propre
-- organisation le reçoit toujours (le gérant doit le voir pour le gérer).
create policy "formations lecture partagee" on public.formations for select to authenticated
  using (
    org_id = public.auth_org_id()
    or (public.org_est_interne(org_id) and coalesce(data ->> 'masque', 'false') <> 'true')
  );
create policy "formations ecriture org" on public.formations
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
-- Parrainage : code partenaire (?ref=AMINATA) ayant amené l'inscription.
alter table public.orgs add column if not exists referred_by text;

-- Forme canonique d'un code partenaire. Le préfixe « BESTA- » a été retiré du
-- format — BESTA-BINTA-ZSUHKZ s'écrit désormais BINTA-ZSUHKZ — mais des liens,
-- des affiches et des cartes le portant circulent encore. Tout code est donc
-- ramené à cette forme avant d'être stocké ou comparé, exactement comme le
-- fait `normaliseCode` côté application. Sans cette symétrie, un filleul venu
-- par un ancien lien ne serait plus rattaché à son parrain.
create or replace function public.code_partenaire(p_code text)
  returns text language sql immutable set search_path = public as $$
  select nullif(regexp_replace(upper(trim(coalesce(p_code, ''))), '^BESTA-', ''), '')
$$;

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
  v_ref := public.code_partenaire(p_ref_code);
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
    where public.code_partenaire(pt.data->>'code') = v_ref
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
  v_code := public.code_partenaire(p_code);
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
    set referred_by = public.code_partenaire(p_code)
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
-- PROFIL PERSONNEL : chacun corrige SES coordonnées, jamais son rôle.
-- `profiles` n'a que des politiques de LECTURE : c'est volontaire (personne ne
-- peut s'auto-promouvoir gérant ou admin plateforme en appelant l'API REST).
-- Mais personne ne pouvait non plus corriger son nom ou son téléphone : l'écran
-- Équipe affichait éternellement l'ancien. Cette RPC ouvre exactement les trois
-- champs personnels, et rien d'autre.
-- ============================================================
create or replace function public.update_my_profile(p_name text, p_phone text default null, p_avatar text default null)
  returns void language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  v_email := auth.jwt() ->> 'email';
  if v_email is null then raise exception 'non authentifié'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'le nom ne peut pas être vide'; end if;
  update public.profiles
     set name   = trim(p_name),
         phone  = coalesce(nullif(trim(p_phone), ''), phone),
         avatar = coalesce(nullif(trim(p_avatar), ''), avatar)
   where lower(email) = lower(v_email);
  -- role, is_platform_admin et org_id ne sont volontairement PAS modifiables.
end $$;

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
    and public.code_partenaire(o.referred_by) in (
      select public.code_partenaire(pt.data ->> 'code') from public.partners pt
      where pt.org_id = public.auth_org_id() and coalesce(pt.data ->> 'code', '') <> ''
    )
  order by o.created_at desc
$$;

-- Propriétaire de l'espace : le gérant, l'admin plateforme, ou l'inscrit seul
-- dans une organisation SANS gérant — il en est le propriétaire de fait.
-- Exactement la règle de utils/roles.js (estProprietaireEspace) : les deux
-- doivent dire la même chose, sinon l'écran montre ce que la base refuse.
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

-- Clients du RÉSEAU : les pistes saisies par les entreprises que MES codes
-- partenaires ont fait naître. Un partenaire qui s'inscrit par un lien
-- d'affiliation ouvre sa PROPRE organisation ; l'isolation par org rend alors
-- ses clients invisibles pour la tête de réseau, qui ne voyait plus remonter
-- personne. Cette fonction rétablit la vue — en LECTURE SEULE, et strictement
-- au niveau 1 : les filleuls de mes filleuls appartiennent à leur propre
-- réseau, pas au mien. Réservée au gérant : voir les clients d'une autre
-- entreprise n'est pas une information d'équipe.
--
-- security definer parce qu'il faut traverser l'isolation ; la clause where
-- est donc TOUTE la protection : rien n'est renvoyé qui ne descende d'un code
-- partenaire de mon organisation.
create or replace function public.mes_clients_reseau()
  returns table (lead_id text, org_id text, org_name text, partner_code text,
                 nom text, contact text, telephone text, adresse text,
                 etape text, cree_le text, maj_le timestamptz)
  language sql stable security definer set search_path = public as $$
  select l.id, l.org_id, o.name,
         coalesce(
           -- L'apporteur désigné sur la piste…
           (select public.code_partenaire(pt.data ->> 'code') from public.partners pt
             where pt.org_id = l.org_id and pt.id = l.data ->> 'parrainL1'),
           -- …sinon le propriétaire de l'espace, celui qui l'a saisie.
           (select public.code_partenaire(pt.data ->> 'code') from public.partners pt
             where pt.org_id = l.org_id and coalesce(pt.data ->> 'userId', '') <> ''
             order by pt.updated_at asc limit 1)
         ),
         l.data ->> 'name', l.data ->> 'contact', l.data ->> 'phone',
         l.data ->> 'address', l.data ->> 'stage', l.data ->> 'createdAt',
         l.updated_at
  from public.leads l
  join public.orgs o on o.id = l.org_id
  where public.auth_org_id() is not null
    -- Réservé au gérant : ce sont les clients d'une AUTRE entreprise, pas de
    -- quoi ouvrir à toute l'équipe.
    and public.auth_est_proprietaire_espace()
    and l.org_id <> public.auth_org_id()
    and public.code_partenaire(o.referred_by) in (
      select public.code_partenaire(pt.data ->> 'code') from public.partners pt
      where pt.org_id = public.auth_org_id() and coalesce(pt.data ->> 'code', '') <> ''
    )
  order by l.updated_at desc
$$;

-- Partenaires du RÉSEAU : les personnes qui travaillent dans les entreprises
-- nées de MES codes. Elles ne sont dans aucune de mes tables — leur profil
-- partenaire vit chez elles — et n'apparaissaient donc nulle part dans
-- l'espace du gérant, alors que ce sont ses propres filleuls.
--
-- Mêmes garde-fous que mes_clients_reseau : lecture seule, niveau 1
-- uniquement, réservé au gérant, et la clause where est toute la protection.
create or replace function public.mes_partenaires_reseau()
  returns table (partner_id text, org_id text, org_name text, code text,
                 nom text, telephone text, email text, momo text,
                 inscrit_le timestamptz, pro_actif boolean)
  language sql stable security definer set search_path = public as $$
  select pt.id, pt.org_id, o.name,
         public.code_partenaire(pt.data ->> 'code'),
         pt.data ->> 'name', pt.data ->> 'phone', pt.data ->> 'email',
         pt.data ->> 'momoNumber', o.created_at,
         exists (
           select 1 from public.subscriptions s
           where s.org_id = o.id
             and s.data ->> 'status' = 'actif'
             and coalesce(nullif(s.data ->> 'dateFin', ''), '1970-01-01')::timestamptz > now()
         )
  from public.orgs o
  join public.partners pt
    on pt.org_id = o.id and coalesce(pt.data ->> 'userId', '') <> ''
  where public.auth_org_id() is not null
    and public.auth_est_proprietaire_espace()
    and o.id <> public.auth_org_id()
    and public.code_partenaire(o.referred_by) in (
      select public.code_partenaire(p2.data ->> 'code') from public.partners p2
      where p2.org_id = public.auth_org_id() and coalesce(p2.data ->> 'code', '') <> ''
    )
  order by o.created_at desc, pt.updated_at asc
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
      where public.code_partenaire(pt.data ->> 'code') = public.code_partenaire(v_ref)
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
    -- Exclut l'organisation de l'admin lui-même : ses propres devis sont déjà
    -- dans son état local (sinon ils apparaîtraient en double, en lecture seule).
    where d.org_id <> public.auth_org_id()
      and coalesce(d.data ->> 'type', '') <> 'pro'
  ) x;
  return v;
end $$;

-- Vue GÉRANT : le SUIVI COMMERCIAL de toute la plateforme — pistes et devis
-- publics de toutes les organisations (le kanban du gérant affiche ces
-- affaires en lecture seule ; elles se déplacent chez leur auteur).
-- Les devis de l'espace Pro payant restent strictement privés.
create or replace function public.admin_public_pipeline()
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.auth_is_platform_admin() then
    raise exception 'réservé à l''admin plateforme';
  end if;
  select jsonb_build_object(
    'leads', coalesce((
      select jsonb_agg(l.data || jsonb_build_object(
        'orgId', l.org_id, 'orgName', o.name,
        'authorName', coalesce(
          (select p.name from public.profiles p where p.id = l.data ->> 'assignedTo'),
          (select p.name from public.profiles p where p.org_id = l.org_id limit 1)
        )
      ))
      from public.leads l join public.orgs o on o.id = l.org_id
      where l.org_id <> public.auth_org_id()
    ), '[]'::jsonb),
    'devis', coalesce((
      select jsonb_agg(d.data || jsonb_build_object('orgId', d.org_id))
      from public.devis d
      where d.org_id <> public.auth_org_id()
        and coalesce(d.data ->> 'type', '') <> 'pro'
    ), '[]'::jsonb)
  ) into v;
  return v;
end $$;

-- ============================================================
-- SUPERVISION DES PROGRESSIONS : BestaSolar valide les demandes de TOUS les
-- comptes de la plateforme, pas seulement de sa propre équipe.
-- Un commercial inscrit sur la plateforme propose l'avancement de ses clients ;
-- l'admin tranche. Comme ces affaires vivent dans d'AUTRES organisations, la
-- RLS d'isolation les rend inaccessibles : d'où ces fonctions security definer.
-- ============================================================

-- Toutes les demandes en attente, toutes organisations (hors la sienne, déjà
-- présente dans son état local), avec de quoi décider : client, devis, étape
-- demandée, auteur de la demande.
create or replace function public.admin_pending_progressions()
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.auth_is_platform_admin() then
    raise exception 'réservé à l''admin plateforme';
  end if;
  select coalesce(jsonb_agg(x.d order by x.demande_le desc), '[]'::jsonb) into v
  from (
    -- Demandes portant sur une PISTE
    select (l.data -> 'pendingStage' ->> 'requestedAt') as demande_le,
           jsonb_build_object(
             'kind', 'lead', 'orgId', l.org_id, 'orgName', o.name, 'id', l.id,
             'clientName', l.data ->> 'name',
             'devisNumber', null,
             'stageActuel', l.data ->> 'stage',
             'stageDemande', l.data -> 'pendingStage' ->> 'stage',
             'demandeurNom', coalesce(
               (select p.name from public.profiles p where p.id = l.data -> 'pendingStage' ->> 'requestedBy'),
               (select p.name from public.profiles p where p.org_id = l.org_id limit 1)),
             'demandeLe', l.data -> 'pendingStage' ->> 'requestedAt'
           ) as d
    from public.leads l join public.orgs o on o.id = l.org_id
    where l.org_id <> public.auth_org_id()
      and l.data -> 'pendingStage' is not null
      and l.data -> 'pendingStage' <> 'null'::jsonb
    union all
    -- Demandes portant sur un DEVIS public
    select (d.data -> 'pendingStage' ->> 'requestedAt'),
           jsonb_build_object(
             'kind', 'devis', 'orgId', d.org_id, 'orgName', o.name, 'id', d.id,
             'clientName', (select l.data ->> 'name' from public.leads l
                            where l.org_id = d.org_id and l.id = d.data ->> 'leadId'),
             'devisNumber', d.data ->> 'devisNumber',
             'stageActuel', coalesce(d.data ->> 'stage', 'proposition'),
             'stageDemande', d.data -> 'pendingStage' ->> 'stage',
             'demandeurNom', coalesce(
               (select p.name from public.profiles p where p.id = d.data -> 'pendingStage' ->> 'requestedBy'),
               (select p.name from public.profiles p where p.org_id = d.org_id limit 1)),
             'demandeLe', d.data -> 'pendingStage' ->> 'requestedAt'
           )
    from public.devis d join public.orgs o on o.id = d.org_id
    where d.org_id <> public.auth_org_id()
      and coalesce(d.data ->> 'type', '') <> 'pro'
      and d.data -> 'pendingStage' is not null
      and d.data -> 'pendingStage' <> 'null'::jsonb
  ) x;
  return v;
end $$;

-- Décision de l'admin sur une demande d'une autre organisation.
-- p_approuver = true  : l'étape s'applique (et le « gagné » crée la commission
--                       de l'apporteur, DANS SON organisation) ;
--            = false  : la demande est simplement levée.
create or replace function public.admin_decide_progression(
  p_org_id text, p_kind text, p_id text, p_approuver boolean)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_data jsonb; v_stage text; v_now timestamptz := now();
  v_jour text; v_lead_id text; v_total numeric; v_l1 text; v_l2 text;
  v_partner_org text; v_cid text;
  v_lead_name text; v_code text; v_p1 text; v_p2 text;
  v_l1_name text; v_l2_code text; v_rid text;
begin
  if not public.auth_is_platform_admin() then
    raise exception 'réservé à l''admin plateforme';
  end if;
  v_jour := to_char(v_now at time zone 'utc', 'YYYY-MM-DD');

  if p_kind = 'lead' then
    select data into v_data from public.leads where org_id = p_org_id and id = p_id;
    if v_data is null then raise exception 'client introuvable'; end if;
    v_stage := v_data -> 'pendingStage' ->> 'stage';
    if v_stage is null then raise exception 'aucune demande en attente'; end if;
    if not p_approuver then
      update public.leads set data = data - 'pendingStage', updated_at = v_now
        where org_id = p_org_id and id = p_id;
      return;
    end if;
    update public.leads
      set data = (data - 'pendingStage')
        || jsonb_build_object('stage', v_stage, 'lastActivity', v_jour)
        || case when v_stage = 'gagne' then jsonb_build_object('wonAt', v_jour) else '{}'::jsonb end
        || case when v_stage = 'perdu' then jsonb_build_object('lostAt', v_jour) else '{}'::jsonb end,
          updated_at = v_now
      where org_id = p_org_id and id = p_id;
    v_lead_id := p_id;
    v_lead_name := v_data ->> 'name';
    v_total := coalesce(nullif(v_data ->> 'estimatedValue', '')::numeric, 0);
    v_l1 := nullif(v_data ->> 'parrainL1', '');
    v_l2 := nullif(v_data ->> 'parrainL2', '');

  elsif p_kind = 'devis' then
    select data into v_data from public.devis where org_id = p_org_id and id = p_id;
    if v_data is null then raise exception 'devis introuvable'; end if;
    v_stage := v_data -> 'pendingStage' ->> 'stage';
    if v_stage is null then raise exception 'aucune demande en attente'; end if;
    if not p_approuver then
      update public.devis set data = data - 'pendingStage', updated_at = v_now
        where org_id = p_org_id and id = p_id;
      return;
    end if;
    update public.devis
      set data = (data - 'pendingStage') || jsonb_build_object('stage', v_stage)
        || case when v_stage = 'gagne' then jsonb_build_object('wonAt', v_jour) else '{}'::jsonb end
        || case when v_stage = 'perdu' then jsonb_build_object('lostAt', v_jour) else '{}'::jsonb end,
          updated_at = v_now
      where org_id = p_org_id and id = p_id;
    v_lead_id := v_data ->> 'leadId';
    v_total := coalesce(nullif(v_data ->> 'total', '')::numeric, 0);
    v_l1 := nullif(v_data ->> 'partnerId', '');
    -- Le parrain de la piste prime sur l'apporteur du devis. On passe par des
    -- variables temporaires : un SELECT INTO sans ligne met ses cibles à NULL
    -- et effacerait l'apporteur du devis quand la piste manque.
    select nullif(l.data ->> 'parrainL1', ''), nullif(l.data ->> 'parrainL2', ''), l.data ->> 'name'
      into v_p1, v_p2, v_lead_name
      from public.leads l where l.org_id = p_org_id and l.id = v_lead_id;
    v_l1 := coalesce(v_p1, v_l1);
    v_l2 := v_p2;
  else
    raise exception 'type inconnu : %', p_kind;
  end if;

  -- NIVEAU 2 — le parrain de l'apporteur. Trois sources, dans cet ordre :
  --   1. le parrain figé sur la piste (`parrainL2`) ;
  --   2. le `sponsorId` du profil partenaire de l'apporteur (même organisation) ;
  --   3. un CODE de parrainage : celui du profil (`sponsorCode`), sinon celui
  --      de l'ORGANISATION (`orgs.referred_by`, posé à l'inscription).
  -- Le cas 3 est le plus courant et c'est lui qui manquait : un commercial qui
  -- s'inscrit avec un code n'a AUCUN profil partenaire de son parrain dans sa
  -- propre organisation — aucun `sponsorId` local ne peut donc le désigner, et
  -- le niveau 2 n'était jamais attribué. On résout alors le code sur toute la
  -- plateforme, l'organisation courante d'abord.
  if v_l1 is not null and v_l2 is null then
    select nullif(trim(pt.data ->> 'sponsorId'), ''),
           public.code_partenaire(pt.data ->> 'sponsorCode')
      into v_l2, v_code
      from public.partners pt where pt.org_id = p_org_id and pt.id = v_l1;
    if v_l2 is null then
      if v_code is null then
        select public.code_partenaire(o.referred_by) into v_code
          from public.orgs o where o.id = p_org_id;
      end if;
      if v_code is not null then
        select pt.id into v_l2 from public.partners pt
          where public.code_partenaire(pt.data ->> 'code') = v_code
          order by (pt.org_id = p_org_id) desc, pt.updated_at asc limit 1;
      end if;
    end if;
  end if;
  if v_l2 is not null and v_l2 = v_l1 then v_l2 := null; end if;

  -- Commission de l'apporteur, créée dans l'organisation où vit son profil.
  if v_stage = 'gagne' and v_total > 0 and v_l1 is not null then
    select org_id into v_partner_org from public.partners
      where id = v_l1 order by (org_id = p_org_id) desc limit 1;
    if v_partner_org is not null and not exists (
      select 1 from public.commissions c
      where c.org_id = v_partner_org
        and coalesce(c.data ->> 'devisId', '') = case when p_kind = 'devis' then p_id else '' end
        and c.data ->> 'partnerId' = v_l1
        and (c.data ->> 'level')::int = 1
        and coalesce(c.data ->> 'leadId', '') = coalesce(v_lead_id, '')
    ) then
      v_cid := gen_random_uuid()::text;
      insert into public.commissions (org_id, id, data, updated_at)
      values (v_partner_org, v_cid, jsonb_build_object(
        'id', v_cid, 'partnerId', v_l1, 'leadId', v_lead_id,
        -- Le client vit dans l'organisation de l'affaire : son nom est copié
        -- ici, sinon un parrain d'une AUTRE organisation ne saurait pas à quoi
        -- se rapporte sa commission.
        'leadName', v_lead_name, 'leadOrg', p_org_id,
        'devisId', case when p_kind = 'devis' then p_id else null end,
        'level', 1, 'amount', round(v_total * 0.03),
        'status', 'en_attente', 'paidAt', null, 'createdAt', v_jour
      ), v_now);
    end if;
    -- Niveau 2 : le parrain de l'apporteur.
    if v_l2 is not null and v_l2 <> v_l1 then
      select org_id into v_partner_org from public.partners
        where id = v_l2 order by (org_id = p_org_id) desc limit 1;
      if v_partner_org is not null and not exists (
        select 1 from public.commissions c
        where c.org_id = v_partner_org
          and coalesce(c.data ->> 'devisId', '') = case when p_kind = 'devis' then p_id else '' end
          and c.data ->> 'partnerId' = v_l2
          and (c.data ->> 'level')::int = 2
      ) then
        v_cid := gen_random_uuid()::text;
        insert into public.commissions (org_id, id, data, updated_at)
        values (v_partner_org, v_cid, jsonb_build_object(
          'id', v_cid, 'partnerId', v_l2, 'leadId', v_lead_id,
          'leadName', v_lead_name, 'leadOrg', p_org_id,
          'devisId', case when p_kind = 'devis' then p_id else null end,
          'level', 2, 'amount', round(v_total * 0.015),
          'status', 'en_attente', 'paidAt', null, 'createdAt', v_jour
        ), v_now);

        -- TRACE DE PARRAINAGE chez le parrain : sans elle, il touche une
        -- commission de niveau 2 sans que rien n'apparaisse dans « Historique
        -- de mes parrainages » — l'affaire de son filleul vit dans une autre
        -- organisation, invisible depuis la sienne.
        select pt.data ->> 'name' into v_l1_name from public.partners pt
          where pt.org_id = p_org_id and pt.id = v_l1;
        select pt.data ->> 'code' into v_l2_code from public.partners pt
          where pt.org_id = v_partner_org and pt.id = v_l2;
        v_rid := gen_random_uuid()::text;
        insert into public.referrals (org_id, id, data, updated_at)
        values (v_partner_org, v_rid, jsonb_build_object(
          'id', v_rid, 'partnerCode', v_l2_code, 'type', 'affaire',
          'status', 'validé', 'amount', round(v_total * 0.015),
          'leadId', null, 'leadName', v_lead_name, 'filleulName', v_l1_name,
          'affaireOrg', p_org_id, 'affaireId', p_id,
          'createdAt', to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        ), v_now);
      end if;
    end if;
  end if;
end $$;

-- Vue GÉRANT : les COMMISSIONS de toute la plateforme. Une commission naît dans
-- l'organisation de son bénéficiaire (c'est là que vit son profil partenaire),
-- donc la RLS la cache à BestaSolar — alors que c'est BestaSolar qui la doit.
-- Enrichie de quoi la lire et la payer sans accès à l'org : nom et téléphone du
-- partenaire, client apporté, numéro de devis.
create or replace function public.admin_platform_commissions()
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.auth_is_platform_admin() then
    raise exception 'réservé à l''admin plateforme';
  end if;
  select coalesce(jsonb_agg(x.doc order by x.tri desc), '[]'::jsonb) into v
  from (
    select c.updated_at as tri, c.data || jsonb_build_object(
      'orgId', c.org_id, 'orgName', o.name,
      'partnerName',  p.data ->> 'name',
      'partnerCode',  p.data ->> 'code',
      'partnerPhone', p.data ->> 'phone',
      -- Une commission de NIVEAU 2 vit chez le parrain, dans une autre
      -- organisation que le client : la jointure ne trouve rien et le nom
      -- copié sur la commission prend alors le relais.
      'leadName',     coalesce(l.data ->> 'name', c.data ->> 'leadName'),
      'leadValue',    l.data ->> 'estimatedValue',
      'devisNumber',  d.data ->> 'devisNumber'
    ) as doc
    from public.commissions c
    join public.orgs o on o.id = c.org_id
    left join public.partners p on p.org_id = c.org_id and p.id = c.data ->> 'partnerId'
    left join public.leads    l on l.org_id = c.org_id and l.id = c.data ->> 'leadId'
    left join public.devis    d on d.org_id = c.org_id and d.id = c.data ->> 'devisId'
    -- Hors sa propre organisation : ses commissions sont déjà dans son état
    -- local (sinon elles compteraient deux fois dans les totaux).
    where c.org_id <> public.auth_org_id()
  ) x;
  return v;
end $$;


-- Vue GÉRANT : les DEMANDES DE PAIEMENT de toute la plateforme. Une demande
-- naît dans l'organisation du partenaire ; sans cette remontée, un commercial
-- inscrit sur la plateforme réclamerait son argent dans le vide — BestaSolar
-- ne verrait jamais rien arriver.
create or replace function public.admin_platform_payouts()
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.auth_is_platform_admin() then
    raise exception 'réservé à l''admin plateforme';
  end if;
  select coalesce(jsonb_agg(x.doc order by x.tri asc), '[]'::jsonb) into v
  from (
    select r.updated_at as tri, r.data || jsonb_build_object(
      'orgId', r.org_id, 'orgName', o.name,
      -- Nom et coordonnées relus sur le profil : ils peuvent avoir changé
      -- depuis la demande, et c'est le numéro À JOUR qu'il faut créditer.
      'partnerName',  coalesce(p.data ->> 'name', r.data ->> 'partnerName'),
      'partnerCode',  coalesce(p.data ->> 'code', r.data ->> 'partnerCode'),
      'partnerPhone', coalesce(nullif(r.data ->> 'telephone', ''), p.data ->> 'momoNumber')
    ) as doc
    from public."payoutRequests" r
    join public.orgs o on o.id = r.org_id
    left join public.partners p on p.org_id = r.org_id and p.id = r.data ->> 'partnerId'
    where r.org_id <> public.auth_org_id()
      and r.data ->> 'status' = 'en_attente'
  ) x;
  return v;
end $$;

-- Décision de BestaSolar sur la demande d'un autre compte.
--   p_approuver = true  : la demande est réglée ET les commissions qu'elle
--                         couvre passent « payées » dans la foulée — sans quoi
--                         le même argent pourrait être redemandé ;
--              = false  : refus motivé, les commissions restent disponibles.
create or replace function public.admin_decide_payout(
  p_org_id text, p_id text, p_approuver boolean,
  p_mode text default 'momo', p_ref text default null, p_motif text default null)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_data jsonb; v_now timestamptz := now(); v_jour text; v_ids text[];
begin
  if not public.auth_is_platform_admin() then
    raise exception 'réservé à l''admin plateforme';
  end if;
  select data into v_data from public."payoutRequests" where org_id = p_org_id and id = p_id;
  if v_data is null then raise exception 'demande introuvable'; end if;
  if coalesce(v_data ->> 'status', '') <> 'en_attente' then
    raise exception 'demande déjà traitée';
  end if;
  v_jour := to_char(v_now at time zone 'utc', 'YYYY-MM-DD');

  if not p_approuver then
    update public."payoutRequests"
      set data = data || jsonb_build_object(
        'status', 'refuse', 'motif', p_motif,
        'decidedBy', auth.uid()::text,
        'decidedAt', to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
        updated_at = v_now
      where org_id = p_org_id and id = p_id;
    return;
  end if;

  select array(select jsonb_array_elements_text(coalesce(v_data -> 'commissionIds', '[]'::jsonb)))
    into v_ids;
  update public.commissions
    set data = data || jsonb_build_object(
      'status', 'payée', 'paidAt', v_jour, 'payMode', coalesce(nullif(p_mode, ''), 'momo'),
      'payRef', p_ref, 'paidBy', auth.uid()::text, 'payoutId', p_id),
      updated_at = v_now
    where org_id = p_org_id and id = any (v_ids)
      and coalesce(data ->> 'status', '') <> 'payée';

  update public."payoutRequests"
    set data = data || jsonb_build_object(
      'status', 'paye', 'payMode', coalesce(nullif(p_mode, ''), 'momo'),
      'payRef', p_ref, 'paidAt', v_jour,
      'decidedBy', auth.uid()::text,
      'decidedAt', to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
      updated_at = v_now
    where org_id = p_org_id and id = p_id;
end $$;

-- Paiement par BestaSolar d'une commission qui vit dans une autre organisation.
-- Idempotent : une commission déjà payée est refusée, jamais repayée.
create or replace function public.admin_pay_commission(
  p_org_id text, p_id text, p_mode text, p_ref text, p_note text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.auth_is_platform_admin() then
    raise exception 'réservé à l''admin plateforme';
  end if;
  update public.commissions
    set data = data || jsonb_build_object(
      'status', 'payée',
      'paidAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD'),
      'paidBy', auth.uid()::text,
      'payMode', coalesce(nullif(p_mode, ''), 'momo'),
      'payRef', p_ref, 'payNote', p_note),
      updated_at = now()
    where org_id = p_org_id and id = p_id
      and coalesce(data ->> 'status', '') <> 'payée';
  if not found then
    raise exception 'commission introuvable ou déjà payée';
  end if;
end $$;

-- L'admin fait avancer LUI-MÊME l'affaire d'un autre compte, sans attendre de
-- demande (« je peux aussi valider la progression de leur client sans qu'il
-- demande »). On dépose la demande puis on la valide : mêmes effets exactement
-- — étape appliquée, commissions créées une seule fois.
create or replace function public.admin_set_progression(
  p_org_id text, p_kind text, p_id text, p_stage text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_pending jsonb;
begin
  if not public.auth_is_platform_admin() then
    raise exception 'réservé à l''admin plateforme';
  end if;
  if p_stage is null or p_stage = '' then raise exception 'étape manquante'; end if;
  v_pending := jsonb_build_object(
    'stage', p_stage, 'requestedBy', auth.uid()::text,
    'requestedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  if p_kind = 'lead' then
    update public.leads set data = data || jsonb_build_object('pendingStage', v_pending)
      where org_id = p_org_id and id = p_id;
  elsif p_kind = 'devis' then
    update public.devis set data = data || jsonb_build_object('pendingStage', v_pending)
      where org_id = p_org_id and id = p_id;
  else
    raise exception 'type inconnu : %', p_kind;
  end if;
  if not found then raise exception 'affaire introuvable'; end if;
  perform public.admin_decide_progression(p_org_id, p_kind, p_id, true);
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

-- ============================================================
-- Migration « code sans préfixe » (idempotente : rejouable sans effet).
-- Les codes déjà enregistrés perdent leur « BESTA- », DES DEUX CÔTÉS du lien
-- d'affiliation : celui du partenaire, celui de son parrain, et celui noté sur
-- l'organisation qu'il a parrainée. Ne migrer qu'un seul côté romprait le
-- rapprochement et ferait disparaître les commissions.
-- ============================================================
update public.partners
   set data = jsonb_set(data, '{code}', to_jsonb(public.code_partenaire(data ->> 'code'))),
       updated_at = now()
 where coalesce(data ->> 'code', '') <> ''
   and data ->> 'code' is distinct from public.code_partenaire(data ->> 'code');

update public.partners
   set data = jsonb_set(data, '{sponsorCode}', to_jsonb(public.code_partenaire(data ->> 'sponsorCode'))),
       updated_at = now()
 where coalesce(data ->> 'sponsorCode', '') <> ''
   and data ->> 'sponsorCode' is distinct from public.code_partenaire(data ->> 'sponsorCode');

update public.referrals
   set data = jsonb_set(data, '{partnerCode}', to_jsonb(public.code_partenaire(data ->> 'partnerCode'))),
       updated_at = now()
 where coalesce(data ->> 'partnerCode', '') <> ''
   and data ->> 'partnerCode' is distinct from public.code_partenaire(data ->> 'partnerCode');

update public.orgs
   set referred_by = public.code_partenaire(referred_by)
 where referred_by is not null
   and referred_by is distinct from public.code_partenaire(referred_by);
