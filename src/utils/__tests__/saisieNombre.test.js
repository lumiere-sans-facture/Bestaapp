import { describe, it, expect } from 'vitest';
import { nombreSaisi } from '../saisieNombre';

describe('saisie d’un nombre dans un champ', () => {
  it('un champ vidé ne donne aucun nombre : on peut effacer le dernier chiffre', () => {
    expect(nombreSaisi('')).toBeNull();
    expect(nombreSaisi('   ')).toBeNull();
    expect(nombreSaisi('', { min: 1 })).toBeNull();
    expect(nombreSaisi('-')).toBeNull();
  });

  it('un nombre en cours de frappe attend la suite', () => {
    expect(nombreSaisi('4.')).toBeNull();
    expect(nombreSaisi('4,')).toBeNull();
  });

  it('lit les entiers et les décimaux, virgule comprise', () => {
    expect(nombreSaisi('3')).toBe(3);
    expect(nombreSaisi('2200')).toBe(2200);
    expect(nombreSaisi('4.5')).toBe(4.5);
    expect(nombreSaisi('4,5')).toBe(4.5);
  });

  it('respecte le plancher, le plafond et l’arrondi', () => {
    expect(nombreSaisi('0', { min: 1 })).toBe(1);
    expect(nombreSaisi('25', { max: 24 })).toBe(24);
    expect(nombreSaisi('1250.6', { min: 0, arrondi: true })).toBe(1251);
    expect(nombreSaisi('-5', { min: 0 })).toBe(0);
  });
});
