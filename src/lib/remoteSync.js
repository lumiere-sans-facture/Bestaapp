import { supabase } from './supabase';
import { estRefusRls } from '../utils/erreurSync';

// Synchronisation des collections métier avec Supabase.
// Chaque entité est une ligne { id, data } ; la logique métier reste
// dans DataContext, ce module ne fait que répliquer l'état.

export const SYNCED_COLLECTIONS = ['products', 'kits', 'inverters', 'pompeKits', 'leads', 'partners', 'commissions', 'devis', 'referrals', 'orders', 'formations', 'formationProgress', 'subscriptions', 'subscriptionPayments', 'companies', 'paiementConfigs', 'factures', 'proClients', 'payoutRequests'];

// Organisation courante (schéma multi-entreprise). Renseignée par AuthContext
// au chargement du profil ; absente (null) sur l'ancien schéma mono-équipe —
// les lignes sont alors poussées sans org_id, comme avant.
let currentOrgId = null;
// Type de l'organisation ('interne' = BestaSolar, 'pro' = externe). Le catalogue
// est l'actif interne BestaSolar, partagé en LECTURE à toutes les entreprises :
// seule l'organisation interne le pousse. Tant que le type est inconnu, on
// s'abstient de pousser les produits (prudence : jamais de copie).
let currentOrgKind = null;
const pushesProducts = () => !currentOrgId || currentOrgKind === 'interne';
// Collections dont l'organisation INTERNE est propriétaire et qu'elle partage
// en lecture avec toutes les autres (policies « lecture partagee ») : le
// catalogue produits et les cours de formation. Pour ces tables seulement, la
// réception peut légitimement contenir des lignes d'une AUTRE organisation ;
// elles sont marquées `partage` et traitées en lecture seule.
const TABLES_PARTAGEES = new Set(['products', 'kits', 'formations', 'paiementConfigs']);
export const setSyncOrg = (orgId, kind = null) => {
  currentOrgId = orgId || null;
  currentOrgKind = kind || null;
  tablesAbsentes.clear(); // nouvelle session : on re-teste le schéma distant
  lignesRefusees.clear(); // ... et on retente les lignes que le serveur refusait
};

// Lignes que le serveur REFUSE d'enregistrer (sécurité au niveau ligne), par
// table. Sans ce registre, UNE ligne refusée bloquait l'envoi de TOUTE sa
// collection, indéfiniment : le lot entier est rejeté par Postgres, donc les
// lignes parfaitement légitimes qui l'accompagnent ne partaient jamais non
// plus. On les met de côté pour que le reste passe, et on les compte — il
// n'est pas question de faire croire qu'elles sont enregistrées.
//
// Le registre est vidé à chaque connexion : une règle de sécurité corrigée
// côté base suffit à les faire repartir, sans rien à réparer dans l'app.
const lignesRefusees = new Map(); // table -> Set(id)
const marquerRefusee = (table, id) => {
  if (!lignesRefusees.has(table)) lignesRefusees.set(table, new Set());
  lignesRefusees.get(table).add(id);
};
/** Combien de lignes le serveur refuse, par table. {} si tout passe. */
export const lignesRefuseesParTable = () => {
  const parTable = {};
  for (const [table, ids] of lignesRefusees) if (ids.size) parTable[table] = ids.size;
  return parTable;
};
const withOrg = (row) => (currentOrgId ? { ...row, org_id: currentOrgId } : row);

/**
 * Les quatre valeurs qui décident d'un refus de sécurité, relevées à la
 * source. La politique compare `org_id = auth_org_id()` : il suffit de voir
 * l'e-mail de la session, ce que la base en déduit, et ce que l'app estampille.
 * Sans ça, on ne peut que supposer.
 */
