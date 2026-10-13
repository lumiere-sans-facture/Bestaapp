-- =====================================================================
--  PARRAINAGE ET COMMISSIONS : liés à la PERSONNE, calculés par le SERVEUR.
--  Rejouable sans danger (rien n'est effacé, rien n'est dupliqué).
--  Annulation : supabase/annuler-parrainage-commissions.sql
--  Rattrapage des données existantes : supabase/rattrapage-parrainage.sql
--  DANS LES DEUX PROJETS : test (recette) ET production.
--  Après avoir rejoué multitenant.sql, rejouer CE fichier : il redéfinit
--  signup_create_org, set_org_referral, admin_decide_progression et
--  admin_confirm_subscription_payment.
-- =====================================================================
--
-- CE QUE ÇA CORRIGE. Depuis la réunion de tous les comptes dans une
-- organisation Besta unique, le lien parrain → filleul vivait sur
-- l'ORGANISATION (orgs.referred_by), commune à tout le monde :
--   1. le filleul lisait « parrainé par X » sur l'entreprise commune, et la
--      liste « Mes filleuls » du parrain cherchait des ENTREPRISES nées de
--      son code — il ne s'en crée plus aucune : liste vide ;
--   2. la commission était calculée dans le navigateur de celui qui validait
--      le devis (le gérant), d'après ses copies locales : l'apporteur
--      retombait sur le créateur du devis — le gérant — au lieu du
--      technicien ;
--   3. deux niveaux en dur, à deux endroits (application et SQL), sans
--      contrainte d'unicité : deux appareils qui valident ensemble créaient
--      deux commissions ;
--   4. un clic n'était compté qu'une fois le visiteur CONNECTÉ, dans son
--      propre état : jamais chez le parrain.
--
-- LA RÈGLE (décidée par BestaSolar) : à la validation d'un devis public,
--   niveau 1 = le technicien propriétaire du client (celui qui l'a
--              enregistré, sinon le commercial assigné, sinon l'auteur du
--              devis) — la même règle de propriété que la sécurité des
--              clients ;
--   niveau 2 = son parrain ; niveau 3 = le parrain du parrain… autant de
--              niveaux que de taux actifs dans reglages_commissions.
-- Taux actuels : 3 % et 1,5 %.

begin;

-- 0. PRÉREQUIS ---------------------------------------------------------
-- Seul le socle est exigé : les tables de schema.sql et les fonctions
-- d'isolation de multitenant.sql. Ce qui est venu APRÈS (fin août, début
-- septembre) est recréé plus bas s'il manque — sans jamais remplacer une
-- version déjà installée.
do $$
declare v_manque text := ''; v_table text;
begin
  if to_regprocedure('public.auth_org_id()') is null then v_manque := v_manque || ' auth_org_id ;'; end if;
  if to_regprocedure('public.auth_is_platform_admin()') is null then v_manque := v_manque || ' auth_is_platform_admin ;'; end if;
  foreach v_table in array array['orgs', 'profiles', 'partners', 'leads', 'devis', 'commissions',
    'referrals', 'payoutRequests', 'subscriptions', 'subscriptionPayments', 'tombstones'] loop
    if to_regclass(format('public.%I', v_table)) is null then v_manque := v_manque || ' table ' || v_table || ' ;'; end if;
  end loop;
  if v_manque <> '' then
    raise exception 'Base en retard — il manque :% Exécutez d''abord schema.sql puis multitenant.sql (le socle). Rien n''a été modifié.', v_manque;
  end if;
end $$;

-- Colonnes de la réunion des organisations (migration 20260902, reprises
-- dans multitenant.sql) : lues par l'inscription et le rattrapage. Vides
-- tant que la réunion n'a pas eu lieu, ce qui ne gêne rien.
alter table public.orgs add column if not exists merged_into text references public.orgs(id);
alter table public.orgs add column if not exists merged_at timestamptz;

-- Fonctions utilitaires du socle, apparues entre le 30 août et le 3 septembre.
-- Une base qui n'a pas reçu ces mises à jour les reçoit ici, avec le corps
-- exact de multitenant.sql ; une base qui les a déjà les garde telles quelles.
do $$
begin
  -- Profil du compte connecté (migration 20260902).
  if to_regprocedure('public.auth_profile_id()') is null then
    execute $f$
      create function public.auth_profile_id()
        returns text language sql stable security definer set search_path = public as $c$
        select id from public.profiles
        where lower(email) = lower(auth.jwt() ->> 'email')
        limit 1
      $c$ $f$;
  end if;
  -- Forme canonique d'un code partenaire : sans le préfixe historique BESTA-.
  if to_regprocedure('public.code_partenaire(text)') is null then
    execute $f$
      create function public.code_partenaire(p_code text)
        returns text language sql immutable set search_path = public as $c$
        select nullif(regexp_replace(upper(trim(coalesce(p_code, ''))), '^BESTA-', ''), '')
      $c$ $f$;
  end if;
  -- Code de rattachement par défaut : le plus ancien partenaire de
  -- l'organisation interne (BestaSolar).
  if to_regprocedure('public.code_partenaire_defaut()') is null then
    execute $f$
      create function public.code_partenaire_defaut()
        returns text language sql stable security definer set search_path = public as $c$
        select public.code_partenaire(pt.data ->> 'code')
        from public.partners pt
        join public.orgs o on o.id = pt.org_id and o.kind = 'interne'
        where coalesce(pt.data ->> 'code', '') <> ''
        order by pt.updated_at asc, pt.id asc
        limit 1
      $c$ $f$;
  end if;
  -- Propriétaire de l'espace : le gérant, l'admin plateforme, ou l'inscrit
  -- seul dans une organisation sans gérant (même règle que utils/roles.js).
  if to_regprocedure('public.auth_est_proprietaire_espace()') is null then
    execute $f$
      create function public.auth_est_proprietaire_espace()
        returns boolean language sql stable security definer set search_path = public as $c$
        select coalesce((
          select p.role = 'gerant' or p.is_platform_admin
              or not exists (
                select 1 from public.profiles g
                where g.org_id = p.org_id and g.role = 'gerant'
              )
          from public.profiles p
          where lower(p.email) = lower(auth.jwt() ->> 'email')
        ), false)
      $c$ $f$;
  end if;
end $$;

-- Montant lu dans un JSON : jamais d'erreur de conversion, 0 si illisible.
create or replace function public.montant_json(p_texte text)
  returns numeric language sql immutable set search_path = public as $$
  select case when btrim(coalesce(p_texte, '')) ~ '^-?[0-9]+(\.[0-9]+)?$'
              then btrim(p_texte)::numeric else 0 end
$$;

-- 1. RÉGLAGES : taux par niveau --------------------------------------
-- La profondeur est le nombre de niveaux actifs consécutifs depuis 1.
-- Changer un taux ou ajouter un niveau : une ligne ici, rien dans le code.
create table if not exists public.reglages_commissions (
  niveau integer primary key check (niveau between 1 and 10),
  taux numeric(6, 5) not null check (taux >= 0 and taux < 1),
  actif boolean not null default true,
  maj_le timestamptz not null default now()
);
insert into public.reglages_commissions (niveau, taux) values (1, 0.03), (2, 0.015)
  on conflict (niveau) do nothing;
alter table public.reglages_commissions enable row level security;
drop policy if exists "reglages lecture" on public.reglages_commissions;
create policy "reglages lecture" on public.reglages_commissions
  for select to authenticated using (true);
drop policy if exists "reglages admin" on public.reglages_commissions;
create policy "reglages admin" on public.reglages_commissions
  for all to authenticated
  using ((select public.auth_is_platform_admin()))
  with check ((select public.auth_is_platform_admin()));

create or replace function public.taux_commission(p_niveau integer)
  returns numeric language sql stable security definer set search_path = public as $$
  select taux from public.reglages_commissions where niveau = p_niveau and actif
$$;

create or replace function public.profondeur_commissions()
  returns integer language sql stable security definer set search_path = public as $$
  select coalesce(min(g.n) - 1, 10)
  from generate_series(1, 10) g(n)
  where not exists (select 1 from public.reglages_commissions r where r.niveau = g.n and r.actif)
$$;

-- 2. IDENTITÉS : compte ↔ fiche partenaire ↔ code ----------------------
-- Une commission se rattache à une FICHE PARTENAIRE (partnerId) ; une
-- personne est un PROFIL. La fiche d'un compte porte son id dans `userId`
-- (identifiant déterministe p-user-<profil> créé par l'application).
create or replace function public.partenaire_du_profil(p_profil text)
  returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select pt.id from public.partners pt
      where pt.data ->> 'userId' = p_profil
      order by (pt.id = 'p-user-' || p_profil) desc, pt.updated_at asc, pt.id
      limit 1),
    'p-user-' || p_profil)
  where nullif(p_profil, '') is not null
