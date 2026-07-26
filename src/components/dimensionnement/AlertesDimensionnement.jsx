import { XCircle, AlertTriangle, Info } from 'lucide-react';

const STYLE = {
  bloquant: { cls: 'bloquant', Icon: XCircle, label: 'Bloquant' },
  important: { cls: 'important', Icon: AlertTriangle, label: 'Important' },
  info: { cls: 'info', Icon: Info, label: 'Information' },
};

const ORDRE = { bloquant: 0, important: 1, info: 2 };

/**
 * Alertes du moteur de dimensionnement, par niveau de gravité :
 * bloquant (rouge) → important (orange) → info (gris).
 * Une alerte bloquante interdit la génération du devis (voir le wizard).
 */
export default function AlertesDimensionnement({ alertes = [], compact = false }) {
  if (!alertes.length) return null;
  const triees = [...alertes].sort((a, b) => (ORDRE[a.niveau] ?? 9) - (ORDRE[b.niveau] ?? 9));

  return (
    <div className={`alertes-dim ${compact ? 'compact' : ''}`}>
      {triees.map((a, i) => {
        const { cls, Icon, label } = STYLE[a.niveau] || STYLE.info;
        return (
          <div key={`${a.code}-${i}`} className={`alerte-dim ${cls}`} role={a.niveau === 'bloquant' ? 'alert' : undefined}>
            <Icon size={16} className="alerte-dim-icon" />
            <div className="alerte-dim-corps">
              <span className="alerte-dim-niveau">{label}</span>
              <span className="alerte-dim-message">{a.message}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
