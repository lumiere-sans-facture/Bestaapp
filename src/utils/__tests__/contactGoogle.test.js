import { describe, expect, it } from 'vitest';
import { nomContactGoogle } from '../contactGoogle';

describe('nomContactGoogle', () => {
  it('préfixe le nom du client par le code de son apporteur', () => {
    expect(nomContactGoogle('Soumana', 'FATOU-KN8ERZ')).toBe('FATOU-KN8ERZ Soumana');
  });

  it('accepte un ancien code préfixé et le raccourcit', () => {
    expect(nomContactGoogle('Soumana', 'BESTA-FATOU-KN8ERZ')).toBe('FATOU-KN8ERZ Soumana');
  });

  it('sans apporteur connu, garde le nom seul', () => {
    // Un contact sans préfixe vaut mieux qu'un contact qui ne part pas.
    expect(nomContactGoogle('Soumana', '')).toBe('Soumana');
    expect(nomContactGoogle('Soumana', null)).toBe('Soumana');
  });

  it('sans nom, le code sert d’identité', () => {
    expect(nomContactGoogle('', 'FATOU-KN8ERZ')).toBe('FATOU-KN8ERZ');
    expect(nomContactGoogle('  ', '')).toBe('');
  });

  it('nettoie les espaces autour du nom', () => {
    expect(nomContactGoogle('  Soumana  ', 'fatou-kn8erz')).toBe('FATOU-KN8ERZ Soumana');
  });
});
