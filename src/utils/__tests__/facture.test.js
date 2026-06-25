import { describe, it, expect } from 'vitest';
import { computeFactureTotals, FACTURE_STATUT_LABEL, FACTURE_STATUT_BADGE } from '../facture';

describe('computeFactureTotals', () => {
  const lignes = [
    { pu: 1000, qty: 2 }, // 2000
    { pu: 500, qty: 1 },  // 500
  ];

  it('somme le HT sans TVA quand non assujettie', () => {
    expect(computeFactureTotals(lignes, false)).toEqual({ totalHT: 2500, tva: 0, totalTTC: 2500 });
  });

  it('applique la TVA 18 % arrondie quand assujettie', () => {
    // 2500 * 0.18 = 450
    expect(computeFactureTotals(lignes, true)).toEqual({ totalHT: 2500, tva: 450, totalTTC: 2950 });
  });

  it('arrondit la TVA à l’entier', () => {
    // 333 * 0.18 = 59.94 -> 60
    expect(computeFactureTotals([{ pu: 333, qty: 1 }], true).tva).toBe(60);
  });

  it('tolère des montants en chaîne et des champs manquants', () => {
    expect(computeFactureTotals([{ pu: '1500', qty: '2' }, { qty: 3 }], false).totalHT).toBe(3000);
  });

  it('renvoie des totaux nuls pour une liste vide', () => {
    expect(computeFactureTotals([], true)).toEqual({ totalHT: 0, tva: 0, totalTTC: 0 });
  });
});

describe('constantes de statut', () => {
  it('couvre les trois statuts', () => {
    expect(FACTURE_STATUT_LABEL).toEqual({ brouillon: 'Brouillon', emise: 'Émise', payee: 'Payée' });
    expect(FACTURE_STATUT_BADGE.payee[0]).toBe('badge-success');
  });
});
