-- Une organisation Besta unique, avec confidentialité des clients par partenaire.
-- La migration est atomique : au moindre contrôle échoué, aucune donnée ne bouge.
begin;

alter table public.orgs add column if not exists merged_into text references public.orgs(id);
alter table public.orgs add column if not exists merged_at timestamptz;

create or replace function public.auth_profile_id()
  returns text language sql stable security definer set search_path = public as $$
  select id from public.profiles
  where lower(email) = lower(auth.jwt() ->> 'email')
  limit 1
$$;

create or replace function public.auth_owns_client(p_data jsonb)
  returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(p_data ->> 'registeredByUserId', ''),
    nullif(p_data ->> 'assignedTo', ''),
    nullif(p_data ->> 'userId', '')
  ) = public.auth_profile_id()
$$;

do $$
declare
  v_primary_org text;
  v_manager_id text;
  v_admin_count integer;
  v_table text;
begin
  select count(*) into v_admin_count
  from public.profiles
  where is_platform_admin is true;

  if v_admin_count <> 1 then
    raise exception 'La fusion exige exactement un gérant plateforme, trouvé : %', v_admin_count;
  end if;

  select org_id, id into v_primary_org, v_manager_id
  from public.profiles
  where is_platform_admin is true
  limit 1;

  if v_primary_org is null or v_manager_id is null then
    raise exception 'Organisation principale introuvable';
  end if;

  if not exists (
    select 1 from public.google_contacts_configs
    where org_id = v_primary_org and sync_enabled is true
  ) then
    raise exception 'Le compte Google Contacts central doit être configuré avant la fusion';
  end if;

  update public.leads
  set data = jsonb_set(
    coalesce(data, '{}'::jsonb),
    '{registeredByUserId}',
    to_jsonb(v_manager_id),
    true
  )
  where coalesce(
    nullif(data ->> 'registeredByUserId', ''),
    nullif(data ->> 'assignedTo', ''),
    nullif(data ->> 'userId', '')
  ) is null;

  update public."proClients"
  set data = jsonb_set(
    coalesce(data, '{}'::jsonb),
    '{registeredByUserId}',
    to_jsonb(v_manager_id),
    true
  )
  where coalesce(
    nullif(data ->> 'registeredByUserId', ''),
    nullif(data ->> 'assignedTo', ''),
    nullif(data ->> 'userId', '')
  ) is null;

  -- Les catalogues partagés et les jobs peuvent exister dans plusieurs
  -- organisations avec le même identifiant. Une seule version est conservée :
  -- celle de l'organisation principale à égalité, sinon la plus récente.
  delete from public.inverters
  where ctid in (
    select ctid from (
      select ctid, row_number() over (
        partition by id
        order by (org_id = v_primary_org) desc, updated_at desc nulls last, ctid
      ) as rn
      from public.inverters
    ) ranked where rn > 1
  );

  delete from public."pompeKits"
  where ctid in (
    select ctid from (
      select ctid, row_number() over (
        partition by id
        order by (org_id = v_primary_org) desc, updated_at desc nulls last, ctid
      ) as rn
      from public."pompeKits"
    ) ranked where rn > 1
  );

  -- Pour un même contact, un job en attente/échec est prioritaire afin que
  -- sa dernière modification soit bien envoyée après la fusion.
  delete from public.google_contact_sync_jobs
  where ctid in (
    select ctid from (
      select ctid, row_number() over (
        partition by contact_type, partner_id
        order by
          case status when 'pending' then 0 when 'failed' then 1 when 'synced' then 2 else 3 end,
          (org_id = v_primary_org) desc,
          updated_at desc nulls last,
          ctid
      ) as rn
      from public.google_contact_sync_jobs
    ) ranked where rn > 1
  );

  foreach v_table in array array[
    'commissions', 'companies', 'devis', 'erreurs', 'factures',
    'formationProgress', 'formations', 'google_contact_sync_jobs',
    'inverters', 'kits', 'leads', 'orders', 'paiementConfigs',
    'paiements_verifies', 'partners', 'payoutRequests', 'pompeKits',
    'proClients', 'products', 'referrals', 'subscriptionPayments',
    'subscriptions', 'tombstones'
  ] loop
    execute format(
      'update public.%I set org_id = $1 where org_id is distinct from $1',
      v_table
    ) using v_primary_org;
  end loop;

  update public.profiles
  set org_id = v_primary_org
  where org_id is distinct from v_primary_org;

  update public.google_contacts_configs
  set sync_enabled = false, updated_at = now()
  where org_id <> v_primary_org;

  delete from public.google_contact_sync_locks;
  delete from public.google_contacts_oauth_states where org_id <> v_primary_org;

  update public.orgs
  set kind = 'pro',
      plan = 'suspended',
      merged_into = v_primary_org,
      merged_at = coalesce(merged_at, now())
  where id <> v_primary_org;

  update public.orgs
  set kind = 'interne',
      plan = 'active',
      merged_into = null,
      merged_at = null
  where id = v_primary_org;
