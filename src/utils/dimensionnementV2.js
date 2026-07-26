// Moteur de dimensionnement v2 — méthodologie corrigée.
//
// Corrige quatre erreurs méthodologiques du moteur v1 (utils/solarSizing.js) :
//
//  1. Le « 75 % » n'est PAS un rendement de panneau (un module fait ~21 %) mais
//     un Performance Ratio système. Ici la chaîne de conversion est explicitée
//     poste par poste, et différenciée jour / nuit : l'énergie consommée la nuit
//     traverse en plus le stockage, son rendement est donc plus faible.
//  2. L'onduleur est dimensionné sur la PUISSANCE DE POINTE SIMULTANÉE DES
//     CHARGES (W), jamais sur la puissance crête du champ PV (Wc) : deux
//     grandeurs différentes. Le champ PV n'est qu'une contrainte de
//     compatibilité (entrée PV max), qui filtre les modèles sans piloter le
//     calibre retenu.
//  3. L'écart entre puissance PV « minimale calculée » et « installée » est
//     tracé et justifié (pv.justification) : il vient du pas du matériel
//     (kit standard / nombre entier de panneaux), pas d'un coefficient occulte.
//  4. L'irradiation de dimensionnement est celle du MOIS LE PLUS DÉFAVORABLE
//     (productible mensuel PVGIS), pas une moyenne annuelle : une moyenne
//     garantit un déficit en saison des pluies.
//
// Module 100 % pur (aucun accès React / réseau / stockage) : c'est le code le
// plus testable du projet. Conventions : puissances en W, énergies en kWh,
// tensions en V, courants en A, sections en mm².
//
// ⚠️ Facteur de puissance des onduleurs hybrides (Deye, Growatt, Felicity…) :
// FP = 1, donc puissance_w = kVA × 1000. La convention « 6 kVA = 4800 W »
// (FP 0,8) ne doit JAMAIS être réintroduite ici.

// ---------------------------------------------------------------------------
// Terminologie — libellés officiels du document. Ne jamais réécrire ces
// intitulés dans les écrans ou la fiche : les importer depuis LIBELLES.
// ---------------------------------------------------------------------------

export const LIBELLES = {
  // Rendements
  etaJour: 'Rendement de chaîne en journée (PV → charge)',
  etaNuit: 'Rendement de chaîne la nuit (PV → batterie → charge)',
  chaineRendement: 'Chaîne de rendement retenue',
  rendementModules: 'Rendement de conversion des modules (donnée constructeur, informative)',
  performanceRatio: 'Performance Ratio (PR) du système',
  // Consommation
  consommationJour: 'Consommation en journée',
  consommationNuit: 'Consommation nocturne',
  consommationTotale: 'Consommation journalière totale',
  puissanceCrete: 'Puissance installée cumulée (toutes charges)',
  puissanceSimultanee: 'Puissance de pointe simultanée',
  puissanceAppel: 'Puissance d’appel au démarrage',
  coefficientSimultaneite: 'Coefficient de simultanéité',
  // Irradiation
  productible: 'Productible du site (kWh/kWc/jour)',
  moisDefavorable: 'Mois le plus défavorable',
  strategieIrradiation: 'Stratégie d’irradiation',
  // Énergie / PV
  energieAProduire: 'Énergie à produire aux bornes du champ',
  pvMin: 'Puissance PV minimale calculée',
  pvInstalle: 'Puissance PV installée',
  // Batterie
  capaciteUtile: 'Capacité utile nécessaire',
  capaciteBrute: 'Capacité brute à installer',
  dod: 'Profondeur de décharge (DoD)',
  tensionSysteme: 'Tension du parc batterie',
  baseAutonomie: 'Base d’autonomie retenue',
  tauxCharge: 'Taux de charge du parc (C-rate)',
  // Onduleur
  onduleurContinu: 'Puissance continue requise',
  onduleurSurge: 'Puissance de démarrage requise (surge)',
  entreePvMax: 'Entrée PV maximale de l’onduleur',
  // Vérifications
  vocFroid: 'Tension Voc à froid (string)',
  vmpChaud: 'Tension Vmp à chaud (string)',
  courantString: 'Courant d’entrée par MPPT',
  // Câblage
  section: 'Section retenue',
  critereDimensionnant: 'Critère dimensionnant',
  chuteTension: 'Chute de tension',
};

// ---------------------------------------------------------------------------
// Formatage francophone — fin de la fausse précision.
// 4,9 kWc et non 4 889 Wc ; 12,9 kWh et non 12 941 Wh.
// ---------------------------------------------------------------------------

/** Nombre au format francophone : virgule décimale, milliers séparés par des espaces simples. */
const num = (v, dec = 0) =>
  Number(v || 0)
    .toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
    // Normalise les espaces fines/insécables de toLocaleString en espace simple.
    .replace(/[  ]/g, ' ');

export const fmt = {
  num,
  /** Puissance crête : 4,9 kWc (une décimale — la fausse précision au Wc est bannie). */
  kwc: (w) => `${num(Number(w || 0) / 1000, 1)} kWc`,
  /** Énergie : 12,9 kWh. */
  kwh: (v, dec = 1) => `${num(v, dec)} kWh`,
  /** Énergie journalière : 17,6 kWh/jour. */
  kwhJour: (v) => `${num(v, 1)} kWh/jour`,
  /** Puissance : 4 500 W. */
  w: (v) => `${num(v)} W`,
  /** Puissance apparente : 6 kVA. */
  kva: (v) => `${num(v, Number(v) % 1 ? 1 : 0)} kVA`,
  /** Pourcentage : 75,4 % / 80 %. */
  pct: (ratio, dec = 1) => `${num(Number(ratio || 0) * 100, dec)} %`,
  /** Pourcentage déjà exprimé en points : 12,5 %. */
  pctPoints: (v, dec = 1) => `${num(v, dec)} %`,
  h: (v) => `${num(v, Number(v) % 1 ? 1 : 0)} h`,
  v: (val) => `${num(val, Number(val) % 1 ? 1 : 0)} V`,
  a: (val) => `${num(val, Number(val) % 1 ? 1 : 0)} A`,
  ah: (val) => `${num(val)} Ah`,
  mm2: (val) => `${num(val, Number(val) % 1 ? 1 : 0)} mm²`,
  m: (val) => `${num(val, Number(val) % 1 ? 1 : 0)} m`,
  productible: (v) => `${num(v, 2)} kWh/kWc/jour`,
  /** C-rate : 0,42 C. */
  cRate: (v) => `${num(v, 2)} C`,
  /** Angle : 12°. */
  deg: (v) => `${num(v, Number(v) % 1 ? 1 : 0)}°`,
};

