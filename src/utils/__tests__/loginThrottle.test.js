import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { getLockState, registerFailedAttempt, clearAttempts, formatLockRemaining } from '../loginThrottle';

// localStorage lu/écrit par le module : stub minimal pour l'environnement de test
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

beforeEach(() => {
  localStorage.removeItem('bestasolar_login_throttle');
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
});

describe('loginThrottle', () => {
  it("n'est pas verrouillé avant tout échec", () => {
    expect(getLockState('adam@bestasolar.tg')).toEqual({ locked: false, remainingMs: 0 });
  });

  it('verrouille au 5e échec, pas avant', () => {
    for (let i = 0; i < 4; i += 1) {
      expect(registerFailedAttempt('adam@bestasolar.tg').locked).toBe(false);
    }
    expect(registerFailedAttempt('adam@bestasolar.tg').locked).toBe(true);
  });

  it('le verrou se lève après 15 minutes', () => {
    for (let i = 0; i < 5; i += 1) registerFailedAttempt('adam@bestasolar.tg');
    expect(getLockState('adam@bestasolar.tg').locked).toBe(true);
    vi.advanceTimersByTime(15 * 60 * 1000 + 1000);
    expect(getLockState('adam@bestasolar.tg').locked).toBe(false);
  });

  it('double la durée du verrou à chaque nouveau cycle (progressif)', () => {
    for (let i = 0; i < 5; i += 1) registerFailedAttempt('adam@bestasolar.tg');
    const first = getLockState('adam@bestasolar.tg').remainingMs;
    vi.advanceTimersByTime(15 * 60 * 1000 + 1000); // lève le premier verrou
    for (let i = 0; i < 5; i += 1) registerFailedAttempt('adam@bestasolar.tg');
    const second = getLockState('adam@bestasolar.tg').remainingMs;
    expect(second).toBeGreaterThan(first);
  });

  it('les emails sont suivis indépendamment', () => {
    for (let i = 0; i < 5; i += 1) registerFailedAttempt('adam@bestasolar.tg');
    expect(getLockState('adam@bestasolar.tg').locked).toBe(true);
    expect(getLockState('fatou@bestasolar.tg').locked).toBe(false);
  });

  it('la casse et les espaces ne créent pas deux compteurs distincts', () => {
    for (let i = 0; i < 4; i += 1) registerFailedAttempt('  Adam@BestaSolar.tg  ');
    expect(registerFailedAttempt('adam@bestasolar.tg').locked).toBe(true);
  });

  it('clearAttempts efface le compteur (connexion réussie)', () => {
    for (let i = 0; i < 4; i += 1) registerFailedAttempt('adam@bestasolar.tg');
    clearAttempts('adam@bestasolar.tg');
    expect(registerFailedAttempt('adam@bestasolar.tg').locked).toBe(false);
  });

  it('formatLockRemaining affiche minutes puis heures', () => {
    expect(formatLockRemaining(90 * 1000)).toBe('2 min');
    expect(formatLockRemaining(15 * 60 * 1000)).toBe('15 min');
    expect(formatLockRemaining(90 * 60 * 1000)).toBe('1 h 30 min');
    expect(formatLockRemaining(120 * 60 * 1000)).toBe('2 h');
  });
});
