-- =====================================================================
--  ANNULATION de migrations/20261013_parrainage_commissions.sql
--  Remet le fonctionnement d'avant : commissions calculées par l'application,
--  parrain porté par l'organisation, règle « org isolation » sur les
--  commissions, et les quatre fonctions existantes dans leur version
--  précédente (reprises telles quelles de multitenant.sql).
--
--  Les DONNÉES sont conservées : tables parrainages, clics_parrainage,
--  reglages_commissions et sel_clics restent en place (simplement plus
--  utilisées). Rejouer la migration les reprend telles quelles. Pour les
--  supprimer aussi, voir la dernière section, en commentaire.
--
--  OÙ : Supabase › SQL Editor › coller TOUT ce fichier › Run.
-- =====================================================================
begin;

drop trigger if exists devis_commissions_auto on public.devis;
drop trigger if exists leads_commissions_auto on public.leads;
drop trigger if exists devis_etape_gagnee on public.devis;
drop trigger if exists leads_etape_gagnee on public.leads;
drop trigger if exists commissions_garde on public.commissions;
drop trigger if exists partners_parrain_serveur on public.partners;
drop trigger if exists parrainages_controle on public.parrainages;

drop index if exists public.commissions_devis_niveau_unique;
drop index if exists public.commissions_piste_niveau_unique;
drop index if exists public.idx_commissions_devis;
drop index if exists public.idx_commissions_lead;

drop policy if exists "commissions lecture" on public.commissions;
drop policy if exists "commissions ajout" on public.commissions;
drop policy if exists "commissions modification" on public.commissions;
drop policy if exists "commissions suppression" on public.commissions;
drop policy if exists "org isolation" on public.commissions;
create policy "org isolation" on public.commissions for all to authenticated
  using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());

-- Tables conservées, mais fermées : plus aucune lecture depuis l'application.
drop policy if exists "parrainages lecture" on public.parrainages;
drop policy if exists "clics lecture" on public.clics_parrainage;
drop policy if exists "reglages lecture" on public.reglages_commissions;
drop policy if exists "reglages admin" on public.reglages_commissions;

drop function if exists public.rattraper_parrainage_commissions(boolean);
drop function if exists public.rapprocher_affaire(text, text, text);
drop function if exists public.devis_commissions_auto();
drop function if exists public.leads_commissions_auto();
drop function if exists public.etape_gagnee_par_gerant();
drop function if exists public.validation_par_gerant();
drop function if exists public.commissions_garde();
drop function if exists public.generer_commissions_affaire(text, text, text);
drop function if exists public.commission_engagee(text, text);
drop function if exists public.proprietaire_affaire(jsonb, jsonb);
drop function if exists public.beneficiaires_commission(text);
drop function if exists public.mes_stats_parrainage();
drop function if exists public.compter_clic_parrainage_serveur(text, text, text, text);
drop function if exists public.compter_clic_parrainage(text, text);
drop function if exists public.noter_clic_parrainage(text, text, text, text);
drop function if exists public.mes_filleuls();
drop function if exists public.mon_parrain();
drop function if exists public.admin_definir_parrain(text, text);
drop function if exists public.choisir_mon_parrain(text);
drop function if exists public.enregistrer_parrainage(text, text, text);
drop function if exists public.partners_parrain_serveur();
drop function if exists public.parrainages_controle();
drop function if exists public.auth_mes_partenaires();
drop function if exists public.partenaire_du_code(text);
drop function if exists public.profil_du_partenaire(text);
drop function if exists public.partenaire_du_profil(text);
drop function if exists public.profondeur_commissions();
drop function if exists public.taux_commission(integer);
drop function if exists public.montant_json(text);

-- Versions précédentes des fonctions existantes.
drop function if exists public.signup_create_org(text, text);
drop function if exists public.signup_create_org(text, text, text);
create or replace function public.signup_create_org(
  p_org_name text,
  p_user_name text,
  p_ref_code text default null,
  p_phone text default ''
)
  returns text language plpgsql security definer set search_path = public as $$
