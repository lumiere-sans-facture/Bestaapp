import { describe, expect, it } from 'vitest';
import { normalizePhoneNumber, samePhoneNumber } from '../phone';

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
