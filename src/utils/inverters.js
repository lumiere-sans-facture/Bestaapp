// Onduleurs : logique pure de saisie et de validation. Même esprit que
// utils/kits.js — normalisation d'un brouillon de formulaire, contrôle de
// validité, rien qui dépende de React.
import { lireTension, libelleTension, tensionOnduleur } from './tension';

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

/** Un onduleur vierge, prêt pour le formulaire de création. */
export const nouvelOnduleur = () => ({
  id: crypto.randomUUID(),
  brand: '', model: '', capacity: '', maxPvPower: '', price: '', efficiency: '', tension: '',
  parallele: true, maxParallele: PARALLELE_PAR_DEFAUT,
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
  o.efficiency ? `rendement ${o.efficiency}%` : null,
].filter(Boolean).join(' · ');

/** Copie d'un onduleur, nouvel identifiant et modèle suffixé. */
export const dupliquerOnduleur = (o) => ({
  ...o,
  id: crypto.randomUUID(),
  model: `${o.model} (copie)`,
});
