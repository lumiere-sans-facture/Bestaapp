// Utilitaires de date partagés (fuseau local du navigateur).
// Centralise les helpers auparavant dupliqués dans les écrans et utilitaires.
export const DAY_MS = 86_400_000;

/** Vrai si `iso` tombe dans le même mois calendaire que `ref` (par défaut : maintenant). */
export const isSameMonth = (iso, ref = new Date()) => {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
};

/** Vrai si `iso` tombe dans l'année et le mois donnés (mois indexé à partir de 0). */
export const isInYearMonth = (iso, year, month) => {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === year && d.getMonth() === month;
};

/** Jours écoulés depuis `iso` jusqu'à `ref`, en valeur réelle (Infinity si `iso` absent). */
export const ageInDays = (iso, ref = new Date()) =>
  iso ? (ref - new Date(iso)) / DAY_MS : Infinity;

/** Jours entiers écoulés depuis `iso` jusqu'à maintenant. */
export const daysSince = (iso) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
