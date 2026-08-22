import { useCallback, useEffect, useState } from 'react';
import { Crown, Check, X, TrendingUp, Users, Clock, Handshake } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { formatCFA, formatDate } from '../../utils/format';
import { SUBSCRIPTION_PRICE, effectiveStatus, daysLeft } from '../../utils/subscription';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  adminSubscriptionsOverview,
  adminConfirmSubscriptionPayment,
  adminRejectSubscriptionPayment,
} from '../../lib/remoteSync';
import ConfirmSheet from '../../components/ConfirmSheet';
import { useToast } from '../../components/Toast';

const STATUS_LABEL = {
  actif: ['Actif', 'badge-success'],
  expire: ['Expiré', 'badge-muted'],
  en_attente_paiement: ['En attente', 'badge-warning'],
};

export default function SubscriptionsAdmin() {
  const {
    subscriptions, subscriptionPayments, team,
    confirmSubscriptionPayment, rejectSubscriptionPayment, getUserById,
  } = useData();
  const toast = useToast();

  // Mode SaaS : les abonnés sont dans D'AUTRES organisations — l'état local ne
  // les contient pas. La vue et les validations passent par le serveur (RPC).
  const serverMode = isSupabaseConfigured;
  const [remote, setRemote] = useState(null); // null = chargement
  const loadRemote = useCallback(() => {
    adminSubscriptionsOverview()
      .then(setRemote)
      .catch((e) => {
        setRemote({ subscriptions: [], payments: [] });
        toast(`Chargement impossible : ${e.message}`, { type: 'error' });
      });
  }, [toast]);
  useEffect(() => {
    if (serverMode) loadRemote();
  }, [serverMode, loadRemote]);

  const subs = serverMode ? remote?.subscriptions || [] : subscriptions || [];
  const payments = serverMode ? remote?.payments || [] : subscriptionPayments || [];
  const activeSubs = subs.filter((s) => effectiveStatus(s) === 'actif');
  const mrr = activeSubs.length * SUBSCRIPTION_PRICE;
  const pendingPayments = payments.filter((p) => p.statut === 'initie');
  // Libellé d'une ligne : en mode serveur, le nom du membre / de l'entreprise
  // arrive avec la ligne ; en mode local, on résout l'id utilisateur.
  const who = (row) => (serverMode
    ? row.memberName || row.orgName || row.userId
    : getUserById(row.userId)?.name || team.find((u) => u.id === row.userId)?.name || row.userId);

  // Paiement en attente de décision (confirmation dans le design de l'app)
  const [askConfirm, setAskConfirm] = useState(null);
  const [askReject, setAskReject] = useState(null);

  const doConfirm = async (p) => {
    if (!serverMode) return confirmSubscriptionPayment(p.id);
    try {
      await adminConfirmSubscriptionPayment(p.orgId, p.id);
      toast('Paiement confirmé — abonnement activé 30 jours.', { type: 'success' });
    } catch (e) {
      toast(`Confirmation impossible : ${e.message}`, { type: 'error' });
    }
    loadRemote();
  };

  const doReject = async (p) => {
    if (!serverMode) return rejectSubscriptionPayment(p.id);
    try {
      await adminRejectSubscriptionPayment(p.orgId, p.id);
    } catch (e) {
      toast(`Refus impossible : ${e.message}`, { type: 'error' });
    }
    loadRemote();
  };

  return (
    <div className="settings-tab">
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

      {serverMode && remote === null && (
        <div className="card"><div className="text-sm text-secondary">Chargement des abonnements…</div></div>
      )}

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
                {who(p)} · {p.methode === 'momo' ? 'T-Money (Yas)' : 'Flooz (Moov)'} {p.phone}
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
            <div key={`${s.orgId || ''}-${s.id}`} className="sheet-row">
              <span className="sheet-label">
                {who(s)}
                {serverMode && s.referredBy && (
                  <span className="text-secondary"> · <Handshake size={12} style={{ verticalAlign: -2 }} /> parrainé par {s.referredBy}</span>
                )}
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
          <div key={`${p.orgId || ''}-${p.id}`} className="sheet-row">
            <span className="sheet-label">{who(p)} · {formatDate(p.date)}</span>
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
        onConfirm={() => doConfirm(askConfirm)}
        title="Confirmer le paiement"
        message={askConfirm
          ? `Confirmer la réception de ${formatCFA(askConfirm.montant)} de ${who(askConfirm)} ? L'abonnement sera activé 30 jours${serverMode ? ' et la commission du parrain créditée' : ''}.`
          : ''}
        confirmLabel="Confirmer"
      />
      <ConfirmSheet
        open={!!askReject}
        onClose={() => setAskReject(null)}
        onConfirm={() => doReject(askReject)}
        title="Refuser le paiement"
        message={askReject
          ? `Refuser le paiement de ${formatCFA(askReject.montant)} de ${who(askReject)} ? L'abonnement ne sera pas activé.`
          : ''}
        confirmLabel="Refuser"
        danger
      />
    </div>
  );
}
