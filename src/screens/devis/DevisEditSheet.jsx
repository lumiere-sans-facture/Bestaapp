import { useEffect, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { formatCFA } from '../../utils/format';
import { computeFactureTotals } from '../../utils/facture';
import Sheet from '../../components/Sheet';
import Field from '../../components/Field';

/**
 * Édition d'un devis (finalisé ou brouillon), commun au mode public et Pro.
 * Édite les lignes (désignation / quantité / p.u.). Les modifications sont
 * stockées sur le devis (lignes + total) et prises en compte par les PDF.
 *
 * @param {boolean} editableClient  autorise l'édition du client (devis Pro)
 * @param {boolean} withTva         propose la bascule TVA (devis Pro)
 */
export default function DevisEditSheet({ open, onClose, devis, editableClient = false, withTva = false }) {
  const { products, updateDevis } = useData();
  const [lignes, setLignes] = useState([]);
  const [client, setClient] = useState({ clientName: '', clientPhone: '', clientVille: '' });
  const [tvaActive, setTvaActive] = useState(false);

  useEffect(() => {
    if (!open || !devis) return;
    setClient({ clientName: devis.clientName || '', clientPhone: devis.clientPhone || '', clientVille: devis.clientVille || '' });
    setTvaActive(!!devis.tvaActive);
    // Lignes initiales (dérivées du devis : Pro/édité → stockées, solaire/manuel → composées).
    import('../../utils/proDocPdf').then(({ devisToLignes }) => {
      setLignes(devisToLignes(devis, products).map((l) => ({ designation: l.designation, qty: l.qty, pu: l.pu })));
    });
  }, [open, devis, products]);

  const setLigne = (i, patch) => setLignes((ls) => ls.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addLigne = () => setLignes((ls) => [...ls, { designation: '', qty: 1, pu: '' }]);
  const removeLigne = (i) => setLignes((ls) => ls.filter((_, j) => j !== i));

  const clean = () => lignes
    .filter((l) => l.designation.trim() && Number(l.pu) > 0)
    .map((l) => ({ designation: l.designation.trim(), qty: Math.max(1, Number(l.qty) || 1), pu: Number(l.pu) }));

  const preview = computeFactureTotals(
    lignes.map((l) => ({ pu: Number(l.pu) || 0, qty: Number(l.qty) || 0 })),
    withTva && tvaActive
  );

  const save = () => {
    const finalLignes = clean();
    if (!finalLignes.length) return;
    const t = computeFactureTotals(finalLignes, withTva && tvaActive);
    updateDevis(devis.id, {
      lignes: finalLignes,
      edited: true,
      subtotal: t.totalHT,
      tva: t.tva,
      tvaActive: withTva ? tvaActive : false,
      total: t.totalTTC,
      ...(editableClient ? {
        clientName: client.clientName.trim(),
        clientPhone: client.clientPhone.trim(),
        clientVille: client.clientVille.trim(),
      } : {}),
    });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Modifier ${devis?.devisNumber || 'le devis'}`}>
      {editableClient && (
        <>
          <Field label="Client">
            <input className="input" value={client.clientName} onChange={(e) => setClient({ ...client, clientName: e.target.value })} placeholder="Nom du client" />
          </Field>
          <div className="form-row-2">
            <Field label="Téléphone">
              <input className="input" type="tel" value={client.clientPhone} onChange={(e) => setClient({ ...client, clientPhone: e.target.value })} />
            </Field>
            <Field label="Ville">
              <input className="input" value={client.clientVille} onChange={(e) => setClient({ ...client, clientVille: e.target.value })} />
            </Field>
          </div>
        </>
      )}

      <div className="input-label">Lignes du devis</div>
      {lignes.map((l, i) => (
        <div key={i} className="facture-ligne">
          <input className="input" placeholder="Désignation" aria-label="Désignation" value={l.designation}
            onChange={(e) => setLigne(i, { designation: e.target.value })} />
          <input className="input facture-qty" type="number" min="1" placeholder="Qté" aria-label="Quantité" value={l.qty}
            onChange={(e) => setLigne(i, { qty: e.target.value })} />
          <input className="input facture-pu" type="number" min="0" placeholder="P.U." aria-label="Prix unitaire" value={l.pu}
            onChange={(e) => setLigne(i, { pu: e.target.value })} />
          {lignes.length > 1 && (
            <button type="button" className="cart-row-remove" onClick={() => removeLigne(i)} aria-label="Supprimer la ligne"><Trash2 size={14} /></button>
          )}
        </div>
      ))}
      <button type="button" className="btn btn-sm btn-outline facture-add-ligne" onClick={addLigne}>
        <Plus size={14} /> Ajouter une ligne
      </button>

      {withTva && (
        <label className="pro-tva-toggle">
          <input type="checkbox" checked={tvaActive} onChange={(e) => setTvaActive(e.target.checked)} />
          Appliquer la TVA 18 %
        </label>
      )}

      <div className="devis-summary">
        {withTva ? (
          <>
            <div className="devis-summary-row"><span>Total HT</span><span>{formatCFA(preview.totalHT)}</span></div>
            <div className="devis-summary-row"><span>TVA</span><span>{tvaActive ? formatCFA(preview.tva) : 'Exonérée'}</span></div>
            <div className="devis-summary-row total"><span>Total TTC</span><span>{formatCFA(preview.totalTTC)}</span></div>
          </>
        ) : (
          <div className="devis-summary-row total"><span>Total</span><span>{formatCFA(preview.totalTTC)}</span></div>
        )}
      </div>
      <button className="btn btn-primary btn-block" onClick={save} disabled={!clean().length}>
        <Check size={17} /> Enregistrer les modifications
      </button>
    </Sheet>
  );
}