export async function diagnosticReplication() {
  if (!supabase) return { local: true, orgEcriture: currentOrgId };
  let email = null;
  try {
    const { data: { user } = {} } = await supabase.auth.getUser();
    email = user?.email || null;
  } catch { /* session illisible : traité comme absente */ }
  let orgBase = null;
  try {
    const { data } = await supabase.rpc('auth_org_id');
    orgBase = data || null;
  } catch { /* fonction absente : orgBase reste vide */ }
  // Depuis la fusion des organisations, la politique des clients compare aussi
  // l'AUTEUR (`auth_owns_client`) — sauf pour le gérant plateforme, qui écrit
  // partout. Ces deux valeurs décident donc autant que l'entreprise.
  let profilId = null;
  try {
    const { data } = await supabase.rpc('auth_profile_id');
    profilId = data || null;
  } catch { /* migration de fusion non passée : la règle ne s'applique pas */ }
  let adminPlateforme = false;
  try {
    const { data } = await supabase.rpc('auth_is_platform_admin');
    adminPlateforme = Boolean(data);
  } catch { /* fonction absente : traité comme non-admin */ }
  let profilTrouve = false;
  let orgProfil = null;
  if (email) {
    try {
      const { data } = await supabase.from('profiles').select('org_id')
        .eq('email', email.toLowerCase()).maybeSingle();
      profilTrouve = Boolean(data);
      orgProfil = data?.org_id || null;
    } catch { /* lecture refusée : le profil reste « introuvable » */ }
  }
  return { email, profilTrouve, orgProfil, orgBase, profilId, adminPlateforme, orgEcriture: currentOrgId };
}

/**
 * Relit l'organisation que la BASE attribue au compte connecté, et réaligne
 * l'estampille de réplication dessus.
 *
 * Pourquoi c'est nécessaire : l'organisation est lue à la CONNEXION, puis
 * gardée en mémoire pour estampiller chaque ligne poussée. Si elle change
 * pendant la session — un rattachement corrigé en SQL, une réunion de comptes
 * gérants — l'app continue d'écrire sous l'ancienne, la RLS refuse
 * (`new row violates row-level security policy`), et la file se bloque
 * jusqu'à la prochaine connexion. C'est `auth_org_id()` qui fait foi : c'est
 * exactement la valeur à laquelle la politique compare.
 *
 * @returns {Promise<{change: boolean, orgId: string|null}>}
 */
export async function resynchroniserOrg() {
  if (!supabase) return { change: false, orgId: currentOrgId };
  let orgId = null;
  try {
    const { data, error } = await supabase.rpc('auth_org_id');
    if (!error && data) orgId = data;
  } catch { /* fonction absente : on tente la lecture directe ci-dessous */ }
  if (!orgId) {
    try {
      const { data: { user } = {} } = await supabase.auth.getUser();
      const email = (user?.email || '').toLowerCase();
      if (!email) return { change: false, orgId: currentOrgId };
      const { data } = await supabase.from('profiles').select('org_id').eq('email', email).maybeSingle();
      orgId = data?.org_id || null;
    } catch { /* serveur injoignable : on garde l'estampille actuelle */ }
  }
  if (!orgId) return { change: false, orgId: currentOrgId };
  const change = orgId !== currentOrgId;
  // Le type d'organisation ne change pas avec le rattachement : on le garde.
  if (change) setSyncOrg(orgId, currentOrgKind);
  return { change, orgId };
}

// Tables absentes du schéma distant : une collection ajoutée par une mise à
// jour de l'application existe côté client AVANT que le SQL ne soit rejoué.
// Sans ce filet, sa lecture faisait échouer TOUTE la synchronisation — plus
// rien ne montait ni ne descendait, pour une seule table manquante.
//
// Le constat EXPIRE. PostgREST répond « schema cache » pendant les secondes
// qui suivent la création d'une table : un marquage définitif condamnait la
// table pour toute la session, et l'app continuait de tourner au vert en
// n'envoyant plus rien. Il est donc réévalué régulièrement, et remis à zéro
// à chaque changement d'organisation (nouvelle connexion).
const DELAI_RESSAI_TABLE = 5 * 60 * 1000;
const tablesAbsentes = new Map(); // table -> instant du constat
const estAbsente = (table) => {
  const constat = tablesAbsentes.get(table);
  if (constat === undefined) return false;
  if (Date.now() - constat < DELAI_RESSAI_TABLE) return true;
  tablesAbsentes.delete(table); // le délai est écoulé : on retente
  return false;
};
const noterAbsente = (table) => tablesAbsentes.set(table, Date.now());
const tableManquante = (error) =>
  error?.code === '42P01' || error?.code === 'PGRST205'
  || /does not exist|schema cache/i.test(error?.message || '');

