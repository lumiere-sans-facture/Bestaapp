// Simulateur de retour sur investissement solaire : ce que le client dépense
// AUJOURD'HUI en énergie, ce qu'il dépenserait avec l'installation, et en
// combien de temps celle-ci est remboursée.
//
// Logique pure, sans React : c'est un argumentaire commercial chiffré, il doit
// être testable ligne à ligne. Toutes les hypothèses sont des constantes
// nommées et exportées — elles s'affichent telles quelles à l'écran, parce
// qu'un chiffre de vente qu'on ne peut pas justifier devant le client ne vaut
// rien.

/** Jours facturés dans une année (moyenne). */
export const JOURS_PAR_AN = 365;
export const MOIS_PAR_AN = 12;

/** Durée de vie retenue pour la projection (garantie panneaux : 25 ans). */
export const DUREE_SYSTEME_ANS = 25;

/**
 * Part du besoin réellement couverte par le solaire. Jamais 100 % : le
 * dimensionnement de l'app se cale sur le PIRE mois, et il reste des jours
 * sans soleil et des pointes que la batterie ne tient pas. Annoncer 100 %
 * ferait un client déçu, ce qui coûte plus cher qu'une vente perdue.
 */
export const TAUX_COUVERTURE_DEFAUT = 0.8;

/**
 * Perte de rendement des panneaux, par an. Les fiches constructeur garantissent
 * ~80 % de la puissance à 25 ans, soit environ 0,5 %/an. Sans elle, la
 * projection à 25 ans surestime le gain de plusieurs millions.
 */
export const DEGRADATION_ANNUELLE = 0.005;

/** Entretien annuel de l'installation (nettoyage, contrôle) — F CFA. */
export const MAINTENANCE_ANNUELLE = 15000;

/** Hausse du prix de l'énergie par an, réseau et carburant confondus. */
export const HAUSSE_TARIF_DEFAUT = 0.05;

/**
 * Consommation d'un groupe électrogène, en litres par heure et par kVA, à
 * charge courante (~60 %). Repère de terrain : un 5 kVA consomme ~1,5 L/h.
 * Ce n'est qu'une valeur de départ — le prix du carburant et la consommation
 * réelle restent saisis par l'utilisateur.
 */
export const LITRES_PAR_KVA_HEURE = 0.3;

/** Consommation par défaut d'un groupe, en L/h, d'après sa puissance. */
export const consommationGroupe = (puissanceKva) =>
  Math.round(Math.max(0, Number(puissanceKva) || 0) * LITRES_PAR_KVA_HEURE * 10) / 10;

/**
 * Émissions évitées. Le gazole d'un groupe : 2,68 kg de CO₂ par litre brûlé
 * (facteur standard GIEC pour le diesel routier). Le réseau togolais (CEET),
 * alimenté par du thermique et des importations : 0,45 kg par kWh — ordre de
 * grandeur, à ne pas présenter comme une mesure.
 */
export const CO2_PAR_LITRE_GAZOLE = 2.68;
export const CO2_PAR_KWH_RESEAU = 0.45;

const nombre = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Coût énergétique annuel du client AVANT installation, décomposé.
 *
 * Le groupe électrogène est presque toujours le poste dominant, et c'est
 * précisément celui que le client ne voit pas : il paie son carburant au
 * litre, jamais à l'année. Le décomposer est tout l'argumentaire.
 */
export const coutActuel = ({
  factureMensuelle = 0,
  groupeActif = false,
  heuresCoupureJour = 0,
  prixCarburant = 0,
  consommationLh = 0,
} = {}) => {
  const reseau = nombre(factureMensuelle) * MOIS_PAR_AN;
  const litresAn = groupeActif
    ? nombre(heuresCoupureJour) * JOURS_PAR_AN * nombre(consommationLh)
    : 0;
  const carburant = litresAn * nombre(prixCarburant);
  return {
    reseau: Math.round(reseau),
    carburant: Math.round(carburant),
    litresAn: Math.round(litresAn),
    total: Math.round(reseau + carburant),
  };
};

/**
 * Économie nette de la première année : ce que l'installation fait disparaître
 * de la facture, entretien déduit. Peut être NÉGATIVE (petite facture, gros
 * entretien) — dans ce cas le simulateur doit le dire, pas l'arrondir à zéro.
 */
export const economieNette = (coutAnnuel, tauxCouverture = TAUX_COUVERTURE_DEFAUT, maintenance = MAINTENANCE_ANNUELLE) =>
  Math.round(nombre(coutAnnuel) * Math.min(1, Math.max(0, Number(tauxCouverture) || 0)) - nombre(maintenance));

/**
 * Économie d'une année donnée (1 = première), hausse du prix de l'énergie et
 * usure des panneaux comprises. L'entretien, lui, suit aussi l'inflation.
 */
export const economieAnnee = (annee, { coutAnnuel, tauxCouverture, maintenance, hausse }) => {
  const n = Math.max(1, Math.floor(Number(annee) || 1));
  const inflation = (1 + (Number(hausse) || 0)) ** (n - 1);
  const rendement = (1 - DEGRADATION_ANNUELLE) ** (n - 1);
  const brute = nombre(coutAnnuel) * Math.min(1, Math.max(0, Number(tauxCouverture) || 0)) * inflation * rendement;
  return Math.round(brute - nombre(maintenance) * inflation);
};

