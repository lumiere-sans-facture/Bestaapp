// Script de réparation des accès aux clients publics — COPIE GÉNÉRÉE.
//
// Source de vérité : supabase/reparer-clients-publics.sql. Ne pas modifier ici : éditer le .sql, puis
//   node scripts/generer-sql-reparation.mjs
// Un test compare les deux (src/utils/__tests__/sqlReparation.test.js).
//
// Pourquoi embarquer le SQL dans l'app : le gérant lit le refus sur son
// téléphone. Lui demander d'aller chercher un fichier dans le dépôt, c'est lui
// demander un ordinateur. Le bouton du Diagnostic met le script dans son
// presse-papiers, son adresse déjà remplie — il n'a plus qu'à coller.

export const SQL_REPARATION_CLIENTS = `-- ============================================================
--  RÉPARER : « Écriture refusée par la sécurité » sur les clients
--  À exécuter dans le SQL Editor Supabase. Rejouable sans danger.
--  Une seule chose à adapter : l'e-mail du gérant, ligne « MON EMAIL ».
--  (Le bouton « Copier le SQL de réparation », dans Plus › Diagnostic, le
--   remplit déjà avec l'adresse de votre session.)
-- ============================================================
--
-- Ce script fait trois choses d'affilée :
--   1. il (re)pose la règle qui rend les clients PUBLICS visibles au gérant —
--      si elle n'était jamais passée, elle passe maintenant ;
--   2. il REJOUE les écritures de l'app sous votre compte, dans une
--      transaction annulée (rien n'est modifié), pour voir si la base les
--      accepte VRAIMENT — et sinon, quelle règle les bloque ;
--   3. il affiche un tableau de contrôle qui dit, ligne par ligne, où en est
--      la base. Si le refus persiste, ce tableau en contient la cause.
--
-- Le Devis Pro n'est pas touché : les clients Pro restent privés à leur auteur.

-- 0. PRÉREQUIS — repris À L'IDENTIQUE de multitenant.sql, pour les bases
--    qui en ont reçu une version antérieure (« column is_platform_admin does
--    not exist »). La colonne vaut FALSE par défaut : personne ne devient
--    admin plateforme par ce biais.
alter table public.profiles add column if not exists is_platform_admin boolean not null default false;

create or replace function public.auth_is_platform_admin()
  returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_platform_admin from public.profiles where lower(email) = lower(auth.jwt() ->> 'email')),
    false
  )
$$;

-- 1. La règle du propriétaire d'espace (même définition que utils/roles.js) :
--    gérant, admin plateforme, ou inscrit seul dans une org sans gérant.
create or replace function public.auth_est_proprietaire_espace()
  returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.role = 'gerant' or p.is_platform_admin
        or not exists (
          select 1 from public.profiles g
          where g.org_id = p.org_id and g.role = 'gerant'
        )
    from public.profiles p
    where lower(p.email) = lower(auth.jwt() ->> 'email')
  ), false)
$$;

-- 2. Clients publics : le gérant de l'organisation retrouve un accès complet.
--    « client owner access » n'est pas touchée : un partenaire continue
--    d'écrire ses propres clients. Les deux règles s'additionnent.
drop policy if exists "manager client access" on public.leads;
create policy "manager client access" on public.leads
  for all to authenticated
  using (
    public.auth_is_platform_admin()
    or (org_id = public.auth_org_id() and public.auth_est_proprietaire_espace())
  )
  with check (
    public.auth_is_platform_admin()
    or (org_id = public.auth_org_id() and public.auth_est_proprietaire_espace())
  );

-- 3. L'ADRESSE DU COMPTE À CONTRÔLER — le seul endroit à modifier.
select set_config('diag.email', lower(trim('mon.email@exemple.com')), false);   -- MON EMAIL

-- 4. TEST RÉEL D'ÉCRITURE, SOUS CE COMPTE.
--    Déduire « ça doit passer » du rôle du compte ne suffit pas : un admin
--    plateforme était déclaré « réparé » alors que la base refusait encore ses
--    envois. On rejoue donc EXACTEMENT ce que fait l'app — un upsert par
--    client, puis la création d'un client — avec l'identité du compte et
--    toutes les règles de sécurité actives, dans une transaction ANNULÉE à la
--    fin : rien n'est modifié. Le premier refus est rapporté tel quel : il
--    nomme la règle ou la table qui bloque.
-- Table TEMPORAIRE : elle n'existe que dans cette fenêtre du SQL Editor.
-- La RLS y est activée pour que Supabase ne s'en alarme pas ; son
-- propriétaire (vous) y écrit quand même.
create temp table if not exists _diag_ecriture (n int, controle text, resultat text, ok boolean);
alter table _diag_ecriture enable row level security;
delete from _diag_ecriture;
do $diag$
declare
  v_email   text := current_setting('diag.email');
  v_profil  record;
  v_uid     text;
  v_pk      text;
  v_lead    jsonb;
  v_lignes  jsonb;
  v_total   int := 0;
  v_refus   int := 0;
  v_invis   int := 0;
  v_n       int;
  v_premier text;
  v_ids     text := '';
  v_insert  text;
  v_ok_ins  boolean := false;
begin
  select id, org_id into v_profil from public.profiles where lower(email) = v_email;
  if v_profil.id is null then return; end if;
  select id::text into v_uid from auth.users where lower(email) = v_email limit 1;
  select conname into v_pk from pg_constraint
    where conrelid = 'public.leads'::regclass and contype = 'p';
  -- Relevés AVANT de prendre l'identité du compte : un client que ce compte ne
  -- « voit » pas doit être testé aussi — c'est justement lui qui coince.
  select coalesce(jsonb_agg(jsonb_build_object('org_id', org_id, 'id', id, 'data', data) order by id), '[]'::jsonb)
    into v_lignes from (select org_id, id, data from public.leads where org_id = v_profil.org_id order by id limit 500) l;

  begin
    -- Identité du compte, comme dans une requête de l'app.
    perform set_config('request.jwt.claims',
      json_build_object('email', v_email, 'sub', coalesce(v_uid, ''), 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';

    -- a) Chaque client de l'entreprise, réécrit à l'identique (upsert).
    for v_lead in select * from jsonb_array_elements(v_lignes) loop
      v_total := v_total + 1;
      begin
        execute format(
          'insert into public.leads (org_id, id, data, updated_at) values ($1, $2, $3, now())
             on conflict on constraint %I do update set data = excluded.data, updated_at = excluded.updated_at', v_pk)
          using v_lead ->> 'org_id', v_lead ->> 'id', v_lead -> 'data';
        get diagnostics v_n = row_count;
        if v_n = 0 then v_invis := v_invis + 1; end if;
      exception when others then
        v_refus := v_refus + 1;
        v_premier := coalesce(v_premier, sqlstate || ' — ' || sqlerrm);
        if v_refus <= 5 then v_ids := v_ids || case when v_ids = '' then '' else ', ' end || (v_lead ->> 'id'); end if;
      end;
    end loop;

    -- b) Un nouveau client, comme en crée l'app.
    begin
      execute 'insert into public.leads (org_id, id, data, updated_at) values ($1, $2, $3, now())'
        using v_profil.org_id, 'diag-' || md5(random()::text),
              jsonb_build_object('name', 'Test diagnostic', 'registeredByUserId', v_profil.id, 'assignedTo', v_profil.id);
      v_ok_ins := true;
      v_insert := 'accepté';
    exception when others then
      v_insert := 'REFUSÉ : ' || sqlstate || ' — ' || sqlerrm;
    end;

    -- Tout annuler : rien de ce test ne doit rester dans la base.
    raise exception using errcode = 'P0099', message = 'annulation du test';
  exception when sqlstate 'P0099' then
    null;
  end;

  -- Le rôle et l'identité simulés sont défaits avec la sous-transaction.
  insert into _diag_ecriture values
    (5, 'Test réel : réécrire les ' || v_total || ' clients',
     case when v_refus = 0 and v_invis = 0 then 'tous acceptés'
          else v_refus || ' refusé(s)' || case when v_invis > 0 then ', ' || v_invis || ' invisible(s)' else '' end
               || coalesce(' — premier refus : ' || v_premier, '')
               || case when v_ids <> '' then ' — clients : ' || v_ids else '' end end,
     v_refus = 0 and v_invis = 0),
    (5, 'Test réel : créer un client', v_insert, v_ok_ins),
    (5, 'Clé primaire de leads', coalesce(v_pk, 'AUCUNE') || ' ('
      || (select string_agg(a.attname, ', ' order by a.attnum) from pg_constraint c
          join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
          where c.conrelid = 'public.leads'::regclass and c.contype = 'p') || ')',
     true);
end
$diag$;

-- 5. TABLEAU DE CONTRÔLE.
with moi as (
  select p.id, p.email, p.org_id, p.role, coalesce(p.is_platform_admin, false) as admin
  from public.profiles p
  where lower(p.email) = current_setting('diag.email')
),
autres_gerants as (
  select count(*)::int as n from public.profiles g
  where g.org_id = (select org_id from moi) and g.role = 'gerant'
),
verdict as (
  select coalesce((
    select m.role = 'gerant' or m.admin or (select n from autres_gerants) = 0 from moi m
  ), false) as ok
),
regles as (
  select policyname, permissive, cmd, coalesce(with_check, qual, '') as expr
  from pg_policies where schemaname = 'public' and tablename = 'leads'
),
clients as (
  select count(*)::int as total,
         count(*) filter (
           where coalesce(nullif(l.data ->> 'registeredByUserId', ''),
                          nullif(l.data ->> 'assignedTo', ''),
                          nullif(l.data ->> 'userId', ''))
                 is distinct from (select id from moi)
         )::int as autrui
  from public.leads l where l.org_id = (select org_id from moi)
),
test as (
  select bool_and(ok) as ok,
         string_agg(resultat, ' / ') filter (where not ok) as refus
  from _diag_ecriture where controle like 'Test réel%'
)
select * from (
  select 1 as n, 'Profil' as controle,
         coalesce((select 'e-mail ' || m.email || ' — profil ' || m.id
                        || ' — entreprise ' || m.org_id
                        || ' — rôle « ' || coalesce(m.role, 'aucun') || ' »'
                        || case when m.admin then ' — admin plateforme' else '' end from moi m),
                  'AUCUN PROFIL pour cet e-mail : corrigez l''e-mail ligne « MON EMAIL »') as resultat
  union all
  select 2, 'Gérants dans l''entreprise', (select n from autres_gerants)::text
  union all
  select 3, 'Règles : propriétaire de l''espace',
         case when not exists (select 1 from moi)
                   then 'INDÉTERMINÉ — aucun profil pour cet e-mail (voir la ligne 1)'
              when (select ok from verdict) then 'OUI — les règles donnent accès aux clients publics'
              else 'NON — ce compte n''est ni gérant ni admin plateforme, '
                   || 'et un autre gérant existe dans l''entreprise' end
  union all
  select 4, 'Règle « ' || r.policyname || ' » sur leads'
            || case when r.permissive = 'RESTRICTIVE' then ' (RESTRICTIVE : s''ajoute aux autres)' else '' end
            || ' [' || r.cmd || ']', r.expr from regles r
  union all
  select d.n, d.controle, d.resultat from _diag_ecriture d
  union all
  select 6, 'Clients publics de l''entreprise',
         (select total from clients)::text || ' au total, dont '
         || (select autrui from clients)::text || ' enregistrés par d''autres membres'
  union all
  select 7, 'Conclusion',
         case when not exists (select 1 from moi)
                   then 'E-mail inconnu. Cherchez le bon avec : select email, role from public.profiles order by email;'
              when coalesce((select ok from test), false)
              then 'Réparé : la base accepte réellement les écritures de ce compte. Déconnectez-vous puis reconnectez-vous : la file en attente repartira.'
              when not (select ok from verdict)
              then 'Encore refusé. Passez ce compte en gérant : '
                   || 'update public.profiles set role = ''gerant'' where lower(email) = lower('''
                   || (select email from moi) || ''');'
              else 'ENCORE REFUSÉ par la base, alors que les règles devraient l''autoriser. La cause est dans les lignes « Test réel » '
                   || 'ci-dessus (règle ou table nommée dans le message) : envoyez ce tableau au support.' end
) t order by n, controle;
`;

// Adresse de démonstration présente dans le script : remplacée par celle de la
// session, pour qu'il n'y ait rien à éditer avant de coller.
export const EMAIL_MODELE = 'mon.email@exemple.com';

/** Le script prêt à coller, avec l'e-mail de la session. */
export const sqlReparationPour = (email) => {
  const propre = String(email || '').trim().toLowerCase().replace(/'/g, '');
  return propre ? SQL_REPARATION_CLIENTS.replaceAll(EMAIL_MODELE, propre) : SQL_REPARATION_CLIENTS;
};