/** Première occurrence par clé, ordre d'entrée préservé. Les collections sont
 *  rangées du plus récent au plus ancien : la première est donc la bonne. */
export const dedupePar = (items, cle) => {
  const vus = new Map();
  for (const item of items) {
    const k = cle(item);
    if (!vus.has(k)) vus.set(k, item);
  }
  return [...vus.values()];
};

/** Récupère toutes les collections + les tombstones. { empty, collections, tombstones } */
export async function pullAll() {
  // Lecture des collections en parallèle (au lieu de 15 allers-retours séquentiels).
  const fetched = await Promise.all(
    SYNCED_COLLECTIONS.map(async (table) => {
      // En multi-entreprise, org_id est lu pour TOUTES les tables. Certaines
      // policies (abonnements, paiements) autorisent l'admin plateforme à lire
      // les lignes des AUTRES organisations : sans filtrage, elles entraient
      // dans l'état local, repartaient estampillées de NOTRE org_id, puis
      // revenaient en double au pull suivant (l'originale + notre copie, même
      // id — la clé primaire est (org_id, id)). Deux lignes de même clé dans
      // un envoi font rejeter TOUT le lot (« ON CONFLICT DO UPDATE command
      // cannot affect row a second time ») : synchronisation bloquée en
      // boucle. La vue inter-organisations de l'admin passe par des RPC
      // dédiées (adminSubscriptionsOverview…), jamais par cette réplication.
      const multiOrg = !!currentOrgId;
      if (estAbsente(table)) return [table, []];
      const { data, error } = await supabase.from(table).select(multiOrg ? 'id, data, org_id' : 'id, data');
      if (error) {
        if (tableManquante(error)) { noterAbsente(table); return [table, []]; }
        throw error;
      }
      let rows = data || [];
      if (multiOrg) {
        if (TABLES_PARTAGEES.has(table)) {
          // Une ligne venue d'une AUTRE organisation ne peut être ici que
          // l'actif partagé de l'org interne (la policy ne renvoie rien
          // d'autre). Une entreprise ayant reçu une copie historique verrait
          // des doublons — la ligne partagée prime, c'est la source de vérité.
          const partages = new Set(rows.filter((r) => r.org_id !== currentOrgId).map((r) => r.id));
          rows = rows.filter((r) => r.org_id !== currentOrgId || !partages.has(r.id));
        } else {
          rows = rows.filter((r) => r.org_id === currentOrgId);
        }
      }
      return [table, dedupePar(rows, (r) => r.id).map((row) => (
        multiOrg && row.org_id !== currentOrgId
          ? { ...row.data, id: row.id, partage: true }
          : { ...row.data, id: row.id }
      ))];
    })
  );
  const collections = {};
  let total = 0;
  for (const [table, items] of fetched) {
    collections[table] = items;
    total += items.length;
  }

  // Récupérer les tombstones pour filtrer les suppressions distantes.
  // Enveloppé dans try/catch pour tolérer un déploiement progressif du schéma.
  const tombstones = new Map();
  try {
    const { data: tbRows } = await supabase.from('tombstones').select('id, collection');
    for (const row of (tbRows || [])) {
      if (!tombstones.has(row.collection)) tombstones.set(row.collection, new Set());
      tombstones.get(row.collection).add(row.id);
    }
    for (const table of SYNCED_COLLECTIONS) {
      const deleted = tombstones.get(table);
      if (deleted?.size) {
        // Les éléments PARTAGÉS sont immunisés : un tombstone de NOTRE
        // organisation (ex. : purge d'une vieille copie locale d'un cours)
        // ne doit jamais masquer l'actif de l'organisation interne — sinon
        // un cours partagé disparaîtrait ici définitivement.
        collections[table] = collections[table].filter((item) => item.partage || !deleted.has(item.id));
      }
    }
  } catch {
    // Table tombstones absente : déploiement progressif, pas de filtrage
  }

  return { empty: total === 0, collections, tombstones };
}

