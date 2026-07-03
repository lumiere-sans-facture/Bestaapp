import { useEffect, useState } from 'react';
import { Check, Wallet } from 'lucide-react';
import { formatCFA, formatDate } from '../../../utils/format';
import { PAIEMENT_MODES, PAIEMENT_MODE_LABEL, montantPaye, resteAPayer } from '../../../utils/paiement';
import Sheet from '../../../components/Sheet';
import Field from '../../../components/Field';

/**
 * Enregistrement d'un encaissement (total ou partiel) sur une facture.
 * Pré-remplit le montant avec le reste dû ; liste l'historique des paiements.
 */
export default function PaiementSheet({ open, onClose, facture, onSubmit }) {
  const reste = facture ? resteAPayer(facture) : 0;
  const [montant, setMontant] = useState(reste);
  const [mode, setMode] = useState('momo');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open && facture) { setMontant(resteAPayer(facture)); setMode('momo'); setNote(''); }
  }, [open, facture]);

  if (!facture) return null;
  const paye = montantPaye(facture);

  const submit = (e) => {
    e.preventDefault();
    const m = Math.max(0, Number(montant) || 0);
    if (m <= 0) return;
    onSubmit({ montant: m, mode, note });
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Encaisser ${facture.numero}`}>
      <div className="devis-summary">
        <div className="devis-summary-row"><span>Total TTC</span><span>{formatCFA(facture.totalTTC)}</span></div>
        <div className="devis-summary-row"><span>Déjà encaissé</span><span>{formatCFA(paye)}</span></div>
        <div className="devis-summary-row total"><span>Reste à payer</span><span>{formatCFA(reste)}</span></div>
      </div>

      <form onSubmit={submit}>
        <Field label="Montant encaissé *">
          <input className="input" type="number" min="1" required value={montant}
            onChange={(e) => setMontant(e.target.value)} />
        </Field>
        <div className="pay-quick">
          <button type="button" className="btn btn-sm btn-outline" onClick={() => setMontant(reste)}>Solde ({formatCFA(reste)})</button>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => setMontant(Math.round(reste / 2))}>Moitié</button>
        </div>
        <Field label="Mode de règlement">
          <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
            {PAIEMENT_MODES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </Field>
        <Field label="Note (facultatif)">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. acompte, réf. transaction…" />
        </Field>
        <button type="submit" className="btn btn-primary btn-block"><Check size={17} /> Enregistrer l'encaissement</button>
      </form>

      {(facture.paiements || []).length > 0 && (
        <div className="pay-history">
          <div className="input-label">Historique des encaissements</div>
          {facture.paiements.map((p) => (
            <div key={p.id} className="pay-history-row">
              <Wallet size={15} />
              <span className="pay-history-mode">{PAIEMENT_MODE_LABEL[p.mode] || p.mode}</span>
              <span className="pay-history-date">{formatDate(p.date)}</span>
              <span className="pay-history-amount">{formatCFA(p.montant)}</span>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
