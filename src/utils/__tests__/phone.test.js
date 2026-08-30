import { describe, expect, it } from 'vitest';
import { findContactByNormalizedPhone, normalizePhoneNumber, PAYS_PAR_DEFAUT, samePhoneNumber } from '../phone';

describe('normalizePhoneNumber — Bénin', () => {
  const equivalent = [
    '61732956',
    '61 73 29 56',
    '+22961732956',
    '01 61 73 29 56',
    '+229 01 61 73 29 56',
    '+2290161732956',
  ];

  it.each(equivalent)('normalise %s vers le format Bénin à 10 chiffres', (phone) => {
    expect(normalizePhoneNumber(phone, 'BJ')).toBe('+2290161732956');
  });

  it('ignore les séparateurs et caractères de mise en forme', () => {
    expect(normalizePhoneNumber('(+229) 01-61.73/29 56', 'BJ')).toBe('+2290161732956');
  });

  it('refuse une valeur vide ou manifestement invalide', () => {
    expect(normalizePhoneNumber('')).toBeNull();
    expect(normalizePhoneNumber('+229 ABC')).toBeNull();
  });
});

describe('samePhoneNumber', () => {
  it('empêche un doublon entre les anciens et nouveaux formats béninois', () => {
    expect(samePhoneNumber('+22961732956', '+2290161732956', 'BJ')).toBe(true);
  });

  it('ne confond pas deux numéros différents', () => {
    expect(samePhoneNumber('61732956', '61732957', 'BJ')).toBe(false);
  });
});


describe('findContactByNormalizedPhone', () => {
  it('détecte un contact Google existant malgré le changement 8 → 10 chiffres', () => {
    const contacts = [{ resourceName: 'people/123', phoneNumbers: [{ value: '+229 61 73 29 56' }] }];
    expect(findContactByNormalizedPhone(contacts, '+2290161732956', 'BJ')).toEqual(contacts[0]);
  });

  it('ne retourne aucun contact lorsqu’aucun numéro normalisé ne correspond', () => {
    const contacts = [{ resourceName: 'people/123', phoneNumbers: [{ value: '01 61 73 29 57' }] }];
    expect(findContactByNormalizedPhone(contacts, '61732956', 'BJ')).toBeNull();
  });
});

describe('normalizePhoneNumber — Togo', () => {
  it('interprète une saisie locale dans le pays du marché', () => {
    // C'est le défaut : l'app s'adresse au Togo, un numéro sans indicatif y est
    // togolais. Aucun pays passé à l'appel, exactement comme la synchronisation.
    expect(PAYS_PAR_DEFAUT).toBe('TG');
    expect(normalizePhoneNumber('90 12 34 56')).toBe('+22890123456');
  });

  it.each(['+228 90 12 34 56', '00228 90123456', '22890123456'])(
    'reconnaît %s comme un numéro togolais déjà complet',
    (phone) => {
      expect(normalizePhoneNumber(phone, 'TG')).toBe('+22890123456');
    },
  );

  it('ne re-préfixe jamais un numéro qui porte déjà son indicatif', () => {
    // Le pays demandé ne doit pas écraser l'indicatif écrit : un numéro béninois
    // lu par une session togolaise (et l'inverse) reste dans son pays.
    expect(normalizePhoneNumber('+2290161732956', 'TG')).toBe('+2290161732956');
    expect(normalizePhoneNumber('+22890123456', 'BJ')).toBe('+22890123456');
    expect(normalizePhoneNumber('+33 6 12 34 56 78', 'TG')).toBe('+33612345678');
  });

  it('distingue un togolais et un béninois aux chiffres identiques', () => {
    expect(samePhoneNumber('+22890123456', '+22990123456', 'TG')).toBe(false);
  });
});
