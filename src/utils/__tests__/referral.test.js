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
  it('produit un code lisible avec suffixe unique', () => {
    expect(generatePartnerCode('Aminata', [], 'partner-1')).toMatch(/^AMINATA-[A-Z2-9]{6}$/);
  });
  it('distingue deux homonymes et reste stable pour la même identité', () => {
    const premier = generatePartnerCode('Aminata', [], 'partner-1');
    const second = generatePartnerCode('Aminata', [premier], 'partner-2');
    expect(second).not.toBe(premier);
    expect(generatePartnerCode('Aminata', [], 'partner-1')).toBe(premier);
  });
});


describe('normaliseCode', () => {
  it('retire le préfixe historique et garde le nom et le suffixe', () => {
    expect(normaliseCode('BESTA-BINTA-ZSUHKZ')).toBe('BINTA-ZSUHKZ');
  });

  it('met en forme une saisie approximative', () => {
    expect(normaliseCode('  besta-aminata-k8r4mz ')).toBe('AMINATA-K8R4MZ');
    expect(normaliseCode('')).toBe('');
    expect(normaliseCode(null)).toBe('');
  });

  it('laisse intact un code déjà au format courant', () => {
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
    expect(memeCode('BINTA-ZSUHKZ', 'BINTA-AAAAAA')).toBe(false);
  });

  it('deux codes vides ne désignent personne', () => {
    expect(memeCode('', '')).toBe(false);
    expect(memeCode(null, undefined)).toBe(false);
  });
});

describe('generatePartnerCode — mot réservé', () => {
  it('n’attribue jamais un code commençant par BESTA', () => {
    // Sinon normaliseCode y verrait l'ancien préfixe et raccourcirait
    // BESTA-K8R4MZ en K8R4MZ : le partenaire deviendrait introuvable.
    const code = generatePartnerCode('Besta Kodjo', [], 'partner-9');
    expect(code).toMatch(/^PARTENAIRE-[A-Z2-9]{6}$/);
    expect(normaliseCode(code)).toBe(code);
  });
});
