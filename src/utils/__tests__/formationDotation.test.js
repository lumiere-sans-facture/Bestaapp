// Dotation des nouveaux cours de formation : un cours ajouté au seed par une
// mise à jour de l'application est injecté UNE SEULE FOIS dans les états
// existants — et ne ressuscite jamais après suppression par le gérant.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));

// localStorage minimal (environnement de test Node, sans navigateur).
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { loadState, buildInitialState, STORAGE_KEY } = await import('../../context/dataState');
const seed = await import('../../data/seed');

// État sauvegardé minimal traversant toutes les migrations de loadState.
const etatSauvegarde = (formations, extra = {}) => ({
  version: seed.SEED_VERSION,
  products: [], partners: [], referrals: [], orders: [],
  formations, formationProgress: [],
  ...extra,
});

beforeEach(() => store.clear());

describe('dotation des nouveaux cours du seed', () => {
  it('un état antérieur reçoit les cours manquants — sans toucher aux cours existants', () => {
    const coursModifie = { id: 'f1', title: 'Mon cours personnalisé', modules: [] };
    store.set(STORAGE_KEY, JSON.stringify(etatSauvegarde([coursModifie])));
    const s = loadState();
    // Le cours modifié par le gérant est conservé tel quel (jamais écrasé).
    expect(s.formations.find((f) => f.id === 'f1').title).toBe('Mon cours personnalisé');
    // Les cours du seed absents de l'état sont dotés.
    for (const f of seed.formations) {
      expect(s.formations.some((x) => x.id === f.id)).toBe(true);
    }
    // Le registre mémorise la dotation pour ne plus jamais la rejouer.
    expect(s.formationsDotees).toEqual(expect.arrayContaining(seed.formations.map((f) => f.id)));
  });

  it('un cours doté puis supprimé par le gérant ne réapparaît pas', () => {
    const sansF4 = seed.formations.filter((f) => f.id !== 'f4');
    store.set(STORAGE_KEY, JSON.stringify(etatSauvegarde(sansF4, {
      formationsDotees: seed.formations.map((f) => f.id),
    })));
    const s = loadState();
    expect(s.formations.some((f) => f.id === 'f4')).toBe(false);
  });

  it('la dotation est idempotente : recharger ne duplique aucun cours', () => {
    store.set(STORAGE_KEY, JSON.stringify(etatSauvegarde([...seed.formations])));
    const premier = loadState();
    store.set(STORAGE_KEY, JSON.stringify(premier));
    const second = loadState();
    const ids = second.formations.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(second.formations).toHaveLength(premier.formations.length);
  });

  it('l’état initial embarque tous les cours et le registre complet', () => {
    const s = buildInitialState();
    expect(s.formations).toEqual(seed.formations);
    expect(s.formationsDotees).toEqual(seed.formations.map((f) => f.id));
  });
});
