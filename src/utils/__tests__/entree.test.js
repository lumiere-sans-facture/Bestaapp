import { describe, it, expect } from 'vitest';
import { ecranDentree, vueLogin } from '../entree';

const etat = (extra) => ({ isLoading: false, recovery: false, pendingAuthUser: null, user: null, ...extra });

describe('ecranDentree — quel écran à l’ouverture', () => {
  it('attend tant que la session n’est pas résolue', () => {
    expect(ecranDentree(etat({ isLoading: true, user: { id: 'u1' } }))).toBe('chargement');
  });

  it('un visiteur voit la vitrine', () => {
    expect(ecranDentree(etat())).toBe('public');
  });

  it('un compte adopté entre dans l’application', () => {
    expect(ecranDentree(etat({ user: { id: 'u1' } }))).toBe('application');
  });

  it('le lien « mot de passe oublié » passe avant la vitrine', () => {
    expect(ecranDentree(etat({ recovery: true }))).toBe('connexion');
  });

  it('le retour de Google d’un nouvel arrivant passe avant la vitrine', () => {
    // La régression à ne jamais reproduire : session ouverte, profil pas
    // encore créé, et Google renvoie sur la racine — donc sur la vitrine.
    // L'inscription n'avait plus aucun moyen de se terminer.
    expect(ecranDentree(etat({ pendingAuthUser: { email: 'a@b.c' } }))).toBe('connexion');
  });

  it('un profil déjà adopté l’emporte sur un reliquat de retour Google', () => {
    expect(ecranDentree(etat({ pendingAuthUser: null, user: { id: 'u1' } }))).toBe('application');
  });

  it('la réinitialisation passe même devant un compte connecté', () => {
    expect(ecranDentree(etat({ recovery: true, user: { id: 'u1' } }))).toBe('connexion');
  });

  it('un état vide ne fait pas planter l’ouverture', () => {
    expect(ecranDentree()).toBe('public');
  });
});

describe('vueLogin — quel formulaire sur l’écran d’entrée', () => {
  it('sans rien, la connexion', () => {
    expect(vueLogin()).toBe('login');
  });

  it('« Se connecter » l’emporte sur une attribution vieille de trois semaines', () => {
    // Le bogue vu en production et invisible en recette : l'attribution vit
    // trente jours sur l'appareil, et détournait la route /connexion vers
    // l'inscription — sur le seul navigateur ayant suivi un lien partenaire.
    expect(vueLogin({ vueDemandee: 'login', refCode: 'BESTA-SIDDIK' })).toBe('login');
  });

  it('« Se connecter » l’emporte aussi sur un code d’invitation d’équipe', () => {
    expect(vueLogin({ vueDemandee: 'login', teamCode: 'ABC123' })).toBe('login');
  });

  it('la route d’inscription ouvre bien l’inscription', () => {
    expect(vueLogin({ vueDemandee: 'signup' })).toBe('signup');
  });

  it('sans vue demandée, un code partenaire ouvre l’inscription', () => {
    expect(vueLogin({ refCode: 'BESTA-SIDDIK' })).toBe('signup');
  });

  it('sans vue demandée, un code d’équipe ouvre l’inscription', () => {
    expect(vueLogin({ teamCode: 'ABC123' })).toBe('signup');
  });

  it('un code vide ne compte pas pour un code', () => {
    expect(vueLogin({ refCode: '', teamCode: '' })).toBe('login');
  });
});
