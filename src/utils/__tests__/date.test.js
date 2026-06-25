import { describe, it, expect, afterEach, vi } from 'vitest';
import { DAY_MS, isSameMonth, isInYearMonth, ageInDays, daysSince } from '../date';

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
