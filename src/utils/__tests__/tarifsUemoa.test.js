import { describe, it, expect } from 'vitest';
import { TARIFS_UEMOA, PAYS_DEFAUT, tarifPays, operateurPays } from '../../data/tarifsUemoa';

describe('tarifs UEMOA', () => {
  it('couvre les huit pays de l’union', () => {
    expect(TARIFS_UEMOA).toHaveLength(8);
    const pays = TARIFS_UEMOA.map((t) => t.pays);
    for (const attendu of ['Bénin', 'Burkina Faso', 'Côte d’Ivoire', 'Guinée-Bissau', 'Mali', 'Niger', 'Sénégal', 'Togo']) {
      expect(pays).toContain(attendu);
    }
  });

  it('chaque pays porte son opérateur et un prix du kWh plausible', () => {
    for (const t of TARIFS_UEMOA) {
      expect(t.operateur).toBeTruthy();
      expect(t.prixKwh).toBeGreaterThan(50);
      expect(t.prixKwh).toBeLessThan(250);
    }
  });

  it('les identifiants sont uniques (une entrée par pays)', () => {
    const ids = TARIFS_UEMOA.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('le Bénin est le pays par défaut', () => {
    expect(PAYS_DEFAUT).toBe('bj');
    expect(tarifPays(PAYS_DEFAUT).pays).toBe('Bénin');
    expect(tarifPays(PAYS_DEFAUT).operateur).toBe('SBEE');
  });

  it('un pays inconnu ne fait pas tomber l’écran', () => {
    expect(tarifPays('xx')).toBeNull();
    expect(tarifPays()).toBeNull();
    expect(operateurPays('xx')).toBe('Réseau');
  });

  it('l’opérateur se lit par son identifiant', () => {
    expect(operateurPays('tg')).toBe('CEET');
    expect(operateurPays('ci')).toBe('CIE');
  });
});
