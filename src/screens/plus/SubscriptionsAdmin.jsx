import { ChevronLeft, Crown, Check, X, TrendingUp, Users, Clock } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { formatCFA, formatDate } from '../../utils/format';
import { SUBSCRIPTION_PRICE, effectiveStatus, daysLeft } from '../../utils/subscription';

const STATUS_LABEL = {
  actif: ['Actif', 'badge-success'],
  expire: ['Expiré', 'badge-muted'],
  en_attente_paiement: ['En attente', 'badge-warning'],
};

export default function SubscriptionsAdmin({ onBack }) {
  const {
    subscriptions, subscriptionPayments, team,
    confirmSubscriptionPayment, rejectSubscriptionPayment, getUserById,
  } = useData();

  const subs = subscriptions || [];
  const payments = subscriptionPayments || [];
  const activeSubs = subs.filter((s) => effectiveStatus(s) === 'actif');
  const mrr = activeSubs.length * SUBSCRIPTION_PRICE;
  const pendingPayments = payments.filter((p) => p.statut === 'initie');
  const userName = (id) => getUserById(id)?.name || team.find((u) => u.id === id)?.name || id;

  return (
    <>
      <button className="btn btn-outline btn-sm back-button" onClick={onBack}>
        <ChevronLeft size={16} /> Retour
      </button>
      <div className="section-title">Abonnements Devis Pro</div>

      <div className="commission-totals">
        <div className="commission-total-card paid">
          <div className="commission-total-value"><TrendingUp size={15} /> {formatCFA(mrr)}</div>
          <div className="commission-total-label">Revenu mensuel récurrent (MRR)</div>
        </div>
        <div className="commission-total-card pending">
          <div className="commission-total-value"><Users size={15} /> {activeSubs.length} actif(s)</div>
          <div className="commission-total-label">{pendingPayments.length} paiement(s) à valider</div>
        </div>
      </div>

      {pendingPayments.length > 0 && (
        <div className="card my-partner-section">
          <div className="card-title"><Clock size={15} /> Paiements à valider</div>
          {pendingPayments.map((p) => (
            <div key={p.id} className="sheet-row">
              <span className="sheet-label">
                {userName(p.userId)} · {p.methode === 'momo' ? 'MTN MoMo' : 'Moov Money'} {p.phone}
                {p.referenceTransaction && <span className="text-secondary"> · Réf {p.referenceTransaction}</span>}
                <span className="text-secondary"> · {formatDate(p.date)}</span>
              </span>
              <span className="sheet-value pro-doc-actions">
                {formatCFA(p.montant)}
                <button
                  className="btn btn-sm btn-won"
                  onClick={() => window.confirm(`Confirmer la réception de ${formatCFA(p.montant)} de ${userName(p.userId)} ? L'abonnement sera activé 30 jours.`) && confirmSubscriptionPayment(p.id)}
                >
                  <Check size={14} /> Confirmer
                </button>
                <button className="btn btn-sm btn-lost" onClick={() => window.confirm('Rejeter ce paiement ?') && rejectSubscriptionPayment(p.id)}>
                  <X size={14} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="card my-partner-section">
        <div className="card-title"><Crown size={15} /> Abonnés ({subs.length})</div>
        {subs.length ? subs.map((s) => {
          const st = effectiveStatus(s);
          const [label, cls] = STATUS_LABEL[st] || [st, 'badge-muted'];
          return (
            <div key={s.id} className="sheet-row">
              <span className="sheet-label">
                {userName(s.userId)}
                <span className="text-secondary">
                  {s.dateFin ? ` · expire le ${formatDate(s.dateFin)}${st === 'actif' ? ` (${daysLeft(s)} j)` : ''}` : ' · jamais activé'}
                </span>
              </span>
              <span className="sheet-value"><span className={`badge ${cls}`}>{label}</span></span>
            </div>
          );
        }) : <div className="text-sm text-secondary">Aucun abonnement pour le moment.</div>}
      </div>

      <div className="card my-partner-section">
        <div className="card-title">Historique des paiements</div>
        {payments.length ? payments.map((p) => (
          <div key={p.id} className="sheet-row">
            <span className="sheet-label">{userName(p.userId)} · {formatDate(p.date)}</span>
            <span className="sheet-value">
              {formatCFA(p.montant)}{' '}
              <span className={`badge ${p.statut === 'confirme' ? 'badge-success' : p.statut === 'initie' ? 'badge-warning' : 'badge-muted'}`}>
                {{ confirme: 'Confirmé', initie: 'En attente', rejete: 'Rejeté' }[p.statut]}
              </span>
            </span>
          </div>
        )) : <div className="text-sm text-secondary">Aucun paiement.</div>}
      </div>
    </>
  );
}
