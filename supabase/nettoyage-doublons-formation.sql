-- ============================================================
-- Nettoyage : supprimer les COPIES des cours de formation
-- détenues par les entreprises non internes — définitivement
--
-- À exécuter dans le SQL Editor de Supabase (Run), APRÈS
-- partage-formation.sql, et APRÈS déploiement de l'application
-- qui immunise les cours partagés contre les tombstones locaux.
-- Rejouable sans risque.
-- ============================================================
--
-- POURQUOI : chaque entreprise inscrite avant le partage a reçu sa propre
-- copie des cours de départ (mêmes identifiants que ceux de l'organisation
-- interne). Ces copies refont surface dès qu'un cours est MASQUÉ ou
-- SUPPRIMÉ par son propriétaire — pire, un appareil affilié resté sur un
-- vieux cache repousse sa copie au serveur (la version partagée d'un cours
-- masqué n'arrivant plus, il croit sa copie « créée hors-ligne »). D'où
-- l'étape 3 : une trace de suppression (tombstone) par entreprise et par
-- cours interne, qui purge les vieux caches au lieu de les laisser
-- ressusciter le doublon. Côté application, les cours partagés sont
-- immunisés contre ces tombstones — ils ne peuvent pas les masquer.
--
-- CE QUI EST CONSERVÉ : les cours de l'organisation interne, les cours
-- propres à chaque entreprise (identifiants sans homonyme interne), et la
-- progression des membres. CE QUI EST PERDU : les retouches qu'une
-- entreprise aurait faites sur SA copie des cours de départ.

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

-- 3. Purge des vieux caches : un tombstone par (entreprise non interne ×
--    cours interne). Tout appareil qui détient encore une copie locale la
--    jettera à la prochaine synchronisation au lieu de la repousser.
insert into public.tombstones (org_id, id, collection, deleted_at)
select o.id, i.id, 'formations', now()
  from public.orgs o
  cross join (
    select distinct f.id from public.formations f where public.org_est_interne(f.org_id)
  ) i
 where not public.org_est_interne(o.id)
on conflict (org_id, id, collection) do nothing;

-- 4. Contrôle : plus aucun doublon — chaque identifiant de cours interne
--    ne doit exister QUE chez l'organisation interne.
select f.id, count(*) as occurrences
  from public.formations f
 where exists (
     select 1 from public.formations i
      where i.id = f.id and public.org_est_interne(i.org_id)
   )
 group by f.id
having count(*) > 1;
-- Résultat attendu : aucune ligne.
