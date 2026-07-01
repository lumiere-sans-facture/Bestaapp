import { describe, it, expect } from 'vitest';
import {
  detectBrand, parseKva, parseKwh,
  inverterOptionsFromCatalog, batteryOptionsFromCatalog,
  brandsOf, recommendInverterOption, suggestBatteryCombo,
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
  it('ne garde que les onduleurs parsables, triés par capacité, avec marque et prix', () => {
    const opts = inverterOptionsFromCatalog(products);
    expect(opts.map((o) => o.capacity)).toEqual([3, 4.2, 6]);
    expect(opts[2]).toMatchObject({ id: 'i1', brand: 'Growatt', capacity: 6, maxPower: 4800, price: 360000 });
    expect(brandsOf(opts)).toEqual(['Felicity', 'Luxsun', 'Growatt']);
  });
});

describe('batteryOptionsFromCatalog', () => {
  it('mappe capacité/prix depuis le catalogue', () => {
    const opts = batteryOptionsFromCatalog(products);
    expect(opts.map((o) => o.capacity)).toEqual([2.56, 5, 15]);
    expect(opts.find((o) => o.id === 'b1')).toMatchObject({ brand: 'Taico', capacity: 5, price: 480000 });
  });
});

describe('recommendInverterOption', () => {
  it('choisit le plus petit onduleur couvrant la puissance + 20 %', () => {
    const opts = inverterOptionsFromCatalog(products); // maxPower : 2400, 3360, 4800
    expect(recommendInverterOption(opts, 2000).capacity).toBe(3); // 2000*1.2=2400 <= 2400
    expect(recommendInverterOption(opts, 3000).capacity).toBe(6); // 3600 > 3360 (4.2kVA) → 6kVA (4800)
  });
  it('repli sur le plus gros si aucun ne suffit', () => {
    const opts = inverterOptionsFromCatalog(products);
    expect(recommendInverterOption(opts, 100000).capacity).toBe(6);
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