/**
 * Projection année par année : économie de l'année, cumul, et ce qu'il reste à
 * rembourser sur l'investissement. C'est la matière du graphique.
 */
export const projection = ({
  investissement = 0,
  coutAnnuel = 0,
  tauxCouverture = TAUX_COUVERTURE_DEFAUT,
  maintenance = MAINTENANCE_ANNUELLE,
  hausse = HAUSSE_TARIF_DEFAUT,
  duree = DUREE_SYSTEME_ANS,
} = {}) => {
  const invest = nombre(investissement);
  const annees = Math.max(1, Math.floor(Number(duree) || DUREE_SYSTEME_ANS));
  const lignes = [];
  let cumul = 0;
  for (let annee = 1; annee <= annees; annee += 1) {
    const economie = economieAnnee(annee, { coutAnnuel, tauxCouverture, maintenance, hausse });
    cumul += economie;
    lignes.push({
      annee,
      economie,
      cumul,
      // Jamais négatif : une fois remboursé, l'investissement est remboursé.
      restant: Math.max(0, Math.round(invest - cumul)),
    });
  }
  return lignes;
};

/**
 * Année où l'investissement est remboursé, avec la fraction d'année (2,4 ans).
 * Retourne `null` quand il ne l'est JAMAIS sur la durée du système — cas réel
 * d'une petite facture face à une grosse installation. Afficher « 0 an » ou
 * l'omettre serait un mensonge commercial ; le simulateur doit pouvoir dire
 * qu'un projet ne se rembourse pas.
 */
export const retourInvestissement = (lignes, investissement) => {
  const invest = nombre(investissement);
  if (invest <= 0) return null;
  let precedent = 0;
  for (const ligne of lignes) {
    if (ligne.cumul >= invest) {
      // Interpolation dans l'année qui franchit le seuil.
      const manquant = invest - precedent;
      const fraction = ligne.economie > 0 ? manquant / ligne.economie : 0;
      return Math.round((ligne.annee - 1 + fraction) * 10) / 10;
    }
    precedent = ligne.cumul;
  }
  return null;
};

/**
 * CO₂ évité en un an : le gazole que le groupe ne brûle plus, et les kWh que
 * le réseau ne fournit plus — au prorata de ce que le solaire couvre.
 */
export const co2EviteAn = ({ litresAn = 0, kwhReseauAn = 0, tauxCouverture = TAUX_COUVERTURE_DEFAUT } = {}) => {
  const part = Math.min(1, Math.max(0, Number(tauxCouverture) || 0));
  return Math.round((nombre(litresAn) * CO2_PAR_LITRE_GAZOLE + nombre(kwhReseauAn) * CO2_PAR_KWH_RESEAU) * part);
};

/**
 * Simulation complète, prête pour l'écran.
 *
 * @param {object} e entrées du formulaire
 * @returns tout ce qui s'affiche : décomposition du coût actuel, économie de
 *   l'année 1, retour sur investissement, gain sur la durée, CO₂ évité et la
 *   projection année par année.
 */
export const simulerRoi = ({
  investissement = 0,
  factureMensuelle = 0,
  tarifKwh = 0,
  hausse = HAUSSE_TARIF_DEFAUT,
  groupeActif = false,
  heuresCoupureJour = 0,
  prixCarburant = 0,
  consommationLh = 0,
  tauxCouverture = TAUX_COUVERTURE_DEFAUT,
  maintenance = MAINTENANCE_ANNUELLE,
  duree = DUREE_SYSTEME_ANS,
} = {}) => {
  const cout = coutActuel({ factureMensuelle, groupeActif, heuresCoupureJour, prixCarburant, consommationLh });
  const lignes = projection({ investissement, coutAnnuel: cout.total, tauxCouverture, maintenance, hausse, duree });
  const invest = nombre(investissement);
  const cumulFinal = lignes.length ? lignes[lignes.length - 1].cumul : 0;
  const gainDuree = Math.round(cumulFinal - invest);
  const kwhReseauAn = nombre(tarifKwh) > 0 ? (nombre(factureMensuelle) * MOIS_PAR_AN) / nombre(tarifKwh) : 0;

  return {
    cout,
    maintenance: Math.round(nombre(maintenance)),
    economieAn1: economieNette(cout.total, tauxCouverture, maintenance),
    retourAns: retourInvestissement(lignes, invest),
    gainDuree,
    // ROI en % de l'investissement. Sans investissement saisi, il n'y a rien
    // à rentabiliser : `null` plutôt qu'une division par zéro affichée.
    roiPct: invest > 0 ? Math.round((gainDuree / invest) * 100) : null,
    kwhReseauAn: Math.round(kwhReseauAn),
    co2AnKg: co2EviteAn({ litresAn: cout.litresAn, kwhReseauAn, tauxCouverture }),
    co2DureeT: Math.round((co2EviteAn({ litresAn: cout.litresAn, kwhReseauAn, tauxCouverture }) * lignes.length) / 100) / 10,
    projection: lignes,
  };
};
