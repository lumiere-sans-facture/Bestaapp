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
