import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { needsRenewalAlert, daysLeft } from '../../utils/subscription';
import { formatDate } from '../../utils/format';
import DocumentsTab from '../plus/devisPro/DocumentsTab';

// Écran Pro « Devis & Factures » (route /pro/documents).
export default function ProDocuments() {
  const { user } = useAuth();
  const { getCompanyForUser, getSubscriptionForUser } = useData();
  const navigate = useNavigate();
  const company = getCompanyForUser(user.id);
  const sub = getSubscriptionForUser(user.id);
  const modeleDefaut = company?.modeleDefaut || 'classique';

  return (
    <div className="page">
      <PageHeader title="Devis & Factures" />
      <div className="page-content page-content-narrow">
        {needsRenewalAlert(sub) && (
          <div className="pro-alert">
            <AlertTriangle size={17} />
            <span>Votre abonnement expire dans <strong>{daysLeft(sub)} jour(s)</strong> ({formatDate(sub.dateFin)}).</span>
            <button className="btn btn-sm btn-accent" onClick={() => navigate('/pro/abonnement')}>Renouveler</button>
          </div>
        )}
        <DocumentsTab
          company={company}
          modeleDefaut={modeleDefaut}
          onGoTo={() => navigate('/pro/entreprise')}
        />
      </div>
    </div>
  );
}
