import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { effectiveStatus, isSubscriptionActive, daysLeft, needsRenewalAlert } from '../subscription';

const isoInDays = (n) => new Date(Date.now() + n * 86400000).toISOString();

describe('subscription', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  describe('effectiveStatus', () => {
    it('null si aucun abonnement', () => {
      expect(effectiveStatus(null)).toBeNull();
    });
    it('actif si la date de fin est dans le futur', () => {
      expect(effectiveStatus({ status: 'actif', dateFin: isoInDays(10) })).toBe('actif');
    });
    it('expire si actif mais date de fin passée', () => {
      expect(effectiveStatus({ status: 'actif', dateFin: isoInDays(-1) })).toBe('expire');
    });
    it('conserve les autres statuts tels quels', () => {
      expect(effectiveStatus({ status: 'en_attente' })).toBe('en_attente');
    });
  });

  it('isSubscriptionActive reflète le statut effectif', () => {
    expect(isSubscriptionActive({ status: 'actif', dateFin: isoInDays(5) })).toBe(true);
    expect(isSubscriptionActive({ status: 'actif', dateFin: isoInDays(-5) })).toBe(false);
  });

  describe('daysLeft', () => {
    it('0 sans date de fin', () => {
      expect(daysLeft({ status: 'actif' })).toBe(0);
    });
    it('arrondit au jour supérieur', () => {
      // +4.5 jours -> ceil = 5
      expect(daysLeft({ dateFin: new Date(Date.now() + 4.5 * 86400000).toISOString() })).toBe(5);
    });
    it('jamais négatif', () => {
      expect(daysLeft({ dateFin: isoInDays(-3) })).toBe(0);
    });
  });

  describe('needsRenewalAlert', () => {
    it('vrai si actif et expire dans <= 3 jours', () => {
      expect(needsRenewalAlert({ status: 'actif', dateFin: new Date(Date.now() + 1.5 * 86400000).toISOString() })).toBe(true);
    });
    it('faux si encore loin', () => {
      expect(needsRenewalAlert({ status: 'actif', dateFin: isoInDays(10) })).toBe(false);
    });
    it('faux si non actif', () => {
      expect(needsRenewalAlert({ status: 'en_attente', dateFin: isoInDays(1) })).toBe(false);
    });
  });
});
