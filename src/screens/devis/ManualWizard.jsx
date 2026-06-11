import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, CreditCard, Banknote } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { formatCFA } from '../../utils/format';

export const PAYMENT_OPTIONS = [
  { id: 'cash', label: 'Comptant', rate: 0, months: null, details: 'Paiement intégral à la livraison', icon: Banknote },
  { id: '6months', label: 'Crédit 6 mois', rate: 0.10, months: 6, details: 'Taux 10%', icon: CreditCard },
  { id: '12months', label: 'Crédit 12 mois', rate: 0.15, months: 12, details: 'Taux 15%', icon: CreditCard },
];

export default function ManualWizard({ onDone }) {
  const { user } = useAuth();
  const { products, addDevis, leadsForUser, partners } = useData();
  const [step, setStep] = useState(1);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [partnerId, setPartnerId] = useState('');
  const [items, setItems] = useState({});
  const [paymentType, setPaymentType] = useState('cash');

  const myLeads = leadsForUser(user);
  const availableLeads = myLeads.filter((l) => l.stage !== 'gagne' && l.stage !== 'perdu');
  const selectedLead = myLeads.find((l) => l.id === selectedLeadId);

  const getPrice = (basePrice) => (user.role === 'gerant' ? Math.round(basePrice * 1.15) : basePrice);

  const toggleProduct = (productId) => {
    setItems((prev) => {
      const next = { ...prev };
      if (next[productId]) delete next[productId];
      else next[productId] = 1;
      return next;
    });
  };

  const updateQty = (productId, delta) => {
    setItems((prev) => ({ ...prev, [productId]: Math.max(1, (prev[productId] || 1) + delta) }));
  };

  const subtotal = useMemo(
    () =>
      Object.entries(items).reduce((sum, [id, qty]) => {
        const product = products.find((p) => p.id === id);
        return sum + getPrice(product?.basePrice || 0) * qty;
      }, 0),
    [items, products] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const payment = PAYMENT_OPTIONS.find((p) => p.id === paymentType);
  const total = Math.round(subtotal * (1 + payment.rate));
  const monthly = payment.months ? Math.round(total / payment.months) : null;

  const handleSubmit = () => {
    // Prix unitaires figés au moment de la création (ils dépendent du rôle)
    const unitPrices = {};
    Object.keys(items).forEach((id) => {
      const product = products.find((p) => p.id === id);
      if (product) unitPrices[id] = getPrice(product.basePrice);
    });
    addDevis({
      type: 'manual',
      leadId: selectedLeadId,
      partnerId: partnerId || null,
      items: Object.entries(items).map(([productId, qty]) => ({ productId, qty })),
      unitPrices,
      paymentType,
      subtotal,
      total,
      monthly,
      createdBy: user.id,
    });
    onDone();
  };

  return (
    <div className="wizard">
      <div className="steps-indicator">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`step-dot ${step >= s ? 'active' : ''} ${step > s ? 'completed' : ''}`} />
        ))}
      </div>
      <div className="wizard-form card">
        {step === 1 && (
          <div>
            <div className="wizard-step-title">1. Sélectionnez un client</div>
            <div className="lead-select">
              {availableLeads.map((lead) => (
                <button
                  key={lead.id}
                  className={`lead-select-item ${selectedLeadId === lead.id ? 'selected' : ''}`}
                  onClick={() => { setSelectedLeadId(lead.id); setPartnerId(lead.parrainL1 || ''); }}
                >
                  <div className="lead-select-name">{lead.name}</div>
                  <div className="lead-select-value">{lead.contact} — {formatCFA(lead.estimatedValue)}</div>
                </button>
              ))}
              {availableLeads.length === 0 && <div className="empty-state">Aucune piste disponible. Créez d'abord une piste dans le pipeline.</div>}
            </div>
            <div className="input-group partner-field">
              <label className="input-label">Partenaire apporteur (commission)</label>
              <select className="input" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                <option value="">Aucun partenaire</option>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="field-hint">Tracé sur le devis — sert au calcul de la commission quand l'affaire est gagnée.</div>
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <div className="wizard-step-title">2. Ajoutez des produits</div>
            <div className="products-select">
              {products.filter((p) => p.stock > 0).map((product) => {
                const qty = items[product.id];
                return (
                  <div key={product.id} className={`product-select-item ${qty ? 'selected' : ''}`}>
                    <button className="product-checkbox" onClick={() => toggleProduct(product.id)} aria-label={`Sélectionner ${product.name}`}>
                      {qty && <Check size={14} />}
                    </button>
                    <button className="product-select-info" onClick={() => toggleProduct(product.id)}>
                      <div className="product-select-name">{product.name}</div>
                      <div className="product-select-price">{formatCFA(getPrice(product.basePrice))}</div>
                    </button>
                    {qty && (
                      <div className="qty-stepper">
                        <button className="btn btn-sm btn-outline" onClick={() => updateQty(product.id, -1)}>−</button>
                        <span className="qty-value">{qty}</span>
                        <button className="btn btn-sm btn-outline" onClick={() => updateQty(product.id, 1)}>+</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="devis-summary">
              <div className="devis-summary-row"><span>Sous-total</span><span>{formatCFA(subtotal)}</span></div>
            </div>
          </div>
        )}
        {step === 3 && (
          <div>
            <div className="wizard-step-title">3. Mode de paiement</div>
            <div className="payment-options">
              {PAYMENT_OPTIONS.map((opt) => {
                const optTotal = Math.round(subtotal * (1 + opt.rate));
                const optMonthly = opt.months ? Math.round(optTotal / opt.months) : null;
                return (
                  <button
                    key={opt.id}
                    className={`payment-option ${paymentType === opt.id ? 'selected' : ''}`}
                    onClick={() => setPaymentType(opt.id)}
                  >
                    <div className="payment-option-header">
                      <div className="payment-option-icon"><opt.icon size={18} /></div>
                      <div className="payment-option-label">{opt.label}</div>
                      <div className="payment-option-price">{formatCFA(optTotal)}</div>
                    </div>
                    <div className="payment-option-details">
                      {optMonthly ? `${formatCFA(optMonthly)}/mois — ${opt.details}` : opt.details}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="devis-summary">
              <div className="devis-summary-row"><span>Sous-total</span><span>{formatCFA(subtotal)}</span></div>
              {payment.rate > 0 && (
                <div className="devis-summary-row credit"><span>Intérêts ({Math.round(payment.rate * 100)}%)</span><span>{formatCFA(total - subtotal)}</span></div>
              )}
              <div className="devis-summary-row total"><span>Total</span><span>{formatCFA(total)}</span></div>
            </div>
          </div>
        )}
        <div className="wizard-actions">
          {step > 1 && (
            <button className="btn btn-outline btn-block" onClick={() => setStep(step - 1)}>
              <ChevronLeft size={18} /> Précédent
            </button>
          )}
          {step < 3 ? (
            <button
              className="btn btn-primary btn-block"
              onClick={() => setStep(step + 1)}
              disabled={(step === 1 && !selectedLeadId) || (step === 2 && Object.keys(items).length === 0)}
            >
              Suivant <ChevronRight size={18} />
            </button>
          ) : (
            <button className="btn btn-accent btn-block" onClick={handleSubmit}>
              <Check size={18} /> Créer le devis{selectedLead ? ` pour ${selectedLead.name}` : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
