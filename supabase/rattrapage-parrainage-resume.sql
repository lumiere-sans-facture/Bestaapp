-- =====================================================================
--  RÉSUMÉ DE L'APERÇU DU RATTRAPAGE — LECTURE SEULE, rien ne change.
--  À passer après migrations/20261013_parrainage_commissions.sql, quand
--  l'aperçu de rattrapage-parrainage.sql rend trop de lignes pour être lu.
--
--  OÙ : Supabase › SQL Editor › coller ce fichier › Run.
-- =====================================================================
--
-- Le tableau a trois parties :
--   1. total       combien de lignes de chaque sorte l'application ferait ;
--   2. doublon     chaque devis qui porte plusieurs commissions pour un même
--                  niveau. « commission(s) distincte(s) » dit s'il s'agit de
--                  COPIES d'une seule commission (même identifiant, recopiée
--                  dans plusieurs entreprises : rien n'a été payé deux fois)
--                  ou de commissions DIFFÉRENTES. « payé en trop » chiffre
--                  le second cas ;
--   3. le reste    toutes les autres lignes de l'aperçu, une par une.
with apercu as (
  select etape, objet, detail from public.rattraper_parrainage_commissions(false)
), doublons as (
  select c.data ->> 'devisId' as devis_id, c.data ->> 'level' as niveau,
         count(*) as lignes,
         count(distinct c.id) as distinctes,
         count(distinct c.org_id) as entreprises,
         count(distinct c.id) filter (where c.data ->> 'status' = 'payée') as payees,
         count(distinct c.id) filter (where public.commission_engagee(c.org_id, c.id)) as demandees,
         max(public.montant_json(c.data ->> 'amount')) as montant
  from public.commissions c
  where coalesce(c.data ->> 'devisId', '') <> ''
    and coalesce(c.data ->> 'source', '') <> 'abonnement'
  group by 1, 2
  having count(*) > 1
)
select '1. total' as partie, etape as quoi, count(*)::text as detail
  from apercu group by etape
union all
select '2. doublon',
       coalesce((select max(d.data ->> 'devisNumber') from public.devis d where d.id = x.devis_id), x.devis_id)
         || ' · niveau ' || x.niveau,
       x.lignes || ' lignes = ' || x.distinctes || ' commission(s) distincte(s) dans ' || x.entreprises
         || ' entreprise(s) ; ' || x.payees || ' payée(s), ' || x.demandees || ' demandée(s) ; '
         || x.montant || ' F chacune ; payé en trop : ' || greatest(x.payees - 1, 0) * x.montant || ' F'
  from doublons x
union all
select '3. ' || etape, objet, detail
  from apercu where detail not like '%plusieurs commissions déjà payées%'
order by 1, 2;
