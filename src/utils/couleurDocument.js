// Couleurs de marque des documents : un abonné Pro choisit librement ses deux
// couleurs, mais un document imprimé doit rester lisible — texte blanc posé sur
// la couleur primaire (en-têtes de tableaux), chiffre focal posé sur le papier
// blanc. Ces helpers assombrissent juste ce qu'il faut, et JAMAIS plus : une
// couleur déjà lisible ressort inchangée.
// Logique pure (aucun import) : testée unitairement, utilisable hors React.

const HEX = /^#[0-9a-fA-F]{6}$/;

const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = (rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

/** Luminance relative WCAG (0 noir → 1 blanc). */
const lumRel = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/** Rapport de contraste WCAG entre deux couleurs `#rrggbb` (1 → 21). */
export const contraste = (a, b) => {
  const [haut, bas] = [lumRel(hex2rgb(a)), lumRel(hex2rgb(b))].sort((x, y) => y - x);
  return (haut + 0.05) / (bas + 0.05);
};

/** Mélange vers le blanc : `part` = fraction de blanc (0 → couleur, 1 → blanc). */
export const melerVersBlanc = (couleur, part) =>
  (HEX.test(couleur) ? rgb2hex(hex2rgb(couleur).map((c) => c * (1 - part) + 255 * part)) : couleur);

/**
 * Assombrit `couleur` par pas de 4 % jusqu'à atteindre `minContraste` sur
 * `fond`. Une couleur qui satisfait déjà le seuil est rendue telle quelle.
 */
export function foncerJusqua(couleur, minContraste, fond = '#ffffff') {
  if (!HEX.test(couleur) || !HEX.test(fond)) return couleur;
  let rgb = hex2rgb(couleur);
  while (contraste(rgb2hex(rgb), fond) < minContraste && rgb.some((c) => c >= 1)) {
    rgb = rgb.map((c) => c * 0.96);
  }
  return rgb2hex(rgb);
}

// Seuils employés par les documents.
// - PRIMAIRE : porte du texte blanc (en-têtes de tableaux, filets) ET sert
//   d'encre sur blanc → 4,5:1 dans les deux sens (AA texte normal).
// - ACCENT : uniquement de gros chiffres sur blanc. Le seuil est calé juste
//   sous l'orange BestaSolar (2,0:1) pour ne RIEN changer à l'identité
//   existante, tout en rattrapant une couleur pâle qui disparaîtrait au tirage.
export const CONTRASTE_PRIMAIRE = 4.5;
export const CONTRASTE_ACCENT = 1.9;

/** Couple de couleurs prêt pour un document, lisibilité garantie. */
export const couleursLisibles = ({ primaire, secondaire }) => ({
  primaire: foncerJusqua(primaire, CONTRASTE_PRIMAIRE),
  accent: foncerJusqua(secondaire, CONTRASTE_ACCENT),
});
