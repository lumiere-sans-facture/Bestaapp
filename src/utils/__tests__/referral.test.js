import { describe, it, expect } from 'vitest';
import { codeBaseFromName, generatePartnerCode } from '../referral';

describe('codeBaseFromName', () => {
  it('prend le premier mot en majuscules', () => {
    expect(codeBaseFromName('Aminata Kesso')).toBe('AMINATA');
  });
  it('retire les accents', () => {
    expect(codeBaseFromName('Hélène Dupont')).toBe('HELENE');
  });
  it('ignore les caractères spéciaux', () => {
    expect(codeBaseFromName('Jean-Pierre')).toBe('JEAN');
  });
  it('limite à 10 caractères', () => {
    expect(codeBaseFromName('Abcdefghijklmnop')).toBe('ABCDEFGHIJ');
  });
  it('repli sur PARTENAIRE si vide', () => {
    expect(codeBaseFromName('')).toBe('PARTENAIRE');
    expect(codeBaseFromName('123 456')).toBe('PARTENAIRE');
  });
});

describe('generatePartnerCode', () => {
  it('produit un code lisible avec suffixe unique', () => {
    expect(generatePartnerCode('Aminata', [], 'partner-1')).toMatch(/^BESTA-AMINATA-[A-Z2-9]{6}$/);
  });
  it('distingue deux homonymes et reste stable pour la même identité', () => {
    const premier = generatePartnerCode('Aminata', [], 'partner-1');
    const second = generatePartnerCode('Aminata', [premier], 'partner-2');
    expect(second).not.toBe(premier);
    expect(generatePartnerCode('Aminata', [], 'partner-1')).toBe(premier);
  });
});

