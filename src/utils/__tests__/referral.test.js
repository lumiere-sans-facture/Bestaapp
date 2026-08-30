import { describe, it, expect } from 'vitest';
import { codeBaseFromName, generatePartnerCode, memeCode, normaliseCode } from '../referral';

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
  it('produit le seul nom, sans préfixe, quand il est libre', () => {
    expect(generatePartnerCode('Aminata', [])).toBe('AMINATA');
  });

  it('réserve « BESTA » : ce mot était le préfixe, il ne peut pas être un code', () => {
    // Sinon normaliseCode raccourcirait BESTA-K7 en K7 et le partenaire
    // deviendrait introuvable.
    expect(generatePartnerCode('Besta Kodjo', [])).toBe('PARTENAIRE');
  });

  it('tient compte des anciens codes préfixés pour éviter un doublon', () => {
    const code = generatePartnerCode('Aminata', ['BESTA-AMINATA']);
    expect(code).not.toBe('AMINATA');
    expect(code.startsWith('AMINATA-')).toBe(true);
  });
  it('ajoute un suffixe en cas de collision', () => {
    const code = generatePartnerCode('Aminata', ['AMINATA']);
    expect(code).not.toBe('AMINATA');
    expect(code.startsWith('AMINATA-')).toBe(true);
    expect(code.length).toBe('AMINATA-'.length + 2);
  });
});

describe('normaliseCode', () => {
  it('retire le préfixe historique et garde le nom et le suffixe', () => {
    expect(normaliseCode('BESTA-BINTA-ZSUHKZ')).toBe('BINTA-ZSUHKZ');
  });

  it('met en forme une saisie approximative', () => {
    expect(normaliseCode('  besta-aminata ')).toBe('AMINATA');
    expect(normaliseCode('aminata')).toBe('AMINATA');
    expect(normaliseCode('')).toBe('');
    expect(normaliseCode(null)).toBe('');
  });

  it('laisse intact un code déjà au nouveau format', () => {
    expect(normaliseCode('BINTA-ZSUHKZ')).toBe('BINTA-ZSUHKZ');
  });
});

describe('memeCode', () => {
  it('rapproche un ancien lien partagé du code raccourci', () => {
    // C'est ce qui garde vivantes les affiches, cartes et liens WhatsApp
    // distribués avant le changement de format.
    expect(memeCode('BESTA-BINTA-ZSUHKZ', 'BINTA-ZSUHKZ')).toBe(true);
  });

  it('ne rapproche pas deux partenaires différents', () => {
    expect(memeCode('BINTA-ZSUHKZ', 'BINTA')).toBe(false);
  });

  it('deux codes vides ne désignent personne', () => {
    expect(memeCode('', '')).toBe(false);
    expect(memeCode(null, undefined)).toBe(false);
  });
});
