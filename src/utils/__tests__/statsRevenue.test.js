import { describe, it, expect } from 'vitest';
import { computeMonthlyRevenue } from '../stats';
import { paiementEntries } from '../paiement';

// Dates relatives au mois courant (computeMonthlyRevenue s'ancre sur « maintenant »).
const thisMonth = () => new Date().toISOString();
const monthsAgo = (n) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - n, 15).toISOString();
};

describe('paiementEntries', () => {
  it('renvoie le détail des paiements quand il existe', () => {
    const f = { totalTTC: 100000, paiements: [{ date: thisMonth(), montant: 30000 }, { date: thisMonth(), montant: 20000 }] };
    expect(paiementEntries(f).map((e) => e.montant)).toEqual([30000, 20000]);
  });
  it('replie une facture payée sans détail sur sa date de création', () => {
    const f = { statut: 'payee', totalTTC: 80000, createdAt: monthsAgo(1) };
    expect(paiementEntries(f)).toEqual([{ date: f.createdAt, montant: 80000 }]);
  });
  it('replie sur montantPaye pour une facture non soldée sans détail', () => {
    const f = { statut: 'emise', totalTTC: 80000, montantPaye: 25000, createdAt: thisMonth() };
    expect(paiementEntries(f)).toEqual([{ date: f.createdAt, montant: 25000 }]);
  });
  it('renvoie vide sans encaissement', () => {
    expect(paiementEntries({ statut: 'emise', totalTTC: 80000, createdAt: thisMonth() })).toEqual([]);
  });
});

describe('computeMonthlyRevenue (encaissements réels)', () => {
  it('ventile les acomptes par mois de paiement, pas par mois de création', () => {
    const factures = [
      // Facture créée il y a 2 mois, acompte il y a 1 mois, solde ce mois-ci.
      {
        statut: 'emise', totalTTC: 100000, createdAt: monthsAgo(2),
        paiements: [{ date: monthsAgo(1), montant: 40000 }, { date: thisMonth(), montant: 60000 }],
      },
      // Ancienne facture payée sans détail : comptée à sa création.
      { statut: 'payee', totalTTC: 50000, createdAt: monthsAgo(1) },
      // Émise sans paiement : ne compte pas.
      { statut: 'emise', totalTTC: 999999, createdAt: thisMonth() },
    ];
    const out = computeMonthlyRevenue(factures, 6);
    expect(out).toHaveLength(6);
    expect(out[5].revenue).toBe(60000); // mois courant
    expect(out[5].count).toBe(1);
    expect(out[4].revenue).toBe(90000); // il y a 1 mois : 40 000 + 50 000
    expect(out[4].count).toBe(2);
    expect(out[3].revenue).toBe(0); // mois de création : rien d'encaissé
  });
});
