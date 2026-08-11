import { describe, it, expect } from 'vitest';
import { montantEnLettres, buildRecuCommissionHtml, buildReleveCommissionsHtml } from '../commissionDocs';

const RATES = { 1: 0.03, 2: 0.015 };

describe('montantEnLettres', () => {
  it('écrit les nombres français usuels', () => {
    expect(montantEnLettres(0)).toBe('zéro');
    expect(montantEnLettres(21)).toBe('vingt et un');
    expect(montantEnLettres(71)).toBe('soixante et onze');
    expect(montantEnLettres(80)).toBe('quatre-vingts');
    expect(montantEnLettres(95)).toBe('quatre-vingt-quinze');
    expect(montantEnLettres(200)).toBe('deux cents');
    expect(montantEnLettres(201)).toBe('deux cent un');
    expect(montantEnLettres(1000)).toBe('mille');
    expect(montantEnLettres(55500)).toBe('cinquante-cinq mille cinq cents');
    expect(montantEnLettres(1850000)).toBe('un million huit cent cinquante mille');
  });
});

describe('buildRecuCommissionHtml', () => {
  const commission = {
    id: 'c4-abc', partnerId: 'p2', leadId: 'l2', amount: 55500, level: 1,
    status: 'payée', paidAt: '2026-07-25', createdAt: '2026-06-05',
    payMode: 'momo', payRef: 'MP240725.1234', paidBy: 'u1',
  };
  const html = buildRecuCommissionHtml({
    commission,
    partner: { name: 'Aminata Kesso', code: 'BESTA-AMINATA', phone: '+228 96 44 55 66' },
    lead: { name: 'Hôtel du Parc', estimatedValue: 1850000 },
    payeur: { name: 'Adam Adébiyi' },
    rates: RATES,
  });

  it('contient le n° de reçu, le bénéficiaire et la traçabilité du paiement', () => {
    expect(html).toContain('REC-20260725-C4ABC');
    expect(html).toContain('Aminata Kesso');
    expect(html).toContain('BESTA-AMINATA');
    expect(html).toContain('Mobile Money');
    expect(html).toContain('MP240725.1234');
    expect(html).toContain('Niveau 1 · 3 %');
  });

  it('arrête la somme en lettres', () => {
    expect(html).toContain('cinquante-cinq mille cinq cents');
    expect(html).toContain('55 500');
    expect(html).toContain('francs CFA');
  });

  it('porte les signatures payeur / bénéficiaire', () => {
    expect(html).toContain('Payé par : Adam Adébiyi');
    expect(html).toContain('Reçu par : Aminata Kesso');
  });
});

describe('buildReleveCommissionsHtml', () => {
  const html = buildReleveCommissionsHtml({
    partner: { name: 'Mamadou Balogun', code: 'BESTA-MAMADOU', momoNumber: '+228 97 11 22 33' },
    commissions: [
      { id: 'a', leadId: 'l3', amount: 29400, level: 1, status: 'payée', paidAt: '2026-06-10', createdAt: '2026-06-09', payRef: 'TX1' },
      { id: 'b', leadId: 'l8', amount: 26700, level: 1, status: 'payée', paidAt: '2026-05-25', createdAt: '2026-05-20' },
      { id: 'c', leadId: 'l2', amount: 55500, level: 1, status: 'en_attente', createdAt: '2026-06-05' },
    ],
    getLeadName: (id) => ({ l2: 'Hôtel du Parc', l3: 'Pharmacie Alafia', l8: 'Benz-Benz Radio' }[id]),
    rates: RATES,
  });

  it('détaille chaque commission avec statut et référence', () => {
    expect(html).toContain('Pharmacie Alafia');
    expect(html).toContain('réf. TX1');
    expect(html).toContain('En attente');
    expect(html).toContain('+228 97 11 22 33');
  });

  it('totalise payé / reste à payer et arrête le solde en lettres', () => {
    expect(html).toContain('Total payé (2)');
    expect(html).toContain('56 100');
    expect(html).toContain('Reste à payer (1)');
    expect(html).toContain('55 500');
    expect(html).toContain('cinquante-cinq mille cinq cents');
  });
});
