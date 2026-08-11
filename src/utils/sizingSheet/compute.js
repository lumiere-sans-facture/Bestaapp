// Fiche de dimensionnement — CALCULS : dimensionnement (formules importées de
// solarSizing, jamais dupliquées), production mensuelle et rentabilité.
// Logique pure, sans React ni DOM.
import { SIZING_PARAMS, SYSTEM_VOLTAGE } from '../solarSizing';

export const JOURS_MOIS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MOIS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

// PRODUCTION = puissance installée × rendement des panneaux × heures
// d'ensoleillement. Rien d'autre : ni « productible théorique », ni « ratio de
// performance », ni « pertes système » en plus. Le rendement des panneaux est
// celui qui a servi à dimensionner (SIZING_PARAMS.panelEfficiency) — c'est la
// même grandeur, elle ne peut pas prendre deux valeurs dans un même document.
// Conséquence utile : un système taillé par le moteur couvre par CONSTRUCTION
// le besoin au pire mois — kWc × 0,85 × HSP ≥ consommation, par définition.

// Profil d'ensoleillement mensuel (h de pic/jour) par ville — seule la FORME
// compte (creux de saison des pluies) : le profil est ensuite CALÉ pour que
// son mois le plus faible retombe exactement sur le HSP retenu du dossier,
// qui est celui du PIRE MOIS. Caler la moyenne dessus (ancienne règle)
// comptait la pénalité deux fois : le graphique montrait des déficits sur un
// système pourtant dimensionné pour couvrir le pire mois. Forme côtière
// Lomé d'après la climatologie NASA (creux juillet-août ≈ −12 % vs moyenne).
const PROFIL_COTIER = [5.10, 5.28, 5.19, 4.99, 4.69, 4.42, 4.30, 4.32, 4.42, 4.69, 4.99, 4.99];
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

/** Cale le profil pour que son MOIS LE PLUS FAIBLE égale le HSP retenu
 *  (= pire mois du dimensionnement). Les autres mois sont au-dessus. */
export const calerProfilSurPireMois = (profil, hspPireMois) => {
  const pire = Math.min(...profil);
  if (!(pire > 0) || !(hspPireMois > 0)) return profil.slice();
  const k = hspPireMois / pire;
  return profil.map((v) => v * k);
};

/** Production d'une journée : puissance installée × rendement × heures de pic. */
export const productionJour = (kwc, hsp) => kwc * SIZING_PARAMS.panelEfficiency * hsp;

/**
 * Couverture mensuelle : production et consommation du client, mois par mois.
 * prod[m] = kWc × rendement × hsp[m] × jours[m] ; besoin[m] = consoJour × jours[m].
 * Le besoin comparé est la consommation RÉELLE, pas une fraction d'elle : la
 * fiche dimensionne déjà avec une marge, raboter le besoin en plus rendait le
 * graphique vert sans que le système couvre vraiment la consommation.
 */
export const couvertureMensuelle = ({ kwc, hspRetenu, ville, consoJour }) => {
  const profil = calerProfilSurPireMois(profilPourVille(ville), hspRetenu);
  const mois = profil.map((hsp, i) => {
    const prod = productionJour(kwc, hsp) * JOURS_MOIS[i];
    const besoin = consoJour * JOURS_MOIS[i];
    return { mois: MOIS_LABELS[i], prod, besoin, deficit: prod < besoin };
  });
  const production = mois.reduce((s, m) => s + m.prod, 0);
  const deficitCumule = mois.reduce((s, m) => s + Math.max(0, m.besoin - m.prod), 0);
  return { mois, production, deficitCumule };
};

/** Production annuelle : somme des 12 mois du profil calé sur le pire mois —
 *  exactement ce que le graphique totalise, barre par barre. */
export const productionAnnuelle = (kwc, hspPireMois, ville) =>
  Math.round(couvertureMensuelle({ kwc, hspRetenu: hspPireMois, ville, consoJour: 0 }).production);

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

// Durées de vie annoncées, de la plus longue à la plus courte : le lecteur
// voit d'un coup d'œil ce qui tient toute la vie de l'installation et ce qui
// sera remplacé. Le détail technique (nombre de cycles) reste en note.
export const DUREES_VIE = [
  { equipement: 'Panneaux photovoltaïques', duree: '25 ans' },
  { equipement: 'Structure et câblages', duree: '15 ans' },
  // Note calibrée pour tenir sur UNE ligne dans la colonne (160 px à 11 px).
  { equipement: 'Batteries lithium', duree: '15 ans', note: '6 000 cycles · 1 par jour' },
  { equipement: 'Onduleur', duree: '5 ans' },
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
  const couverture = couvertureMensuelle({
    kwc, hspRetenu: Number(d.sunHours) || 0, ville: d.cityName, consoJour,
  });
  // Parc batterie réellement installé (modules du catalogue) : il dépasse
  // toujours un peu le besoin calculé — c'est ce que le client reçoit.
  const batterieInstallee = (d.batteries || []).reduce((s, b) => s + b.capacity * b.qty, 0);
  return {
    consoJour, energieNecessaire, panelWc, kwc, autonomyNights,
    // La production annuelle EST la somme des barres du graphique, et la
    // production du pire mois est le chiffre qui se vérifie à la main.
    production: Math.round(couverture.production),
    productionPireMois: productionJour(kwc, Number(d.sunHours) || 0),
    batterieAh: d.sizing.batteryCapacity > 0 ? Math.round((d.sizing.batteryCapacity * 1000) / SYSTEM_VOLTAGE) : 0,
    batterieInstallee,
    batterieInstalleeAh: batterieInstallee > 0 ? Math.round((batterieInstallee * 1000) / SYSTEM_VOLTAGE) : 0,
    couverture, renta,
  };
};
