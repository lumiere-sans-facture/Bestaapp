import { describe, it, expect, afterEach, vi } from 'vitest';
import { DAY_MS, isSameMonth, isInYearMonth, ageInDays, daysSince, jourLocal, decalerJour, joursEntre, jourFr } from '../date';

describe('DAY_MS', () => {
  it('vaut un jour en millisecondes', () => {
    expect(DAY_MS).toBe(86400000);
  });
});

describe('isSameMonth', () => {
  const ref = new Date(2026, 5, 1); // juin 2026 (local)
  it('vrai dans le même mois', () => {
    expect(isSameMonth(new Date(2026, 5, 28), ref)).toBe(true);
  });
  it('faux pour un autre mois', () => {
    expect(isSameMonth(new Date(2026, 4, 31), ref)).toBe(false);
  });
  it('faux pour une autre année, même mois', () => {
    expect(isSameMonth(new Date(2025, 5, 15), ref)).toBe(false);
  });
  it('faux pour une valeur absente', () => {
    expect(isSameMonth(null, ref)).toBe(false);
  });
});

describe('isInYearMonth', () => {
  it('compare année + mois (mois indexé à 0)', () => {
    expect(isInYearMonth(new Date(2026, 5, 15), 2026, 5)).toBe(true);
    expect(isInYearMonth(new Date(2026, 6, 1), 2026, 5)).toBe(false);
    expect(isInYearMonth(null, 2026, 5)).toBe(false);
  });
});

describe('ageInDays', () => {
  it('compte les jours réels écoulés', () => {
    const ref = new Date(2026, 5, 15, 12, 0, 0);
    const iso = new Date(ref.getTime() - 3 * DAY_MS);
    expect(ageInDays(iso, ref)).toBe(3);
  });
  it('renvoie Infinity sans date', () => {
    expect(ageInDays(null)).toBe(Infinity);
  });
});

describe('daysSince', () => {
  afterEach(() => vi.useRealTimers());
  it('compte les jours entiers depuis maintenant', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
    const iso = new Date(Date.now() - 5 * DAY_MS).toISOString();
    expect(daysSince(iso)).toBe(5);
  });
});

describe('jours calendaires', () => {
  it('jourLocal lit le jour LOCAL, pas celui de l’UTC', () => {
    expect(jourLocal(new Date(2026, 9, 14, 23, 30))).toBe('2026-10-14');
    expect(jourLocal(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05');
  });

  it('decalerJour traverse fins de mois et d’année', () => {
    expect(decalerJour('2026-09-23', 21)).toBe('2026-10-14');
    expect(decalerJour('2026-12-28', 7)).toBe('2027-01-04');
    expect(decalerJour('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('joursEntre compte les jours, signe compris', () => {
    expect(joursEntre('2026-10-14', '2026-10-16')).toBe(2);
    expect(joursEntre('2026-10-16', '2026-10-14')).toBe(-2);
    expect(joursEntre('2026-03-28', '2026-03-30')).toBe(2); // passage à l'heure d'été en Europe
  });

  it('jourFr met au format JJ/MM/AAAA', () => {
    expect(jourFr('2026-09-23')).toBe('23/09/2026');
    expect(jourFr(null)).toBe('');
  });
});
