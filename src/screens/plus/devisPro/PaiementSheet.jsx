import { useEffect, useRef, useState } from 'react';
import { Check, FileText, Loader2, Pencil, Send, Trash2, Wallet, X } from 'lucide-react';
import { formatCFA } from '../../../utils/format';
import { jourLocal, jourFr } from '../../../utils/date';
import { PAIEMENT_MODES } from '../../../utils/paiement';
import { STATUTS_ECHEANCE, STATUT_ECHEANCE_BADGE, quandEcheance, controlerPaiement } from '../../../utils/echeancier';
import { etatPaiementFacture, jourDuPaiement, libelleModePaiement as libelleMode } from '../../../utils/facturePaiements';
import Sheet from '../../../components/Sheet';
import Field from '../../../components/Field';

const formulaireVide = (montant) => ({ montant, date: jourLocal(), mode: 'momo', operateur: '', reference: '', note: '' });


/**
 * Paiements d'une facture : récapitulatif (total, payé, reste), échéancier
 * avec le statut de chaque échéance, saisie d'un paiement — pré-remplie avec
 * la prochaine échéance due —, historique modifiable.
 * Calculs : utils/facturePaiements.js et utils/echeancier.js.
 * @param {object} facture        facture AVEC ses paiements (contexte de données)
 * @param {string[]} [operateurs] opérateurs Mobile Money du pays de l'entreprise
 * @param {(p) => void} [onRecu]        reçu du paiement en PDF
 * @param {(p) => void} [onEnvoyerRecu] reçu envoyé au client (WhatsApp)
 */
