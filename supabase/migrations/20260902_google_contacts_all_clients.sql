-- Google Contacts : tous les clients (CRM + Devis Pro), déduplication
-- durable et traçabilité. À exécuter après 20260830_google_contacts_leads.sql.
--
-- La synchronisation est déclenchée depuis la base, et non seulement depuis
-- un navigateur ouvert : une création hors ligne rejoint la file dès que la
-- réplication Supabase arrive, puis l'Edge Function la traite/reprend.

alter table public.google_contact_sync_jobs
  add column if not exists normalized_email text;

-- Un client peut n'avoir qu'un e-mail. Les jobs historiques conservent leur
-- numéro, tandis qu'un e-mail sert de clé de verrouillage en l'absence de tel.
alter table public.google_contact_sync_jobs
  alter column normalized_phone drop not null;

update public.google_contact_sync_jobs
set normalized_phone = concat('legacy:', id::text)
where normalized_phone is null or btrim(normalized_phone) = '';

alter table public.google_contact_sync_jobs
  drop constraint if exists google_contact_sync_jobs_contact_type_check;

alter table public.google_contact_sync_jobs
  add constraint google_contact_sync_jobs_contact_type_check
  check (contact_type in ('partner', 'lead', 'pro_client'));

-- Un même UUID peut théoriquement exister dans deux collections : la file
-- doit donc identifier le type de fiche, pas seulement son id.
alter table public.google_contact_sync_jobs
  drop constraint if exists google_contact_sync_jobs_org_id_partner_id_key;

alter table public.google_contact_sync_jobs
  drop constraint if exists google_contact_sync_jobs_org_contact_type_contact_id_key;

alter table public.google_contact_sync_jobs
  add constraint google_contact_sync_jobs_org_contact_type_contact_id_key
  unique (org_id, contact_type, partner_id);

create index if not exists google_contact_sync_jobs_identity_idx
  on public.google_contact_sync_jobs (org_id, normalized_phone, normalized_email);

