import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import PageHeader from '../../components/PageHeader';
import ClientsTab from '../plus/devisPro/ClientsTab';

// Écran Pro « Clients » (route /pro/clients).
export default function ProClients() {
  const { user } = useAuth();
  const { getCompanyForUser } = useData();
  return (
    <div className="page">
      <PageHeader title="Clients" />
      <div className="page-content page-content-narrow">
        <ClientsTab company={getCompanyForUser(user.id)} />
      </div>
    </div>
  );
}
