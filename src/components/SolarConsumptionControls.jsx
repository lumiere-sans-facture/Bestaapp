import { Banknote, Calculator, Sun } from 'lucide-react';
import Field from './Field';
import { REPARTITIONS } from '../utils/factureConso';

const MODES = [
  ['appareils', 'Liste des appareils'],
  ['facture', 'Facture CEET/SBEE (F CFA)'],
  ['direct', 'Saisie directe (kWh)'],
];

export function ConsumptionModePicker({ value, onChange }) {
  return (
    <div className="categories-scroll" style={{ marginBottom: 12 }}>
      {MODES.map(([id, label]) => (
        <button key={id} type="button" className={`category-chip ${value === id ? 'active' : ''}`}
          aria-pressed={value === id} onClick={() => onChange(id)}>
          {id === 'facture' ? <Banknote size={13} style={{ verticalAlign: -2, marginRight: 4 }} /> : id === 'direct' ? <Calculator size={13} style={{ verticalAlign: -2, marginRight: 4 }} /> : null}
          {label}
        </button>
      ))}
    </div>
  );
}

export function InvoiceConsumptionFields({ facture, onChange, result }) {
  return (
    <>
      <div className="manual-consumption-grid">
        <Field label={<><Banknote size={14} /> Facture mensuelle moyenne (F CFA)</>}>
          <input className="input" type="number" min="0" step="500" value={facture.montant}
            onChange={(event) => onChange({ ...facture, montant: event.target.value })} placeholder="Ex : 25 000" />
        </Field>
        <Field label="Prix du kWh (F CFA)">
          <input className="input" type="number" min="1" value={facture.prixKwh}
            onChange={(event) => onChange({ ...facture, prixKwh: event.target.value })} />
        </Field>
      </div>
      <div className="chip-selector">
        <span className="chip-selector-label"><Sun size={13} /> Quand consomme-t-il le plus ?</span>
        <div className="categories-scroll" style={{ marginBottom: 0 }}>
          {REPARTITIONS.map((repartition) => (
            <button key={repartition.id} type="button" className={`category-chip ${facture.repartition === repartition.id ? 'active' : ''}`}
              onClick={() => onChange({ ...facture, repartition: repartition.id })}>
              {repartition.label}
            </button>
          ))}
        </div>
      </div>
      {result.kwhMois > 0 && (
        <div className="field-hint" role="status">
          ≈ {result.kwhMois.toLocaleString('fr-FR')} kWh consommés par mois,
          soit {(result.day + result.night).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kWh par jour.
          La part de nuit dimensionne la batterie.
        </div>
      )}
    </>
  );
}
