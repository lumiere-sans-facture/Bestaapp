// Kits de pompage solaire proposés par l'assistant « Pompe solaire ».
// Chaque kit est complet : pompe immergée + panneaux + contrôleur MPPT.
// maxHmt = hauteur manométrique totale maximale (m) ; maxDebit = débit
// nominal (m³/h). Prix publics en F CFA — valeurs indicatives, à ajuster
// selon vos fournisseurs.
export const POMPE_KITS = [
  {
    id: 'pk-05hp',
    name: 'Kit pompage 0,5 HP (370 W)',
    hp: 0.5, powerW: 370,
    maxHmt: 40, maxDebit: 1.8,
    panels: 2, panelW: 400,
    price: 450000,
    usage: 'Puits peu profond, arrosage de jardin, petit élevage',
  },
  {
    id: 'pk-1hp',
    name: 'Kit pompage 1 HP (750 W)',
    hp: 1, powerW: 750,
    maxHmt: 60, maxDebit: 3,
    panels: 3, panelW: 550,
    price: 780000,
    usage: 'Forage domestique, château d’eau familial',
  },
  {
    id: 'pk-15hp',
    name: 'Kit pompage 1,5 HP (1 100 W)',
    hp: 1.5, powerW: 1100,
    maxHmt: 80, maxDebit: 4.5,
    panels: 4, panelW: 550,
    price: 1150000,
    usage: 'Maraîchage, petite exploitation agricole',
  },
  {
    id: 'pk-2hp',
    name: 'Kit pompage 2 HP (1 500 W)',
    hp: 2, powerW: 1500,
    maxHmt: 100, maxDebit: 6,
    panels: 6, panelW: 550,
    price: 1650000,
    usage: 'Forage profond, irrigation, adduction villageoise',
  },
  {
    id: 'pk-3hp',
    name: 'Kit pompage 3 HP (2 200 W)',
    hp: 3, powerW: 2200,
    maxHmt: 120, maxDebit: 8,
    panels: 8, panelW: 550,
    price: 2400000,
    usage: 'Grande irrigation, bétail, mini-réseau d’eau',
  },
];
