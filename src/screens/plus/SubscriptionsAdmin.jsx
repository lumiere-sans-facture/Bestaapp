import { useState } from 'react';
import { ChevronLeft, Crown, Check, X, TrendingUp, Users, Clock } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { formatCFA, formatDate } from '../../utils/format';
import { SUBSCRIPTION_PRICE, effectiveStatus, daysLeft } from '../../utils/subscription';
import ConfirmSheet from '../../components/ConfirmSheet';

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

  // Paiement en attente de décision (confirmation dans le design de l'app)
  const [askConfirm, setAskConfirm] = useState(null);
  const [askReject, setAskReject] = useState(null);

  return (
    <>
      <button className="btn btn-outline btn-sm back-button back-to-plus" onClick={onBack}>
        <ChevronLeft size={16} /> Retour
      </button>
      <div className="section-title">Abonnements Devis Pro</div>

      <div className="commission-totals">
        <div className="commission-total-card paid">
          <div className="commission-total-value"><TrendingUp size={15} /> {formatCFA(mrr)}</div>
          <div className="commission-total-label">Revenu mensuel récurrent (MRR)</div>
        </div>
        <div className="commission-total-card pending">
          <div className="commission-total-value"><Users size={15} /> {activeSubs.length}</div>
          <div className="commission-total-label">Abonné{activeSubs.length > 1 ? 's' : ''} actif{activeSubs.length > 1 ? 's' : ''}</div>
        </div>
      </div>

      {pendingPayments.length > 0 && (
        <div className="callout" role="status">
          <div className="callout-title">
            <Clock size={14} /> {pendingPayments.length} paiement{pendingPayments.length > 1 ? 's' : ''} en attente de validation ci-dessous.
          </div>
        </div>
      )}

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
                <button className="btn btn-sm btn-won" onClick={() => setAskConfirm(p)}>
                  <Check size={14} /> Confirmer
                </button>
                <button className="btn btn-sm btn-lost" onClick={() => setAskReject(p)}>
                  <X size={14} /> Refuser
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

      {/* Confirmations (remplacent window.confirm) */}
      <ConfirmSheet
        open={!!askConfirm}
        onClose={() => setAskConfirm(null)}
        onConfirm={() => confirmSubscriptionPayment(askConfirm.id)}
        title="Confirmer le paiement"
        message={askConfirm
          ? `Confirmer la réception de ${formatCFA(askConfirm.montant)} de ${userName(askConfirm.userId)} ? L'abonnement sera activé 30 jours.`
          : ''}
        confirmLabel="Confirmer"
      />
      <ConfirmSheet
        open={!!askReject}
        onClose={() => setAskReject(null)}
        onConfirm={() => rejectSubscriptionPayment(askReject.id)}
        title="Refuser le paiement"
        message={askReject
          ? `Refuser le paiement de ${formatCFA(askReject.montant)} de ${userName(askReject.userId)} ? L'abonnement ne sera pas activé.`
          : ''}
        confirmLabel="Refuser"
        danger
      />
    </>
  );
}
