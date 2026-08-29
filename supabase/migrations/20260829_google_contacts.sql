-- Google Contacts : configuration OAuth privée, file de synchronisation et
-- verrou par numéro normalisé. À exécuter APRÈS multitenant.sql.
-- Les secrets OAuth ne sont jamais lisibles par le navigateur : RLS sans policy
-- et fonctions réservées au service_role / aux Edge Functions.

create table if not exists public.google_contacts_configs (
  org_id text primary key,
  google_account_email text,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  sync_enabled boolean not null default true,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.google_contacts_oauth_states (
  id uuid primary key,
  org_id text not null,
  user_id uuid not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists google_contacts_oauth_states_expiry_idx
  on public.google_contacts_oauth_states (expires_at);

create table if not exists public.google_contact_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  partner_id text not null,
  normalized_phone text not null,
  contact_data jsonb not null,
  status text not null check (status in ('pending', 'synced', 'already_exists', 'failed')),
  attempts integer not null default 0,
  last_error text,
  google_contact_resource_name text,
  next_attempt_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, partner_id)
);
create index if not exists google_contact_sync_jobs_due_idx
  on public.google_contact_sync_jobs (status, next_attempt_at);

-- Deux requêtes concurrentes pour le même numéro ne peuvent pas créer deux
-- contacts Google : la seconde attend le prochain passage de la file.
create table if not exists public.google_contact_sync_locks (
  org_id text not null,
  normalized_phone text not null,
  locked_until timestamptz not null,
  primary key (org_id, normalized_phone)
);

alter table public.google_contacts_configs enable row level security;
alter table public.google_contacts_oauth_states enable row level security;
alter table public.google_contact_sync_jobs enable row level security;
alter table public.google_contact_sync_locks enable row level security;
revoke all on public.google_contacts_configs, public.google_contacts_oauth_states,
  public.google_contact_sync_jobs, public.google_contact_sync_locks from anon, authenticated;

-- Met à jour l'entité partenaire sans écraser ses autres données JSONB.
create or replace function public.set_google_contact_sync_status(
  p_org_id text, p_partner_id text, p_status text, p_error text default null,
  p_resource_name text default null, p_next_attempt_at timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.partners
  set data = (data - 'google_contact_sync_error' - 'google_contact_sync_next_retry_at')
    || jsonb_build_object('google_contact_sync_status', p_status)
    || case when p_error is null then '{}'::jsonb
       else jsonb_build_object('google_contact_sync_error', left(p_error, 1000)) end
    || case when p_resource_name is null then '{}'::jsonb
       else jsonb_build_object('google_contact_resource_name', p_resource_name,
          'google_contact_synced_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) end
    || case when p_next_attempt_at is null then '{}'::jsonb
       else jsonb_build_object('google_contact_sync_next_retry_at',
          to_char(p_next_attempt_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) end,
    updated_at = now()
  where org_id = p_org_id and id = p_partner_id;
end $$;

-- Verrou avec expiration : un crash n'empêche jamais définitivement une reprise.
create or replace function public.acquire_google_contact_sync_lock(
  p_org_id text, p_normalized_phone text, p_seconds integer default 90)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_until timestamptz := now() + make_interval(secs => greatest(10, least(p_seconds, 300)));
begin
  delete from public.google_contact_sync_locks
    where org_id = p_org_id and normalized_phone = p_normalized_phone and locked_until < now();
  insert into public.google_contact_sync_locks (org_id, normalized_phone, locked_until)
    values (p_org_id, p_normalized_phone, v_until)
    on conflict (org_id, normalized_phone) do nothing;
  return found;
end $$;

create or replace function public.release_google_contact_sync_lock(
  p_org_id text, p_normalized_phone text)
returns void language sql security definer set search_path = public as $$
  delete from public.google_contact_sync_locks
  where org_id = p_org_id and normalized_phone = p_normalized_phone;
$$;

revoke all on function public.set_google_contact_sync_status(text, text, text, text, text, timestamptz),
  public.acquire_google_contact_sync_lock(text, text, integer),
  public.release_google_contact_sync_lock(text, text) from public, anon, authenticated;
grant execute on function public.set_google_contact_sync_status(text, text, text, text, text, timestamptz),
  public.acquire_google_contact_sync_lock(text, text, integer),
  public.release_google_contact_sync_lock(text, text) to service_role;
