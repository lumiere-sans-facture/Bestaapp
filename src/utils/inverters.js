// Onduleurs : logique pure de saisie et de validation. Même esprit que
// utils/kits.js — normalisation d'un brouillon de formulaire, contrôle de
// validité, rien qui dépende de React.
import { lireTension, libelleTension, tensionOnduleur } from './tension';
import { lireElectrique } from './chainesPv';

// ---- Mise en parallèle ----
// Certains onduleurs se couplent en parallèle (sorties et entrées PV
// s'additionnent), d'autres non : c'est une donnée du constructeur, saisie
// dans « Plus › Onduleurs » avec le nombre maximal d'appareils accepté.
// Un onduleur enregistré avant ce réglage garde l'ancienne règle : deux
// appareils au plus.
export const PARALLELE_PAR_DEFAUT = 2;
// Borne de saisie : au-delà, l'installation se chiffre sur place.
export const PARALLELE_MAX_SAISIE = 12;

/** Nombre maximal d'exemplaires de cet onduleur montables ensemble (≥ 1). */
export const maxEnParallele = (onduleur) => {
  if (!onduleur) return 1;
  if (onduleur.parallele === false) return 1;
  const n = Math.floor(Number(onduleur.maxParallele));
  if (!Number.isFinite(n) || n < 2) return PARALLELE_PAR_DEFAUT;
  return Math.min(n, PARALLELE_MAX_SAISIE);
};

// ---- Phases : monophasé ou triphasé ----
// Le réglage « Phases » de Plus › Onduleurs fait foi ; à défaut, la
// désignation : « triphasé », un onduleur PCS, ou le suffixe Deye « P3 »
// (SUN-30K-SG02HP3, SUN-12K-SG04LP3…). Sans indice : inconnu (null), traité
// comme monophasé — on ne propose jamais en triphasé un modèle non confirmé.
const RE_TRIPHASE = /triphas|\bPCS\b|[a-z]P3\b/i;

/** 3 (triphasé), 1 (monophasé) ou null (non renseigné). */
export const phasesOnduleur = (onduleur) => {
  if (!onduleur) return null;
  if (Number(onduleur.electrique?.phases) === 3) return 3;
  if (RE_TRIPHASE.test(`${onduleur.brand || ''} ${onduleur.model || ''} ${onduleur.designation || ''}`)) return 3;
  return onduleur.electrique ? 1 : null;
};

/** Onduleur triphasé confirmé ? */
export const estTriphase = (onduleur) => phasesOnduleur(onduleur) === 3;

// ---- Caractéristiques électriques de l'entrée PV ----
// Facultatives : elles permettent de calculer les chaînes d'un kit étendu
// (utils/chainesPv.js). Sans elles, l'assistant le signale au lieu de
// supposer — voir data/inverters.js pour le sens de chaque champ.
// `essentiel` : les deux valeurs qui suffisent au calcul des chaînes.
export const CHAMPS_ELECTRIQUES = [
  { cle: 'vocMax', libelle: 'Tension DC max (V)', essentiel: true },
  { cle: 'nbMppt', libelle: 'Nombre de MPPT', essentiel: true },
  { cle: 'mpptMin', libelle: 'Plage MPPT min (V)' },
  { cle: 'mpptMax', libelle: 'Plage MPPT max (V)' },
  { cle: 'chainesParMppt', libelle: 'Chaînes par MPPT' },
  { cle: 'iMaxMppt', libelle: 'Courant max par MPPT (A)' },
  { cle: 'iscMaxMppt', libelle: 'Courant de court-circuit max par MPPT (A)' },
];

/** Brouillon → caractéristiques électriques (null si rien n'est saisi). */
const normaliserElectrique = (e) => {
  if (!e) return null;
  const sortie = {};
  let saisi = false;
  for (const { cle } of CHAMPS_ELECTRIQUES) {
    const v = String(e[cle] ?? '').trim();
    if (v !== '') saisi = true;
    sortie[cle] = nombre(v);
  }
  sortie.phases = Number(e.phases) === 3 ? 3 : 1;
  // « Triphasé » choisi seul compte comme une saisie : sinon le réglage se
  // perdait faute d'autre valeur électrique renseignée.
  return saisi || sortie.phases === 3 ? sortie : null;
};

