// Badge d'étape du pipeline : fond teinté à 13 % + texte de la même teinte
// assombri jusqu'au contraste AA (4.5:1). Remplace les styles inline
// `background: ${color}22; color: color` dupliqués, dont le texte était
// illisible (2,1–3,6:1 selon l'étape).

const lumRel = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contraste = (a, b) => {
  const [h, l] = [lumRel(a), lumRel(b)].sort((x, y) => y - x);
  return (h + 0.05) / (l + 0.05);
};
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = (rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

const cache = new Map();

/** Teinte de texte AA pour un fond `couleur` posé à 13 % sur blanc. */
export function encreDEtape(couleur) {
  if (cache.has(couleur)) return cache.get(couleur);
  let texte = hex2rgb(couleur);
  const fond = texte.map((c) => 0.133 * c + 0.867 * 255);
  while (contraste(texte, fond) < 4.6 && texte.some((c) => c > 0)) texte = texte.map((c) => c * 0.96);
  const hex = rgb2hex(texte);
  cache.set(couleur, hex);
  return hex;
}

/** Badge d'étape (couleur + libellé, jamais la couleur seule). */
export default function StageBadge({ stage, className = '' }) {
  if (!stage) return null;
  return (
    <span
      className={`badge ${className}`.trim()}
      style={{ background: `${stage.color}22`, color: encreDEtape(stage.color) }}
    >
      {stage.label}
    </span>
  );
}
