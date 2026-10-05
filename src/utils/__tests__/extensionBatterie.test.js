import { describe, it, expect } from 'vitest';
import { capacitePourBesoin, capaciteMaxKit, etendreBatterie, completerExtensions } from '../extensionBatterie';
import { suggestKitsForBattery, buildKitQuotation } from '../solarSizing';
import { SOLAR_KITS } from '../../data/kits';

const k60 = SOLAR_KITS.find((k) => k.id === 'kit-60kwh-deye-hv');
const noms = (besoin) => suggestKitsForBattery(SOLAR_KITS, besoin).map((k) => k.id);

describe('kit 60 kWh extensible jusqu’à 120 kWh', () => {
  it('capacité posée : modules de 12 kWh juste suffisants, 120 kWh au plus', () => {
    expect(capacitePourBesoin(k60, 50)).toBe(60);
    expect(capacitePourBesoin(k60, 61)).toBe(72);
    expect(capacitePourBesoin(k60, 96)).toBe(96);
    expect(capacitePourBesoin(k60, 120)).toBe(120);
    expect(capacitePourBesoin(k60, 121)).toBeNull();
    expect(capaciteMaxKit(k60)).toBe(120);
  });

  it('suggestion : 60 kWh étendu jusqu’à 120, puis le 128 kWh au-delà', () => {
    expect(noms(55)).toEqual(['kit-60kwh-deye-hv']);
    expect(noms(70)).toEqual(['kit-60kwh-deye-hv']);
    expect(noms(120)).toEqual(['kit-60kwh-deye-hv']);
    expect(noms(121)).toEqual(['kit-128kwh-deye-hv']);
    expect(noms(128)).toEqual(['kit-128kwh-deye-hv']);
    expect(noms(500)).toEqual(['kit-208kwh-deye-hv']);
    // Les petits besoins ne bougent pas.
    expect(noms(40)).toEqual(['kit-48kwh']);
  });

  it('devis : seule la ligne des modules change, au prix du module', () => {
    const de = (besoin) => buildKitQuotation(k60, 'tole', true, { batteryCapacity: besoin });
    const base = de(50);
    expect(base.batteryCapacity).toBe(60);
    expect(base.total).toBe(15044000);
    const a84 = de(80);
    expect(a84.batteryCapacity).toBe(84);
    expect(a84.components.find((c) => /^Batterie/.test(c.name)).quantity).toBe(7);
    // + supplément main-d'œuvre : 24 kWh ajoutés × 3 500 F.
    expect(a84.total).toBe(15044000 + 2 * 1245000 + 24 * 3500);
    // Le boîtier de contrôle et le socle restent uniques.
    expect(a84.components.find((c) => /CONTROL BOX/.test(c.name)).quantity).toBe(1);
    expect(de(120).components.find((c) => /^Batterie/.test(c.name)).quantity).toBe(10);
  });

  it('un kit sans extension n’est jamais étendu', () => {
    const k48 = SOLAR_KITS.find((k) => k.id === 'kit-48kwh');
    expect(capacitePourBesoin(k48, 60)).toBeNull();
    const r = etendreBatterie(k48, k48.lines, 60);
    expect(r.lignes).toBe(k48.lines);
    expect(r.capacite).toBe(48);
  });

  it('migration : le kit 60 kWh déjà enregistré reçoit l’extension, une seule fois', () => {
    const ancien = { ...k60 };
    delete ancien.extensionBatterie;
    const liste = [ancien, { id: 'kit-perso', battery: 5 }];
    const suite = completerExtensions(liste, SOLAR_KITS);
    expect(suite[0].extensionBatterie).toEqual({ moduleKwh: 12, maxKwh: 120 });
    expect(suite[1]).toBe(liste[1]);
    expect(completerExtensions(suite, SOLAR_KITS)).toBe(suite);
  });
});

