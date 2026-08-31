-- ============================================================
-- Réunir deux comptes GÉRANTS dans la même entreprise
-- À exécuter après multitenant.sql, dans chaque projet Supabase.
-- Rejouable : crée uniquement la colonne et la fonction manquantes.
-- ============================================================
--
-- Un gérant peut avoir créé son compte avant de rejoindre l'équipe d'un
-- autre gérant. Ces deux comptes ont alors deux org_id distincts : la RLS les
-- isole exactement comme deux entreprises différentes.
--
-- Parcours :
-- 1. le gérant de l'espace principal ouvre Plus → Équipe et partage son
--    code de réunion ;
-- 2. le gérant du compte isolé saisit ce code dans la même section ;
-- 3. ses données opérationnelles sont déplacées, son rôle « gerant » reste
--    inchangé, puis il se reconnecte.
--
-- Garde-fous :
-- - seul un gérant connecté peut lancer l'opération ;
-- - son ancienne entreprise ne doit contenir que son propre profil ;
-- - aucun identifiant existant dans l'espace cible n'est écrasé : s'il y a
--   un conflit, toute l'opération est annulée avant le moindre déplacement ;
-- - abonnements, paiements d'abonnement et réglages de paiement ne sont pas
--   transférés : ils restent une décision administrative explicite.

alter table public.orgs add column if not exists manager_join_code text;
create unique index if not exists orgs_manager_join_code_unique
  on public.orgs (manager_join_code)
  where manager_join_code is not null;

alter table public.orgs alter column manager_join_code
  set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

update public.orgs
   set manager_join_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
 where manager_join_code is null;

alter table public.orgs alter column manager_join_code set not null;

drop function if exists public.reunir_mon_compte_gerant(text);
create or replace function public.reunir_mon_compte_gerant(p_code_reunion text)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_email text;
  v_role text;
  v_source text;
  v_cible text;
  v_nom_cible text;
  v_nombre_membres integer;
  v_table text;
  v_conflits bigint;
  v_deplaces bigint;
  v_bilan jsonb := '{}'::jsonb;
  v_conflits_bilan jsonb := '{}'::jsonb;
  tables_operationnelles text[] := array[
    'products', 'kits', 'inverters', 'pompeKits',
    'leads', 'partners', 'commissions', 'devis', 'referrals', 'orders',
    'formations', 'formationProgress', 'companies',
    'factures', 'proClients', 'payoutRequests'
  ];
begin
  v_email := lower(auth.jwt() ->> 'email');
  if v_email is null then
    raise exception 'Non authentifié.';
  end if;

  select role, org_id into v_role, v_source
    from public.profiles
   where lower(email) = v_email;

  if v_source is null then
    raise exception 'Profil introuvable.';
  end if;
  if v_role <> 'gerant' then
    raise exception 'Seul un gérant peut réunir un compte.';
  end if;

  select id, name into v_cible, v_nom_cible
    from public.orgs
   where manager_join_code = upper(regexp_replace(coalesce(p_code_reunion, ''), '[^A-Za-z0-9]', '', 'g'));

  if v_cible is null then
    raise exception 'Code de réunion invalide.';
  end if;
  if v_cible = v_source then
    raise exception 'Ces deux comptes appartiennent déjà au même espace.';
  end if;

  select count(*) into v_nombre_membres
    from public.profiles
   where org_id = v_source;

  if v_nombre_membres <> 1 then
    raise exception 'Ce compte ne peut pas être réuni seul : son ancienne entreprise contient % membre(s). Utilisez le script administrateur rattacher-membre.sql pour préserver toute l''équipe.', v_nombre_membres;
  end if;

  -- Pré-vol : aucun déplacement si une donnée porterait déjà le même
  -- identifiant dans l'espace cible. Le compte reste intact afin qu'un admin
  -- puisse résoudre le cas sans perte ni écrasement.
  foreach v_table in array tables_operationnelles loop
    if to_regclass(format('public.%I', v_table)) is null then
      continue;
    end if;
    execute format(
      'select count(*) from public.%1$I source
        where source.org_id = $1
          and exists (
            select 1 from public.%1$I cible
             where cible.org_id = $2 and cible.id = source.id
          )',
      v_table
    ) into v_conflits using v_source, v_cible;
    if v_conflits > 0 then
      v_conflits_bilan := v_conflits_bilan || jsonb_build_object(v_table, v_conflits);
    end if;
  end loop;

  -- Le code partenaire est unique sur toute la plateforme : ce conflit ne se
  -- voit pas dans la clé (org_id, id), il est donc contrôlé explicitement.
  if to_regclass('public.partners') is not null then
    select count(*) into v_conflits
      from public.partners source
     where source.org_id = v_source
       and coalesce(source.data ->> 'code', '') <> ''
       and exists (
         select 1 from public.partners cible
          where cible.org_id = v_cible
            and upper(coalesce(cible.data ->> 'code', '')) =
                upper(source.data ->> 'code')
       );
    if v_conflits > 0 then
      v_conflits_bilan := v_conflits_bilan || jsonb_build_object('codes_partenaires', v_conflits);
    end if;
  end if;

  if v_conflits_bilan <> '{}'::jsonb then
    raise exception 'Réunion annulée : des données existent déjà avec les mêmes identifiants dans l''espace cible (%). Aucun changement n''a été fait ; utilisez rattacher-membre.sql avec un administrateur.', v_conflits_bilan::text;
  end if;

  foreach v_table in array tables_operationnelles loop
    if to_regclass(format('public.%I', v_table)) is null then
      continue;
    end if;
    execute format(
      'update public.%1$I set org_id = $1 where org_id = $2',
      v_table
    ) using v_cible, v_source;
    get diagnostics v_deplaces = row_count;
    if v_deplaces > 0 then
      v_bilan := v_bilan || jsonb_build_object(v_table, v_deplaces);
    end if;
  end loop;

  -- Le rôle reste strictement celui déjà vérifié (« gerant »).
  update public.profiles
     set org_id = v_cible
   where lower(email) = v_email;

  return jsonb_build_object(
    'status', 'merged',
    'organization_id', v_cible,
    'organization_name', v_nom_cible,
    'moved', v_bilan
  );
end;
$$;

revoke all on function public.reunir_mon_compte_gerant(text) from public;
grant execute on function public.reunir_mon_compte_gerant(text) to authenticated;
