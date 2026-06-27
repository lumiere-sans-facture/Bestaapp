import { describe, it, expect } from 'vitest';
import { SOLAR_KITS } from '../../data/kits';
import { buildKitQuotation } from '../solarSizing';

const byId = (id) => SOLAR_KITS.find((k) => k.id === id);

describe('buildKitQuotation', () => {
  it('Kit 5 kWh : total exact 1 544 000 F, sans TVA', () => {
    const q = buildKitQuotation(byId('kit-5kwh'));
    expect(q.total).toBe(1544000);
    expect(q.subtotalHT).toBe(1544000); // HT = TTC
    expect(q.tva).toBe(0);
  });

  it('Kit 16 kWh : total exact 2 669 000 F', () => {
    expect(buildKitQuotation(byId('kit-16kwh')).total).toBe(2669000);
  });

  it('sépare équipements et prestations (Main d’œuvre)', () => {
    const q = buildKitQuotation(byId('kit-5kwh'));
    expect(q.prestations).toHaveLength(1);
    expect(q.prestations[0].name).toBe("Main d'œuvre");
    expect(q.components).toHaveLength(13); // 14 lignes - 1 main d'œuvre
    // somme cohérente
    const sum = [...q.components, ...q.prestations].reduce((s, c) => s + c.totalPrice, 0);
    expect(sum).toBe(q.total);
  });

  it('le format est compatible avec le rendu PDF (name/quantity/unitPrice/totalPrice)', () => {
    const c = buildKitQuotation(byId('kit-5kwh')).components[0];
    expect(c).toMatchObject({ name: expect.any(String), quantity: expect.any(Number), unitPrice: expect.any(Number), totalPrice: expect.any(Number) });
  });
});
