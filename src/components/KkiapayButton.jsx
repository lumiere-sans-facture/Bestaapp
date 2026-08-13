import { useEffect, useRef, useState } from 'react';
import { CreditCard, FlaskConical } from 'lucide-react';
import { SUBSCRIPTION_PRICE } from '../utils/subscription';
import { NUMEROS_TEST_SANDBOX, formatMomo, normaliserMomo, problemeNumero } from '../utils/kkiapay';
import { useToast } from './Toast';

// Bac à sable tant que VITE_KKIAPAY_SANDBOX n'est pas explicitement mis à
// « false » : mieux vaut un test qui ne débite personne qu'un vrai paiement
// déclenché par une variable oubliée.
const SANDBOX = import.meta.env.VITE_KKIAPAY_SANDBOX !== 'false';

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
 *
 * @param {(numero: string) => void} [onNumero] permet de proposer les numéros
 *        de test en mode bac à sable (le parent remplit son champ téléphone).
 */
export default function KkiapayButton({ phone, label, onPaid, onNumero, disabled = false }) {
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
    // Le widget se contente de « numéro n'est pas valide » : on explique
    // d'abord ce qui cloche, sinon l'échec reste incompréhensible.
    const probleme = problemeNumero(phone, { sandbox: SANDBOX });
    if (probleme) {
      toast(probleme, { type: 'error' });
      return;
    }
    if (typeof window.openKkiapayWidget !== 'function') {
      toast('Le widget KKiaPay est indisponible. Rechargez la page puis réessayez.', { type: 'error' });
      return;
    }
    setOuvert(true);
    window.openKkiapayWidget({
      amount: SUBSCRIPTION_PRICE,
      key: kkiapayKey,
      sandbox: SANDBOX,
      paymentmethod: 'momo',
      // Format international sans « + » : un numéro local à 8 chiffres est
      // rejeté par KKiaPay, faute d'indicatif pour trouver l'opérateur.
      phone: normaliserMomo(phone),
      position: 'center',
      theme: '#0a2472',
    });
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={ouvrir}
        disabled={disabled || ouvert}
      >
        <CreditCard size={17} />
        {ouvert ? 'Paiement KKiaPay ouvert…' : label}
      </button>

      {/* Le bac à sable KKiaPay ne connaît que ses propres numéros, tous
          béninois : sans cette liste, tout essai avec un vrai numéro togolais
          se solde par « numéro n'est pas valide », sans explication. */}
      {SANDBOX && (
        <div className="kkiapay-sandbox">
          <div className="kkiapay-sandbox-titre">
            <FlaskConical size={13} /> Mode test — numéros acceptés
          </div>
          <div className="kkiapay-sandbox-liste">
            {NUMEROS_TEST_SANDBOX.map((t) => (
              <button key={t.numero} type="button" className="kkiapay-sandbox-num"
                disabled={!onNumero}
                onClick={() => onNumero?.(formatMomo(t.numero))}>
                <span className="kkiapay-sandbox-numero">{formatMomo(t.numero)}</span>
                <span className="kkiapay-sandbox-scenario">{t.operateur} · {t.scenario}</span>
              </button>
            ))}
          </div>
          <div className="field-hint">
            Aucun argent n’est débité. Un vrai numéro sera refusé tant que le mode test est actif.
          </div>
        </div>
      )}
    </>
  );
}
