// Un produit ajouté au catalogue officiel (data/catalogue.js) doit rejoindre
// les appareils DÉJÀ installés : c'est par eux qu'il atteint la base partagée
// en production (l'organisation interne pousse tout produit qu'elle a et que
// le serveur n'a pas). Sans cette dotation, les congélateurs de la brochure
// « froid solaire » n'existeraient que sur un téléphone neuf.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { loadState, STORAGE_KEY } = await import('../../context/dataState');
const seed = await import('../../data/seed');

const FROID = ['congel-bd198', 'congel-bcd202', 'congel-bd004-318', 'congel-bd004-218', 'congel-bd004-168', 'congel-bd004-118',
  'kit-congel-218', 'kit-congel-318', 'kit-congel-168', 'kit-congel-118', 'kit-congel-198', 'kit-congel-202'];

// Appareil installé AVANT la brochure : tout le catalogue sauf le froid,
// avec un prix retouché par le gérant.
const etatAncien = () => ({
  version: seed.SEED_VERSION,
  products: seed.products
    .filter((p) => !FROID.includes(p.id))
    .map((p) => (p.id === 'cat-p2r1' ? { ...p, basePrice: 700000 } : p)),
  partners: [], referrals: [], orders: [], formations: [], formationProgress: [], kits: [],
});

beforeEach(() => store.clear());

describe('dotation des nouveaux produits du catalogue', () => {
  it('un appareil déjà installé reçoit les congélateurs et les kits congélateur', () => {
    store.set(STORAGE_KEY, JSON.stringify(etatAncien()));
    const ids = loadState().products.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(FROID));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sans toucher aux prix retouchés par le gérant', () => {
    store.set(STORAGE_KEY, JSON.stringify(etatAncien()));
    expect(loadState().products.find((p) => p.id === 'cat-p2r1').basePrice).toBe(700000);
  });

  it('range les congélateurs dans « Congélateurs » et les kits dans « Kits »', () => {
    const froid = seed.products.filter((p) => FROID.includes(p.id));
    expect(froid).toHaveLength(FROID.length);
    for (const p of froid) expect(p.category).toBe(p.id.startsWith('kit-') ? 'kits' : 'congelateurs');
  });

  it('ne glisse aucun article du froid parmi les composants du dimensionnement', () => {
    // Le dimensionnement pioche onduleurs, batteries et panneaux par
    // catégorie : une batterie 12 V de kit congélateur n'a rien à y faire.
    const composants = new Set(['onduleurs', 'batteries', 'panneaux']);
    expect(seed.products.filter((p) => FROID.includes(p.id) && composants.has(p.category))).toEqual([]);
  });
});
