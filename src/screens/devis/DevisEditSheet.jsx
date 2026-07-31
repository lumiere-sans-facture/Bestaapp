import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { formatCFA } from '../../utils/format';
import { computeFactureTotals } from '../../utils/facture';
import Sheet from '../../components/Sheet';
import Field from '../../components/Field';
import LigneEditor from '../../components/LigneEditor';
import TvaToggle from '../../components/TvaToggle';

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
  const [chargement, setChargement] = useState(false);
  const [client, setClient] = useState({ clientName: '', clientPhone: '', clientVille: '' });
  const [tvaActive, setTvaActive] = useState(false);

  useEffect(() => {
    if (!open || !devis) return;
    setClient({ clientName: devis.clientName || '', clientPhone: devis.clientPhone || '', clientVille: devis.clientVille || '' });
    setTvaActive(!!devis.tvaActive);
    // Lignes initiales (dérivées du devis : Pro/édité → stockées, solaire/manuel → composées).
    // L'import est asynchrone : on l'affiche, plutôt que d'ouvrir un panneau vide.
    setChargement(true);
    import('../../utils/proDocPdf').then(({ devisToLignes }) => {
      setLignes(devisToLignes(devis, products).map((l) => ({ designation: l.designation, qty: l.qty, pu: l.pu })));
      setChargement(false);
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

      <div className="sheet-section-title">Lignes du devis</div>
      {chargement ? (
        <div className="geo-loading">Chargement des lignes…</div>
      ) : (
        <LigneEditor lignes={lignes} onChange={setLigne} onRemove={removeLigne} onAdd={addLigne} />
      )}
      {!chargement && lignes.length > 0 && !clean().length && (
        <div className="field-hint">Une ligne sans désignation ou sans prix n'est pas enregistrée — complétez au moins une ligne.</div>
      )}

      {withTva && <TvaToggle value={tvaActive} onChange={setTvaActive} />}

      <div className="devis-summary">
        {withTva ? (
          <>
            <div className="devis-summary-row"><span>Total HT</span><span>{formatCFA(preview.totalHT)}</span></div>
            <div className="devis-summary-row"><span>TVA</span><span>{tvaActive ? formatCFA(preview.tva) : 'Exonérée'}</span></div>
            <div className="devis-summary-row total"><span>Total TTC</span><span>{formatCFA(preview.totalTTC)}</span></div>
          </>
        ) : (
          <div className="devis-summary-row total"><span>Total TTC</span><span>{formatCFA(preview.totalTTC)}</span></div>
        )}
      </div>
      <button className="btn btn-primary btn-block" onClick={save} disabled={!clean().length}>
        <Check size={17} /> Enregistrer les modifications
      </button>
    </Sheet>
  );
}