$$;

create or replace function public.profil_du_partenaire(p_partenaire text)
  returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(pt.data ->> 'userId', '') from public.partners pt
      where pt.id = p_partenaire order by pt.updated_at asc limit 1),
    case when p_partenaire like 'p-user-%' then substr(p_partenaire, 8) end)
$$;

-- Fiche partenaire désignée par un code (avec ou sans l'ancien préfixe).
-- Sur une base sans l'index d'unicité des codes (migration 20260830), un
-- même code peut figurer sur plusieurs fiches : celle d'un compte, et un
-- contact saisi à la main avant que la personne ne s'inscrive. Le code
-- désigne la PERSONNE : la fiche reliée à un compte passe donc en premier.
-- Sans cela, le lien partait vers le contact, et ni « Mes filleuls » ni le
-- garde-fou contre les boucles ne reconnaissaient le parrain.
create or replace function public.partenaire_du_code(p_code text)
  returns text language sql stable security definer set search_path = public as $$
  select pt.id from public.partners pt
  where public.code_partenaire(p_code) is not null
    and (upper(btrim(pt.data ->> 'code')) = public.code_partenaire(p_code)
         or public.code_partenaire(pt.data ->> 'code') = public.code_partenaire(p_code))
  order by (coalesce(pt.data ->> 'userId', '') <> '' or pt.id like 'p-user-%') desc,
           pt.updated_at asc, pt.id
  limit 1
$$;

-- Mes fiches partenaires (celles de mon compte) : de quoi reconnaître MES
-- commissions et MES filleuls dans les règles de sécurité.
create or replace function public.auth_mes_partenaires()
  returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct x) filter (where x is not null), '{}')
  from (
    select pt.id as x from public.partners pt
      where pt.data ->> 'userId' = public.auth_profile_id()
    union all
    select 'p-user-' || public.auth_profile_id()
  ) s
$$;

-- 3. PARRAINAGES : une ligne par filleul ------------------------------
-- La SEULE source du lien parrain → filleul. Écrite par le serveur
-- uniquement (inscription, saisie du code, administrateur, rattrapage).
create table if not exists public.parrainages (
  filleul_id text primary key references public.profiles(id) on delete cascade,
  parrain_partner_id text not null,
  parrain_code text not null,
  -- inscription : venu par le lien ou le code ; defaut : inscrit sans code,
  -- rattaché à BestaSolar (corrigeable une fois) ; saisie : code entré après
  -- l'inscription ; admin : correction ; rattrapage : repris des anciennes données.
  source text not null default 'inscription'
    check (source in ('inscription', 'defaut', 'saisie', 'admin', 'rattrapage')),
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);
create index if not exists idx_parrainages_parrain on public.parrainages (parrain_partner_id);

-- Garde-fou contre les boucles : on remonte la chaîne depuis le nouveau
-- parrain ; si l'on retombe sur le filleul, le lien fermerait une boucle
-- (A parraine B qui parraine A) et les commissions tourneraient en rond.
create or replace function public.parrainages_controle()
  returns trigger language plpgsql security definer set search_path = public as $$
declare v_parrain text; v_boucle boolean;
begin
  v_parrain := public.profil_du_partenaire(new.parrain_partner_id);
  if v_parrain is not null and v_parrain = new.filleul_id then
    raise exception 'un compte ne peut pas être son propre parrain';
  end if;
  with recursive chaine(profil, n) as (
    select v_parrain, 1 where v_parrain is not null
    union all
    select public.profil_du_partenaire(p.parrain_partner_id), c.n + 1
    from chaine c join public.parrainages p on p.filleul_id = c.profil
    where c.n < 100 and c.profil <> new.filleul_id
  )
  select exists (select 1 from chaine where profil = new.filleul_id) into v_boucle;
  if v_boucle then
    raise exception 'boucle de parrainage refusée (compte %)', new.filleul_id;
  end if;
  new.maj_le := now();
  return new;
end $$;
drop trigger if exists parrainages_controle on public.parrainages;
create trigger parrainages_controle before insert or update on public.parrainages
  for each row execute function public.parrainages_controle();

alter table public.parrainages enable row level security;
drop policy if exists "parrainages lecture" on public.parrainages;
create policy "parrainages lecture" on public.parrainages for select to authenticated
  using (
    filleul_id = (select public.auth_profile_id())
    or parrain_partner_id = any ((select public.auth_mes_partenaires())::text[])
    or (select public.auth_est_proprietaire_espace())
    or (select public.auth_is_platform_admin())
  );
-- Aucune écriture directe : uniquement par les fonctions ci-dessous.

-- La fiche partenaire d'un compte reflète son parrain réel (« Mon parrain »,
-- arbre du réseau) : le serveur la tient à jour, l'application ne peut pas
-- s'en choisir un autre.
create or replace function public.partners_parrain_serveur()
  returns trigger language plpgsql security definer set search_path = public as $$
declare v_parrain text; v_code text;
begin
  if coalesce(new.data ->> 'userId', '') = '' then return new; end if;
  select p.parrain_partner_id, p.parrain_code into v_parrain, v_code
    from public.parrainages p where p.filleul_id = new.data ->> 'userId';
  if found then
    new.data := new.data || jsonb_build_object('sponsorId', v_parrain, 'sponsorCode', v_code);
  end if;
  return new;
end $$;
drop trigger if exists partners_parrain_serveur on public.partners;
create trigger partners_parrain_serveur before insert or update on public.partners
  for each row execute function public.partners_parrain_serveur();

-- Enregistre (ou complète) le parrain d'un compte. Usage INTERNE.
-- Un rattachement par défaut se remplace une fois par un vrai choix ; un
-- choix réel est définitif, sauf correction par l'administrateur.
create or replace function public.enregistrer_parrainage(p_filleul text, p_code text, p_source text)
  returns boolean language plpgsql security definer set search_path = public as $$
declare v_code text := public.code_partenaire(p_code); v_partenaire text; v_ok boolean;
begin
  if nullif(p_filleul, '') is null or v_code is null then return false; end if;
  v_partenaire := public.partenaire_du_code(v_code);
  if v_partenaire is null then return false; end if;
  if public.profil_du_partenaire(v_partenaire) = p_filleul then return false; end if;
  insert into public.parrainages as pa (filleul_id, parrain_partner_id, parrain_code, source)
  values (p_filleul, v_partenaire, v_code, p_source)
  on conflict (filleul_id) do update
    set parrain_partner_id = excluded.parrain_partner_id,
        parrain_code = excluded.parrain_code,
        source = excluded.source
    where (pa.source = 'defaut' and excluded.source <> 'defaut')
       or excluded.source = 'admin';
  v_ok := found;
  if v_ok then
    -- La fiche partenaire du filleul reprend son parrain (voir le trigger).
    update public.partners set updated_at = now() where data ->> 'userId' = p_filleul;
  end if;
  return v_ok;
end $$;
revoke all on function public.enregistrer_parrainage(text, text, text) from public, anon, authenticated;

