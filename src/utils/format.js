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
