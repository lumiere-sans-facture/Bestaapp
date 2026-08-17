/** Nombre entier groupé par espaces normales (« 1 250 000 »), sans unité.
 *  À utiliser partout au lieu de toLocaleString('fr-FR'), qui insère des
 *  espaces fines insécables (U+202F) — d'où des séparateurs différents
 *  d'un écran à l'autre. */
export const formatNombre = (v) =>
  Math.round(v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export const formatCFA = (amount) => formatNombre(amount) + ' F';

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const initials = (name) =>
  name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

/**
 * Taux de commission en pourcentage lisible : 0.03 → « 3 % », 0.015 → « 1,5 % ».
 * Les libellés de l'interface DOIVENT passer par ici : écrits en dur, ils
 * mentiraient aux partenaires au premier changement de barème.
 */
export const formatTaux = (rate) =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format((Number(rate) || 0) * 100)} %`;
