import { describe, it, expect } from 'vitest';
import { calculateSystemSize, buildQuotation, PANEL_SPEC } from '../solarSizing';

describe('calculateSystemSize', () => {
  const sizing = calculateSystemSize({ day: 5, night: 5 }, 'off-grid', 5.5);

  it('dimensionne le nombre de panneaux (arrondi au supérieur, min 1)', () => {
    expect(sizing.numberOfPanels).toBe(5);
    expect(sizing.panelCapacity).toBeCloseTo(2.75, 5);
  });

  it('choisit un onduleur avec 20 % de marge', () => {
    // besoin ~2424 W -> +20% = 2909 W -> premier onduleur >= 2909 = 5 kVA
    expect(sizing.inverter.capacity).toBe(5);
  });

  it('off-grid : prévoit des batteries ; on-grid : aucune', () => {
    expect(sizing.batteries.length).toBeGreaterThan(0);
    const onGrid = calculateSystemSize({ day: 5, night: 5 }, 'on-grid', 5.5);
    expect(onGrid.batteries.length).toBe(0);
    expect(onGrid.batteryCapacity).toBe(0);
  });

  it('garde au moins un panneau pour une conso minime', () => {
    expect(calculateSystemSize({ day: 0, night: 0.1 }, 'on-grid', 5.5).numberOfPanels).toBe(1);
  });
});

describe('buildQuotation', () => {
  const sizing = calculateSystemSize({ day: 5, night: 5 }, 'off-grid', 5.5);

  it('respecte la cohérence des totaux (HT, TVA 18 %, TTC)', () => {
    const q = buildQuotation(sizing, { products: [], includeMaintenance: true });
    const sumPrestations = q.prestations.reduce((s, p) => s + p.totalPrice, 0);
    expect(q.subtotalHT).toBe(q.equipmentCost + sumPrestations);
    expect(q.tva).toBe(Math.round(q.subtotalHT * 0.18));
    expect(q.total).toBe(q.subtotalHT + q.tva);
  });

  it('utilise le prix catalogue par défaut sans produits', () => {
    const q = buildQuotation(sizing, { products: [] });
    const panneau = q.components.find((c) => c.type === 'panneau');
    expect(panneau.unitPrice).toBe(PANEL_SPEC.price);
    expect(panneau.quantity).toBe(sizing.numberOfPanels);
    expect(panneau.totalPrice).toBe(sizing.numberOfPanels * PANEL_SPEC.price);
  });

  it('inclut ou exclut la maintenance selon l’option', () => {
    expect(buildQuotation(sizing, { products: [], includeMaintenance: true }).maintenanceCost).toBe(50000);
    const sans = buildQuotation(sizing, { products: [], includeMaintenance: false });
    expect(sans.maintenanceCost).toBe(0);
    expect(sans.prestations).toHaveLength(1);
  });

  it('privilégie le prix du catalogue produits quand fourni', () => {
    const products = [{ category: 'panneaux', name: 'Panneau 550Wc', basePrice: 80000 }];
    const panneau = buildQuotation(sizing, { products }).components.find((c) => c.type === 'panneau');
    expect(panneau.unitPrice).toBe(80000);
  });
});
