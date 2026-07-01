import { useState } from 'react';
import { CreditCard, Crown, Clock } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { formatCFA, formatDate } from '../../../utils/format';
import { SUBSCRIPTION_PRICE, effectiveStatus, daysLeft } from '../../../utils/subscription';

/** Onglet « Mon abonnement » : statut, renouvellement, historique des paiements. */
export default function SubscriptionTab({ sub }) {
  const { user } = useAuth();
  const { subscriptionPayments, requestSubscription } = useData();
  const [subSent, setSubSent] = useState(false);
  const status = effectiveStatus(sub);
  const myPayments = (subscriptionPayments || []).filter((p) => p.userId === user.id);

  return (
    <div className="card my-partner-section">
      <div className="card-title"><CreditCard size={15} /> Mon abonnement Devis Pro</div>
      <div className="sheet-row"><span className="sheet-label">Statut</span><span className="sheet-value"><span className="badge badge-success">Actif</span></span></div>
      <div className="sheet-row"><span className="sheet-label">Expire le</span><span className="sheet-value">{formatDate(sub.dateFin)} ({daysLeft(sub)} jour(s) restants)</span></div>
      <div className="sheet-row"><span className="sheet-label">Montant</span><span className="sheet-value">{formatCFA(sub.montant)} / mois</span></div>
      {subSent || status === 'en_attente_paiement' ? (
        <div className="pro-pending"><Clock size={17} /><div><strong>Renouvellement en attente de validation</strong></div></div>
      ) : (
        <button className="btn btn-accent btn-block" onClick={() => { requestSubscription(user.id, { methode: 'momo', phone: user.phone || '', reference: '' }); setSubSent(true); }}>
          <Crown size={16} /> Renouveler maintenant (+30 jours) — {formatCFA(SUBSCRIPTION_PRICE)}
        </button>
      )}
      <div className="card-title my-partner-subtitle">Historique des paiements</div>
      {myPayments.length ? myPayments.map((p) => (
        <div key={p.id} className="sheet-row">
          <span className="sheet-label">{formatDate(p.date)} · {p.methode === 'momo' ? 'MTN MoMo' : 'Moov Money'}{p.referenceTransaction ? ` · ${p.referenceTransaction}` : ''}</span>
          <span className="sheet-value">
            {formatCFA(p.montant)}{' '}
            <span className={`badge ${p.statut === 'confirme' ? 'badge-success' : p.statut === 'initie' ? 'badge-warning' : 'badge-muted'}`}>
              {{ confirme: 'Confirmé', initie: 'En attente', rejete: 'Rejeté' }[p.statut]}
            </span>
          </span>
        </div>
      )) : <div className="text-sm text-secondary">Aucun paiement enregistré.</div>}
    </div>
  );
}