/**
 * Ce qui manque encore pour calculer les chaînes d'un onduleur : la tension
 * DC max et/ou le nombre de MPPT (libellés courts, liste vide si complet).
 */
export const electriqueManquante = (onduleur) => {
  const e = onduleur?.electrique || {};
  const manque = [];
  if (!(Number(e.vocMax) > 0)) manque.push('tension max');
  if (!(Number(e.nbMppt) >= 1)) manque.push('nombre de MPPT');
  return manque;
};

/**
 * Migration : les onduleurs officiels enregistrés avant l'existence du champ
 * reçoivent leurs caractéristiques électriques (même identifiant). Un
 * onduleur qui porte déjà le champ — même vidé — n'est pas touché. Renvoie
 * la liste d'origine si rien ne change.
 */
export const completerElectrique = (liste = [], reference = []) => {
  if (!Array.isArray(liste)) return liste;
  const parId = new Map((reference || []).filter((r) => r.electrique).map((r) => [r.id, r.electrique]));
  let change = false;
  const suite = liste.map((o) => {
    if (!o || Object.prototype.hasOwnProperty.call(o, 'electrique')) return o;
    const e = parId.get(o.id);
    if (!e) return o;
    change = true;
    return { ...o, electrique: { ...e } };
  });
  return change ? suite : liste;
};

/** Un onduleur vierge, prêt pour le formulaire de création. */
export const nouvelOnduleur = () => ({
  id: crypto.randomUUID(),
  brand: '', model: '', capacity: '', maxPvPower: '', price: '', efficiency: '', tension: '',
  parallele: true, maxParallele: PARALLELE_PAR_DEFAUT, electrique: null,
});

const nombre = (v, defaut = 0) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : defaut;
};

/** Transforme un brouillon de formulaire (champs texte) en onduleur exploitable. */
export const normaliserOnduleur = (brouillon) => ({
  ...brouillon,
  brand: (brouillon.brand || '').trim(),
  model: (brouillon.model || '').trim(),
  capacity: nombre(brouillon.capacity),
  maxPvPower: Math.round(nombre(brouillon.maxPvPower)),
  price: Math.round(nombre(brouillon.price)),
  efficiency: nombre(brouillon.efficiency),
  // 12, 24 ou 48 V — vide si non renseignée (voir utils/tension.js).
  tension: lireTension(brouillon.tension),
  // Mise en parallèle : oui/non, et combien d'appareils au plus (2 à 12).
  parallele: brouillon.parallele !== false && brouillon.parallele !== 'non',
  maxParallele: brouillon.parallele === false || brouillon.parallele === 'non'
    ? 1
    : maxEnParallele({ maxParallele: brouillon.maxParallele }),
  // Entrée PV : tension max, plage MPPT, courants (facultatif).
  electrique: normaliserElectrique(brouillon.electrique),
});

/**
 * Un onduleur est publiable s'il a un modèle, une capacité, un prix et une
 * puissance PV max — sans cette dernière il ne peut jamais être suggéré
 * (aucun moyen de savoir s'il encaisse les panneaux calculés).
 */
export const onduleurEstValide = (onduleur) => {
  const o = normaliserOnduleur(onduleur);
  return o.model !== '' && o.capacity > 0 && o.maxPvPower > 0 && o.price > 0;
};

/** Libellé technique court, affiché sous le nom dans les listes. */
export const resumeOnduleur = (o) => [
  o.capacity ? `${o.capacity} kVA` : null,
  libelleTension(tensionOnduleur(o)) || null,
  o.maxPvPower ? `PV max ${o.maxPvPower} Wc` : null,
  maxEnParallele(o) > 1 ? `parallèle ×${maxEnParallele(o)} max` : 'sans parallèle',
  lireElectrique(o) ? `${lireElectrique(o).nbMppt} MPPT · ${lireElectrique(o).vocMax} V DC max` : null,
  o.efficiency ? `rendement ${o.efficiency}%` : null,
].filter(Boolean).join(' · ');

/** Copie d'un onduleur, nouvel identifiant et modèle suffixé. */
export const dupliquerOnduleur = (o) => ({
  ...o,
  id: crypto.randomUUID(),
  model: `${o.model} (copie)`,
});
