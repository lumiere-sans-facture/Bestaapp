import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import SubscriptionTab from '../plus/devisPro/SubscriptionTab';

// Écran Pro « Mon abonnement » (route /pro/abonnement).
export default function ProSubscription() {
  const { user } = useAuth();
  const { getSubscriptionForUser } = useData();
  const sub = getSubscriptionForUser(user.id);

  return (
    <div className="page">
      <PageHeader title="Mon abonnement" />
      <div className="page-content page-content-narrow">
        <SubscriptionTab sub={sub} />
      </div>
    </div>
  );
}
