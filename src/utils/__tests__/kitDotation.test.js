// Dotation des nouveaux kits officiels : un kit ajouté à data/kits.js par une
// mise à jour de l'application rejoint les états existants UNE SEULE FOIS —
// et ne ressuscite jamais après suppression par le gérant.
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
const { SOLAR_KITS, KITS_DOTES_AVANT_REGISTRE } = await import('../../data/kits');
const seed = await import('../../data/seed');

// État sauvegardé minimal traversant toutes les migrations de loadState.
const etatSauvegarde = (kits, extra = {}) => ({
  version: seed.SEED_VERSION,
  products: [], partners: [], referrals: [], orders: [],
  formations: [], formationProgress: [],
  kits,
  ...extra,
});

const anciensKits = () => SOLAR_KITS.filter((k) => KITS_DOTES_AVANT_REGISTRE.includes(k.id));

beforeEach(() => store.clear());

describe('dotation des nouveaux kits officiels', () => {
  it('un état antérieur au registre reçoit les kits manquants', () => {
    store.set(STORAGE_KEY, JSON.stringify(etatSauvegarde(anciensKits())));
    const s = loadState();
    for (const k of SOLAR_KITS) expect(s.kits.some((x) => x.id === k.id)).toBe(true);
    expect(s.kitsDotes).toEqual(expect.arrayContaining(SOLAR_KITS.map((k) => k.id)));
  });

  it('un kit modifié par le gérant n’est jamais écrasé', () => {
    const modifie = { ...SOLAR_KITS[0], name: 'Mon kit maison' };
    const autres = anciensKits().filter((k) => k.id !== modifie.id);
    store.set(STORAGE_KEY, JSON.stringify(etatSauvegarde([modifie, ...autres])));
    const s = loadState();
    expect(s.kits.find((k) => k.id === modifie.id).name).toBe('Mon kit maison');
  });

  it('un kit supprimé avant le registre ne réapparaît pas', () => {
    // Cas critique : sans la liste figée KITS_DOTES_AVANT_REGISTRE, un kit
    // d'origine absent passerait pour « jamais doté » et reviendrait.
    store.set(STORAGE_KEY, JSON.stringify(
      etatSauvegarde(anciensKits().filter((k) => k.id !== 'kit-20kwh'))
    ));
    const s = loadState();
    expect(s.kits.some((k) => k.id === 'kit-20kwh')).toBe(false);
    expect(s.kits.some((k) => k.id === 'kit-16kwh')).toBe(true);
  });

  it('un kit doté puis supprimé par le gérant ne réapparaît pas', () => {
    store.set(STORAGE_KEY, JSON.stringify(etatSauvegarde(
      SOLAR_KITS.filter((k) => k.id !== 'kit-16kwh'),
      { kitsDotes: SOLAR_KITS.map((k) => k.id) }
    )));
    const s = loadState();
    expect(s.kits.some((k) => k.id === 'kit-16kwh')).toBe(false);
  });

  it('la dotation est idempotente : recharger ne duplique aucun kit', () => {
    store.set(STORAGE_KEY, JSON.stringify(etatSauvegarde(anciensKits())));
    const premier = loadState();
    store.set(STORAGE_KEY, JSON.stringify(premier));
    const second = loadState();
    const ids = second.kits.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(second.kits).toHaveLength(premier.kits.length);
  });

  it('l’état initial embarque tous les kits et le registre complet', () => {
    const s = buildInitialState();
    expect(s.kits).toEqual(SOLAR_KITS);
    expect(s.kitsDotes).toEqual(SOLAR_KITS.map((k) => k.id));
  });
});
