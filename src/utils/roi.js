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
import { calculMaintenanceAnnuelle } from './maintenance';

export const JOURS_PAR_AN = 365;
export const MOIS_PAR_AN = 12;
export const HEURES_PAR_JOUR = 24;

/**
 * Durée de vie retenue pour la projection. 25 ans = la garantie de production
 * des panneaux, mais un client prudent raisonne souvent sur la durée de vie du
 * maillon le plus court (batteries, onduleur) : le choix lui est laissé.
 */
export const DUREES_SYSTEME = [10, 15, 25];
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

/** Hausse du prix de l'énergie par an, réseau et carburant confondus. */
export const HAUSSE_TARIF_DEFAUT = 0.05;

/**
 * Perte de rendement des panneaux, par an. Les fiches constructeur garantissent
 * ~80 % de la puissance à 25 ans, soit environ 0,5 %/an. Sans elle, la
 * projection à 25 ans surestime le gain de plusieurs millions.
 */
export const DEGRADATION_ANNUELLE = 0.005;

/**
 * L'onduleur dure environ 5 ans — la durée de vie que la fiche de
 * dimensionnement annonce (utils/sizingSheet/compute.js › DUREES_VIE). Sur la
 * durée retenue, il est donc remplacé au bout de 5, 10, 15 et 20 ans, jamais
 * la dernière année : on le remplace pour continuer, et la projection
 * s'arrête là. Sur 10 ans, un remplacement — comme la fiche ; sur 25 ans,
 * quatre.
 */
export const DUREE_VIE_ONDULEUR_ANS = 5;

/** Années où l'onduleur est remplacé, sur la durée retenue : [5, 10, 15, 20] sur 25 ans. */
export const anneesRemplacementOnduleur = (duree = DUREE_SYSTEME_ANS) => {
  const fin = Math.max(1, Math.floor(Number(duree) || DUREE_SYSTEME_ANS));
  const annees = [];
  for (let a = DUREE_VIE_ONDULEUR_ANS; a < fin; a += DUREE_VIE_ONDULEUR_ANS) annees.push(a);
  return annees;
};

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
 * Répartition retenue quand la consommation vient de la FACTURE : 40 % en
 * journée, 60 % la nuit.
 *
 * Ce n'est pas une moyenne, c'est une marge de sécurité. Une facture ne dit
 * pas QUAND le client consomme, et c'est la part nocturne qui dimensionne le
 * parc batterie : la sous-estimer donne une installation qui s'éteint avant le
 * matin. En supposant toujours la nuit majoritaire, le kit sorti du simulateur
 * tient — au pire il est un peu large, jamais court.
 *
 * (Le mode « appareils », lui, connaît les heures réelles de chaque appareil :
 * il garde sa répartition mesurée, plus précise que toute hypothèse.)
 */
export const PART_JOUR_FACTURE = 0.4;
export const PART_NUIT_FACTURE = 1 - PART_JOUR_FACTURE;

/**
 * ÉTAPE 1 bis — La facture du client en kWh par jour, quand il ne sait pas
 * dire ce qu'il fait tourner mais sait très bien ce qu'il paie.
 *
 * L'annualisation part de DOUZE FACTURES, pas de mois de 30 jours comme
 * `utils/factureConso.js` (dont la convention sert au dimensionnement). La
 * différence n'est que de 1,4 %, mais elle porte sur le seul chiffre que le
 * client peut vérifier : sa facture, qu'il a sous les yeux. Le coût réseau
 * annoncé ici vaut donc exactement douze fois ce qu'il paie.
 *
 * @param {number} montantMensuel  facture, F CFA
 * @param {number} prixKwh         prix du kWh
 * @param {number} partJour        part consommée en journée (0 à 1)
 */
