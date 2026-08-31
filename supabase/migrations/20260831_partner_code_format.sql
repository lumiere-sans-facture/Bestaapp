-- Remplace le préfixe historique BESTA- par le format public NOM-XXXXXX.
-- Tous les liens et traces existants sont mis à jour dans la même transaction.

begin;

create temporary table partner_code_format_map on commit drop as
with source as (
  select id, org_id, upper(btrim(data ->> 'code')) as old_code,
    regexp_replace(upper(btrim(data ->> 'code')), '^BESTA-', '') as stripped_code,
    updated_at
  from public.partners
  where upper(btrim(data ->> 'code')) like 'BESTA-%'
), formatted as (
  select *,
    case when stripped_code ~ '^[A-Z]{1,10}-[A-Z2-9]{6}$' then stripped_code
      else left(split_part(stripped_code, '-', 1), 10) || '-' || upper(substring(md5(id) from 1 for 6))
    end as simple_code
  from source
), ranked as (
  select *, row_number() over (partition by simple_code order by updated_at, id) as position
  from formatted
)
select id, org_id, old_code,
  case when position = 1 then simple_code
    else simple_code || '-' || upper(substring(md5(id) from 1 for 6))
  end as new_code
from ranked;

-- Références dans les profils partenaires et les fiches clients.
update public.partners as partner
set data = partner.data || jsonb_build_object('sponsorCode', map.new_code), updated_at = now()
from partner_code_format_map as map
where upper(btrim(partner.data ->> 'sponsorCode')) = map.old_code;

update public.partners as partner
set data = (partner.data - 'code') || jsonb_build_object('code', map.new_code), updated_at = now()
from partner_code_format_map as map
where partner.id = map.id;

update public.leads as lead
set data = lead.data || jsonb_build_object('registeredByPartnerCode', map.new_code), updated_at = now()
from partner_code_format_map as map
where upper(btrim(lead.data ->> 'registeredByPartnerCode')) = map.old_code;

update public.orgs as organisation
set referred_by = map.new_code
from partner_code_format_map as map
where upper(btrim(organisation.referred_by)) = map.old_code;

-- Historique d'affiliation, devis, commissions et demandes de paiement.
do $$
declare table_name text;
begin
  foreach table_name in array array['referrals', 'devis', 'commissions', 'payoutRequests'] loop
    execute format(
      'update public.%I as item set data = item.data || jsonb_build_object(''partnerCode'', map.new_code), updated_at = now() from partner_code_format_map as map where upper(btrim(item.data ->> ''partnerCode'')) = map.old_code',
      table_name
    );
  end loop;
end $$;

-- Les clients déjà dans la file Google gardent aussi la nouvelle attribution.
update public.google_contact_sync_jobs as job
set contact_data = job.contact_data || jsonb_build_object('registeredByCode', map.new_code), updated_at = now()
from partner_code_format_map as map
where upper(btrim(job.contact_data ->> 'registeredByCode')) = map.old_code;

commit;

