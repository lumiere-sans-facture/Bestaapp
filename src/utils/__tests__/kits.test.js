import { describe, it, expect } from 'vitest';
import { SOLAR_KITS } from '../../data/kits';
import { buildKitQuotation, suggestKitForBattery, MOUNTING_TYPES } from '../solarSizing';

const byId = (id) => SOLAR_KITS.find((k) => k.id === id);

describe('buildKitQuotation', () => {
  // Totaux exacts des 5 devis kits officiels (prix tout compris, sans TVA),
  // sur le support par défaut (tôle) : la ligne « Structure de montage » du
  // kit est recalculée au panneau, pas au prix fixe de data/kits.js.
  const TOTALS = {
    'kit-2.5kwh-eco': 625000,
    'kit-2.5kwh-premium': 715000,
    'kit-5kwh': 1180000,
    'kit-20kwh': 3224000,
    'kit-32kwh': 4358000,
  };

  it('propose les 5 kits officiels', () => {
    expect(SOLAR_KITS.map((k) => k.id)).toEqual(Object.keys(TOTALS));
  });

  for (const [id, total] of Object.entries(TOTALS)) {
    it(`${id} : total exact ${total.toLocaleString('fr-FR')} F, sans TVA`, () => {
      const q = buildKitQuotation(byId(id));
      expect(q.total).toBe(total);
      expect(q.subtotalHT).toBe(total); // HT = TTC
      expect(q.tva).toBe(0);
    });
  }

  it('chaque kit porte panneaux, puissance panneau, batterie et onduleur', () => {
    for (const k of SOLAR_KITS) {
      expect(k.panels).toBeGreaterThan(0);
      expect(k.panelW).toBeGreaterThanOrEqual(500);
      expect(k.battery).toBeGreaterThan(0);
      expect(k.inverter).toBeGreaterThan(0);
    }
  });

  it('sépare équipements et prestations (Main d’œuvre)', () => {
    const q = buildKitQuotation(byId('kit-5kwh'));
    expect(q.prestations).toHaveLength(1);
    expect(q.prestations[0].name).toBe("Main d'œuvre");
    expect(q.components).toHaveLength(8); // 9 lignes - 1 main d'œuvre
    // somme cohérente
    const sum = [...q.components, ...q.prestations].reduce((s, c) => s + c.totalPrice, 0);
    expect(sum).toBe(q.total);
  });

  it('le kit 32 kWh détaille ses 2 modules batterie de 16 kWh', () => {
    expect(byId('kit-32kwh').batteryModules).toEqual([{ capacity: 16, qty: 2 }]);
  });

  it('le format est compatible avec le rendu PDF (name/quantity/unitPrice/totalPrice)', () => {
    const c = buildKitQuotation(byId('kit-5kwh')).components[0];
    expect(c).toMatchObject({ name: expect.any(String), quantity: expect.any(Number), unitPrice: expect.any(Number), totalPrice: expect.any(Number) });
  });

  it('le type de support recalcule la ligne « Structure de montage » au panneau', () => {
    const kit = byId('kit-5kwh'); // 4 panneaux
    for (const m of MOUNTING_TYPES) {
      const q = buildKitQuotation(kit, m.id);
      const ligne = q.components.find((c) => /structure de montage/i.test(c.name));
      expect(ligne.quantity).toBe(kit.panels);
      expect(ligne.unitPrice).toBe(m.pricePerPanel);
      expect(ligne.totalPrice).toBe(kit.panels * m.pricePerPanel);
      expect(ligne.name).toContain(m.label);
    }
    // Un support plus coûteux (dalle, au sol) fait monter le total du devis.
    const tole = buildKitQuotation(kit, 'tole').total;
    const dalle = buildKitQuotation(kit, 'dalle').total;
    const sol = buildKitQuotation(kit, 'sol').total;
    expect(dalle).toBeGreaterThan(tole);
    expect(sol).toBeGreaterThan(dalle);
  });

  it('un kit sans ligne « Structure de montage » (20/32 kWh) ignore le type de support', () => {
    const kit = byId('kit-20kwh');
    const tole = buildKitQuotation(kit, 'tole').total;
    const sol = buildKitQuotation(kit, 'sol').total;
    expect(tole).toBe(sol);
  });

  it('includeMounting=false retire la ligne « Structure de montage » du devis', () => {
    const kit = byId('kit-5kwh');
    const avec = buildKitQuotation(kit, 'tole', true);
    const sans = buildKitQuotation(kit, 'tole', false);
    const ligneMontage = (q) => q.components.find((c) => /structure de montage/i.test(c.name));
    expect(ligneMontage(avec)).toBeDefined();
    expect(ligneMontage(sans)).toBeUndefined();
    expect(sans.components).toHaveLength(avec.components.length - 1);
    const montagePrice = ligneMontage(avec).totalPrice;
    expect(sans.total).toBe(avec.total - montagePrice);
  });

  it('includeMounting=false sur un kit sans structure ne change rien', () => {
    const kit = byId('kit-20kwh');
    expect(buildKitQuotation(kit, 'tole', false).total).toBe(buildKitQuotation(kit, 'tole', true).total);
  });

  it('complète automatiquement les panneaux si le besoin calculé en exige plus que le kit', () => {
    const kit = byId('kit-20kwh'); // 12 panneaux, 620 Wc, sans ligne de montage
    const sizing = { requiredPanelPower: 16 * kit.panelW }; // besoin = 16 panneaux
    const q = buildKitQuotation(kit, 'tole', true, sizing);
    const lignePanneaux = q.components.find((c) => /panneau/i.test(c.name));
    expect(q.panelsIncluded).toBe(16);
    expect(lignePanneaux.quantity).toBe(16);
    expect(lignePanneaux.totalPrice).toBe(16 * lignePanneaux.unitPrice);
    // Le total du devis intègre le surcoût des panneaux ajoutés.
    const sansSizing = buildKitQuotation(kit, 'tole', true);
    expect(q.total).toBe(sansSizing.total + 4 * lignePanneaux.unitPrice);
  });

  it('ne réduit jamais les panneaux du kit si le besoin calculé en exige moins', () => {
    const kit = byId('kit-20kwh'); // 12 panneaux
    const sizing = { requiredPanelPower: 5 * kit.panelW }; // besoin ne demande que 5 panneaux
    const q = buildKitQuotation(kit, 'tole', true, sizing);
    expect(q.panelsIncluded).toBe(kit.panels);
  });

  it('la complétion des panneaux fait aussi grandir la structure de montage (au panneau)', () => {
    const kit = byId('kit-5kwh'); // 4 panneaux, 590 Wc
    const sizing = { requiredPanelPower: 6 * kit.panelW }; // besoin = 6 panneaux
    const q = buildKitQuotation(kit, 'tole', true, sizing);
    const montage = q.components.find((c) => /structure de montage/i.test(c.name));
    expect(montage.quantity).toBe(6);
    expect(montage.totalPrice).toBe(6 * 10000);
  });

  it('sans sizing, le nombre de panneaux du kit est inchangé', () => {
    const kit = byId('kit-5kwh');
    expect(buildKitQuotation(kit).panelsIncluded).toBe(kit.panels);
  });

  it('une ligne liée à un produit boutique suit son prix public actuel dans le devis', () => {
    const kitBase = byId('kit-5kwh');
    const ligneBatterie = kitBase.lines.find((l) => /batterie/i.test(l.designation));
    const kit = { ...kitBase, lines: kitBase.lines.map((l) => (l === ligneBatterie ? { ...l, productId: 'prod-batterie' } : l)) };

    const sansProduits = buildKitQuotation(kit, 'tole', true);
    const ligneSansProduits = sansProduits.components.find((c) => /batterie/i.test(c.name));
    expect(ligneSansProduits.unitPrice).toBe(ligneBatterie.pu); // repli : produit pas (encore) chargé

    // Le produit boutique change de prix : la ligne du kit suit, sans y retoucher.
    const produits = [{ id: 'prod-batterie', basePrice: 500000 }];
    const q = buildKitQuotation(kit, 'tole', true, null, [], produits);
    const ligne = q.components.find((c) => /batterie/i.test(c.name));
    expect(ligne.unitPrice).toBe(Math.round(500000 * 1.1));
    expect(ligne.unitPrice).not.toBe(ligneBatterie.pu);
  });
});

