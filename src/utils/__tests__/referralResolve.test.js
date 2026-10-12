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
  { id: 'p1', name: 'Mamadou', code: 'MAMADOU', status: 'actif' },
  { id: 'p-user-u2', name: 'Fatou', code: 'FATOU', status: 'actif', userId: 'u2' },
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

// Avec le serveur : une seule règle, celle de la base (niveau 1 = le
// propriétaire du client). Un lien cliqué un jour sur l'appareil ou le parrain
// noté sur la piste ne désignent plus le bénéficiaire du niveau 1 — c'est ce
// qui versait la commission au parrain (ou au gérant) plutôt qu'au technicien.
describe('resolveAutoPartner — règle du serveur', () => {
  const avecTech = [...partners, { id: 'p-user-tech', name: 'Kofi', code: 'KOFI', status: 'actif', userId: 'tech' }];

  it('le technicien qui a enregistré le client, même si le gérant crée le devis', () => {
    const lead = { id: 'l1', registeredByUserId: 'tech', assignedTo: 'u2', parrainL1: 'p1' };
    expect(resolveAutoPartner(lead, avecTech, 'gerant', { regleServeur: true })?.id).toBe('p-user-tech');
  });

  it('sans auteur noté, le commercial assigné, puis le créateur du devis', () => {
    expect(resolveAutoPartner({ id: 'l2', assignedTo: 'u2' }, avecTech, 'tech', { regleServeur: true })?.id).toBe('p-user-u2');
    expect(resolveAutoPartner({ id: 'l3' }, avecTech, 'tech', { regleServeur: true })?.id).toBe('p-user-tech');
  });

  it('aucune fiche partenaire pour ce compte : aucun apporteur affiché', () => {
    expect(resolveAutoPartner({ id: 'l4', registeredByUserId: 'inconnu' }, avecTech, null, { regleServeur: true })).toBeNull();
  });
});
