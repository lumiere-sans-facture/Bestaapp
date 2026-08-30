-- Google Contacts : les fiches affichées sous « Clients » sont stockées dans
-- public.leads. La file historique conserve le nom partner_id pour ne pas
-- casser les tâches déjà en attente, mais elle sait désormais de quelle
-- collection vient le contact.

alter table public.google_contact_sync_jobs
  add column if not exists contact_type text not null default 'partner';

alter table public.google_contact_sync_jobs
  drop constraint if exists google_contact_sync_jobs_contact_type_check;

alter table public.google_contact_sync_jobs
  add constraint google_contact_sync_jobs_contact_type_check
  check (contact_type in ('partner', 'lead'));

-- Version distincte de la fonction historique : les anciennes Edge Functions
-- peuvent encore finir un job partenaire pendant le déploiement.
create or replace function public.set_google_contact_sync_status_v2(
  p_org_id text, p_contact_id text, p_contact_type text, p_status text,
  p_error text default null, p_resource_name text default null,
  p_next_attempt_at timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_contact_type = 'partner' then
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
    where org_id = p_org_id and id = p_contact_id;
  elsif p_contact_type = 'lead' then
    update public.leads
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
    where org_id = p_org_id and id = p_contact_id;
  else
    raise exception 'type de contact inconnu';
  end if;

  if not found then raise exception 'contact introuvable'; end if;
end $$;

revoke all on function public.set_google_contact_sync_status_v2(text, text, text, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.set_google_contact_sync_status_v2(text, text, text, text, text, text, timestamptz)
  to service_role;
