import { describe, it, expect } from 'vitest';
import { calculateSystemSize, buildQuotation, PANEL_SPEC, PANEL_REFERENCE_WC, parsePanelWc, SIZING_PARAMS } from '../solarSizing';

describe('calculateSystemSize', () => {
  const sizing = calculateSystemSize({ day: 5, night: 5 }, 'off-grid', 5.5);

  it('dimensionne le nombre de panneaux (arrondi au supérieur, min 1)', () => {
    // Besoin ~2 424 Wc, exprimé sur le panneau de référence (620 Wc) → 4 panneaux.
    const attendu = Math.ceil(sizing.requiredPanelPower / PANEL_REFERENCE_WC);
    expect(sizing.numberOfPanels).toBe(attendu);
    expect(sizing.numberOfPanels).toBe(4);
    expect(sizing.panelWc).toBe(PANEL_REFERENCE_WC);
    expect(sizing.panelCapacity).toBeCloseTo((attendu * PANEL_REFERENCE_WC) / 1000, 5);
  });

  it('exprime le besoin sur un autre panneau de référence si on le précise', () => {
    // L'espace Pro passe la puissance du panneau réellement vendu.
    const sur580 = calculateSystemSize({ day: 5, night: 5 }, 'off-grid', 5.5, 580);
    expect(sur580.panelWc).toBe(580);
    expect(sur580.numberOfPanels).toBe(Math.ceil(sur580.requiredPanelPower / 580));
    // La puissance requise, elle, ne dépend pas du panneau retenu.
    expect(sur580.requiredPanelPower).toBeCloseTo(sizing.requiredPanelPower, 5);
    // La puissance installée couvre toujours le besoin.
    expect(sur580.panelCapacity * 1000).toBeGreaterThanOrEqual(sur580.requiredPanelPower);
    expect(sizing.panelCapacity * 1000).toBeGreaterThanOrEqual(sizing.requiredPanelPower);
  });

  it('retombe sur la référence si la puissance fournie est invalide', () => {
    expect(calculateSystemSize({ day: 5, night: 5 }, 'off-grid', 5.5, 0).panelWc).toBe(PANEL_REFERENCE_WC);
    expect(calculateSystemSize({ day: 5, night: 5 }, 'off-grid', 5.5, null).panelWc).toBe(PANEL_REFERENCE_WC);
  });

  it('lit la puissance crête d’un panneau depuis sa désignation', () => {
    expect(parsePanelWc('Panneaux Photovoltaïque 580W Jinko')).toBe(580);
    expect(parsePanelWc('Panneau solaire monocristallin 620 Wc')).toBe(620);
    expect(parsePanelWc('Onduleur hybride 5kVA')).toBeNull();
  });

  it('dimensionne les batteries avec le rendement LITHIUM et un DoD de 80 %', () => {
    // Le catalogue ne vend que du LiFePO4 : rendement aller-retour 95 %
    // (85 % est une valeur plomb). La profondeur de décharge reste à 80 %,
    // marge de sécurité maison sur les ≥ 95 % annoncés par les constructeurs.
    expect(SIZING_PARAMS.batteryEfficiency).toBe(0.95);
    expect(SIZING_PARAMS.depthOfDischarge).toBe(0.8);
    // Capacité = conso nocturne ÷ rendement ÷ DoD
    expect(sizing.batteryCapacity).toBeCloseTo(5 / 0.95 / 0.8, 5);
    // Le rendement plomb (85 %) gonflerait le parc d'environ 12 %.
    expect(5 / 0.85 / 0.8).toBeGreaterThan(sizing.batteryCapacity * 1.1);
  });

  it('choisit un onduleur avec 20 % de marge', () => {
    // Sans pic déclaré, la puissance PV posée sert de repère :
    // 4 panneaux × 620 Wc = 2 480 W ; +20 % = 2 976 W -> 3 kVA (3 000 W).
    expect(sizing.inverter.capacity).toBe(3);
  });

  it('ne rejette pas une sortie onduleur quand le pic n’est pas mesuré', () => {
    // En saisie directe ou par facture, il n’y a pas de liste d’appareils :
    // le pic est inconnu. Deux Deye 12 kVA peuvent donc être retenus selon
    // leurs limites PV cumulées, sans erreur de sortie basée sur les panneaux.
    const deuxDeye = [{ id: 'deye-12', capacity: 12, maxPower: 12000, maxPvPower: 12000 }];
    const resultat = calculateSystemSize(
      { day: 60, night: 40 }, 'off-grid', 5, undefined, 1,
      { peakLoad: 0, inverters: deuxDeye, configures: deuxDeye },
    );
    expect(resultat.inverterQuantite).toBe(2);
    expect(resultat.inverterTientPic).toBe(true);
    expect(resultat.inverterSuffisant).toBe(true);
  });

  it('sans pic mesuré, la puissance PV guide quand même le CHOIX du calibre', () => {
    // L'indulgence du verdict ne doit pas neutraliser la sélection : sinon le
    // plus petit onduleur du catalogue est retenu pour n'importe quel besoin.
    const gamme = [
      { id: 'p1', capacity: 1, maxPvPower: 1300 },
      { id: 'p6', capacity: 6, maxPvPower: 7800 },
      { id: 'p12', capacity: 12, maxPvPower: 15600 },
    ];
    const petit = calculateSystemSize({ day: 5, night: 5 }, 'off-grid', 5.5, undefined, 1,
      { peakLoad: 0, inverters: gamme });
    const gros = calculateSystemSize({ day: 30, night: 20 }, 'off-grid', 5.5, undefined, 1,
      { peakLoad: 0, inverters: gamme });
    // 2 480 Wc posés → 1 kVA insuffisant ; 23 500 Wc → il faut le plus grand.
    expect(petit.inverter.capacity).toBe(6);
    expect(gros.inverter.capacity).toBe(12);
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

  it('autonomie batterie : les panneaux grandissent avec les nuits couvertes (off-grid/hybride)', () => {
    // Un parc batterie taillé pour 2 nuits doit pouvoir se recharger en une
    // journée même après une nuit blanche : les panneaux sont donc dimensionnés
    // sur (jour + nuit × nuits d'autonomie), pas seulement sur jour + nuit.
    const uneNuit = calculateSystemSize({ day: 5, night: 5 }, 'off-grid', 5.5, undefined, 1);
    const deuxNuits = calculateSystemSize({ day: 5, night: 5 }, 'off-grid', 5.5, undefined, 2);
    expect(deuxNuits.requiredPanelPower).toBeCloseTo(uneNuit.requiredPanelPower + (5 / SIZING_PARAMS.panelEfficiency / 5.5) * 1000, 5);
    expect(deuxNuits.numberOfPanels).toBeGreaterThan(uneNuit.numberOfPanels);
    expect(deuxNuits.batteryCapacity).toBeCloseTo(uneNuit.batteryCapacity * 2, 5);

    const hybride2 = calculateSystemSize({ day: 5, night: 5 }, 'hybrid', 5.5, undefined, 2);
    const hybride1 = calculateSystemSize({ day: 5, night: 5 }, 'hybrid', 5.5, undefined, 1);
    expect(hybride2.requiredPanelPower).toBeGreaterThan(hybride1.requiredPanelPower);

    // Sans batterie, l'autonomie n'a pas de sens : les panneaux ne bougent pas.
    const onGrid1 = calculateSystemSize({ day: 5, night: 5 }, 'on-grid', 5.5, undefined, 1);
    const onGrid2 = calculateSystemSize({ day: 5, night: 5 }, 'on-grid', 5.5, undefined, 2);
    expect(onGrid2.requiredPanelPower).toBeCloseTo(onGrid1.requiredPanelPower, 5);
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

  it('privilégie le prix PUBLIC du catalogue produits quand fourni (jamais le prix technicien)', () => {
    const products = [{ category: 'panneaux', name: 'Panneau 550Wc', basePrice: 80000 }];
    const panneau = buildQuotation(sizing, { products }).components.find((c) => c.type === 'panneau');
    expect(panneau.unitPrice).toBe(Math.round(80000 * 1.1));
  });
});
