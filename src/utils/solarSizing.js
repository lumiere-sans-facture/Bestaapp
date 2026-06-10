// Dimensionnement et chiffrage d'une installation solaire.
// Logique portée depuis l'application besta-solar (calculations + pricing).
// Toutes les valeurs monétaires sont en F CFA (XOF).

// ---- Catalogue matériel ----

export const PANEL_SPEC = {
  power: 550, // Watts
  brand: 'Jinko Solar',
  model: 'Tiger Neo N-type',
  type: 'Bifacial',
  price: 95000,
};

export const BATTERY_MODELS = [
  { id: 'bat-2.5', capacity: 2.5, voltage: 48, price: 875000, brand: 'Pylontech', model: 'US2000B' },
  { id: 'bat-3.8', capacity: 3.8, voltage: 48, price: 1330000, brand: 'Pylontech', model: 'US3000C' },
  { id: 'bat-5.0', capacity: 5.0, voltage: 48, price: 1750000, brand: 'Pylontech', model: 'US5000' },
  { id: 'bat-7.5', capacity: 7.5, voltage: 48, price: 2625000, brand: 'Pylontech', model: 'UP5000' },
  { id: 'bat-10.0', capacity: 10.0, voltage: 48, price: 3500000, brand: 'Pylontech', model: 'Force L2' },
  { id: 'bat-12.5', capacity: 12.5, voltage: 48, price: 4375000, brand: 'Pylontech', model: 'Force L2+' },
  { id: 'bat-15.0', capacity: 15.0, voltage: 48, price: 5250000, brand: 'Pylontech', model: 'Force L3' },
];

export const INVERTER_MODELS = [
  { id: 'growatt-1k', brand: 'Growatt', model: 'SPF 1000TL', capacity: 1, maxPower: 800, price: 180000, efficiency: 95 },
  { id: 'growatt-2k', brand: 'Growatt', model: 'SPF 2000TL', capacity: 2, maxPower: 1600, price: 280000, efficiency: 95 },
  { id: 'growatt-3k', brand: 'Growatt', model: 'SPF 3000TL', capacity: 3, maxPower: 2400, price: 380000, efficiency: 95 },
  { id: 'growatt-5k', brand: 'Growatt', model: 'SPF 5000TL', capacity: 5, maxPower: 4000, price: 580000, efficiency: 96 },
  { id: 'growatt-8k', brand: 'Growatt', model: 'SPF 8000TL', capacity: 8, maxPower: 6400, price: 980000, efficiency: 96 },
  { id: 'growatt-10k', brand: 'Growatt', model: 'SPF 10000TL', capacity: 10, maxPower: 8000, price: 1300000, efficiency: 96 },
];

export const SYSTEM_TYPES = [
  { id: 'off-grid', label: 'Autonome (off-grid)', help: 'Sans raccordement réseau, batteries pour toute la nuit' },
  { id: 'hybrid', label: 'Hybride', help: 'Réseau + batteries (80% des besoins nuit stockés)' },
  { id: 'on-grid', label: 'Raccordé réseau (on-grid)', help: 'Injection réseau, sans batterie' },
];

export const INSTALLATION_COST_PER_PANEL = 10000;
export const MAINTENANCE_COST = 50000;
export const ELECTRICITY_PRICE = 100; // F CFA / kWh
export const DEFAULT_PEAK_SUN_HOURS = 5.5;

// ---- Sélection des composants ----

const findInverterForPower = (requiredPower) => {
  const powerWithMargin = requiredPower * 1.2;
  return INVERTER_MODELS.find((inv) => inv.maxPower >= powerWithMargin) || INVERTER_MODELS[INVERTER_MODELS.length - 1];
};

// Combinaison optimale de batteries (du plus grand au plus petit module)
const findOptimalBatteryCombination = (requiredCapacity) => {
  const batteries = [];
  let remaining = requiredCapacity;
  while (remaining > 0) {
    const battery = BATTERY_MODELS
      .filter((b) => b.capacity <= remaining)
      .sort((a, b) => b.capacity - a.capacity)[0];
    if (!battery) {
      batteries.push(BATTERY_MODELS[0]);
      break;
    }
    batteries.push(battery);
    remaining -= battery.capacity;
  }
  return batteries;
};

// Regroupe une liste de batteries identiques en { model, quantity }
const groupBatteries = (batteries) => {
  const map = new Map();
  batteries.forEach((b) => {
    const entry = map.get(b.id) || { ...b, quantity: 0 };
    entry.quantity += 1;
    map.set(b.id, entry);
  });
  return [...map.values()];
};

