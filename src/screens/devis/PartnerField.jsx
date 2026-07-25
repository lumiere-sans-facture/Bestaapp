import { UserCheck, UserX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

/**
 * Partenaire apporteur d'un devis — lecture seule : parrain de la piste,
 * sinon lien d'affiliation actif, sinon le profil partenaire du créateur
 * du devis. Aucun choix manuel : la commission suit l'apporteur réel.
 */
export default function PartnerField({ value }) {
  const { user } = useAuth();
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

  const isSelf = partner.userId === user?.id;
  return (
    <div className="partner-auto-box">
      <div className="partner-auto-icon"><UserCheck size={18} /></div>
      <div className="partner-auto-info">
        <div className="partner-auto-label">Partenaire apporteur (commission)</div>
        <div className="partner-auto-name">
          {partner.name}{isSelf ? ' (vous)' : ''} <span className="partner-code-chip">{partner.code}</span>
        </div>
      </div>
    </div>
  );
}
