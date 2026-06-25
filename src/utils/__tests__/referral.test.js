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
  it('produit BESTA-<NOM> sans collision', () => {
    expect(generatePartnerCode('Aminata', [])).toBe('BESTA-AMINATA');
  });
  it('ajoute un suffixe en cas de collision', () => {
    const code = generatePartnerCode('Aminata', ['BESTA-AMINATA']);
    expect(code).not.toBe('BESTA-AMINATA');
    expect(code.startsWith('BESTA-AMINATA-')).toBe(true);
    expect(code.length).toBe('BESTA-AMINATA-'.length + 2);
  });
});
