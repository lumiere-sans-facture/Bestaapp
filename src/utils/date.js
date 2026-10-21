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

// ---- Jours calendaires « AAAA-MM-JJ » (échéances, dates de paiement) ----
// Une échéance est un JOUR, pas un instant : stockée en texte « AAAA-MM-JJ »,
// elle se compare telle quelle et ne glisse jamais d'un jour à cause du
// fuseau (ce que ferait `toISOString().slice(0, 10)` le soir, en UTC+1).
const deux = (n) => String(n).padStart(2, '0');
const enDateLocale = (jour) => {
  const [a, m, j] = String(jour).split('-').map(Number);
  return new Date(a, (m || 1) - 1, j || 1);
};

/** Jour calendaire LOCAL d'une date (par défaut : aujourd'hui), « AAAA-MM-JJ ». */
export const jourLocal = (d = new Date()) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${deux(x.getMonth() + 1)}-${deux(x.getDate())}`;
};

/** Jour décalé de `n` jours (négatif pour reculer), « AAAA-MM-JJ ». */
export const decalerJour = (jour, n) => {
  const d = enDateLocale(jour);
  d.setDate(d.getDate() + n);
  return jourLocal(d);
};

/** Nombre de jours de `a` à `b` (positif si `b` est après `a`). */
export const joursEntre = (a, b) => {
  const [ya, ma, ja] = String(a).split('-').map(Number);
  const [yb, mb, jb] = String(b).split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, jb) - Date.UTC(ya, ma - 1, ja)) / DAY_MS);
};

/** « AAAA-MM-JJ » → « JJ/MM/AAAA » (vide si absent). */
export const jourFr = (jour) => {
  if (!jour) return '';
  const [a, m, j] = String(jour).split('-');
  return `${j}/${m}/${a}`;
};
