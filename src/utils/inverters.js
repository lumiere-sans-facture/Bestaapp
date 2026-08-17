// Onduleurs : logique pure de saisie et de validation. Même esprit que
// utils/kits.js — normalisation d'un brouillon de formulaire, contrôle de
// validité, rien qui dépende de React.

/** Un onduleur vierge, prêt pour le formulaire de création. */
export const nouvelOnduleur = () => ({
  id: crypto.randomUUID(),
  brand: '', model: '', capacity: '', maxPvPower: '', price: '', efficiency: '',
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
  o.maxPvPower ? `PV max ${o.maxPvPower} Wc` : null,
  o.efficiency ? `rendement ${o.efficiency}%` : null,
].filter(Boolean).join(' · ');

/** Copie d'un onduleur, nouvel identifiant et modèle suffixé. */
export const dupliquerOnduleur = (o) => ({
  ...o,
  id: crypto.randomUUID(),
  model: `${o.model} (copie)`,
});
