import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import DevisProSection from '../plus/DevisProSection';

export default function ProGestion() {
  const navigate = useNavigate();
  return (
    <div className="page">
      <PageHeader title="Devis &amp; Factures" />
      <div className="page-content page-content-narrow">
        <DevisProSection onBack={() => navigate('/pro')} />
      </div>
    </div>
  );
}
