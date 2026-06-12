import { useState } from 'react';
import { UserCheck, Pencil } from 'lucide-react';
import { useData } from '../../context/DataContext';

/**
 * Attribution du partenaire apporteur sur un devis.
 * Automatique par défaut (parrain de la piste, ou lien d'affiliation actif),
 * avec possibilité de modifier manuellement pour les cas particuliers.
 */
export default function PartnerField({ value, onChange }) {
  const { partners, getPartnerById } = useData();
  const [manual, setManual] = useState(false);

  const partner = value ? getPartnerById(value) : null;

  if (!manual && partner) {
    return (
      <div className="partner-auto-box">
        <div className="partner-auto-icon"><UserCheck size={18} /></div>
        <div className="partner-auto-info">
          <div className="partner-auto-label">Partenaire attribué automatiquement</div>
          <div className="partner-auto-name">
            {partner.name} <span className="partner-code-chip">{partner.code}</span>
          </div>
        </div>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => setManual(true)}>
          <Pencil size={13} /> Modifier
        </button>
      </div>
    );
  }

  return (
    <div className="input-group partner-field">
      <label className="input-label">Partenaire apporteur (commission)</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Aucun partenaire</option>
        {partners.filter((p) => p.status === 'actif').map((p) => (
          <option key={p.id} value={p.id}>{p.name} — {p.code}</option>
        ))}
      </select>
      <div className="field-hint">
        {partner
          ? 'Le code du partenaire sera imprimé sur le devis.'
          : "Aucun partenaire détecté pour cette piste — sélectionnez-en un si un apporteur est à créditer."}
      </div>
    </div>
  );
}