// Taille maximale d'un envoi. Le catalogue embarque les photos des produits en
// base64 : tout pousser d'un coup produit une requête de plusieurs mégaoctets,
// que le serveur refuse ou laisse expirer — et c'est TOUTE la synchronisation
// de l'organisation qui reste bloquée. On découpe donc par volume réel.
const TAILLE_LOT = 400 * 1024;

/** Découpe des lignes en lots dont le poids sérialisé reste raisonnable.
 *  Une ligne à elle seule plus lourde que la limite part dans son propre lot. */
export function decouperEnLots(rows, tailleMax = TAILLE_LOT) {
  const lots = [];
  let courant = [];
  let poids = 0;
  for (const row of rows) {
    const p = JSON.stringify(row).length;
    if (courant.length && poids + p > tailleMax) {
      lots.push(courant);
      courant = [];
      poids = 0;
    }
    courant.push(row);
    poids += p;
  }
  if (courant.length) lots.push(courant);
  return lots;
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/** Un envoi, avec deux reprises : absorbe les micro-coupures réseau
 *  (« Failed to fetch ») fréquentes en connexion mobile. */
async function envoyerLot(table, lot) {
  let derniere;
  for (let essai = 0; essai < 3; essai += 1) {
    try {
      const { error } = await supabase.from(table).upsert(lot);
      if (!error) return;
      derniere = new Error(error.message);
      derniere.code = error.code; // conservé pour la détection « table manquante »
    } catch (e) {
      derniere = e; // requête avortée : le client lève au lieu de retourner error
    }
    // Un refus de la sécurité est DÉTERMINISTE : le rejouer n'ajoute que de
    // l'attente et de la charge serveur pour obtenir le même refus.
    if (estRefusRls(derniere)) throw derniere;
    if (essai < 2) await attendre(500 * (essai + 1));
  }
  throw derniere;
}

// Nombre maximal d'envois consacrés à isoler les lignes refusées, par lot.
// La dichotomie trouve k lignes fautives parmi n en ~k·log(n) envois ; le
// plafond couvre le cas dégénéré où le serveur les refuse TOUTES — mieux vaut
// alors mettre le reste du lot de côté que d'inonder le serveur.
const BUDGET_ISOLATION = 48;

/**
 * Envoie un lot en écartant les lignes que la sécurité refuse.
 *
 * Postgres rejette le lot ENTIER dès qu'une ligne viole la politique : sans
 * dichotomie, une seule ligne « pas à nous » condamne toute la collection.
 * On coupe donc en deux jusqu'à isoler la (ou les) fautive(s), qui rejoignent
 * le registre des refus ; tout le reste part normalement.
 */
export async function envoyerEnIsolant(table, rows, budget = { restant: BUDGET_ISOLATION }) {
  if (!rows.length) return;
  try {
    budget.restant -= 1;
    await envoyerLot(table, rows);
  } catch (e) {
    if (!estRefusRls(e)) throw e; // panne réseau ou table absente : à l'appelant
    if (rows.length === 1 || budget.restant <= 0) {
      for (const row of rows) marquerRefusee(table, row.id);
      return;
    }
    const milieu = Math.ceil(rows.length / 2);
    await envoyerEnIsolant(table, rows.slice(0, milieu), budget);
    await envoyerEnIsolant(table, rows.slice(milieu), budget);
  }
}

/**
 * Réplique les collections passées : upsert uniquement, non-destructif.
 * Les suppressions passent exclusivement par pushTombstone.
 *
 * Les tables partent l'une APRÈS l'autre : en parallèle, quatorze envois
 * simultanés — dont le catalogue et ses photos — saturaient la connexion et
 * échouaient en bloc. Chaque table qui passe est acquise : elle ne sera pas
 * renvoyée si une autre échoue.
 * @param {{isolerRefus?: boolean}} options `isolerRefus` : écarter une à une
 *   les lignes que la sécurité refuse au lieu de perdre toute la collection.
 *   Activé seulement en SECOND passage — le premier laisse sa chance au
 *   réalignement de l'organisation, qui, lui, débloque tout d'un coup.
 * @returns {Promise<string[]>} tables effectivement répliquées
 */
export async function pushCollections(collections, { isolerRefus = false } = {}) {
  const reussies = [];
  const erreurs = [];
  const manquantes = [];
  for (const [table, items0] of Object.entries(collections)) {
    if (!SYNCED_COLLECTIONS.includes(table) || !Array.isArray(items0)) continue;
    // Le catalogue n'est poussé que par l'organisation interne BestaSolar.
    if (table === 'products' && !pushesProducts()) continue;
    // Table pas encore créée côté serveur : on n'envoie rien, mais on ne fait
    // JAMAIS croire que c'est passé. La compter « traitée » marquait les
    // données comme répliquées : elles ne repartaient plus jamais, voyant au
    // vert — un kit ajouté par le gérant n'atteignait aucun technicien, sans
    // le moindre signe. Les autres tables continuent de se synchroniser.
    if (estAbsente(table)) { manquantes.push(table); continue; }
    // Un élément PARTAGÉ appartient à l'organisation interne : le repousser
    // le recopierait sous notre org_id (et la RLS refuserait l'écriture chez
    // son propriétaire). Il est lu, jamais réémis.
    let items = items0.filter((i) => !i.partage);
    // Vérité serveur : un abonnement « actif » et un paiement « confirme »
    // ne s'écrivent que côté serveur (RPC admin). L'app ne les repousse
    // jamais — la RLS les rejetterait et bloquerait toute la réplication.
    if (currentOrgId && table === 'subscriptions') items = items.filter((i) => i.status !== 'actif');
    if (currentOrgId && table === 'subscriptionPayments') items = items.filter((i) => i.statut !== 'confirme');
    // Filet : deux lignes de même id dans un même envoi font rejeter TOUT le
    // lot par Postgres (« ON CONFLICT DO UPDATE command cannot affect row a
    // second time »), donc toute la synchronisation. Un doublon local — quelle
    // qu'en soit l'origine — ne doit jamais avoir ce pouvoir.
    // Lignes déjà refusées par le serveur : les renvoyer ferait rejeter le lot
    // entier à chaque cycle, et la collection resterait bloquée pour de bon.
    const refusees = lignesRefusees.get(table);
    const rows = dedupePar(items, (i) => i.id)
      .filter((i) => !refusees?.has(i.id))
      .map((item) => withOrg({ id: item.id, data: item, updated_at: new Date().toISOString() }));
    if (!rows.length) { reussies.push(table); continue; }
    try {
      for (const lot of decouperEnLots(rows)) {
        if (isolerRefus) await envoyerEnIsolant(table, lot);
        else await envoyerLot(table, lot);
      }
      reussies.push(table);
    } catch (e) {
      if (tableManquante(e)) { noterAbsente(table); manquantes.push(table); continue; }
      erreurs.push(`${table} : ${e.message}`);
    }
  }
  if (manquantes.length) {
    erreurs.push(`table(s) absente(s) côté serveur : ${manquantes.join(', ')} — exécuter les scripts SQL du dossier supabase/`);
  }
  if (erreurs.length) {
    const err = new Error(erreurs.join(' · '));
    err.reussies = reussies; // l'appelant garde le bénéfice de ce qui est passé
    throw err;
  }
  return reussies;
}

/** Enregistre une suppression dans la table tombstones (non-destructif). */
export async function pushTombstone(table, id) {
  // Une entreprise externe ne supprime jamais le catalogue partagé (un
  // tombstone local masquerait les produits BestaSolar à la réception).
  if (table === 'products' && !pushesProducts()) return;
  // Même filet que les collections : si la table tombstones n'existe pas
  // encore côté serveur (bloc « tombstones » de schema.sql jamais exécuté),
  // échouer ici bloquait TOUTE la réplication en boucle — la première
  // suppression locale rendait la synchronisation rouge en permanence,
  // et plus rien ne montait. On saute l'upsert (le pull tolère déjà son
  // absence) et la suppression est quand même appliquée à la table source.
  if (!estAbsente('tombstones')) {
    const { error } = await supabase
      .from('tombstones')
      .upsert(withOrg({ id, collection: table, deleted_at: new Date().toISOString() }));
    if (error) {
      if (tableManquante(error)) noterAbsente('tombstones');
      else throw error;
    }
  }
  // Supprimer aussi la ligne de la table source (cohérence distante)
  await supabase.from(table).delete().eq('id', id);
}

/**
 * Abonnement Devis Pro de l'utilisateur, lu DIRECTEMENT sur le serveur.
 * C'est la source de vérité du mode Pro quand le backend est configuré :
 * une ligne « actif » forgée en local ne peut ni être poussée (RLS) ni
 * tromper cette lecture. Retourne null si aucun abonnement, undefined en
 * cas d'échec réseau (l'appelant retombe alors sur l'état local).
 */
export async function fetchMySubscription(userId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('data')
    .eq('data->>userId', userId)
    .limit(1);
  if (error) throw error;
  return data?.[0]?.data || null;
}

/** Profils de l'équipe de `orgId`. Le filtre est EXPLICITE : la RLS ne suffit
 *  pas — un admin plateforme a le droit de lire tous les profils, il verrait
 *  donc l'équipe des autres entreprises (et croirait avoir un gérant).
 *  Forme identique aux utilisateurs du seed : { id, name, role, phone, avatar }. */
export async function fetchTeamProfiles(orgId = null) {
  let q = supabase.from('profiles').select('id, email, name, role, phone, avatar, org_id');
  if (orgId) q = q.eq('org_id', orgId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((p) => ({
    ...p,
    avatar: p.avatar || p.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
  }));
}

/**
 * Met à jour MES coordonnées dans l'annuaire de l'équipe (nom, téléphone,
 * avatar). Le rôle et les droits ne sont pas modifiables : la fonction serveur
 * ne les expose pas.
 */
export async function updateMyProfile({ name, phone, avatar }) {
  const { error } = await supabase.rpc('update_my_profile', {
    p_name: name, p_phone: phone || null, p_avatar: avatar || null,
  });
  if (error) throw new Error(error.message);
}

/**
 * Attribue le code de parrainage de l'entreprise (une seule fois — la base
 * refuse tout changement ultérieur ; seule l'admin plateforme peut modifier).
 */
export async function setOrgReferral(code) {
  const { error } = await supabase.rpc('set_org_referral', { p_code: code });
  if (error) throw new Error(error.message);
}

/** Réunit un compte gérant existant à l'organisation indiquée par le code de
 * réunion. La base vérifie le rôle, l'absence d'équipier dans la source et
 * l'absence de conflit avant le moindre déplacement. */
export async function reunirMonCompteGerant(codeReunion) {
  const { data, error } = await supabase.rpc('reunir_mon_compte_gerant', {
    p_code_reunion: codeReunion,
  });
  if (error) throw new Error(error.message);
  return data || {};
}

/** Organisation de l'utilisateur courant (nom, type interne/pro, code
 *  d'invitation). select('*') : tolère les schémas avec ou sans colonne kind.
 *  Retourne null sur l'ancien schéma mono-équipe (table orgs absente). */
export async function fetchMyOrg() {
  try {
    const { data, error } = await supabase.from('orgs').select('*').limit(1);
    if (error) return null;
    return data?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * Filleuls de mon organisation : entreprises inscrites via un de nos codes
 * partenaires (RPC cross-org — la RLS d'isolation ne permet pas de les voir).
 * Chaque ligne : { partner_code, org_id, org_name, member_name, inscrit_le, pro_actif }.
 */
export async function fetchMyReferredOrgs() {
  const { data, error } = await supabase.rpc('my_referred_orgs');
  if (error) throw new Error(error.message);
  return data || [];
}

/** Vue admin plateforme : abonnements + paiements de TOUTES les organisations. */
export async function adminSubscriptionsOverview() {
  const { data, error } = await supabase.rpc('admin_subscriptions_overview');
  if (error) throw new Error(error.message);
  return data || { subscriptions: [], payments: [] };
}

/** Confirme un paiement d'abonnement (admin) : active +30 j et crédite la
 *  commission du parrain — tout est fait côté serveur, atomiquement. */
export async function adminConfirmSubscriptionPayment(orgId, paymentId) {
  const { error } = await supabase.rpc('admin_confirm_subscription_payment', {
    p_org_id: orgId, p_payment_id: paymentId,
  });
  if (error) throw new Error(error.message);
}

/**
 * Vue gérant : tous les devis PUBLICS de la plateforme (toutes organisations,
 * hors espace Pro payant), enrichis du client (clientName…), de l'auteur et
 * de l'entreprise d'origine. Réservé à l'admin plateforme (vérifié serveur).
 */
export async function fetchAdminPublicDevis() {
  const { data, error } = await supabase.rpc('admin_public_devis');
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Demandes de progression en attente sur TOUTE la plateforme (hors sa propre
 * organisation, déjà dans l'état local). Réservé à l'admin plateforme.
 */
export async function fetchPendingProgressions() {
  const { data, error } = await supabase.rpc('admin_pending_progressions');
  if (error) throw new Error(error.message);
  return data || [];
}

/** Valide (ou refuse) une demande venue d'une autre organisation. La validation
 *  applique l'étape et crée la commission de l'apporteur — côté serveur. */
export async function decideProgression({ orgId, kind, id, approuver }) {
  const { error } = await supabase.rpc('admin_decide_progression', {
    p_org_id: orgId, p_kind: kind, p_id: id, p_approuver: approuver,
  });
  if (error) throw new Error(error.message);
}

/**
 * Commissions de TOUTE la plateforme (hors sa propre organisation, déjà dans
 * l'état local). Elles naissent chez le partenaire : sans cette vue, BestaSolar
 * ne verrait jamais ce qu'elle doit. Réservé à l'admin plateforme.
 */
export async function fetchPlatformCommissions() {
  const { data, error } = await supabase.rpc('admin_platform_commissions');
  if (error) throw new Error(error.message);
  return data || [];
}

/** Marque payée une commission qui vit dans une autre organisation. */
export async function payPlatformCommission({ orgId, id, mode, reference, note }) {
  const { error } = await supabase.rpc('admin_pay_commission', {
    p_org_id: orgId, p_id: id, p_mode: mode || 'momo',
    p_ref: reference || null, p_note: note || null,
  });
  if (error) throw new Error(error.message);
}

/**
 * Demandes de paiement en attente sur TOUTE la plateforme (hors sa propre
 * organisation, déjà dans l'état local). Réservé à l'admin plateforme.
 */
export async function fetchPlatformPayouts() {
  const { data, error } = await supabase.rpc('admin_platform_payouts');
  if (error) throw new Error(error.message);
  return data || [];
}

/** Règle ou refuse la demande d'un partenaire d'une autre organisation. La
 *  validation marque aussi les commissions couvertes — côté serveur. */
export async function decidePlatformPayout({ orgId, id, approuver, mode, reference, motif }) {
  const { error } = await supabase.rpc('admin_decide_payout', {
    p_org_id: orgId, p_id: id, p_approuver: approuver,
    p_mode: mode || 'momo', p_ref: reference || null, p_motif: motif || null,
  });
  if (error) throw new Error(error.message);
}

/** Fait avancer directement l'affaire d'un autre compte, sans demande préalable.
 *  Mêmes effets qu'une validation (étape + commissions). */
export async function setProgression({ orgId, kind, id, stage }) {
  const { error } = await supabase.rpc('admin_set_progression', {
    p_org_id: orgId, p_kind: kind, p_id: id, p_stage: stage,
  });
  if (error) throw new Error(error.message);
}

/**
 * Vue gérant : le suivi commercial de toute la plateforme — pistes et devis
 * publics de toutes les organisations (lecture seule dans le kanban).
 * Retourne { leads: [...], devis: [...] }, chaque piste enrichie de
 * orgId/orgName/authorName. Réservé à l'admin plateforme (vérifié serveur).
 */
export async function fetchAdminPublicPipeline() {
  const { data, error } = await supabase.rpc('admin_public_pipeline');
  if (error) throw new Error(error.message);
  return data || { leads: [], devis: [] };
}

/** Refuse un paiement d'abonnement (admin). */
export async function adminRejectSubscriptionPayment(orgId, paymentId) {
  const { error } = await supabase.rpc('admin_reject_subscription_payment', {
    p_org_id: orgId, p_payment_id: paymentId,
  });
  if (error) throw new Error(error.message);
}

/** Écoute les changements distants (autres appareils). Retourne une fonction de désabonnement. */
export function subscribeToChanges(onChange) {
  const channel = supabase
    .channel('bestasolar-sync')
    .on('postgres_changes', { event: '*', schema: 'public' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}


// ---- Google Contacts ------------------------------------------------------
// Toute I/O distante reste ici : les écrans et le contexte ne manipulent jamais
// le client Supabase directement. Les Edge Functions gardent les tokens OAuth
// hors du navigateur.
const invokeGoogleContacts = async (functionName, body) => {
  if (!supabase) return { unavailable: true };
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error) throw new Error(error.message || 'Service Google Contacts indisponible.');
  if (data?.error) throw new Error(data.error);
  return data || {};
};

export const getGoogleContactsConfig = () =>
  invokeGoogleContacts('google-contacts-oauth', { action: 'get-config' });

export const startGoogleContactsOAuth = () =>
  invokeGoogleContacts('google-contacts-oauth', { action: 'start' });

export const disconnectGoogleContacts = () =>
  invokeGoogleContacts('google-contacts-oauth', { action: 'disconnect' });

/** Envoie un contact BestaSolar vers la file serveur. Le résultat ne bloque
 *  jamais l'enregistrement local : l'appelant conserve pending/failed pour la
 *  reprise. Les clients viennent du carnet CRM (leads) ou Devis Pro. */
export const syncGoogleContact = (contact, contactType = 'partner') =>
  invokeGoogleContacts('google-contacts-sync', {
    contactId: contact.id,
    contactType,
    contact: {
      id: contact.id,
      // Pour une entreprise, le nom de la personne à joindre est plus utile
      // dans Google Contacts ; le nom de l'entreprise reste dans l'organisation.
      name: contactType === 'lead' || contactType === 'pro_client'
        ? (contact.contact || contact.name)
        : contact.name,
      phone: contact.phone,
      email: contact.email || '',
      company: contactType === 'lead' && contact.clientType === 'entreprise'
        ? contact.name
        : (contact.company || contact.entreprise || ''),
      registeredByUserId: contact.registeredByUserId || contact.assignedTo || contact.userId || null,
      registeredByName: contact.registeredByName || contact.registeredByPartnerName || '',
      registeredByCode: contact.registeredByCode || contact.registeredByPartnerCode || '',
      createdAt: contact.createdAt || null,
      registrationHistory: Array.isArray(contact.registrationHistory) ? contact.registrationHistory : [],
    },
  });

/**
 * Le RÉSEAU, en lecture seule : les partenaires nés de nos codes d'affiliation
 * et les clients qu'ils enregistrent. Chacun a ouvert sa PROPRE organisation ;
 * l'isolation les rendait invisibles à la tête de réseau. Ces deux lectures
 * les montrent sans jamais lever le cloisonnement.
 */
export async function fetchClientsReseau() {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('mes_clients_reseau');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchPartenairesReseau() {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('mes_partenaires_reseau');
  if (error) throw new Error(error.message);
  return data || [];
}

// Compatibilité pour les éventuels appels existants hors du DataContext.
export const syncPartnerGoogleContact = (partner) => syncGoogleContact(partner, 'partner');
