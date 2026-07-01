import { supabase } from './supabase';

// Synchronisation des collections métier avec Supabase.
// Chaque entité est une ligne { id, data } ; la logique métier reste
// dans DataContext, ce module ne fait que répliquer l'état.

export const SYNCED_COLLECTIONS = ['products', 'leads', 'partners', 'commissions', 'devis', 'referrals', 'orders', 'formations', 'formationProgress', 'subscriptions', 'subscriptionPayments', 'companies', 'factures', 'proClients'];

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
      const rows = items.map((item) => ({ id: item.id, data: item, updated_at: new Date().toISOString() }));
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
    .upsert({ id, collection: table, deleted_at: new Date().toISOString() });
  if (error) throw error;
  // Supprimer aussi la ligne de la table source (cohérence distante)
  await supabase.from(table).delete().eq('id', id);
}

/** Écoute les changements distants (autres appareils). Retourne une fonction de désabonnement. */
export function subscribeToChanges(onChange) {
  const channel = supabase
    .channel('bestasolar-sync')
    .on('postgres_changes', { event: '*', schema: 'public' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
