/**
 * Détail repliable « Pourquoi ? » sous une alerte d'onduleur de kit
 * (configuration impossible, caractéristiques incohérentes) : les étapes
 * essayées — onduleur du kit, en parallèle, autres modèles — et les onduleurs
 * de « Mes onduleurs » écartés d'office, chacun avec sa raison.
 * Calcul : utils/ajustementsKit.js (diagnostic) et utils/solarSizing.js
 * (onduleursEcartesPourKit). Aucune donnée client.
 */
export default function PourquoiOnduleur({ diagnostic = [], ecartes = [] }) {
  const essais = (diagnostic || []).filter((d) => d?.raisons?.length);
  // « Parallèle insuffisant » redit une étape essayée : inutile de la répéter.
  const autres = (ecartes || []).filter((e) => !(essais.length && e.type === 'parallele'));
  if (!essais.length && !autres.length) return null;
  return (
    <details className="pourquoi-onduleur">
      <summary>Pourquoi ?</summary>
      {essais.length > 0 && (
        <>
          <div className="pourquoi-titre">Onduleurs essayés</div>
          <ul>
            {essais.map((d, i) => (
              <li key={i}><strong>{d.quantite > 1 ? `${d.quantite} × ` : ''}{d.modele}</strong> : {d.raisons[0]}</li>
            ))}
          </ul>
        </>
      )}
      {autres.length > 0 && (
        <>
          <div className="pourquoi-titre">Onduleurs écartés</div>
          <ul>
            {autres.map((e, i) => (
              <li key={i}><strong>{e.designation}</strong> : {e.motif}</li>
            ))}
          </ul>
        </>
      )}
    </details>
  );
}
