import { ChevronLeft, Smartphone } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { formatCFA, formatDate } from '../../utils/format';

const STATUS = {
  initie: { label: 'Paiement initié', cls: 'badge-warning' },
  confirme: { label: 'Payée', cls: 'badge-success' },
  livre: { label: 'Livrée', cls: 'badge-success' },
  annule: { label: 'Annulée', cls: 'badge-muted' },
};

export default function OrdersSection({ onBack }) {
  const { orders, updateOrderStatus, getUserById } = useData();

  return (
    <>
      <button className="btn btn-outline btn-sm back-button" onClick={onBack}>
        <ChevronLeft size={16} /> Retour
      </button>
      <div className="section-title">Commandes en ligne ({(orders || []).length})</div>
      {(orders || []).length === 0 ? (
        <div className="empty-state card">
          <Smartphone size={36} strokeWidth={1.5} />
          <p>Aucune commande pour le moment. Elles apparaîtront ici quand un client paiera depuis le panier de la boutique.</p>
        </div>
      ) : (
        <div className="commissions-list">
          {(orders || []).map((o) => {
            const st = STATUS[o.status] || STATUS.initie;
            return (
              <div key={o.id} className="card commission-card">
                <div className="commission-header">
                  <div>
                    <div className="commission-lead">{o.orderNumber}</div>
                    <div className="text-sm text-secondary">
                      {formatDate(o.createdAt)} · {o.operator} {o.phone} · par {getUserById(o.createdBy)?.name?.split(' ')[0] || '—'}
                    </div>
                  </div>
                  <div className="commission-amount">{formatCFA(o.total)}</div>
                </div>
                <div className="commission-meta">
                  <span>{o.items.reduce((s, it) => s + it.qty, 0)} article(s)</span>
                  <span className="devis-card-actions">
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                    {o.status === 'initie' && (
                      <>
                        <button className="btn btn-sm btn-won" onClick={() => updateOrderStatus(o.id, 'confirme')}>Confirmer</button>
                        <button className="btn btn-sm btn-outline" onClick={() => updateOrderStatus(o.id, 'annule')}>Annuler</button>
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
