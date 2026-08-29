import { describe, expect, it } from 'vitest';
import { findContactByNormalizedPhone, normalizePhoneNumber, samePhoneNumber } from '../phone';

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
