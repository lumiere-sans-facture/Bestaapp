import { PanelTop, Battery, AlertTriangle, RotateCcw } from 'lucide-react';
import { formatCFA } from '../utils/format';

const nb = (v, d = 1) => Number(v || 0).toLocaleString('fr-FR', { maximumFractionDigits: d });

/** Une ligne réglable : libellé, boutons −/+ et ce que le nombre représente. */
function Pas({ icone: Icone, libelle, unite, valeur, moins, plus, onRegler, detail, limite, nom }) {
  return (
    <div className="reglage-kit-ligne">
      <div className="reglage-kit-tete">
        <span className="reglage-kit-libelle"><Icone size={15} /> {libelle}</span>
        <div className="qty-stepper">
          <button type="button" className="btn btn-sm btn-outline" disabled={moins == null}
            onClick={() => onRegler(moins)} aria-label={`Retirer ${nom}`}>−</button>
          <span className="qty-value" aria-live="polite">{valeur}</span>
          <button type="button" className="btn btn-sm btn-outline" disabled={plus == null}
            onClick={() => onRegler(plus)} aria-label={`Ajouter ${nom}`}>+</button>
        </div>
      </div>
      <div className="reglage-kit-detail">{unite} · {detail}</div>
      {limite && <div className="reglage-kit-limite">{limite}</div>}
    </div>
  );
}

/**
 * Réglage de la proposition de kit : panneaux et modules batterie, un à un,
 * avec recalcul en direct, dans l'assistant de devis. Branché sur la
 * proposition commune au Simulateur ROI (utils/propositionKit.js) : ce qui est
 * réglé ici part tel quel au devis.
 *
 * @param {object} proposition  résultat de proposerKit()
 * @param {(quoi:'panneaux'|'modules', valeur:number) => void} onRegler
 * @param {() => void} onReinitialiser  revient à la proposition automatique
 */
export default function ReglageKit({ proposition, onRegler, onReinitialiser }) {
  if (!proposition?.kit) return null;
  const { kit, panneaux: p, batterie: b, quotation: q, alertes = [] } = proposition;
  const hauteTension = !!kit.extensionBatterie;
  const onduleur = q?.inverterSuggested
    ? `${q.inverterSuggested.quantite > 1 ? `${q.inverterSuggested.quantite} × ` : ''}${q.inverterSuggested.capacity} kVA`
    : `${nb(kit.inverter)} kVA`;

  return (
    <div className="reglage-kit" aria-label="Ajuster la proposition">
      <div className="reglage-kit-titre">Ajuster la proposition</div>

      <Pas icone={PanelTop} libelle="Panneaux" nom="un panneau" valeur={p.poses}
        unite={`${nb(p.kwc, 2)} kWc`}
        detail={p.besoin ? `besoin : ${p.besoin} panneau${p.besoin > 1 ? 'x' : ''} de ${p.panelW} Wc` : `${p.panelW} Wc chacun`}
        moins={p.moins} plus={p.plus} onRegler={(v) => onRegler('panneaux', v)}
        limite={p.plus == null && p.poses > p.auto ? 'Maximum atteint : aucun onduleur du catalogue n’accepte un panneau de plus.' : null} />

      {b.modules != null && (
        <Pas icone={Battery} libelle="Modules batterie" nom="un module batterie" valeur={b.modules}
          unite={`${nb(b.capacite)} kWh (${nb(b.moduleKwh)} kWh par module)`}
          detail={`conseillé : ${nb(b.besoin)} kWh`}
          moins={b.moins} plus={b.plus} onRegler={(v) => onRegler('modules', v)}
          limite={b.plus == null
            ? `Maximum : ${b.max} module${b.max > 1 ? 's' : ''}${hauteTension ? ' (boîtier de contrôle)' : ' en parallèle — réglable dans Plus › Mes kits'}.`
            : null} />
      )}

      <div className="reglage-kit-resume">
        <div><span>Capacité</span><strong>{nb(b.capacite)} kWh</strong></div>
        <div><span>Autonomie</span><strong>{b.autonomieNuits != null ? `≈ ${nb(b.autonomieNuits)} nuit${b.autonomieNuits >= 2 ? 's' : ''}` : '—'}</strong></div>
        <div><span>Puissance</span><strong>{nb(p.kwc, 2)} kWc · {onduleur}</strong></div>
        <div><span>Prix</span><strong>{formatCFA(proposition.total)}</strong></div>
      </div>

      {alertes.map((a) => (
        <div key={a.type} className="storage-alert abo-alert is-warning reglage-kit-alerte" role="alert">
          <AlertTriangle size={14} /> <div>{a.texte}</div>
        </div>
      ))}

      {proposition.manuel && (
        <button type="button" className="btn btn-sm btn-outline reglage-kit-auto" onClick={onReinitialiser}>
          <RotateCcw size={14} /> Revenir à la proposition automatique
        </button>
      )}
    </div>
  );
}
