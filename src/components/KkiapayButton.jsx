import { useEffect, useRef, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { SUBSCRIPTION_PRICE } from '../utils/subscription';
import { useToast } from './Toast';

/**
 * Bouton de paiement KKiaPay (abonnement Devis Pro).
 *
 * Partagé par les DEUX écrans d'abonnement — la fiche « Passer en mode Pro »
 * (écran Plus, seul point d'entrée d'un NON-abonné) et l'onglet « Mon
 * abonnement » de l'espace Pro (renouvellement). Sans ce partage, le bouton
 * n'existait que côté Pro, donc uniquement visible par ceux qui avaient DÉJÀ
 * payé — invisible pour le client qui veut justement s'abonner.
 *
 * Sans clé publique configurée (VITE_KKIAPAY_PUBLIC_KEY), le bouton ne s'affiche
 * pas du tout : le paiement Mobile Money manuel reste alors le seul parcours.
 */
export default function KkiapayButton({ phone, label, onPaid, disabled = false }) {
  const kkiapayKey = import.meta.env.VITE_KKIAPAY_PUBLIC_KEY;
  const [ouvert, setOuvert] = useState(false);
  const toast = useToast();
  // Les gestionnaires sont enregistrés UNE fois auprès du widget ; cette
  // référence leur donne accès aux valeurs courantes sans réenregistrement
  // (désabonner/réabonner à chaque frappe dans le champ téléphone ferait
  // manquer le retour de paiement s'il tombait entre les deux).
  const dernier = useRef({ phone, onPaid });
  dernier.current = { phone, onPaid };

  // Le script du widget est chargé depuis un CDN (index.html) : au premier
  // rendu il n'est pas forcément arrivé. On attend donc sa disponibilité au
  // lieu d'abandonner définitivement — sinon le retour de paiement n'était
  // jamais enregistré quand le réseau était lent.
  useEffect(() => {
    if (!kkiapayKey) return undefined;
    let arrete = false;
    let minuteur;

    const brancher = () => {
      if (arrete) return;
      if (typeof window.addSuccessListener !== 'function') {
        minuteur = setTimeout(brancher, 300);
        return;
      }
      window.addSuccessListener(succes);
      window.addFailedListener?.(echec);
    };
    const succes = (reponse = {}) => {
      const reference = reponse.transactionId || reponse.transaction_id || reponse.id || '';
      setOuvert(false);
      dernier.current.onPaid?.(reference);
    };
    const echec = () => {
      setOuvert(false);
      toast('Paiement KKiaPay non finalisé.', { type: 'error' });
    };

    brancher();
    return () => {
      arrete = true;
      clearTimeout(minuteur);
      window.removeSuccessListener?.(succes);
      window.removeFailedListener?.(echec);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kkiapayKey]);

  if (!kkiapayKey) return null;

  const ouvrir = () => {
    if (typeof window.openKkiapayWidget !== 'function') {
      toast('Le widget KKiaPay est indisponible. Rechargez la page puis réessayez.', { type: 'error' });
      return;
    }
    setOuvert(true);
    window.openKkiapayWidget({
      amount: SUBSCRIPTION_PRICE,
      key: kkiapayKey,
      sandbox: true,
      paymentmethod: 'momo',
      phone: String(phone || '').replace(/\D/g, ''),
      position: 'center',
      theme: '#0a2472',
    });
  };

  return (
    <button
      type="button"
      className="btn btn-primary btn-block"
      onClick={ouvrir}
      disabled={disabled || ouvert}
    >
      <CreditCard size={17} />
      {ouvert ? 'Paiement KKiaPay ouvert…' : label}
    </button>
  );
}