export const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

// ---------------------------------------------------------------------------
// Hypothèses par défaut — toutes surchargeables par les entrées.
// ---------------------------------------------------------------------------

export const DEFAUTS = {
  // Pertes de la chaîne PV (multiplicatives). Contexte Bénin : chaleur élevée,
  // poussière d'harmattan.
  pertes: {
    temperature: 0.90,      // dérive thermique des modules (~ -10 % en climat chaud)
    salissure: 0.97,        // poussière / harmattan (non modélisé par PVGIS)
    vieillissement: 0.98,   // dégradation moyenne sur la durée d'étude
    cablageDC: 0.97,        // mismatch + chutes DC
    mppt: 0.98,             // recherche de point de puissance maximale
    onduleurDCAC: 0.95,     // conversion DC → AC
  },
  rendementBatterieAllerRetour: 0.95, // LiFePO4 charge + décharge
  rendementBatterieDecharge: 0.975,   // demi-cycle (dimensionnement de capacité)
  dod: 0.80,
  tensionSysteme: 48,
  coefficientSimultaneite: 0.75,
  joursAutonomie: 1,
  facteurDemarrage: 3,        // appel moteur/compresseur (× puissance nominale)
  margeOnduleur: 1.20,        // marge de sécurité sur la puissance CONTINUE des charges
  temperatureCelluleMax: 70,  // °C — Vmp à chaud
  temperatureAmbianteMin: 15, // °C — Voc à froid (nuits d'harmattan)
  resistiviteCuivre: 0.01724, // Ω·mm²/m à 20 °C
  chuteAdmissible: { pv: 0.03, batterie: 0.01, ac: 0.03 }, // UTE C15-712-1 / NF C15-100
  tensionAC: 230,
};

/** Sections normalisées (mm²) — série CENELEC. */
export const SECTIONS_NORMALISEES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];

/** Courant admissible indicatif (A) par section, cuivre isolé, pose courante. */
const AMPACITE = {
  1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76, 25: 101, 35: 125,
  50: 151, 70: 192, 95: 232, 120: 269, 150: 309, 185: 353, 240: 415,
};

export const REFERENCES = [
  'UTE C15-712-1 — Installations photovoltaïques raccordées au réseau public de distribution',
  'UTE C15-712-2 — Installations photovoltaïques autonomes (sites isolés, stockage)',
  'NF C15-100 — Installations électriques à basse tension (partie AC, chutes de tension)',
  'IEC 62548 — Photovoltaic (PV) arrays : design requirements (configuration des strings)',
  'IEC 61215 / IEC 61730 — Qualification et sécurité des modules photovoltaïques',
  'PVGIS (Commission européenne, JRC) — Productible mensuel, base de données SARAH3/ERA5',
];

// ---------------------------------------------------------------------------
// Normalisation des entrées (compatibilité ascendante)
// ---------------------------------------------------------------------------

const nb = (v, defaut = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : defaut;
};

/**
 * Normalise un équipement saisi. Compatibilité v1 : un équipement qui ne porte
 * qu'un total d'heures (`heures`, `hours` ou `heuresParJour`) est basculé en
 * heures de JOURNÉE, heures de nuit à 0, et marqué `repartitionAVerifier`
 * pour que l'interface invite l'utilisateur à revoir la répartition.
 *
 * @param {object} e équipement brut (formats v1 ou v2)
 * @returns {{nom:string,puissanceW:number,quantite:number,heuresJour:number,heuresNuit:number,demarrage:boolean,repartitionAVerifier:boolean}}
 */
export function normaliserEquipement(e = {}) {
  const puissanceW = nb(e.puissanceW ?? e.power ?? e.puissance);
  const quantite = Math.max(1, Math.round(nb(e.quantite ?? e.quantity ?? 1, 1)));
  const aJourNuit = e.heuresJour != null || e.heuresNuit != null || e.day != null || e.night != null;
  const heuresLegacy = nb(e.heures ?? e.hours ?? e.heuresParJour);
  const heuresJour = aJourNuit ? nb(e.heuresJour ?? e.day) : heuresLegacy;
  const heuresNuit = aJourNuit ? nb(e.heuresNuit ?? e.night) : 0;
  return {
    nom: String(e.nom ?? e.name ?? '').trim() || 'Appareil personnalisé',
    puissanceW,
    quantite,
    heuresJour: Math.max(0, Math.min(24, heuresJour)),
    heuresNuit: Math.max(0, Math.min(24, heuresNuit)),
    demarrage: Boolean(e.demarrage ?? e.demarrageMoteur ?? e.surge),
    repartitionAVerifier: !aJourNuit && heuresLegacy > 0,
  };
}

/** Normalise une liste d'équipements (voir normaliserEquipement). */
export const normaliserEquipements = (liste = []) => liste.map(normaliserEquipement);

// ---------------------------------------------------------------------------
// 1. Bilan de consommation
// ---------------------------------------------------------------------------

/**
 * Bilan de consommation : énergies jour / nuit, puissance de pointe simultanée
 * et puissance d'appel au démarrage.
 *
 * Hypothèse de démarrage (pratique professionnelle) : un seul moteur démarre à
 * la fois — l'appel est donc la pointe simultanée augmentée du surcroît d'appel
 * du plus gros moteur, et non de tous les moteurs cumulés.
 *
 * `puissanceSimultaneeImposee` : en saisie directe, l'utilisateur fournit
 * lui-même la pointe des charges ; elle fait alors foi et le coefficient de
 * simultanéité n'est pas appliqué.
 */
