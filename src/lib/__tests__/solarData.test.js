import { describe, it, expect } from 'vitest';
import { nasaToSolar, pvgisToSolar, combineSolar } from '../solarData';

describe('nasaToSolar', () => {
  it('mappe l’irradiation NASA en modèle solaire (Cotonou)', () => {
    const s = nasaToSolar(4.8, 6.37);
    expect(s.peakSunHours).toBe(4.8);
    expect(s.yearlyYield).toBe(1752); // 4.8 × 365
    expect(s.optimalAngle).toBe(6); // ≈ latitude
    expect(s.source).toBe('NASA POWER');
  });
  it('arrondit les valeurs', () => {
    const s = nasaToSolar(4.83, 12.6);
    expect(s.peakSunHours).toBe(4.8);
    expect(s.optimalAngle).toBe(13);
  });
});

describe('pvgisToSolar', () => {
  it('mappe H(i)_y + pente optimale PVGIS', () => {
    const s = pvgisToSolar(1752, 6, 6.37);
    expect(s.yearlyYield).toBe(1752);
    expect(s.peakSunHours).toBe(4.8); // 1752 / 365
    expect(s.optimalAngle).toBe(6);
    expect(s.source).toBe('PVGIS');
  });
  it('repli sur la latitude si la pente est absente', () => {
    expect(pvgisToSolar(1800, null, 14.7).optimalAngle).toBe(15);
  });
});

describe('combineSolar', () => {
  const nasa = nasaToSolar(4.3, 6.37);   // 4.3 h, 1570 kWh, angle ≈6
  const pvgis = pvgisToSolar(1752, 6, 6.37); // 4.8 h, 1752 kWh, angle 6

  it('utilise les VALEURS NASA, l’angle PVGIS, et le libellé combiné', () => {
    const s = combineSolar(nasa, pvgis, 6.37);
    expect(s.peakSunHours).toBe(4.3);  // valeur NASA, pas PVGIS
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
    expect(s.peakSunHours).toBe(4.3);
    expect(s.optimalAngle).toBe(6);
    expect(s.source).toBe('NASA POWER');
  });

  it('null si aucune source', () => {
    expect(combineSolar(null, null, 6.37)).toBeNull();
  });
});
