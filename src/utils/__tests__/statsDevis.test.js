import { describe, it, expect } from 'vitest';
import { computeMonthlyDevis } from '../stats';

// Août 2026 : les 6 derniers mois vont de mars à août.
const AOUT_2026 = new Date('2026-08-15T10:00:00');

describe('computeMonthlyDevis', () => {
  it('rend un point par mois, mois courant inclus', () => {
    const serie = computeMonthlyDevis([], 6, AOUT_2026);
    expect(serie).toHaveLength(6);
    expect(serie.map((m) => m.month)).toEqual(['Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août']);
  });

  it('compte les devis dans leur mois de création et somme leur total', () => {
    const devis = [
      { id: 'd1', createdAt: '2026-08-02T09:00:00Z', total: 500000 },
      { id: 'd2', createdAt: '2026-08-20T09:00:00Z', total: 300000 },
      { id: 'd3', createdAt: '2026-06-11T09:00:00Z', total: 120000 },
    ];
    const serie = computeMonthlyDevis(devis, 6, AOUT_2026);
    const par = Object.fromEntries(serie.map((m) => [m.month, m]));
    expect(par['Août']).toMatchObject({ devis: 2, total: 800000 });
    expect(par['Juin']).toMatchObject({ devis: 1, total: 120000 });
    expect(par['Mai']).toMatchObject({ devis: 0, total: 0 });
  });

  it('ignore les devis hors de la fenêtre demandée', () => {
    const devis = [{ id: 'vieux', createdAt: '2025-01-04T09:00:00Z', total: 999 }];
    const serie = computeMonthlyDevis(devis, 6, AOUT_2026);
    expect(serie.every((m) => m.devis === 0)).toBe(true);
  });

  it('tolère un total absent ou illisible', () => {
    const devis = [
      { id: 'd1', createdAt: '2026-08-02T09:00:00Z' },
      { id: 'd2', createdAt: '2026-08-03T09:00:00Z', total: 'abc' },
    ];
    const serie = computeMonthlyDevis(devis, 6, AOUT_2026);
    expect(serie.at(-1)).toMatchObject({ devis: 2, total: 0 });
  });
});
