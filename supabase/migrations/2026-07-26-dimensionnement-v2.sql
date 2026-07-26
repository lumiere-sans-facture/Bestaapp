-- =====================================================================
-- Migration : dimensionnement v2 (moteur méthodologique corrigé)
-- Version    : 2026-07-26
-- Idempotente : réexécutable sans effet de bord.
-- =====================================================================
--
-- ARCHITECTURE — À LIRE AVANT D'EXÉCUTER
--
-- BestaSolar Pro est local-first : localStorage est la source de vérité,
-- Supabase n'est qu'une réplication optionnelle. Chaque collection est
-- répliquée dans une table au format uniforme :
--
--     (id text primary key, data jsonb not null, updated_at timestamptz)
--
-- Il n'existe donc PAS de tables relationnelles `panneaux`, `onduleurs`,
-- `batteries` ni `dimensionnements` : le matériel vit dans la collection
-- `products` (data->>'category' = 'panneaux' | 'onduleurs' | 'batteries'),
-- et les dimensionnements sont imbriqués dans `devis` (data->'sizing').
--
-- Cette migration respecte ce modèle :
--   • les caractéristiques électriques deviennent des clés de
--     products.data.specs (aucune colonne à ajouter) ;
--   • le référentiel d'irradiation devient une nouvelle collection
--     `irradiationSites`, au format standard ;
--   • moteur_version / entrees / resultats sont des clés de devis.data.sizing
--     (déjà du jsonb : aucune migration de colonne nécessaire).
--
-- Les requêtes de contrôle en fin de fichier donnent la liste exacte des
-- champs restant à renseigner à la main depuis les fiches constructeur.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Nouvelle collection : référentiel d'irradiation par site
-- ---------------------------------------------------------------------
-- data = {
--   nom, latitude, longitude, inclinaison, azimut,
--   productibleMensuel: number[12],   -- kWh/kWc/jour, PVGIS (janvier → décembre)
--   source, dateExtraction
-- }
create table if not exists public."irradiationSites" (
  id         text        primary key,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);

alter table public."irradiationSites" enable row level security;
drop policy if exists "team full access" on public."irradiationSites";
create policy "team full access" on public."irradiationSites"
  for all to authenticated using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table public."irradiationSites";
exception when duplicate_object then null;
end $$;

-- Trois sites à compléter. productibleMensuel volontairement à null :
-- à renseigner depuis PVGIS (voir mode opératoire en fin de fichier).
-- Aucune valeur inventée — un tableau incomplet fait basculer le moteur en
-- méthode dégradée « moyenne », qu'il signale explicitement.
insert into public."irradiationSites" (id, data) values
  ('site-cotonou', jsonb_build_object(
     'nom', 'Cotonou', 'latitude', 6.3703, 'longitude', 2.3912,
     'inclinaison', null, 'azimut', 0,
     'productibleMensuel', null, 'source', null, 'dateExtraction', null)),
  ('site-parakou', jsonb_build_object(
     'nom', 'Parakou', 'latitude', 9.3372, 'longitude', 2.6303,
     'inclinaison', null, 'azimut', 0,
     'productibleMensuel', null, 'source', null, 'dateExtraction', null)),
  ('site-save',    jsonb_build_object(
     'nom', 'Savè', 'latitude', 8.0342, 'longitude', 2.4864,
     'inclinaison', null, 'azimut', 0,
     'productibleMensuel', null, 'source', null, 'dateExtraction', null))
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. Caractéristiques électriques du matériel (products.data.specs)
-- ---------------------------------------------------------------------
-- Ajout de la structure `specs` avec les clés attendues par le moteur v2,
-- à NULL. Les valeurs par défaut normatives (coefficients de température,
-- DoD, rendement, C-rate) sont posées car elles ne dépendent pas du modèle.
-- Les grandeurs propres à chaque référence (Voc, Vmp, Isc, Imp, puissances,
-- tensions MPPT, courants) restent NULL : à saisir depuis les fiches
-- constructeur — ne jamais les deviner.

-- 2a. Panneaux
update public.products
set data = jsonb_set(
      data,
      '{specs}',
      coalesce(data->'specs', '{}'::jsonb) || jsonb_build_object(
        'voc',       coalesce(data->'specs'->'voc',       'null'::jsonb),
        'vmp',       coalesce(data->'specs'->'vmp',       'null'::jsonb),
        'isc',       coalesce(data->'specs'->'isc',       'null'::jsonb),
        'imp',       coalesce(data->'specs'->'imp',       'null'::jsonb),
        'puissanceWc', coalesce(data->'specs'->'puissanceWc', 'null'::jsonb),
        -- Coefficients de température : valeurs normatives usuelles (%/°C),
        -- à affiner par référence si la fiche constructeur diffère.
        'coeffVoc',  coalesce(data->'specs'->'coeffVoc',  to_jsonb(-0.27)),
        'coeffVmp',  coalesce(data->'specs'->'coeffVmp',  to_jsonb(-0.35))
      ),
      true
    ),
    updated_at = now()
