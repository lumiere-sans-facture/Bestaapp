import { describe, it, expect } from 'vitest';
import { dateEmissionDevis, versChampDate, depuisChampDate, problemeDateEmission } from '../dateEmission';
import { dateExpiration, estDevisSansSuite } from '../affaires';
import { donneesDeDevis } from '../docTemplates/shared';

describe('dateEmissionDevis', () => {
  it('prend la date choisie, sinon l’ancien champ, sinon la création', () => {
    expect(dateEmissionDevis({ dateEmission: 'A', date: 'B', createdAt: 'C' })).toBe('A');
    expect(dateEmissionDevis({ date: 'B', createdAt: 'C' })).toBe('B');
    expect(dateEmissionDevis({ createdAt: 'C' })).toBe('C');
    expect(dateEmissionDevis(null)).toBeNull();
  });
});

describe('champ date', () => {
  it('fait l’aller-retour sans changer de jour', () => {
    const iso = depuisChampDate('2026-09-10');
    expect(versChampDate(iso)).toBe('2026-09-10');
    expect(new Date(iso).getHours()).toBe(12); // midi local : pas de bascule sur la veille
  });
  it('refuse une date qui n’existe pas', () => {
    expect(depuisChampDate('2026-02-31')).toBeNull();
    expect(depuisChampDate('10/09/2026')).toBeNull();
    expect(depuisChampDate('')).toBeNull();
    expect(versChampDate('pas une date')).toBe('');
  });
});

describe('problemeDateEmission', () => {
  const maintenant = new Date(2026, 8, 24, 15);
  it('accepte aujourd’hui et le passé', () => {
    expect(problemeDateEmission('2026-09-24', maintenant)).toBeNull();
    expect(problemeDateEmission('2026-08-01', maintenant)).toBeNull();
  });
  it('refuse le futur et l’invalide', () => {
    expect(problemeDateEmission('2026-09-25', maintenant)).toMatch(/futur/);
    expect(problemeDateEmission('1999-12-31', maintenant)).toBe('Date invalide.');
    expect(problemeDateEmission('', maintenant)).toBe('Date invalide.');
  });
});

describe('la date d’émission gouverne le document et le suivi', () => {
  const devis = {
    id: 'd1', devisNumber: 'BS-20260924-0001', type: 'solar', total: 100000,
    createdAt: '2026-09-24T09:00:00.000Z', dateEmission: depuisChampDate('2026-09-01'), lignes: [],
  };
  it('le document porte la date d’émission, et sa validité en part', () => {
    const data = donneesDeDevis({ devis, company: {}, lead: null, products: [] });
    expect(versChampDate(data.date)).toBe('2026-09-01');
    expect(versChampDate(data.dateSecondaire)).toBe('2026-10-01');
  });
  it('l’expiration se compte depuis l’émission', () => {
    expect(dateExpiration(devis)).toBe(new Date(new Date(devis.dateEmission).getTime() + 30 * 86400000).toISOString().slice(0, 10));
  });
  it('un devis antidaté peut être « sans suite » dès aujourd’hui', () => {
    expect(estDevisSansSuite(devis, null, 14, new Date('2026-09-24T12:00:00Z'))).toBe(true);
    expect(estDevisSansSuite({ ...devis, dateEmission: undefined }, null, 14, new Date('2026-09-24T12:00:00Z'))).toBe(false);
  });
});
