// Retour sur investissement solaire — une chaîne que le client suit du doigt :
//
//   1. les appareils qu'il fait tourner        → kWh par jour
//   2. ces kWh, il les paie déjà : au réseau,  → F CFA par an
//      et au groupe électrogène pendant les
//      coupures (du gazole pour les MÊMES kWh)
//   3. le kit dimensionné pour ces appareils   → prix de l'installation
//   4. le prix ÷ ce qu'il ne paie plus         → nombre d'années
//
// Chaque étape part du résultat de la précédente. Aucun taux abstrait, aucune
// « part couverte » à régler : c'est la consommation saisie qui commande tout,
// exactement comme l'assistant de devis de l'application.
//
// Logique pure, sans React — chaque maillon est testable séparément.

export const JOURS_PAR_AN = 365;
export const HEURES_PAR_JOUR = 24;

/** Durée de vie retenue pour la projection (garantie panneaux : 25 ans). */
export const DUREE_SYSTEME_ANS = 25;

/**
 * Ce qu'un groupe électrogène tire d'un litre de gazole, en kWh. Un groupe de
 * chantier rend ~3 kWh par litre à charge courante.
 *
 * C'est LE maillon qui rend la démonstration simple : plus besoin de demander
 * la consommation en litres/heure d'un groupe que personne ne connaît. Les
 * appareils donnent les kWh, les kWh donnent les litres, les litres donnent
 * les francs.
 */
export const KWH_PAR_LITRE_GAZOLE = 3;

/** Entretien annuel de l'installation (nettoyage, contrôle) — F CFA. */
export const MAINTENANCE_ANNUELLE = 15000;

/** Hausse du prix de l'énergie par an, réseau et carburant confondus. */
export const HAUSSE_TARIF_DEFAUT = 0.05;

/**
 * Perte de rendement des panneaux, par an. Les fiches constructeur garantissent
 * ~80 % de la puissance à 25 ans, soit environ 0,5 %/an. Sans elle, la
 * projection à 25 ans surestime le gain de plusieurs millions.
 */
export const DEGRADATION_ANNUELLE = 0.005;

/**
 * Émissions évitées : 2,68 kg de CO₂ par litre de gazole brûlé (facteur GIEC
 * pour le diesel), 0,45 kg par kWh du réseau togolais — ordres de grandeur,
 * à ne pas présenter comme une mesure.
 */
export const CO2_PAR_LITRE_GAZOLE = 2.68;
export const CO2_PAR_KWH_RESEAU = 0.45;

const nombre = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * ÉTAPE 1 — Les appareils du client en kWh par jour.
 *
 * Même calcul que l'assistant de devis solaire (`screens/devis/SolarWizard`) :
 * puissance × quantité × heures, séparé jour et nuit. Les deux écrans DOIVENT
 * donner le même nombre, sinon le commercial ne sait plus lequel croire.
 */
export const consommationAppareils = (appareils = []) => {
  const somme = (heures) => appareils.reduce(
    (t, a) => t + nombre(a?.power) * (nombre(a?.quantity) || 1) * nombre(a?.[heures]),
    0
  ) / 1000;
  const jour = somme('day');
  const nuit = somme('night');
  return {
    jour: Math.round(jour * 100) / 100,
    nuit: Math.round(nuit * 100) / 100,
    total: Math.round((jour + nuit) * 100) / 100,
    // Pic de charge : tout allumé en même temps. Sert au choix de l'onduleur.
    pic: appareils.reduce((t, a) => t + nombre(a?.power) * (nombre(a?.quantity) || 1), 0),
  };
};

/**
 * ÉTAPE 2 — Ce que ces kWh coûtent aujourd'hui, avant toute installation.
 *
 * Les heures de coupure décident du partage : pendant une coupure, ce sont les
 * mêmes appareils qui tournent, mais c'est le groupe qui les alimente — et
 * chaque kWh coûte alors un tiers de litre de gazole au lieu du tarif CEET.
 * C'est la comparaison qui frappe le client : le même kWh, deux prix.
 */
export const coutActuel = ({
  kwhJour = 0,
  heuresCoupureJour = 0,
  tarifKwh = 0,
  prixCarburant = 0,
  groupeActif = false,
} = {}) => {
  const kwh = nombre(kwhJour);
  const partGroupe = groupeActif
    ? Math.min(1, nombre(heuresCoupureJour) / HEURES_PAR_JOUR)
    : 0;
  const kwhGroupeAn = kwh * partGroupe * JOURS_PAR_AN;
  const kwhReseauAn = kwh * (1 - partGroupe) * JOURS_PAR_AN;
  const litresAn = kwhGroupeAn / KWH_PAR_LITRE_GAZOLE;
  const reseau = kwhReseauAn * nombre(tarifKwh);
  const groupe = litresAn * nombre(prixCarburant);
  return {
    kwhAn: Math.round(kwh * JOURS_PAR_AN),
    kwhReseauAn: Math.round(kwhReseauAn),
    kwhGroupeAn: Math.round(kwhGroupeAn),
    litresAn: Math.round(litresAn),
    reseau: Math.round(reseau),
    groupe: Math.round(groupe),
    total: Math.round(reseau + groupe),
    // Prix de revient du kWh dans chaque cas — le cœur de l'argumentaire.
    prixKwhReseau: Math.round(nombre(tarifKwh)),
    prixKwhGroupe: Math.round(nombre(prixCarburant) / KWH_PAR_LITRE_GAZOLE),
  };
};

