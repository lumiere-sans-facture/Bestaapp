import { describe, it, expect } from 'vitest';
import {
  defaultEcheance, montantPaye, resteAPayer, isEnRetard, joursRetard,
  joursAvantEcheance, statutEffectif, relanceMessage, whatsappLink, DELAI_ECHEANCE_JOURS,
} from '../paiement';
import { DAY_MS } from '../date';

const NOW = new Date('2026-07-03T12:00:00Z').getTime();
const iso = (offsetDays) => new Date(NOW + offsetDays * DAY_MS).toISOString();

describe('defaultEcheance', () => {
  it('ajoute le délai par défaut à la date de référence', () => {
    const base = iso(0);
    const ech = defaultEcheance(base);
    expect(new Date(ech).getTime()).toBe(NOW + DELAI_ECHEANCE_JOURS * DAY_MS);
  });
});

describe('montantPaye / resteAPayer', () => {
  it('somme le détail des paiements en priorité', () => {
    const f = { totalTTC: 100000, paiements: [{ montant: 30000 }, { montant: 20000 }] };
    expect(montantPaye(f)).toBe(50000);
    expect(resteAPayer(f)).toBe(50000);
  });
  it('retombe sur montantPaye si pas de détail', () => {
    expect(montantPaye({ totalTTC: 100000, montantPaye: 40000 })).toBe(40000);
  });
  it('ne renvoie jamais un reste négatif (surpaiement)', () => {
    expect(resteAPayer({ totalTTC: 100000, montantPaye: 120000 })).toBe(0);
  });
});

describe('isEnRetard / joursRetard', () => {
  it('détecte une facture émise dont l\'échéance est dépassée', () => {
    const f = { statut: 'emise', totalTTC: 100000, echeance: iso(-5) };
    expect(isEnRetard(f, NOW)).toBe(true);
    expect(joursRetard(f, NOW)).toBe(5);
  });
  it('ignore les brouillons, payées et soldées', () => {
    expect(isEnRetard({ statut: 'brouillon', totalTTC: 100000, echeance: iso(-5) }, NOW)).toBe(false);
    expect(isEnRetard({ statut: 'payee', totalTTC: 100000, echeance: iso(-5) }, NOW)).toBe(false);
    expect(isEnRetard({ statut: 'emise', totalTTC: 100000, montantPaye: 100000, echeance: iso(-5) }, NOW)).toBe(false);
  });
  it('n\'est pas en retard avant l\'échéance', () => {
    expect(isEnRetard({ statut: 'emise', totalTTC: 100000, echeance: iso(5) }, NOW)).toBe(false);
    expect(joursRetard({ statut: 'emise', totalTTC: 100000, echeance: iso(5) }, NOW)).toBe(0);
  });
});

describe('joursAvantEcheance', () => {
  it('compte les jours restants et null sans échéance', () => {
    expect(joursAvantEcheance({ echeance: iso(3) }, NOW)).toBe(3);
    expect(joursAvantEcheance({}, NOW)).toBeNull();
  });
});

describe('statutEffectif', () => {
  const base = { statut: 'emise', totalTTC: 100000, echeance: iso(10) };
  it('dérive payee / partiel / retard / emise', () => {
    expect(statutEffectif({ ...base, statut: 'brouillon' }, NOW)).toBe('brouillon');
    expect(statutEffectif({ ...base, statut: 'payee' }, NOW)).toBe('payee');
    expect(statutEffectif({ ...base, montantPaye: 100000 }, NOW)).toBe('payee');
    expect(statutEffectif({ ...base, montantPaye: 40000 }, NOW)).toBe('partiel');
    expect(statutEffectif(base, NOW)).toBe('emise');
    expect(statutEffectif({ ...base, echeance: iso(-2) }, NOW)).toBe('retard');
  });
});

describe('relanceMessage / whatsappLink', () => {
  it('inclut numéro de facture, reste dû et Mobile Money', () => {
    const f = { numero: 'FAC-2026-001', clientName: 'Kossi', totalTTC: 100000, montantPaye: 30000, echeance: iso(-3) };
    const msg = relanceMessage(f, { nomEntreprise: 'BestaSolar', momo: '01 61 73 29 56', momoNom: 'BestaSolar' });
    expect(msg).toContain('FAC-2026-001');
    expect(msg).toContain('70 000'); // reste 70 000, séparateur espace normale (formatNombre)
    expect(msg).toContain('01 61 73 29 56');
    expect(msg).toContain('Kossi');
  });
  it('normalise le numéro de téléphone dans le lien wa.me', () => {
    expect(whatsappLink('+228 01 61 73 29 56', 'Bonjour')).toBe('https://wa.me/2280161732956?text=Bonjour');
  });
});
