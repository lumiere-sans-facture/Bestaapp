// Dimensionnement et chiffrage d'une installation solaire.
// Logique portée depuis l'application besta-solar (calculations + pricing).
// Toutes les valeurs monétaires sont en F CFA (XOF).
import { prixPublic } from './price';
import { resolveLignePrice } from './kits';

// ---- Catalogue matériel ----

// Panneau de référence du dimensionnement : c'est sur cette puissance crête
// qu'est exprimé le BESOIN (nombre de panneaux nécessaires, puissance
// installée, production estimée) — indépendamment du kit qui sera proposé au
// devis. 620 Wc = format standard BestaSolar.
export const PANEL_REFERENCE_WC = 620;

export const PANEL_SPEC = {
  power: PANEL_REFERENCE_WC, // Watts crête — référence de dimensionnement
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

// Onduleur RECOMMANDÉ sur la fiche de dimensionnement (étude technique du
// besoin, indépendante du kit facturé) — pas la liste configurable « Plus ›
// Onduleurs » (data/inverters.js), qui sert elle à remplacer l'onduleur d'un
// kit dans le DEVIS. Gamme générique, non liée aux kits/marques réels.
// maxPower = puissance de sortie continue (W). Un hybride étiqueté « n kVA »
// délivre n kW (voir FACTEUR_PUISSANCE).
const SIZING_SHEET_INVERTERS = [
  { id: 'growatt-1k', brand: 'Growatt', model: 'SPF 1000TL', capacity: 1, maxPower: 1000, price: 180000, efficiency: 95 },
  { id: 'growatt-2k', brand: 'Growatt', model: 'SPF 2000TL', capacity: 2, maxPower: 2000, price: 280000, efficiency: 95 },
  { id: 'growatt-3k', brand: 'Growatt', model: 'SPF 3000TL', capacity: 3, maxPower: 3000, price: 380000, efficiency: 95 },
  { id: 'growatt-5k', brand: 'Growatt', model: 'SPF 5000TL', capacity: 5, maxPower: 5000, price: 580000, efficiency: 96 },
  { id: 'growatt-8k', brand: 'Growatt', model: 'SPF 8000TL', capacity: 8, maxPower: 8000, price: 980000, efficiency: 96 },
  { id: 'growatt-10k', brand: 'Growatt', model: 'SPF 10000TL', capacity: 10, maxPower: 10000, price: 1300000, efficiency: 96 },
];

// ---- Options matériel dérivées du catalogue boutique ----
// Les marques et prix proviennent des produits réels (catégories 'onduleurs'
// et 'batteries'), pas de listes codées en dur. Marque et capacité sont
// extraites du nom du produit ; le prix est le basePrice (prix partenaire).

const BRAND_KEYWORDS = ['Growatt', 'Felicity', 'Luxsun', 'Taico', 'Itel Energy', 'Itel', 'Marstek', 'Pylontech', 'Must Power', 'Must', 'Deye', 'Jinko'];
const parseNum = (s) => parseFloat(String(s).replace(',', '.'));

export const detectBrand = (name = '') => {
  const low = name.toLowerCase();
  return BRAND_KEYWORDS.find((b) => low.includes(b.toLowerCase())) || 'Autre';
};
export const parseKva = (name = '') => { const m = name.match(/(\d+(?:[.,]\d+)?)\s*kva/i); return m ? parseNum(m[1]) : null; };
export const parseKwh = (name = '') => { const m = name.match(/(\d+(?:[.,]\d+)?)\s*kwh/i); return m ? parseNum(m[1]) : null; };
/** Puissance crête d'un panneau depuis sa désignation : « … 580W » → 580. */
export const parsePanelWc = (name = '') => { const m = String(name).match(/(\d{3,4})\s*w(?:c|atts?)?\b/i); return m ? Number(m[1]) : null; };

/**
 * Onduleurs boutique → { id, brand, model, capacity (kVA), maxPower (W), price }.
 * price = prix PUBLIC (jamais le prix technicien sur un devis client).
 */
export const inverterOptionsFromCatalog = (products = []) =>
  products
    .filter((p) => p.category === 'onduleurs')
    .map((p) => {
      const capacity = parseKva(p.name);
      return capacity ? { id: p.id, brand: detectBrand(p.name), model: p.name, capacity, maxPower: Math.round(capacity * 1000 * FACTEUR_PUISSANCE), price: prixPublic(p.basePrice) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.capacity - b.capacity);

/**
 * Batteries boutique → { id, brand, model, capacity (kWh), price }.
 * price = prix PUBLIC (jamais le prix technicien sur un devis client).
 */
export const batteryOptionsFromCatalog = (products = []) =>
  products
    .filter((p) => p.category === 'batteries')
    .map((p) => {
      const capacity = parseKwh(p.name);
      return capacity ? { id: p.id, brand: detectBrand(p.name), model: p.name, capacity, price: prixPublic(p.basePrice) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.capacity - b.capacity);

/** Marques distinctes d'une liste d'options, dans l'ordre d'apparition. */
export const brandsOf = (options = []) => [...new Set(options.map((o) => o.brand))];

// ---- Choix de l'onduleur ----
// Deux critères, dans cet ordre :
//   1. le PIC DE CONSOMMATION — l'onduleur doit pouvoir alimenter toutes les
//      charges en même temps, marge de sécurité comprise. C'est le critère
//      principal : un onduleur qui ne tient pas le pic disjoncte, quelle que
//      soit la taille du champ PV ;
//   2. la PUISSANCE PV INSTALLÉE — elle doit rester sous la limite d'entrée PV
//      du modèle (« Max. PV Input Power », renseignée dans Plus › Onduleurs).

// Puissance apparente (kVA) → puissance active (W). Les onduleurs hybrides
// vendus sur le marché ouest-africain sont étiquetés en kVA mais délivrent
// autant de kW : un « 8 kVA » tient 8 000 W. Retenir 0,8 (le facteur de
// puissance théorique) faisait passer ces modèles pour sous-dimensionnés et
// poussait à commander un calibre au-dessus, inutilement.
// Un modèle qui ferait exception se renseigne par sa puissance de sortie
// réelle (maxPower) dans Plus › Onduleurs — elle prime toujours.
export const FACTEUR_PUISSANCE = 1;

/** Puissance de sortie continue (W) d'un onduleur, depuis ses kVA à défaut. */
export const puissanceSortie = (inv) => (Number(inv?.maxPower) > 0
  ? Number(inv.maxPower)
  : Math.round((Number(inv?.capacity) || 0) * 1000 * FACTEUR_PUISSANCE));

/**
 * Limite d'entrée PV (Wc) d'un onduleur. Celle du modèle si elle est connue,
 * sinon celle d'un onduleur CONFIGURÉ de même calibre (Plus › Onduleurs) —
 * c'est là que l'entreprise tient les vraies valeurs constructeur.
 * 0 = inconnue : aucune contrainte ne peut être vérifiée.
 */
export const limitePv = (inv, configures = []) => {
  if (Number(inv?.maxPvPower) > 0) return Number(inv.maxPvPower);
  const meme = configures.find((o) => Number(o.capacity) === Number(inv?.capacity) && Number(o.maxPvPower) > 0);
  return meme ? Number(meme.maxPvPower) : 0;
};

/**
 * Onduleur adapté : le plus petit modèle qui tient le pic de consommation ET
 * accepte la puissance PV installée. Si aucun ne convient, le plus grand
 * disponible (mieux vaut le moins insuffisant que rien).
 * @param {Array} options     modèles candidats
 * @param {number} peakLoad   pic de consommation (W). 0 = non déclaré (saisie
 *   directe) : la puissance PV sert alors de repère, faute de mieux.
 * @param {number} pvPower    puissance PV installée (Wc)
 * @param {Array} configures  onduleurs configurés, pour retrouver une limite PV
 */
/** Puissance de sortie que l'onduleur doit fournir (W) : pic × marge. */
export const sortieOnduleurRequise = (peakLoad = 0, pvPower = 0, margin = SIZING_PARAMS.inverterMargin) =>
  (peakLoad > 0 ? peakLoad : pvPower) * margin;

// Calibres du marché (kVA). Sert à annoncer le calibre NÉCESSAIRE même quand
// l'entreprise n'a encore configuré aucun onduleur de cette taille : une étude
// technique doit dire la vérité, pas se limiter au stock du moment.
export const CALIBRES_KVA = [1, 2, 3, 3.5, 5, 6, 8, 10, 12, 15, 20, 30];

/** Plus petit calibre commercial dont la sortie couvre `sortieW`. */
export const calibreRequis = (sortieW) => CALIBRES_KVA.find((k) => k * 1000 * FACTEUR_PUISSANCE >= sortieW)
  || Math.ceil(sortieW / (1000 * FACTEUR_PUISSANCE));

/** L'onduleur retenu tient-il vraiment le besoin (pic ET entrée PV) ? */
export const onduleurSuffisant = (inv, { peakLoad = 0, pvPower = 0, margin = SIZING_PARAMS.inverterMargin, configures = [] } = {}) => {
  if (!inv) return false;
  const pv = limitePv(inv, configures);
  return puissanceSortie(inv) >= sortieOnduleurRequise(peakLoad, pvPower, margin) && (!pv || pv >= pvPower);
};

export const suggestInverterFor = (options = [], { peakLoad = 0, pvPower = 0, margin = SIZING_PARAMS.inverterMargin, configures = [] } = {}) => {
  if (!options.length) return null;
  const besoinSortie = (peakLoad > 0 ? peakLoad : pvPower) * margin;
  const parTaille = [...options].sort((a, b) => puissanceSortie(a) - puissanceSortie(b));
  const tientLePic = (o) => puissanceSortie(o) >= besoinSortie;
  // Priorité aux modèles dont la limite PV est CONNUE et suffisante : un
  // modèle non renseigné ne doit pas passer devant un modèle vérifié.
  return parTaille.find((o) => tientLePic(o) && limitePv(o, configures) >= pvPower)
    || parTaille.find((o) => tientLePic(o) && !limitePv(o, configures))
    || parTaille[parTaille.length - 1];
};

/** Combinaison de batteries (glouton) approchant la capacité requise. */
export const suggestBatteryCombo = (options = [], requiredCapacity = 0) => {
  const combo = {};
  if (!options.length || requiredCapacity <= 0) return combo;
  const desc = [...options].sort((a, b) => b.capacity - a.capacity);
  const smallest = desc[desc.length - 1];
  let remaining = requiredCapacity;
  let guard = 0;
  while (remaining > smallest.capacity * 0.5 && guard++ < 100) {
    const fit = desc.find((o) => o.capacity <= remaining + smallest.capacity * 0.5) || smallest;
    combo[fit.id] = (combo[fit.id] || 0) + 1;
    remaining -= fit.capacity;
  }
  return combo;
};

// Type de support des panneaux (structure de montage rails galvanisé).
// Prix calculé au panneau, pas en forfait fixe — il dépend du terrain.
export const MOUNTING_TYPES = [
  { id: 'tole', label: 'Tôle', pricePerPanel: 10000 },
  { id: 'dalle', label: 'Dalle', pricePerPanel: 27000 },
  { id: 'sol', label: 'Au sol', pricePerPanel: 32000 },
];
export const DEFAULT_MOUNTING_TYPE = 'tole';
const MOUNTING_LINE_RE = /structure de montage/i;

export const SYSTEM_TYPES = [
  { id: 'off-grid', label: 'Autonome (off-grid)', help: 'Sans raccordement réseau, batteries pour toute la nuit' },
  { id: 'hybrid', label: 'Hybride', help: 'Réseau + batteries (80% des besoins nuit stockés)' },
  { id: 'on-grid', label: 'Raccordé réseau (on-grid)', help: 'Injection réseau, sans batterie' },
];

// Nombre de nuits sans soleil que le parc batterie doit couvrir. 1 nuit =
// hypothèse standard ; 1,5 et 2 nuits ajoutent une marge pour les journées
// nuageuses consécutives (le parc batterie grandit d'autant).
export const DEFAULT_AUTONOMY_NIGHTS = 1;
export const AUTONOMY_OPTIONS = [
  { value: 1, label: '1 nuit' },
  { value: 1.5, label: '1,5 nuit' },
  { value: 2, label: '2 nuits' },
];

export const INSTALLATION_COST_PER_PANEL = 10000;
export const MAINTENANCE_COST = 50000;
export const ELECTRICITY_PRICE = 100; // F CFA / kWh
// Repli (Togo) si données NASA/PVGIS indisponibles — heures de pic du PIRE
// MOIS (saison des pluies), pas la moyenne annuelle : le système doit tenir
// toute l'année, juillet-août compris. 4,3 h = pire mois mesuré (NASA) à
// Lomé, la zone la moins ensoleillée du pays — prudent partout ailleurs.
export const DEFAULT_PEAK_SUN_HOURS = 4.3;

// Hypothèses de dimensionnement — exportées pour être affichées telles quelles
// sur la fiche de dimensionnement (ne pas dupliquer ces valeurs ailleurs).
// Les batteries du catalogue sont toutes au lithium (LiFePO4, cellules
// prismatiques EVE, 6 000 cycles, « efficacité de charge 95-99 % » selon les
// fiches constructeur) : le rendement aller-retour est donc celui du lithium,
// 95 % — 85 % est une valeur de batteries PLOMB, à ne pas réintroduire.
// La profondeur de décharge reste volontairement fixée à 80 %, bien en deçà
// des ≥ 95 % annoncés : c'est une marge de sécurité maison qui préserve la
// durée de vie du parc.
export const SIZING_PARAMS = {
  panelEfficiency: 0.85,    // rendement des panneaux appliqué au calcul
  batteryEfficiency: 0.95,  // rendement charge/décharge aller-retour (LiFePO4)
  depthOfDischarge: 0.8,    // profondeur de décharge retenue (marge de sécurité)
  hybridBatteryRatio: 0.8,  // part de la consommation nocturne stockée en hybride
  inverterMargin: 1.2,      // marge de sécurité sur la puissance onduleur (+20 %)
};
// Tension du parc batterie (modules lithium 48 V du catalogue).
export const SYSTEM_VOLTAGE = BATTERY_MODELS[0].voltage;

// ---- Sélection des composants ----

// Gamme de repli quand l'entreprise n'a encore configuré aucun onduleur.
const findInverterForPower = (peakLoad, pvPower) =>
  suggestInverterFor(SIZING_SHEET_INVERTERS, { peakLoad, pvPower });

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
 * @param {number} panelWc  puissance crête du panneau de référence (défaut :
 *   PANEL_REFERENCE_WC). L'espace Pro passe la puissance du panneau réellement
 *   vendu, pour que le devis livre bien la puissance calculée.
 * @param {number} autonomyNights  nombre de nuits sans soleil couvertes par le
 *   parc batterie (défaut : DEFAULT_AUTONOMY_NIGHTS, soit 1 nuit).
 * @param {object} options
 * @param {number} options.peakLoad   pic de consommation (W) — critère
 *   PRINCIPAL du choix de l'onduleur : il doit tenir toutes les charges
 *   allumées ensemble. Absent (saisie directe) : repli sur la puissance PV.
 * @param {Array} options.inverters   modèles candidats. Sans eux, la gamme de
 *   repli sert.
 * @param {Array} options.configures  onduleurs configurés (Plus › Onduleurs) :
 *   leurs limites d'entrée PV font foi quand les candidats n'en portent pas.
 */
export const calculateSystemSize = (
  consumption,
  systemType,
  peakSunHours = DEFAULT_PEAK_SUN_HOURS,
  panelWc = PANEL_REFERENCE_WC,
  autonomyNights = DEFAULT_AUTONOMY_NIGHTS,
  { peakLoad = 0, inverters = [], configures = [] } = {},
) => {
  const { panelEfficiency, batteryEfficiency, depthOfDischarge, hybridBatteryRatio } = SIZING_PARAMS;
  const panelPower = Number(panelWc) > 0 ? Number(panelWc) : PANEL_REFERENCE_WC;
  const nights = Number(autonomyNights) > 0 ? Number(autonomyNights) : DEFAULT_AUTONOMY_NIGHTS;

  // Énergie nocturne à recharger : sur un système avec batterie, le parc doit
  // pouvoir être rechargé en une journée même après une nuit blanche — les
  // panneaux sont donc dimensionnés sur l'autonomie choisie (nuit × nombre de
  // nuits), pas seulement sur la conso d'une nuit. Sans batterie (on-grid),
  // l'autonomie n'a pas de sens : on garde la conso nocturne telle quelle.
  const nightlyEnergy = consumption.night * nights; // kWh — couvre l'autonomie choisie
  const nightEnergyForPanels = systemType === 'on-grid' ? consumption.night : nightlyEnergy;

  const totalDaily = consumption.day + nightEnergyForPanels; // kWh à produire / jour
  const requiredDailyEnergy = totalDaily / panelEfficiency; // kWh
  const requiredPanelPower = (requiredDailyEnergy / peakSunHours) * 1000; // W
  const numberOfPanels = Math.max(1, Math.ceil(requiredPanelPower / panelPower));

  // L'onduleur se choisit sur le PIC de consommation et sur la puissance PV
  // RÉELLEMENT installée (panneaux entiers), pas sur la puissance calculée.
  const installedPvPower = numberOfPanels * panelPower;
  const critereOnduleur = { peakLoad, pvPower: installedPvPower, configures };
  const selectedInverter = inverters.length
    ? suggestInverterFor(inverters, critereOnduleur)
    : findInverterForPower(peakLoad, installedPvPower);
  // Aucun modèle disponible ne tient forcément le besoin : le repli renvoie le
  // plus grand de la liste. Le dire explicitement — un onduleur sous-calibré
  // présenté comme « recommandé » se solde par des disjonctions chez le client.
  const inverterSortieRequise = sortieOnduleurRequise(peakLoad, installedPvPower);
  const inverterCalibreRequis = calibreRequis(inverterSortieRequise);
  const inverterSuffisant = onduleurSuffisant(selectedInverter, inverters.length ? critereOnduleur : { peakLoad, pvPower: installedPvPower });

  let batteryCapacity = 0;
  let batteries = [];
  if (systemType === 'off-grid') {
    batteryCapacity = nightlyEnergy / batteryEfficiency / depthOfDischarge;
    batteries = findOptimalBatteryCombination(batteryCapacity);
  } else if (systemType === 'hybrid') {
    batteryCapacity = (nightlyEnergy / batteryEfficiency / depthOfDischarge) * hybridBatteryRatio;
    batteries = findOptimalBatteryCombination(batteryCapacity);
  }

  return {
    numberOfPanels,
    panelWc: panelPower, // puissance crête du panneau de référence retenu
    requiredPanelPower, // W — utile pour filtrer les onduleurs par marque
    installedPvPower,   // W — puissance PV réellement posée (panneaux entiers)
    peakLoad,           // W — pic de consommation ayant servi au choix onduleur
    panelCapacity: (numberOfPanels * panelPower) / 1000, // kWc
    inverter: selectedInverter,
    inverterSortieRequise,   // W  — puissance de sortie exigée (pic × marge)
    inverterCalibreRequis,   // kVA — calibre du marché à retenir
    inverterSuffisant,       // false = aucun modèle disponible ne convient
    batteryCapacity,
    batteries: groupBatteries(batteries),
    estimatedProduction: (numberOfPanels * panelPower * peakSunHours * 365) / 1000, // kWh/an
    systemType,
    peakSunHours,
    autonomyNights: nights,
  };
};

// ---- Chiffrage (devis) ----

import { TVA_RATE } from '../config/company';

// Extrait le prix du panneau depuis le catalogue produits (catégorie 'panneaux').
// Retourne le prix PUBLIC du premier panneau trouvé (jamais le prix technicien
// sur un devis client), ou PANEL_SPEC.price par défaut si aucun produit.
const panelPriceFromCatalog = (products = []) => {
  const p = products.find((pr) => pr.category === 'panneaux');
  return p ? prixPublic(p.basePrice) : PANEL_SPEC.price;
};

// Extrait le prix PUBLIC d'un onduleur depuis le catalogue par capacité (kVA).
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
  return prixPublic(match.basePrice);
};

// Extrait le prix PUBLIC d'une batterie depuis le catalogue par capacité (kWh).
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
  return prixPublic(withCap[0].basePrice);
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

/**
 * Kit suggéré parmi une liste : le plus petit dont la batterie COUVRE le
 * besoin calculé (jamais moins — un client sous-équipé se retrouve à sec).
 * Ex. besoin 11 kWh → kit 12 ou 15 kWh, jamais un kit 10 kWh même plus proche
 * en valeur absolue. Si aucun kit n'atteint le besoin, repli sur le plus
 * proche disponible (mieux vaut le plus proche que rien).
 * @param {Array} kits  liste de kits ({ id, battery, ... })
 * @param {number} batteryNeed  capacité batterie requise (kWh)
 * @returns {object|null}  le kit suggéré, ou null si la liste est vide
 */
export const suggestKitForBattery = (kits = [], batteryNeed = 0) => {
  if (!kits.length) return null;
  const need = Number(batteryNeed) || 0;
  const suffisants = kits.filter((k) => k.battery >= need);
  const pool = suffisants.length ? suffisants : kits;
  return [...pool].sort((a, b) => Math.abs(a.battery - need) - Math.abs(b.battery - need))[0];
};

const PANEL_LINE_RE = /panneau/i;
const ONDULEUR_LINE_RE = /onduleur/i;

/**
 * Devis à partir d'un kit préconfiguré : toutes les lignes du kit, sans calcul
 * de composition. « Main d'œuvre » → prestation, le reste → équipements.
 * Prix tout compris (sans TVA) : HT = TTC, comme les devis kit de référence.
 * Format aligné sur buildQuotation pour réutiliser l'affichage et le PDF.
 *
 * La ligne « Structure de montage » du kit est recalculée sur le type de
 * support choisi (tôle / dalle / au sol) × le nombre de panneaux réellement
 * posés — son prix fixe dans data/kits.js n'est qu'un repli si le kit n'en a pas.
 * @param {boolean} includeMounting  si false, la ligne « Structure de
 *   montage » est retirée du devis (client qui a déjà son support, ou pose
 *   sans structure) plutôt que recalculée.
 * @param {object|null} sizing  résultat de calculateSystemSize() du besoin
 *   client. Si le kit suggéré (choisi sur sa batterie) a moins de panneaux
 *   que ce que le besoin exige à SA puissance crête, la quantité de panneaux
 *   du devis est complétée automatiquement (jamais réduite en dessous du
 *   nombre de panneaux du kit).
 * @param {Array} inverters  liste d'onduleurs configurés (Plus › Onduleurs).
 *   Si l'onduleur du kit (sa capacité kVA, cherchée dans cette liste) n'a pas
 *   une puissance PV max suffisante pour le besoin, la ligne « Onduleur » est
 *   remplacée par le plus petit onduleur configuré qui convient — jamais un
 *   plus faible. Sans correspondance dans la liste (capacité inconnue), la
 *   ligne du kit reste inchangée : impossible de vérifier sans donnée.
 * @param {Array} products  catalogue boutique. Une ligne de kit LIÉE à un
 *   produit (productId, réglé depuis « Mes kits ») suit son prix public
 *   ACTUEL plutôt que le prix figé à la composition du kit — modifier le prix
 *   en Boutique se répercute alors automatiquement, ici et sur les devis.
 */
export const buildKitQuotation = (kit, mountingType = DEFAULT_MOUNTING_TYPE, includeMounting = true, sizing = null, inverters = [], products = []) => {
  const mounting = MOUNTING_TYPES.find((m) => m.id === mountingType) || MOUNTING_TYPES[0];
  // Nombre de panneaux réellement nécessaires, à la puissance crête DU KIT —
  // le kit est choisi sur sa batterie, pas sur son nombre de panneaux, donc
  // il peut en manquer pour couvrir le besoin réel (ex. besoin 16 panneaux,
  // kit à batterie suffisante mais composé pour 12).
  const neededPanels = sizing?.requiredPanelPower && kit.panelW
    ? Math.max(kit.panels, Math.ceil(sizing.requiredPanelPower / kit.panelW))
    : kit.panels;
  const withPanels = kit.lines.map((l) => (
    PANEL_LINE_RE.test(l.designation) && neededPanels > l.qty ? { ...l, qty: neededPanels } : l
  ));

  // Onduleur : celui du kit ne convient peut-être pas — soit il ne tient pas
  // le pic de consommation du client, soit il n'accepte pas les panneaux
  // désormais complétés. On ne peut le vérifier que si sa capacité kVA
  // correspond à un onduleur configuré (donc aux caractéristiques connues).
  const currentSpec = inverters.find((o) => o.capacity === kit.inverter);
  const pvPose = sizing?.installedPvPower || (neededPanels * (kit.panelW || 0));
  const critere = { peakLoad: sizing?.peakLoad || 0, pvPower: pvPose, configures: inverters };
  const insuffisant = currentSpec && (
    puissanceSortie(currentSpec) < (critere.peakLoad > 0 ? critere.peakLoad : pvPose) * SIZING_PARAMS.inverterMargin
    || (limitePv(currentSpec, inverters) > 0 && limitePv(currentSpec, inverters) < pvPose)
  );
  const remplacant = insuffisant ? suggestInverterFor(inverters, critere) : null;
  const inverterSuggested = remplacant && remplacant.capacity !== kit.inverter ? remplacant : null;
  // productId retiré sur les lignes remplacées : elles ne représentent plus
  // le produit boutique éventuellement lié, `pu` (fixé ci-dessous) prime.
  const withInverter = inverterSuggested
    ? withPanels.map((l) => (
        ONDULEUR_LINE_RE.test(l.designation)
          ? { ...l, productId: null, designation: `Onduleur hybride ${inverterSuggested.capacity}kVA ${inverterSuggested.brand} ${inverterSuggested.model}`, qty: 1, unit: 'pcs', pu: inverterSuggested.price }
          : l
      ))
    : withPanels;

  // Structure de montage : la ligne est TOUJOURS présente quand le support est
  // inclus, qu'elle figure ou non dans la composition du kit. Certains kits
  // n'en portent pas (kits 20 et 32 kWh du catalogue) : se contenter de
  // recalculer une ligne existante rendait alors le choix « tôle / dalle / au
  // sol » sans effet, et le devis sortait sans structure.
  const ligneSupport = {
    designation: `Structure de montage PV rails galvanisé (${mounting.label})`,
    qty: neededPanels,
    unit: 'pcs',
    pu: mounting.pricePerPanel,
    productId: null,
  };
  const aUnSupport = withInverter.some((l) => MOUNTING_LINE_RE.test(l.designation));
  let lines;
  if (!includeMounting) {
    lines = withInverter.filter((l) => !MOUNTING_LINE_RE.test(l.designation));
  } else if (aUnSupport) {
    // productId retiré : la ligne ne représente plus le produit boutique lié.
    lines = withInverter.map((l) => (MOUNTING_LINE_RE.test(l.designation) ? { ...l, ...ligneSupport } : l));
  } else {
    // Insérée juste avant la main d'œuvre, à sa place naturelle dans le devis.
    const iMainDoeuvre = withInverter.findIndex((l) => l.labor);
    const place = iMainDoeuvre === -1 ? withInverter.length : iMainDoeuvre;
    lines = [...withInverter.slice(0, place), ligneSupport, ...withInverter.slice(place)];
  }
  // Prix résolu ligne par ligne : celui du produit boutique lié s'il existe
  // encore (suit ses changements de prix), sinon le prix figé de la ligne.
  const toItem = (l, type) => {
    const unitPrice = resolveLignePrice(l, products);
    return { type, name: l.designation, quantity: l.qty, unit: l.unit, unitPrice, totalPrice: l.qty * unitPrice };
  };
  const components = lines.filter((l) => !l.labor).map((l) => toItem(l, 'kit'));
  const prestations = lines.filter((l) => l.labor).map((l) => toItem(l, 'prestation'));
  const total = lines.reduce((s, l) => s + l.qty * resolveLignePrice(l, products), 0);
  return {
    components, prestations,
    equipmentCost: components.reduce((s, c) => s + c.totalPrice, 0),
    installationCost: prestations.reduce((s, c) => s + c.totalPrice, 0),
    maintenanceCost: 0,
    subtotalHT: total,
    tva: 0,
    mountingType: mounting.id,
    panelsIncluded: neededPanels,
    inverterSuggested: inverterSuggested
      ? { id: inverterSuggested.id, brand: inverterSuggested.brand, model: inverterSuggested.model, capacity: inverterSuggested.capacity }
      : null,
    total,
    roi: 0,
    kitId: kit.id,
    kitName: kit.name,
  };
};
