import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import CompanyTab from '../plus/devisPro/CompanyTab';

// Écran Pro « Mon entreprise » (route /pro/entreprise).
export default function ProCompany() {
  const { user } = useAuth();
  const { getCompanyForUser } = useData();
  const company = getCompanyForUser(user.id);

  return (
    <div className="page">
      <PageHeader title="Mon entreprise" />
      <div className="page-content page-content-narrow">
        <CompanyTab company={company} />
      </div>
    </div>
  );
}
