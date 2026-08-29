/** Nombre entier groupé par espaces normales (« 1 250 000 »), sans unité.
 *  À utiliser partout au lieu de toLocaleString('fr-FR'), qui insère des
 *  espaces fines insécables (U+202F) — d'où des séparateurs différents
 *  d'un écran à l'autre. */
export const formatNombre = (v) =>
  Math.round(v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export const formatCFA = (amount) => formatNombre(amount) + ' F';

/**
 * Montant abrégé pour les grands nombres : « 108,4 M F », « 720 k F ».
 * Réservé aux TUILES d'indicateurs, où « 108 405 662 F » passe à la ligne et
 * devient illisible. Les tableaux et les documents gardent `formatCFA` : un
 * montant qu'on additionne ou qu'on facture ne s'arrondit jamais.
 */
export const formatCFACourt = (amount) => {
  const n = Math.round(Number(amount) || 0);
  const abs = Math.abs(n);
  if (abs < 100000) return formatCFA(n);
  const [valeur, unite] = abs >= 1000000 ? [n / 1000000, 'M'] : [n / 1000, 'k'];
  // Une décimale, jamais deux : « 2,5 M » arrondi à « 3 M » perdrait un demi
  // million, et « 2,53 M » ne se lit pas d'un coup d'œil sur une tuile. Le
  // « ,0 » d'un compte rond est retiré (« 720 k », pas « 720,0 k »).
  const arrondi = Math.round(valeur * 10) / 10;
  return `${String(arrondi).replace('.', ',')} ${unite} F`;
};

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
