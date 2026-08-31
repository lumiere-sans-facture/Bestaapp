import { describe, expect, it } from 'vitest';
import { SOURCES_CONTACT, libelleSource, sourceValide } from '../contactSource';

describe('origine du contact', () => {
  it('donne le libellé affichable d’une origine connue', () => {
    expect(libelleSource('whatsapp')).toBe('WhatsApp');
    expect(libelleSource('terrain')).toBe('Terrain');
  });

  it('reste muette sur une origine absente ou inconnue', () => {
    // Un client saisi avant l'existence du champ ne doit rien afficher de
    // faux — surtout pas « Terrain » par défaut.
    expect(libelleSource('')).toBe('');
    expect(libelleSource(undefined)).toBe('');
    expect(libelleSource('facebook')).toBe('');
  });

  it('reconnaît les seules origines proposées', () => {
    expect(sourceValide('parrainage')).toBe(true);
    expect(sourceValide('pigeon voyageur')).toBe(false);
  });

  it('propose des identifiants uniques', () => {
    const ids = SOURCES_CONTACT.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
