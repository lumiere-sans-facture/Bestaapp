-- =====================================================================
--  SCÉNARIO : parrainage, commissions par niveau, clics.
--  Joué par supabase/tests/lancer.sh sur une base neuve. Chaque contrôle
--  qui échoue arrête le script avec son message.
--
--  A parraine B, B parraine C. Le gérant valide un devis du client de C :
--  C (le technicien) touche le niveau 1, B (son parrain) le niveau 2, et A
--  rien — deux niveaux seulement. Chacun le voit ; le gérant voit tout ; un
--  clic sur le lien de A incrémente son compteur.
-- =====================================================================
\set ON_ERROR_STOP 1
\pset footer off
\set A '{"role":"authenticated","email":"a@test.tg","sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}'
\set B '{"role":"authenticated","email":"b@test.tg","sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}'
\set C '{"role":"authenticated","email":"c@test.tg","sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}'
\set D '{"role":"authenticated","email":"d@test.tg","sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd"}'
\set G '{"role":"authenticated","email":"gerant@besta.tg"}'
\set idA 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set idB 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set idC 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
\set idD 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

-- Le gérant a sa fiche partenaire : c'est le parrain par défaut.
insert into public.partners (org_id, id, data) values ('org-bestasolar', 'p-user-u-gerant',
  '{"id":"p-user-u-gerant","userId":"u-gerant","name":"Gérant Besta","code":"GERANT-AB12CD","status":"actif"}');
insert into auth.users (id, email) values
  (:'idA', 'a@test.tg'), (:'idB', 'b@test.tg'), (:'idC', 'c@test.tg'), (:'idD', 'd@test.tg');

-- Chaque nouveau compte : inscription, puis l'application crée sa fiche
-- partenaire (comme ensurePartnerForUser), sous l'identité du compte.
\echo '1. Inscriptions : A sans code, B par le lien de A, C par le lien de B (ancien préfixe), D sans code'
set role authenticated;
select set_config('request.jwt.claims', :'A', false);
select public.signup_create_org('Awa', 'Awa Agbo', null, '') is not null as inscrit;
insert into public.partners (org_id, id, data) values ('org-bestasolar', 'p-user-' || :'idA',
  jsonb_build_object('id', 'p-user-' || :'idA', 'userId', :'idA', 'name', 'Awa Agbo', 'code', 'AWA-AAA111', 'status', 'actif'));
select set_config('request.jwt.claims', :'B', false);
select public.signup_create_org('Bio', 'Bio Bamba', 'awa-aaa111', '') is not null as inscrit;
insert into public.partners (org_id, id, data) values ('org-bestasolar', 'p-user-' || :'idB',
  jsonb_build_object('id', 'p-user-' || :'idB', 'userId', :'idB', 'name', 'Bio Bamba', 'code', 'BIO-BBB222', 'status', 'actif'));
select set_config('request.jwt.claims', :'C', false);
select public.signup_create_org('Cica', 'Cica Coffi', 'BESTA-BIO-BBB222', '') is not null as inscrit;
-- L'application de C tente d'écrire un autre parrain sur sa fiche : le serveur garde le vrai.
insert into public.partners (org_id, id, data) values ('org-bestasolar', 'p-user-' || :'idC',
  jsonb_build_object('id', 'p-user-' || :'idC', 'userId', :'idC', 'name', 'Cica Coffi', 'code', 'CICA-CCC333',
                     'status', 'actif', 'sponsorId', 'p-user-u-gerant', 'sponsorCode', 'GERANT-AB12CD'));
select set_config('request.jwt.claims', :'D', false);
select public.signup_create_org('Dede', 'Dédé Dossou', 'CODE-INCONNU', '') is not null as inscrit;
reset role;
select set_config('request.jwt.claims', '', false);