export const consommationDepuisFacture = (montantMensuel, prixKwh, partJour = PART_JOUR_FACTURE) => {
  const montant = nombre(montantMensuel);
  const prix = nombre(prixKwh);
  if (montant <= 0 || prix <= 0) return { kwhMois: 0, jour: 0, nuit: 0, total: 0, pic: 0 };
  const kwhAn = (montant * MOIS_PAR_AN) / prix;
  const kwhJour = kwhAn / JOURS_PAR_AN;
  const part = Math.min(1, Math.max(0, Number(partJour) || 0));
  // Volontairement NON arrondi : l'écran arrondit à l'affichage, mais arrondir
  // ici ferait dériver le coût annuel de quelques centaines de francs — juste
  // assez pour ne plus tomber sur la facture que le client tient en main.
  return {
    kwhMois: kwhAn / MOIS_PAR_AN,
    jour: kwhJour * part,
    nuit: kwhJour * (1 - part),
    total: kwhJour,
    pic: 0, // une facture ne dit rien du pic de charge
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
export const economieAnnee = (annee, { coutAnnuel = 0, maintenance = 0, hausse = HAUSSE_TARIF_DEFAUT } = {}) => {
  const n = Math.max(1, Math.floor(Number(annee) || 1));
  const inflation = (1 + (Number(hausse) || 0)) ** (n - 1);
  const rendement = (1 - DEGRADATION_ANNUELLE) ** (n - 1);
  return Math.round(nombre(coutAnnuel) * inflation * rendement - nombre(maintenance) * inflation);
};

/**
 * Projection année par année. Chaque ligne se lit comme le bilan :
 *   brute      ce que le client ne paie plus cette année (réseau + groupe)
 *   entretien  l'entretien de l'année            → economie = brute − entretien
 *   onduleur   le remplacement de l'onduleur, les années où il tombe
 *   cumul      somme des (economie − onduleur), et reste à rembourser.
 * L'entretien est l'écart entre `brute` et `economie`, tous deux arrondis :
 * additionnés sur la durée, les postes retombent au franc près sur le gain.
 *
 * @param {number} prixOnduleur  prix de l'onduleur à remplacer, au prix
 *   d'aujourd'hui comme la fiche de dimensionnement ; 0 = non compté.
 */
export const projection = ({
  investissement = 0,
  coutAnnuel = 0,
  maintenance = 0,
  hausse = HAUSSE_TARIF_DEFAUT,
  duree = DUREE_SYSTEME_ANS,
  prixOnduleur = 0,
} = {}) => {
  const invest = nombre(investissement);
  const annees = Math.max(1, Math.floor(Number(duree) || DUREE_SYSTEME_ANS));
  const prix = Math.round(nombre(prixOnduleur));
  const remplacements = new Set(prix > 0 ? anneesRemplacementOnduleur(annees) : []);
  const lignes = [];
  let cumul = 0;
  for (let annee = 1; annee <= annees; annee += 1) {
    const economie = economieAnnee(annee, { coutAnnuel, maintenance, hausse });
    const brute = economieAnnee(annee, { coutAnnuel, maintenance: 0, hausse });
    const onduleur = remplacements.has(annee) ? prix : 0;
    cumul += economie - onduleur;
    // Jamais négatif : une fois remboursé, l'investissement est remboursé.
    lignes.push({
      annee, brute, entretien: brute - economie, economie, onduleur,
      cumul, restant: Math.max(0, Math.round(invest - cumul)),
    });
  }
  return lignes;
};

/**
 * Année où l'installation est remboursée, fraction comprise (2,4 ans).
 * Remboursée POUR DE BON : un remplacement d'onduleur peut refaire passer le
 * cumul sous le prix payé — le client n'a alors pas récupéré sa mise, et le
 * remboursement tombe après ce creux.
 * `null` quand elle ne l'est JAMAIS sur la durée retenue — cas réel d'une
 * petite consommation face à une grosse installation. Afficher « 0 an » ou
 * masquer le résultat serait un mensonge commercial : le simulateur doit
 * pouvoir dire qu'un projet ne se rembourse pas.
 */
export const retourInvestissement = (lignes = [], investissement = 0) => {
  const invest = nombre(investissement);
  if (invest <= 0 || !lignes.length) return null;
  let dernierSous = -1;
  lignes.forEach((ligne, i) => { if (ligne.cumul < invest) dernierSous = i; });
  if (dernierSous === lignes.length - 1) return null;
  const precedent = dernierSous >= 0 ? lignes[dernierSous].cumul : 0;
  const ligne = lignes[dernierSous + 1];
  // Ce que l'année a réellement rapporté : économie, moins l'onduleur s'il y a lieu.
  const flux = ligne.cumul - precedent;
  const fraction = flux > 0 ? (invest - precedent) / flux : 0;
  return Math.round((ligne.annee - 1 + fraction) * 10) / 10;
};

/** CO₂ évité en un an : le gazole non brûlé et les kWh non tirés du réseau. */
export const co2EviteAn = ({ litresAn = 0, kwhReseauAn = 0 } = {}) =>
  Math.round(nombre(litresAn) * CO2_PAR_LITRE_GAZOLE + nombre(kwhReseauAn) * CO2_PAR_KWH_RESEAU);

/**
 * Consommation retenue : celle passée directement (estimation depuis la
 * facture du client) ou, à défaut, celle déduite de ses appareils. Les deux
 * chemins doivent produire la MÊME forme, sinon tout ce qui suit diverge.
 */
export const consommationRetenue = (appareils = [], conso = null) => {
  const total = Number(conso?.total) || 0;
  if (total <= 0) return consommationAppareils(appareils);
  // Reprise telle quelle, sans réarrondir : l'affichage s'en charge, et un
  // arrondi de plus décalerait le coût annuel de la facture réelle.
  return {
    jour: Number(conso.jour) || 0,
    nuit: Number(conso.nuit) || 0,
    total,
    // Une facture ne dit rien du pic de charge : l'onduleur se calera alors
    // sur la seule puissance photovoltaïque, comme dans l'assistant de devis.
    pic: Number(conso.pic) || 0,
  };
};

/**
 * La chaîne complète, prête pour l'écran.
 *
 * @param {object}  e
 * @param {Array}   e.appareils          lignes { power, quantity, day, night }
 * @param {object}  e.conso              consommation déjà connue { jour, nuit, total } —
 *                                       prime sur `appareils` (estimation par facture)
 * @param {number}  e.investissement     prix de l'installation (kit ou devis)
 * @param {number}  e.heuresCoupureJour  coupures quotidiennes du réseau
 * @param {number}  e.tarifKwh           prix du kWh CEET
 * @param {number}  e.prixCarburant      prix du litre de gazole
 * @param {number}  e.duree              durée de vie retenue, en années
 * @param {number}  e.nbPanneaux         panneaux du kit proposé : ils fixent
 *                                       l'entretien annuel (utils/maintenance.js)
 */
export const simulerRoi = ({
  appareils = [],
  conso = null,
  investissement = 0,
  heuresCoupureJour = 0,
  tarifKwh = 0,
  prixCarburant = 0,
  groupeActif = false,
  nbPanneaux = 0,
  hausse = HAUSSE_TARIF_DEFAUT,
  duree = DUREE_SYSTEME_ANS,
  prixOnduleur = 0,
} = {}) => {
  const consommation = consommationRetenue(appareils, conso);
  const cout = coutActuel({
    kwhJour: consommation.total, heuresCoupureJour, tarifKwh, prixCarburant, groupeActif,
  });
  // Entretien : la règle commune à toute l'application, sur les panneaux du
  // système proposé — la fiche de dimensionnement donne le même montant.
  const maintenance = calculMaintenanceAnnuelle(nbPanneaux);
  const lignes = projection({ investissement, coutAnnuel: cout.total, maintenance, hausse, duree, prixOnduleur });
  const invest = nombre(investissement);
  const cumulFinal = lignes.length ? lignes[lignes.length - 1].cumul : 0;
  const gainDuree = Math.round(cumulFinal - invest);
  const co2AnKg = co2EviteAn(cout);
  const somme = (cle) => lignes.reduce((t, l) => t + l[cle], 0);
  const remplacements = lignes.filter((l) => l.onduleur > 0);

  return {
    conso: consommation,
    cout,
    maintenance,
    nbPanneaux: Math.max(0, Math.round(Number(nbPanneaux) || 0)),
    economieAn1: lignes[0]?.economie ?? 0,
    retourAns: retourInvestissement(lignes, invest),
    gainDuree,
    // Le gain, poste par poste, tel que l'écran l'additionne devant le client :
    //   économies − installation − entretien − onduleurs = gain (au franc près).
    bilan: {
      economies: somme('brute'),
      investissement: invest,
      entretien: somme('entretien'),
      onduleur: {
        prix: remplacements[0]?.onduleur ?? 0,
        annees: remplacements.map((l) => l.annee),
        total: somme('onduleur'),
      },
      gain: gainDuree,
    },
    // Sans montant d'installation, il n'y a rien à rentabiliser : `null`
    // plutôt qu'une division par zéro affichée au client.
    roiPct: invest > 0 ? Math.round((gainDuree / invest) * 100) : null,
    co2AnKg,
    co2DureeT: Math.round((co2AnKg * lignes.length) / 100) / 10,
    projection: lignes,
  };
};
