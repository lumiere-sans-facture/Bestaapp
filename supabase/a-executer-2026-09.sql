-- =====================================================================
--  SCRIPTS À EXÉCUTER — septembre 2026
--  Réunit les deux scripts livrés depuis la dernière mise à jour de la
--  base : codes d'essai Devis Pro, puis suppression de compte.
--
--  OÙ : Supabase › SQL Editor › New query › coller TOUT ce fichier › Run.
--  DANS LES DEUX PROJETS : test (recette) ET production.
--  Ré-exécutable sans danger : rien n'est effacé, rien n'est dupliqué.
--  Prérequis : multitenant.sql déjà passé (c'est le cas si l'app tourne).
--
--  Le tableau affiché à la fin doit montrer 4 lignes « ✅ ».
-- =====================================================================

-- Le reste de multitenant.sql ne se recopie pas ici (organisations,
-- entreprise interne…) : s'il manque, on s'arrête AVANT de toucher à quoi
-- que ce soit, avec la liste de ce qui manque.
do $$
declare v_manque text := '';
begin
  if to_regprocedure('public.auth_org_id()') is null then v_manque := v_manque || ' fonction auth_org_id ;'; end if;
  if to_regclass('public.orgs') is null then v_manque := v_manque || ' table orgs ;';
  elsif not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orgs' and column_name = 'kind')
    then v_manque := v_manque || ' colonne orgs.kind ;'; end if;
  if to_regprocedure('public.org_est_interne(text)') is null then v_manque := v_manque || ' fonction org_est_interne ;'; end if;
  if v_manque <> '' then
    raise exception 'Base en retard sur multitenant.sql — il manque :% Exécutez d''abord la version actuelle de supabase/multitenant.sql, puis relancez ce fichier. Rien n''a été modifié.', v_manque;
  end if;
end $$;

-- 0. PRÉREQUIS — repris À L'IDENTIQUE de multitenant.sql, pour les bases
--    qui en ont reçu une version antérieure (« column is_platform_admin does
--    not exist »). La colonne vaut FALSE par défaut : personne ne devient
--    admin plateforme par ce biais.
alter table public.profiles add column if not exists is_platform_admin boolean not null default false;

create or replace function public.auth_is_platform_admin()
  returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_platform_admin from public.profiles where lower(email) = lower(auth.jwt() ->> 'email')),
    false
  )
$$;

-- #####################################################################
-- 1/2 — supabase/codes-promo.sql
-- #####################################################################
-- =====================================================================
--  Codes d'essai Devis Pro — 30 jours d'espace Pro sans paiement
--  À exécuter dans SQL Editor APRÈS multitenant.sql, dans les DEUX projets
--  Supabase (test et production). Idempotent : ré-exécutable sans danger.
-- =====================================================================
--
-- POURQUOI CÔTÉ SERVEUR : la RLS interdit à un membre d'écrire un abonnement
-- « actif » (multitenant.sql, policies « subs insert / update »). C'est ce
-- qui empêche de s'offrir le Pro depuis la console du navigateur. Un code
-- vérifié par l'app ne prouverait donc rien : c'est la fonction
-- utiliser_code_promo() ci-dessous, SECURITY DEFINER, qui juge le code et
-- écrit l'abonnement. Même logique que src/utils/codePromo.js (mode local).
--
-- Les tables n'ont AUCUNE policy : ni lisibles ni modifiables depuis l'app.
-- La liste des codes ne doit pas pouvoir être aspirée.

-- 1. Les codes.
create table if not exists public.codes_promo (
  code              text primary key,          -- forme canonique : MAJUSCULES, sans espace
  jours             integer not null default 30 check (jours between 1 and 366),
  actif             boolean not null default true,
  max_utilisations  integer check (max_utilisations is null or max_utilisations > 0),
  expire_le         timestamptz,
  note              text not null default '',
  cree_par          text,
  created_at        timestamptz not null default now()
);

-- 2. Qui a utilisé quoi. Clé (code, user_id) : un compte n'utilise un même
--    code qu'une fois — garanti par PostgreSQL, pas par une lecture préalable.
create table if not exists public.codes_promo_utilisations (
  code        text not null references public.codes_promo (code) on delete cascade,
  user_id     text not null,
  org_id      text,
  utilise_le  timestamptz not null default now(),
  primary key (code, user_id)
);