export function bilanConsommation(equipements, {
  coefficientSimultaneite = DEFAUTS.coefficientSimultaneite,
  facteurDemarrage = DEFAUTS.facteurDemarrage,
  puissanceSimultaneeImposee = null,
} = {}) {
  const items = normaliserEquipements(equipements).map((e) => {
    const puissanceTotale = e.puissanceW * e.quantite;
    return {
      ...e,
      puissanceTotaleW: puissanceTotale,
      whJour: puissanceTotale * e.heuresJour,
      whNuit: puissanceTotale * e.heuresNuit,
    };
  });

  const jourKwh = items.reduce((s, e) => s + e.whJour, 0) / 1000;
  const nuitKwh = items.reduce((s, e) => s + e.whNuit, 0) / 1000;
  const puissanceCrete = items.reduce((s, e) => s + e.puissanceTotaleW, 0);
  const imposee = Number(puissanceSimultaneeImposee) > 0 ? Math.round(Number(puissanceSimultaneeImposee)) : null;
  const puissanceSimultanee = imposee ?? Math.round(puissanceCrete * coefficientSimultaneite);

  const moteurs = items.filter((e) => e.demarrage);
  const plusGrosMoteur = moteurs.reduce((max, e) => Math.max(max, e.puissanceW), 0);
  const puissanceAppelDemarrage = Math.round(
    puissanceSimultanee + Math.max(0, facteurDemarrage - 1) * plusGrosMoteur
  );

  return {
    parEquipement: items,
    jourKwh: Number(jourKwh.toFixed(3)),
    nuitKwh: Number(nuitKwh.toFixed(3)),
    totalKwh: Number((jourKwh + nuitKwh).toFixed(3)),
    puissanceCrete,
    puissanceSimultanee,
    puissanceAppelDemarrage,
    coefficientSimultaneite,
    simultaneiteImposee: imposee != null,
    facteurDemarrage,
    plusGrosMoteur,
    nbMoteurs: moteurs.length,
    repartitionAVerifier: items.some((e) => e.repartitionAVerifier),
  };
}

// ---------------------------------------------------------------------------
// 2. Irradiation — mois défavorable (PVGIS) ou moyenne annuelle
// ---------------------------------------------------------------------------

/**
 * Productible de dimensionnement (kWh/kWc/jour).
 *
 * @param {object} site  { nom, productibleMensuel:number[12], source }
 * @param {'mois-defavorable'|'moyenne-annuelle'} strategie
 * @param {number|null} hspSecours  HSP de repli si aucun productible mensuel
 */
export function irradiationDeDimensionnement(site = {}, strategie = 'mois-defavorable', hspSecours = null) {
  const mensuel = Array.isArray(site.productibleMensuel)
    ? site.productibleMensuel.map((v) => nb(v)).filter((v) => v > 0)
    : [];
  const complet = Array.isArray(site.productibleMensuel)
    && site.productibleMensuel.length === 12
    && mensuel.length === 12;

  if (!complet) {
    // Repli : pas de données mensuelles → HSP fourni (méthode dégradée, signalée).
    const productible = nb(hspSecours, 0);
    return {
      productible,
      strategie,
      methode: 'hsp',
      moisIndex: null,
      moisNom: null,
      source: site.source || 'Saisie manuelle',
      siteNom: site.nom || null,
      complet: false,
      mention: productible > 0
        ? `Productible estimé à partir d’un ensoleillement moyen de ${fmt.num(productible, 2)} h de pic par jour, sans données mensuelles : le déficit de saison des pluies n’est pas couvert. Renseigner le productible mensuel PVGIS du site pour un dimensionnement au mois le plus défavorable.`
        : 'Aucune donnée d’irradiation disponible : le dimensionnement ne peut pas être garanti.',
    };
  }

  const moyenne = mensuel.reduce((s, v) => s + v, 0) / 12;
  const min = Math.min(...mensuel);
  const moisIndex = site.productibleMensuel.findIndex((v) => nb(v) === min);
  const surMoisDefavorable = strategie !== 'moyenne-annuelle';
  const productible = surMoisDefavorable ? min : moyenne;

  return {
    productible: Number(productible.toFixed(3)),
    productibleMin: Number(min.toFixed(3)),
    productibleMoyen: Number(moyenne.toFixed(3)),
    strategie: surMoisDefavorable ? 'mois-defavorable' : 'moyenne-annuelle',
    methode: 'pvgis',
    moisIndex,
    moisNom: MOIS[moisIndex] || null,
    source: site.source || 'PVGIS',
    siteNom: site.nom || null,
    inclinaison: site.inclinaison ?? null,
    azimut: site.azimut ?? null,
    complet: true,
    mention: surMoisDefavorable
      ? `Dimensionnement calé sur le mois le plus défavorable (${MOIS[moisIndex]}, ${fmt.productible(min)}), et non sur la moyenne annuelle (${fmt.productible(moyenne)}) : le système couvre ainsi les besoins toute l’année, saison des pluies comprise. Données ${site.source || 'PVGIS'}${site.inclinaison != null ? `, plan incliné à ${fmt.deg(site.inclinaison)}` : ''}.`
      : `Dimensionnement calé sur la moyenne annuelle (${fmt.productible(moyenne)}). ⚠️ En ${MOIS[moisIndex]}, le productible descend à ${fmt.productible(min)} : un déficit de production est attendu en saison des pluies.`,
  };
}

// ---------------------------------------------------------------------------
// 3. Chaîne de rendement — différenciée jour / nuit, sans double comptage
// ---------------------------------------------------------------------------

/**
 * Rendements de chaîne.
 *
 * ⚠️ Anti-double-comptage : en méthode `pvgis`, le productible fourni est déjà
 * une énergie AC (PVGIS intègre température, spectre, câblage et onduleur via
 * ses pertes système). On n'applique donc QUE ce que PVGIS ne modélise pas
 * (salissure, vieillissement). En méthode `hsp`, l'irradiation est une énergie
 * incidente : toute la chaîne doit être appliquée.
 *
 * Le rendement de nuit est nécessairement inférieur à celui du jour : l'énergie
 * traverse en plus le stockage (rendement aller-retour de la batterie).
 */
