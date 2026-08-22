import { describe, it, expect } from 'vitest';
import { formatCFA, formatCFACourt, formatDate, initials, formatTaux } from '../format';

describe('formatCFA', () => {
  it('groupe les milliers par espaces', () => {
    expect(formatCFA(1234567)).toBe('1 234 567 F');
    expect(formatCFA(1000)).toBe('1 000 F');
  });
  it('gère 0 et les valeurs absentes', () => {
    expect(formatCFA(0)).toBe('0 F');
    expect(formatCFA(null)).toBe('0 F');
    expect(formatCFA(undefined)).toBe('0 F');
  });
  it('arrondit', () => {
    expect(formatCFA(1234.6)).toBe('1 235 F');
  });
});

describe('initials', () => {
  it('prend les deux premières initiales en majuscules', () => {
    expect(initials('Adam Adébiyi')).toBe('AA');
    expect(initials('fatou boko')).toBe('FB');
  });
});

describe('formatDate', () => {
  it('renvoie un tiret pour une date absente', () => {
    expect(formatDate('')).toBe('—');
    expect(formatDate(null)).toBe('—');
  });
});

describe('formatTaux — les libellés suivent le barème', () => {
  it('formate les taux en vigueur', () => {
    expect(formatTaux(0.03)).toBe('3 %');
    expect(formatTaux(0.015)).toBe('1,5 %');
  });
  it('suit un changement de barème sans retoucher l’interface', () => {
    expect(formatTaux(0.05)).toBe('5 %');
    expect(formatTaux(0.025)).toBe('2,5 %');
  });
  it('tolère une valeur absente', () => {
    expect(formatTaux(undefined)).toBe('0 %');
  });
});

describe('formatCFACourt — montants abrégés des tuiles', () => {
  it('laisse les petits montants intacts (rien à abréger)', () => {
    expect(formatCFACourt(0)).toBe('0 F');
    expect(formatCFACourt(45000)).toBe('45 000 F');
    expect(formatCFACourt(99999)).toBe('99 999 F');
  });

  it('abrège les milliers à partir de 100 000', () => {
    expect(formatCFACourt(720000)).toBe('720 k F');
    expect(formatCFACourt(125500)).toBe('125,5 k F');
  });

  it('abrège les millions', () => {
    expect(formatCFACourt(2532000)).toBe('2,5 M F');
    expect(formatCFACourt(108405662)).toBe('108,4 M F');
  });

  it('une décimale au plus, et pas de « ,0 » sur un compte rond', () => {
    expect(formatCFACourt(122200000)).toBe('122,2 M F');
    expect(formatCFACourt(3000000)).toBe('3 M F');
    expect(formatCFACourt(1084056620)).toBe('1084,1 M F');
  });

  it('garde le signe des montants négatifs (projet à perte)', () => {
    expect(formatCFACourt(-2532000)).toBe('-2,5 M F');
    expect(formatCFACourt(-45000)).toBe('-45 000 F');
  });

  it('tolère une entrée absente ou illisible', () => {
    expect(formatCFACourt(undefined)).toBe('0 F');
    expect(formatCFACourt('abc')).toBe('0 F');
  });
});
