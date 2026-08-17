import { describe, it, expect } from 'vitest';
import { debitRequis, hmtEstimee, suggestPompeKit, buildPompeQuotation, HEURES_POMPAGE } from '../pompeSizing';
import { POMPE_KITS } from '../../data/pompeKits';

describe('pompeSizing — du besoin en eau au kit suggéré', () => {
  it('convertit le volume quotidien en débit horaire (pompage au fil du soleil)', () => {
    expect(debitRequis(11)).toBe(Number((11 / HEURES_POMPAGE).toFixed(2)));
    expect(debitRequis(0)).toBe(0);
    expect(debitRequis('abc')).toBe(0);
  });

  it('estime la HMT : profondeur + réservoir + 10 % de pertes, arrondi supérieur', () => {
    expect(hmtEstimee({ profondeur: 30, hauteurReservoir: 5 })).toBe(39); // 35 × 1,1 = 38,5
    expect(hmtEstimee({})).toBe(0);
  });

  it('suggère le kit le MOINS CHER qui couvre HMT et débit — jamais moins', () => {
    // 10 m³/j → 1,82 m³/h : le 0,5 HP (1,8 m³/h) ne suffit PAS, le 1 HP oui.
    const kit = suggestPompeKit(POMPE_KITS, { volumeJour: 10, hmt: 35 });
    expect(kit.id).toBe('pk-1hp');
    // 5 m³/j (0,91 m³/h) à 35 m : le 0,5 HP couvre tout juste.
    expect(suggestPompeKit(POMPE_KITS, { volumeJour: 5, hmt: 35 }).id).toBe('pk-05hp');
  });

  it('la HMT prime : un petit débit à grande profondeur exige un gros kit', () => {
    expect(suggestPompeKit(POMPE_KITS, { volumeJour: 3, hmt: 90 }).id).toBe('pk-2hp');
  });

  it('besoin hors gamme → null (étude sur mesure), jamais un kit sous-taillé', () => {
    expect(suggestPompeKit(POMPE_KITS, { volumeJour: 10, hmt: 150 })).toBeNull();
    expect(suggestPompeKit(POMPE_KITS, { volumeJour: 80, hmt: 30 })).toBeNull();
    expect(suggestPompeKit(POMPE_KITS, { volumeJour: 0, hmt: 30 })).toBeNull();
  });

  it('chiffre le devis : LE KIT SEUL — tuyauterie et installation se chiffrent sur place', () => {
    const kit = POMPE_KITS[1]; // 1 HP, 780 000 F
    const q = buildPompeQuotation(kit);
    expect(q.components).toHaveLength(1);
    expect(q.components[0].name).toBe(kit.name);
    expect(q.components[0].totalPrice).toBe(kit.price);
    expect(q.prestations).toHaveLength(0);
    expect(q.subtotalHT).toBe(kit.price);
    expect(q.total).toBe(kit.price);
    expect(q.tva).toBe(0);
    expect(buildPompeQuotation(null)).toBeNull();
  });
});