export function chaineRendement({ methode = 'pvgis', pertes = {}, rendementBatterieAllerRetour } = {}) {
  const p = { ...DEFAUTS.pertes, ...pertes };
  const etaBatterie = nb(rendementBatterieAllerRetour, DEFAUTS.rendementBatterieAllerRetour);

  const postesPvgis = [
    { cle: 'salissure', label: 'Salissure / poussière (harmattan)', valeur: p.salissure },
    { cle: 'vieillissement', label: 'Vieillissement des modules', valeur: p.vieillissement },
  ];
  const postesHsp = [
    { cle: 'temperature', label: 'Dérive thermique des modules', valeur: p.temperature },
    ...postesPvgis,
    { cle: 'cablageDC', label: 'Mismatch et câblage DC', valeur: p.cablageDC },
    { cle: 'mppt', label: 'Régulation MPPT', valeur: p.mppt },
    { cle: 'onduleurDCAC', label: 'Conversion DC → AC (onduleur)', valeur: p.onduleurDCAC },
  ];

  const postes = methode === 'pvgis' ? postesPvgis : postesHsp;
  const etaJour = postes.reduce((prod, poste) => prod * poste.valeur, 1);
  const etaNuit = etaJour * etaBatterie;

  return {
    methode,
    etaJour: Number(etaJour.toFixed(4)),
    etaNuit: Number(etaNuit.toFixed(4)),
    rendementBatterie: etaBatterie,
    chaine: [
      ...postes,
      { cle: 'batterie', label: 'Stockage batterie (aller-retour, flux nocturne)', valeur: etaBatterie, nuitUniquement: true },
    ],
    mention: methode === 'pvgis'
      ? `Productible PVGIS : les pertes de température, de câblage et de conversion sont déjà intégrées à la donnée source. Seules la salissure et le vieillissement sont appliqués ici, pour éviter tout double comptage.`
      : `Irradiation incidente (heures de pic) : la chaîne de conversion complète est appliquée, poste par poste. Le produit de ces rendements est le Performance Ratio du système — ce n’est pas le rendement des modules, qui vaut environ 21 % (donnée constructeur).`,
  };
}

// ---------------------------------------------------------------------------
// 4. Câblage — sections UTE C15-712 (facteur 2 = aller + retour)
// ---------------------------------------------------------------------------

/** Première section normalisée ≥ valeur calculée. */
const sectionNormalisee = (s) => SECTIONS_NORMALISEES.find((v) => v >= s) || SECTIONS_NORMALISEES[SECTIONS_NORMALISEES.length - 1];

/**
 * Section d'un conducteur, critère chute de tension ET courant admissible.
 *
 * S = (2 × L × I × ρ) / ΔU  — le facteur 2 compte l'aller ET le retour du
 * courant : l'oublier divise la section par deux (erreur classique).
 *
 * @param {object} p
 * @param {number} p.longueurM      longueur simple de la liaison (m)
 * @param {number} p.courantA       courant de service (A)
 * @param {number} p.tensionV       tension de la liaison (V)
 * @param {number} p.chutePct       chute de tension admissible (ratio, ex. 0.01)
 * @param {number} [p.resistivite]  Ω·mm²/m (cuivre 20 °C par défaut)
 * @param {number} [p.sectionMinimale] section plancher imposée par l'usage
 *   (ex. 4 mm² sur les liaisons de string PV — pratique courante UTE C15-712)
 */
export function sectionCable({ longueurM, courantA, tensionV, chutePct, resistivite = DEFAUTS.resistiviteCuivre, sectionMinimale = 0 }) {
  const L = nb(longueurM);
  const I = nb(courantA);
  const U = nb(tensionV);
  const chuteAdmissibleV = U * nb(chutePct);
  if (!L || !I || !chuteAdmissibleV) {
    return { sectionMm2: null, sectionCalculeeMm2: 0, critere: null, chuteReellePct: 0, longueurM: L, courantA: I, tensionV: U, chuteAdmissiblePct: nb(chutePct) };
  }

  // Critère 1 : chute de tension (facteur 2 : aller + retour)
  const sCalculee = (2 * L * I * resistivite) / chuteAdmissibleV;
  const sChute = sectionNormalisee(sCalculee);
  // Critère 2 : courant admissible de la canalisation
  const sIntensite = SECTIONS_NORMALISEES.find((v) => (AMPACITE[v] || 0) >= I) || sChute;

  const sectionMm2 = Math.max(sChute, sIntensite, sectionMinimale);
  const chuteReelleV = (2 * L * I * resistivite) / sectionMm2;
  const critere = sectionMm2 === sectionMinimale && sectionMinimale > Math.max(sChute, sIntensite)
    ? 'section minimale d’usage'
    : (sIntensite > sChute ? 'courant admissible' : 'chute de tension');

  return {
    sectionMm2,
    sectionCalculeeMm2: Number(sCalculee.toFixed(2)),
    sectionChuteMm2: sChute,
    sectionIntensiteMm2: sIntensite,
    critere,
    chuteReellePct: Number(((chuteReelleV / U) * 100).toFixed(2)),
    chuteAdmissiblePct: nb(chutePct),
    longueurM: L,
    courantA: Number(I.toFixed(1)),
    tensionV: U,
  };
}

// ---------------------------------------------------------------------------
// 5. Vérifications de compatibilité : strings / MPPT / C-rate
// ---------------------------------------------------------------------------

/** Tension Voc corrigée au froid (coeff en %/°C, négatif). */
export const vocFroid = (voc, coeffVocPct, tMin = DEFAUTS.temperatureAmbianteMin) =>
  nb(voc) * (1 + (nb(coeffVocPct, -0.27) / 100) * (tMin - 25));

/** Tension Vmp corrigée à chaud (coeff en %/°C, négatif). */
export const vmpChaud = (vmp, coeffVmpPct, tMax = DEFAUTS.temperatureCelluleMax) =>
  nb(vmp) * (1 + (nb(coeffVmpPct, -0.35) / 100) * (tMax - 25));

/**
 * Configuration série / parallèle du champ PV.
 * Cherche une combinaison exacte série × parallèle = nbPanneaux dont la
 * tension string respecte la plage MPPT de l'onduleur. Un nombre de panneaux
 * incompatible (ex. nombre premier hors plage) est BLOQUANT : il faut changer
 * le nombre de panneaux ou l'onduleur.
 */