end $$;

alter table public.leads enable row level security;
alter table public."proClients" enable row level security;

drop policy if exists "org isolation" on public.leads;
drop policy if exists "manager client access" on public.leads;
drop policy if exists "client owner access" on public.leads;
create policy "manager client access" on public.leads
  for all to authenticated
  using (public.auth_is_platform_admin())
  with check (public.auth_is_platform_admin());
create policy "client owner access" on public.leads
  for all to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_owns_client(data)
  )
  with check (
    org_id = public.auth_org_id()
    and public.auth_owns_client(data)
  );

drop policy if exists "org isolation" on public."proClients";
drop policy if exists "manager client access" on public."proClients";
drop policy if exists "client owner access" on public."proClients";
create policy "manager client access" on public."proClients"
  for all to authenticated
  using (public.auth_is_platform_admin())
  with check (public.auth_is_platform_admin());
create policy "client owner access" on public."proClients"
  for all to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_owns_client(data)
  )
  with check (
    org_id = public.auth_org_id()
    and public.auth_owns_client(data)
  );

drop function if exists public.signup_create_org(text, text);
drop function if exists public.signup_create_org(text, text, text);
drop function if exists public.signup_create_org(text, text, text, text);
create or replace function public.signup_create_org(
  p_org_name text,
  p_user_name text,
  p_ref_code text default null,
  p_phone text default ''
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_org text;
  v_email text;
  v_ref text;
  v_referral_id text;
  v_default_referral boolean;
begin
  v_email := auth.jwt() ->> 'email';
  if v_email is null then raise exception 'non authentifié'; end if;
  if exists (select 1 from public.profiles where lower(email) = lower(v_email)) then
    raise exception 'profil déjà existant pour cet email';
  end if;

  select id into v_org
  from public.orgs
  where kind = 'interne' and merged_into is null and plan <> 'suspended'
  order by created_at asc
  limit 1;
  if v_org is null then raise exception 'organisation Besta introuvable'; end if;

  v_ref := public.code_partenaire(p_ref_code);
  v_default_referral := v_ref is null;
  if v_default_referral then v_ref := public.code_partenaire_defaut(); end if;

  insert into public.profiles (id, email, name, role, org_id, phone)
  values (auth.uid()::text, v_email, p_user_name, 'technicien', v_org, coalesce(trim(p_phone), ''));

  if v_ref is not null then
    v_referral_id := gen_random_uuid()::text;
    insert into public.referrals (org_id, id, data, updated_at)
    select v_org, v_referral_id, jsonb_build_object(
      'id', v_referral_id,
      'partnerCode', pt.data ->> 'code',
      'type', 'inscription',
      'status', 'validé',
      'amount', null,
      'leadId', null,
      'filleulOrg', v_org,
      'filleulName', p_user_name,
      'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ), now()
    from public.partners pt
    where pt.org_id = v_org
      and public.code_partenaire(pt.data ->> 'code') = v_ref
    order by pt.updated_at asc
    limit 1;
  end if;

  return v_org;
end $$;

drop function if exists public.signup_join_org(text, text);
drop function if exists public.signup_join_org(text, text, text);
create or replace function public.signup_join_org(
  p_invite_code text,
  p_user_name text,
  p_phone text default ''
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_org text;
  v_email text;
begin
  v_email := auth.jwt() ->> 'email';
  if v_email is null then raise exception 'non authentifié'; end if;
  if exists (select 1 from public.profiles where lower(email) = lower(v_email)) then
    raise exception 'profil déjà existant pour cet email';
  end if;

  select id into v_org
  from public.orgs
  where kind = 'interne' and merged_into is null and plan <> 'suspended'
  order by created_at asc
  limit 1;
  if v_org is null then raise exception 'organisation Besta introuvable'; end if;

  insert into public.profiles (id, email, name, role, org_id, phone)
  values (auth.uid()::text, v_email, p_user_name, 'technicien', v_org, coalesce(trim(p_phone), ''));

  return v_org;
end $$;

commit;
