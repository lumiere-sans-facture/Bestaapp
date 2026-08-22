import { describe, it, expect, beforeEach } from 'vitest';
import { lireProfilCache, ecrireProfilCache, oublierProfilCache } from '../profilCache';

// localStorage minimal (environnement de test Node, sans navigateur).
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const PROFIL = { id: 'u1', email: 'Boss@BestaSolar.bj', name: 'Adam', role: 'gerant', org_id: 'o1' };

beforeEach(() => store.clear());

describe('cache du profil (ouverture hors-ligne)', () => {
  it('rend le profil mémorisé pour le même compte', () => {
    ecrireProfilCache(PROFIL);
    expect(lireProfilCache('boss@bestasolar.bj')).toMatchObject({ id: 'u1', role: 'gerant' });
  });

  it('la comparaison des emails ignore la casse', () => {
    ecrireProfilCache(PROFIL);
    expect(lireProfilCache('BOSS@BESTASOLAR.BJ')).not.toBeNull();
  });

  it('ne rend JAMAIS le profil d’un autre compte', () => {
    // Deux comptes sur le même appareil : sans ce contrôle, le second
    // ouvrirait l'app avec l'identité et le rôle du premier.
    ecrireProfilCache(PROFIL);
    expect(lireProfilCache('autre@bestasolar.bj')).toBeNull();
  });

  it('sans email de session, rien n’est rendu', () => {
    ecrireProfilCache(PROFIL);
    expect(lireProfilCache('')).toBeNull();
    expect(lireProfilCache(undefined)).toBeNull();
  });

  it('l’oubli est effectif (déconnexion, session périmée)', () => {
    ecrireProfilCache(PROFIL);
    oublierProfilCache();
    expect(lireProfilCache('boss@bestasolar.bj')).toBeNull();
  });

  it('un profil sans email n’est pas mémorisé (illisible ensuite)', () => {
    ecrireProfilCache({ id: 'u2', name: 'Sans email' });
    expect(lireProfilCache('boss@bestasolar.bj')).toBeNull();
  });

  it('un contenu illisible ne fait pas tomber l’app', () => {
    localStorage.setItem('bestasolar_profil', '{cassé');
    expect(lireProfilCache('boss@bestasolar.bj')).toBeNull();
  });

  it('conserve l’organisation (type interne/pro) pour la réplication', () => {
    ecrireProfilCache({ ...PROFIL, org: { id: 'o1', kind: 'pro', name: 'Entreprise' } });
    expect(lireProfilCache('boss@bestasolar.bj').org).toEqual({ id: 'o1', kind: 'pro', name: 'Entreprise' });
  });
});