where data->>'category' = 'panneaux';

-- 2b. Onduleurs
-- ⚠️ puissanceW = kVA × 1000 (facteur de puissance 1 sur les hybrides
-- Deye / Growatt / Felicity). NE JAMAIS réintroduire 6 kVA = 4800 W.
update public.products
set data = jsonb_set(
      data,
      '{specs}',
      coalesce(data->'specs', '{}'::jsonb) || jsonb_build_object(
        'puissanceW',      coalesce(data->'specs'->'puissanceW',      'null'::jsonb),
        'surgeW',          coalesce(data->'specs'->'surgeW',          'null'::jsonb),
        'pvMaxWc',         coalesce(data->'specs'->'pvMaxWc',         'null'::jsonb),
        'vDcMax',          coalesce(data->'specs'->'vDcMax',          'null'::jsonb),
        'vMpptMin',        coalesce(data->'specs'->'vMpptMin',        'null'::jsonb),
        'iMppt',           coalesce(data->'specs'->'iMppt',           'null'::jsonb),
        'iChargeMax',      coalesce(data->'specs'->'iChargeMax',      'null'::jsonb),
        'tensionBatterie', coalesce(data->'specs'->'tensionBatterie', 'null'::jsonb)
      ),
      true
    ),
    updated_at = now()
where data->>'category' = 'onduleurs';

-- 2c. Batteries
update public.products
set data = jsonb_set(
      data,
      '{specs}',
      coalesce(data->'specs', '{}'::jsonb) || jsonb_build_object(
        'capaciteAh',      coalesce(data->'specs'->'capaciteAh',  'null'::jsonb),
        'capaciteKwh',     coalesce(data->'specs'->'capaciteKwh', 'null'::jsonb),
        'tension',         coalesce(data->'specs'->'tension',     'null'::jsonb),
        -- Valeurs normatives LiFePO4, surchargeables par référence.
        'dod',             coalesce(data->'specs'->'dod',             to_jsonb(0.80)),
        'rendement',       coalesce(data->'specs'->'rendement',       to_jsonb(0.95)),
        'cRateChargeMax',  coalesce(data->'specs'->'cRateChargeMax',  to_jsonb(0.5))
      ),
      true
    ),
    updated_at = now()
where data->>'category' = 'batteries';

-- ---------------------------------------------------------------------
-- 3. Dimensionnements : version de moteur
-- ---------------------------------------------------------------------
-- devis.data.sizing est déjà du jsonb : `moteurVersion` est une simple clé.
-- Tous les dimensionnements existants sont marqués 'v1' pour rester affichés
-- avec l'ancienne logique, en lecture seule (bandeau « ancienne
-- méthodologie » dans l'application). Les clés `entrees` et `resultats`
-- seront écrites par le moteur v2 à la création des nouveaux devis.
update public.devis
set data = jsonb_set(data, '{sizing,moteurVersion}', to_jsonb('v1'::text), true),
    updated_at = now()
where data ? 'sizing'
  and data->'sizing' is not null
  and jsonb_typeof(data->'sizing') = 'object'
  and not (data->'sizing' ? 'moteurVersion');

-- ---------------------------------------------------------------------
-- 4. Contrôles — champs restant à renseigner manuellement
-- ---------------------------------------------------------------------
-- Exécuter ces requêtes après la migration : elles listent exactement ce
-- qui reste à saisir depuis les fiches constructeur.

-- 4a. Sites d'irradiation sans productible mensuel PVGIS
--     Mode opératoire PVGIS :
--       1. https://re.jrc.ec.europa.eu/pvg_tools/fr/
--       2. Saisir les coordonnées du site, « Performance PV connectée au réseau »
--       3. Puissance crête 1 kWc, pertes système 14 %, angles optimisés
--       4. Relever E_m (kWh/mois) pour les 12 mois
--       5. productibleMensuel[i] = E_m[i] / nombre de jours du mois
--          (kWh/kWc/jour), de janvier (indice 0) à décembre (indice 11)
--
-- select id, data->>'nom' as site
-- from public."irradiationSites"
-- where data->'productibleMensuel' is null
--    or jsonb_typeof(data->'productibleMensuel') <> 'array'
--    or jsonb_array_length(data->'productibleMensuel') <> 12;

-- 4b. Matériel dont les caractéristiques électriques manquent
-- select data->>'category' as categorie, id, data->>'name' as designation,
--        (select string_agg(k, ', ' order by k)
--           from jsonb_each(data->'specs') as s(k, v)
--          where v = 'null'::jsonb) as champs_a_renseigner
-- from public.products
-- where data->>'category' in ('panneaux','onduleurs','batteries')
--   and exists (select 1 from jsonb_each(data->'specs') as s(k,v) where v = 'null'::jsonb)
-- order by 1, 3;

-- 4c. Répartition des dimensionnements par version de moteur
-- select coalesce(data->'sizing'->>'moteurVersion', 'sans sizing') as moteur, count(*)
-- from public.devis group by 1 order by 2 desc;