describe('suggestKitForBattery', () => {
  // Kits de test : batteries 5, 10, 12, 15, 20 kWh.
  const kits = [
    { id: 'k5', battery: 5 },
    { id: 'k10', battery: 10 },
    { id: 'k12', battery: 12 },
    { id: 'k15', battery: 15 },
    { id: 'k20', battery: 20 },
  ];

  it('ne suggère jamais un kit dont la batterie est inférieure au besoin', () => {
    // Besoin 11 kWh : 10 kWh est plus proche en valeur absolue, mais
    // insuffisant. Le kit 12 kWh doit être retenu, jamais le 10 kWh.
    expect(suggestKitForBattery(kits, 11).id).toBe('k12');
  });

  it('retient le plus petit kit qui couvre exactement le besoin', () => {
    expect(suggestKitForBattery(kits, 5).id).toBe('k5');
    expect(suggestKitForBattery(kits, 12).id).toBe('k12');
  });

  it('retombe sur le kit le plus proche si aucun ne couvre le besoin', () => {
    // Besoin 25 kWh : aucun kit n'atteint 25 kWh, on retombe sur le plus gros (20 kWh).
    expect(suggestKitForBattery(kits, 25).id).toBe('k20');
  });

  it('gère une liste vide ou un besoin nul', () => {
    expect(suggestKitForBattery([], 10)).toBeNull();
    expect(suggestKitForBattery(kits, 0).id).toBe('k5');
  });

  it('sur les kits officiels : suggère toujours une batterie ≥ besoin quand c\'est possible', () => {
    for (const need of [1, 2.5, 4, 5, 10, 19, 20, 25, 32]) {
      const suggestion = suggestKitForBattery(SOLAR_KITS, need);
      const couverts = SOLAR_KITS.filter((k) => k.battery >= need);
      if (couverts.length) expect(suggestion.battery).toBeGreaterThanOrEqual(need);
    }
  });
});
