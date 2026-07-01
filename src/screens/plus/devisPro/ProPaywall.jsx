import { useState } from 'react';
import { ChevronLeft, Crown, Check, Clock } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { formatCFA, formatDate } from '../../../utils/format';
import { SUBSCRIPTION_PRICE } from '../../../utils/subscription';
import Field from '../../../components/Field';

/** Écran d'accroche affiché aux techniciens non abonnés à Devis Pro. */
export default function ProPaywall({ onBack, sub, status }) {
  const { user } = useAuth();
  const { requestSubscription } = useData();
  const [subForm, setSubForm] = useState({ methode: 'momo', phone: user.phone || '', reference: '' });
  const [subSent, setSubSent] = useState(false);

  return (
    <>
      <button className="btn btn-outline btn-sm back-button" onClick={onBack}>
        <ChevronLeft size={16} /> Retour
      </button>
      <div className="pro-paywall card">
        <div className="pro-paywall-icon"><Crown size={30} /></div>
        <h2 className="pro-paywall-title">Passez à Devis Pro</h2>
        <p className="pro-paywall-price"><strong>{formatCFA(SUBSCRIPTION_PRICE)}</strong> / mois</p>
        <ul className="pro-benefits">
          <li><Check size={15} /> Devis personnalisés à <strong>votre entreprise</strong> (logo, couleurs, coordonnées)</li>
          <li><Check size={15} /> Génération de <strong>factures</strong> numérotées automatiquement</li>
          <li><Check size={15} /> <strong>3 modèles</strong> de mise en page professionnels</li>
          <li><Check size={15} /> Conversion devis → facture en un clic</li>
          <li><Check size={15} /> Dimensionnement solaire BestaSolar inclus</li>
        </ul>

        {status === 'en_attente_paiement' || subSent ? (
          <div className="pro-pending">
            <Clock size={18} />
            <div>
              <strong>Paiement en attente de validation</strong>
              <div className="text-sm text-secondary">Votre abonnement sera activé dès que le gérant aura confirmé la réception de votre paiement Mobile Money.</div>
            </div>
          </div>
        ) : (
          <form className="pro-subscribe-form" onSubmit={(e) => { e.preventDefault(); requestSubscription(user.id, subForm); setSubSent(true); }}>
            <div className="form-row-2">
              <Field label="Opérateur">
                <select className="input" value={subForm.methode} onChange={(e) => setSubForm({ ...subForm, methode: e.target.value })}>
                  <option value="momo">MTN MoMo</option>
                  <option value="moov">Moov Money</option>
                </select>
              </Field>
              <Field label="Votre numéro">
                <input className="input" type="tel" required value={subForm.phone} onChange={(e) => setSubForm({ ...subForm, phone: e.target.value })} placeholder="+229 ..." />
              </Field>
            </div>
            <Field label="Référence de la transaction (optionnel)">
              <input className="input" value={subForm.reference} onChange={(e) => setSubForm({ ...subForm, reference: e.target.value })} placeholder="Ex : ID du transfert MoMo" />
              <div className="field-hint">Envoyez {formatCFA(SUBSCRIPTION_PRICE)} au +229 016 173 2956, puis validez ce formulaire.</div>
            </Field>
            <button type="submit" className="btn btn-accent btn-block btn-lg">
              <Crown size={18} /> S'abonner — {formatCFA(SUBSCRIPTION_PRICE)}/mois
            </button>
          </form>
        )}
        {status === 'expire' && sub?.dateFin && (
          <div className="field-hint pro-expired-note">Votre abonnement a expiré le {formatDate(sub.dateFin)}. Renouvelez pour retrouver vos documents Pro.</div>
        )}
      </div>
    </>
  );
}
