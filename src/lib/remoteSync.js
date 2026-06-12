import { supabase } from './supabase';

// Synchronisation des collections métier avec Supabase.
// Chaque entité est une ligne { id, data } ; la logique métier reste
// dans DataContext, ce module ne fait que répliquer l'état.

export const SYNCED_COLLECTIONS = ['products', 'leads', 'partners', 'commissions', 'devis', 'referrals', 'orders', 'formations', 'formationProgress'];

/** Récupère toutes les collections. { empty, collections } */
export async function pullAll() {
  const collections = {};
  let total = 0;
  for (const table of SYNCED_COLLECTIONS) {
    const { data, error } = await supabase.from(table).select('id, data');
    if (error) throw error;
    collections[table] = (data || []).map((row) => ({ ...row.data, id: row.id }));
    total += collections[table].length;
  }
  return { empty: total === 0, collections };
}

/** Réplique les collections passées : upsert de toutes les lignes + suppression des absentes. */
export async function pushCollections(collections) {
  for (const [table, items] of Object.entries(collections)) {
    if (!SYNCED_COLLECTIONS.includes(table) || !Array.isArray(items)) continue;
    const rows = items.map((item) => ({ id: item.id, data: item, updated_at: new Date().toISOString() }));
    if (rows.length) {
      const { error } = await supabase.from(table).upsert(rows);
      if (error) throw error;
    }
    // Supprimer les lignes distantes qui n'existent plus localement
    const { data: remoteIds, error: idsError } = await supabase.from(table).select('id');
    if (idsError) throw idsError;
    const keep = new Set(items.map((i) => i.id));
    const toDelete = (remoteIds || []).map((r) => r.id).filter((id) => !keep.has(id));
    if (toDelete.length) {
      const { error } = await supabase.from(table).delete().in('id', toDelete);
      if (error) throw error;
    }
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
