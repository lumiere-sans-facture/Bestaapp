// L'invariant qui a coûté un voyant orange figé en production.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { peutEnvoyer, STATUTS_QUI_ENVOIENT } from '../etatSync';

describe('peutEnvoyer', () => {
  it('envoie depuis « online » et « error » — et de nulle part ailleurs', () => {
    expect(peutEnvoyer('online')).toBe(true);
    expect(peutEnvoyer('error')).toBe(true);
    expect(STATUTS_QUI_ENVOIENT).toEqual(['online', 'error']);
  });

  it('n’envoie PAS depuis « connecting » : y basculer depuis la boucle '
    + 'd’envoi la fige jusqu’au rechargement de la page', () => {
    expect(peutEnvoyer('connecting')).toBe(false);
  });

  it('n’envoie pas non plus hors ligne ni en mode local', () => {
    expect(peutEnvoyer('offline')).toBe(false);
    expect(peutEnvoyer('local')).toBe(false);
    expect(peutEnvoyer(undefined)).toBe(false);
  });
});

// Le moteur de réplication vit dans un effet React : aucun test unitaire ne
// peut le faire tourner ici (ni jsdom, ni testing-library dans ce projet).
// Cette lecture du source est donc le seul filet possible — et le bug qu'elle
// attrape avait atteint la production.
describe('le moteur de réplication ne se fige pas lui-même', () => {
  it('ne repasse jamais le statut à « connecting » : seule la connexion '
    + 'initiale le fait', () => {
    const source = readFileSync(new URL('../../context/useRemoteSync.js', import.meta.url), 'utf8');
    expect(source).not.toMatch(/setSyncStatus\(\s*['"]connecting['"]\s*\)/);
  });
});
