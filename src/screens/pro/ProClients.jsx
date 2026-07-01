import PageHeader from '../../components/PageHeader';
import ClientsTab from '../plus/devisPro/ClientsTab';

// Écran Pro « Clients » (route /pro/clients).
export default function ProClients() {
  return (
    <div className="page">
      <PageHeader title="Clients" />
      <div className="page-content page-content-narrow">
        <ClientsTab />
      </div>
    </div>
  );
}
