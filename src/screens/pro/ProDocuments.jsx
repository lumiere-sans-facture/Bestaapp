import { useNavigate } from 'react-router-dom';
import { AlertTriangle, FileWarning } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { needsRenewalAlert, daysLeft } from '../../utils/subscription';
import { formatDate } from '../../utils/format';
import DocumentsTab from '../plus/devisPro/DocumentsTab';
import { normalizeModele } from '../plus/devisPro/constants';
import { paysDeLEntreprise } from '../../data/pays';

// Écran Pro « Devis & Factures » (route /pro/documents).
export default function ProDocuments() {
  const { user } = useAuth();
  const { getCompanyForUser, getSubscriptionForUser } = useData();
  const navigate = useNavigate();
  const company = getCompanyForUser(user.id);
  const sub = getSubscriptionForUser(user.id);
  const modeleDefaut = normalizeModele(company?.modeleDefaut);
  // Pays de l'entreprise : le rappel ci-dessous porte SON identifiant fiscal
  // (IFU au Bénin, NIF au Togo, NCC en Côte d'Ivoire…), comme « Mon entreprise ».
  const pays = paysDeLEntreprise(company);

  return (
    <div className="page">
      <PageHeader title="Devis & Factures" />
      {/* Pleine largeur, comme l'écran Devis public : le wizard de
          dimensionnement et les listes s'affichent à l'identique. */}
      <div className="page-content">
        {needsRenewalAlert(sub) && (
          <div className="pro-alert">
            <AlertTriangle size={17} />
            <span>Votre abonnement expire dans <strong>{daysLeft(sub)} jour(s)</strong> ({formatDate(sub.dateFin)}).</span>
            <button className="btn btn-sm btn-accent" onClick={() => navigate('/pro/abonnement')}>Renouveler</button>
          </div>
        )}
        {/* Conformité : une facture doit porter l'identifiant fiscal de
            l'émetteur — IFU au Bénin, NIF au Togo, NCC en Côte d'Ivoire…
            (data/pays.js). Sans ce rappel, un abonné émet des factures non
            conformes sans le savoir — c'est lui qui en répond devant
            l'administration. */}
        {!company?.ifu && (
          <div className="pro-alert is-info rappel-identifiant-fiscal">
            <FileWarning size={17} />
            <span>
              Vos factures ne portent pas votre <strong>{pays.fiscal.sigle}</strong>. Il est obligatoire sur une
              facture {pays.dans} — renseignez-le dans « Mon entreprise ».
            </span>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/pro/entreprise')}>
              Renseigner
            </button>
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
