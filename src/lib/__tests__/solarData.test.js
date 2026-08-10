import { describe, it, expect } from 'vitest';
import { nasaToSolar, pvgisToSolar, combineSolar, nasaPireMois, pvgisPireMoisPsh } from '../solarData';

// Climatologie NASA type (Lomé) : creux net en saison des pluies (juillet).
const NASA_LOME = {
  JAN: 5.2, FEB: 5.4, MAR: 5.3, APR: 5.1, MAY: 4.8, JUN: 4.2,
  JUL: 3.8, AUG: 3.9, SEP: 4.3, OCT: 4.9, NOV: 5.2, DEC: 5.1,
  ANN: 4.8,
};

describe('nasaPireMois', () => {
  it('retient le mois le moins ensoleillé, jamais la moyenne', () => {
    expect(nasaPireMois(NASA_LOME)).toBe(3.8); // juillet
  });
  it('ignore les valeurs de remplissage NASA (-999) et les données vides', () => {
    expect(nasaPireMois({ ...NASA_LOME, JUL: -999 })).toBe(3.9); // août prend le relais
    expect(nasaPireMois({})).toBeNull();
  });
});

describe('pvgisPireMoisPsh', () => {
  it('convertit le pire H(i)_m mensuel en heures de pic par jour', () => {
    const monthly = [
      { month: 1, 'H(i)_m': 160 },  // 160/31 ≈ 5.16
      { month: 7, 'H(i)_m': 115 },  // 115/31 ≈ 3.71 ← pire mois
      { month: 11, 'H(i)_m': 150 }, // 150/30 = 5
    ];
    expect(pvgisPireMoisPsh(monthly)).toBeCloseTo(115 / 31, 5);
  });
  it('null sans détail mensuel exploitable', () => {
    expect(pvgisPireMoisPsh(null)).toBeNull();
    expect(pvgisPireMoisPsh([])).toBeNull();
    expect(pvgisPireMoisPsh([{ month: 1, 'H(i)_m': 0 }])).toBeNull();
  });
});

describe('nasaToSolar', () => {
  it('dimensionne sur le PIRE MOIS, produit annuel sur la moyenne (Lomé)', () => {
    const s = nasaToSolar(NASA_LOME, 6.37);
    expect(s.peakSunHours).toBe(3.8);       // juillet, pas les 4.8 de moyenne
    expect(s.yearlyYield).toBe(1752);       // 4.8 × 365 — le productible reste annuel
    expect(s.optimalAngle).toBe(6);         // ≈ latitude
    expect(s.source).toBe('NASA POWER');
  });
  it('repli sur la moyenne annuelle si les mois manquent', () => {
    const s = nasaToSolar({ ANN: 4.83 }, 12.6);
    expect(s.peakSunHours).toBe(4.8);
    expect(s.optimalAngle).toBe(13);
  });
});

describe('pvgisToSolar', () => {
  it('dimensionne sur le pire mois quand le détail mensuel est fourni', () => {
    const monthly = [{ month: 7, 'H(i)_m': 115 }, { month: 1, 'H(i)_m': 160 }];
    const s = pvgisToSolar(1752, 6, 6.37, monthly);
    expect(s.peakSunHours).toBe(3.7);  // 115/31 arrondi
    expect(s.yearlyYield).toBe(1752);
    expect(s.optimalAngle).toBe(6);
    expect(s.source).toBe('PVGIS');
  });
  it('repli moyenne annuelle sans détail mensuel, latitude sans pente', () => {
    const s = pvgisToSolar(1752, null, 14.7);
    expect(s.peakSunHours).toBe(4.8); // 1752 / 365
    expect(s.optimalAngle).toBe(15);
  });
});

describe('combineSolar', () => {
  const nasa = nasaToSolar(NASA_LOME, 6.37);        // 3.8 h (pire mois)
  const pvgis = pvgisToSolar(1752, 6, 6.37);        // 4.8 h (sans mensuel)

  it('utilise les VALEURS NASA, l’angle PVGIS, et le libellé combiné', () => {
    const s = combineSolar(nasa, pvgis, 6.37);
    expect(s.peakSunHours).toBe(3.8);  // valeur NASA, pas PVGIS
    expect(s.yearlyYield).toBe(nasa.yearlyYield);
    expect(s.optimalAngle).toBe(6);    // angle PVGIS
    expect(s.source).toBe('NASA/PVGIS');
  });

  it('repli sur PVGIS seul si NASA absente', () => {
    const s = combineSolar(null, pvgis, 6.37);
    expect(s.peakSunHours).toBe(4.8);
    expect(s.source).toBe('PVGIS');
  });

  it('NASA seule si PVGIS absente (angle ≈ latitude)', () => {
    const s = combineSolar(nasa, null, 6.37);
    expect(s.peakSunHours).toBe(3.8);
    expect(s.optimalAngle).toBe(6);
    expect(s.source).toBe('NASA POWER');
  });

  it('null si aucune source', () => {
    expect(combineSolar(null, null, 6.37)).toBeNull();
  });
});