/**
 * ÉTAPE 4 — Économie de l'année n (1 = première), entretien déduit.
 *
 * Le kit étant dimensionné POUR ces appareils, il les alimente : l'économie,
 * c'est donc tout ce que le client paie aujourd'hui pour les faire tourner.
 * L'énergie renchérit d'année en année, les panneaux perdent un peu de
 * rendement, et l'entretien suit l'inflation.
 */
export const economieAnnee = (annee, { coutAnnuel = 0, maintenance = MAINTENANCE_ANNUELLE, hausse = HAUSSE_TARIF_DEFAUT } = {}) => {
  const n = Math.max(1, Math.floor(Number(annee) || 1));
  const inflation = (1 + (Number(hausse) || 0)) ** (n - 1);
  const rendement = (1 - DEGRADATION_ANNUELLE) ** (n - 1);
  return Math.round(nombre(coutAnnuel) * inflation * rendement - nombre(maintenance) * inflation);
};

/** Projection année par année : économie, cumul, et reste à rembourser. */
export const projection = ({
  investissement = 0,
  coutAnnuel = 0,
  maintenance = MAINTENANCE_ANNUELLE,
  hausse = HAUSSE_TARIF_DEFAUT,
  duree = DUREE_SYSTEME_ANS,
} = {}) => {
  const invest = nombre(investissement);
  const annees = Math.max(1, Math.floor(Number(duree) || DUREE_SYSTEME_ANS));
  const lignes = [];
  let cumul = 0;
  for (let annee = 1; annee <= annees; annee += 1) {
    const economie = economieAnnee(annee, { coutAnnuel, maintenance, hausse });
    cumul += economie;
    // Jamais négatif : une fois remboursé, l'investissement est remboursé.
    lignes.push({ annee, economie, cumul, restant: Math.max(0, Math.round(invest - cumul)) });
  }
  return lignes;
};

/**
 * Année où l'installation est remboursée, fraction comprise (2,4 ans).
 * `null` quand elle ne l'est JAMAIS sur la durée retenue — cas réel d'une
 * petite consommation face à une grosse installation. Afficher « 0 an » ou
 * masquer le résultat serait un mensonge commercial : le simulateur doit
 * pouvoir dire qu'un projet ne se rembourse pas.
 */
export const retourInvestissement = (lignes = [], investissement = 0) => {
  const invest = nombre(investissement);
  if (invest <= 0) return null;
  let precedent = 0;
  for (const ligne of lignes) {
    if (ligne.cumul >= invest) {
      const fraction = ligne.economie > 0 ? (invest - precedent) / ligne.economie : 0;
      return Math.round((ligne.annee - 1 + fraction) * 10) / 10;
    }
    precedent = ligne.cumul;
  }
  return null;
};

/** CO₂ évité en un an : le gazole non brûlé et les kWh non tirés du réseau. */
export const co2EviteAn = ({ litresAn = 0, kwhReseauAn = 0 } = {}) =>
  Math.round(nombre(litresAn) * CO2_PAR_LITRE_GAZOLE + nombre(kwhReseauAn) * CO2_PAR_KWH_RESEAU);

/**
 * La chaîne complète, prête pour l'écran.
 *
 * @param {object}  e
 * @param {Array}   e.appareils          lignes { power, quantity, day, night }
 * @param {number}  e.investissement     prix de l'installation (kit ou devis)
 * @param {number}  e.heuresCoupureJour  coupures quotidiennes du réseau
 * @param {number}  e.tarifKwh           prix du kWh CEET
 * @param {number}  e.prixCarburant      prix du litre de gazole
 */
export const simulerRoi = ({
  appareils = [],
  investissement = 0,
  heuresCoupureJour = 0,
  tarifKwh = 0,
  prixCarburant = 0,
  groupeActif = false,
  maintenance = MAINTENANCE_ANNUELLE,
  hausse = HAUSSE_TARIF_DEFAUT,
  duree = DUREE_SYSTEME_ANS,
} = {}) => {
  const conso = consommationAppareils(appareils);
  const cout = coutActuel({
    kwhJour: conso.total, heuresCoupureJour, tarifKwh, prixCarburant, groupeActif,
  });
  const lignes = projection({ investissement, coutAnnuel: cout.total, maintenance, hausse, duree });
  const invest = nombre(investissement);
  const cumulFinal = lignes.length ? lignes[lignes.length - 1].cumul : 0;
  const gainDuree = Math.round(cumulFinal - invest);
  const co2AnKg = co2EviteAn(cout);

  return {
    conso,
    cout,
    maintenance: Math.round(nombre(maintenance)),
    economieAn1: lignes[0]?.economie ?? 0,
    retourAns: retourInvestissement(lignes, invest),
    gainDuree,
    // Sans montant d'installation, il n'y a rien à rentabiliser : `null`
    // plutôt qu'une division par zéro affichée au client.
    roiPct: invest > 0 ? Math.round((gainDuree / invest) * 100) : null,
    co2AnKg,
    co2DureeT: Math.round((co2AnKg * lignes.length) / 100) / 10,
    projection: lignes,
  };
};