export function configurationStrings({ nbPanneaux, panneau = {}, onduleur = {}, temperatures = {} }) {
  const n = Math.max(0, Math.round(nb(nbPanneaux)));
  const vMax = nb(onduleur.vDcMax);
  const vMpptMin = nb(onduleur.vMpptMin);
  const voc = nb(panneau.voc);
  const vmp = nb(panneau.vmp);
  if (!n || !vMax || !vMpptMin || !voc || !vmp) {
    return { possible: null, raison: 'caracteristiques-manquantes', nbPanneaux: n };
  }

  const tMin = nb(temperatures.min, DEFAUTS.temperatureAmbianteMin);
  const tMax = nb(temperatures.max, DEFAUTS.temperatureCelluleMax);
  const vocF = vocFroid(voc, panneau.coeffVoc, tMin);
  const vmpC = vmpChaud(vmp, panneau.coeffVmp, tMax);

  const serieMax = Math.floor(vMax / vocF);
  const serieMin = Math.ceil(vMpptMin / vmpC);

  const combinaisons = [];
  for (let serie = serieMin; serie <= serieMax; serie += 1) {
    if (serie > 0 && n % serie === 0) combinaisons.push({ serie, parallele: n / serie });
  }
  // Préférence : le moins de strings en parallèle (courant plus faible, câblage plus simple).
  combinaisons.sort((a, b) => a.parallele - b.parallele);
  const retenue = combinaisons[0] || null;

  const courantString = retenue ? nb(panneau.imp) * retenue.parallele : null;
  const courantCourtCircuit = retenue ? nb(panneau.isc) * retenue.parallele : null;
  const iMppt = nb(onduleur.iMppt);

  return {
    possible: Boolean(retenue),
    raison: retenue ? null : (serieMin > serieMax ? 'plage-serie-vide' : 'nombre-panneaux-incompatible'),
    nbPanneaux: n,
    serieMin,
    serieMax,
    serie: retenue?.serie ?? null,
    parallele: retenue?.parallele ?? null,
    combinaisons,
    vocFroidV: Number(vocF.toFixed(1)),
    vocStringV: retenue ? Number((vocF * retenue.serie).toFixed(1)) : null,
    vDcMaxV: vMax,
    vmpChaudV: Number(vmpC.toFixed(1)),
    vmpStringV: retenue ? Number((vmpC * retenue.serie).toFixed(1)) : null,
    vMpptMinV: vMpptMin,
    courantStringA: courantString != null ? Number(courantString.toFixed(1)) : null,
    courantCourtCircuitA: courantCourtCircuit != null ? Number(courantCourtCircuit.toFixed(1)) : null,
    iMpptA: iMppt || null,
    tensionOk: retenue ? vocF * retenue.serie <= vMax : false,
    courantOk: retenue && iMppt ? courantString <= iMppt : null,
    temperatures: { min: tMin, max: tMax },
  };
}

// ---------------------------------------------------------------------------
// 6. Onduleur — piloté par les CHARGES, le PV ne fait que filtrer
// ---------------------------------------------------------------------------

/**
 * Sélectionne l'onduleur sur la puissance de pointe des charges.
 *
 * Le champ PV n'intervient PAS dans le calibre : il ne sert qu'à filtrer, à
 * puissance de charge égale, les modèles dont l'entrée PV est insuffisante. Un
 * champ PV surdimensionné produit une alerte, jamais un onduleur plus gros.
 */
export function choisirOnduleur({
  puissanceSimultanee, puissanceAppelDemarrage, pvInstalleWc,
  catalogue = [], marge = DEFAUTS.margeOnduleur,
}) {
  const continueRequise = Math.round(nb(puissanceSimultanee) * marge);
  const surgeRequis = Math.round(nb(puissanceAppelDemarrage));

  const options = catalogue
    .map((o) => ({
      ...o,
      // FP = 1 sur les hybrides : puissance_w = kVA × 1000 (jamais × 800).
      puissanceW: nb(o.puissanceW ?? (o.kva ? o.kva * 1000 : 0)),
      surgeW: nb(o.surgeW ?? (o.puissanceW ? o.puissanceW * 2 : 0)),
      pvMaxWc: nb(o.pvMaxWc),
    }))
    .filter((o) => o.puissanceW > 0)
    .sort((a, b) => a.puissanceW - b.puissanceW);

  // Candidats couvrant les charges (continu + appel au démarrage).
  const surCharges = options.filter((o) => o.puissanceW >= continueRequise && (!o.surgeW || o.surgeW >= surgeRequis));
  // À puissance égale, on privilégie un modèle dont l'entrée PV suffit (filtre,
  // pas moteur du dimensionnement).
  const pv = nb(pvInstalleWc);
  const plusPetitePuissance = surCharges[0]?.puissanceW;
  const memeCalibre = surCharges.filter((o) => o.puissanceW === plusPetitePuissance);
  const retenu = memeCalibre.find((o) => !pv || !o.pvMaxWc || o.pvMaxWc >= pv) || surCharges[0] || null;

  return {
    puissanceContinueRequiseW: continueRequise,
    surgeRequisW: surgeRequis,
    marge,
    retenu,
    suffisant: Boolean(retenu),
    pvCompatible: retenu && retenu.pvMaxWc ? pv <= retenu.pvMaxWc : null,
    formule: `Puissance continue requise = pointe simultanée des charges × marge de sécurité = ${fmt.w(nb(puissanceSimultanee))} × ${fmt.num(marge, 2)} = ${fmt.w(continueRequise)}. Puissance d’appel au démarrage à couvrir : ${fmt.w(surgeRequis)}. La puissance du champ PV (${fmt.kwc(pv)}) n’entre pas dans ce calcul : elle ne sert qu’à vérifier la compatibilité de l’entrée PV.`,
  };
}

// ---------------------------------------------------------------------------
// 7. Moteur principal
// ---------------------------------------------------------------------------

const alerte = (niveau, code, message) => ({ niveau, code, message });

/**
 * Dimensionne une installation solaire selon la méthodologie v2.
 *
 * @param {object} entrees
 * @param {Array}  entrees.equipements   charges (voir normaliserEquipement)
 * @param {object} entrees.site          { nom, productibleMensuel[12], source, inclinaison, azimut }
 * @param {'mois-defavorable'|'moyenne-annuelle'} [entrees.strategieIrradiation]
 * @param {'nuit'|'journee-complete'} [entrees.baseAutonomie]
 * @param {number} [entrees.coefficientSimultaneite]
 * @param {number} [entrees.puissanceSimultaneeImposee] pointe des charges saisie directement
 * @param {number} [entrees.tensionSysteme]
 * @param {number} [entrees.joursAutonomie]
 * @param {number} [entrees.hsp]         repli si aucun productible mensuel
 * @param {object} [entrees.distances]   { pvOnduleurM, batterieOnduleurM, onduleurTableauM }
 * @param {object} [entrees.materiel]    { panneau, onduleur, batterie, catalogueOnduleurs, nbPanneauxImpose }
 * @param {object} [entrees.pertes]      surcharges de rendement
 * @returns {object} résultats complets + alertes
 */
