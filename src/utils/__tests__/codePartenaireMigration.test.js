// Migration « code sans préfixe » : BESTA-BINTA-ZSUHKZ devient BINTA-ZSUHKZ.
// Ce qui compte n'est pas le raccourcissement, c'est que RIEN ne se perde au
// passage — le registre des parrainages doit suivre, sinon les commissions
// déjà acquises perdent leur bénéficiaire.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));

// localStorage minimal (environnement de test Node, sans navigateur).
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { loadState, STORAGE_KEY } = await import('../../context/dataState');
const seed = await import('../../data/seed');

const etatSauvegarde = (partners, referrals = []) => ({
  version: seed.SEED_VERSION,
  products: [], orders: [], formations: [], formationProgress: [],
  partners, referrals,
});

const enregistrer = (etat) => store.set(STORAGE_KEY, JSON.stringify(etat));

beforeEach(() => store.clear());

describe('codes partenaires : retrait du préfixe historique', () => {
  it('raccourcit le code en gardant le nom et le suffixe', () => {
    enregistrer(etatSauvegarde([
      { id: 'p9', name: 'Binta Adjo', code: 'BESTA-BINTA-ZSUHKZ', status: 'actif' },
    ]));
    const { partners } = loadState();
    expect(partners.find((p) => p.id === 'p9').code).toBe('BINTA-ZSUHKZ');
  });

  it('reporte le nouveau code sur le registre des parrainages', () => {
    enregistrer(etatSauvegarde(
      [{ id: 'p9', name: 'Binta Adjo', code: 'BESTA-BINTA-ZSUHKZ', status: 'actif' }],
      [{ id: 'r1', partnerCode: 'BESTA-BINTA-ZSUHKZ', status: 'validé' }],
    ));
    const { referrals } = loadState();
    expect(referrals[0].partnerCode).toBe('BINTA-ZSUHKZ');
  });

  it('laisse tel quel un code déjà au nouveau format', () => {
    enregistrer(etatSauvegarde([
      { id: 'p9', name: 'Binta Adjo', code: 'BINTA-ZSUHKZ', status: 'actif' },
    ]));
    expect(loadState().partners.find((p) => p.id === 'p9').code).toBe('BINTA-ZSUHKZ');
  });

  it('ne crée pas de doublon quand deux codes se rejoignent après raccourcissement', () => {
    // Un partenaire portait déjà BINTA, un autre BESTA-BINTA : une fois le
    // préfixe retiré, les deux voudraient le même code.
    enregistrer(etatSauvegarde([
      { id: 'p1', name: 'Binta Adjo', code: 'BINTA', status: 'actif' },
      { id: 'p2', name: 'Binta Kodjo', code: 'BESTA-BINTA', status: 'actif' },
    ]));
    const { partners } = loadState();
    const codes = partners.filter((p) => ['p1', 'p2'].includes(p.id)).map((p) => p.code);
    expect(new Set(codes).size).toBe(2);
  });
});
