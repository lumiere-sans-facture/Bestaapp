import { describe, it, expect } from 'vitest';
import { accueilPour, actionRetour } from '../boutonRetour';

describe('bouton retour d’Android', () => {
  it('page d’accueil : tableau de bord public, de l’espace Pro, ou la racine sans compte', () => {
    expect(accueilPour({ chemin: '/devis', connecte: true })).toBe('/dashboard');
    expect(accueilPour({ chemin: '/plus/parametres', connecte: true })).toBe('/dashboard');
    expect(accueilPour({ chemin: '/pro/documents', connecte: true })).toBe('/pro');
    expect(accueilPour({ chemin: '/pro', connecte: true })).toBe('/pro');
    expect(accueilPour({ chemin: '/promo', connecte: true })).toBe('/dashboard');
    expect(accueilPour({ chemin: '/inscription', connecte: false })).toBe('/');
  });

  it('hors de l’accueil : retour à l’accueil, sans quitter', () => {
    expect(actionRetour({ chemin: '/devis', connecte: true })).toEqual({ type: 'aller', vers: '/dashboard' });
    expect(actionRetour({ chemin: '/clients/c-4f2a', connecte: true })).toEqual({ type: 'aller', vers: '/dashboard' });
    expect(actionRetour({ chemin: '/pro/clients', connecte: true })).toEqual({ type: 'aller', vers: '/pro' });
    expect(actionRetour({ chemin: '/connexion', connecte: false })).toEqual({ type: 'aller', vers: '/' });
  });

  it('sur l’accueil : on quitte', () => {
    expect(actionRetour({ chemin: '/dashboard', connecte: true })).toEqual({ type: 'quitter' });
    expect(actionRetour({ chemin: '/dashboard/', connecte: true })).toEqual({ type: 'quitter' });
    expect(actionRetour({ chemin: '/pro', connecte: true })).toEqual({ type: 'quitter' });
    expect(actionRetour({ chemin: '/', connecte: false })).toEqual({ type: 'quitter' });
  });

  it('une fenêtre ouverte se ferme d’abord, même sur l’accueil', () => {
    expect(actionRetour({ chemin: '/dashboard', connecte: true, fenetreOuverte: true })).toEqual({ type: 'fermer' });
    expect(actionRetour({ chemin: '/devis', connecte: true, fenetreOuverte: true })).toEqual({ type: 'fermer' });
  });
});
