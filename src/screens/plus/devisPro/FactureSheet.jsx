import { useEffect, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { formatCFA } from '../../../utils/format';
import { computeFactureTotals } from '../../../utils/facture';
import Sheet from '../../../components/Sheet';
import Field from '../../../components/Field';
import { MODELES, EMPTY_LIGNE } from './constants';

const emptyForm = (tvaActive, modele) => ({
  clientName: '', clientPhone: '', clientVille: '',
  tvaActive, statut: 'emise', modele, lignes: [{ ...EMPTY_LIGNE }],
});

/**
 * Formulaire de création d'une facture. Gère son propre état ; à la validation,
 * remonte les données prêtes (lignes nettoyées + totaux) via onSubmit.
 */
export default function FactureSheet({ open, onClose, defaultTvaActive, modeleDefaut, onSubmit }) {
  const [form, setForm] = useState(() => emptyForm(defaultTvaActive, modeleDefaut));

  // Réinitialise le formulaire à chaque ouverture (TVA/ modèle selon l'entreprise).
  useEffect(() => {
    if (open) setForm(emptyForm(defaultTvaActive, modeleDefaut));
  }, [open, defaultTvaActive, modeleDefaut]);

  const setLigne = (i, patch) =>
    setForm((f) => ({ ...f, lignes: f.lignes.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

  const submit = (e) => {
    e.preventDefault();
    const lignes = form.lignes
      .filter((l) => l.designation.trim() && Number(l.pu) > 0)
      .map((l) => ({ designation: l.designation.trim(), qty: Math.max(1, Number(l.qty) || 1), pu: Number(l.pu) }));
    if (!lignes.length) return;
    const totals = computeFactureTotals(lignes, form.tvaActive);
    onSubmit({
      clientName: form.clientName.trim(),
      clientPhone: form.clientPhone.trim(),
      clientVille: form.clientVille.trim(),
      lignes,
      ...totals,
      tvaActive: form.tvaActive,
      statut: form.statut,
      modele: form.modele || modeleDefaut,
    });
  };

  const preview = computeFactureTotals(
    form.lignes.map((l) => ({ pu: Number(l.pu) || 0, qty: Number(l.qty) || 0 })),
    form.tvaActive
  );

  return (
    <Sheet open={open} onClose={onClose} title="Nouvelle facture">
      <form onSubmit={submit}>
        <Field label="Client *">
          <input className="input" required value={form.clientName}
            onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="Nom du client" />
        </Field>
        <div className="form-row-2">
          <Field label="Téléphone">
            <input className="input" type="tel" value={form.clientPhone}
              onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} />
          </Field>
          <Field label="Ville">
            <input className="input" value={form.clientVille}
              onChange={(e) => setForm({ ...form, clientVille: e.target.value })} />
          </Field>
        </div>

        <div className="input-label">Lignes de la facture *</div>
        {form.lignes.map((l, i) => (
          <div key={i} className="facture-ligne">
            <input className="input" placeholder="Désignation" aria-label="Désignation" value={l.designation}
              onChange={(e) => setLigne(i, { designation: e.target.value })} />
            <input className="input facture-qty" type="number" min="1" placeholder="Qté" aria-label="Quantité" value={l.qty}
              onChange={(e) => setLigne(i, { qty: e.target.value })} />
            <input className="input facture-pu" type="number" min="0" placeholder="P.U." aria-label="Prix unitaire" value={l.pu}
              onChange={(e) => setLigne(i, { pu: e.target.value })} />
            {form.lignes.length > 1 && (
              <button type="button" className="cart-row-remove"
                onClick={() => setForm({ ...form, lignes: form.lignes.filter((_, j) => j !== i) })}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn-sm btn-outline facture-add-ligne"
          onClick={() => setForm({ ...form, lignes: [...form.lignes, { ...EMPTY_LIGNE }] })}>
          <Plus size={14} /> Ajouter une ligne
        </button>

        <label className="pro-tva-toggle">
          <input type="checkbox" checked={form.tvaActive}
            onChange={(e) => setForm({ ...form, tvaActive: e.target.checked })} />
          Appliquer la TVA 18 % <span className="text-secondary">(exonérée par défaut sur le solaire au Bénin)</span>
        </label>

        <div className="form-row-2">
          <Field label="Statut">
            <select className="input" value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })}>
              <option value="brouillon">Brouillon</option>
              <option value="emise">Émise</option>
              <option value="payee">Payée</option>
            </select>
          </Field>
          <Field label="Modèle">
            <select className="input" value={form.modele || modeleDefaut} onChange={(e) => setForm({ ...form, modele: e.target.value })}>
              {MODELES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
        </div>

        <div className="devis-summary">
          <div className="devis-summary-row"><span>Total HT</span><span>{formatCFA(preview.totalHT)}</span></div>
          <div className="devis-summary-row"><span>TVA</span><span>{form.tvaActive ? formatCFA(preview.tva) : 'Exonérée'}</span></div>
          <div className="devis-summary-row total"><span>Total TTC</span><span>{formatCFA(preview.totalTTC)}</span></div>
        </div>
        <button type="submit" className="btn btn-primary btn-block"><Check size={17} /> Créer la facture</button>
      </form>
    </Sheet>
  );
}