declare v_org text; v_email text; v_ref text; v_rid text; v_par_defaut boolean;
begin
  v_email := auth.jwt() ->> 'email';
  if v_email is null then raise exception 'non authentifié'; end if;
  if exists (select 1 from public.profiles where lower(email) = lower(v_email)) then
    raise exception 'profil déjà existant pour cet email';
  end if;
  select id into v_org from public.orgs
   where kind = 'interne' and merged_into is null and plan <> 'suspended'
   order by created_at asc limit 1;
  if v_org is null then raise exception 'organisation Besta introuvable'; end if;
  v_ref := public.code_partenaire(p_ref_code);
  v_par_defaut := v_ref is null;
  if v_par_defaut then v_ref := public.code_partenaire_defaut(); end if;
  insert into public.profiles (id, email, name, role, org_id, phone)
    values (auth.uid()::text, v_email, p_user_name, 'technicien', v_org, coalesce(trim(p_phone), ''));
  if v_ref is not null then
    v_rid := gen_random_uuid()::text;
    insert into public.referrals (org_id, id, data, updated_at)
    select v_org, v_rid, jsonb_build_object(
        'id', v_rid,
        'partnerCode', pt.data->>'code',
        'type', 'inscription',
        'status', 'validé',
        'amount', null,
        'leadId', null,
        'filleulOrg', v_org,
        'filleulName', p_user_name,
        'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ), now()
    from public.partners pt
    where pt.org_id = v_org
      and public.code_partenaire(pt.data->>'code') = v_ref
    order by pt.updated_at asc
    limit 1;
  end if;
  return v_org;
end $$;

create or replace function public.set_org_referral(p_code text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_org text; v_role text; v_existing text; v_code text; v_defaut boolean;
begin
  select org_id, role into v_org, v_role
    from public.profiles where lower(email) = lower(auth.jwt() ->> 'email');
  if v_org is null then raise exception 'non authentifié'; end if;
  -- Autorisé : le gérant, OU l'utilisateur d'un espace SANS gérant (compte
  -- classique seul dans son espace — il en est le propriétaire de fait).
  if v_role <> 'gerant' and exists (
    select 1 from public.profiles where org_id = v_org and role = 'gerant'
  ) then
    raise exception 'seul le gérant de l''entreprise peut attribuer le code de parrainage';
  end if;
  v_code := public.code_partenaire(p_code);
  if v_code is null then raise exception 'code de parrainage vide'; end if;

  -- Le code doit EXISTER. Sans ce contrôle, une faute de frappe rattachait
  -- l'entreprise à un parrain fantôme : elle sortait du réseau sans que
  -- personne ne s'en aperçoive, et le choix était définitif.
  if not exists (
    select 1 from public.partners pt
    where public.code_partenaire(pt.data ->> 'code') = v_code
  ) then
    raise exception 'code de parrainage inconnu (%) — vérifiez auprès de votre partenaire', v_code;
  end if;

  -- Et il doit désigner quelqu'un d'AUTRE : se parrainer soi-même fermerait
  -- une boucle dans l'arbre d'affiliation.
  if exists (
    select 1 from public.partners pt
    where pt.org_id = v_org and public.code_partenaire(pt.data ->> 'code') = v_code
  ) then
    raise exception 'ce code est l''un des vôtres — indiquez celui du partenaire qui vous a recommandé';
  end if;

  select referred_by, referral_par_defaut into v_existing, v_defaut
    from public.orgs where id = v_org;
  -- Un rattachement PAR DÉFAUT (BestaSolar, faute de code à l'inscription)
  -- se corrige une fois. Un code réellement choisi, jamais.
  if v_existing is not null and not coalesce(v_defaut, false) then
    raise exception 'code de parrainage déjà attribué (%) — contactez BestaSolar pour le modifier', v_existing;
  end if;
  update public.orgs
     set referred_by = v_code, referral_par_defaut = false
   where id = v_org;
end $$;

create or replace function public.admin_decide_progression(
  p_org_id text, p_kind text, p_id text, p_approuver boolean)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_data jsonb; v_stage text; v_now timestamptz := now();
  v_jour text; v_lead_id text; v_total numeric; v_l1 text; v_l2 text;
  v_partner_org text; v_cid text;
  v_lead_name text; v_code text; v_p1 text; v_p2 text;
  v_l1_name text; v_l2_code text; v_rid text;
begin
  if not public.auth_is_platform_admin() then
    raise exception 'réservé à l''admin plateforme';
  end if;
  v_jour := to_char(v_now at time zone 'utc', 'YYYY-MM-DD');

  if p_kind = 'lead' then
    select data into v_data from public.leads where org_id = p_org_id and id = p_id;
    if v_data is null then raise exception 'client introuvable'; end if;
    v_stage := v_data -> 'pendingStage' ->> 'stage';
    if v_stage is null then raise exception 'aucune demande en attente'; end if;
    if not p_approuver then
      update public.leads set data = data - 'pendingStage', updated_at = v_now
        where org_id = p_org_id and id = p_id;
      return;
    end if;
    update public.leads
      set data = (data - 'pendingStage')
        || jsonb_build_object('stage', v_stage, 'lastActivity', v_jour)
        || case when v_stage = 'gagne' then jsonb_build_object('wonAt', v_jour) else '{}'::jsonb end
        || case when v_stage = 'perdu' then jsonb_build_object('lostAt', v_jour) else '{}'::jsonb end,
          updated_at = v_now
      where org_id = p_org_id and id = p_id;
    v_lead_id := p_id;
    v_lead_name := v_data ->> 'name';
    v_total := coalesce(nullif(v_data ->> 'estimatedValue', '')::numeric, 0);
    v_l1 := nullif(v_data ->> 'parrainL1', '');
    v_l2 := nullif(v_data ->> 'parrainL2', '');

  elsif p_kind = 'devis' then
    select data into v_data from public.devis where org_id = p_org_id and id = p_id;
    if v_data is null then raise exception 'devis introuvable'; end if;
    v_stage := v_data -> 'pendingStage' ->> 'stage';
    if v_stage is null then raise exception 'aucune demande en attente'; end if;
    if not p_approuver then
      update public.devis set data = data - 'pendingStage', updated_at = v_now
        where org_id = p_org_id and id = p_id;
      return;
    end if;
    update public.devis
      set data = (data - 'pendingStage') || jsonb_build_object('stage', v_stage)
        || case when v_stage = 'gagne' then jsonb_build_object('wonAt', v_jour) else '{}'::jsonb end
        || case when v_stage = 'perdu' then jsonb_build_object('lostAt', v_jour) else '{}'::jsonb end,
          updated_at = v_now
      where org_id = p_org_id and id = p_id;
    v_lead_id := v_data ->> 'leadId';
    v_total := coalesce(nullif(v_data ->> 'total', '')::numeric, 0);
    v_l1 := nullif(v_data ->> 'partnerId', '');
    -- Le parrain de la piste prime sur l'apporteur du devis. On passe par des
    -- variables temporaires : un SELECT INTO sans ligne met ses cibles à NULL
    -- et effacerait l'apporteur du devis quand la piste manque.
    select nullif(l.data ->> 'parrainL1', ''), nullif(l.data ->> 'parrainL2', ''), l.data ->> 'name'
      into v_p1, v_p2, v_lead_name
      from public.leads l where l.org_id = p_org_id and l.id = v_lead_id;
    v_l1 := coalesce(v_p1, v_l1);
    v_l2 := v_p2;
  else
    raise exception 'type inconnu : %', p_kind;
  end if;

  -- NIVEAU 2 — le parrain de l'apporteur. Trois sources, dans cet ordre :
  --   1. le parrain figé sur la piste (`parrainL2`) ;
  --   2. le `sponsorId` du profil partenaire de l'apporteur (même organisation) ;
  --   3. un CODE de parrainage : celui du profil (`sponsorCode`), sinon celui
  --      de l'ORGANISATION (`orgs.referred_by`, posé à l'inscription).
  -- Le cas 3 est le plus courant et c'est lui qui manquait : un commercial qui
  -- s'inscrit avec un code n'a AUCUN profil partenaire de son parrain dans sa
  -- propre organisation — aucun `sponsorId` local ne peut donc le désigner, et
  -- le niveau 2 n'était jamais attribué. On résout alors le code sur toute la
  -- plateforme, l'organisation courante d'abord.
  if v_l1 is not null and v_l2 is null then
    select nullif(trim(pt.data ->> 'sponsorId'), ''),
           public.code_partenaire(pt.data ->> 'sponsorCode')
      into v_l2, v_code
      from public.partners pt where pt.org_id = p_org_id and pt.id = v_l1;
    if v_l2 is null then
      if v_code is null then
        select public.code_partenaire(o.referred_by) into v_code
          from public.orgs o where o.id = p_org_id;
      end if;
      if v_code is not null then
        select pt.id into v_l2 from public.partners pt
          where public.code_partenaire(pt.data ->> 'code') = v_code
          order by (pt.org_id = p_org_id) desc, pt.updated_at asc limit 1;
      end if;
    end if;
  end if;
  if v_l2 is not null and v_l2 = v_l1 then v_l2 := null; end if;

  -- Commission de l'apporteur, créée dans l'organisation où vit son profil.
  if v_stage = 'gagne' and v_total > 0 and v_l1 is not null then
    select org_id into v_partner_org from public.partners
      where id = v_l1 order by (org_id = p_org_id) desc limit 1;
    if v_partner_org is not null and not exists (
      select 1 from public.commissions c
      where c.org_id = v_partner_org
        and coalesce(c.data ->> 'devisId', '') = case when p_kind = 'devis' then p_id else '' end
        and c.data ->> 'partnerId' = v_l1
        and (c.data ->> 'level')::int = 1
        and coalesce(c.data ->> 'leadId', '') = coalesce(v_lead_id, '')
    ) then
      v_cid := gen_random_uuid()::text;
      insert into public.commissions (org_id, id, data, updated_at)
      values (v_partner_org, v_cid, jsonb_build_object(
        'id', v_cid, 'partnerId', v_l1, 'leadId', v_lead_id,
        -- Le client vit dans l'organisation de l'affaire : son nom est copié
        -- ici, sinon un parrain d'une AUTRE organisation ne saurait pas à quoi
        -- se rapporte sa commission.
        'leadName', v_lead_name, 'leadOrg', p_org_id,
        'devisId', case when p_kind = 'devis' then p_id else null end,
        'level', 1, 'amount', round(v_total * 0.03),
        'status', 'en_attente', 'paidAt', null, 'createdAt', v_jour
      ), v_now);
    end if;
    -- Niveau 2 : le parrain de l'apporteur.
    if v_l2 is not null and v_l2 <> v_l1 then
      select org_id into v_partner_org from public.partners
        where id = v_l2 order by (org_id = p_org_id) desc limit 1;
      if v_partner_org is not null and not exists (
        select 1 from public.commissions c
        where c.org_id = v_partner_org
          and coalesce(c.data ->> 'devisId', '') = case when p_kind = 'devis' then p_id else '' end
          and c.data ->> 'partnerId' = v_l2
          and (c.data ->> 'level')::int = 2
      ) then
        v_cid := gen_random_uuid()::text;
        insert into public.commissions (org_id, id, data, updated_at)
        values (v_partner_org, v_cid, jsonb_build_object(
          'id', v_cid, 'partnerId', v_l2, 'leadId', v_lead_id,
          'leadName', v_lead_name, 'leadOrg', p_org_id,
          'devisId', case when p_kind = 'devis' then p_id else null end,
          'level', 2, 'amount', round(v_total * 0.015),
          'status', 'en_attente', 'paidAt', null, 'createdAt', v_jour
        ), v_now);

        -- TRACE DE PARRAINAGE chez le parrain : sans elle, il touche une
        -- commission de niveau 2 sans que rien n'apparaisse dans « Historique
        -- de mes parrainages » — l'affaire de son filleul vit dans une autre
        -- organisation, invisible depuis la sienne.
        select pt.data ->> 'name' into v_l1_name from public.partners pt
          where pt.org_id = p_org_id and pt.id = v_l1;
        select pt.data ->> 'code' into v_l2_code from public.partners pt
          where pt.org_id = v_partner_org and pt.id = v_l2;
        v_rid := gen_random_uuid()::text;
        insert into public.referrals (org_id, id, data, updated_at)
        values (v_partner_org, v_rid, jsonb_build_object(
          'id', v_rid, 'partnerCode', v_l2_code, 'type', 'affaire',
          'status', 'validé', 'amount', round(v_total * 0.015),
          'leadId', null, 'leadName', v_lead_name, 'filleulName', v_l1_name,
          'affaireOrg', p_org_id, 'affaireId', p_id,
          'createdAt', to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        ), v_now);
      end if;
    end if;
  end if;
end $$;

create or replace function public.admin_confirm_subscription_payment(p_org_id text, p_payment_id text)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_pay jsonb; v_sub_id text; v_montant numeric; v_now timestamptz := now();
  v_base timestamptz; v_ref text; v_partner_org text; v_partner_id text;
  v_cid text; v_iso text; v_fin text;
begin
  if not public.auth_is_platform_admin() then
    raise exception 'réservé à l''admin plateforme';
  end if;
  select data into v_pay from public."subscriptionPayments"
    where org_id = p_org_id and id = p_payment_id;
  if v_pay is null then raise exception 'paiement introuvable'; end if;
  if coalesce(v_pay ->> 'statut', '') <> 'initie' then
    raise exception 'paiement déjà traité (statut « % »)', v_pay ->> 'statut';
  end if;
  v_sub_id  := v_pay ->> 'subscriptionId';
  v_montant := coalesce(nullif(v_pay ->> 'montant', '')::numeric, 5000);
  v_iso := to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  update public."subscriptionPayments"
    set data = data || jsonb_build_object('statut', 'confirme'), updated_at = v_now
    where org_id = p_org_id and id = p_payment_id;

  -- +30 jours depuis maintenant, ou depuis la fin actuelle si elle court encore.
  select greatest(v_now, coalesce(nullif(data ->> 'dateFin', '')::timestamptz, v_now))
    into v_base
    from public.subscriptions where org_id = p_org_id and id = v_sub_id;
  if v_base is null then raise exception 'abonnement introuvable (%)', v_sub_id; end if;
  v_fin := to_char((v_base + interval '30 days') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  update public.subscriptions
    set data = data
      || jsonb_build_object('status', 'actif', 'dateFin', v_fin, 'lastPaymentAt', v_iso)
      || case when coalesce(data ->> 'dateDebut', '') = ''
              then jsonb_build_object('dateDebut', v_iso) else '{}'::jsonb end,
        updated_at = v_now
    where org_id = p_org_id and id = v_sub_id;

  -- Commission du parrain, créée DANS SON organisation (elle arrive dans son
  -- espace partenaire à la synchronisation suivante).
  select o.referred_by into v_ref from public.orgs o where o.id = p_org_id;
  if v_ref is not null then
    select pt.org_id, pt.id into v_partner_org, v_partner_id
      from public.partners pt
      where public.code_partenaire(pt.data ->> 'code') = public.code_partenaire(v_ref)
      order by pt.updated_at asc
      limit 1;
    if v_partner_id is not null and not exists (
      select 1 from public.commissions c
      where c.org_id = v_partner_org and c.data ->> 'paymentId' = p_payment_id
    ) then
      v_cid := gen_random_uuid()::text;
      insert into public.commissions (org_id, id, data, updated_at)
      values (v_partner_org, v_cid, jsonb_build_object(
        'id', v_cid,
        'partnerId', v_partner_id,
        'leadId', null,
        'level', 1,
        'amount', round(v_montant * public.referral_commission_rate()),
        'status', 'en_attente',
        'paidAt', null,
        'createdAt', to_char(v_now at time zone 'utc', 'YYYY-MM-DD'),
        'source', 'abonnement',
        'paymentId', p_payment_id,
        'note', 'Abonnement Devis Pro d''un filleul'
      ), v_now);
    end if;
  end if;
end $$;

commit;

-- Pour supprimer AUSSI les données de la migration (irréversible) :
-- drop table if exists public.clics_parrainage, public.sel_clics,
--   public.parrainages, public.reglages_commissions;

select '✅ annulation faite — commissions calculées par l''application' as controle
where to_regprocedure('public.generer_commissions_affaire(text,text,text)') is null;