-- Saisie du code de son parrain APRÈS l'inscription (venu sans le lien).
create or replace function public.choisir_mon_parrain(p_code text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_moi text := public.auth_profile_id(); v_code text; v_partenaire text;
        v_source text; v_actuel text;
begin
  if v_moi is null then raise exception 'non authentifié'; end if;
  v_code := public.code_partenaire(p_code);
  if v_code is null then raise exception 'code de parrainage vide'; end if;
  v_partenaire := public.partenaire_du_code(v_code);
  if v_partenaire is null then
    raise exception 'code de parrainage inconnu (%) — vérifiez auprès de votre partenaire', v_code;
  end if;
  if public.profil_du_partenaire(v_partenaire) = v_moi then
    raise exception 'ce code est le vôtre — indiquez celui du partenaire qui vous a recommandé';
  end if;
  select source, parrain_code into v_source, v_actuel from public.parrainages where filleul_id = v_moi;
  if found and v_source <> 'defaut' then
    raise exception 'code de parrainage déjà attribué (%) — contactez BestaSolar pour le modifier', v_actuel;
  end if;
  perform public.enregistrer_parrainage(v_moi, v_code, 'saisie');
end $$;

-- Ancien nom, encore appelé par les versions de l'application pas encore
-- mises à jour : il écrivait sur l'organisation commune. Il choisit
-- désormais le parrain de la PERSONNE.
create or replace function public.set_org_referral(p_code text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.choisir_mon_parrain(p_code);
end $$;

-- Correction par l'administrateur plateforme (p_code null : retirer le parrain).
create or replace function public.admin_definir_parrain(p_filleul text, p_code text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  -- Depuis l'application : l'admin plateforme seul. Depuis le SQL Editor
  -- (aucun compte connecté), comme le rattrapage qui la propose : autorisé.
  if coalesce(auth.jwt() ->> 'role', '') in ('authenticated', 'anon') and not public.auth_is_platform_admin() then
    raise exception 'réservé à l''admin plateforme';
  end if;
  if not exists (select 1 from public.profiles where id = p_filleul) then
    raise exception 'compte inconnu : %', p_filleul;
  end if;
  if public.code_partenaire(p_code) is null then
    delete from public.parrainages where filleul_id = p_filleul;
    update public.partners set data = data - 'sponsorId' - 'sponsorCode', updated_at = now()
      where data ->> 'userId' = p_filleul;
    return;
  end if;
  if not public.enregistrer_parrainage(p_filleul, p_code, 'admin') then
    raise exception 'code de parrainage inconnu ou invalide (%)', p_code;
  end if;
end $$;

-- Mon parrain (aucune ligne : tête de réseau).
create or replace function public.mon_parrain()
  returns table (partenaire_id text, code text, nom text, source text, depuis timestamptz)
  language sql stable security definer set search_path = public as $$
  select pa.parrain_partner_id, pa.parrain_code,
         coalesce(pr.name, pt.data ->> 'name'), pa.source, pa.cree_le
  from public.parrainages pa
  left join lateral (select data from public.partners where id = pa.parrain_partner_id
                     order by updated_at asc limit 1) pt on true
  left join public.profiles pr on pr.id = public.profil_du_partenaire(pa.parrain_partner_id)
  where pa.filleul_id = public.auth_profile_id()
$$;

-- Mes filleuls directs : nom, inscription, statut, et les commissions que
-- leurs affaires m'ont rapportées.
create or replace function public.mes_filleuls()
  returns table (filleul_id text, nom text, telephone text, inscrit_le timestamptz,
                 source text, statut text, pro_actif boolean,
                 commissions_generees numeric, commissions_nombre integer)
  language sql stable security definer set search_path = public as $$
  with moi as (select public.auth_mes_partenaires() as ids)
  select pa.filleul_id, pr.name, pr.phone,
         coalesce(au.created_at, pa.cree_le), pa.source,
         coalesce(nullif(pt.data ->> 'status', ''), 'actif'),
         exists (
           select 1 from public.subscriptions s
           where s.data ->> 'userId' = pa.filleul_id and s.data ->> 'status' = 'actif'
             and coalesce(nullif(s.data ->> 'dateFin', ''), '1970-01-01')::timestamptz > now()
         ),
         coalesce(gain.total, 0), coalesce(gain.nombre, 0)::integer
  from public.parrainages pa
  join public.profiles pr on pr.id = pa.filleul_id
  left join auth.users au on au.id::text = pa.filleul_id
  left join lateral (select data from public.partners where data ->> 'userId' = pa.filleul_id
                     order by updated_at asc limit 1) pt on true
  left join lateral (
    select sum(public.montant_json(c.data ->> 'amount')) as total, count(*) as nombre
    from public.commissions c
    where c.data ->> 'vendeurId' = pa.filleul_id
      and c.data ->> 'partnerId' = any ((select ids from moi)::text[])
  ) gain on true
  where pa.parrain_partner_id = any ((select ids from moi)::text[])
  order by 4 desc
$$;

-- 4. CLICS SUR LES LIENS DE PARRAINAGE ---------------------------------
-- Le visiteur est anonyme : l'enregistrement passe par une fonction du
-- serveur, jamais par une écriture directe. Rien d'identifiant n'est gardé :
-- l'adresse IP et l'identifiant du navigateur sont hachés avec un sel secret.
create table if not exists public.clics_parrainage (
  id bigint generated always as identity primary key,
  partenaire_id text not null,
  code text not null,
  cree_le timestamptz not null default now(),
  user_agent text,
  empreinte text not null,   -- sha256(sel | IP | navigateur)
  visiteur text              -- sha256(sel | identifiant du navigateur), si fourni
);
create index if not exists idx_clics_partenaire on public.clics_parrainage (partenaire_id, cree_le desc);
create index if not exists idx_clics_empreinte on public.clics_parrainage (partenaire_id, empreinte, cree_le desc);
alter table public.clics_parrainage enable row level security;
drop policy if exists "clics lecture" on public.clics_parrainage;
create policy "clics lecture" on public.clics_parrainage for select to authenticated
  using (
    partenaire_id = any ((select public.auth_mes_partenaires())::text[])
    or (select public.auth_est_proprietaire_espace())
    or (select public.auth_is_platform_admin())
  );

-- Sel du hachage : tiré au sort une fois, illisible depuis l'application.
create table if not exists public.sel_clics (
  id boolean primary key default true check (id),
  sel text not null
);
insert into public.sel_clics (sel)
  values (encode(sha256(convert_to(gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'hex'))
  on conflict (id) do nothing;
alter table public.sel_clics enable row level security;
revoke all on public.sel_clics from anon, authenticated;

-- Un clic par visiteur et par lien sur 24 h : même empreinte (IP +
-- navigateur) OU même identifiant de navigateur. Usage INTERNE.
create or replace function public.noter_clic_parrainage(p_code text, p_ip text, p_ua text, p_visiteur text)
  returns boolean language plpgsql security definer set search_path = public as $$
declare v_code text := public.code_partenaire(p_code); v_partenaire text; v_sel text;
        v_empreinte text; v_visiteur text;
begin
  if v_code is null or length(v_code) > 40 then return false; end if;
  v_partenaire := public.partenaire_du_code(v_code);
  if v_partenaire is null then return false; end if;
  select sel into v_sel from public.sel_clics;
  v_empreinte := encode(sha256(convert_to(
    coalesce(v_sel, '') || '|' || coalesce(btrim(p_ip), '') || '|' || coalesce(p_ua, ''), 'UTF8')), 'hex');
  if p_visiteur ~ '^[A-Za-z0-9-]{8,64}$' then
    v_visiteur := encode(sha256(convert_to(coalesce(v_sel, '') || '|v|' || p_visiteur, 'UTF8')), 'hex');
  end if;
  -- Deux arrivées simultanées du même visiteur : une seule compte.
  perform pg_advisory_xact_lock(hashtext('clic:' || v_partenaire));
  if exists (
    select 1 from public.clics_parrainage c
    where c.partenaire_id = v_partenaire and c.cree_le > now() - interval '24 hours'
      and (c.empreinte = v_empreinte or (v_visiteur is not null and c.visiteur = v_visiteur))
  ) then
    return false;
  end if;
  insert into public.clics_parrainage (partenaire_id, code, user_agent, empreinte, visiteur)
  values (v_partenaire, v_code, left(p_ua, 300), v_empreinte, v_visiteur);
  return true;
end $$;
revoke all on function public.noter_clic_parrainage(text, text, text, text) from public, anon, authenticated;

-- Appelée par le navigateur du visiteur (anonyme) : l'adresse et le
-- navigateur sont lus dans la requête elle-même, pas fournis par l'appelant.
create or replace function public.compter_clic_parrainage(p_code text, p_visiteur text default null)
  returns boolean language plpgsql security definer set search_path = public as $$
declare v_entetes json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
begin
  return public.noter_clic_parrainage(
    p_code,
    coalesce(nullif(v_entetes ->> 'cf-connecting-ip', ''), nullif(v_entetes ->> 'x-real-ip', ''),
             nullif(split_part(coalesce(v_entetes ->> 'x-forwarded-for', ''), ',', 1), '')),
    v_entetes ->> 'user-agent',
    p_visiteur);
end $$;
grant execute on function public.compter_clic_parrainage(text, text) to anon, authenticated;

-- Variante pour la route serveur /api/clic (page /telecharger) : la route
-- lit elle-même l'adresse du visiteur. Réservée à la clé service_role.
create or replace function public.compter_clic_parrainage_serveur(p_code text, p_ip text, p_ua text, p_visiteur text default null)
  returns boolean language plpgsql security definer set search_path = public as $$
begin
  return public.noter_clic_parrainage(p_code, p_ip, p_ua, p_visiteur);
end $$;
revoke all on function public.compter_clic_parrainage_serveur(text, text, text, text) from public, anon, authenticated;
grant execute on function public.compter_clic_parrainage_serveur(text, text, text, text) to service_role;

-- Tableau de bord du parrain : clics, inscriptions venues du lien, filleuls.
create or replace function public.mes_stats_parrainage()
  returns table (clics bigint, inscriptions bigint, filleuls bigint, taux_conversion numeric)
  language sql stable security definer set search_path = public as $$
  with moi as (select public.auth_mes_partenaires() as ids),
  n as (
    select
      (select count(*) from public.clics_parrainage c where c.partenaire_id = any ((select ids from moi)::text[])) as clics,
      (select count(*) from public.parrainages p where p.parrain_partner_id = any ((select ids from moi)::text[])
         and p.source = 'inscription') as inscriptions,
      (select count(*) from public.parrainages p where p.parrain_partner_id = any ((select ids from moi)::text[])) as filleuls
  )
  select clics, inscriptions, filleuls,
         case when clics > 0 then round(inscriptions::numeric / clics, 4) end
  from n
$$;

-- 5. COMMISSIONS : calculées par le serveur ---------------------------
-- Bénéficiaires d'une affaire : le propriétaire (niveau 1), puis la chaîne
-- de ses parrains, aussi loin que les taux actifs le prévoient. Une même
-- personne ne paraît qu'une fois (garde-fou contre une boucle).
create or replace function public.beneficiaires_commission(p_proprietaire text)
  returns table (niveau integer, partenaire_id text, profil_id text)
  language plpgsql stable security definer set search_path = public as $$
declare
  v_profil text := nullif(p_proprietaire, '');
  v_partenaire text;
  v_vus_partenaires text[] := '{}';
  v_vus_profils text[] := '{}';
  v_niveau integer := 1;
  v_max integer := public.profondeur_commissions();
begin
  if v_profil is null or v_max < 1 then return; end if;
  v_partenaire := public.partenaire_du_profil(v_profil);
  while v_partenaire is not null and v_niveau <= v_max loop
    exit when v_partenaire = any (v_vus_partenaires)
           or (v_profil is not null and v_profil = any (v_vus_profils));
    v_vus_partenaires := v_vus_partenaires || v_partenaire;
    if v_profil is not null then v_vus_profils := v_vus_profils || v_profil; end if;
    niveau := v_niveau; partenaire_id := v_partenaire; profil_id := v_profil;
    return next;
    -- Partenaire sans compte : on ne connaît pas son parrain, la chaîne s'arrête.
    exit when v_profil is null;
    select pa.parrain_partner_id into v_partenaire
      from public.parrainages pa where pa.filleul_id = v_profil;
    exit when not found;
    v_profil := public.profil_du_partenaire(v_partenaire);
    v_niveau := v_niveau + 1;
  end loop;
end $$;

-- Propriétaire d'une affaire = niveau 1 : celui qui a enregistré le client,
-- sinon le commercial assigné, sinon l'auteur du devis. C'est la règle de
-- propriété des clients (auth_owns_client), complétée par le devis.
create or replace function public.proprietaire_affaire(p_lead jsonb, p_devis jsonb)
  returns text language sql immutable set search_path = public as $$
  select coalesce(nullif(p_lead ->> 'registeredByUserId', ''), nullif(p_lead ->> 'assignedTo', ''),
                  nullif(p_lead ->> 'userId', ''), nullif(p_devis ->> 'createdBy', ''))
$$;

-- Une commission est-elle « engagée » dans une demande de retrait en cours ?
-- Une telle commission ne se retire ni ne se réattribue.
create or replace function public.commission_engagee(p_org text, p_id text)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public."payoutRequests" r
    where r.org_id = p_org
      and coalesce(r.data ->> 'status', 'en_attente') = 'en_attente'
      and r.data -> 'commissionIds' ? p_id
  )
$$;

-- Génère les commissions MANQUANTES d'une affaire validée, dans une seule
-- transaction. Idempotent : une ligne par (affaire, niveau), jamais deux.
--   p_devis renseigné : affaire = ce devis gagné ;
--   sinon : affaire = le client (piste) passé à « gagné » sans devis gagné.
-- Renvoie le nombre de commissions créées.
create or replace function public.generer_commissions_affaire(p_org text, p_lead text, p_devis text)
  returns integer language plpgsql security definer set search_path = public as $$
declare
  v_devis jsonb; v_lead jsonb; v_base numeric := 0; v_source text; v_proprio text;
  v_vendeur text; v_jour text := to_char(now() at time zone 'utc', 'YYYY-MM-DD');
  v_b record; v_taux numeric; v_org text; v_cid text; v_nb integer := 0; v_n integer;
  v_drapeau text := current_setting('besta.ecriture_serveur', true);
  v_tombe record; v_code text; v_rid text;
begin
  if p_devis is not null then
    select data into v_devis from public.devis where org_id = p_org and id = p_devis;
    if v_devis is null or v_devis ->> 'stage' is distinct from 'gagne'
       or coalesce(v_devis ->> 'type', '') = 'pro' then
      return 0;
    end if;
    v_source := 'devis';
    v_base := public.montant_json(v_devis ->> 'total');
    p_lead := coalesce(nullif(v_devis ->> 'leadId', ''), p_lead);
  else
    v_source := 'piste';
  end if;
  if p_lead is not null then
    select data into v_lead from public.leads where org_id = p_org and id = p_lead;
  end if;

  if v_source = 'piste' then
    if v_lead is null or v_lead ->> 'stage' is distinct from 'gagne' then return 0; end if;
    -- Un devis gagné de ce client le rémunère déjà, devis par devis.
    if exists (select 1 from public.devis d
               where d.org_id = p_org and d.data ->> 'leadId' = p_lead
                 and d.data ->> 'stage' = 'gagne' and coalesce(d.data ->> 'type', '') <> 'pro') then
      return 0;
    end if;
    -- Base : le dernier devis finalisé du client, sinon sa valeur estimée.
    select public.montant_json(d.data ->> 'total') into v_base
      from public.devis d
      where d.org_id = p_org and d.data ->> 'leadId' = p_lead
        and coalesce(d.data ->> 'type', '') <> 'pro'
        and coalesce(d.data ->> 'statut', '') <> 'brouillon'
        and public.montant_json(d.data ->> 'total') > 0
      order by d.data ->> 'createdAt' desc nulls last limit 1;
    v_base := coalesce(nullif(v_base, 0), public.montant_json(v_lead ->> 'estimatedValue'));
  end if;
  if coalesce(v_base, 0) <= 0 then return 0; end if;

  -- Niveau 1 : le technicien propriétaire du client.
  v_proprio := public.proprietaire_affaire(v_lead, v_devis);
  if v_proprio is null then return 0; end if;
  select name into v_vendeur from public.profiles where id = v_proprio;

  -- Les écritures qui suivent viennent du serveur (voir commissions_garde).
  perform set_config('besta.ecriture_serveur', 'oui', true);

  if v_source = 'devis' and p_lead is not null then
    -- Une commission « niveau client » (sans devis) devient caduque dès qu'un
    -- devis de ce client est gagné : sinon la même vente serait payée deux fois.
    --   déjà payée ou engagée dans un retrait : rattachée à CE devis ;
    --   encore en attente : retirée (le devis génère la sienne).
    update public.commissions c
       set data = c.data || jsonb_build_object('devisId', p_devis), updated_at = now()
     where c.data ->> 'leadId' = p_lead and coalesce(c.data ->> 'devisId', '') = ''
       and coalesce(c.data ->> 'source', '') <> 'abonnement'
       and (c.data ->> 'status' = 'payée' or public.commission_engagee(c.org_id, c.id))
       and not exists (select 1 from public.commissions x
                       where x.data ->> 'devisId' = p_devis and x.data ->> 'level' = c.data ->> 'level');
    for v_tombe in
      delete from public.commissions c
       where c.data ->> 'leadId' = p_lead and coalesce(c.data ->> 'devisId', '') = ''
         and coalesce(c.data ->> 'source', '') <> 'abonnement'
         and coalesce(c.data ->> 'status', '') <> 'payée'
         and not public.commission_engagee(c.org_id, c.id)
      returning c.org_id, c.id
    loop
      insert into public.tombstones (org_id, id, collection)
        values (v_tombe.org_id, v_tombe.id, 'commissions') on conflict do nothing;
    end loop;
  end if;

  for v_b in select * from public.beneficiaires_commission(v_proprio) loop
    v_taux := public.taux_commission(v_b.niveau);
    exit when v_taux is null;
    -- Une seule commission par (affaire, niveau) — y compris celles créées
    -- avant cette migration, par l'application.
    if v_source = 'devis' then
      continue when exists (select 1 from public.commissions c
                            where c.data ->> 'devisId' = p_devis and c.data ->> 'level' = v_b.niveau::text);
    else
      continue when exists (select 1 from public.commissions c
                            where c.data ->> 'leadId' = p_lead and coalesce(c.data ->> 'devisId', '') = ''
                              and coalesce(c.data ->> 'source', '') <> 'abonnement'
                              and c.data ->> 'level' = v_b.niveau::text);
    end if;
    -- La commission vit dans l'organisation de son bénéficiaire : c'est là
    -- que son application la lit.
    v_org := coalesce(
      (select org_id from public.profiles where id = v_b.profil_id),
      (select org_id from public.partners where id = v_b.partenaire_id order by updated_at asc limit 1),
      p_org);
    v_cid := gen_random_uuid()::text;
    insert into public.commissions (org_id, id, data, updated_at)
    values (v_org, v_cid, jsonb_build_object(
      'id', v_cid,
      'partnerId', v_b.partenaire_id,
      'beneficiaireId', v_b.profil_id,
      'leadId', p_lead,
      'devisId', case when v_source = 'devis' then p_devis end,
      'devisNumber', v_devis ->> 'devisNumber',
      'leadName', v_lead ->> 'name',
      'vendeurId', v_proprio,
      'vendeurNom', v_vendeur,
      'level', v_b.niveau,
      'taux', v_taux,
      'base', v_base,
      'amount', round(v_base * v_taux),
      'status', 'en_attente',
      'paidAt', null,
      'createdAt', v_jour,
      'source', v_source
    ), now())
    on conflict do nothing;
    get diagnostics v_n = row_count;
    v_nb := v_nb + v_n;
    -- Trace dans l'historique du parrain : « affaire gagnée par un filleul ».
    if v_n > 0 and v_b.niveau >= 2 then
      select data ->> 'code' into v_code from public.partners
        where id = v_b.partenaire_id order by updated_at asc limit 1;
      if v_code is not null then
        v_rid := gen_random_uuid()::text;
        insert into public.referrals (org_id, id, data, updated_at)
        values (v_org, v_rid, jsonb_build_object(
          'id', v_rid, 'partnerCode', v_code, 'type', 'affaire', 'status', 'validé',
          'amount', round(v_base * v_taux), 'leadId', null,
          'leadName', v_lead ->> 'name', 'filleulName', v_vendeur,
          'affaireOrg', p_org, 'affaireId', coalesce(p_devis, p_lead), 'niveau', v_b.niveau,
          'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        ), now());
      end if;
    end if;
  end loop;

  perform set_config('besta.ecriture_serveur', coalesce(v_drapeau, ''), true);
  return v_nb;
end $$;
revoke all on function public.generer_commissions_affaire(text, text, text) from public, anon, authenticated;

-- Déclencheurs : un devis public qui PASSE à « gagné », un client qui passe à
-- « gagné ». La validation appartient au gérant : un passage à « gagné »
-- écrit par un autre compte (contournement de la demande de validation) ne
-- crée aucune commission.
create or replace function public.validation_par_gerant()
  returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'role', '') not in ('authenticated', 'anon')
      or public.auth_est_proprietaire_espace()
      or public.auth_is_platform_admin()
$$;

-- Le passage à « gagné » lui-même est réservé au gérant : un technicien le
-- DEMANDE (pendingStage), le gérant valide. Écrit directement par un autre
-- compte (contournement de l'application), il est ignoré — l'étape reste
-- celle d'avant. Sans ce verrou, une affaire « gagnée » d'office finirait
-- payée au premier rattrapage. Les devis de l'espace Pro (activité propre de
-- l'abonné, sans commission) n'y sont pas soumis.
create or replace function public.etape_gagnee_par_gerant()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.data ->> 'stage' = 'gagne'
     and (tg_op = 'INSERT' or old.data ->> 'stage' is distinct from 'gagne')
     and coalesce(new.data ->> 'type', '') <> 'pro'
     and not public.validation_par_gerant() then
    new.data := new.data || jsonb_build_object(
      'stage', case when tg_op = 'INSERT' then to_jsonb('nouveau'::text) else coalesce(old.data -> 'stage', to_jsonb('nouveau'::text)) end);
  end if;
  return new;
end $$;
drop trigger if exists devis_etape_gagnee on public.devis;
create trigger devis_etape_gagnee before insert or update on public.devis
  for each row execute function public.etape_gagnee_par_gerant();
drop trigger if exists leads_etape_gagnee on public.leads;
create trigger leads_etape_gagnee before insert or update on public.leads
  for each row execute function public.etape_gagnee_par_gerant();

create or replace function public.devis_commissions_auto()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.data ->> 'stage' = 'gagne' and coalesce(new.data ->> 'type', '') <> 'pro'
     and (tg_op = 'INSERT' or old.data ->> 'stage' is distinct from 'gagne')
     and public.validation_par_gerant() then
    perform public.generer_commissions_affaire(new.org_id, nullif(new.data ->> 'leadId', ''), new.id);
  end if;
  return null;
end $$;
drop trigger if exists devis_commissions_auto on public.devis;
create trigger devis_commissions_auto after insert or update on public.devis
  for each row execute function public.devis_commissions_auto();

create or replace function public.leads_commissions_auto()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.data ->> 'stage' = 'gagne'
     and (tg_op = 'INSERT' or old.data ->> 'stage' is distinct from 'gagne')
     and public.validation_par_gerant() then
    perform public.generer_commissions_affaire(new.org_id, new.id, null);
  end if;
  return null;
end $$;
drop trigger if exists leads_commissions_auto on public.leads;
create trigger leads_commissions_auto after insert or update on public.leads
  for each row execute function public.leads_commissions_auto();

-- Unicité garantie par la base : une commission par (devis, niveau) et par
-- (client, niveau) parmi celles que le serveur calcule. Les commissions
-- antérieures (sans `source`) restent hors de l'index : des doublons hérités
-- y feraient échouer sa création ; le rattrapage les signale.
create unique index if not exists commissions_devis_niveau_unique
  on public.commissions ((data ->> 'devisId'), (data ->> 'level'))
  where data ->> 'source' = 'devis';
create unique index if not exists commissions_piste_niveau_unique
  on public.commissions ((data ->> 'leadId'), (data ->> 'level'))
  where data ->> 'source' = 'piste';
create index if not exists idx_commissions_devis on public.commissions ((data ->> 'devisId'));
create index if not exists idx_commissions_lead on public.commissions ((data ->> 'leadId'));

-- Garde : une commission ne NAÎT plus dans l'application. Une version pas
-- encore mise à jour continue d'en calculer avec l'ancienne règle ; ses
-- créations sont écartées (et signalées comme supprimées, pour que
-- l'appareil les oublie). Seul le gérant peut encore en ajouter à la main,
-- hors devis.
create or replace function public.commissions_garde()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('besta.ecriture_serveur', true) = 'oui' then return new; end if;
  if coalesce(auth.jwt() ->> 'role', '') not in ('authenticated', 'anon') then return new; end if;
  -- Mise à jour d'une commission existante (upsert) : la sécurité décide.
  if exists (select 1 from public.commissions c where c.org_id = new.org_id and c.id = new.id) then
    return new;
  end if;
  if coalesce(new.data ->> 'devisId', '') <> ''
     or not (public.auth_est_proprietaire_espace() or public.auth_is_platform_admin())
     or (coalesce(new.data ->> 'source', '') <> 'manuel'
         and coalesce(new.data ->> 'leadId', '') <> ''
         and exists (select 1 from public.commissions c
                     where c.data ->> 'leadId' = new.data ->> 'leadId'
                       and c.data ->> 'source' in ('devis', 'piste'))) then
    insert into public.tombstones (org_id, id, collection)
      values (new.org_id, new.id, 'commissions') on conflict do nothing;
    return null;
  end if;
  return new;
end $$;
drop trigger if exists commissions_garde on public.commissions;
create trigger commissions_garde before insert on public.commissions
  for each row execute function public.commissions_garde();

-- Sécurité : chacun lit SES commissions ; le gérant lit tout, et lui seul
-- les modifie (paiement) ou en ajoute à la main.
drop policy if exists "org isolation" on public.commissions;
drop policy if exists "commissions lecture" on public.commissions;
drop policy if exists "commissions ajout" on public.commissions;
drop policy if exists "commissions modification" on public.commissions;
drop policy if exists "commissions suppression" on public.commissions;
create policy "commissions lecture" on public.commissions for select to authenticated
  using (
    (select public.auth_is_platform_admin())
    or (org_id = (select public.auth_org_id())
        and ((select public.auth_est_proprietaire_espace())
             or (data ->> 'partnerId') = any ((select public.auth_mes_partenaires())::text[])))
  );
create policy "commissions ajout" on public.commissions for insert to authenticated
  with check ((select public.auth_is_platform_admin())
              or (org_id = (select public.auth_org_id()) and (select public.auth_est_proprietaire_espace())));
create policy "commissions modification" on public.commissions for update to authenticated
  using ((select public.auth_is_platform_admin())
         or (org_id = (select public.auth_org_id()) and (select public.auth_est_proprietaire_espace())))
  with check ((select public.auth_is_platform_admin())
              or (org_id = (select public.auth_org_id()) and (select public.auth_est_proprietaire_espace())));
create policy "commissions suppression" on public.commissions for delete to authenticated
  using ((select public.auth_is_platform_admin())
         or (org_id = (select public.auth_org_id()) and (select public.auth_est_proprietaire_espace())));

-- 6. FONCTIONS EXISTANTES, ALIGNÉES SUR LA NOUVELLE RÈGLE ----------------

-- Validation d'une étape par l'administrateur : les commissions ne sont plus
-- créées ici, mais par les déclencheurs (même règle partout).
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
  -- Les commissions de l'affaire naissent des déclencheurs devis_commissions_auto
  -- et leads_commissions_auto, déclenchés par les mises à jour ci-dessus.
end $$;

-- Confirmation d'un abonnement : la commission va au parrain de la PERSONNE
-- abonnée (et non plus à celui de l'organisation commune).
create or replace function public.admin_confirm_subscription_payment(p_org_id text, p_payment_id text)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_pay jsonb; v_sub_id text; v_montant numeric; v_now timestamptz := now();
  v_base timestamptz; v_ref text; v_partner_org text; v_partner_id text;
  v_cid text; v_iso text; v_fin text; v_abonne text;
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

  -- Commission du parrain de la PERSONNE abonnée (parrainages). Une ancienne
  -- entreprise distincte garde, à défaut, le parrain de l'entreprise ; jamais
  -- l'organisation commune, dont le parrain n'est celui de personne.
  select nullif(s.data ->> 'userId', '') into v_abonne
    from public.subscriptions s where s.org_id = p_org_id and s.id = v_sub_id;
  select pa.parrain_partner_id into v_partner_id
    from public.parrainages pa where pa.filleul_id = v_abonne;
  if v_partner_id is null then
    select o.referred_by into v_ref from public.orgs o where o.id = p_org_id and o.kind <> 'interne';
    if v_ref is not null then v_partner_id := public.partenaire_du_code(v_ref); end if;
  end if;
  if v_partner_id is not null
     and not exists (select 1 from public.commissions c where c.data ->> 'paymentId' = p_payment_id) then
    v_partner_org := coalesce(
      (select org_id from public.profiles where id = public.profil_du_partenaire(v_partner_id)),
      (select org_id from public.partners where id = v_partner_id order by updated_at asc limit 1),
      p_org_id);
    perform set_config('besta.ecriture_serveur', 'oui', true);
    v_cid := gen_random_uuid()::text;
    insert into public.commissions (org_id, id, data, updated_at)
    values (v_partner_org, v_cid, jsonb_build_object(
      'id', v_cid,
      'partnerId', v_partner_id,
      'beneficiaireId', public.profil_du_partenaire(v_partner_id),
      'vendeurId', v_abonne,
      'leadId', null,
      'level', 1,
      'taux', public.referral_commission_rate(),
      'amount', round(v_montant * public.referral_commission_rate()),
      'status', 'en_attente',
      'paidAt', null,
      'createdAt', to_char(v_now at time zone 'utc', 'YYYY-MM-DD'),
      'source', 'abonnement',
      'paymentId', p_payment_id,
      'note', 'Abonnement Devis Pro d''un filleul'
    ), v_now);
  end if;
end $$;

-- Inscription : le parrain est enregistré sur la PERSONNE.
drop function if exists public.signup_create_org(text, text);
drop function if exists public.signup_create_org(text, text, text);
create or replace function public.signup_create_org(
  p_org_name text,
  p_user_name text,
  p_ref_code text default null,
  p_phone text default ''
)
  returns text language plpgsql security definer set search_path = public as $$
declare v_org text; v_email text; v_ref text; v_rid text; v_par_defaut boolean; v_moi text;
begin
  v_email := auth.jwt() ->> 'email';
  if v_email is null then raise exception 'non authentifié'; end if;
  if exists (select 1 from public.profiles where lower(email) = lower(v_email)) then
    raise exception 'profil déjà existant pour cet email';
  end if;
  select id into v_org from public.orgs
   where kind = 'interne' and merged_into is null and plan <> 'suspended'
   order by created_at asc limit 1;
  if v_org is null then raise exception 'organisation Besta introuvable'; end if;
  v_ref := public.code_partenaire(p_ref_code);
  -- Code inconnu (faute de frappe) : rattachement par défaut plutôt qu'un
  -- parrain fantôme.
  if v_ref is not null and public.partenaire_du_code(v_ref) is null then v_ref := null; end if;
  v_par_defaut := v_ref is null;
  if v_par_defaut then v_ref := public.code_partenaire_defaut(); end if;
  v_moi := auth.uid()::text;
  insert into public.profiles (id, email, name, role, org_id, phone)
    values (v_moi, v_email, p_user_name, 'technicien', v_org, coalesce(trim(p_phone), ''));
  if v_ref is not null then
    perform public.enregistrer_parrainage(v_moi, v_ref, case when v_par_defaut then 'defaut' else 'inscription' end);
    -- Historique du parrain (« inscription via mon lien »).
    if not v_par_defaut then
      v_rid := gen_random_uuid()::text;
      insert into public.referrals (org_id, id, data, updated_at)
      select v_org, v_rid, jsonb_build_object(
          'id', v_rid,
          'partnerCode', pt.data ->> 'code',
          'type', 'inscription',
          'status', 'validé',
          'amount', null,
          'leadId', null,
          'filleulId', v_moi,
          'filleulOrg', v_org,
          'filleulName', p_user_name,
          'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        ), now()
      from public.partners pt
      where pt.id = public.partenaire_du_code(v_ref)
      order by pt.updated_at asc
      limit 1;
    end if;
  end if;
  return v_org;
end $$;

-- Fonctions internes : utilisées par les fonctions ci-dessus (qui s'exécutent
-- avec les droits du serveur), jamais appelées directement par l'application.
-- Supabase accorde par défaut l'exécution à tout le monde : on la retire, la
-- chaîne de parrainage d'un compte n'a pas à être lisible par un autre.
-- (auth_mes_partenaires reste ouverte : les règles de sécurité l'appellent.)
revoke all on function public.beneficiaires_commission(text) from public, anon, authenticated;
revoke all on function public.commission_engagee(text, text) from public, anon, authenticated;
revoke all on function public.partenaire_du_profil(text) from public, anon, authenticated;
revoke all on function public.profil_du_partenaire(text) from public, anon, authenticated;
revoke all on function public.partenaire_du_code(text) from public, anon, authenticated;
revoke all on function public.proprietaire_affaire(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.validation_par_gerant() from public, anon, authenticated;
revoke all on function public.taux_commission(integer) from public, anon, authenticated;
revoke all on function public.profondeur_commissions() from public, anon, authenticated;

-- 7. RATTRAPAGE (appelé par supabase/rattrapage-parrainage.sql et par le
--    bouton du gérant) ------------------------------------------------
-- Rapproche les commissions d'UNE affaire validée de la règle : doublons
-- hérités retirés, bénéficiaire corrigé tant que rien n'est payé ni demandé,
-- commissions manquantes créées. Une commission déjà payée ou demandée n'est
-- JAMAIS touchée : elle est signalée pour que le gérant tranche.
-- Usage INTERNE (via rattraper_parrainage_commissions).
create or replace function public.rapprocher_affaire(p_org text, p_lead text, p_devis text)
  returns table (etape text, objet text, detail text)
  language plpgsql security definer set search_path = public as $$
declare
  v_devis jsonb; v_lead jsonb; v_base numeric := 0; v_proprio text; v_vendeur text;
  v_objet text; c record; v_b record; v_taux numeric; v_garde record; v_niveaux integer[] := '{}';
  v_code_actuel text; v_code_attendu text; v_cree integer;
  v_source text := case when p_devis is not null then 'devis' else 'piste' end;
begin
  if p_devis is not null then
    select data into v_devis from public.devis where org_id = p_org and id = p_devis;
    p_lead := coalesce(nullif(v_devis ->> 'leadId', ''), p_lead);
    v_base := public.montant_json(v_devis ->> 'total');
    v_objet := 'devis ' || coalesce(v_devis ->> 'devisNumber', p_devis);
  else
    v_objet := 'client ' || p_lead;
  end if;
  if p_lead is not null then
    select data into v_lead from public.leads where org_id = p_org and id = p_lead;
  end if;
  if p_devis is null then
    select public.montant_json(d.data ->> 'total') into v_base
      from public.devis d
      where d.org_id = p_org and d.data ->> 'leadId' = p_lead
        and coalesce(d.data ->> 'type', '') <> 'pro'
        and coalesce(d.data ->> 'statut', '') <> 'brouillon'
        and public.montant_json(d.data ->> 'total') > 0
      order by d.data ->> 'createdAt' desc nulls last limit 1;
    v_base := coalesce(nullif(v_base, 0), public.montant_json(v_lead ->> 'estimatedValue'));
  end if;
  v_proprio := public.proprietaire_affaire(v_lead, v_devis);
  select name into v_vendeur from public.profiles where id = v_proprio;

  -- Commissions déjà rattachées à cette affaire, par niveau.
  create temporary table if not exists rapprochement_lignes (org_id text, id text, data jsonb, rang integer) on commit drop;
  truncate rapprochement_lignes;
  insert into rapprochement_lignes
  select x.org_id, x.id, x.data,
         row_number() over (
           partition by x.data ->> 'level'
           order by (x.data ->> 'status' = 'payée') desc,
                    public.commission_engagee(x.org_id, x.id) desc,
                    (coalesce(x.data ->> 'source', '') in ('devis', 'piste')) desc,
                    x.updated_at asc, x.id)::integer
  from public.commissions x
  where coalesce(x.data ->> 'source', '') <> 'abonnement'
    and case when p_devis is not null
             then x.data ->> 'devisId' = p_devis
             else x.data ->> 'leadId' = p_lead and coalesce(x.data ->> 'devisId', '') = '' end;

  -- 1. Doublons hérités : une seule commission par niveau.
  for c in select * from rapprochement_lignes where rang > 1 loop
    if c.data ->> 'status' = 'payée' or public.commission_engagee(c.org_id, c.id) then
      etape := 'à vérifier'; objet := v_objet;
      detail := 'niveau ' || (c.data ->> 'level') || ' : plusieurs commissions déjà payées ou demandées (dont ' || c.id || ')';
      return next;
    else
      delete from public.commissions where org_id = c.org_id and id = c.id;
      insert into public.tombstones (org_id, id, collection) values (c.org_id, c.id, 'commissions') on conflict do nothing;
      etape := 'doublon retiré'; objet := v_objet;
      detail := 'niveau ' || (c.data ->> 'level') || ', commission ' || c.id;
      return next;
    end if;
  end loop;

  -- 2. Bénéficiaires attendus, niveau par niveau.
  if v_proprio is not null and v_base > 0 then
    for v_b in select * from public.beneficiaires_commission(v_proprio) loop
      v_taux := public.taux_commission(v_b.niveau);
      exit when v_taux is null;
      v_niveaux := v_niveaux || v_b.niveau;
      select * into c from rapprochement_lignes r where r.rang = 1 and r.data ->> 'level' = v_b.niveau::text;
      continue when not found; -- manquante : créée plus bas
      select data ->> 'code' into v_code_attendu from public.partners where id = v_b.partenaire_id order by updated_at limit 1;
      select data ->> 'code' into v_code_actuel from public.partners where id = c.data ->> 'partnerId' order by updated_at limit 1;
      -- Une autre ligne de ce niveau est-elle déjà comptée par le serveur ? Cas
      -- d'une copie payée ou demandée, gardée à l'étape 1 : la marquer aussi
      -- violerait l'unicité (affaire, niveau) — elle reste alors telle quelle,
      -- déjà signalée « à vérifier ».
      continue when exists (
        select 1 from public.commissions y
        where y.data ->> 'source' = v_source and y.data ->> 'level' = v_b.niveau::text
          -- exactement les clés des deux index d'unicité
          and case when p_devis is not null then y.data ->> 'devisId' = p_devis
                   else y.data ->> 'leadId' = p_lead end
          and not (y.org_id = c.org_id and y.id = c.id));
      if c.data ->> 'partnerId' = v_b.partenaire_id then
        -- Bonne personne : la commission rejoint le calcul du serveur.
        update public.commissions
           set data = data || jsonb_build_object(
                 'source', v_source,
                 'beneficiaireId', v_b.profil_id, 'vendeurId', v_proprio, 'vendeurNom', v_vendeur,
                 'taux', coalesce(data -> 'taux', to_jsonb(v_taux)),
                 'devisNumber', coalesce(data ->> 'devisNumber', v_devis ->> 'devisNumber')),
               updated_at = now()
         where org_id = c.org_id and id = c.id and coalesce(data ->> 'source', '') = '';
      elsif c.data ->> 'status' = 'payée' or public.commission_engagee(c.org_id, c.id) then
        etape := 'à vérifier'; objet := v_objet;
        detail := 'niveau ' || v_b.niveau || ' déjà payé ou demandé par ' || coalesce(v_code_actuel, c.data ->> 'partnerId')
                  || ' ; selon la règle, il revient à ' || coalesce(v_code_attendu, v_b.partenaire_id);
        return next;
      else
        update public.commissions
           set data = data || jsonb_build_object(
                 'partnerId', v_b.partenaire_id, 'beneficiaireId', v_b.profil_id,
                 'vendeurId', v_proprio, 'vendeurNom', v_vendeur,
                 'taux', v_taux, 'base', v_base, 'amount', round(v_base * v_taux),
                 'source', v_source,
                 'devisNumber', coalesce(data ->> 'devisNumber', v_devis ->> 'devisNumber'),
                 'corrigeeLe', to_char(now() at time zone 'utc', 'YYYY-MM-DD')),
               updated_at = now()
         where org_id = c.org_id and id = c.id;
        etape := 'bénéficiaire corrigé'; objet := v_objet;
        detail := 'niveau ' || v_b.niveau || ' : ' || coalesce(v_code_actuel, c.data ->> 'partnerId')
                  || ' → ' || coalesce(v_code_attendu, v_b.partenaire_id);
        return next;
      end if;
    end loop;
  end if;

  -- 3. Niveaux qui n'ont plus lieu d'être (pas de parrain à ce niveau) :
  --    retirés s'ils sont encore en attente, signalés sinon.
  for c in select * from rapprochement_lignes r
           where r.rang = 1 and not ((r.data ->> 'level')::integer = any (v_niveaux)) loop
    if c.data ->> 'status' = 'payée' or public.commission_engagee(c.org_id, c.id) then
      etape := 'à vérifier'; objet := v_objet;
      detail := 'niveau ' || (c.data ->> 'level') || ' payé ou demandé, sans bénéficiaire selon la règle';
      return next;
    else
      delete from public.commissions where org_id = c.org_id and id = c.id;
      insert into public.tombstones (org_id, id, collection) values (c.org_id, c.id, 'commissions') on conflict do nothing;
      etape := 'commission retirée'; objet := v_objet;
      detail := 'niveau ' || (c.data ->> 'level') || ' sans bénéficiaire selon la règle (' || c.id || ')';
      return next;
    end if;
  end loop;

  -- 4. Commissions manquantes.
  v_cree := public.generer_commissions_affaire(p_org, p_lead, p_devis);
  if v_cree > 0 then
    etape := 'commission créée'; objet := v_objet; detail := v_cree || ' niveau(x)';
    return next;
  end if;
end $$;
revoke all on function public.rapprocher_affaire(text, text, text) from public, anon, authenticated;

-- RATTRAPAGE COMPLET : liens parrain → filleul manquants, puis commissions
-- des affaires déjà validées. Idempotent : relancé, il ne trouve plus rien.
--   p_appliquer = false : APERÇU — tout est calculé puis annulé ; le rapport
--                         dit exactement ce que l'application ferait.
--   p_appliquer = true  : application.
create or replace function public.rattraper_parrainage_commissions(p_appliquer boolean default false)
  returns table (etape text, objet text, detail text)
  language plpgsql security definer set search_path = public as $$
declare
  r record; v_interne_ref text; v_ok boolean; v_drapeau text := current_setting('besta.ecriture_serveur', true);
begin
  if coalesce(auth.jwt() ->> 'role', '') in ('authenticated', 'anon') and not public.auth_is_platform_admin() then
    raise exception 'réservé à l''admin plateforme';
  end if;
  begin
    perform set_config('besta.ecriture_serveur', 'oui', true);
    select public.code_partenaire(o.referred_by) into v_interne_ref
      from public.orgs o where o.kind = 'interne' and o.merged_into is null order by o.created_at limit 1;

    -- A. LIENS PARRAIN → FILLEUL, de la preuve la plus forte à la plus faible :
    --    le code utilisé à l'inscription d'abord, la fiche partenaire ensuite.
    -- A1. Une ancienne entreprise distincte, inscrite par un code : chacun de
    --     ses membres a ce parrain.
    for r in
      select pr.id as filleul, public.code_partenaire(o.referred_by) as code
      from public.orgs o
      join public.profiles pr on pr.org_id = o.id
      where o.referred_by is not null and o.kind <> 'interne'
        and not exists (select 1 from public.parrainages pa where pa.filleul_id = pr.id)
    loop
      objet := 'compte ' || r.filleul;
      begin
        v_ok := public.enregistrer_parrainage(r.filleul, r.code, 'rattrapage');
        etape := case when v_ok then 'lien parrain' else 'à vérifier' end;
        detail := 'parrain ' || r.code || case when v_ok then ' (entreprise d''origine)' else ' non appliqué : code inconnu ou le sien' end;
      exception when others then
        etape := 'à vérifier'; detail := 'parrain ' || r.code || ' non appliqué : ' || sqlerrm;
      end;
      return next;
    end loop;

    -- A2. L'inscription notée au registre avec l'identifiant du filleul.
    for r in
      select distinct on (rf.data ->> 'filleulId') rf.data ->> 'filleulId' as filleul,
             public.code_partenaire(rf.data ->> 'partnerCode') as code
      from public.referrals rf
      join public.profiles pr on pr.id = rf.data ->> 'filleulId'
      where rf.data ->> 'type' = 'inscription'
        and not exists (select 1 from public.parrainages pa where pa.filleul_id = rf.data ->> 'filleulId')
      order by rf.data ->> 'filleulId', rf.updated_at
    loop
      objet := 'compte ' || r.filleul;
      begin
        v_ok := public.enregistrer_parrainage(r.filleul, r.code, 'rattrapage');
        etape := case when v_ok then 'lien parrain' else 'à vérifier' end;
        detail := 'parrain ' || r.code || case when v_ok then ' (inscription)' else ' non appliqué : code inconnu ou le sien' end;
      exception when others then
        etape := 'à vérifier'; detail := 'parrain ' || r.code || ' non appliqué : ' || sqlerrm;
      end;
      return next;
    end loop;

    -- A3. Le parrain noté sur la fiche partenaire du compte. En DERNIER :
    --     c'est l'indice le plus faible (l'ancienne application l'écrivait
    --     aussi d'office). Quand il contredit une inscription, le lien
    --     qu'il proposerait fermerait une boucle et il est refusé.
    for r in
      select distinct on (pt.data ->> 'userId') pt.data ->> 'userId' as filleul,
        coalesce(
          (select public.code_partenaire(sp.data ->> 'code') from public.partners sp
            where sp.id = nullif(pt.data ->> 'sponsorId', '') order by sp.updated_at limit 1),
          public.code_partenaire(pt.data ->> 'sponsorCode')) as code
      from public.partners pt
      join public.profiles pr on pr.id = pt.data ->> 'userId'
      where coalesce(nullif(pt.data ->> 'sponsorId', ''), nullif(pt.data ->> 'sponsorCode', '')) is not null
        and not exists (select 1 from public.parrainages pa where pa.filleul_id = pt.data ->> 'userId')
      order by pt.data ->> 'userId', pt.updated_at desc
    loop
      continue when r.code is null;
      objet := 'compte ' || r.filleul;
      if v_interne_ref is not null and r.code = v_interne_ref then
        -- L'ancienne application recopiait le parrain de l'ORGANISATION commune
        -- sur chaque nouvelle fiche : ce parrain-là n'est pas une preuve.
        etape := 'à vérifier';
        detail := 'parrain ' || r.code || ' : c''est aussi celui de l''organisation commune, peut-être recopié par erreur — non appliqué';
        return next; continue;
      end if;
      begin
        v_ok := public.enregistrer_parrainage(r.filleul, r.code, 'rattrapage');
        etape := case when v_ok then 'lien parrain' else 'à vérifier' end;
        detail := 'parrain ' || r.code || case when v_ok then ' (fiche partenaire)' else ' non appliqué : code inconnu ou le sien' end;
      exception when others then
        etape := 'à vérifier'; detail := 'parrain ' || r.code || ' non appliqué : ' || sqlerrm;
      end;
      return next;
    end loop;

    -- A4. Inscriptions anciennes, notées par le seul NOM du filleul : rien
    --     n'est deviné, elles sont listées pour une décision à la main
    --     (admin_definir_parrain).
    for r in
      select rf.data ->> 'filleulName' as nom, public.code_partenaire(rf.data ->> 'partnerCode') as code,
             (select string_agg(p.id, ', ') from public.profiles p
               where lower(btrim(p.name)) = lower(btrim(rf.data ->> 'filleulName'))
                 and not exists (select 1 from public.parrainages pa where pa.filleul_id = p.id)) as candidats
      from public.referrals rf
      where rf.data ->> 'type' = 'inscription' and coalesce(rf.data ->> 'filleulId', '') = ''
    loop
      continue when r.candidats is null;
      etape := 'à vérifier'; objet := 'inscription « ' || coalesce(r.nom, '?') || ' »';
      detail := 'parrain ' || coalesce(r.code, '?') || ' — compte(s) possible(s) : ' || r.candidats
                || ' → select admin_definir_parrain(''<compte>'', ''' || coalesce(r.code, '') || ''');';
      return next;
    end loop;

    -- B. COMMISSIONS DES AFFAIRES DÉJÀ VALIDÉES
    -- Chaque affaire UNE fois. Sur une base antérieure à la réunion des
    -- organisations, un compte passé d'une entreprise à l'autre y a recopié
    -- ses données : le même devis (même identifiant) existe alors dans deux
    -- organisations. Ses commissions sont rapprochées en une passe, d'après
    -- la copie la plus récente.
    for r in
      select u.org_id, u.id from (
        select distinct on (d.id) d.org_id, d.id, d.updated_at from public.devis d
        where d.data ->> 'stage' = 'gagne' and coalesce(d.data ->> 'type', '') <> 'pro'
        order by d.id, d.updated_at desc
      ) u order by u.updated_at
    loop
      return query select * from public.rapprocher_affaire(r.org_id, null, r.id);
    end loop;
    for r in
      select u.org_id, u.id from (
        select distinct on (l.id) l.org_id, l.id, l.updated_at from public.leads l
        where l.data ->> 'stage' = 'gagne'
          and not exists (select 1 from public.devis d
                          where d.data ->> 'leadId' = l.id
                            and d.data ->> 'stage' = 'gagne' and coalesce(d.data ->> 'type', '') <> 'pro')
        order by l.id, l.updated_at desc
      ) u order by u.updated_at
    loop
      return query select * from public.rapprocher_affaire(r.org_id, r.id, null);
    end loop;

    if not p_appliquer then
      raise exception using errcode = 'P0001', message = 'apercu_seulement';
    end if;
    perform set_config('besta.ecriture_serveur', coalesce(v_drapeau, ''), true);
  exception when sqlstate 'P0001' then
    -- Aperçu : toutes les modifications ci-dessus sont annulées, le rapport reste.
    if sqlerrm <> 'apercu_seulement' then raise; end if;
  end;
end $$;
revoke all on function public.rattraper_parrainage_commissions(boolean) from public, anon;
grant execute on function public.rattraper_parrainage_commissions(boolean) to authenticated;

commit;

-- Contrôle : chaque ligne doit afficher « ✅ ».
select '✅ table parrainages' as controle where to_regclass('public.parrainages') is not null
union all select '✅ réglages : ' || string_agg('N' || niveau || ' = ' || (taux * 100)::numeric(5,2) || ' %', ', ' order by niveau)
  from public.reglages_commissions where actif
union all select '✅ commissions calculées par le serveur'
  where exists (select 1 from pg_trigger where tgname = 'devis_commissions_auto')
union all select '✅ clics de parrainage comptés'
  where to_regprocedure('public.compter_clic_parrainage(text,text)') is not null;
