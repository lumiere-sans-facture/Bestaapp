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

import { TVA_RATE } from '../config/company';

// Extrait le prix du panneau depuis le catalogue produits (catégorie 'panneaux').
// Retourne le prix du premier panneau trouvé, ou PANEL_SPEC.price par défaut.
const panelPriceFromCatalog = (products = []) => {
  const p = products.find((pr) => pr.category === 'panneaux');
  return p ? p.basePrice : PANEL_SPEC.price;
};

// Extrait le prix d'un onduleur depuis le catalogue par capacité (kVA).
// Recherche la capacité (ex. "5kva") dans le nom du produit, prend le plus proche.
const inverterPriceFromCatalog = (products = [], capacityKva) => {
  const inverters = products.filter((p) => p.category === 'onduleurs');
  if (!inverters.length) return null;
  // Extraire capacité numérique du nom (ex. "6kva" → 6)
  const withCap = inverters.map((p) => {
    const m = p.name.match(/(\d+(?:\.\d+)?)\s*kva/i);
    return m ? { ...p, cap: parseFloat(m[1]) } : null;
  }).filter(Boolean);
  if (!withCap.length) return null;
  withCap.sort((a, b) => a.cap - b.cap);
  const match = withCap.find((p) => p.cap >= capacityKva) || withCap[withCap.length - 1];
  return match.basePrice;
};

// Extrait le prix d'une batterie depuis le catalogue par capacité (kWh).
// Retourne le prix unitaire de la batterie la plus proche en capacité.
const batteryPriceFromCatalog = (products = [], capacityKwh) => {
  const bats = products.filter((p) => p.category === 'batteries');
  if (!bats.length) return null;
  const withCap = bats.map((p) => {
    const m = p.name.match(/(\d+(?:\.\d+)?)\s*kwh/i);
    return m ? { ...p, cap: parseFloat(m[1]) } : null;
  }).filter(Boolean);
  if (!withCap.length) return null;
  withCap.sort((a, b) => Math.abs(a.cap - capacityKwh) - Math.abs(b.cap - capacityKwh));
  return withCap[0].basePrice;
};

/**
 * Construit la liste des composants chiffrés et les totaux à partir d'un dimensionnement.
 * Format aligné sur le devis officiel BestaSolar : équipements + prestations,
 * sous-total HT, TVA 18 %, total TTC.
 *
 * @param {object} sizing  Résultat de calculateSystemSize()
 * @param {object} options
 * @param {Array}  options.products         Catalogue produits pour les prix réels
 * @param {boolean} options.incluireMaintenance  Inclure la ligne maintenance (défaut true)
 */
export const buildQuotation = (sizing, { products = [], includeMaintenance = true } = {}) => {
  const panelUnitPrice = panelPriceFromCatalog(products) || PANEL_SPEC.price;
  const inverterUnitPrice = inverterPriceFromCatalog(products, sizing.inverter.capacity) || sizing.inverter.price;

  const components = [
    {
      type: 'panneau',
      name: `${PANEL_SPEC.brand} ${PANEL_SPEC.model} ${PANEL_SPEC.power}W ${PANEL_SPEC.type}`,
      quantity: sizing.numberOfPanels,
      unitPrice: panelUnitPrice,
      totalPrice: sizing.numberOfPanels * panelUnitPrice,
    },
    {
      type: 'onduleur',
      name: `Onduleur ${sizing.inverter.brand} ${sizing.inverter.model} (${sizing.inverter.capacity} kVA)`,
      description: 'Onduleur hybride pur sinus',
      quantity: 1,
      unitPrice: inverterUnitPrice,
      totalPrice: inverterUnitPrice,
    },
    ...sizing.batteries.map((b) => {
      const unitPrice = batteryPriceFromCatalog(products, b.capacity) || b.price;
      return {
        type: 'batterie',
        name: `Batterie ${b.brand} ${b.model} (${b.capacity} kWh)`,
        description: 'Batterie lithium grande capacité',
        quantity: b.quantity,
        unitPrice,
        totalPrice: unitPrice * b.quantity,
      };
    }),
  ];

  // Accessoires standards
  const mountingKits = sizing.numberOfPanels / 10;
  const accessories = [
    { type: 'accessoire', name: 'Structure de Montage', quantity: mountingKits, unitPrice: 120000, totalPrice: Math.round(mountingKits * 120000) },
    { type: 'accessoire', name: 'Kit de Câblage Solaire', quantity: 1, unitPrice: 45000, totalPrice: 45000 },
    { type: 'accessoire', name: 'Coffret de Protection DC/AC', quantity: 1, unitPrice: 85000, totalPrice: 85000 },
  ];

  const equipment = [...components, ...accessories];
  const installationCost = sizing.numberOfPanels * INSTALLATION_COST_PER_PANEL;
  const prestations = [
    {
      type: 'prestation',
      name: "Main d'oeuvre et installation",
      description: 'Pose et mise en service par techniciens agréés',
      quantity: 1,
      unitPrice: installationCost,
      totalPrice: installationCost,
    },
  ];
  if (includeMaintenance) {
    prestations.push({
      type: 'prestation',
      name: 'Maintenance annuelle',
      description: 'Service après-vente et assistance technique',
      quantity: 1,
      unitPrice: MAINTENANCE_COST,
      totalPrice: MAINTENANCE_COST,
    });
  }

  const equipmentCost = equipment.reduce((sum, c) => sum + c.totalPrice, 0);
  const subtotalHT = equipmentCost + prestations.reduce((sum, c) => sum + c.totalPrice, 0);
  const tva = Math.round(subtotalHT * TVA_RATE);
  const total = subtotalHT + tva;

  const annualSavings = sizing.estimatedProduction * ELECTRICITY_PRICE;
  const roi = annualSavings > 0 ? (total / annualSavings) * 12 : 0;

  return {
    components: equipment,
    prestations,
    equipmentCost,
    installationCost,
    maintenanceCost: includeMaintenance ? MAINTENANCE_COST : 0,
    subtotalHT,
    tva,
    total,
    roi,
  };
};
