// Résilience de la réplication : une donnée dont l'envoi échoue ne doit JAMAIS
// être considérée comme synchronisée — sinon elle est perdue en silence.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Double minimal de Supabase : on choisit quelles tables échouent.
const state = { echoue: new Set(), pushes: [] };
vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (table) => ({
      select: () => Promise.resolve({ data: [], error: null }),
      upsert: (rows) => {
        if (state.echoue.has(table)) return Promise.resolve({ error: { message: 'réseau' } });
        state.pushes.push({ table, rows });
        return Promise.resolve({ error: null });
      },
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
    rpc: () => Promise.resolve({ data: null, error: null }),
  },
}));

const { pushCollections } = await import('../../lib/remoteSync');

beforeEach(() => { state.echoue.clear(); state.pushes = []; });

describe('pushCollections signale les échecs au lieu de les avaler', () => {
  it('rejette quand le serveur refuse une écriture', async () => {
    state.echoue.add('leads');
    await expect(pushCollections({ leads: [{ id: 'l1', name: 'X' }] })).rejects.toBeTruthy();
  });

  it('réussit silencieusement quand tout passe', async () => {
    await expect(pushCollections({ leads: [{ id: 'l1', name: 'X' }] })).resolves.toBeUndefined();
    expect(state.pushes).toHaveLength(1);
  });

  it('une collection vide n’émet aucune écriture', async () => {
    await pushCollections({ leads: [] });
    expect(state.pushes).toHaveLength(0);
  });
});
