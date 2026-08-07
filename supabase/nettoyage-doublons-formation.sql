-- ============================================================
-- Nettoyage : supprimer les COPIES des cours de formation
-- détenues par les entreprises non internes
--
-- À exécuter dans le SQL Editor de Supabase (Run), APRÈS
-- partage-formation.sql. Rejouable sans risque.
-- ============================================================
--
-- POURQUOI : chaque entreprise inscrite avant le partage a reçu sa propre
-- copie des cours de départ (mêmes identifiants que ceux de l'organisation
-- interne). Tant que la version partagée arrive, elle prend le dessus…
-- mais dès qu'un cours est MASQUÉ ou SUPPRIMÉ par son propriétaire, la
-- vieille copie locale de l'affilié refait surface — le masquage semblait
-- ne pas fonctionner. Les cours ne doivent vivre qu'à UN endroit :
-- l'organisation interne. (L'application ne distribue plus ces copies ;
-- ce script efface celles qui existent déjà.)
--
-- CE QUI EST CONSERVÉ :
--   • tous les cours de l'organisation interne (la source) ;
--   • les cours CRÉÉS par une entreprise (identifiants propres, aucun
--     homonyme chez l'organisation interne) ;
--   • la progression des membres (formationProgress) — les leçons des
--     cours partagés portent les mêmes identifiants, rien n'est perdu.
-- CE QUI EST PERDU : les modifications qu'une entreprise non interne
--   aurait faites sur SA copie des cours de départ (cas de test, en
--   pratique) — la version de l'organisation interne fait foi.

-- 1. Aperçu de ce qui sera supprimé (lecture seule — à lancer d'abord)
select f.org_id, o.name as entreprise, f.id, f.data ->> 'title' as titre
  from public.formations f
  join public.orgs o on o.id = f.org_id
 where not public.org_est_interne(f.org_id)
   and exists (
     select 1 from public.formations i
      where i.id = f.id and public.org_est_interne(i.org_id)
   )
 order by o.name, f.id;

-- 2. Suppression des copies (les lignes listées ci-dessus)
delete from public.formations f
 where not public.org_est_interne(f.org_id)
   and exists (
     select 1 from public.formations i
      where i.id = f.id and public.org_est_interne(i.org_id)
   );

-- 3. Tombstones orphelins : une entreprise qui avait « supprimé » sa copie
--    d'un cours partagé garde une trace de suppression qui MASQUERAIT la
--    version partagée à la réception. On l'efface — on ne supprime pas ce
--    qui ne nous appartient pas.
delete from public.tombstones t
 where t.collection = 'formations'
   and not public.org_est_interne(t.org_id)
   and exists (
     select 1 from public.formations i
      where i.id = t.id and public.org_est_interne(i.org_id)
   );

-- 4. Contrôle : plus aucun doublon — chaque identifiant de cours de
--    l'organisation interne ne doit exister QUE chez elle.
select f.id, count(*) as occurrences
  from public.formations f
 where exists (
     select 1 from public.formations i
      where i.id = f.id and public.org_est_interne(i.org_id)
   )
 group by f.id
having count(*) > 1;
-- Résultat attendu : aucune ligne.
