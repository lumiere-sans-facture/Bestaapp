// Caractéristiques électriques du matériel — squelette de specs et extraction
// depuis les désignations du catalogue, pour alimenter le moteur v2.
//
// Principe : ne JAMAIS inventer une valeur de fiche constructeur. Seules les
// grandeurs réellement présentes dans la désignation du produit sont extraites
// (« 620W » → puissanceWc, « 6 kVA » → puissanceW, « 5kwh » → capaciteKwh).
// Tout le reste (Voc, Vmp, Isc, Imp, tension DC max, plage MPPT, courants,
// surge, entrée PV max) reste à null : à saisir depuis les fiches
// constructeur. Le moteur signale une alerte « info » quand ces champs
// manquent, et n'effectue simplement pas les vérifications concernées.
//
// ⚠️ Onduleurs hybrides (Deye, Growatt, Felicity…) : facteur de puissance 1,
// donc puissanceW = kVA × 1000. La convention « 6 kVA = 4800 W » (FP 0,8) est
// une erreur et ne doit jamais être réintroduite ici.

import { parseKva, parseKwh } from './solarSizing';

/** Coefficients de température usuels (%/°C) — normatifs, non spécifiques au modèle. */
export const COEFF_TEMPERATURE_DEFAUT = { coeffVoc: -0.27, coeffVmp: -0.35 };

/** Valeurs normatives LiFePO4 — surchargeables par référence. */
export const BATTERIE_DEFAUTS = { dod: 0.80, rendement: 0.95, cRateChargeMax: 0.5 };

const SQUELETTES = {
  panneaux: () => ({
    puissanceWc: null, voc: null, vmp: null, isc: null, imp: null,
    ...COEFF_TEMPERATURE_DEFAUT,
  }),
  onduleurs: () => ({
    puissanceW: null, surgeW: null, pvMaxWc: null,
    vDcMax: null, vMpptMin: null, iMppt: null, iChargeMax: null, tensionBatterie: null,
  }),
  batteries: () => ({
    capaciteKwh: null, capaciteAh: null, tension: null, ...BATTERIE_DEFAUTS,
  }),
};

/** Squelette de specs d'une catégorie (null = à renseigner), ou null si hors périmètre. */
export const specsSkeleton = (category) => (SQUELETTES[category] ? SQUELETTES[category]() : null);

/** Puissance crête d'un panneau depuis sa désignation : « … 620W » → 620. */
export const parseWc = (name = '') => {
  const m = String(name).match(/(\d{3,4})\s*w(?:c|atts?)?\b/i);
  return m ? Number(m[1]) : null;
};

/**
 * Specs extraites de la désignation d'un produit, sans rien inventer.
 * @param {{name?:string, category?:string}} produit
 * @returns {object|null} specs partielles (clés absentes = inconnues)
 */
export function specsDepuisDesignation(produit = {}) {
  const nom = produit.name || '';
  switch (produit.category) {
    case 'panneaux': {
      const wc = parseWc(nom);
      return wc ? { puissanceWc: wc } : {};
    }
    case 'onduleurs': {
      const kva = parseKva(nom);
      // FP = 1 : kVA × 1000 (jamais × 800).
      return kva ? { puissanceW: Math.round(kva * 1000) } : {};
    }
    case 'batteries': {
      const kwh = parseKwh(nom);
      return kwh ? { capaciteKwh: kwh } : {};
    }
    default:
      return {};
  }
}

/**
 * Complète un produit avec ses specs : squelette + valeurs déductibles de la
 * désignation, sans écraser ce qui est déjà renseigné (saisie manuelle
 * prioritaire). Non destructif : retourne le produit inchangé hors périmètre.
 */
export function withSpecs(produit = {}) {
  const squelette = specsSkeleton(produit.category);
  if (!squelette) return produit;
  const deduites = specsDepuisDesignation(produit);
  const existantes = produit.specs || {};
  const specs = { ...squelette, ...deduites };
  // La saisie manuelle (valeur non nulle déjà présente) prime toujours.
  Object.entries(existantes).forEach(([cle, valeur]) => {
    if (valeur !== null && valeur !== undefined && valeur !== '') specs[cle] = valeur;
  });
  return { ...produit, specs };
}

/** Applique withSpecs à tout un catalogue. */
export const withSpecsAll = (produits = []) => produits.map(withSpecs);

/** Champs de specs encore à renseigner pour un produit (pour l'écran d'inventaire). */
export const specsManquantes = (produit = {}) =>
  Object.entries(produit.specs || {})
    .filter(([, v]) => v === null || v === undefined || v === '')
    .map(([k]) => k);

// ---------------------------------------------------------------------------
// Adaptateurs vers le moteur v2
// ---------------------------------------------------------------------------

/** Panneau du catalogue → entrée `materiel.panneau` du moteur. */
export const panneauPourMoteur = (produit) => {
  const s = withSpecs(produit || {}).specs || {};
  return {
    id: produit?.id, nom: produit?.name,
    puissanceWc: s.puissanceWc, voc: s.voc, vmp: s.vmp, isc: s.isc, imp: s.imp,
    coeffVoc: s.coeffVoc, coeffVmp: s.coeffVmp,
  };
};

/** Onduleur du catalogue → entrée `materiel.catalogueOnduleurs[]` du moteur. */
export const onduleurPourMoteur = (produit) => {
  const s = withSpecs(produit || {}).specs || {};
  const kva = s.puissanceW ? s.puissanceW / 1000 : parseKva(produit?.name || '');
  return {
    id: produit?.id, nom: produit?.name, kva,
    puissanceW: s.puissanceW ?? (kva ? Math.round(kva * 1000) : 0),
    surgeW: s.surgeW, pvMaxWc: s.pvMaxWc, vDcMax: s.vDcMax,
    vMpptMin: s.vMpptMin, iMppt: s.iMppt, iChargeMax: s.iChargeMax,
    tensionBatterie: s.tensionBatterie,
  };
};

/** Batterie du catalogue → entrée `materiel.batterie` du moteur. */
export const batteriePourMoteur = (produit) => {
  const s = withSpecs(produit || {}).specs || {};
  return {
    id: produit?.id, nom: produit?.name,
    capaciteKwh: s.capaciteKwh, capaciteAh: s.capaciteAh, tension: s.tension,
    dod: s.dod, rendement: s.rendement, cRateChargeMax: s.cRateChargeMax,
  };
};
