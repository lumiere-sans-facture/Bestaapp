// Une ligne que le serveur REFUSE ne doit pas emporter toute sa collection.
//
// Postgres rejette le lot ENTIER dès qu'une ligne viole une politique de
// sécurité. Un seul client saisi par un autre membre bloquait donc l'envoi de
// tous les autres, à chaque cycle, indéfiniment — file d'attente qui gonfle,
// voyant rouge permanent, et rien qui repart.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const REFUS = 'new row violates row-level security policy for table "leads"';

const state = { refusees: new Set(), tentatives: [], pushes: [], panne: null };
vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (table) => ({
      select: () => Promise.resolve({ data: [], error: null }),
      upsert: (rows) => {
        state.tentatives.push(rows.map((r) => r.id));
        if (state.panne) return Promise.resolve({ error: { message: state.panne } });
        // Comme Postgres : UNE ligne interdite fait rejeter tout le lot.
        if (rows.some((r) => state.refusees.has(r.id))) return Promise.resolve({ error: { message: REFUS } });
        state.pushes.push({ table, ids: rows.map((r) => r.id) });
        return Promise.resolve({ error: null });
      },
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
    rpc: () => Promise.resolve({ data: null, error: null }),
  },
}));

const { pushCollections, setSyncOrg, lignesRefuseesParTable } = await import('../../lib/remoteSync');

const clients = (n) => Array.from({ length: n }, (_, i) => ({ id: `c-${i + 1}`, name: `Client ${i + 1}` }));

beforeEach(() => {
  state.refusees.clear();
  state.tentatives = [];
  state.pushes = [];
  state.panne = null;
  setSyncOrg(null); // vide aussi le registre des refus
});

describe('isolation des lignes refusées par la sécurité', () => {
  it('écarte la ligne refusée et envoie TOUTES les autres', async () => {
    state.refusees.add('c-4');
    const tables = await pushCollections({ leads: clients(10) }, { isolerRefus: true });

    expect(tables).toEqual(['leads']);
    const envoyes = state.pushes.flatMap((p) => p.ids);
    expect(envoyes).toHaveLength(9);
    expect(envoyes).not.toContain('c-4');
    expect(lignesRefuseesParTable()).toEqual({ leads: 1 });
  });

  it('isole plusieurs lignes refusées d’un même lot', async () => {
    state.refusees.add('c-2');
    state.refusees.add('c-7');
    await pushCollections({ leads: clients(8) }, { isolerRefus: true });

    const envoyes = state.pushes.flatMap((p) => p.ids);
    expect(envoyes.sort()).toEqual(['c-1', 'c-3', 'c-4', 'c-5', 'c-6', 'c-8']);
    expect(lignesRefuseesParTable()).toEqual({ leads: 2 });
  });

  it('ne renvoie plus une ligne déjà refusée : sinon le lot repart au tapis', async () => {
    state.refusees.add('c-3');
    await pushCollections({ leads: clients(5) }, { isolerRefus: true });

    state.tentatives = [];
    state.pushes = [];
    await pushCollections({ leads: clients(5) }, { isolerRefus: true });

    expect(state.tentatives.flat()).not.toContain('c-3');
    expect(state.pushes.flatMap((p) => p.ids)).toHaveLength(4);
  });

  it('une règle corrigée en base suffit : la reconnexion les retente', async () => {
    state.refusees.add('c-1');
    await pushCollections({ leads: clients(3) }, { isolerRefus: true });
    expect(lignesRefuseesParTable()).toEqual({ leads: 1 });

    setSyncOrg('org-besta');          // nouvelle session
    state.refusees.clear();           // le gérant a exécuté le SQL
    state.pushes = [];
    await pushCollections({ leads: clients(3) }, { isolerRefus: true });

    expect(state.pushes.flatMap((p) => p.ids)).toHaveLength(3);
    expect(lignesRefuseesParTable()).toEqual({});
  });

  it('sans isolation, le refus remonte : le réalignement d’organisation garde sa chance', async () => {
    state.refusees.add('c-1');
    await expect(pushCollections({ leads: clients(3) })).rejects.toThrow(/row-level security/);
    expect(lignesRefuseesParTable()).toEqual({});
  });

  it('ne rejoue pas un refus : il est déterministe, pas une micro-coupure', async () => {
    state.refusees.add('c-1');
    await pushCollections({ leads: [{ id: 'c-1' }] }, { isolerRefus: true });
    expect(state.tentatives).toHaveLength(1); // et non trois
  });

  it('une panne réseau pendant l’isolation remonte à l’appelant', async () => {
    state.refusees.add('c-2');
    state.panne = 'Failed to fetch';
    await expect(pushCollections({ leads: clients(4) }, { isolerRefus: true })).rejects.toBeTruthy();
  });

  it('tout refuser ne déclenche pas une avalanche d’envois', async () => {
    const lot = clients(60);
    for (const c of lot) state.refusees.add(c.id);
    await pushCollections({ leads: lot }, { isolerRefus: true });

    expect(state.tentatives.length).toBeLessThanOrEqual(50); // budget d'isolation
    expect(lignesRefuseesParTable().leads).toBe(60);
  });
});
