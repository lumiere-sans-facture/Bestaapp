import { Plus, Trash2 } from 'lucide-react';
import { formatCFA } from '../utils/format';

/**
 * Éditeur de lignes de document (facture, devis, devis Pro) : une carte par
 * ligne, libellés visibles (plus de placeholders qui disparaissent à la
 * saisie), sous-total par ligne. Remplace le markup dupliqué .facture-ligne.
 *
 * `lignes` : [{ designation, qty, pu }]
 */
export default function LigneEditor({ lignes, onChange, onRemove, onAdd, addLabel = 'Ajouter une ligne' }) {
  return (
    <>
      {lignes.map((l, i) => (
        <div key={i} className="doc-line">
          <div className="doc-line-designation">
            <input
              className="input"
              placeholder="Désignation"
              aria-label="Désignation"
              value={l.designation}
              onChange={(e) => onChange(i, { designation: e.target.value })}
            />
          </div>
          {lignes.length > 1 && (
            <button type="button" className="cart-row-remove doc-line-remove" aria-label="Supprimer la ligne" onClick={() => onRemove(i)}>
              <Trash2 size={14} />
            </button>
          )}
          <div className="doc-line-fields">
            <label className="doc-line-field">
              Quantité
              <input className="input" type="number" min="1" value={l.qty} onChange={(e) => onChange(i, { qty: e.target.value })} />
            </label>
            <label className="doc-line-field">
              Prix unitaire (F CFA)
              <input className="input" type="number" min="0" value={l.pu} onChange={(e) => onChange(i, { pu: e.target.value })} />
            </label>
          </div>
          {Number(l.pu) > 0 && (
            <div className="doc-line-subtotal">Sous-total : {formatCFA((Math.max(1, Number(l.qty) || 1)) * Number(l.pu))}</div>
          )}
        </div>
      ))}
      <button type="button" className="btn btn-sm btn-outline facture-add-ligne" onClick={onAdd}>
        <Plus size={14} /> {addLabel}
      </button>
    </>
  );
}