describe('kit 128 kWh extensible jusqu’à 200 kWh', () => {
  const k128 = SOLAR_KITS.find((k) => k.id === 'kit-128kwh-deye-hv');

  it('modules de 16 kWh : 144, 160… jusqu’à 192 kWh (12 modules)', () => {
    expect(capacitePourBesoin(k128, 129)).toBe(144);
    expect(capacitePourBesoin(k128, 150)).toBe(160);
    expect(capacitePourBesoin(k128, 192)).toBe(192);
    // 193 kWh demanderait 13 modules (208 kWh) : hors de l'extension.
    expect(capacitePourBesoin(k128, 193)).toBeNull();
    expect(capaciteMaxKit(k128)).toBe(192);
  });

  it('suggestion : 128 kWh étendu jusqu’à 192 kWh, puis le 208 kWh', () => {
    expect(noms(129)).toEqual(['kit-128kwh-deye-hv']);
    expect(noms(192)).toEqual(['kit-128kwh-deye-hv']);
    expect(noms(193)).toEqual(['kit-208kwh-deye-hv']);
    expect(noms(200)).toEqual(['kit-208kwh-deye-hv']);
  });

  it('devis : modules à 1 375 000 F, boîtier de contrôle unique', () => {
    const d = buildKitQuotation(k128, 'tole', true, { batteryCapacity: 150 });
    expect(d.batteryCapacity).toBe(160);
    expect(d.components.find((c) => /^Batterie/.test(c.name)).quantity).toBe(10);
    expect(d.components.find((c) => /CONTROL BOX/.test(c.name)).quantity).toBe(1);
    expect(d.total).toBe(28110000 + 2 * 1375000 + 32 * 3500);
  });

  it('migration : le 128 kWh déjà enregistré reçoit aussi l’extension', () => {
    const ancien = { ...k128 };
    delete ancien.extensionBatterie;
    expect(completerExtensions([ancien], SOLAR_KITS)[0].extensionBatterie).toEqual({ moduleKwh: 16, maxKwh: 200 });
  });
});

describe('kit 208 kWh extensible jusqu’à 256 kWh (16 modules B-PRO)', () => {
  const k208 = SOLAR_KITS.find((k) => k.id === 'kit-208kwh-deye-hv');
  const modules = (d) => d.components.find((c) => /^Batterie/.test(c.name)).quantity;

  it('paliers 224, 240, 256 kWh', () => {
    expect(capacitePourBesoin(k208, 200)).toBe(208);
    expect(capacitePourBesoin(k208, 209)).toBe(224);
    expect(capacitePourBesoin(k208, 240)).toBe(240);
    expect(capacitePourBesoin(k208, 256)).toBe(256);
    expect(capaciteMaxKit(k208)).toBe(256);
  });

  it('suggestion : le 208 kWh, étendu, pour tout besoin au-delà de 192 kWh', () => {
    expect(noms(230)).toEqual(['kit-208kwh-deye-hv']);
    expect(noms(400)).toEqual(['kit-208kwh-deye-hv']);
  });

  it('devis : 15 modules pour 240 kWh, boîtier unique', () => {
    const d = buildKitQuotation(k208, 'tole', true, { batteryCapacity: 235 });
    expect(d.batteryCapacity).toBe(240);
    expect(modules(d)).toBe(15);
    expect(d.components.find((c) => /CONTROL BOX/.test(c.name)).quantity).toBe(1);
    expect(d.total).toBe(50055000 + 2 * 1375000 + 32 * 3500);
  });

  it('besoin au-delà de 256 kWh : porté au maximum, 16 modules', () => {
    const d = buildKitQuotation(k208, 'tole', true, { batteryCapacity: 400 });
    expect(d.batteryCapacity).toBe(256);
    expect(modules(d)).toBe(16);
  });

  it('migration : le 208 kWh déjà enregistré reçoit l’extension', () => {
    const ancien = { ...k208 };
    delete ancien.extensionBatterie;
    expect(completerExtensions([ancien], SOLAR_KITS)[0].extensionBatterie).toEqual({ moduleKwh: 16, maxKwh: 256 });
  });
});
