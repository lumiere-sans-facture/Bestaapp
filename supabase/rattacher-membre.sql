-- ============================================================
-- Rattacher un compte EXISTANT à l'entreprise d'un gérant
-- À exécuter dans le SQL Editor de Supabase (Run). Rejouable.
-- ============================================================
--
-- POURQUOI CE SCRIPT EXISTE
-- Une inscription faite SANS le lien d'invitation (?equipe=CODE) crée une
-- NOUVELLE entreprise et y place la personne, seule, avec le rôle
-- « technicien ». Or tout est isolé par entreprise (RLS) : clients, kits,
-- onduleurs, kits pompage, catalogue ET cours de formation. Chaque nouvelle
-- entreprise reçoit en plus sa propre copie des données livrées avec
-- l'application — mêmes noms, mêmes identifiants — d'où l'illusion que
-- « les kits sont là, mais celui que le gérant vient d'ajouter n'arrive pas ».
--
-- L'application ne peut pas corriger ça toute seule : rejoindre une équipe est
-- refusé quand un profil existe déjà pour cet email. D'où ce script, réservé à
-- l'administrateur.
--
-- CE QU'IL FAIT
--   1. vérifie que les deux comptes existent ;
--   2. dit ce que le membre laisse derrière lui dans son ancienne entreprise ;
--   3. le rattache à celle du gérant ;
--   4. déplace éventuellement ses données (option, voir ci-dessous).
--
-- APRÈS : le membre se déconnecte et se reconnecte. L'entreprise est lue à la
-- connexion, et le cache de l'appareil est rangé par entreprise.

-- ─────────────────────────────────────────────────────────────
-- ÉTAPE 1 — Inventaire : qui appartient à quelle entreprise ?
-- Aucun paramètre à remplir. Les membres d'une même équipe partagent le MÊME
-- org_id ; deux entreprises peuvent porter le même nom sans rien partager.
-- ─────────────────────────────────────────────────────────────
select o.name as entreprise, p.org_id, p.email, p.name, p.role
  from public.profiles p
  left join public.orgs o on o.id = p.org_id
 order by o.name nulls first, p.email;

-- ─────────────────────────────────────────────────────────────
-- ÉTAPE 2 — Rattachement. Remplissez les DEUX emails ci-dessous, puis Run.
-- Le compte-rendu s'affiche dans l'onglet des messages (« Notices »).
-- ─────────────────────────────────────────────────────────────
do $$
declare
  -- ┌─ À REMPLIR ────────────────────────────────────────────┐
  email_gerant   text    := 'gerant@exemple.com';       -- entreprise D'ACCUEIL
  email_membre   text    := 'technicien@exemple.com';   -- compte à rattacher
  -- Déplacer aussi ce que ce membre a saisi (clients, devis, factures…) ?
  -- false = tout reste dans son ancienne entreprise et devient inaccessible.
  -- Pour un compte fraîchement créé, laissez false.
  migrer_donnees boolean := false;
  -- └────────────────────────────────────────────────────────┘
  org_cible  text;
  org_source text;
  nom_cible  text;
  table_nom  text;
  n          bigint;
  total      bigint := 0;
  deplacees  bigint;
  bloquees   bigint;
  -- Tout ce qui existe dans l'ancienne entreprise : sert à l'INVENTAIRE.
  tables_metier text[] := array[
    'leads', 'partners', 'commissions', 'devis', 'referrals', 'orders',
    'formationProgress', 'factures', 'proClients', 'payoutRequests',
    'kits', 'inverters', 'pompeKits', 'products', 'formations',
    'companies', 'subscriptions', 'subscriptionPayments'
  ];
  -- Ce qui appartient à la PERSONNE et peut la suivre. En sont exclus les
  -- biens de l'ENTREPRISE qu'elle quitte — kits, onduleurs, kits pompage,
  -- catalogue, cours, fiche d'entreprise, abonnement : les déplacer
  -- ajouterait chez le gérant des doublons de ses propres kits, voire un
  -- abonnement qu'il n'a jamais souscrit.
  tables_personnelles text[] := array[
    'leads', 'partners', 'commissions', 'devis', 'referrals', 'orders',
    'formationProgress', 'factures', 'proClients', 'payoutRequests'
  ];
