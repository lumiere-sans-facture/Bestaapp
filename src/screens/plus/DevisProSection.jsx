import { useState } from 'react';
import { ChevronLeft, Crown, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { formatDate } from '../../utils/format';
import { effectiveStatus, isSubscriptionActive, daysLeft, needsRenewalAlert } from '../../utils/subscription';
import ProPaywall from './devisPro/ProPaywall';
import DocumentsTab from './devisPro/DocumentsTab';
import ClientsTab from './devisPro/ClientsTab';
import CompanyTab from './devisPro/CompanyTab';
import SubscriptionTab from './devisPro/SubscriptionTab';

// Composition root du module Devis Pro : choisit l'accroche (non abonné) ou
// les onglets (documents / entreprise / abonnement). La logique de chaque onglet
// vit dans son propre composant sous devisPro/.
export default function DevisProSection({ onBack }) {
  const { user } = useAuth();
  const { getSubscriptionForUser, getCompanyForUser } = useData();

  const sub = getSubscriptionForUser(user.id);
  const active = isSubscriptionActive(sub);
  const company = getCompanyForUser(user.id);
  const modeleDefaut = company?.modeleDefaut || 'classique';

  const [tab, setTab] = useState('documents'); // documents | entreprise | abonnement

  if (!active) return <ProPaywall onBack={onBack} sub={sub} status={effectiveStatus(sub)} />;

  return (
    <>
      <div className="partners-toolbar">
        <button className="btn btn-outline btn-sm back-button" onClick={onBack}>
          <ChevronLeft size={16} /> Retour
        </button>
        <span className="badge badge-gold"><Crown size={13} /> Devis Pro actif</span>
      </div>
      <div className="section-title">Devis Pro</div>

      {needsRenewalAlert(sub) && (
        <div className="pro-alert">
          <AlertTriangle size={17} />
          <span>Votre abonnement expire dans <strong>{daysLeft(sub)} jour(s)</strong> ({formatDate(sub.dateFin)}). Pensez à renouveler.</span>
          <button className="btn btn-sm btn-accent" onClick={() => setTab('abonnement')}>Renouveler</button>
        </div>
      )}

      <div className="categories-scroll pro-tabs">
        {[['documents', 'Mes documents'], ['clients', 'Clients'], ['entreprise', 'Mon entreprise'], ['abonnement', 'Mon abonnement']].map(([id, label]) => (
          <button key={id} className={`category-chip ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'documents' && <DocumentsTab company={company} modeleDefaut={modeleDefaut} onGoTo={setTab} />}
      {tab === 'clients' && <ClientsTab />}
      {tab === 'entreprise' && <CompanyTab company={company} />}
      {tab === 'abonnement' && <SubscriptionTab sub={sub} />}
    </>
  );
}
