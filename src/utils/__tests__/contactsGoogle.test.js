import { describe, expect, it } from 'vitest';
import { contactsGoogleAEnvoyer, TYPES_ENVOYES_A_GOOGLE } from '../contactsGoogle';

const avecTel = (id, extra = {}) => ({ id, phone: '90 12 34 56', ...extra });

describe('contacts à envoyer vers Google', () => {
  it('reprend un contact jamais proposé', () => {
    // Les clients saisis avant la file n'ont aucun statut : sans cette reprise,
    // ils n'arriveraient jamais dans le carnet.
    expect(contactsGoogleAEnvoyer({ leads: [avecTel('l1')] })).toHaveLength(1);
  });

  it('reprend « pending » et « failed », laisse « synced » tranquille', () => {
    const leads = [
      avecTel('a', { google_contact_sync_status: 'pending' }),
      avecTel('b', { google_contact_sync_status: 'failed' }),
      avecTel('c', { google_contact_sync_status: 'synced' }),
      avecTel('d', { google_contact_sync_status: 'already_exists' }),
    ];
    expect(contactsGoogleAEnvoyer({ leads, limite: 10 }).map((x) => x.contact.id)).toEqual(['a', 'b']);
  });

  it('respecte la date de reprise d’un échec', () => {
    const futur = new Date(Date.now() + 3600_000).toISOString();
    const leads = [avecTel('a', { google_contact_sync_status: 'failed', google_contact_sync_next_retry_at: futur })];
    expect(contactsGoogleAEnvoyer({ leads })).toHaveLength(0);
  });

  it('ignore un contact sans coordonnée et un envoi déjà en cours', () => {
    const leads = [{ id: 'sansTel', name: 'Personne' }, avecTel('b')];
    expect(contactsGoogleAEnvoyer({ leads, enCours: new Set(['lead:b']) })).toHaveLength(0);
  });

  it('n’envoie JAMAIS les clients de l’espace Pro', () => {
    // L'espace Devis Pro est l'entreprise personnelle de l'abonné : ses clients
    // n'ont rien à faire dans le carnet Google de BestaSolar.
    expect(TYPES_ENVOYES_A_GOOGLE).toEqual(['partner', 'lead']);
    expect(TYPES_ENVOYES_A_GOOGLE).not.toContain('pro_client');
  });

  it('plafonne le lot pour ne pas saturer la file', () => {
    const leads = Array.from({ length: 10 }, (_, i) => avecTel(`l${i}`));
    expect(contactsGoogleAEnvoyer({ leads })).toHaveLength(3);
  });
});

describe('ordre de passage — ce qu’on regarde apparaître passe en premier', () => {
  const tel = (id, statut) => ({
    id, name: `Client ${id}`, phone: '+22890000001',
    ...(statut ? { google_contact_sync_status: statut } : {}),
  });

  it('le contact qu’on vient d’enregistrer passe devant tout l’historique', () => {
    // 30 anciens clients sans statut (repris après coup) et un seul nouveau.
    const anciens = Array.from({ length: 30 }, (_, i) => tel(`vieux-${i}`, null));
    const file = contactsGoogleAEnvoyer({ leads: [...anciens, tel('neuf', 'pending')] });
    expect(file[0].contact.id).toBe('neuf');
  });

  it('un nouveau partenaire aussi', () => {
    const file = contactsGoogleAEnvoyer({
      partners: [tel('p-vieux', null), tel('p-neuf', 'pending')],
      leads: [tel('l-vieux', null)],
    });
    expect(file[0].contact.id).toBe('p-neuf');
  });

  it('une reprise après échec passe avant le rattrapage, après les nouveaux', () => {
    const file = contactsGoogleAEnvoyer({
      leads: [tel('sans-statut', null), tel('echoue', 'failed'), tel('neuf', 'pending')],
    });
    expect(file.map((f) => f.contact.id)).toEqual(['neuf', 'echoue', 'sans-statut']);
  });

  it('à rang égal, l’ordre des listes est conservé (tri stable)', () => {
    const file = contactsGoogleAEnvoyer({
      leads: [tel('a', 'pending'), tel('b', 'pending'), tel('c', 'pending')],
    });
    expect(file.map((f) => f.contact.id)).toEqual(['a', 'b', 'c']);
  });

  it('le classement ne fait entrer personne qui n’aurait pas été envoyé', () => {
    const sansTelephone = { id: 'x', name: 'Sans numéro' };
    const dejaFait = { ...tel('y', 'synced') };
    expect(contactsGoogleAEnvoyer({ leads: [sansTelephone, dejaFait] })).toEqual([]);
  });
});

