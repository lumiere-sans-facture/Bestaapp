-- =====================================================================
--  RETROUVER UN KIT DISPARU (ex. « Kit 1,2 kWh ») — LECTURE SEULE
--  SQL Editor › New query › coller › Run. Ne modifie rien.
--  À passer dans les DEUX projets (test et production) : un kit créé dans
--  l'app de test n'existe pas dans la base de production, et inversement.
-- =====================================================================
-- Réglez ici la capacité cherchée (kWh) et un morceau du nom.
with cherche as (select 1.2::numeric as kwh, '1[,.]2' as motif_nom)
select * from (
  -- 1. Les kits qui EXISTENT, dans toutes les entreprises : capacité proche
  --    ou nom qui contient « 1,2 » / « 1.2 ».
  select 1 as n, 'Kit présent' as trouve,
         k.data ->> 'name' as nom,
         k.data ->> 'battery' as kwh,
         coalesce(o.name, k.org_id) as entreprise,
         k.id, k.updated_at as date
  from public.kits k
  left join public.orgs o on o.id = k.org_id, cherche c
  where abs(coalesce(nullif(k.data ->> 'battery', '')::numeric, -99) - c.kwh) < 0.05
     or (k.data ->> 'name') ~* c.motif_nom
  union all
  -- 2. Les kits SUPPRIMÉS : chaque suppression laisse une trace datée
  --    (le contenu, lui, n'est plus en base).
  select 2, 'Kit supprimé', null, null, coalesce(o.name, t.org_id), t.id, t.deleted_at
  from public.tombstones t
  left join public.orgs o on o.id = t.org_id
  where t.collection = 'kits' and t.deleted_at > now() - interval '180 days'
  union all
  -- 3. Au cas où il aurait été créé comme PRODUIT de la boutique.
  select 3, 'Produit boutique', p.data ->> 'name', null, coalesce(o.name, p.org_id), p.id, p.updated_at
  from public.products p
  left join public.orgs o on o.id = p.org_id, cherche c
  where (p.data ->> 'name') ~* c.motif_nom and (p.data ->> 'name') ~* 'kw'
) r
order by n, date desc;