do $$ begin
  assert (select parrain_code || '/' || source from public.parrainages where filleul_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 'GERANT-AB12CD/defaut',
    'A, inscrit sans code, doit être rattaché par défaut au gérant';
  assert (select parrain_partner_id || '/' || source from public.parrainages where filleul_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') = 'p-user-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/inscription',
    'B doit avoir A pour parrain';
  assert (select parrain_partner_id from public.parrainages where filleul_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc') = 'p-user-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'C doit avoir B pour parrain (code avec l''ancien préfixe BESTA-)';
  assert (select source from public.parrainages where filleul_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd') = 'defaut',
    'un code inconnu à l''inscription : rattachement par défaut, pas de parrain fantôme';
  assert (select data ->> 'sponsorId' from public.partners where id = 'p-user-cccccccc-cccc-4ccc-8ccc-cccccccccccc') = 'p-user-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'la fiche de C doit porter son vrai parrain (B), pas celui écrit par l''application';
  assert exists (select 1 from public.referrals where data ->> 'type' = 'inscription' and data ->> 'filleulId' = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
    'l''historique du parrain garde l''inscription, avec l''identifiant du filleul';
end $$;
\echo '   ✓ chaque filleul a son parrain, sur la personne'

\echo '2. BUG 1 — chacun voit ses filleuls et son parrain'
set role authenticated;
select set_config('request.jwt.claims', :'A', false);
do $$ begin
  assert (select count(*) from public.mes_filleuls()) = 1, 'A doit voir 1 filleul';
  assert (select nom from public.mes_filleuls()) = 'Bio Bamba', 'le filleul de A est B';
  assert (select inscrit_le from public.mes_filleuls()) is not null, 'date d''inscription du filleul';
end $$;
select set_config('request.jwt.claims', :'B', false);
do $$ begin
  assert (select nom from public.mes_filleuls()) = 'Cica Coffi', 'le filleul de B est C';
  assert (select count(*) from public.parrainages) = 2, 'B lit son propre lien (vers A) et celui de son filleul (C)';
end $$;
select set_config('request.jwt.claims', :'C', false);
do $$ begin
  assert (select code from public.mon_parrain()) = 'BIO-BBB222', 'C voit B comme parrain';
  assert (select count(*) from public.mes_filleuls()) = 0, 'C n''a pas de filleul';
end $$;
reset role;
\echo '   ✓ « Mes filleuls » et « Mon parrain » viennent du lien réel'

\echo '3. BUG 2 & 3 — devis du client de C, préparé puis validé par le gérant'
set role authenticated;
select set_config('request.jwt.claims', :'C', false);
insert into public.leads (org_id, id, data) values ('org-bestasolar', 'lead-c1', jsonb_build_object(
  'id', 'lead-c1', 'name', 'Client de C', 'registeredByUserId', :'idC', 'assignedTo', :'idC',
  'stage', 'nouveau', 'estimatedValue', 900000));
select set_config('request.jwt.claims', :'G', false);
-- Comme l'ancienne application : le gérant crée le devis, il en est « l'apporteur ».
insert into public.devis (org_id, id, data) values ('org-bestasolar', 'devis-c1', jsonb_build_object(
  'id', 'devis-c1', 'leadId', 'lead-c1', 'devisNumber', 'BS-20261013-0001', 'total', 1000000,
  'stage', 'proposition', 'createdBy', 'u-gerant', 'partnerId', 'p-user-u-gerant'));
-- Validation (upsert, comme la synchronisation).
insert into public.devis (org_id, id, data) values ('org-bestasolar', 'devis-c1', jsonb_build_object(
  'id', 'devis-c1', 'leadId', 'lead-c1', 'devisNumber', 'BS-20261013-0001', 'total', 1000000,
  'stage', 'gagne', 'createdBy', 'u-gerant', 'partnerId', 'p-user-u-gerant'))
  on conflict (org_id, id) do update set data = excluded.data;
reset role;
select set_config('request.jwt.claims', '', false);
do $$ begin
  assert (select count(*) from public.commissions where data ->> 'devisId' = 'devis-c1') = 2,
    'deux commissions pour ce devis : une par niveau';
  assert (select data ->> 'amount' from public.commissions where data ->> 'devisId' = 'devis-c1' and data ->> 'level' = '1') = '30000',
    'niveau 1 : 3 % de 1 000 000';
  assert (select data ->> 'partnerId' from public.commissions where data ->> 'devisId' = 'devis-c1' and data ->> 'level' = '1') = 'p-user-cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'niveau 1 : le technicien C, pas le gérant qui a créé le devis';
  assert (select data ->> 'partnerId' || '/' || (data ->> 'amount') from public.commissions where data ->> 'devisId' = 'devis-c1' and data ->> 'level' = '2') = 'p-user-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/15000',
    'niveau 2 : B, parrain de C, 1,5 %';
  assert not exists (select 1 from public.commissions where data ->> 'partnerId' in ('p-user-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'p-user-u-gerant')),
    'ni A (niveau 3 inexistant) ni le gérant ne touchent rien';
  assert (select data ->> 'devisNumber' || '/' || (data ->> 'taux') from public.commissions where data ->> 'devisId' = 'devis-c1' and data ->> 'level' = '2') = 'BS-20261013-0001/0.01500',
    'la commission porte son devis d''origine et son taux';
  assert exists (select 1 from public.referrals where data ->> 'type' = 'affaire' and data ->> 'partnerCode' = 'BIO-BBB222'),
    'l''historique de B note l''affaire de son filleul';
end $$;
\echo '   ✓ C niveau 1 (30 000), B niveau 2 (15 000), A et le gérant rien'

\echo '4. Lecture des commissions selon le rôle'
set role authenticated;
select set_config('request.jwt.claims', :'C', false);
do $$ begin assert (select count(*) from public.commissions) = 1 and (select data ->> 'level' from public.commissions) = '1', 'C ne voit que SA commission'; end $$;
select set_config('request.jwt.claims', :'B', false);
do $$ begin assert (select count(*) from public.commissions) = 1 and (select data ->> 'level' from public.commissions) = '2', 'B ne voit que SA commission'; end $$;
select set_config('request.jwt.claims', :'A', false);
do $$ begin assert (select count(*) from public.commissions) = 0, 'A ne voit rien'; end $$;
select set_config('request.jwt.claims', :'G', false);
do $$ begin assert (select count(*) from public.commissions) = 2, 'le gérant voit tout'; end $$;
reset role;
\echo '   ✓ chacun ses commissions, le gérant toutes'

\echo '5. Idempotence : valider deux fois, revalider, double appel'
set role authenticated;
select set_config('request.jwt.claims', :'G', false);
insert into public.devis (org_id, id, data) values ('org-bestasolar', 'devis-c1', jsonb_build_object(
  'id', 'devis-c1', 'leadId', 'lead-c1', 'devisNumber', 'BS-20261013-0001', 'total', 1000000, 'stage', 'gagne'))
  on conflict (org_id, id) do update set data = excluded.data;
update public.devis set data = data || '{"stage":"negociation"}' where id = 'devis-c1';
update public.devis set data = data || '{"stage":"gagne"}' where id = 'devis-c1';
reset role;
select set_config('request.jwt.claims', '', false);
select public.generer_commissions_affaire('org-bestasolar', 'lead-c1', 'devis-c1') as creees_au_rappel;
do $$ begin
  assert (select count(*) from public.commissions where data ->> 'devisId' = 'devis-c1') = 2, 'toujours deux commissions, aucune en double';
end $$;
\echo '   ✓ aucune commission en double'

\echo '6. Garde-fous'
-- Un technicien qui passe lui-même son devis à « gagné » ne crée rien.
set role authenticated;
select set_config('request.jwt.claims', :'C', false);
insert into public.devis (org_id, id, data) values ('org-bestasolar', 'devis-c2', jsonb_build_object(
  'id', 'devis-c2', 'leadId', 'lead-c1', 'total', 500000, 'stage', 'gagne', 'createdBy', :'idC'));
-- Une ancienne version de l'application calcule encore côté téléphone :
select set_config('request.jwt.claims', :'G', false);
insert into public.commissions (org_id, id, data) values ('org-bestasolar', 'ancienne-app-1', jsonb_build_object(
  'id', 'ancienne-app-1', 'partnerId', 'p-user-u-gerant', 'devisId', 'devis-c1', 'leadId', 'lead-c1', 'level', 1, 'amount', 30000, 'status', 'en_attente'));
-- Un technicien ne peut pas se créer de commission…
select set_config('request.jwt.claims', :'C', false);
insert into public.commissions (org_id, id, data) values ('org-bestasolar', 'faux-tech-1', jsonb_build_object(
  'id', 'faux-tech-1', 'partnerId', 'p-user-' || :'idC', 'leadId', null, 'level', 1, 'amount', 999999, 'status', 'en_attente'));
-- … ni modifier la sienne.
update public.commissions set data = data || '{"amount": 999999}' where data ->> 'devisId' = 'devis-c1';
-- Le gérant peut toujours ajouter une commission à la main.
select set_config('request.jwt.claims', :'G', false);
insert into public.commissions (org_id, id, data) values ('org-bestasolar', 'manuelle-1', jsonb_build_object(
  'id', 'manuelle-1', 'partnerId', 'p-user-' || :'idD', 'leadId', null, 'level', 1, 'amount', 5000, 'status', 'en_attente', 'source', 'manuel'));
reset role;
select set_config('request.jwt.claims', '', false);
do $$ begin
  assert not exists (select 1 from public.commissions where data ->> 'devisId' = 'devis-c2'), 'devis passé à gagné par un technicien : aucune commission';
  assert (select data ->> 'stage' from public.devis where id = 'devis-c2') = 'nouveau', 'un technicien ne valide pas lui-même : l''étape « gagné » est ignorée';
  assert not exists (select 1 from public.commissions where id in ('ancienne-app-1', 'faux-tech-1')), 'commissions venues de l''application écartées';
  assert exists (select 1 from public.tombstones where id = 'ancienne-app-1' and collection = 'commissions'), 'l''appareil est prié d''oublier la commission écartée';
  assert (select data ->> 'amount' from public.commissions where data ->> 'devisId' = 'devis-c1' and data ->> 'level' = '1') = '30000', 'un technicien ne modifie pas sa commission';
  assert exists (select 1 from public.commissions where id = 'manuelle-1'), 'la commission manuelle du gérant passe';
end $$;
\echo '   ✓ validation réservée au gérant, ancienne application neutralisée'

\echo '7. Boucles et choix du parrain'
do $$ begin
  begin
    perform public.enregistrer_parrainage('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'CICA-CCC333', 'admin');
    raise exception 'la boucle A → C → B → A aurait dû être refusée';
  exception when others then
    assert sqlerrm like 'boucle de parrainage refusée%', 'message attendu pour une boucle, reçu : ' || sqlerrm;
  end;
end $$;
set role authenticated;
select set_config('request.jwt.claims', :'B', false);
do $$ begin
  begin perform public.choisir_mon_parrain('CICA-CCC333'); raise exception 'B a déjà un parrain';
  exception when others then assert sqlerrm like 'code de parrainage déjà attribué%', sqlerrm; end;
  begin perform public.choisir_mon_parrain('BIO-BBB222'); raise exception 'B ne peut pas se parrainer';
  exception when others then assert sqlerrm like 'ce code est le vôtre%', sqlerrm; end;
end $$;
-- D (rattaché par défaut) corrige UNE fois.
select set_config('request.jwt.claims', :'D', false);
select public.choisir_mon_parrain('awa-aaa111');
do $$ begin
  begin perform public.choisir_mon_parrain('BIO-BBB222'); raise exception 'le second choix aurait dû être refusé';
  exception when others then assert sqlerrm like 'code de parrainage déjà attribué%', sqlerrm; end;
end $$;
-- Un client ne peut pas écrire directement un lien de parrainage.
do $$ begin
  begin
    insert into public.parrainages (filleul_id, parrain_partner_id, parrain_code) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'x', 'X');
    raise exception 'écriture directe aurait dû être refusée';
  exception when insufficient_privilege then null; end;
  begin
    perform public.enregistrer_parrainage('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'BIO-BBB222', 'admin');
    raise exception 'fonction interne appelée par un client';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims', '', false);
do $$ begin
  assert (select parrain_code || '/' || source from public.parrainages where filleul_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd') = 'AWA-AAA111/saisie',
    'D a choisi A comme parrain';
end $$;
\echo '   ✓ boucle refusée, parrain définitif, écriture directe impossible'

\echo '8. BUG 4 — clics sur le lien de A'
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select set_config('request.headers', '{"x-forwarded-for":"41.1.1.1, 10.0.0.1","user-agent":"Telephone-1"}', false);
select public.compter_clic_parrainage('AWA-AAA111', 'visiteur-0001') as premier_clic;
select public.compter_clic_parrainage('awa-aaa111', 'visiteur-0001') as meme_visiteur;
select set_config('request.headers', '{"x-forwarded-for":"41.2.2.2","user-agent":"Telephone-1"}', false);
select public.compter_clic_parrainage('AWA-AAA111', 'visiteur-0001') as meme_navigateur_autre_ip;
select set_config('request.headers', '{"x-forwarded-for":"41.1.1.1","user-agent":"Telephone-1"}', false);
select public.compter_clic_parrainage('AWA-AAA111', null) as meme_ip_et_navigateur;
select set_config('request.headers', '{"x-forwarded-for":"41.3.3.3","user-agent":"Telephone-2"}', false);
select public.compter_clic_parrainage('AWA-AAA111', 'visiteur-0002') as autre_visiteur;
select public.compter_clic_parrainage('INCONNU-ZZZ999', 'visiteur-0002') as code_inconnu;
do $$ begin
  begin
    insert into public.clics_parrainage (partenaire_id, code, empreinte) values ('p', 'X', 'e');
    raise exception 'un visiteur ne doit pas écrire de clic directement';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.headers', '', false);
set role authenticated;
select set_config('request.jwt.claims', :'A', false);
do $$ declare s record; begin
  select * into s from public.mes_stats_parrainage();
  assert s.clics = 2, 'A : 2 clics (un visiteur compté une fois sur 24 h), reçu ' || s.clics;
  assert s.inscriptions = 1, 'A : 1 inscription venue du lien (B), reçu ' || s.inscriptions;
  assert s.filleuls = 2, 'A : 2 filleuls (B par le lien, D par saisie du code), reçu ' || s.filleuls;
  assert s.taux_conversion = 0.5, 'A : conversion 1 / 2';
end $$;
select set_config('request.jwt.claims', :'B', false);
do $$ begin assert (select clics from public.mes_stats_parrainage()) = 0, 'B ne voit pas les clics de A'; end $$;
reset role;
select set_config('request.jwt.claims', '', false);
do $$ begin
  assert (select count(*) from public.clics_parrainage where empreinte ~ '^[0-9a-f]{64}$' and user_agent is not null) = 2,
    'IP hachée (jamais en clair), navigateur conservé';
  assert not exists (select 1 from public.clics_parrainage where empreinte like '%41.%'), 'aucune IP en clair';
end $$;
\echo '   ✓ 1 clic par visiteur et par 24 h, conversion calculée'

\echo '9. Abonnement Devis Pro de C : la commission va à SON parrain (B)'
insert into public.subscriptions (org_id, id, data) values ('org-bestasolar', 'sub-c', jsonb_build_object('id', 'sub-c', 'userId', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'status', 'en_attente'));
insert into public."subscriptionPayments" (org_id, id, data) values ('org-bestasolar', 'pay-c', jsonb_build_object('id', 'pay-c', 'subscriptionId', 'sub-c', 'montant', 5000, 'statut', 'initie'));
select set_config('request.jwt.claims', :'G', false);
select public.admin_confirm_subscription_payment('org-bestasolar', 'pay-c');
select set_config('request.jwt.claims', '', false);
do $$ begin
  assert (select data ->> 'partnerId' || '/' || (data ->> 'amount') from public.commissions where data ->> 'paymentId' = 'pay-c') = 'p-user-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/500',
    'commission d''abonnement : 10 % au parrain de la personne (B)';
end $$;
\echo '   ✓ abonnement : parrain de la personne'

\echo '10. Validation par l''administrateur (demande d''étape) : mêmes commissions, une seule fois'
set role authenticated;
select set_config('request.jwt.claims', :'C', false);
insert into public.leads (org_id, id, data) values ('org-bestasolar', 'lead-c2', jsonb_build_object(
  'id', 'lead-c2', 'name', 'Autre client de C', 'registeredByUserId', :'idC', 'stage', 'nouveau', 'estimatedValue', 200000));
insert into public.devis (org_id, id, data) values ('org-bestasolar', 'devis-c3', jsonb_build_object(
  'id', 'devis-c3', 'leadId', 'lead-c2', 'total', 400000, 'stage', 'negociation', 'pendingStage', jsonb_build_object('stage', 'gagne')));
select set_config('request.jwt.claims', :'G', false);
select public.admin_decide_progression('org-bestasolar', 'devis', 'devis-c3', true);
reset role;
select set_config('request.jwt.claims', '', false);
do $$ begin
  assert (select string_agg(data ->> 'level' || ':' || (data ->> 'amount'), ',' order by data ->> 'level') from public.commissions where data ->> 'devisId' = 'devis-c3') = '1:12000,2:6000',
    'demande approuvée : C 12 000 (N1), B 6 000 (N2), une fois chacun';
end $$;
\echo '   ✓ une seule règle, quel que soit le chemin de validation'

\echo '11. Client gagné sans devis, puis son devis gagné : pas de double paiement'
set role authenticated;
select set_config('request.jwt.claims', :'C', false);
insert into public.leads (org_id, id, data) values ('org-bestasolar', 'lead-c3', jsonb_build_object(
  'id', 'lead-c3', 'name', 'Troisième client de C', 'registeredByUserId', :'idC', 'stage', 'nouveau', 'estimatedValue', 600000));
select set_config('request.jwt.claims', :'G', false);
-- Comme l'application : la fiche client (étape de synthèse) part AVANT le devis.
update public.leads set data = data || '{"stage":"gagne"}' where id = 'lead-c3';
reset role;
select set_config('request.jwt.claims', '', false);
do $$ begin
  assert (select string_agg(data ->> 'level' || ':' || (data ->> 'amount'), ',' order by data ->> 'level')
          from public.commissions where data ->> 'leadId' = 'lead-c3' and data ->> 'source' = 'piste') = '1:18000,2:9000',
    'client gagné sans devis : commissions sur la valeur estimée (600 000)';
end $$;
-- Le niveau 1 est payé avant que le devis n'arrive.
update public.commissions set data = data || '{"status":"payée"}' where data ->> 'leadId' = 'lead-c3' and data ->> 'level' = '1';
set role authenticated;
select set_config('request.jwt.claims', :'G', false);
insert into public.devis (org_id, id, data) values ('org-bestasolar', 'devis-c4', jsonb_build_object(
  'id', 'devis-c4', 'leadId', 'lead-c3', 'total', 800000, 'stage', 'gagne', 'createdBy', 'u-gerant'));
-- Une ancienne application renvoie sa commission « client » calculée de son côté.
insert into public.commissions (org_id, id, data) values ('org-bestasolar', 'ancienne-app-2', jsonb_build_object(
  'id', 'ancienne-app-2', 'partnerId', 'p-user-u-gerant', 'leadId', 'lead-c3', 'level', 1, 'amount', 18000, 'status', 'en_attente'));
-- Un technicien ne change pas les taux.
select set_config('request.jwt.claims', :'C', false);
update public.reglages_commissions set taux = 0.5 where niveau = 1;
reset role;
select set_config('request.jwt.claims', '', false);
do $$ begin
  assert (select string_agg(data ->> 'level' || ':' || (data ->> 'amount') || ':' || (data ->> 'status'), ',' order by data ->> 'level')
          from public.commissions where data ->> 'devisId' = 'devis-c4')
         = '1:18000:payée,2:12000:en_attente',
    'devis gagné : le N1 déjà payé est rattaché au devis (jamais payé deux fois) ; le N2 en attente est recalculé sur le devis (1,5 % de 800 000)';
  assert not exists (select 1 from public.commissions where data ->> 'leadId' = 'lead-c3' and coalesce(data ->> 'devisId', '') = ''),
    'plus aucune commission « client » pour ce client';
  assert not exists (select 1 from public.commissions where id = 'ancienne-app-2'), 'la commission « client » d''une ancienne application est écartée';
  assert (select taux from public.reglages_commissions where niveau = 1) = 0.03, 'les taux ne se changent pas depuis un compte technicien';
end $$;
\echo '   ✓ commission client puis devis : aucun double paiement'

\echo '12. RATTRAPAGE des anciennes données'
-- Une affaire validée AVANT la migration, avec l'ancienne règle : le gérant
-- en niveau 1 (deux fois — doublon), personne en niveau 2. Et un compte dont
-- seule la fiche partenaire connaissait le parrain.
set session_replication_role = replica;  -- l'ancien monde : sans les déclencheurs
insert into public.leads (org_id, id, data) values ('org-bestasolar', 'lead-old', jsonb_build_object(
  'id', 'lead-old', 'name', 'Ancien client', 'registeredByUserId', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'stage', 'gagne'));
insert into public.devis (org_id, id, data) values ('org-bestasolar', 'devis-old', jsonb_build_object(
  'id', 'devis-old', 'leadId', 'lead-old', 'devisNumber', 'BS-20260901-0007', 'total', 2000000, 'stage', 'gagne'));
insert into public.commissions (org_id, id, data) values
  ('org-bestasolar', 'old-1', '{"id":"old-1","partnerId":"p-user-u-gerant","devisId":"devis-old","leadId":"lead-old","level":1,"amount":60000,"status":"en_attente"}'),
  ('org-bestasolar', 'old-2', '{"id":"old-2","partnerId":"p-user-u-gerant","devisId":"devis-old","leadId":"lead-old","level":1,"amount":60000,"status":"en_attente"}');
insert into auth.users (id, email) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'e@test.tg');
insert into public.profiles (id, email, name, role, org_id) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'e@test.tg', 'Edem Ekué', 'technicien', 'org-bestasolar');
insert into public.partners (org_id, id, data) values ('org-bestasolar', 'p-user-eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  '{"id":"p-user-eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","userId":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","name":"Edem Ekué","code":"EDEM-EEE555","sponsorId":"p-user-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}');
set session_replication_role = origin;

\echo '   aperçu :'
select etape, objet, detail from public.rattraper_parrainage_commissions(false) order by 1, 2;
do $$ begin
  assert (select count(*) from public.commissions where data ->> 'devisId' = 'devis-old') = 2, 'l''aperçu ne modifie rien';
  assert not exists (select 1 from public.parrainages where filleul_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'), 'l''aperçu ne crée aucun lien';
end $$;
\echo '   application :'
select etape, objet, detail from public.rattraper_parrainage_commissions(true) order by 1, 2;
do $$ begin
  assert (select parrain_partner_id from public.parrainages where filleul_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') = 'p-user-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'lien repris de la fiche partenaire';
  assert (select string_agg(data ->> 'level' || ':' || (data ->> 'partnerId') || ':' || (data ->> 'amount'), ',' order by data ->> 'level')
          from public.commissions where data ->> 'devisId' = 'devis-old')
         = '1:p-user-cccccccc-cccc-4ccc-8ccc-cccccccccccc:60000,2:p-user-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:30000',
    'ancienne affaire : doublon retiré, N1 rendu à C, N2 créé pour B';
  assert exists (select 1 from public.tombstones where id in ('old-1', 'old-2') and collection = 'commissions'), 'le doublon retiré est signalé aux appareils';
end $$;
\echo '   second passage (rien ne doit bouger) :'
select etape, objet, detail from public.rattraper_parrainage_commissions(true)
 where etape not in ('à vérifier');
do $$ begin
  assert not exists (select 1 from public.rattraper_parrainage_commissions(true) where etape <> 'à vérifier'), 'rattrapage idempotent';
end $$;
\echo '   ✓ rattrapage : aperçu sans effet, application, idempotent'

\echo ''
\echo '✅ Scénario parrainage : tous les contrôles passent'
