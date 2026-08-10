// Fiche de dimensionnement — CALCULS : dimensionnement (formules importées de
// solarSizing, jamais dupliquées), productible mensuel et rentabilité.
// Logique pure, sans React ni DOM.
import { SIZING_PARAMS, SYSTEM_VOLTAGE } from '../solarSizing';

export const JOURS_MOIS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MOIS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

// Ratio de performance appliqué au productible théorique (salissures,
// température, câblage, conversion…) : le NET est la seule valeur annoncée.
// 0,75 = le ratio de performance PVGIS annoncé dans la source du graphique —
// et le pendant cohérent d'un dimensionnement à 85 % de rendement : le
// système couvre le besoin la plus grande partie de l'année, le creux de
// saison des pluies restant visible (et absorbé par le parc batterie).
export const RATIO_PRODUCTIBLE_NET = 0.75;

// Profil d'ensoleillement mensuel (h de pic/jour) par ville — la FORME du
// profil (creux de saison des pluies) compte plus que ses valeurs absolues :
// il est ensuite NORMALISÉ pour retomber exactement sur le HSP retenu du
// dossier. Profil côtier golfe de Guinée par défaut (Lomé).
const PROFIL_COTIER = [5.12, 5.29, 5.12, 4.94, 4.68, 4.25, 3.81, 3.65, 3.99, 4.60, 5.03, 5.03];
export const PROFILS_HSP = {
  'Lomé': PROFIL_COTIER,
  'Aného': PROFIL_COTIER,
  'Tsévié': PROFIL_COTIER,
  'Cotonou': PROFIL_COTIER,
};
export const profilPourVille = (ville) => PROFILS_HSP[ville] || PROFIL_COTIER;

/** Moyenne annuelle d'un profil, pondérée par les jours de chaque mois. */
export const moyennePonderee = (profil) =>
  profil.reduce((s, v, i) => s + v * JOURS_MOIS[i], 0) / 365;

/** Normalise le profil pour que sa moyenne pondérée retombe sur le HSP retenu. */
export const normaliserProfil = (profil, hspRetenu) => {
  const moyenne = moyennePonderee(profil);
  if (!(moyenne > 0) || !(hspRetenu > 0)) return profil.slice();
  const k = hspRetenu / moyenne;
  return profil.map((v) => v * k);
};

/**
 * Couverture mensuelle : productible net et besoin retenu, mois par mois.
 * prod[m] = kWc × ratio de performance × hsp[m] × jours[m] ;
 * besoin[m] = consoJour × taux × jours[m].
 */
export const couvertureMensuelle = ({ kwc, hspRetenu, ville, consoJour, tauxUtilisation }) => {
  const profil = normaliserProfil(profilPourVille(ville), hspRetenu);
  const mois = profil.map((hsp, i) => {
    const prod = kwc * RATIO_PRODUCTIBLE_NET * hsp * JOURS_MOIS[i];
    const besoin = consoJour * tauxUtilisation * JOURS_MOIS[i];
    return { mois: MOIS_LABELS[i], prod, besoin, deficit: prod < besoin };
  });
  const produitNet = mois.reduce((s, m) => s + m.prod, 0);
  const deficitCumule = mois.reduce((s, m) => s + Math.max(0, m.besoin - m.prod), 0);
  return { mois, produitNet, deficitCumule };
};

/** Productibles annuels : théorique (kWc × HSP × 365) et net (× ratio). */
export const productibles = (kwc, hspRetenu) => {
  const theorique = Math.round(kwc * hspRetenu * 365);
  return { theorique, net: Math.round(theorique * RATIO_PRODUCTIBLE_NET) };
};

// ---- Rentabilité ----
// Tous les paramètres sont surchargeables ; les montants affichés sont
// RECALCULÉS depuis les valeurs arrondies affichées (jamais des flottants),
// pour que le lecteur puisse refaire chaque calcul à la main.
export const RENTA_DEFAUTS = {
  tarifElec: 145,            // F CFA / kWh
  tauxUtilisation: 0.85,     // part de la production réellement consommée
  horizon: 10,               // ans
  maintenanceAnnuelle: 50000, // F CFA / an, À PARTIR de la 2e année
  provisionOnduleur: 320000, // F CFA — 1 remplacement (durée de vie 5 ans)
};

