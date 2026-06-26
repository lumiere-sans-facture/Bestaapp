import { describe, it, expect } from 'vitest';
import { nasaToSolar, pvgisToSolar } from '../solarData';

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
