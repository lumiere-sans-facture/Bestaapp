// Numéro Mobile Money envoyé au widget KKiaPay.
// Le widget ne dit jamais POURQUOI un numéro est refusé : ces règles sont
// donc la seule explication que l'utilisateur recevra.
import { describe, it, expect } from 'vitest';
import {
  normaliserMomo, momoValide, estNumeroTest, problemeNumero, formatMomo, INDICATIFS,
} from '../kkiapay';

describe('normaliserMomo', () => {
  it('met le numéro au format international sans « + »', () => {
    expect(normaliserMomo('+228 90 12 34 56')).toBe('22890123456');
    expect(normaliserMomo('00228 90123456')).toBe('22890123456');
    expect(normaliserMomo('228-90-12-34-56')).toBe('22890123456');
  });

  it('ajoute l’indicatif quand le numéro est saisi en local', () => {
    expect(normaliserMomo('90123456')).toBe('22890123456');
    expect(normaliserMomo('97 00 00 00', INDICATIFS.BJ)).toBe('22997000000');
  });

  it('ne prend pas un local de 8 chiffres pour un numéro déjà préfixé', () => {
    // Sans le garde-fou de longueur, « 22890123 » repartirait tel quel.
    expect(normaliserMomo('22890123')).toBe('22822890123');
  });

  it('rend une chaîne vide quand il n’y a aucun chiffre', () => {
    expect(normaliserMomo('')).toBe('');
    expect(normaliserMomo('mon numéro')).toBe('');
    expect(normaliserMomo(null)).toBe('');
  });
});

describe('momoValide', () => {
  it('accepte le Togo (8 chiffres) et le Bénin (8 ou 10)', () => {
    expect(momoValide('+228 90 12 34 56')).toBe(true);
    expect(momoValide('90123456')).toBe(true);
    expect(momoValide('+229 97 00 00 00')).toBe(true);
    expect(momoValide('+229 01 97 00 00 00')).toBe(true); // format béninois à 10 chiffres
  });

  it('refuse un numéro tronqué ou trop long', () => {
    expect(momoValide('9012')).toBe(false);
    expect(momoValide('+228 90 12 34 56 78')).toBe(false);
    expect(momoValide('')).toBe(false);
  });
});

describe('formatMomo', () => {
  it('groupe les chiffres par deux, indicatif détaché', () => {
    expect(formatMomo('22997000000')).toBe('+229 97 00 00 00');
    expect(formatMomo('22890123456')).toBe('+228 90 12 34 56');
  });

  it('reste lisible sans indicatif et supporte le vide', () => {
    expect(formatMomo('90123456')).toBe('90 12 34 56');
    expect(formatMomo('')).toBe('');
  });
});

describe('estNumeroTest', () => {
  it('reconnaît les numéros du bac à sable, écrits comme on veut', () => {
    expect(estNumeroTest('22997000000')).toBe(true);
    expect(estNumeroTest('+229 97 00 00 00')).toBe(true);
    expect(estNumeroTest('97000000')).toBe(true); // local béninois
    expect(estNumeroTest('22968000000')).toBe(true);
  });

  it('ne prend pas un vrai numéro pour un numéro de test', () => {
    expect(estNumeroTest('+228 90 12 34 56')).toBe(false);
  });
});

describe('problemeNumero', () => {
  it('exige un numéro', () => {
    expect(problemeNumero('')).toMatch(/Renseignez/);
  });

  it('signale un numéro incomplet', () => {
    expect(problemeNumero('9012')).toMatch(/incomplet/);
  });

  it('prévient qu’un vrai numéro est refusé en mode test', () => {
    // C'est l'erreur vécue : « numéro n'est pas valide » côté widget.
    expect(problemeNumero('+228 90 12 34 56', { sandbox: true })).toMatch(/numéros de test/);
    expect(problemeNumero('+229 97 00 00 00', { sandbox: true })).toBeNull();
  });

  it('laisse passer un vrai numéro hors mode test', () => {
    expect(problemeNumero('+228 90 12 34 56', { sandbox: false })).toBeNull();
    expect(problemeNumero('+228 90 12 34 56')).toBeNull();
  });
});