-- 3. Essais infructueux : freine qui tenterait de deviner un code au hasard.
create table if not exists public.codes_promo_echecs (
  user_id  text not null,
  le       timestamptz not null default now()
);
create index if not exists idx_codes_promo_echecs on public.codes_promo_echecs (user_id, le desc);

alter table public.codes_promo enable row level security;
alter table public.codes_promo_utilisations enable row level security;
alter table public.codes_promo_echecs enable row level security;
revoke all on public.codes_promo, public.codes_promo_utilisations, public.codes_promo_echecs
  from anon, authenticated;

-- 4. Utiliser un code (tout membre connecté).
--    Ne lève PAS d'exception sur un refus : elle annulerait la trace de
--    l'échec, et le frein ci-dessus ne compterait jamais rien.
create or replace function public.utiliser_code_promo(p_code text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_code    text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_profil  record;
  v_ligne   public.codes_promo%rowtype;
  v_nb      integer;
  v_now     timestamptz := now();
  v_sub_id  text;
  v_data    jsonb;
  v_base    timestamptz;
  v_fin     text;
  v_iso     text := to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_payant  boolean;
begin
  select id, org_id into v_profil from public.profiles
    where lower(email) = lower(auth.jwt() ->> 'email');
  if v_profil.id is null then
    return jsonb_build_object('ok', false, 'raison', 'profil');
  end if;

  -- Frein : dix échecs dans l'heure, et c'est fini pour l'heure.
  select count(*) into v_nb from public.codes_promo_echecs
    where user_id = v_profil.id and le > v_now - interval '1 hour';
  if v_nb >= 10 then
    return jsonb_build_object('ok', false, 'raison', 'trop');
  end if;

  if v_code !~ '^[A-Z0-9-]{4,32}$' then
    insert into public.codes_promo_echecs (user_id) values (v_profil.id);
    return jsonb_build_object('ok', false, 'raison', 'format');
  end if;

  -- Verrou sur la ligne : deux utilisations simultanées ne peuvent pas
  -- dépasser ensemble le nombre maximal.
  select * into v_ligne from public.codes_promo where code = v_code for update;
  if not found then
    insert into public.codes_promo_echecs (user_id) values (v_profil.id);
    return jsonb_build_object('ok', false, 'raison', 'inconnu');
  end if;
  if not v_ligne.actif then
    return jsonb_build_object('ok', false, 'raison', 'desactive');
  end if;
  if v_ligne.expire_le is not null and v_ligne.expire_le < v_now then
    return jsonb_build_object('ok', false, 'raison', 'expire');
  end if;
  if exists (select 1 from public.codes_promo_utilisations
             where code = v_code and user_id = v_profil.id) then
    return jsonb_build_object('ok', false, 'raison', 'deja');
  end if;
  if v_ligne.max_utilisations is not null and
     (select count(*) from public.codes_promo_utilisations where code = v_code) >= v_ligne.max_utilisations then
    return jsonb_build_object('ok', false, 'raison', 'epuise');
  end if;

  insert into public.codes_promo_utilisations (code, user_id, org_id)
    values (v_code, v_profil.id, v_profil.org_id);

  -- Abonnement : prolongé depuis sa fin s'il court encore, sinon depuis
  -- maintenant. Un abonné PAYANT garde sa formule (voir codePromo.js).
  v_sub_id := 'sub-' || v_profil.id;
  select data into v_data from public.subscriptions
    where org_id = v_profil.org_id and id = v_sub_id;
  v_base := greatest(v_now, coalesce(nullif(v_data ->> 'dateFin', '')::timestamptz, v_now));
  v_fin := to_char((v_base + make_interval(days => v_ligne.jours)) at time zone 'utc',
                   'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_payant := coalesce(v_data ->> 'status', '') = 'actif'
              and coalesce(nullif(v_data ->> 'dateFin', '')::timestamptz, v_now) > v_now
              and coalesce(v_data ->> 'formule', '') not in ('', 'essai');

  v_data := jsonb_build_object('type', 'devis_pro', 'lastPaymentAt', null)
    || coalesce(v_data, '{}'::jsonb)
    || jsonb_build_object(
         'id', v_sub_id, 'userId', v_profil.id, 'status', 'actif',
         'dateDebut', coalesce(nullif(v_data ->> 'dateDebut', ''), v_iso),
         'dateFin', v_fin, 'codePromo', v_code)
    || case when v_payant then '{}'::jsonb
            else jsonb_build_object('formule', 'essai', 'recurrence', 'essai', 'montant', 0) end;

  insert into public.subscriptions (org_id, id, data, updated_at)
    values (v_profil.org_id, v_sub_id, v_data, v_now)
  on conflict (org_id, id) do update set data = excluded.data, updated_at = excluded.updated_at;

  return jsonb_build_object('ok', true, 'dateFin', v_fin, 'jours', v_ligne.jours,
                            'formule', v_data ->> 'formule');
end $$;

revoke all on function public.utiliser_code_promo(text) from public, anon;
grant execute on function public.utiliser_code_promo(text) to authenticated;

-- 5. Administration — réservée à l'admin plateforme (l'éditeur de l'app).
create or replace function public.admin_codes_promo()
  returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.auth_is_platform_admin() then
    raise exception 'réservé à l''admin plateforme';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', c.code, 'jours', c.jours, 'actif', c.actif,
      'maxUtilisations', c.max_utilisations, 'expireLe', c.expire_le,
      'note', c.note, 'creeLe', c.created_at,
      'nbUtilisations', (select count(*) from public.codes_promo_utilisations u where u.code = c.code)
    ) order by c.created_at desc)
    from public.codes_promo c
  ), '[]'::jsonb);
