-- Codes partenaires : ils servent dans des liens publics de parrainage et
-- doivent donc être uniques sur toute la plateforme, pas seulement dans le
-- cache local d'un téléphone.

-- Répare les doublons historiques en laissant le premier code intact et en
-- ajoutant un suffixe lisible aux suivants. md5(id) est stable pour chaque
-- partenaire et évite que deux corrections produisent le même suffixe.
with classes as (
  select ctid, id, data ->> 'code' as code,
    row_number() over (
      partition by upper(btrim(data ->> 'code'))
      order by updated_at asc, id asc
    ) as position
  from public.partners
  where nullif(btrim(data ->> 'code'), '') is not null
)
update public.partners as partner
set data = partner.data || jsonb_build_object(
      'code', left(classes.code, 32) || '-' || upper(substring(md5(classes.id) from 1 for 6))
    ),
    updated_at = now()
from classes
where partner.ctid = classes.ctid and classes.position > 1;

create unique index if not exists partners_unique_code_ci_idx
  on public.partners (upper(btrim(data ->> 'code')))
  where nullif(btrim(data ->> 'code'), '') is not null;

