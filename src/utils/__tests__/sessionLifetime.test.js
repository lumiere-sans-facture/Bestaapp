import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  isSessionExpired, touchSession, clearSessionLifetime,
  SESSION_MAX_AGE_MS, SESSION_INACTIVITY_MS,
} from '../sessionLifetime';

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
  clearSessionLifetime();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
});

describe('sessionLifetime', () => {
  it("n'est pas expirée quand aucune session n'a été suivie", () => {
    expect(isSessionExpired()).toBe(false);
  });

  it('reste valide juste après touchSession', () => {
    touchSession();
    expect(isSessionExpired()).toBe(false);
  });

  it('expire après la durée absolue même avec une activité récente', () => {
    touchSession();
    vi.advanceTimersByTime(SESSION_MAX_AGE_MS - 1000);
    touchSession(); // revient tous les jours : ne recule pas la date de départ
    expect(isSessionExpired()).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(isSessionExpired()).toBe(true);
  });

  it("expire après la fenêtre d'inactivité même si l'âge absolu n'est pas dépassé", () => {
    touchSession();
    vi.advanceTimersByTime(SESSION_INACTIVITY_MS + 1000);
    expect(isSessionExpired()).toBe(true);
  });

  it('clearSessionLifetime remet le suivi à zéro (déconnexion)', () => {
    touchSession();
    vi.advanceTimersByTime(SESSION_INACTIVITY_MS + 1000);
    expect(isSessionExpired()).toBe(true);
    clearSessionLifetime();
    expect(isSessionExpired()).toBe(false);
    touchSession();
    expect(isSessionExpired()).toBe(false);
  });
});
