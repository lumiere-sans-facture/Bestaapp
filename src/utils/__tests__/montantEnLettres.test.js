import { describe, it, expect } from 'vitest';
import { nombreEnLettres, montantEnLettres } from '../montantEnLettres';

describe('nombreEnLettres', () => {
  it.each([
    [0, 'zéro'],
    [1, 'un'],
    [16, 'seize'],
    [17, 'dix-sept'],
    [21, 'vingt et un'],
    [71, 'soixante et onze'],
    [77, 'soixante-dix-sept'],
    [80, 'quatre-vingts'],
    [81, 'quatre-vingt-un'],
    [91, 'quatre-vingt-onze'],
    [99, 'quatre-vingt-dix-neuf'],
    [100, 'cent'],
    [101, 'cent un'],
    [180, 'cent quatre-vingts'],
    [200, 'deux cents'],
    [201, 'deux cent un'],
    [1000, 'mille'],
    [1001, 'mille un'],
    [1200, 'mille deux cents'],
    [2000, 'deux mille'],
    [21000, 'vingt et un mille'],
    [80000, 'quatre-vingt mille'],
    [200000, 'deux cent mille'],
    [1000000, 'un million'],
    [1001000, 'un million mille'],
    [80000000, 'quatre-vingts millions'],
    [200000000, 'deux cents millions'],
    [1000000000, 'un milliard'],
    [2000000000, 'deux milliards'],
    [999999999, 'neuf cent quatre-vingt-dix-neuf millions neuf cent quatre-vingt-dix-neuf mille neuf cent quatre-vingt-dix-neuf'],
  ])('%i → %s', (n, attendu) => {
    expect(nombreEnLettres(n)).toBe(attendu);
  });

  it('montants de la facture d’exemple', () => {
    expect(nombreEnLettres(66876000)).toBe('soixante-six millions huit cent soixante-seize mille');
    expect(nombreEnLettres(55876000)).toBe('cinquante-cinq millions huit cent soixante-seize mille');
    expect(nombreEnLettres(25876000)).toBe('vingt-cinq millions huit cent soixante-seize mille');
  });
});

describe('montantEnLettres', () => {
  it('lettres en majuscules, chiffres groupés, devise au pluriel', () => {
    expect(montantEnLettres(66876000))
      .toBe('SOIXANTE-SIX MILLIONS HUIT CENT SOIXANTE-SEIZE MILLE (66 876 000) FRANCS CFA');
    expect(montantEnLettres(55876000))
      .toBe('CINQUANTE-CINQ MILLIONS HUIT CENT SOIXANTE-SEIZE MILLE (55 876 000) FRANCS CFA');
  });

  it('singulier pour zéro et un franc', () => {
    expect(montantEnLettres(0)).toBe('ZÉRO (0) FRANC CFA');
    expect(montantEnLettres(1)).toBe('UN (1) FRANC CFA');
  });
});