export function dimensionner(entrees = {}) {
  const alertes = [];
  const {
    equipements = [],
    site = {},
    strategieIrradiation = 'mois-defavorable',
    baseAutonomie = 'nuit',
    coefficientSimultaneite = DEFAUTS.coefficientSimultaneite,
    tensionSysteme = DEFAUTS.tensionSysteme,
    joursAutonomie = DEFAUTS.joursAutonomie,
    hsp = null,
    distances = {},
    materiel = {},
    pertes = {},
    dod: dodEntree,
    puissanceSimultaneeImposee = null,
  } = entrees;

  // --- 1. Consommation ---
  const consommation = bilanConsommation(equipements, { coefficientSimultaneite, puissanceSimultaneeImposee });
  if (consommation.repartitionAVerifier) {
    alertes.push(alerte('important', 'repartition-jour-nuit',
      'Des charges ont été reprises d’un dimensionnement antérieur sans répartition jour / nuit : leurs heures ont été affectées à la journée. Vérifiez la répartition avant de valider.'));
  }
  if (consommation.totalKwh <= 0) {
    alertes.push(alerte('bloquant', 'aucune-consommation', 'Aucune consommation saisie : le dimensionnement est impossible.'));
  }

  // --- 2. Irradiation ---
  const irradiation = irradiationDeDimensionnement(site, strategieIrradiation, hsp);
  if (!irradiation.productible) {
    alertes.push(alerte('bloquant', 'irradiation-absente',
      'Aucune donnée d’irradiation pour ce site : renseignez le productible mensuel PVGIS ou un ensoleillement de repli.'));
  } else if (!irradiation.complet) {
    alertes.push(alerte('important', 'irradiation-annuelle',
      'Productible mensuel PVGIS absent pour ce site : le calcul repose sur une moyenne, sans garantie en saison des pluies.'));
  } else if (irradiation.strategie === 'moyenne-annuelle') {
    alertes.push(alerte('important', 'strategie-moyenne',
      `Stratégie « moyenne annuelle » retenue : en ${irradiation.moisNom}, le productible descend à ${fmt.productible(irradiation.productibleMin)}, soit un déficit de production attendu.`));
  }

  // --- 3. Rendements de chaîne ---
  const rendements = chaineRendement({ methode: irradiation.methode, pertes });

  // --- 4. Énergie à produire : les deux flux corrigés SÉPARÉMENT ---
  const jourAProduire = rendements.etaJour > 0 ? consommation.jourKwh / rendements.etaJour : 0;
  const nuitAProduire = rendements.etaNuit > 0 ? consommation.nuitKwh / rendements.etaNuit : 0;
  const totalAProduire = jourAProduire + nuitAProduire;
  const energie = {
    jourAProduire: Number(jourAProduire.toFixed(3)),
    nuitAProduire: Number(nuitAProduire.toFixed(3)),
    totalAProduire: Number(totalAProduire.toFixed(3)),
    detail: `${LIBELLES.consommationJour} ${fmt.kwhJour(consommation.jourKwh)} ÷ ${fmt.pct(rendements.etaJour)} = ${fmt.kwhJour(jourAProduire)} · ${LIBELLES.consommationNuit} ${fmt.kwhJour(consommation.nuitKwh)} ÷ ${fmt.pct(rendements.etaNuit)} = ${fmt.kwhJour(nuitAProduire)}`,
  };

  // --- 5. Champ PV : minimum calculé, puis installé (justifié) ---
  const puissanceMinW = irradiation.productible > 0 ? (totalAProduire / irradiation.productible) * 1000 : 0;
  const panneauWc = nb(materiel.panneau?.puissanceWc ?? materiel.panneau?.power, 0);
  const nbCalcule = panneauWc > 0 ? Math.ceil(puissanceMinW / panneauWc) : 0;
  const nbPanneaux = Math.max(0, Math.round(nb(materiel.nbPanneauxImpose, nbCalcule)));
  const pvInstalleW = nbPanneaux * panneauWc;
  const ecartPct = puissanceMinW > 0 ? ((pvInstalleW - puissanceMinW) / puissanceMinW) * 100 : 0;

  const raisonEcart = materiel.nbPanneauxImpose
    ? `${materiel.kitNom ? `kit standard « ${materiel.kitNom} »` : 'configuration matérielle imposée'} : ${nbPanneaux} panneaux de ${fmt.w(panneauWc)}`
    : `arrondi au panneau entier supérieur (${nbPanneaux} × ${fmt.w(panneauWc)})`;
  const pv = {
    puissanceMinW: Math.round(puissanceMinW),
    puissanceInstalleeW: pvInstalleW,
    nbPanneaux,
    nbPanneauxCalcule: nbCalcule,
    panneauWc,
    ecartPct: Number(ecartPct.toFixed(1)),
    justification: puissanceMinW > 0
      ? `Puissance minimale calculée ${fmt.kwc(puissanceMinW)} → puissance installée ${fmt.kwc(pvInstalleW)} (${raisonEcart}), soit un écart de ${ecartPct >= 0 ? '+' : ''}${fmt.pctPoints(ecartPct, 0)}. L’écart provient du pas du matériel disponible, non d’un coefficient de sécurité supplémentaire.`
      : 'Puissance PV non calculable (irradiation ou consommation manquante).',
  };
  if (pv.ecartPct < -5) {
    alertes.push(alerte('important', 'pv-insuffisant',
      `Le champ PV installé (${fmt.kwc(pvInstalleW)}) est inférieur de ${fmt.pctPoints(Math.abs(pv.ecartPct), 0)} au minimum calculé (${fmt.kwc(puissanceMinW)}) : la production ne couvrira pas les besoins au mois le plus défavorable.`));
  } else if (pv.ecartPct > 40) {
    alertes.push(alerte('info', 'pv-surdimensionne',
      `Le champ PV installé dépasse de ${fmt.pctPoints(pv.ecartPct, 0)} le minimum calculé : surdimensionnement lié au pas du matériel (marge de production, pas une erreur).`));
  }

  // --- 6. Onduleur (piloté par les CHARGES ; le PV ne fait que filtrer) ---
  // Choisi avant la batterie : son courant de charge conditionne le C-rate du parc.
  const onduleur = choisirOnduleur({
    puissanceSimultanee: consommation.puissanceSimultanee,
    puissanceAppelDemarrage: consommation.puissanceAppelDemarrage,
    pvInstalleWc: pvInstalleW,
    catalogue: materiel.catalogueOnduleurs || (materiel.onduleur ? [materiel.onduleur] : []),
  });
  if ((materiel.catalogueOnduleurs?.length || materiel.onduleur) && !onduleur.suffisant) {
    alertes.push(alerte('bloquant', 'onduleur-insuffisant',
      `Aucun onduleur disponible ne couvre ${fmt.w(onduleur.puissanceContinueRequiseW)} en continu et ${fmt.w(onduleur.surgeRequisW)} au démarrage. Réduisez les charges simultanées ou retenez un modèle de puissance supérieure.`));
  }
  if (onduleur.pvCompatible === false) {
    alertes.push(alerte('important', 'pv-max-depasse',
      `Le champ PV installé (${fmt.kwc(pvInstalleW)}) dépasse l’entrée PV maximale de l’onduleur retenu (${fmt.kwc(onduleur.retenu.pvMaxWc)}). Répartissez le champ sur plusieurs MPPT ou retenez un onduleur à entrée PV supérieure — le calibre de puissance reste dicté par les charges.`));
  }

  // --- 7. Batterie ---
  const dod = nb(dodEntree ?? materiel.batterie?.dod, DEFAUTS.dod);
  const rendementDecharge = nb(materiel.batterie?.rendement, DEFAUTS.rendementBatterieDecharge);
  const baseKwh = baseAutonomie === 'journee-complete' ? consommation.totalKwh : consommation.nuitKwh;
  const capaciteUtile = baseKwh * nb(joursAutonomie, 1);
  const capaciteBrute = dod > 0 && rendementDecharge > 0 ? capaciteUtile / (dod * rendementDecharge) : 0;
  const capaciteAh = tensionSysteme > 0 ? (capaciteBrute * 1000) / tensionSysteme : 0;

  const moduleKwh = nb(materiel.batterie?.capaciteKwh);
  const nbModules = moduleKwh > 0 ? Math.max(1, Math.ceil(capaciteBrute / moduleKwh)) : 0;
  const capaciteInstalleeKwh = nbModules * moduleKwh;
  const capaciteInstalleeAh = tensionSysteme > 0 ? (capaciteInstalleeKwh * 1000) / tensionSysteme : 0;

  const iChargeMax = nb(onduleur.retenu?.iChargeMax ?? materiel.onduleur?.iChargeMax);
  const cRateMax = nb(materiel.batterie?.cRateChargeMax, 0.5);
  const tauxChargeC = capaciteInstalleeAh > 0 && iChargeMax > 0 ? iChargeMax / capaciteInstalleeAh : null;

  const batterie = {
    baseAutonomie,
    baseKwh: Number(baseKwh.toFixed(3)),
    joursAutonomie: nb(joursAutonomie, 1),
    dod,
    rendementDecharge,
    tension: tensionSysteme,
    capaciteUtileKwh: Number(capaciteUtile.toFixed(2)),
    capaciteBruteKwh: Number(capaciteBrute.toFixed(2)),
    capaciteAh: Math.round(capaciteAh),
    nbModules,
    moduleKwh,
    capaciteInstalleeKwh: Number(capaciteInstalleeKwh.toFixed(2)),
    capaciteInstalleeAh: Math.round(capaciteInstalleeAh),
    tauxChargeC: tauxChargeC != null ? Number(tauxChargeC.toFixed(2)) : null,
    cRateChargeMax: cRateMax,
    formule: `Capacité brute = ${baseAutonomie === 'journee-complete' ? 'consommation journalière complète' : 'consommation nocturne'} × jours d’autonomie ÷ (DoD × rendement de décharge) = ${fmt.kwh(baseKwh)} × ${nb(joursAutonomie, 1)} ÷ (${fmt.pct(dod, 0)} × ${fmt.pct(rendementDecharge, 1)}) = ${fmt.kwh(capaciteBrute)}`,
    // Parc de plusieurs modules en parallèle : le câblage doit être symétrique.
    consigneCablage: nbModules > 1
      ? `Parc de ${nbModules} modules en parallèle : câblage en diagonale obligatoire (positif prélevé sur le premier module, négatif sur le dernier), avec des câbles de longueurs strictement égales. Un câblage asymétrique déséquilibre les courants et vieillit prématurément les modules les plus sollicités.`
      : null,
  };
  if (tauxChargeC != null && tauxChargeC > cRateMax) {
    alertes.push(alerte('important', 'c-rate-depasse',
      `Le courant de charge de l’onduleur (${fmt.a(iChargeMax)}) impose ${fmt.cRate(tauxChargeC)} au parc batterie, au-delà du maximum admissible (${fmt.cRate(cRateMax)}). Limitez le courant de charge dans les réglages de l’onduleur ou ajoutez un module.`));
  }
  if (baseAutonomie === 'journee-complete' && consommation.jourKwh > 0) {
    alertes.push(alerte('info', 'autonomie-journee',
      'Base d’autonomie « journée complète » : le parc batterie couvre aussi la consommation diurne (site réellement isolé). Le coût du stockage est sensiblement plus élevé qu’en base « nuit seule ».'));
  }

  // --- 8. Vérifications strings / MPPT ---
  // Si aucun onduleur ne couvre les charges, on vérifie tout de même la
  // configuration du champ sur le plus gros modèle disponible : le problème de
  // strings doit être signalé, pas masqué par l'absence d'onduleur retenu.
  const catalogueOnd = materiel.catalogueOnduleurs || [];
  const onduleurVerif = onduleur.retenu
    || materiel.onduleur
    || [...catalogueOnd].sort((a, b) => nb(b.puissanceW) - nb(a.puissanceW))[0]
    || {};
  const strings = configurationStrings({
    nbPanneaux, panneau: materiel.panneau || {}, onduleur: onduleurVerif,
  });
  if (strings.possible === false) {
    alertes.push(alerte('bloquant', 'strings-impossible',
      strings.raison === 'plage-serie-vide'
        ? `Aucune configuration série possible : la plage admissible de l’onduleur (${fmt.v(strings.vMpptMinV)} – ${fmt.v(strings.vDcMaxV)}) est incompatible avec ce module. Changez d’onduleur ou de panneau.`
        : `${nbPanneaux} panneaux ne peuvent pas être répartis en strings égaux dans la plage admissible (${strings.serieMin} à ${strings.serieMax} modules en série). Ajustez le nombre de panneaux ou l’onduleur.`));
  } else if (strings.courantOk === false) {
    alertes.push(alerte('important', 'courant-mppt-depasse',
      `Le courant d’entrée par MPPT (${fmt.a(strings.courantStringA)}) dépasse le maximum de l’onduleur (${fmt.a(strings.iMpptA)}). Réduisez le nombre de strings en parallèle par MPPT.`));
  } else if (strings.possible === null) {
    alertes.push(alerte('info', 'specs-manquantes',
      'Caractéristiques électriques du panneau ou de l’onduleur incomplètes (Voc, Vmp, Vdc max, plage MPPT) : les vérifications de compatibilité string/MPPT n’ont pas pu être faites.'));
  }

  // --- 9. Câblage ---
  const courantPv = strings.courantStringA || (panneauWc && nb(materiel.panneau?.imp) ? nb(materiel.panneau.imp) : 0);
  const courantBatterie = onduleur.retenu?.puissanceW && tensionSysteme
    ? onduleur.retenu.puissanceW / (0.95 * tensionSysteme)
    : (iChargeMax || 0);
  const courantAc = onduleur.retenu?.puissanceW ? onduleur.retenu.puissanceW / DEFAUTS.tensionAC : 0;

  const cables = [
    {
      liaison: 'Champ PV → onduleur',
      ...sectionCable({
        longueurM: nb(distances.pvOnduleurM), courantA: courantPv,
        tensionV: strings.vmpStringV || tensionSysteme, chutePct: DEFAUTS.chuteAdmissible.pv,
        // Plancher d'usage sur les liaisons de string (câble PV souple 4 mm²).
        sectionMinimale: 4,
      }),
    },
    {
      liaison: 'Parc batterie → onduleur',
      ...sectionCable({
        longueurM: nb(distances.batterieOnduleurM), courantA: courantBatterie,
        tensionV: tensionSysteme, chutePct: DEFAUTS.chuteAdmissible.batterie,
      }),
    },
    {
      liaison: 'Onduleur → tableau de distribution',
      ...sectionCable({
        longueurM: nb(distances.onduleurTableauM), courantA: courantAc,
        tensionV: DEFAUTS.tensionAC, chutePct: DEFAUTS.chuteAdmissible.ac,
      }),
    },
  ];

  // --- 10. Matériel (désignations techniques, sans marque) ---
  const materielListe = [
    ...(nbPanneaux ? [{ ref: `Panneau photovoltaïque ${fmt.num(panneauWc)} Wc`, qty: nbPanneaux }] : []),
    ...(onduleur.retenu ? [{
      ref: `Onduleur hybride ${fmt.num(onduleur.retenu.puissanceW / 1000, onduleur.retenu.puissanceW % 1000 ? 1 : 0)} kVA — ${tensionSysteme} V`,
      qty: 1,
    }] : []),
    ...(nbModules ? [{
      ref: `Batterie lithium ${tensionSysteme} V ${fmt.num(Math.round((moduleKwh * 1000) / tensionSysteme))} Ah (${fmt.num(moduleKwh, moduleKwh % 1 ? 1 : 0)} kWh)`,
      qty: nbModules,
    }] : []),
    ...cables.filter((c) => c.sectionMm2).map((c) => ({
      ref: `Câble cuivre ${fmt.mm2(c.sectionMm2)} — ${c.liaison.toLowerCase()}`,
      qty: Math.max(1, Math.ceil(c.longueurM * 2)),
      unite: 'm',
    })),
    ...(nbPanneaux ? [{ ref: 'Structure de montage', qty: Math.max(1, Math.ceil(nbPanneaux / 10)) }] : []),
    { ref: 'Coffret de protection DC/AC', qty: 1 },
  ];

  // --- 11. Production estimée ---
  const productibleAnnuel = irradiation.complet && Array.isArray(site.productibleMensuel)
    ? site.productibleMensuel.reduce((s, v) => s + nb(v) * 30.4, 0)
    : irradiation.productible * 365;
  const productionAnnuelle = (pvInstalleW / 1000) * productibleAnnuel * rendements.etaJour;
  const production = {
    annuelleKwh: Math.round(productionAnnuelle),
    productibleAnnuel: Number(productibleAnnuel.toFixed(1)),
    mention: irradiation.complet
      ? `Production estimée à partir du productible mensuel ${irradiation.source} du site, rendement de chaîne appliqué. Valeur moyenne annuelle : la production réelle varie de ${fmt.productible(irradiation.productibleMin)} en ${irradiation.moisNom} à ${fmt.productible(Math.max(...site.productibleMensuel.map((v) => nb(v))))} au mois le plus favorable. Estimation indicative, hors ombrages locaux.`
      : `Production estimée à partir d’un ensoleillement moyen, sans profil mensuel : marge d’incertitude élevée. Estimation indicative, hors ombrages locaux.`,
  };

  return {
    moteurVersion: 'v2',
    consommation,
    irradiation,
    rendements,
    energie,
    pv,
    batterie,
    onduleur,
    verifications: { strings, batterie: { tauxChargeC: batterie.tauxChargeC, cRateMax } },
    cables,
    materiel: materielListe,
    production,
    alertes,
    bloquant: alertes.some((a) => a.niveau === 'bloquant'),
  };
}

/** Alertes bloquantes d'un résultat de dimensionnement (devis interdit). */
export const alertesBloquantes = (resultat) => (resultat?.alertes || []).filter((a) => a.niveau === 'bloquant');
