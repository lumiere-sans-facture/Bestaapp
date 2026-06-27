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
    id: 'kit-5kwh',
    name: 'Kit 5 kWh',
    battery: 5, // kWh — pour la suggestion automatique
    panels: 5,
    inverter: 5, // kVA
    lines: toLines([
      ['Batterie lithium Taico 48V 5kwh', 1, 'pcs', 515000],
      ['Panneaux photovoltaïque Jinko Double face 620Wc', 5, 'pcs', 75000],
      ['Onduleur hybride growatt 5kva', 1, 'pcs', 345000],
      ['Coffret de protection DC', 1, 'pcs', 45000],
      ['Dijoncteur compacte 100A', 1, 'pcs', 20000],
      ['Câble PV 1x6mm² Rouge/Noire', 50, 'm', 700],
      ['Kit terre', 1, 'pcs', 25000],
      ['Câble de terre 1x16mm²', 25, 'm', 2000],
      ['Moulure 40x40', 2, 'pcs', 5500],
      ['Câble batterie 1x25mm²', 2, 'm', 3000],
      ['Cosse batterie cuivre de 25mm²', 4, 'pcs', 1200],
      ['Coffret AC', 1, 'pcs', 25000],
      ['Câble AC 1x4mm²', 12, 'pcs', 600],
      ["Main d'œuvre", 1, 'h', 80000],
    ]),
  },
  {
    id: 'kit-16kwh',
    name: 'Kit 16 kWh',
    battery: 16,
    panels: 10,
    inverter: 6,
    lines: toLines([
      ['Batterie lithium Taico 48V 16kwh', 1, 'pcs', 1150000],
      ['Panneaux photovoltaïque Jinko Double face 620Wc', 10, 'pcs', 75000],
      ['Onduleur hybride growatt 6kva', 1, 'pcs', 385000],
      ['Coffret de protection DC 2 entrée/sortie', 1, 'pcs', 65000],
      ['Dijoncteur compacte 125A', 1, 'pcs', 22000],
      ['Câble PV 1x6mm² Rouge/Noire', 80, 'm', 700],
      ['Kit terre', 1, 'pcs', 25000],
      ['Câble de terre 1x16mm²', 25, 'm', 2000],
      ['Moulure 40x40', 2, 'pcs', 5500],
      ['Câble batterie 1x35mm²', 2, 'm', 4000],
      ['Cosse batterie cuivre de 25mm²', 4, 'pcs', 1200],
      ['Coffret AC', 1, 'pcs', 25000],
      ['Câble AC 1x4mm²', 12, 'pcs', 600],
      ["Main d'œuvre", 1, 'h', 110000],
    ]),
  },
];
