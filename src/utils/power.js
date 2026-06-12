// Extraction de la puissance d'un produit depuis son nom (kVA, kW, kWh, W).
// Retourne une valeur en watts (ordre de grandeur) ou null si introuvable.
export const extractPowerWatts = (name = '') => {
  const m = name.match(/(\d+(?:[.,]\d+)?)\s*(kva|kwh|kw|wc|w)\b/i);
  if (!m) return null;
  const val = parseFloat(m[1].replace(',', '.'));
  const unit = m[2].toLowerCase();
  return unit === 'w' || unit === 'wc' ? val : val * 1000;
};

export const POWER_RANGES = [
  { id: 'all', label: 'Puissance : toutes' },
  { id: 'p1', label: '≤ 1 kW', min: 0, max: 1000 },
  { id: 'p2', label: '1 – 3 kW', min: 1000, max: 3000 },
  { id: 'p3', label: '3 – 6 kW', min: 3000, max: 6000 },
  { id: 'p4', label: '> 6 kW', min: 6000, max: Infinity },
];

export const PRICE_RANGES = [
  { id: 'all', label: 'Prix : tous' },
  { id: 'r1', label: '< 100 000 F', min: 0, max: 100000 },
  { id: 'r2', label: '100 000 – 500 000 F', min: 100000, max: 500000 },
  { id: 'r3', label: '500 000 – 1 000 000 F', min: 500000, max: 1000000 },
  { id: 'r4', label: '> 1 000 000 F', min: 1000000, max: Infinity },
];
