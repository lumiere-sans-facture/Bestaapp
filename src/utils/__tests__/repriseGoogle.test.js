// Contacts vers le carnet Google : un échec repart vite (15 s, 30 s, 1 min…),
// jamais en boucle, et le prochain essai est daté.
import { describe, it, expect } from 'vitest';
import { issueSyncGoogle, delaiRepriseGoogle, prochaineRepriseGoogle, contactsGoogleAEnvoyer } from '../contactsGoogle';

const T = Date.parse('2026-10-12T10:00:00Z');
const dans = (ms) => new Date(T + ms).toISOString();

describe('délais de reprise', () => {
  it('15 s, 30 s, 1 min, 2 min, 5 min, 10 min, 30 min, puis 1 h au plus', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 20].map(delaiRepriseGoogle))
      .toEqual([15e3, 30e3, 60e3, 120e3, 300e3, 600e3, 1800e3, 3600e3, 3600e3]);
    expect(delaiRepriseGoogle(0)).toBe(15e3);
  });
});

describe('issue d’un envoi', () => {
  it('réussi : compteur remis à zéro', () => {
    expect(issueSyncGoogle({ google_contact_sync_attempts: 3 }, { status: 'synced', resourceName: 'people/1' }, T))
      .toEqual({ status: 'synced', resourceName: 'people/1', attempts: 0 });
  });

  it('premier échec : nouvel essai dans 15 s (et non plus 5 min)', () => {
    expect(issueSyncGoogle({}, { status: 'failed', error: 'Google indisponible' }, T))
      .toMatchObject({ status: 'failed', attempts: 1, nextRetryAt: dans(15e3), error: 'Google indisponible' });
  });

  it('échecs répétés : l’écart grandit', () => {
    expect(issueSyncGoogle({ google_contact_sync_attempts: 2 }, { status: 'failed' }, T).nextRetryAt).toBe(dans(60e3));
  });

  it('« déjà en cours » ou réponse vide : daté aussi — plus de renvoi en boucle', () => {
    expect(issueSyncGoogle({}, { status: 'pending', message: 'Une synchronisation de ce numéro est déjà en cours.' }, T))
      .toMatchObject({ status: 'pending', attempts: 1, nextRetryAt: dans(15e3) });
    expect(issueSyncGoogle({}, {}, T)).toMatchObject({ status: 'failed', nextRetryAt: dans(15e3) });
  });

  it('le contact daté n’est plus renvoyé avant son échéance', () => {
    const contact = { id: 'p1', phone: '+22890123456', ...{ google_contact_sync_status: 'pending', google_contact_sync_next_retry_at: dans(15e3) } };
    expect(contactsGoogleAEnvoyer({ partners: [contact], maintenant: T })).toHaveLength(0);
    expect(contactsGoogleAEnvoyer({ partners: [contact], maintenant: T + 15e3 })).toHaveLength(1);
  });
});

describe('réveil à l’échéance', () => {
  it('le plus proche des contacts en reprise', () => {
    const partners = [
      { id: 'a', phone: '+22890000001', google_contact_sync_status: 'failed', google_contact_sync_next_retry_at: dans(60e3) },
      { id: 'b', phone: '+22890000002', google_contact_sync_status: 'synced' },
    ];
    const leads = [{ id: 'c', phone: '+22890000003', google_contact_sync_status: 'pending', google_contact_sync_next_retry_at: dans(15e3) }];
    expect(prochaineRepriseGoogle({ partners, leads, maintenant: T })).toBe(15e3);
  });

  it('rien à attendre : null', () => {
    expect(prochaineRepriseGoogle({ partners: [], leads: [], maintenant: T })).toBeNull();
    // Échéance passée : il part déjà, rien à programmer.
    expect(prochaineRepriseGoogle({ partners: [{ id: 'a', phone: '+22890000001', google_contact_sync_status: 'failed', google_contact_sync_next_retry_at: dans(-1) }], maintenant: T })).toBeNull();
  });
});
