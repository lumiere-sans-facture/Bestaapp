import { describe, it, expect } from 'vitest';
import {
  detectBrand, parseKva, parseKwh,
  inverterOptionsFromCatalog, batteryOptionsFromCatalog,
  brandsOf, suggestInverterFor, suggestBatteryCombo,
} from '../solarSizing';

const products = [
  { id: 'i1', name: 'Onduleur Hybride 6kva Growatt', category: 'onduleurs', basePrice: 360000 },
  { id: 'i2', name: 'Onduleur Hybride 4.2kva Luxsun', category: 'onduleurs', basePrice: 165000 },
  { id: 'i3', name: 'Onduleur Hybride 3kva Felicity', category: 'onduleurs', basePrice: 180000 },
  { id: 'b1', name: 'Batterie lithium 5kwh Taico', category: 'batteries', basePrice: 480000 },
  { id: 'b2', name: 'Batterie lithium 2,56kwh Itel Energy', category: 'batteries', basePrice: 220000 },
  { id: 'b3', name: 'Batterie au lithium Luxsun 15 kWh 51,2 V', category: 'batteries', basePrice: 990000 },
  { id: 'x1', name: 'Contrôleur de charge MPPT Felicity', category: 'controleurs', basePrice: 60000 },
];

describe('detectBrand', () => {
  it('reconnaît les marques dans le nom', () => {
    expect(detectBrand('Onduleur Hybride 6kva Growatt')).toBe('Growatt');
    expect(detectBrand('Batterie lithium 5kwh Taico')).toBe('Taico');
    expect(detectBrand('Batterie 2,56kwh Itel Energy')).toBe('Itel Energy');
  });
  it('repli « Autre » si aucune marque connue', () => {
    expect(detectBrand('Onduleur générique 5kva')).toBe('Autre');
  });
});

describe('parseKva / parseKwh', () => {
  it('extrait la capacité (virgule ou point, espace)', () => {
    expect(parseKva('Onduleur 6kva Growatt')).toBe(6);
    expect(parseKva('Onduleur 4.2kva Luxsun')).toBe(4.2);
    expect(parseKwh('Batterie 2,56kwh')).toBe(2.56);
    expect(parseKwh('Batterie 15 kWh Grade A')).toBe(15);
  });
  it('null si non trouvé', () => {
    expect(parseKva('Batterie 5kwh')).toBeNull();
    expect(parseKwh('Onduleur 6kva')).toBeNull();
  });
});

describe('inverterOptionsFromCatalog', () => {
  it('ne garde que les onduleurs parsables, triés par capacité, avec marque et prix PUBLIC', () => {
    const opts = inverterOptionsFromCatalog(products);
    expect(opts.map((o) => o.capacity)).toEqual([3, 4.2, 6]);
    // price = prix public (basePrice × 1,1), jamais le prix technicien —
    // un devis client ne doit jamais montrer le prix de gros BestaSolar.
    expect(opts[2]).toMatchObject({ id: 'i1', brand: 'Growatt', capacity: 6, maxPower: 4800, price: Math.round(360000 * 1.1) });
    expect(brandsOf(opts)).toEqual(['Felicity', 'Luxsun', 'Growatt']);
  });
});

describe('batteryOptionsFromCatalog', () => {
  it('mappe capacité/prix PUBLIC depuis le catalogue', () => {
    const opts = batteryOptionsFromCatalog(products);
    expect(opts.map((o) => o.capacity)).toEqual([2.56, 5, 15]);
    expect(opts.find((o) => o.id === 'b1')).toMatchObject({ brand: 'Taico', capacity: 5, price: Math.round(480000 * 1.1) });
  });
});

describe('onduleurs du catalogue boutique : choix sur le pic', () => {
  it('choisit le plus petit onduleur qui tient le pic + 20 %', () => {
    const opts = inverterOptionsFromCatalog(products); // sorties : 2400, 3360, 4800
    expect(suggestInverterFor(opts, { peakLoad: 2000 }).capacity).toBe(3); // 2000×1,2 = 2400 ≤ 2400
    expect(suggestInverterFor(opts, { peakLoad: 3000 }).capacity).toBe(6); // 3600 > 3360 → 6 kVA
  });
  it('repli sur le plus gros si aucun ne suffit', () => {
    const opts = inverterOptionsFromCatalog(products);
    expect(suggestInverterFor(opts, { peakLoad: 100000 }).capacity).toBe(6);
  });
  it('la limite PV vient des onduleurs configurés (Plus › Onduleurs)', () => {
    const opts = inverterOptionsFromCatalog(products);
    // Le 3 kVA tiendrait le pic, mais il n'accepte que 3 900 Wc de panneaux.
    const configures = [{ capacity: 3, maxPvPower: 3900 }, { capacity: 6, maxPvPower: 7800 }];
    expect(suggestInverterFor(opts, { peakLoad: 1500, pvPower: 5000, configures }).capacity).toBe(6);
  });
});

describe('suggestBatteryCombo', () => {
  it('approche la capacité requise en privilégiant les gros modules', () => {
    const opts = batteryOptionsFromCatalog(products); // 2.56, 5, 15
    const combo = suggestBatteryCombo(opts, 20);
    const total = Object.entries(combo).reduce((s, [id, q]) => s + opts.find((o) => o.id === id).capacity * q, 0);
    expect(total).toBeGreaterThanOrEqual(15);
  });
  it('vide si pas d’options ou besoin nul', () => {
    expect(suggestBatteryCombo([], 10)).toEqual({});
    expect(suggestBatteryCombo(batteryOptionsFromCatalog(products), 0)).toEqual({});
  });
});
