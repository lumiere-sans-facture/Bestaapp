// Saisie d'un nombre dans un champ — logique pure, sans React.
//
// Un champ numérique doit pouvoir être VIDÉ pour retaper un autre nombre.
// Plusieurs écrans convertissaient la saisie à chaque frappe
// (`Math.max(1, Number(valeur) || 1)`) : le champ vidé redevenait aussitôt
// « 1 » ou « 0 », impossible d'effacer le dernier chiffre. Ici, une saisie
// vide ou incomplète ne donne AUCUN nombre : la valeur précédente reste en
// vigueur jusqu'à ce qu'un nombre soit tapé (components/ChampNombre.jsx).

/**
 * Nombre lu dans ce qui est tapé, ou null s'il n'y en a pas (champ vide, « - », « 4. » incomplet).
 * @param {string} texte
 * @param {object} [o]
 * @param {number} [o.min]     plancher (une quantité ne descend pas sous 1)
 * @param {number} [o.max]     plafond
 * @param {boolean} [o.arrondi] nombre entier (montants en F CFA)
 */
export function nombreSaisi(texte, { min = -Infinity, max = Infinity, arrondi = false } = {}) {
  const t = String(texte ?? '').trim().replace(',', '.');
  if (!t || !/\d/.test(t) || /[.]$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const v = arrondi ? Math.round(n) : n;
  return Math.min(Number(max), Math.max(Number(min), v));
}