begin
  select org_id into org_cible from public.profiles where lower(email) = lower(email_gerant);
  if org_cible is null then
    raise exception 'Compte gérant introuvable : % — vérifiez l''email dans la liste de l''étape 1.', email_gerant;
  end if;
  select org_id into org_source from public.profiles where lower(email) = lower(email_membre);
  if org_source is null then
    raise exception 'Compte à rattacher introuvable : % — vérifiez l''email dans la liste de l''étape 1.', email_membre;
  end if;
  select name into nom_cible from public.orgs where id = org_cible;

  if org_source = org_cible then
    raise notice 'Rien à faire : % appartient déjà à « % ».', email_membre, nom_cible;
    return;
  end if;

  -- Ce que le membre a saisi dans son ancienne entreprise.
  raise notice 'Données présentes dans l''ancienne entreprise (%) :', org_source;
  foreach table_nom in array tables_metier loop
    if to_regclass(format('public.%I', table_nom)) is null then continue; end if;
    execute format('select count(*) from public.%I where org_id = $1', table_nom)
      into n using org_source;
    if n > 0 then
      raise notice '   • % : % ligne(s)', table_nom, n;
      total := total + n;
    end if;
  end loop;
  if total = 0 then
    raise notice '   (aucune — compte neuf, rien à perdre)';
  end if;

  -- Le rattachement lui-même : seul l'org_id change, le rôle est conservé.
  update public.profiles set org_id = org_cible where lower(email) = lower(email_membre);
  raise notice 'Rattaché : % → « % » (%)', email_membre, nom_cible, org_cible;

  if not migrer_donnees then
    if total > 0 then
      raise notice 'Les % ligne(s) ci-dessus RESTENT dans l''ancienne entreprise.', total;
      raise notice 'Pour déplacer ses clients, devis et factures, repassez le';
      raise notice 'script avec migrer_donnees := true (kits, catalogue, cours';
      raise notice 'et abonnement ne suivent jamais : ils sont à l''entreprise).';
    end if;
    return;
  end if;

  -- Migration optionnelle, limitée aux données de la personne. Un identifiant
  -- déjà présent chez le gérant n'est PAS déplacé : la clé primaire est
  -- (org_id, id), et les données livrées avec l'app portent les mêmes
  -- identifiants dans les deux entreprises.
  raise notice 'Déplacement des données personnelles vers « % » :', nom_cible;
  foreach table_nom in array tables_personnelles loop
    if to_regclass(format('public.%I', table_nom)) is null then continue; end if;
    execute format(
      'update public.%1$I s set org_id = $1
        where s.org_id = $2
          and not exists (select 1 from public.%1$I c where c.org_id = $1 and c.id = s.id)',
      table_nom) using org_cible, org_source;
    get diagnostics deplacees = row_count;
    execute format('select count(*) from public.%I where org_id = $1', table_nom)
      into bloquees using org_source;
    if deplacees > 0 or bloquees > 0 then
      raise notice '   • % : % déplacée(s), % laissée(s) (identifiant déjà pris)',
        table_nom, deplacees, bloquees;
    end if;
  end loop;
  raise notice 'Terminé. Le membre doit se déconnecter puis se reconnecter.';
end $$;

-- ─────────────────────────────────────────────────────────────
-- ÉTAPE 3 — Contrôle : les deux comptes doivent afficher le MÊME org_id.
-- (remplacez les emails à l'identique)
-- ─────────────────────────────────────────────────────────────
select p.email, p.name, p.role, p.org_id, o.name as entreprise
  from public.profiles p
  left join public.orgs o on o.id = p.org_id
 where lower(p.email) in (
   lower('gerant@exemple.com'),
   lower('technicien@exemple.com')
 );

-- L'ancienne entreprise, désormais sans membre, peut rester : elle n'est plus
-- lue par personne. Ne la supprimez pas sans avoir vérifié qu'aucun autre
-- profil ne s'y rattache (la contrainte de clé étrangère vous en empêchera).