end $$;

create or replace function public.admin_creer_code_promo(
  p_code text, p_jours integer default 30, p_max integer default null,
  p_expire_le timestamptz default null, p_note text default '')
  returns void language plpgsql security definer set search_path = public as $$
declare v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
begin
  if not public.auth_is_platform_admin() then
    raise exception 'réservé à l''admin plateforme';
  end if;
  if v_code !~ '^[A-Z0-9-]{4,32}$' then
    raise exception 'format de code invalide';
  end if;
  insert into public.codes_promo (code, jours, max_utilisations, expire_le, note, cree_par)
    values (v_code, coalesce(p_jours, 30), p_max, p_expire_le, coalesce(p_note, ''),
            auth.jwt() ->> 'email');
exception when unique_violation then
  raise exception 'ce code existe déjà';
end $$;

create or replace function public.admin_basculer_code_promo(p_code text, p_actif boolean)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.auth_is_platform_admin() then
    raise exception 'réservé à l''admin plateforme';
  end if;
  update public.codes_promo set actif = p_actif where code = upper(p_code);
  if not found then raise exception 'code introuvable'; end if;
end $$;

revoke all on function public.admin_codes_promo() from public, anon;
revoke all on function public.admin_creer_code_promo(text, integer, integer, timestamptz, text) from public, anon;
revoke all on function public.admin_basculer_code_promo(text, boolean) from public, anon;
grant execute on function public.admin_codes_promo() to authenticated;
grant execute on function public.admin_creer_code_promo(text, integer, integer, timestamptz, text) to authenticated;
grant execute on function public.admin_basculer_code_promo(text, boolean) to authenticated;

-- #####################################################################
-- 2/2 — supabase/suppression-compte.sql
-- #####################################################################
-- =====================================================================
--  Suppression de compte par l'utilisateur lui-même
--  Exigée par Google Play et par l'App Store : un compte créé dans l'app
--  doit pouvoir y être supprimé, avec ses données.
--  À exécuter dans SQL Editor APRÈS multitenant.sql, dans les DEUX projets
--  Supabase (test et production). Idempotent : ré-exécutable sans danger.
-- =====================================================================
--
-- Deux cas, selon que le compte travaille seul ou en équipe :
--
--  • SEUL dans son entreprise : l'entreprise disparaît avec lui — clients,
--    devis, factures, kits, abonnement… toutes les tables portant un org_id,
--    y compris celles créées après ce script (elles sont trouvées dans le
--    catalogue de la base, pas dans une liste figée).
--
--  • EN ÉQUIPE : les données de travail appartiennent à l'ENTREPRISE (c'est
--    elle le responsable du traitement) et restent à l'équipe. Seuls partent
--    le compte, son profil et ce qui n'est qu'à lui : son abonnement Pro,
--    ses paiements d'abonnement, l'identité de son entreprise Pro.
--
-- Ce qui est CONSERVÉ, volontairement :
--  • paiements_verifies — journal comptable des paiements encaissés
--    (obligation légale de conservation) ;
--  • codes_promo_utilisations — sinon supprimer puis recréer son compte
--    offrirait un nouvel essai gratuit à l'infini.
--
-- Refus : l'admin plateforme (il administre les autres) ; le gérant d'une
-- équipe (l'équipe perdrait son gérant — le transférer d'abord) ; le dernier
-- membre de l'organisation INTERNE BestaSolar (son catalogue est partagé
-- avec toutes les entreprises).

