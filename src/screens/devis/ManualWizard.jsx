import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { formatCFA } from '../../utils/format';
import { resolveAutoPartner } from '../../utils/referral';
import PartnerField from './PartnerField';
import LeadPicker from './LeadPicker';

export default function ManualWizard({ onDone, initialItems, initialLeadId = null }) {
  const { user } = useAuth();
  const { products, addDevis, leadsForUser, partners, ensurePartnerForUser } = useData();
  // Client déjà choisi (fiche client) : l'étape de sélection est sautée.
  const [step, setStep] = useState(initialLeadId ? 2 : 1);
  const [selectedLeadId, setSelectedLeadId] = useState(initialLeadId);
  const [partnerId, setPartnerId] = useState('');

  // Chaque devis a impérativement un apporteur : le profil partenaire du
  // créateur sert de repli quand la piste n'en a pas — on le crée d'office.
  useEffect(() => {
    ensurePartnerForUser(user);
  }, [user, ensurePartnerForUser]);

  // L'apporteur suit le client sélectionné : parrain de la piste, sinon
  // lien d'affiliation actif, sinon profil partenaire du créateur.
  useEffect(() => {
    if (!selectedLeadId) return;
    const lead = leadsForUser(user).find((l) => l.id === selectedLeadId);
    setPartnerId(lead ? resolveAutoPartner(lead, partners, user.id)?.id || '' : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeadId, partners]);
  // Pré-rempli depuis le panier de la boutique le cas échéant
  const [items, setItems] = useState(() => ({ ...(initialItems || {}) }));

  // Toute la liste des clients est proposée (un client gagné peut recommander).
  const myLeads = leadsForUser(user);
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

  const handleSubmit = (statut = 'finalise') => {
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
      subtotal,
      total: subtotal, // paiement comptant uniquement
      statut,
      createdBy: user.id,
    });
    onDone();
  };

  return (
    <div className="wizard">
      <div className="steps-indicator">
        {[1, 2].map((s) => (
          <div key={s} className={`step-dot ${step >= s ? 'active' : ''} ${step > s ? 'completed' : ''}`} />
        ))}
      </div>
      <div className="wizard-form card">
        {step === 1 && (
          <div>
            <div className="wizard-step-title">1. Sélectionnez un client</div>
            <LeadPicker leads={myLeads} selectedLeadId={selectedLeadId} onSelect={setSelectedLeadId} />
            {selectedLeadId && <PartnerField value={partnerId} />}
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
              <div className="devis-summary-row total"><span>Total — paiement comptant</span><span>{formatCFA(subtotal)}</span></div>
            </div>
          </div>
        )}
        <div className="wizard-actions">
          {step > 1 && (
            <button className="btn btn-outline btn-block" onClick={() => setStep(step - 1)}>
              <ChevronLeft size={18} /> Précédent
            </button>
          )}
          {step < 2 ? (
            <button className="btn btn-primary btn-block" onClick={() => setStep(2)} disabled={!selectedLeadId}>
              Suivant <ChevronRight size={18} />
            </button>
          ) : (
            <>
              <button className="btn btn-outline btn-block" onClick={() => handleSubmit('brouillon')} disabled={Object.keys(items).length === 0}>
                Brouillon
              </button>
              <button className="btn btn-accent btn-block" onClick={() => handleSubmit('finalise')} disabled={Object.keys(items).length === 0}>
                <Check size={18} /> Créer le devis{selectedLead ? ` pour ${selectedLead.name}` : ''}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
