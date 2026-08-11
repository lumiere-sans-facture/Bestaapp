// Mode SaaS (backend configuré) : AUCUNE copie locale des cours du seed.
// Les cours sont l'actif de l'organisation interne, reçus du serveur en
// lecture partagée — doter chaque entreprise d'un double (mêmes ids) faisait
// ressurgir une version périmée dès que la version partagée était masquée
// ou supprimée par son propriétaire.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: {} }));

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { loadState, buildInitialState, STORAGE_KEY } = await import('../../context/dataState');
const seed = await import('../../data/seed');

beforeEach(() => store.clear());

describe('formations en mode SaaS : jamais de copie locale du seed', () => {
  it('un nouvel état démarre sans cours (ils arriveront du serveur, partagés)', () => {
    const s = buildInitialState();
    expect(s.formations).toEqual([]);
  });

  it('un état existant ne reçoit AUCUNE dotation — pas de doublons recréés', () => {
    const monCours = { id: 'perso', title: 'Cours de mon entreprise', modules: [] };
    store.set(STORAGE_KEY, JSON.stringify({
      version: seed.SEED_VERSION,
      products: [], partners: [], referrals: [], orders: [],
      formations: [monCours], formationProgress: [],
    }));
    const s = loadState();
    expect(s.formations).toEqual([monCours]);
  });

  it('un état sans collection formations repart vide, pas du seed', () => {
    store.set(STORAGE_KEY, JSON.stringify({
      version: seed.SEED_VERSION,
      products: [], partners: [], referrals: [], orders: [],
      formationProgress: [],
    }));
    const s = loadState();
    expect(s.formations).toEqual([]);
  });
});