-- Met à jour l'état de la fiche d'origine. Cette fonction est réservée au
-- service_role (Edge Function), jamais à un navigateur.
create or replace function public.set_google_contact_sync_status_v3(
  p_org_id text, p_contact_id text, p_contact_type text, p_status text,
  p_error text default null, p_resource_name text default null,
  p_next_attempt_at timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_table text;
begin
  v_table := case p_contact_type
    when 'partner' then 'partners'
    when 'lead' then 'leads'
    when 'pro_client' then 'proClients'
    else null
  end;
  if v_table is null then raise exception 'type de contact inconnu'; end if;

  execute format($sql$
    update public.%I
    set data = (data - 'google_contact_sync_error' - 'google_contact_sync_next_retry_at')
      || jsonb_build_object('google_contact_sync_status', $1)
      || case when $2 is null then '{}'::jsonb
         else jsonb_build_object('google_contact_sync_error', left($2, 1000)) end
      || case when $3 is null then '{}'::jsonb
         else jsonb_build_object('google_contact_resource_name', $3,
            'google_contact_synced_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) end
      || case when $4 is null then '{}'::jsonb
         else jsonb_build_object('google_contact_sync_next_retry_at',
            to_char($4 at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) end,
      updated_at = now()
    where org_id = $5 and id = $6
  $sql$, v_table)
  using p_status, p_error, p_resource_name, p_next_attempt_at, p_org_id, p_contact_id;

  if not found then raise exception 'contact introuvable'; end if;
end $$;

revoke all on function public.set_google_contact_sync_status_v3(text, text, text, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.set_google_contact_sync_status_v3(text, text, text, text, text, text, timestamptz)
  to service_role;

-- Les clés de statut ne doivent jamais recréer un job quand l'Edge Function
-- vient simplement d'écrire « synchronisé » ou « échec ».
create or replace function public.enqueue_google_contact_client_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_type text := tg_argv[0];
  v_phone text := nullif(regexp_replace(coalesce(new.data->>'phone', ''), '[^0-9]', '', 'g'), '');
  v_email text := nullif(lower(btrim(coalesce(new.data->>'email', ''))), '');
  v_identity text;
  v_name text;
  v_company text;
  v_data jsonb;
begin
  -- Une mise à jour de statut par set_google_contact_sync_status_v3 ne doit
  -- pas boucler vers une nouvelle synchronisation.
  if tg_op = 'UPDATE' and
    (new.data - array['google_contact_sync_status', 'google_contact_sync_error',
      'google_contact_sync_next_retry_at', 'google_contact_resource_name',
      'google_contact_synced_at'])
    is not distinct from
    (old.data - array['google_contact_sync_status', 'google_contact_sync_error',
      'google_contact_sync_next_retry_at', 'google_contact_resource_name',
      'google_contact_synced_at']) then
    return new;
  end if;

  -- E-mail volontairement validé simplement : l'Edge Function applique la
  -- même règle que le navigateur. Une absence des deux identifiants conserve
  -- le client en base, mais il n'y a rien de fiable à envoyer à Google.
  if v_phone is null and (v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    return new;
  end if;
  if v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then v_email := null; end if;
  v_identity := coalesce(v_phone, 'email:' || v_email);
  v_name := coalesce(nullif(new.data->>'contact', ''), nullif(new.data->>'name', ''), 'Client BestaSolar');
  v_company := case when v_type = 'lead' and new.data->>'clientType' = 'entreprise'
    then nullif(new.data->>'name', '') else coalesce(nullif(new.data->>'company', ''), nullif(new.data->>'entreprise', '')) end;
  v_data := jsonb_build_object(
    'id', new.id,
    'name', v_name,
    'phone', coalesce(new.data->>'phone', ''),
    'email', coalesce(v_email, ''),
    'company', coalesce(v_company, ''),
    'registeredByUserId', coalesce(new.data->>'registeredByUserId', new.data->>'assignedTo', new.data->>'userId'),
    'registeredByName', coalesce(new.data->>'registeredByName', new.data->>'registeredByPartnerName', ''),
    'registeredByCode', coalesce(new.data->>'registeredByCode', new.data->>'registeredByPartnerCode', ''),
    'createdAt', coalesce(new.data->>'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
    'registrationHistory', coalesce(new.data->'registrationHistory', '[]'::jsonb)
  );

  new.data := (new.data - 'google_contact_sync_error' - 'google_contact_sync_next_retry_at')
    || jsonb_build_object('google_contact_sync_status', 'pending');

  insert into public.google_contact_sync_jobs (
    org_id, partner_id, contact_type, normalized_phone, normalized_email,
    contact_data, status, attempts, last_error, next_attempt_at, updated_at
  ) values (
    new.org_id, new.id, v_type, v_identity, v_email,
    v_data, 'pending', 0, null, now(), now()
  ) on conflict (org_id, contact_type, partner_id) do update set
    normalized_phone = excluded.normalized_phone,
    normalized_email = excluded.normalized_email,
    contact_data = excluded.contact_data,
    status = 'pending',
    attempts = 0,
    last_error = null,
    next_attempt_at = now(),
    updated_at = now();
  return new;
end $$;

drop trigger if exists google_contact_sync_enqueue_lead on public.leads;
create trigger google_contact_sync_enqueue_lead
  before insert or update of data on public.leads
  for each row execute function public.enqueue_google_contact_client_sync('lead');

drop trigger if exists google_contact_sync_enqueue_pro_client on public."proClients";
create trigger google_contact_sync_enqueue_pro_client
  before insert or update of data on public."proClients"
  for each row execute function public.enqueue_google_contact_client_sync('pro_client');

drop trigger if exists google_contact_sync_enqueue_partner on public.partners;
create trigger google_contact_sync_enqueue_partner
  before insert or update of data on public.partners
  for each row execute function public.enqueue_google_contact_client_sync('partner');

-- Met aussi les fiches déjà présentes dans la file une seule fois. Les
-- doublons Google sont fusionnés par téléphone / e-mail par l'Edge Function,
-- donc cette reprise ne crée pas une seconde fiche dans le carnet central.
update public.leads set data = data
where nullif(btrim(coalesce(data->>'phone', '')), '') is not null
   or nullif(btrim(coalesce(data->>'email', '')), '') is not null;

update public."proClients" set data = data
where nullif(btrim(coalesce(data->>'phone', '')), '') is not null
   or nullif(btrim(coalesce(data->>'email', '')), '') is not null;
