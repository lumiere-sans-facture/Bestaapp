import { supabase } from './supabase';

// Synchronisation des collections métier avec Supabase.
// Chaque entité est une ligne { id, data } ; la logique métier reste
// dans DataContext, ce module ne fait que répliquer l'état.

export const SYNCED_COLLECTIONS = ['products', 'leads', 'partners', 'commissions', 'devis', 'referrals', 'orders', 'formations', 'formationProgress', 'subscriptions', 'subscriptionPayments', 'companies', 'factures', 'proClients'];

// Organisation courante (schéma multi-entreprise). Renseignée par AuthContext
// au chargement du profil ; absente (null) sur l'ancien schéma mono-équipe —
// les lignes sont alors poussées sans org_id, comme avant.
let currentOrgId = null;
export const setSyncOrg = (orgId) => { currentOrgId = orgId || null; };
const withOrg = (row) => (currentOrgId ? { ...row, org_id: currentOrgId } : row);

/** Récupère toutes les collections + les tombstones. { empty, collections, tombstones } */
export async function pullAll() {
  // Lecture des collections en parallèle (au lieu de 15 allers-retours séquentiels).
  const fetched = await Promise.all(
    SYNCED_COLLECTIONS.map(async (table) => {
      const { data, error } = await supabase.from(table).select('id, data');
      if (error) throw error;
      return [table, (data || []).map((row) => ({ ...row.data, id: row.id }))];
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
      const rows = items.map((item) => withOrg({ id: item.id, data: item, updated_at: new Date().toISOString() }));
      if (!rows.length) return;
      const { error } = await supabase.from(table).upsert(rows);
      if (error) throw error;
    })
  );
}

/** Enregistre une suppression dans la table tombstones (non-destructif). */
export async function pushTombstone(table, id) {
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

/** Profils de l'équipe (la RLS limite déjà à l'organisation de l'utilisateur).
 *  Forme identique aux utilisateurs du seed : { id, name, role, phone, avatar }. */
export async function fetchTeamProfiles() {
  const { data, error } = await supabase.from('profiles').select('id, email, name, role, phone, avatar');
  if (error) throw error;
  return (data || []).map((p) => ({
    ...p,
    avatar: p.avatar || p.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
  }));
}

/** Organisation de l'utilisateur courant (nom + code d'invitation d'équipe).
 *  Retourne null sur l'ancien schéma mono-équipe (table orgs absente). */
export async function fetchMyOrg() {
  try {
    const { data, error } = await supabase.from('orgs').select('id, name, invite_code').limit(1);
    if (error) return null;
    return data?.[0] || null;
  } catch {
    return null;
  }
}

/** Écoute les changements distants (autres appareils). Retourne une fonction de désabonnement. */
export function subscribeToChanges(onChange) {
  const channel = supabase
    .channel('bestasolar-sync')
    .on('postgres_changes', { event: '*', schema: 'public' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
