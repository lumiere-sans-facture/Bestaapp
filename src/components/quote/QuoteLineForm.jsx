import { Minus, Plus } from 'lucide-react';
import Field from '../Field';
import { formatQuoteCurrency, quoteLineTotals, QUOTE_UNITS, TAX_RATES } from '../../utils/quoteLines';

export function QuantitySelector({ value, onChange }) {
  const qty = Math.max(1, Number(value) || 1);
  return (
    <div className="quote-quantity" role="group" aria-label="Quantité">
      <button type="button" onClick={() => onChange(Math.max(1, qty - 1))} aria-label="Diminuer la quantité"><Minus size={22} /></button>
      <input type="number" min="1" step="1" inputMode="numeric" value={qty}
        onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1))} aria-label="Quantité" />
      <button type="button" onClick={() => onChange(qty + 1)} aria-label="Augmenter la quantité"><Plus size={22} /></button>
    </div>
  );
}

export function UnitSelector({ value, onChange }) {
  return (
    <select className="input" value={value} onChange={(event) => onChange(event.target.value)} aria-label="Unité">
      {QUOTE_UNITS.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
    </select>
  );
}

export function CurrencyInput({ value, onChange, currency }) {
  return (
    <div className="quote-currency-input">
      <input className="input" type="number" min="0" step="1" inputMode="decimal" value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} />
      <span>{currency}</span>
    </div>
  );
}

export function TaxSelector({ value, onChange, disabled }) {
  return (
    <select className="input" value={value} onChange={(event) => onChange(Number(event.target.value))} disabled={disabled}>
      {TAX_RATES.map((rate) => <option key={rate} value={rate}>{Math.round(rate * 100)} %</option>)}
    </select>
  );
}

export default function QuoteLineForm({ mode, value, onChange, onSubmit, onCancel, currency = 'XOF', allowTax = false, saving = false }) {
  const totals = quoteLineTotals(value);
  const valid = value.designation.trim() && Number(value.qty) > 0 && Number(value.pu) >= 0;
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="quote-line-form-view">
      <div className="quote-line-form-card">
        <Field label="Nom du produit">
          <input className="input" value={value.designation} onChange={(event) => set({ designation: event.target.value })}
            placeholder="Nom du produit ou service" autoFocus />
        </Field>
        <div className="input-group">
          <span className="input-label">Type</span>
          <div className="client-type-toggle" role="group" aria-label="Type de ligne">
            <button type="button" className={`client-type-btn ${value.itemType === 'bien' ? 'active' : ''}`}
              onClick={() => set({ itemType: 'bien', unit: value.unit === 'forfait' ? 'pcs' : value.unit })}>Bien</button>
            <button type="button" className={`client-type-btn ${value.itemType === 'service' ? 'active' : ''}`}
              onClick={() => set({ itemType: 'service', unit: 'forfait' })}>Service</button>
          </div>
        </div>
      </div>

      <div className="quote-form-section-label">Détails du produit</div>
      <div className="quote-line-form-card quote-line-details">
        <div><span className="input-label">Quantité</span><QuantitySelector value={value.qty} onChange={(qty) => set({ qty })} /></div>
        <Field label="Unité"><UnitSelector value={value.unit} onChange={(unit) => set({ unit })} /></Field>
      </div>

      <div className="quote-form-section-label">Prix</div>
      <div className="quote-line-form-card">
        <Field label="Prix unitaire"><CurrencyInput value={value.pu} onChange={(pu) => set({ pu })} currency={currency} /></Field>
        <Field label="TVA"><TaxSelector value={allowTax ? value.taxRate : 0} onChange={(taxRate) => set({ taxRate })} disabled={!allowTax} /></Field>
      </div>

      <div className="quote-line-form-card quote-line-total-card">
        <span>Total TTC</span><strong>{formatQuoteCurrency(totals.totalTTC, currency)}</strong>
        <small>HT {formatQuoteCurrency(totals.subtotalHT, currency)} · TVA {formatQuoteCurrency(totals.tva, currency)}</small>
      </div>

      <div className="quote-line-form-actions">
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={saving}>Annuler</button>
        <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={!valid || saving}>
          {saving ? 'Enregistrement…' : mode === 'edit' ? 'Enregistrer les modifications' : 'Ajouter au devis'}
        </button>
      </div>
    </div>
  );
}
