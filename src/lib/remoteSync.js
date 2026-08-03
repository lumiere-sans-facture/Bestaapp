import { supabase } from './supabase';

// Synchronisation des collections métier avec Supabase.
// Chaque entité est une ligne { id, data } ; la logique métier reste
// dans DataContext, ce module ne fait que répliquer l'état.

export const SYNCED_COLLECTIONS = ['products', 'leads', 'partners', 'commissions', 'devis', 'referrals', 'orders', 'formations', 'formationProgress', 'subscriptions', 'subscriptionPayments', 'companies', 'factures', 'proClients'];

// Organisation courante (schéma multi-entreprise). Renseignée par AuthContext
// au chargement du profil ; absente (null) sur l'ancien schéma mono-équipe —
// les lignes sont alors poussées sans org_id, comme avant.
let currentOrgId = null;
// Type de l'organisation ('interne' = BestaSolar, 'pro' = externe). Le catalogue
// est l'actif interne BestaSolar, partagé en LECTURE à toutes les entreprises :
// seule l'organisation interne le pousse. Tant que le type est inconnu, on
// s'abstient de pousser les produits (prudence : jamais de copie).
let currentOrgKind = null;
const SHARED_ORG_ID = 'org-bestasolar';
const pushesProducts = () => !currentOrgId || currentOrgKind === 'interne';
export const setSyncOrg = (orgId, kind = null) => {
  currentOrgId = orgId || null;
  currentOrgKind = kind || null;
};
const withOrg = (row) => (currentOrgId ? { ...row, org_id: currentOrgId } : row);

/** Récupère toutes les collections + les tombstones. { empty, collections, tombstones } */
export async function pullAll() {
  // Lecture des collections en parallèle (au lieu de 15 allers-retours séquentiels).
  const fetched = await Promise.all(
    SYNCED_COLLECTIONS.map(async (table) => {
      // Catalogue partagé : en multi-entreprise, la lecture renvoie aussi les
      // produits BestaSolar. Une entreprise ayant reçu une copie historique
      // verrait des doublons — on garde la ligne BestaSolar (source de vérité).
      const dedupe = table === 'products' && currentOrgId;
      const { data, error } = await supabase.from(table).select(dedupe ? 'id, data, org_id' : 'id, data');
      if (error) throw error;
      let rows = data || [];
      if (dedupe) {
        const shared = new Set(rows.filter((r) => r.org_id === SHARED_ORG_ID).map((r) => r.id));
        rows = rows.filter((r) => r.org_id === SHARED_ORG_ID || !shared.has(r.id));
      }
      return [table, rows.map((row) => ({ ...row.data, id: row.id }))];
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
        collections[table] = collections[table].filter((item) => !deleted.has(item.id));
      }
    }
  } catch {
    // Table tombstones absente : déploiement progressif, pas de filtrage
  }

  return { empty: total === 0, collections, tombstones };
}

/** Réplique les collections passées : upsert uniquement, non-destructif.
 *  Les suppressions passent exclusivement par pushTombstone. */
export async function pushCollections(collections) {
  // Upserts indépendants (tables distinctes) exécutés en parallèle.
  await Promise.all(
    Object.entries(collections).map(async ([table, items]) => {
      if (!SYNCED_COLLECTIONS.includes(table) || !Array.isArray(items)) return;
      // Le catalogue n'est poussé que par l'organisation interne BestaSolar.
      if (table === 'products' && !pushesProducts()) return;
      // Vérité serveur : un abonnement « actif » et un paiement « confirme »
      // ne s'écrivent que côté serveur (RPC admin). L'app ne les repousse
      // jamais — la RLS les rejetterait et bloquerait toute la réplication.
      if (currentOrgId && table === 'subscriptions') items = items.filter((i) => i.status !== 'actif');
      if (currentOrgId && table === 'subscriptionPayments') items = items.filter((i) => i.statut !== 'confirme');
      const rows = items.map((item) => withOrg({ id: item.id, data: item, updated_at: new Date().toISOString() }));
      if (!rows.length) return;
      const { error } = await supabase.from(table).upsert(rows);
      if (error) throw error;
    })
  );
}

/** Enregistre une suppression dans la table tombstones (non-destructif). */
export async function pushTombstone(table, id) {
  // Une entreprise externe ne supprime jamais le catalogue partagé (un
  // tombstone local masquerait les produits BestaSolar à la réception).
  if (table === 'products' && !pushesProducts()) return;
  const { error } = await supabase
    .from('tombstones')
    .upsert(withOrg({ id, collection: table, deleted_at: new Date().toISOString() }));
  if (error) throw error;
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
