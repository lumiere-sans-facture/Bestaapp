import { describe, expect, it } from 'vitest';
import {
  doitAfficherGuide,
  marquerGuideNouveauUtilisateur,
  onboardingStorageKey,
  terminerGuideUtilisateur,
} from '../onboarding';

const creerStockage = () => {
  const valeurs = new Map();
  return {
    getItem: (key) => valeurs.has(key) ? valeurs.get(key) : null,
    setItem: (key, value) => valeurs.set(key, value),
  };
};

describe('guide des nouveaux utilisateurs', () => {
  it('ne considère jamais un compte existant sans marqueur comme nouveau', () => {
    const storage = creerStockage();
    expect(doitAfficherGuide('compte-existant', storage)).toBe(false);
  });

  it('affiche le guide après la création réelle du profil', () => {
    const storage = creerStockage();
    expect(marquerGuideNouveauUtilisateur('nouveau-compte', storage)).toBe(true);
    expect(doitAfficherGuide('nouveau-compte', storage)).toBe(true);
  });

  it('ne réaffiche plus le guide après sa fermeture', () => {
    const storage = creerStockage();
    marquerGuideNouveauUtilisateur('nouveau-compte', storage);
    expect(terminerGuideUtilisateur('nouveau-compte', storage)).toBe(true);
    expect(doitAfficherGuide('nouveau-compte', storage)).toBe(false);
    // Une nouvelle adoption du même profil ne doit pas réarmer le parcours.
    expect(marquerGuideNouveauUtilisateur('nouveau-compte', storage)).toBe(false);
  });

  it('sépare la progression de chaque utilisateur du même appareil', () => {
    expect(onboardingStorageKey('u1')).not.toBe(onboardingStorageKey('u2'));
  });
});
