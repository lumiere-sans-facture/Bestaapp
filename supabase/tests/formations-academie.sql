-- =====================================================================
--  SCÉNARIO : dotation des formations de l'Académie BestaSolar.
--  Joué par supabase/tests/lancer.sh sur une base neuve :
--    supabase/tests/lancer.sh supabase/tests/formations-academie.sql
--
--  Le script supabase/formations-academie.sql ajoute les trois cours à
--  l'organisation interne ; rejoué, il n'ajoute rien, ne réécrit pas un cours
--  retouché par le gérant et ne ressuscite pas un cours supprimé. Une autre
--  entreprise les lit en partage, sans copie.
-- =====================================================================
\set ON_ERROR_STOP 1
\pset footer off
\set E '{"role":"authenticated","email":"e@test.tg","sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"}'
\set idE 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

\echo '1. Première exécution : trois cours dans l''organisation interne'
\ir ../formations-academie.sql
do $$ begin
  if (select count(*) from public.formations f join public.orgs o on o.id = f.org_id and o.kind = 'interne'
       where f.id like 'academie-%') <> 3 then
    raise exception 'ÉCHEC : trois cours attendus dans l''organisation interne';
  end if;
  if exists (select 1 from public.formations f join public.orgs o on o.id = f.org_id
              where f.id like 'academie-%' and o.kind <> 'interne') then
    raise exception 'ÉCHEC : un cours a été copié hors de l''organisation interne';
  end if;
  -- Le contenu arrive entier : modules, leçons, quiz et couverture.
  if (select jsonb_array_length(data -> 'modules') from public.formations where id = 'academie-devis') <> 6
     or (select data #>> '{modules,0,lecons,1,questions,0,id}' from public.formations where id = 'academie-devis') <> 'dv-m1-quiz-q1'
     or (select data ->> 'cover' from public.formations where id = 'academie-revenus') not like 'data:image/svg+xml;%' then
    raise exception 'ÉCHEC : contenu de cours incomplet';
  end if;
end $$;

\echo '2. Le gérant retouche un cours et en supprime un autre (tombstone, comme l''application)'
update public.formations set data = jsonb_set(data, '{title}', '"Démarrer — version maison"')
 where id = 'academie-demarrer';
delete from public.formations where id = 'academie-revenus';
insert into public.tombstones (org_id, id, collection)
select id, 'academie-revenus', 'formations' from public.orgs where kind = 'interne';

\echo '3. Seconde exécution : rien n''est ajouté, rien n''est réécrit, rien ne ressuscite'
\ir ../formations-academie.sql
do $$ begin
  if (select data ->> 'title' from public.formations where id = 'academie-demarrer') <> 'Démarrer — version maison' then
    raise exception 'ÉCHEC : la retouche du gérant a été écrasée';
  end if;
  if exists (select 1 from public.formations where id = 'academie-revenus') then
    raise exception 'ÉCHEC : un cours supprimé par le gérant a été ressuscité';
  end if;
  if (select count(*) from public.formations where id like 'academie-%') <> 2 then
    raise exception 'ÉCHEC : doublon ou cours manquant après la seconde exécution';
  end if;
end $$;

\echo '4. Une autre entreprise lit les cours en partage (policy « formations lecture partagee »)'
--    (une entreprise Pro : un inscrit sans espace Pro rejoint, lui,
--    l'organisation interne — il n'y aurait rien de « partagé » à vérifier).
insert into auth.users (id, email) values (:'idE', 'e@test.tg');
insert into public.orgs (id, name, kind) values ('org-atakora', 'Soleil d''Atakora', 'pro');
insert into public.profiles (id, email, name, role, org_id)
values (:'idE', 'e@test.tg', 'Eric Egbe', 'gerant', 'org-atakora');
set role authenticated;
select set_config('request.jwt.claims', :'E', false) is not null as connecte;
do $$ begin
  if public.org_est_interne(public.auth_org_id()) then
    raise exception 'ÉCHEC : l''entreprise de test ne doit pas être l''organisation interne';
  end if;
  if (select count(*) from public.formations where id like 'academie-%') <> 2 then
    raise exception 'ÉCHEC : l''autre entreprise ne voit pas les cours partagés';
  end if;
end $$;
-- Et ne peut pas les modifier.
update public.formations set data = jsonb_set(data, '{title}', '"piraté"') where id = 'academie-devis';
reset role;
select set_config('request.jwt.claims', '', false);
do $$ begin
  if (select data ->> 'title' from public.formations where id = 'academie-devis') <> 'Créer des devis qui signent' then
    raise exception 'ÉCHEC : une autre entreprise a pu modifier un cours partagé';
  end if;
end $$;

\echo '✅ Formations de l''Académie : dotation, rejeu et partage conformes.'
