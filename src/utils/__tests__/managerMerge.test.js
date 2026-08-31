import { describe, expect, it } from 'vitest';
import { codeReunionGerantsValide, normaliserCodeReunionGerants } from '../managerMerge';

describe('code de réunion des gérants', () => {
  it('supprime les séparateurs et met le code en majuscules', () => {
    expect(normaliserCodeReunionGerants('ab-cd ef_12 34')).toBe('ABCDEF1234');
  });

  it('n’accepte qu’un code complet de 12 caractères alphanumériques', () => {
    expect(codeReunionGerantsValide('ab-cd-ef-12-34-56')).toBe(true);
    expect(codeReunionGerantsValide('ABCDE')).toBe(false);
    expect(codeReunionGerantsValide('ABCDEFGHIJKL!')).toBe(true);
  });
});