export default function PaiementSheet({ open, onClose, facture, operateurs = [], onSubmit, onUpdate, onDelete, onRecu, onEnvoyerRecu, recuOccupe = () => false }) {
  const etat = facture ? etatPaiementFacture(facture) : null;
  const montantPropose = etat ? (etat.prochaine?.du || etat.reste) : 0;
  const [form, setForm] = useState(() => formulaireVide(montantPropose));
  const [enEdition, setEnEdition] = useState(null); // paiement modifié, sinon saisie d'un nouveau
  const [tropConfirme, setTropConfirme] = useState(false);
  const [aSupprimer, setASupprimer] = useState(null);

  useEffect(() => {
    if (!open || !facture) return;
    setForm(formulaireVide(montantPropose));
    setEnEdition(null);
    setTropConfirme(false);
    setASupprimer(null);
    // Réinitialise à l'ouverture seulement, pas à chaque nouveau paiement.
  }, [open, facture?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Après un enregistrement, la saisie suivante propose la nouvelle échéance
  // due — connue seulement une fois la facture mise à jour.
  const aPreRemplir = useRef(false);
  const dejaPaye = etat?.paye;
  useEffect(() => {
    if (!aPreRemplir.current) return;
    aPreRemplir.current = false;
    setForm(formulaireVide(montantPropose));
  }, [dejaPaye]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!facture || !etat) return null;

  // En modification, le paiement corrigé ne compte pas dans le « déjà payé ».
  const resteAvant = enEdition ? etat.reste + (Number(enEdition.montant) || 0) - etat.tropPercu : etat.reste;
  const controle = controlerPaiement(form.montant, resteAvant);
  const progression = etat.total > 0 ? Math.min(100, Math.round((etat.paye / etat.total) * 100)) : 0;

  const modifier = (p) => {
    setEnEdition(p);
    setForm({
      montant: p.montant, date: jourDuPaiement(p), mode: p.mode || 'momo',
      operateur: p.operateur || '', reference: p.reference || '', note: p.note || '',
    });
    setTropConfirme(false);
  };
  const annulerEdition = () => { setEnEdition(null); setForm(formulaireVide(montantPropose)); setTropConfirme(false); };

  const submit = (e) => {
    e.preventDefault();
    if (!controle.valide) return;
    if (controle.tropPercu > 0 && !tropConfirme) return;
    const donnees = {
      montant: Math.round(Number(form.montant) || 0),
      date: form.date || jourLocal(),
      mode: form.mode,
      operateur: form.mode === 'momo' ? form.operateur : '',
      reference: form.reference,
      note: form.note,
    };
    if (enEdition) onUpdate?.(enEdition.id, donnees);
    else onSubmit?.(donnees);
    setEnEdition(null);
    setTropConfirme(false);
    setForm(formulaireVide(''));
    aPreRemplir.current = true;
  };

  const paiements = [...(facture.paiements || [])].reverse(); // le plus récent d'abord

  return (
    <Sheet open={open} onClose={onClose} title={`Paiements — ${facture.numero}`}>
      <div className="devis-summary">
        <div className="devis-summary-row"><span>Total net à payer</span><span>{formatCFA(etat.total)}</span></div>
        <div className="devis-summary-row"><span>Déjà payé</span><span>{formatCFA(etat.paye)}</span></div>
        {etat.tropPercu > 0
          ? <div className="devis-summary-row total"><span>Trop-perçu</span><span>{formatCFA(etat.tropPercu)}</span></div>
          : <div className="devis-summary-row total"><span>Reste à payer</span><span>{formatCFA(etat.reste)}</span></div>}
        <div className="pay-progress" role="progressbar" aria-label="Part payée" aria-valuenow={progression} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${progression}%` }} />
        </div>
        <div className="field-hint">{progression} % payé</div>
      </div>

      {etat.lignes.length > 0 && (
        <div className="pay-echeancier">
          <div className="sheet-section-title">Échéancier</div>
          {etat.lignes.map((l) => (
            <div key={l.id} className="pay-echeance-row">
              <span className="pay-echeance-libelle">{l.libelle || 'Échéance'}<small>{quandEcheance(l)}</small></span>
              <span className="pay-echeance-montant">{formatCFA(l.montant)}</span>
              <span className={`flat-badge ${STATUT_ECHEANCE_BADGE[l.statut]}`}>{STATUTS_ECHEANCE[l.statut]}</span>
            </div>
          ))}
          {etat.ecart !== 0 && (
            <div className="field-error">L’échéancier ne correspond pas au total ({etat.ecart > 0 ? `il manque ${formatCFA(etat.ecart)}` : `${formatCFA(-etat.ecart)} de trop`}).</div>
          )}
        </div>
      )}

      {(etat.reste > 0 || enEdition) && facture.statut !== 'annulee' && (
        <form onSubmit={submit}>
          <div className="sheet-section-title">{enEdition ? 'Modifier le paiement' : 'Enregistrer un paiement'}</div>
          <Field label="Montant reçu (F CFA) *">
            <input className="input" type="number" min="1" required value={form.montant}
              onChange={(e) => { setForm({ ...form, montant: e.target.value }); setTropConfirme(false); }} />
          </Field>
          {!enEdition && (
            <div className="pay-quick">
              {etat.prochaine && etat.prochaine.du !== etat.reste && (
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setForm({ ...form, montant: etat.prochaine.du })}>
                  {etat.prochaine.libelle || 'Prochaine échéance'} ({formatCFA(etat.prochaine.du)})
                </button>
              )}
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setForm({ ...form, montant: etat.reste })}>
                Solde ({formatCFA(etat.reste)})
              </button>
            </div>
          )}
          {controle.tropPercu > 0 && (
            <label className="checkbox-row pay-trop">
              <input type="checkbox" checked={tropConfirme} onChange={(e) => setTropConfirme(e.target.checked)} />
              <span>Ce paiement dépasse le reste dû de <strong>{formatCFA(controle.tropPercu)}</strong> : je confirme le trop-perçu (à rembourser ou à reporter).</span>
            </label>
          )}
          <div className="form-row-2">
            <Field label="Date du paiement">
              <input className="input" type="date" value={form.date} max={jourLocal()} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Mode">
              <select className="input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                {PAIEMENT_MODES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </Field>
          </div>
          {form.mode === 'momo' && operateurs.length > 0 && (
            <Field label="Opérateur">
              <select className="input" value={form.operateur} onChange={(e) => setForm({ ...form, operateur: e.target.value })}>
                <option value="">—</option>
                {operateurs.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
          )}
          <Field label="Référence (facultatif)">
            <input className="input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="N° de transaction, de virement, de chèque…" />
          </Field>
          <Field label="Note (facultatif)">
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ex. acompte à la commande" />
          </Field>
          <button type="submit" className="btn btn-primary btn-block" disabled={!controle.valide || (controle.tropPercu > 0 && !tropConfirme)}>
            <Check size={17} /> {enEdition ? 'Enregistrer la correction' : 'Enregistrer le paiement'}
          </button>
          {enEdition && (
            <button type="button" className="btn btn-outline btn-block" onClick={annulerEdition}><X size={16} /> Annuler la modification</button>
          )}
        </form>
      )}

      {paiements.length > 0 && (
        <div className="pay-history">
          <div className="sheet-section-title">Paiements reçus</div>
          {paiements.map((p) => (
            <div key={p.id} className="pay-history-item">
              <div className="pay-history-row">
                <Wallet size={15} />
                <span className="pay-history-mode">{libelleMode(p)}</span>
                <span className="pay-history-date">{jourFr(jourDuPaiement(p))}</span>
                <span className="pay-history-amount">{formatCFA(p.montant)}</span>
              </div>
              {(p.reference || p.note) && <div className="field-hint pay-history-detail">{[p.reference, p.note].filter(Boolean).join(' · ')}</div>}
              {aSupprimer === p.id ? (
                <div className="pay-history-actions">
                  <span className="field-error">Supprimer ce paiement ?</span>
                  <button type="button" className="btn btn-sm btn-lost" onClick={() => { onDelete?.(p.id); setASupprimer(null); }}>Supprimer</button>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setASupprimer(null)}>Garder</button>
                </div>
              ) : (
                <div className="pay-history-actions">
                  {onRecu && (
                    <button type="button" className="btn btn-sm btn-outline" disabled={recuOccupe(p, 'recu')} onClick={() => onRecu(p)}
                      aria-label={`Reçu du paiement du ${jourFr(jourDuPaiement(p))} (PDF)`}>
                      {recuOccupe(p, 'recu') ? <Loader2 size={14} className="tourne" /> : <FileText size={14} />} Reçu
                    </button>
                  )}
                  {onEnvoyerRecu && (
                    <button type="button" className="btn btn-sm btn-outline" disabled={recuOccupe(p, 'recu-whatsapp')} onClick={() => onEnvoyerRecu(p)}
                      aria-label={`Envoyer le reçu du ${jourFr(jourDuPaiement(p))} sur WhatsApp`}>
                      {recuOccupe(p, 'recu-whatsapp') ? <Loader2 size={14} className="tourne" /> : <Send size={14} />}
                    </button>
                  )}
                  {onUpdate && <button type="button" className="btn btn-sm btn-outline" onClick={() => modifier(p)} aria-label={`Modifier le paiement du ${jourFr(jourDuPaiement(p))}`}><Pencil size={14} /> Modifier</button>}
                  {onDelete && <button type="button" className="btn btn-sm btn-outline" onClick={() => setASupprimer(p.id)} aria-label={`Supprimer le paiement du ${jourFr(jourDuPaiement(p))}`}><Trash2 size={14} /></button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
