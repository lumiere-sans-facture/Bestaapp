import { describe, it, expect } from 'vitest';
import { formatCFA, formatDate, initials } from '../format';

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
