import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, Wand2 } from 'lucide-react';
import { formatCFA } from '../../../utils/format';
import { jourLocal } from '../../../utils/date';
import {
  MODELES_ECHEANCIER, TYPES_ECHEANCE, STATUTS_ECHEANCE, STATUT_ECHEANCE_BADGE,
  echeancierDepuisModele, nouvelleEcheance, totalEcheancier, repartirPaiements,
} from '../../../utils/echeancier';

/**
 * Éditeur d'échéancier de paiement : modèles prêts à l'emploi, lignes
 * modifiables (libellé, date / période / étape, montant, statut forcé),
 * réordonnables, et l'écart avec le total de la facture toujours en vue.
 * Calculs : utils/echeancier.js.
 * @param {object[]} echeancier
 * @param {(liste: object[]) => void} onChange
 * @param {number} total     total TTC de la facture
 * @param {string} [emission] jour d'émission « AAAA-MM-JJ » (dates des modèles)
 * @param {number} [paye]    déjà encaissé : affiche le statut de chaque échéance
 */
export default function EcheancierEditor({ echeancier = [], onChange, total = 0, emission = jourLocal(), paye = 0 }) {
  const [modele, setModele] = useState('trois-tranches');
  const [acomptePct, setAcomptePct] = useState(50);
  const lignes = repartirPaiements(echeancier, paye);
  const somme = totalEcheancier(echeancier);
  const ecart = Math.round(Number(total) || 0) - somme;

  const maj = (i, patch) => onChange(echeancier.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const deplacer = (i, sens) => {
    const j = i + sens;
    if (j < 0 || j >= echeancier.length) return;
    const copie = [...echeancier];
    [copie[i], copie[j]] = [copie[j], copie[i]];
    onChange(copie);
  };
  const appliquer = () => onChange(echeancierDepuisModele(modele, total, { emission, acomptePct }));
  const ajouter = () => onChange([...echeancier, nouvelleEcheance({
    libelle: `Échéance ${echeancier.length + 1}`, type: 'date', date: emission, montant: Math.max(0, ecart),
  })]);
  const ajusterDerniere = () => {
    if (!echeancier.length) return;
    const i = echeancier.length - 1;
    maj(i, { montant: Math.max(0, (Number(echeancier[i].montant) || 0) + ecart) });
  };

  return (
    <div className="echeancier-editor">
      <div className="echeancier-modele">
        <label className="doc-line-field">
          Modèle d’échéancier
          <select className="input" value={modele} onChange={(e) => setModele(e.target.value)}>
            {MODELES_ECHEANCIER.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        {modele === 'acompte-solde' && (
          <label className="doc-line-field">
            Acompte (%)
            <input className="input" type="number" min="1" max="99" value={acomptePct} onChange={(e) => setAcomptePct(e.target.value)} />
          </label>
        )}
        <button type="button" className="btn btn-sm btn-outline" onClick={appliquer} disabled={!(Number(total) > 0)}>
          <Wand2 size={15} /> {echeancier.length ? 'Remplacer par ce modèle' : 'Appliquer'}
        </button>
      </div>
      <div className="field-hint">{MODELES_ECHEANCIER.find((m) => m.id === modele)?.description}</div>

      {lignes.map((e, i) => (
        <div key={e.id} className="doc-line echeance-ligne">
          <div className="doc-line-designation">
            <input className="input" aria-label={`Libellé de l’échéance ${i + 1}`} value={e.libelle}
              placeholder="Ex. Acompte" onChange={(ev) => maj(i, { libelle: ev.target.value })} />
            <button type="button" className="cart-row-remove doc-line-remove" aria-label={`Supprimer l’échéance ${i + 1}`}
              onClick={() => onChange(echeancier.filter((_, j) => j !== i))}>
              <Trash2 size={16} />
            </button>
          </div>
          <div className="doc-line-fields">
            <label className="doc-line-field">
              Quand
              <select className="input" value={e.type} onChange={(ev) => maj(i, { type: ev.target.value, date: e.date || emission })}>
                {TYPES_ECHEANCE.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label className="doc-line-field">
              Montant (F CFA)
              <input className="input" type="number" min="0" value={e.montant}
                onChange={(ev) => maj(i, { montant: Math.max(0, Math.round(Number(ev.target.value) || 0)) })} />
            </label>
            {e.type === 'date' && (
              <label className="doc-line-field">
                Date
                <input className="input" type="date" value={e.date || ''} onChange={(ev) => maj(i, { date: ev.target.value || null })} />
              </label>
            )}
            {e.type === 'periode' && (
              <>
                <label className="doc-line-field">
                  Du
                  <input className="input" type="date" value={e.date || ''} onChange={(ev) => maj(i, { date: ev.target.value || null })} />
                </label>
                <label className="doc-line-field">
                  Au
                  <input className="input" type="date" value={e.dateFin || ''} min={e.date || undefined}
                    onChange={(ev) => maj(i, { dateFin: ev.target.value || null })} />
                </label>
              </>
            )}
            {e.type === 'condition' && (
              <label className="doc-line-field">
                Étape
                <input className="input" value={e.condition || ''} placeholder="Ex. À la mise en service"
                  onChange={(ev) => maj(i, { condition: ev.target.value })} />
              </label>
            )}
            <label className="doc-line-field">
              Statut
              <select className="input" value={e.statutForce || ''} onChange={(ev) => maj(i, { statutForce: ev.target.value || null })}>
                <option value="">Automatique</option>
                {Object.entries(STATUTS_ECHEANCE).map(([id, label]) => <option key={id} value={id}>{label} (forcé)</option>)}
              </select>
            </label>
          </div>
          <div className="echeance-pied">
            <span className={`flat-badge ${STATUT_ECHEANCE_BADGE[e.statut]}`}>{STATUTS_ECHEANCE[e.statut]}</span>
            {Number(total) > 0 && <span className="field-hint">{Math.round((e.montant / total) * 1000) / 10} % du total</span>}
            <span className="echeance-ordre">
              <button type="button" className="btn btn-sm btn-outline" aria-label={`Monter l’échéance ${i + 1}`} disabled={i === 0} onClick={() => deplacer(i, -1)}><ArrowUp size={14} /></button>
              <button type="button" className="btn btn-sm btn-outline" aria-label={`Descendre l’échéance ${i + 1}`} disabled={i === lignes.length - 1} onClick={() => deplacer(i, 1)}><ArrowDown size={14} /></button>
            </span>
          </div>
        </div>
      ))}

      <button type="button" className="btn btn-sm btn-outline facture-add-ligne" onClick={ajouter}>
        <Plus size={15} /> Ajouter une échéance
      </button>

      {echeancier.length > 0 && (
        <div className={`echeancier-total ${ecart ? 'ecart' : ''}`} role="status">
          <span>Échéancier : <strong>{formatCFA(somme)}</strong> sur {formatCFA(total)}</span>
          {ecart !== 0 && (
            <>
              <span className="field-error">
                {ecart > 0 ? `Il manque ${formatCFA(ecart)}` : `${formatCFA(-ecart)} de trop`} : l’échéancier doit égaler le total de la facture.
              </span>
              <button type="button" className="btn btn-sm btn-outline" onClick={ajusterDerniere}>Ajuster la dernière échéance</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
