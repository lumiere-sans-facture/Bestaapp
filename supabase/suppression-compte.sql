-- =====================================================================
--  Suppression de compte par l'utilisateur lui-même
--  Exigée par Google Play et par l'App Store : un compte créé dans l'app
--  doit pouvoir y être supprimé, avec ses données.
--  À exécuter dans SQL Editor APRÈS multitenant.sql, dans les DEUX projets
--  Supabase (test et production). Idempotent : ré-exécutable sans danger.
-- =====================================================================
--
-- Deux cas, selon que le compte travaille seul ou en équipe :
--
--  • SEUL dans son entreprise : l'entreprise disparaît avec lui — clients,
--    devis, factures, kits, abonnement… toutes les tables portant un org_id,
--    y compris celles créées après ce script (elles sont trouvées dans le
--    catalogue de la base, pas dans une liste figée).
--
--  • EN ÉQUIPE : les données de travail appartiennent à l'ENTREPRISE (c'est
--    elle le responsable du traitement) et restent à l'équipe. Seuls partent
--    le compte, son profil et ce qui n'est qu'à lui : son abonnement Pro,
--    ses paiements d'abonnement, l'identité de son entreprise Pro.
--
-- Ce qui est CONSERVÉ, volontairement :
--  • paiements_verifies — journal comptable des paiements encaissés
--    (obligation légale de conservation) ;
--  • codes_promo_utilisations — sinon supprimer puis recréer son compte
--    offrirait un nouvel essai gratuit à l'infini.
--
-- Refus : l'admin plateforme (il administre les autres) ; le gérant d'une
-- équipe (l'équipe perdrait son gérant — le transférer d'abord) ; le dernier
-- membre de l'organisation INTERNE BestaSolar (son catalogue est partagé
-- avec toutes les entreprises).

create or replace function public.supprimer_mon_compte()
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email   text := lower(auth.jwt() ->> 'email');
  v_profil  record;
  v_membres integer;
  v_table   text;
begin
  if coalesce(v_email, '') = '' then
    return jsonb_build_object('ok', false, 'raison', 'session');
  end if;
  select id, org_id, role, coalesce(is_platform_admin, false) as admin
    into v_profil from public.profiles where lower(email) = v_email;

  -- Sans profil (inscription jamais terminée) : seul le compte d'accès existe.
  if v_profil.id is null then
    delete from auth.users where lower(email) = v_email;
    return jsonb_build_object('ok', true, 'portee', 'compte');
  end if;

  if v_profil.admin then
    return jsonb_build_object('ok', false, 'raison', 'admin');
  end if;

  select count(*) into v_membres from public.profiles
    where org_id = v_profil.org_id and id <> v_profil.id;

  if v_membres > 0 and v_profil.role = 'gerant' then
    return jsonb_build_object('ok', false, 'raison', 'gerant');
  end if;

  if v_membres = 0 then
    if public.org_est_interne(v_profil.org_id) then
      return jsonb_build_object('ok', false, 'raison', 'interne');
    end if;
    -- Toutes les tables de données de l'entreprise, sauf les journaux
    -- conservés (voir en tête) et les deux tables d'identité, traitées après.
    for v_table in
      select c.table_name from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public' and c.column_name = 'org_id'
        and t.table_type = 'BASE TABLE'
        and c.table_name not in ('profiles', 'orgs', 'paiements_verifies', 'codes_promo_utilisations')
    loop
      execute format('delete from public.%I where org_id = $1', v_table) using v_profil.org_id;
    end loop;
    delete from public.profiles where id = v_profil.id;
    update public.orgs set merged_into = null where merged_into = v_profil.org_id;
    delete from public.orgs where id = v_profil.org_id;
    delete from auth.users where lower(email) = v_email;
    return jsonb_build_object('ok', true, 'portee', 'entreprise');
  end if;

  -- En équipe : uniquement ce qui est personnel.
  delete from public.subscriptions
    where org_id = v_profil.org_id and data ->> 'userId' = v_profil.id;
  delete from public."subscriptionPayments"
    where org_id = v_profil.org_id and data ->> 'userId' = v_profil.id;
  delete from public.companies
    where org_id = v_profil.org_id and data ->> 'userId' = v_profil.id;
  delete from public.profiles where id = v_profil.id;
  delete from auth.users where lower(email) = v_email;
  return jsonb_build_object('ok', true, 'portee', 'compte');
end $$;

revoke all on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;

-- L'API (PostgREST) relit la liste des fonctions : sinon l'app peut ne pas
-- les trouver pendant quelques minutes (« … in the schema cache »).
notify pgrst, 'reload schema';
