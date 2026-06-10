import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Check, CreditCard, Banknote } from 'lucide-react';
import { products, leads, formatCFA } from '../data/mockData';

export default function Devis({ user }) {
  const [step, setStep] = useState(1);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [paymentType, setPaymentType] = useState('cash');

  const userLeads = user.role === 'gerant' ? leads : leads.filter(l => l.assignedTo === user.id);
  const availableLeads = userLeads.filter(l => l.stage !== 'gagne');

  const toggleProduct = (productId) => {
    setSelectedProducts(prev => {
      if (prev.includes(productId)) {
        const newQty = { ...quantities };
        delete newQty[productId];
        setQuantities(newQty);
        return prev.filter(id => id !== productId);
      }
      setQuantities(prev => ({ ...prev, [productId]: 1 }));
      return [...prev, productId];
    });
  };

  const updateQty = (productId, delta) => {
    setQuantities(prev => ({ ...prev, [productId]: Math.max(1, (prev[productId] || 1) + delta) }));
  };

  const subtotal = useMemo(() => selectedProducts.reduce((sum, id) => {
    const product = products.find(p => p.id === id);
    return sum + (product?.basePrice || 0) * (quantities[id] || 1);
  }, 0), [selectedProducts, quantities]);

  const creditAmount = useMemo(() => {
    if (paymentType === '6months') return Math.round(subtotal * 1.10);
    if (paymentType === '12months') return Math.round(subtotal * 1.15);
    return subtotal;
  }, [subtotal, paymentType]);

  const monthlyPayment = useMemo(() => {
    if (paymentType === '6months') return Math.round(creditAmount / 6);
    if (paymentType === '12months') return Math.round(creditAmount / 12);
    return null;
  }, [creditAmount, paymentType]);

  const handleSubmit = () => {
    alert(`Devis créé pour ${selectedLead?.name}!\nTotal: ${formatCFA(creditAmount)}`);
    setStep(1); setSelectedLead(null); setSelectedProducts([]); setQuantities({}); setPaymentType('cash');
  };

  const getPrice = (basePrice) => user.role === 'gerant' ? Math.round(basePrice * 1.15) : basePrice;

  return (
    <>
      <div className="devis-header"><h1 className="screen-title">Nouveau Devis</h1></div>
      <div className="steps-indicator">
        <div className={`step-dot ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`} />
        <div className={`step-dot ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`} />
        <div className={`step-dot ${step >= 3 ? 'active' : ''}`} />
      </div>
      <div className="wizard-form">
        {step === 1 && (
          <div>
            <div className="wizard-step-title">Sélectionnez un client</div>
            <div className="lead-select">
              {availableLeads.map(lead => (
                <div key={lead.id} className={`lead-select-item ${selectedLead?.id === lead.id ? 'selected' : ''}`} onClick={() => setSelectedLead(lead)}>
                  <div className="lead-select-name">{lead.name}</div>
                  <div className="lead-select-value">{lead.contact} - {formatCFA(lead.estimatedValue)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <div className="wizard-step-title">Ajoutez des produits</div>
            <div className="products-select">
              {products.filter(p => p.stock > 0).map(product => {
                const isSelected = selectedProducts.includes(product.id);
                const qty = quantities[product.id] || 1;
                return (
                  <div key={product.id} className={`product-select-item ${isSelected ? 'selected' : ''}`}>
                    <div className="product-checkbox" onClick={() => toggleProduct(product.id)}>{isSelected && <Check size={14} />}</div>
                    <div className="product-select-info" onClick={() => toggleProduct(product.id)}>
                      <div className="product-select-name">{product.name}</div>
                      <div className="product-select-price">{formatCFA(getPrice(product.basePrice))}</div>
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-2">
                        <button className="btn btn-sm btn-outline" onClick={() => updateQty(product.id, -1)}>-</button>
                        <span style={{ fontWeight: 500, minWidth: '24px', textAlign: 'center' }}>{qty}</span>
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
            <div className="wizard-step-title">Mode de paiement</div>
            <div className="payment-options">
              <div className={`payment-option ${paymentType === 'cash' ? 'selected' : ''}`} onClick={() => setPaymentType('cash')}>
                <div className="payment-option-header">
                  <div className="payment-option-icon"><Banknote size={18} /></div>
                  <div className="payment-option-label">Comptant</div>
                  <div className="payment-option-price">{formatCFA(subtotal)}</div>
                </div>
                <div className="payment-option-details">Paiement intégral à la livraison</div>
              </div>
              <div className={`payment-option ${paymentType === '6months' ? 'selected' : ''}`} onClick={() => setPaymentType('6months')}>
                <div className="payment-option-header">
                  <div className="payment-option-icon"><CreditCard size={18} /></div>
                  <div className="payment-option-label">Crédit 6 mois</div>
                  <div className="payment-option-price">{formatCFA(creditAmount)}</div>
                </div>
                <div className="payment-option-details">{formatCFA(monthlyPayment)}/mois - Taux 10%</div>
              </div>
              <div className={`payment-option ${paymentType === '12months' ? 'selected' : ''}`} onClick={() => setPaymentType('12months')}>
                <div className="payment-option-header">
                  <div className="payment-option-icon"><CreditCard size={18} /></div>
                  <div className="payment-option-label">Crédit 12 mois</div>
                  <div className="payment-option-price">{formatCFA(creditAmount)}</div>
                </div>
                <div className="payment-option-details">{formatCFA(monthlyPayment)}/mois - Taux 15%</div>
              </div>
            </div>
            <div className="devis-summary" style={{ marginTop: '16px' }}>
              <div className="devis-summary-row"><span>Sous-total</span><span>{formatCFA(subtotal)}</span></div>
              {paymentType !== 'cash' && <div className="devis-summary-row credit"><span>Intérêts ({paymentType === '6months' ? '10%' : '15%'})</span><span>{formatCFA(creditAmount - subtotal)}</span></div>}
              <div className="devis-summary-row total"><span>Total</span><span>{formatCFA(creditAmount)}</span></div>
            </div>
          </div>
        )}
        <div className="wizard-actions">
          {step > 1 && <button className="btn btn-outline btn-block" onClick={() => setStep(step - 1)}><ChevronLeft size={18} />Précédent</button>}
          {step < 3 ? (
            <button className="btn btn-primary btn-block" onClick={() => setStep(step + 1)} disabled={(step === 1 && !selectedLead) || (step === 2 && selectedProducts.length === 0)}>Suivant<ChevronRight size={18} /></button>
          ) : (
            <button className="btn btn-accent btn-block" onClick={handleSubmit}><Check size={18} />Créer le devis</button>
          )}
        </div>
      </div>
    </>
  );
}
