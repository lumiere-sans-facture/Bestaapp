-- =====================================================================
--  SCÉNARIO : mise à jour des exemples SBEE de l'Académie (115 → 145 F).
--  Joué par supabase/tests/lancer.sh sur une base neuve, DEPUIS le dépôt
--  (l'ancienne version des cours est relue dans l'historique git) :
--    supabase/tests/lancer.sh supabase/tests/academie-sbee-145.sql
--
--  La base reçoit les cours tels qu'ils sont en production (dotation de
--  328305d, exemples à 115 F), puis supabase/academie-sbee-145.sql :
--  les cours de l'organisation interne passent à 145 F et deviennent
--  identiques à la dotation actuelle ; rejoué, il ne change plus rien ; une
--  leçon retouchée par le gérant est gardée ; une autre entreprise qui
--  aurait une copie des cours n'est pas touchée.
-- =====================================================================
\set ON_ERROR_STOP 1
\pset footer off
\set ancienne_dotation `git show 328305d:supabase/formations-academie.sql`

\echo '0. Référence : les cours de la dotation actuelle (145 F)'
\ir ../formations-academie.sql
create temp table reference as
  select f.id, f.data from public.formations f join public.orgs o on o.id = f.org_id and o.kind = 'interne';
delete from public.formations f using public.orgs o where o.id = f.org_id and o.kind = 'interne';

\echo '1. Base de production : les cours dotés avant la mise à jour (115 F)'
:ancienne_dotation
-- Une autre entreprise avec une copie des mêmes cours (ancien modèle de
-- dotation) : elle ne doit pas bouger.
insert into public.orgs (id, name, kind) values ('org-copie', 'Copie ancienne', 'pro');
insert into public.formations (org_id, id, data)
select 'org-copie', f.id, f.data from public.formations f join public.orgs o on o.id = f.org_id and o.kind = 'interne';
do $$ begin
  if (select count(*) from reference) <> 3 then
    raise exception 'ÉCHEC : la référence devrait compter trois cours';
  end if;
  if (select count(*) from public.formations f join public.orgs o on o.id = f.org_id and o.kind = 'interne'
       where f.data::text like '%÷ 115 ≈ 217 kWh%') <> 2 then
    raise exception 'ÉCHEC : la base de départ devrait avoir deux cours à 115 F';
  end if;
end $$;

\echo '2. Mise à jour : les deux cours passent à 145 F, identiques à la dotation actuelle'
\ir ../academie-sbee-145.sql
do $$ begin
  if exists (
    select 1 from reference r
      left join (public.formations f join public.orgs o on o.id = f.org_id and o.kind = 'interne') on f.id = r.id
     where f.data is distinct from r.data) then
    raise exception 'ÉCHEC : après mise à jour, un cours diffère de la dotation actuelle';
  end if;
  if (select count(*) from public.formations where org_id = 'org-copie' and data::text like '%÷ 115 ≈ 217 kWh%') <> 2 then
    raise exception 'ÉCHEC : la copie d''une autre entreprise a été modifiée';
  end if;
end $$;

\echo '3. Seconde exécution : rien ne change'
create temp table avant as select org_id, id, data, updated_at from public.formations;
\ir ../academie-sbee-145.sql
do $$ begin
  if exists (select 1 from public.formations f join avant a using (org_id, id)
              where f.data is distinct from a.data or f.updated_at is distinct from a.updated_at) then
    raise exception 'ÉCHEC : la seconde exécution a modifié un cours';
  end if;
end $$;

\echo '4. Leçon retouchée par le gérant : gardée telle quelle, le reste du cours est mis à jour'
delete from public.formations f using public.orgs o where o.id = f.org_id and o.kind = 'interne';
:ancienne_dotation
update public.formations f set data = replace(f.data::text, 'Ce dernier choix compte beaucoup', 'Ce dernier choix compte énormément')::jsonb
  from public.orgs o where o.id = f.org_id and o.kind = 'interne' and f.id = 'academie-demarrer';
\ir ../academie-sbee-145.sql
do $$ begin
  if (select count(*) from public.formations f join public.orgs o on o.id = f.org_id and o.kind = 'interne'
       where f.id = 'academie-demarrer'
         and f.data::text like '%compte énormément%'
         and f.data::text like '%à 115 F le kWh : environ 217 kWh%'
         and f.data::text like '%Facture de 25 000 F à 145 F le kWh : combien de kWh par mois%') <> 1 then
    raise exception 'ÉCHEC : la leçon retouchée devait rester (à 115 F) et le quiz du même cours passer à 145 F';
  end if;
end $$;

\echo '✅ Académie, exemples SBEE : mise à jour à 145 F, rejeu sans effet, retouches et autres entreprises préservées.'
