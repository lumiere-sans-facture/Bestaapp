import { useNavigate } from 'react-router-dom';
import { FileWarning } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import DocumentsTab from '../plus/devisPro/DocumentsTab';
import { normalizeModele } from '../plus/devisPro/constants';

// Écran Pro « Devis & Factures » (route /pro/documents).
export default function ProDocuments() {
  const { user } = useAuth();
  const { getCompanyForUser } = useData();
  const navigate = useNavigate();
  const company = getCompanyForUser(user.id);
  const modeleDefaut = normalizeModele(company?.modeleDefaut);

  return (
    <div className="page">
      <PageHeader title="Devis & Factures" />
      {/* Pleine largeur, comme l'écran Devis public : le wizard de
          dimensionnement et les listes s'affichent à l'identique. */}
      <div className="page-content">
        {/* Pas de bandeau « Renouveler » ici (décision du gérant) : ces
            écrans se montrent au client. L'échéance se lit dans la cloche,
            les alertes du tableau de bord et la page Abonnement. */}
        {/* Conformité : au Togo, une facture doit porter le NIF de l'émetteur.
            Sans ce rappel, un abonné émet des factures non conformes sans le
            savoir — c'est lui qui en répond devant l'administration. */}
        {!company?.ifu && (
          <div className="pro-alert is-info">
            <FileWarning size={17} />
            <span>
              Vos factures ne portent pas d'<strong>NIF</strong>. Il est obligatoire sur une
              facture au Togo — renseignez-le dans « Mon entreprise ».
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
