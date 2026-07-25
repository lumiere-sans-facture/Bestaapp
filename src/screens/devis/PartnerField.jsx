import { UserCheck, UserX } from 'lucide-react';
import { useData } from '../../context/DataContext';

/**
 * Partenaire apporteur d'un devis — lecture seule : c'est toujours celui
 * rattaché à la piste (parrain enregistré ou lien d'affiliation actif).
 * Aucun choix manuel : la commission suit le profil de l'apporteur réel.
 */
export default function PartnerField({ value }) {
  const { getPartnerById } = useData();
  const partner = value ? getPartnerById(value) : null;

  if (!partner) {
    return (
      <div className="partner-auto-box none">
        <div className="partner-auto-icon"><UserX size={18} /></div>
        <div className="partner-auto-info">
          <div className="partner-auto-label">Partenaire apporteur</div>
          <div className="partner-auto-name">Aucun — cette piste n'a pas d'apporteur enregistré.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="partner-auto-box">
      <div className="partner-auto-icon"><UserCheck size={18} /></div>
      <div className="partner-auto-info">
        <div className="partner-auto-label">Partenaire apporteur (commission)</div>
        <div className="partner-auto-name">
          {partner.name} <span className="partner-code-chip">{partner.code}</span>
        </div>
      </div>
    </div>
  );
}
