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

const { pushCollections, decouperEnLots } = await import('../../lib/remoteSync');

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

describe('decouperEnLots — un gros catalogue ne bloque plus la synchronisation', () => {
  it('un petit ensemble tient dans un seul envoi', () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    expect(decouperEnLots(rows, 10000)).toHaveLength(1);
  });

  it('découpe dès que le poids dépasse la limite', () => {
    // 10 lignes d'environ 1 Ko, limite à 3 Ko → au moins 4 lots.
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, data: 'x'.repeat(1000) }));
    const lots = decouperEnLots(rows, 3000);
    expect(lots.length).toBeGreaterThanOrEqual(4);
    expect(lots.flat()).toHaveLength(10); // rien n'est perdu
  });

  it('une ligne plus lourde que la limite part seule, jamais ignorée', () => {
    const rows = [{ id: 'photo', data: 'x'.repeat(50000) }, { id: 'b' }];
    const lots = decouperEnLots(rows, 1000);
    expect(lots[0]).toHaveLength(1);
    expect(lots.flat()).toHaveLength(2);
  });

  it('préserve l’ordre des lignes', () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, data: 'y'.repeat(500) }));
    expect(decouperEnLots(rows, 1200).flat().map((r) => r.id))
      .toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5']);
  });

  it('ensemble vide : aucun envoi', () => {
    expect(decouperEnLots([], 1000)).toHaveLength(0);
  });
});
