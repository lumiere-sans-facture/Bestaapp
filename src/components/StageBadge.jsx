// Badge d'étape du pipeline : fond teinté à 13 % + texte de la même teinte
// assombri jusqu'au contraste AA (4.5:1). Remplace les styles inline
// `background: ${color}22; color: color` dupliqués, dont le texte était
// illisible (2,1–3,6:1 selon l'étape).
import { foncerJusqua, melerVersBlanc } from '../utils/couleurDocument';

const cache = new Map();

/** Teinte de texte AA pour un fond `couleur` posé à 13 % sur blanc. */
export function encreDEtape(couleur) {
  if (cache.has(couleur)) return cache.get(couleur);
  const encre = foncerJusqua(couleur, 4.6, melerVersBlanc(couleur, 0.867));
  cache.set(couleur, encre);
  return encre;
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
