// Kits solaires préconfigurés (compositions et prix officiels BestaSolar).
// Sélectionner un kit charge l'intégralité de ses lignes dans le devis,
// sans passer par le calcul de composition. Prix tout compris (sans TVA).

// [désignation, quantité, unité, prix unitaire] — « Main d'œuvre » = prestation.
const toLines = (rows) =>
  rows.map(([designation, qty, unit, pu]) => ({
    designation, qty, unit, pu, labor: designation === "Main d'œuvre",
  }));

export const SOLAR_KITS = [
  {
    id: 'kit-2.5kwh-eco',
    name: 'Kit 2,5 kWh — Essentiel',
    battery: 2.5, // kWh — pour la suggestion automatique
    panels: 2,
    panelW: 500, // Wc par panneau
    inverter: 3, // kVA
    lines: toLines([
      ['Batterie lithium 24V (2,5kwh) HZ', 1, 'pcs', 230000],
      ['Panneaux photovoltaïque 500Wc', 2, 'pcs', 60000],
      ['Onduleur hybride 3kva HZ', 1, 'pcs', 160000],
      ['Coffret de protection DC/AC', 1, 'pcs', 45000],
      ['Structure de montage PV rails galvanisé', 1, 'pcs', 25000],
      ['Câble PV 1x4mm²', 30, 'm', 500],
      ["Main d'œuvre", 1, 'pcs', 35000],
    ]),
  },
  {
    id: 'kit-2.5kwh-premium',
    name: 'Kit 2,5 kWh — Premium',
    battery: 2.5,
    panels: 2,
    panelW: 590,
    inverter: 3,
    lines: toLines([
      ['Batterie lithium 24V (2,5kwh) BEVE Smart BMS', 1, 'pcs', 250000],
      ['Panneaux photovoltaïque 590Wc', 2, 'pcs', 65000],
      ['Onduleur hybride 3kva Itel', 1, 'pcs', 190000],
      ['Coffret de protection DC/AC', 1, 'pcs', 45000],
      ['Structure de montage PV rails galvanisé', 1, 'pcs', 25000],
      ['Câble PV 1x4mm²', 30, 'm', 500],
      ['Kit terre', 1, 'pcs', 15000],
      ['Câble terre', 10, 'pcs', 1000],
      ["Main d'œuvre", 1, 'pcs', 40000],
    ]),
  },
  {
    id: 'kit-5kwh',
    name: 'Kit 5 kWh',
    battery: 5,
    panels: 4,
    panelW: 590,
    inverter: 6,
    lines: toLines([
      ['Batterie lithium 48V (5kwh) HZ', 1, 'pcs', 460000],
      ['Panneaux photovoltaïque 590Wc', 4, 'pcs', 65000],
      ['Onduleur hybride 6kva HZ', 1, 'pcs', 250000],
      ['Coffret de protection DC/AC', 1, 'pcs', 45000],
      ['Structure de montage PV rails galvanisé (tôle)', 1, 'pcs', 60000],
      ['Câble PV 1x4mm²', 30, 'm', 500],
      ['Kit terre', 1, 'pcs', 20000],
      ['Câble terre 1x10mm²', 10, 'pcs', 1500],
      ["Main d'œuvre", 1, 'pcs', 75000],
    ]),
  },
  {
    id: 'kit-16kwh',
    name: 'Kit 16 kWh',
    battery: 16,
    panels: 10,
    panelW: 590,
    inverter: 6,
    lines: toLines([
      ['Batterie lithium 48V (16kwh) Beve', 1, 'pcs', 1000000],
      ['Panneaux photovoltaïque 590Wc', 10, 'pcs', 63000],
      ['Onduleur hybride Beve 6kva', 1, 'pcs', 310000],
      ['Coffret de protection DC 2 entrée/sortie', 1, 'pcs', 65000],
      ['Dijoncteur compacte 125A', 1, 'pcs', 22000],
      ['Câble PV 1x6mm² Rouge/Noire', 100, 'm', 700],
      ['Câble batterie 1x35mm²', 2, 'm', 4000],
      ['Cosse batterie cuivre de 35mm²', 4, 'pcs', 1500],
      ['Moulure 40x40', 2, 'pcs', 5500],
      ['Kit terre', 1, 'pcs', 25000],
      ['Câble terre 1x6mm²', 50, 'pcs', 700],
      ['Coffret AC', 1, 'pcs', 25000],
      ['Câble TH AC 1x6mm²', 12, 'pcs', 1000],
      ["Main d'œuvre", 1, 'pcs', 100000],
    ]),
  },
  {
    id: 'kit-20kwh',
    name: 'Kit 20 kWh',
    battery: 20,
    panels: 12,
    panelW: 620,
    inverter: 6,
    lines: toLines([
      ['Batterie lithium 48V (20kwh) Taico', 1, 'pcs', 1500000],
      ['Panneaux photovoltaïque Jinko Double face 620Wc', 12, 'pcs', 75000],
      ['Onduleur hybride Deye 6kva', 1, 'pcs', 390000],
      ['Coffret de protection DC 2 entrée/sortie', 1, 'pcs', 65000],
      ['Dijoncteur compacte 125A', 1, 'pcs', 22000],
      ['Câble PV 1x6mm² Rouge/Noire', 100, 'm', 700],
      ['Câble batterie 1x35mm²', 2, 'm', 4000],
      ['Cosse batterie cuivre de 35mm²', 4, 'pcs', 1500],
      ['Moulure 40x40', 2, 'pcs', 5500],
      ['Kit terre', 1, 'pcs', 25000],
      ['Câble terre 1x16mm²', 25, 'pcs', 2000],
      ['Coffret AC', 1, 'pcs', 45000],
      ['Câble TH AC 1x6mm²', 12, 'pcs', 1000],
      ["Main d'œuvre", 1, 'pcs', 120000],
    ]),
  },
  {
    id: 'kit-32kwh',
    name: 'Kit 32 kWh (2 × 16)',
    battery: 32,
    batteryModules: [{ capacity: 16, qty: 2 }], // détail réel pour la fiche technique
    panels: 16,
    panelW: 620,
    inverter: 6,
    lines: toLines([
      ['Batterie lithium 48V (16kwh) Taico', 2, 'pcs', 1150000],
      ['Panneaux photovoltaïque Jinko Double face 620Wc', 16, 'pcs', 75000],
      ['Onduleur hybride Deye 6kva', 1, 'pcs', 390000],
      ['Coffret de protection DC 2 entrée/sortie', 1, 'pcs', 65000],
      ['Dijoncteur compacte 250A', 1, 'pcs', 26000],
      ['Câble PV 1x6mm² Rouge/Noire', 100, 'm', 700],
      ['Câble batterie 1x35mm²', 2, 'm', 4000],
      ['Cosse batterie cuivre de 35mm²', 4, 'pcs', 1500],
      ['Moulure 40x40', 2, 'pcs', 5500],
      ['Kit terre', 1, 'pcs', 25000],
      ['Câble terre 1x16mm²', 25, 'pcs', 2000],
      ['Coffret AC', 1, 'pcs', 45000],
      ['Câble TH AC 1x6mm²', 12, 'pcs', 1000],
      ["Main d'œuvre", 1, 'pcs', 150000],
    ]),
  },
];

// Kits officiels déjà dotés AVANT l'introduction du registre `kitsDotes`
// (context/dataState.js). Sert une seule fois, à la migration : sans cette
// liste figée, un kit que le gérant avait supprimé serait pris pour un kit
// jamais doté et ressusciterait. Liste historique — ne jamais l'étendre.
export const KITS_DOTES_AVANT_REGISTRE = [
  'kit-2.5kwh-eco',
  'kit-2.5kwh-premium',
  'kit-5kwh',
  'kit-20kwh',
  'kit-32kwh',
];