// ---- Dimensionnement ----

/**
 * @param {{ day:number, night:number }} consumption  consommation en kWh/jour
 * @param {'off-grid'|'hybrid'|'on-grid'} systemType
 * @param {number} peakSunHours
 */
export const calculateSystemSize = (consumption, systemType, peakSunHours = DEFAULT_PEAK_SUN_HOURS) => {
  const systemEfficiency = 0.75;
  const batteryEfficiency = 0.85;
  const depthOfDischarge = 0.8;
  const hybridBatteryRatio = 0.8;

  const totalDaily = consumption.day + consumption.night; // kWh
  const requiredDailyEnergy = totalDaily / systemEfficiency; // kWh
  const requiredPanelPower = (requiredDailyEnergy / peakSunHours) * 1000; // W
  const numberOfPanels = Math.max(1, Math.ceil(requiredPanelPower / PANEL_SPEC.power));

  const selectedInverter = findInverterForPower(requiredPanelPower);

  let batteryCapacity = 0;
  let batteries = [];
  if (systemType === 'off-grid') {
    batteryCapacity = consumption.night / batteryEfficiency / depthOfDischarge;
    batteries = findOptimalBatteryCombination(batteryCapacity);
  } else if (systemType === 'hybrid') {
    batteryCapacity = (consumption.night / batteryEfficiency / depthOfDischarge) * hybridBatteryRatio;
    batteries = findOptimalBatteryCombination(batteryCapacity);
  }

  return {
    numberOfPanels,
    panelCapacity: (numberOfPanels * PANEL_SPEC.power) / 1000, // kWc
    inverter: selectedInverter,
    batteryCapacity,
    batteries: groupBatteries(batteries),
    estimatedProduction: (numberOfPanels * PANEL_SPEC.power * peakSunHours * 365) / 1000, // kWh/an
    systemType,
    peakSunHours,
  };
};

// ---- Chiffrage (devis) ----

/**
 * Construit la liste des composants chiffrés et les totaux à partir d'un dimensionnement.
 * @returns {{ components, equipmentCost, installationCost, maintenanceCost, total, roi }}
 */
export const buildQuotation = (sizing) => {
  const components = [
    {
      type: 'panneau',
      name: `${PANEL_SPEC.brand} ${PANEL_SPEC.model} ${PANEL_SPEC.power}W`,
      quantity: sizing.numberOfPanels,
      unitPrice: PANEL_SPEC.price,
      totalPrice: sizing.numberOfPanels * PANEL_SPEC.price,
    },
    {
      type: 'onduleur',
      name: `Onduleur ${sizing.inverter.brand} ${sizing.inverter.model} (${sizing.inverter.capacity} kVA)`,
      quantity: 1,
      unitPrice: sizing.inverter.price,
      totalPrice: sizing.inverter.price,
    },
    ...sizing.batteries.map((b) => ({
      type: 'batterie',
      name: `Batterie ${b.brand} ${b.model} (${b.capacity} kWh)`,
      quantity: b.quantity,
      unitPrice: b.price,
      totalPrice: b.price * b.quantity,
    })),
  ];

  // Accessoires standards
  const mountingKits = sizing.numberOfPanels / 10; // 1 structure pour 10 panneaux
  const accessories = [
    { type: 'accessoire', name: 'Structure de Montage', quantity: mountingKits, unitPrice: 120000, totalPrice: Math.round(mountingKits * 120000) },
    { type: 'accessoire', name: 'Kit de Câblage Solaire', quantity: 1, unitPrice: 45000, totalPrice: 45000 },
    { type: 'accessoire', name: 'Coffret de Protection DC/AC', quantity: 1, unitPrice: 85000, totalPrice: 85000 },
  ];

  const allComponents = [...components, ...accessories];
  const equipmentCost = allComponents.reduce((sum, c) => sum + c.totalPrice, 0);
  const installationCost = sizing.numberOfPanels * INSTALLATION_COST_PER_PANEL;
  const total = equipmentCost + installationCost;

  // Retour sur investissement (en mois)
  const annualSavings = sizing.estimatedProduction * ELECTRICITY_PRICE;
  const roi = annualSavings > 0 ? (total / annualSavings) * 12 : 0;

  return {
    components: allComponents,
    equipmentCost,
    installationCost,
    maintenanceCost: MAINTENANCE_COST,
    total,
    roi,
  };
};
