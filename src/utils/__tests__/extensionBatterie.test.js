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
    // Au-delà du 128 kWh : le 208 kWh, puis le plus gros possible.
    expect(noms(129)).toEqual(['kit-208kwh-deye-hv']);
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
    expect(a84.total).toBe(15044000 + 2 * 1245000);
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