export const DUREES_VIE = [
  { equipement: 'Panneaux', duree: '25 ans' },
  { equipement: 'Onduleur', duree: '5 ans' },
  { equipement: 'Batteries lithium', duree: '10 ans (6 000 cycles)' },
  { equipement: 'Structure', duree: '25 ans' },
];

/**
 * Estimation de rentabilité sur l'horizon.
 * @param {number} consoJour       kWh/jour du dossier
 * @param {number|null} investissement  F CFA (devis) — null si inconnu
 * @param {object} surcharges      tarifElec, tauxUtilisation, horizon…
 */
export const calculerRentabilite = (consoJour, investissement, surcharges = {}) => {
  const p = { ...RENTA_DEFAUTS, ...surcharges };
  const inv = Number(investissement) > 0 ? Math.round(Number(investissement)) : null;
  // kWh couverts par an, arrondis AVANT le passage en francs.
  const kwhAnnuels = Math.round(consoJour * p.tauxUtilisation * 365);
  const economieAnnuelle = kwhAnnuels * p.tarifElec;
  const maintenanceTotale = p.maintenanceAnnuelle * (p.horizon - 1);
  const economiesCumulees = economieAnnuelle * p.horizon;
  const gainNet = inv != null
    ? economiesCumulees - inv - p.provisionOnduleur - maintenanceTotale
    : null;
  // Retour sur investissement : premier mois t où
  //   éco × t/12 − maintenance × max(0, t/12 − 1) ≥ investissement + provision.
  let roiMois = null;
  if (inv != null && economieAnnuelle > 0) {
    const cible = inv + p.provisionOnduleur;
    for (let t = 1; t <= p.horizon * 12; t += 1) {
      const annees = t / 12;
      if (economieAnnuelle * annees - p.maintenanceAnnuelle * Math.max(0, annees - 1) >= cible) {
        roiMois = t;
        break;
      }
    }
  }
  return {
    ...p, investissement: inv, kwhAnnuels, economieAnnuelle,
    maintenanceTotale, economiesCumulees, gainNet, roiMois,
  };
};

/** « 42 mois » → « 3 ans et 6 mois » (ou « 8 mois », « 3 ans »). */
export const libelleRoi = (mois) => {
  if (mois == null) return '—';
  const ans = Math.floor(mois / 12);
  const reste = mois % 12;
  if (!ans) return `${reste} mois`;
  if (!reste) return `${ans} an${ans > 1 ? 's' : ''}`;
  return `${ans} an${ans > 1 ? 's' : ''} et ${reste} mois`;
};

/** Tout le dossier calculé de la fiche, prêt pour la mise en page. */
export const computeSheet = (d) => {
  const conso = d.consumption;
  const consoJour = conso.day + conso.night;
  const { panelEfficiency } = SIZING_PARAMS;
  const autonomyNights = d.sizing.autonomyNights || 1;
  const nightEnergyForPanels = d.systemType === 'on-grid' ? conso.night : conso.night * autonomyNights;
  const energieNecessaire = (conso.day + nightEnergyForPanels) / panelEfficiency;
  const panelWc = Number((String(d.panelName || '').match(/(\d{3,4})\s*W/i) || [])[1]) || 550;
  const kwc = (d.sizing.numberOfPanels * panelWc) / 1000;
  const renta = calculerRentabilite(consoJour, d.investissement ?? null, d.rentabilite || {});
  const prods = productibles(kwc, Number(d.sunHours) || 0);
  const couverture = couvertureMensuelle({
    kwc, hspRetenu: Number(d.sunHours) || 0, ville: d.cityName,
    consoJour, tauxUtilisation: renta.tauxUtilisation,
  });
  return {
    consoJour, energieNecessaire, panelWc, kwc, autonomyNights,
    batterieAh: d.sizing.batteryCapacity > 0 ? Math.round((d.sizing.batteryCapacity * 1000) / SYSTEM_VOLTAGE) : 0,
    prods, couverture, renta,
  };
};
