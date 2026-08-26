import { useState } from 'react';
import { CreditCard, Crown, Clock, Check } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { useToast } from '../../../components/Toast';
import Field from '../../../components/Field';
import KkiapayButton from '../../../components/KkiapayButton';
import { formatCFA, formatDate } from '../../../utils/format';
import { effectiveStatus, daysLeft, formule, FORMULE_DEFAUT } from '../../../utils/subscription';
import { lireFormuleChoisie, oublierFormuleChoisie } from '../../../utils/formuleChoisie';
import ChoixFormule from '../../../components/ChoixFormule';
import { PAY_NUMBER } from '../../../config/company';
import { suivre, EVENEMENTS } from '../../../lib/analytique';

/**
 * Onglet « Mon abonnement » : trois états.
 * - Aucun abonnement : offre Devis Pro + paiement MoMo + demande d'activation
 *   (c'est l'écran d'accueil d'un installateur qui vient de s'inscrire).
 * - En attente : la demande est envoyée, l'activation arrive.
 * - Actif / expiré : statut, renouvellement, historique des paiements.
 */
export default function SubscriptionTab({ sub }) {
  const { user } = useAuth();
  const { subscriptionPayments, requestSubscription, activerAbonnementVerifie } = useData();
  const toast = useToast();
  const [subSent, setSubSent] = useState(false);
  // Formule pré-sélectionnée : celle choisie sur la page d'accueil, sinon
  // celle de l'abonnement en cours — on renouvelle par défaut ce qu'on a pris.
  const [form, setForm] = useState(() => ({
    methode: 'momo', phone: user.phone || '', reference: '',
    formule: lireFormuleChoisie() || sub?.formule || FORMULE_DEFAUT,
  }));
  const f = formule(form.formule);
  const status = effectiveStatus(sub);
  const myPayments = (subscriptionPayments || []).filter((p) => p.userId === user.id);

  const copyPayNumber = async () => {
    try {
      await navigator.clipboard.writeText(PAY_NUMBER);
      toast('Numéro copié.');
    } catch {
      toast(`Copie impossible — composez le ${PAY_NUMBER}.`, { type: 'error' });
    }
  };

  // Le serveur (api/paiement/verifier) a interrogé l'agrégateur avec les clés
  // privée et secrète avant de répondre : son verdict fait autorité, pas le
  // retour du widget. Sans vérification possible (hors-ligne, serveur non
  // configuré), on retombe sur la validation manuelle du gérant.
  const paiementKkiapay = (reference, verdict = {}) => {
    if (verdict.refuse) {
      toast(verdict.motif || 'Paiement non abouti.', { type: 'error' });
      return;
    }
    if (verdict.active) {
      suivre(EVENEMENTS.PAIEMENT_VERIFIE, { objet: 'abonnement', montant: f.prix, formule: f.id });
      activerAbonnementVerifie(user.id, { reference, montant: f.prix, dateFin: verdict.dateFin, formule: f.id });
      oublierFormuleChoisie();
      setSubSent(true);
      toast(verdict.deja ? 'Ce paiement était déjà pris en compte.' : 'Paiement vérifié — abonnement activé.');
      return;
    }
    requestSubscription(user.id, { methode: 'kkiapay', phone: form.phone, reference, formule: f.id });
    oublierFormuleChoisie();
    setSubSent(true);
    toast('Paiement enregistré — vérification par le gérant en attente.');
  };

  const demander = (e) => {
    e.preventDefault();
    requestSubscription(user.id, form);
    oublierFormuleChoisie();
    setSubSent(true);
    toast('Demande envoyée — activation dès validation du paiement.');
  };

  // ---- Aucun abonnement : première souscription ----
  if (!sub && !subSent) {
    return (
      <div className="card my-partner-section">
        <div className="card-title"><Crown size={15} /> Activer Devis Pro — {formatCFA(f.prix)} / {f.periode}</div>
        <ul className="pro-benefits">
          <li><Check size={16} /> Devis et factures à l'identité de votre entreprise (logo, couleurs)</li>
          <li><Check size={16} /> Dimensionnement solaire guidé jusqu'au devis chiffré</li>
          <li><Check size={16} /> Carnet clients, suivi des encaissements et relances WhatsApp</li>
        </ul>
        <form onSubmit={demander}>
          <ChoixFormule value={form.formule} onChange={(id) => setForm({ ...form, formule: id })} />
          <div className="form-row-2">
            <Field label="Opérateur">
              <select className="input" value={form.methode} onChange={(e) => setForm({ ...form, methode: e.target.value })}>
                <option value="momo">T-Money (Yas)</option>
                <option value="moov">Flooz (Moov)</option>
              </select>
            </Field>
            <Field label="Votre numéro">
              <input className="input" type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+228 ..." />
            </Field>
          </div>
          <p className="text-sm">Envoyez {formatCFA(f.prix)} par Mobile Money à ce numéro, puis validez :</p>
          <div className="copy-block">
            <span className="copy-block-value">{PAY_NUMBER}</span>
            <button type="button" className="btn btn-sm btn-outline" onClick={copyPayNumber}>Copier</button>
          </div>
          <Field label="Référence de la transaction (optionnel)">
            <input className="input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Ex : ID du transfert MoMo" />
          </Field>
          <KkiapayButton
            phone={form.phone}
            amount={f.prix}
            objet={{ type: 'abonnement', formule: f.id }}
            label={`Payer ${formatCFA(f.prix)} avec KKiaPay (test)`}
            disabled={!form.phone}
            onNumero={(numero) => setForm({ ...form, phone: numero })}
            onPaid={paiementKkiapay}
          />
          <button type="submit" className="btn btn-accent btn-block btn-lg">
            <Crown size={18} /> J'ai payé — demander l'activation
          </button>
        </form>
      </div>
    );
  }

  // ---- Demande envoyée / en attente de validation ----
  if (subSent || status === 'en_attente_paiement' || (sub && !sub.dateFin)) {
    return (
      <div className="card my-partner-section">
        <div className="card-title"><CreditCard size={15} /> Mon abonnement Devis Pro</div>
        <div className="pro-pending">
          <Clock size={17} />
          <div>
            <strong>Paiement en attente de validation.</strong>
            <div className="text-sm text-secondary">Votre espace sera activé dès que BestaSolar aura confirmé la réception de votre paiement — en général sous quelques heures.</div>
          </div>
        </div>
        {myPayments.length > 0 && <Historique paiements={myPayments} />}
      </div>
    );
  }

  // ---- Abonnement actif ou expiré ----
  return (
    <div className="card my-partner-section">
      <div className="card-title"><CreditCard size={15} /> Mon abonnement Devis Pro</div>
      <div className="sheet-row"><span className="sheet-label">Statut</span><span className="sheet-value">{
        status === 'actif' ? <span className="badge badge-success">Actif</span>
        : <span className="badge badge-danger">Expiré</span>
      }</span></div>
      {sub.dateFin && (
        <div className="sheet-row"><span className="sheet-label">Expire le</span><span className="sheet-value">{formatDate(sub.dateFin)} ({daysLeft(sub)} jour(s) restants)</span></div>
      )}
      <div className="sheet-row"><span className="sheet-label">Formule</span><span className="sheet-value">{formule(sub.formule).libelle} — {formatCFA(sub.montant)} / {formule(sub.formule).periode}</span></div>
      <ChoixFormule value={form.formule} onChange={(id) => setForm({ ...form, formule: id })} />
      <p className="text-sm" style={{ margin: '10px 0 4px' }}>Pour renouveler : envoyez {formatCFA(f.prix)} au numéro ci-dessous, puis validez.</p>
      <div className="copy-block">
        <span className="copy-block-value">{PAY_NUMBER}</span>
        <button type="button" className="btn btn-sm btn-outline" onClick={copyPayNumber}>Copier</button>
      </div>
      <KkiapayButton
        phone={form.phone}
        amount={f.prix}
        objet={{ type: 'abonnement', formule: f.id }}
        label={`Renouveler ${formatCFA(f.prix)} avec KKiaPay (test)`}
        disabled={!form.phone}
        onNumero={(numero) => setForm({ ...form, phone: numero })}
        onPaid={paiementKkiapay}
      />
      <button className="btn btn-accent btn-block" onClick={() => { requestSubscription(user.id, { methode: 'momo', phone: user.phone || '', reference: '', formule: f.id }); setSubSent(true); }}>
        <Crown size={16} /> J'ai payé — demander le renouvellement (+{f.jours} jours)
      </button>
      <Historique paiements={myPayments} />
    </div>
  );
}

function Historique({ paiements }) {
  return (
    <>
      <div className="card-title my-partner-subtitle">Historique des paiements</div>
      {paiements.length ? paiements.map((p) => (
        <div key={p.id} className="sheet-row">
          <span className="sheet-label">{formatDate(p.date)} · {p.methode === 'momo' ? 'T-Money (Yas)' : 'Flooz (Moov)'}{p.referenceTransaction ? ` · ${p.referenceTransaction}` : ''}</span>
          <span className="sheet-value">
            {formatCFA(p.montant)}{' '}
            <span className={`badge ${p.statut === 'confirme' ? 'badge-success' : p.statut === 'initie' ? 'badge-warning' : 'badge-muted'}`}>
              {{ confirme: 'Confirmé', initie: 'En attente', rejete: 'Rejeté' }[p.statut]}
            </span>
          </span>
        </div>
      )) : <div className="text-sm text-secondary">Aucun paiement enregistré.</div>}
    </>
  );
}
