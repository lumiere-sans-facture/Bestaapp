import { describe, it, expect } from 'vitest';
import { factureVersConsommation, partJourDe, PRIX_KWH_CEET } from '../factureConso';

describe('factureVersConsommation — de la facture CEET aux kWh/jour', () => {
  it('convertit une facture mensuelle en consommation jour/nuit', () => {
    // 34 200 F à 114 F/kWh = 300 kWh/mois = 10 kWh/jour, équilibré → 5 / 5.
    const c = factureVersConsommation(34200, 114, 'equilibre');
    expect(c.kwhMois).toBe(300);
    expect(c.day).toBe(5);
    expect(c.night).toBe(5);
  });

  it('respecte la répartition choisie (la nuit dimensionne la batterie)', () => {
    const c = factureVersConsommation(34200, 114, 'soir');
    expect(c.day).toBe(3);
    expect(c.night).toBe(7);
    // La somme retombe toujours sur le total journalier.
    expect(c.day + c.night).toBeCloseTo(10, 5);
  });

  it('entrées invalides → consommation nulle, jamais NaN', () => {
    expect(factureVersConsommation('', 114)).toEqual({ kwhMois: 0, day: 0, night: 0 });
    expect(factureVersConsommation(10000, 0)).toEqual({ kwhMois: 0, day: 0, night: 0 });
    expect(factureVersConsommation('abc', 114)).toEqual({ kwhMois: 0, day: 0, night: 0 });
  });

  it('le prix par défaut est celui de la CEET, la répartition inconnue vaut 50/50', () => {
    const c = factureVersConsommation(PRIX_KWH_CEET * 30, undefined, 'inconnue');
    expect(c.kwhMois).toBe(30);
    expect(c.day).toBe(0.5);
    expect(partJourDe('inconnue')).toBe(0.5);
  });
});