create or replace function public.supprimer_mon_compte()
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email   text := lower(auth.jwt() ->> 'email');
  v_profil  record;
  v_membres integer;
  v_table   text;
begin
  if coalesce(v_email, '') = '' then
    return jsonb_build_object('ok', false, 'raison', 'session');
  end if;
  select id, org_id, role, coalesce(is_platform_admin, false) as admin
    into v_profil from public.profiles where lower(email) = v_email;

  -- Sans profil (inscription jamais terminée) : seul le compte d'accès existe.
  if v_profil.id is null then
    delete from auth.users where lower(email) = v_email;
    return jsonb_build_object('ok', true, 'portee', 'compte');
  end if;

  if v_profil.admin then
    return jsonb_build_object('ok', false, 'raison', 'admin');
  end if;

  select count(*) into v_membres from public.profiles
    where org_id = v_profil.org_id and id <> v_profil.id;

  if v_membres > 0 and v_profil.role = 'gerant' then
    return jsonb_build_object('ok', false, 'raison', 'gerant');
  end if;

  if v_membres = 0 then
    if public.org_est_interne(v_profil.org_id) then
      return jsonb_build_object('ok', false, 'raison', 'interne');
    end if;
    -- Toutes les tables de données de l'entreprise, sauf les journaux
    -- conservés (voir en tête) et les deux tables d'identité, traitées après.
    for v_table in
      select c.table_name from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public' and c.column_name = 'org_id'
        and t.table_type = 'BASE TABLE'
        and c.table_name not in ('profiles', 'orgs', 'paiements_verifies', 'codes_promo_utilisations')
    loop
      execute format('delete from public.%I where org_id = $1', v_table) using v_profil.org_id;
    end loop;
    delete from public.profiles where id = v_profil.id;
    update public.orgs set merged_into = null where merged_into = v_profil.org_id;
    delete from public.orgs where id = v_profil.org_id;
    delete from auth.users where lower(email) = v_email;
    return jsonb_build_object('ok', true, 'portee', 'entreprise');
  end if;

  -- En équipe : uniquement ce qui est personnel.
  delete from public.subscriptions
    where org_id = v_profil.org_id and data ->> 'userId' = v_profil.id;
  delete from public."subscriptionPayments"
    where org_id = v_profil.org_id and data ->> 'userId' = v_profil.id;
  delete from public.companies
    where org_id = v_profil.org_id and data ->> 'userId' = v_profil.id;
  delete from public.profiles where id = v_profil.id;
  delete from auth.users where lower(email) = v_email;
  return jsonb_build_object('ok', true, 'portee', 'compte');
end $$;

revoke all on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;

-- #####################################################################
-- Contrôle : tout doit être « ✅ ».
-- #####################################################################
select element as "élément",
       case when present then '✅ en place' else '❌ MANQUANT' end as "état"
from (values
  ('table codes_promo',                   to_regclass('public.codes_promo') is not null),
  ('fonction utiliser_code_promo',        to_regprocedure('public.utiliser_code_promo(text)') is not null),
  ('fonction admin_creer_code_promo',     to_regprocedure('public.admin_creer_code_promo(text, integer, integer, timestamptz, text)') is not null),
  ('fonction supprimer_mon_compte',       to_regprocedure('public.supprimer_mon_compte()') is not null)
) as t(element, present);
