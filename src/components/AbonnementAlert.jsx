import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Crown } from 'lucide-react';
import { useMode } from '../context/ModeContext';
import { effectiveStatus, needsRenewalAlert, daysLeft } from '../utils/subscription';
import { formatDate } from '../utils/format';

/**
 * Rappel d'échéance de l'abonnement Devis Pro, affiché dans l'espace PUBLIC.
 *
 * L'alerte ne vivait que dans l'espace Pro : un abonné qui ne l'ouvrait pas
 * dans les derniers jours ne la voyait jamais, et une fois expiré il n'y avait
 * même plus accès — l'abonnement se perdait par simple oubli. Elle doit donc
 * suivre l'utilisateur là où il travaille.
 *
 * Rien n'est affiché à qui n'a jamais souscrit (aucune sollicitation
 * commerciale intempestive).
 */
export default function AbonnementAlert() {
  const { sub, mode } = useMode();
  const navigate = useNavigate();
  if (!sub || mode === 'pro') return null; // l'espace Pro a déjà son propre rappel

  const statut = effectiveStatus(sub);

  if (statut === 'expire') {
    return (
      <div className="storage-alert abo-alert" role="status">
        <Crown size={16} />
        <span>
          <strong>Votre abonnement Devis Pro a expiré.</strong> Vos devis, factures et clients
          Pro sont conservés — renouvelez pour y accéder de nouveau. Vous pouvez aussi les
          exporter à tout moment depuis Plus → Sauvegarde.
        </span>
        <button className="btn btn-sm btn-accent" onClick={() => navigate('/plus/gopro')}>
          Renouveler
        </button>
      </div>
    );
  }

  if (needsRenewalAlert(sub)) {
    return (
      <div className="storage-alert abo-alert is-warning" role="status">
        <AlertTriangle size={16} />
        <span>
          Votre abonnement Devis Pro expire dans <strong>{daysLeft(sub)} jour(s)</strong>
          {sub.dateFin ? ` (${formatDate(sub.dateFin)})` : ''}.
        </span>
        <button className="btn btn-sm btn-accent" onClick={() => navigate('/plus/gopro')}>
          Renouveler
        </button>
      </div>
    );
  }
  return null;
}
