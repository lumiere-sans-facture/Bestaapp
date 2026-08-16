// Mémoire du dimensionnement. Le risque n'est pas de perdre une case cochée :
// c'est qu'un devis ancien, ou une donnée abîmée par une synchronisation,
// fasse planter l'écran à la réouverture de l'étude.
import { describe, it, expect } from 'vitest';
import {
  capturerDimensionnement, restaurerDimensionnement, dimensionnementRejouable,
  resumeDimensionnement, prochainRowId, VERSION_DIMENSIONNEMENT,
} from '../dimensionnement';
import { DEFAULT_PEAK_SUN_HOURS, DEFAULT_AUTONOMY_NIGHTS, DEFAULT_MOUNTING_TYPE } from '../solarSizing';
import { PRIX_KWH_RESEAU, DEFAULT_REPARTITION } from '../factureConso';

const ETAT = {
  consoMode: 'appareils',
  rows: [
    { rowId: 7, id: 'ac3cv', name: 'Climatiseur 3 CV', power: 2200, quantity: 1, day: 3, night: 4 },
    { rowId: 9, id: 'frigo', name: 'Réfrigérateur', power: 180, quantity: 2, day: 12, night: 12 },
  ],
  manual: { day: '', night: '' },
  facture: { montant: '', prixKwh: PRIX_KWH_RESEAU, repartition: DEFAULT_REPARTITION },
  systemType: 'hybrid',
  autonomyNights: 2,
  mountingType: 'tole',
  includeMounting: false,
  sunHours: 4.3,
  location: { name: 'Lomé', lat: 6.13, lon: 1.22 },
  solar: { source: 'NASA/PVGIS', peakSunHours: 4.3 },
};

describe('capturerDimensionnement', () => {
  it('garde les saisies, pas les résultats', () => {
    const c = capturerDimensionnement(ETAT);
    expect(c.version).toBe(VERSION_DIMENSIONNEMENT);
    expect(c.appareils).toHaveLength(2);
    expect(c.systemType).toBe('hybrid');
    expect(c.autonomyNights).toBe(2);
    expect(c.includeMounting).toBe(false);
    expect(c.location.name).toBe('Lomé');
    expect(c.solarSource).toBe('NASA/PVGIS');
    // Les grandeurs calculées se recalculent : deux copies divergent toujours.
    expect(c).not.toHaveProperty('sizing');
    expect(c).not.toHaveProperty('quotation');
  });

  it('ne recopie que les champs connus d’un appareil', () => {
    const c = capturerDimensionnement({ rows: [{ name: 'X', power: 100, quantity: 1, day: 1, night: 0, secret: 'à ne pas garder' }] });
    expect(c.appareils[0]).not.toHaveProperty('secret');
    expect(Object.keys(c.appareils[0]).sort())
      .toEqual(['day', 'id', 'name', 'night', 'power', 'quantity', 'rowId']);
  });

  it('remplace toute valeur aberrante par son défaut', () => {
    const c = capturerDimensionnement({
      consoMode: 'inconnu', systemType: 'n’importe quoi', mountingType: 'zzz',
      autonomyNights: -3, sunHours: 'beaucoup', facture: { prixKwh: 0, repartition: 'x' },
    });
    expect(c.consoMode).toBe('appareils');
    expect(c.systemType).toBe('off-grid');
    expect(c.mountingType).toBe(DEFAULT_MOUNTING_TYPE);
    expect(c.autonomyNights).toBe(DEFAULT_AUTONOMY_NIGHTS);
    expect(c.sunHours).toBe(DEFAULT_PEAK_SUN_HOURS);
    expect(c.facture.prixKwh).toBe(PRIX_KWH_RESEAU);
    expect(c.facture.repartition).toBe(DEFAULT_REPARTITION);
  });
});

describe('restaurerDimensionnement', () => {
  it('rend l’étude à l’identique après un aller-retour', () => {
    const capture = capturerDimensionnement(ETAT);
    const rendu = restaurerDimensionnement({ dimensionnement: capture });
    expect(rendu.restaure).toBe(true);
    expect({ ...rendu, restaure: undefined }).toEqual({ ...capture, restaure: undefined });
  });

  it('rend un état utilisable pour un devis d’avant la fonctionnalité', () => {
    const rendu = restaurerDimensionnement({ type: 'solar', total: 900000 });
    expect(rendu.restaure).toBe(false);
    expect(rendu.appareils).toEqual([]);
    expect(rendu.systemType).toBe('off-grid');
    expect(rendu.sunHours).toBe(DEFAULT_PEAK_SUN_HOURS);
  });

  it('ne plante pas sur une donnée abîmée', () => {
    for (const abime of [null, undefined, 'texte', 42, [], { appareils: 'pas un tableau' }]) {
      const rendu = restaurerDimensionnement({ dimensionnement: abime });
      expect(Array.isArray(rendu.appareils)).toBe(true);
      expect(rendu.sunHours).toBeGreaterThan(0);
    }
  });
});

// Une ligne d'appareil n'est modifiable QUE par son rowId : le perdre rendrait
// l'étude rouverte consultable mais inerte.
describe('identité des lignes', () => {
  it('conserve le rowId de chaque appareil', () => {
    const c = capturerDimensionnement(ETAT);
    expect(c.appareils.map((a) => a.rowId)).toEqual([7, 9]);
    expect(restaurerDimensionnement({ dimensionnement: c }).appareils.map((a) => a.rowId)).toEqual([7, 9]);
  });

  it('en attribue un aux lignes qui n’en ont pas, sans doublon', () => {
    const c = capturerDimensionnement({ rows: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] });
    const ids = c.appareils.map((a) => a.rowId);
    expect(new Set(ids).size).toBe(3);
  });

  it('donne le prochain identifiant libre, au-dessus de tous les autres', () => {
    expect(prochainRowId(capturerDimensionnement(ETAT).appareils)).toBe(10);
    expect(prochainRowId([])).toBe(1);
  });
});

describe('dimensionnementRejouable', () => {
  it('n’est vrai que pour un devis solaire portant une étude', () => {
    expect(dimensionnementRejouable({ type: 'solar', dimensionnement: { version: 1 } })).toBe(true);
    expect(dimensionnementRejouable({ type: 'solar' })).toBe(false);
    expect(dimensionnementRejouable({ type: 'manual', dimensionnement: { version: 1 } })).toBe(false);
    expect(dimensionnementRejouable(null)).toBe(false);
  });
});

describe('resumeDimensionnement', () => {
  it('résume l’étude en une ligne lisible', () => {
    const devis = {
      type: 'solar',
      dimensionnement: capturerDimensionnement(ETAT),
      consumption: { day: 8.8, night: 8.8 },
    };
    expect(resumeDimensionnement(devis)).toBe('2 appareils · 17,6 kWh/j · hybride');
  });

  it('dit d’où vient la consommation quand il n’y a pas d’appareils', () => {
    const devis = {
      type: 'solar',
      dimensionnement: capturerDimensionnement({ ...ETAT, consoMode: 'facture', rows: [] }),
      consumption: { day: 5, night: 5 },
    };
    expect(resumeDimensionnement(devis)).toContain('depuis la facture');
  });

  it('rend une chaîne vide quand il n’y a rien à résumer', () => {
    expect(resumeDimensionnement({ type: 'manual' })).toBe('');
  });
});
