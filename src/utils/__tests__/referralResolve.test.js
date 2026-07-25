import { describe, it, expect, beforeAll } from 'vitest';
import { resolveAutoPartner } from '../referral';

// getActiveRef lit localStorage : stub minimal pour l'environnement de test
beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
  }
});

const partners = [
  { id: 'p1', name: 'Mamadou', code: 'BESTA-MAMADOU', status: 'actif' },
  { id: 'p-user-u2', name: 'Fatou', code: 'BESTA-FATOU', status: 'actif', userId: 'u2' },
];

describe('resolveAutoPartner', () => {
  it('prend le parrain de la piste en priorité', () => {
    expect(resolveAutoPartner({ parrainL1: 'p1' }, partners, 'u2')?.id).toBe('p1');
  });

  it("retombe sur le profil partenaire du créateur quand la piste n'a pas d'apporteur", () => {
    expect(resolveAutoPartner({ parrainL1: null }, partners, 'u2')?.id).toBe('p-user-u2');
    expect(resolveAutoPartner(null, partners, 'u2')?.id).toBe('p-user-u2');
  });

  it('retourne null sans piste parrainée, sans lien actif et sans créateur', () => {
    expect(resolveAutoPartner({ parrainL1: null }, partners)).toBeNull();
  });
});
