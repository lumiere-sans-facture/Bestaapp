import { useEffect, useRef, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { SUBSCRIPTION_PRICE } from '../utils/subscription';
import { normaliserMomo, problemeNumero } from '../utils/kkiapay';
import { champConfig, configActive } from '../utils/paiementProviders';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { confirmerPaiement } from '../lib/paiementServeur';
import { useToast } from './Toast';

// Repli quand aucun moyen de paiement n'est configuré dans l'app : les
// variables de build, seule source avant l'existence de l'écran « Moyens de
// paiement ». Bac à sable tant que VITE_KKIAPAY_SANDBOX n'est pas
// explicitement mis à « false » — mieux vaut un test qui ne débite personne
// qu'un vrai paiement déclenché par une variable oubliée.
const CLE_BUILD = import.meta.env.VITE_KKIAPAY_PUBLIC_KEY;
const SANDBOX_BUILD = import.meta.env.VITE_KKIAPAY_SANDBOX !== 'false';

// Script du widget, chargé UNE fois et seulement quand un bouton de paiement
// s'affiche vraiment. Placé dans index.html, il retardait l'ouverture de
// l'app entière le temps que le serveur de KKiaPay réponde.
const SCRIPT_WIDGET = 'https://cdn.kkiapay.me/k.js';
const chargerWidgetKkiapay = () => {
  if (typeof document === 'undefined') return;
  if (document.querySelector(`script[src="${SCRIPT_WIDGET}"]`)) return;
  const script = document.createElement('script');
  script.src = SCRIPT_WIDGET;
  script.async = true;
  document.head.appendChild(script);
};

/**
 * Réglages effectifs de KKiaPay. L'écran « Moyens de paiement » du gérant
 * prime sur les variables de build : changer d'agrégateur ou passer en réel
 * ne doit plus demander un redéploiement. Une configuration active pour un
 * AUTRE agrégateur vide la clé — KkiaPay n'encaisse pas ce que CinetPay doit
 * encaisser.
 */
const reglagesKkiapay = (paiementConfigs) => {
  const config = configActive(paiementConfigs);
  const configKkiapay = config?.provider === 'kkiapay' ? config : null;
  const kkiapayKey = config
    ? (configKkiapay ? champConfig(configKkiapay, 'publicKey') : '')
    : CLE_BUILD;
  const sandbox = config ? config.mode !== 'live' : SANDBOX_BUILD;
  return { config, kkiapayKey, sandbox };
};

/** Le paiement en ligne est-il réellement proposé aux clients ? Il ne l'est
 *  ni sans clé, ni en mode test. Sert aux écrans qui l'annoncent. */
export const usePaiementEnLigne = () => {
  const { paiementConfigs } = useData();
  const { kkiapayKey, sandbox } = reglagesKkiapay(paiementConfigs);
  return !!kkiapayKey && !sandbox;
};

/**
 * Bouton de paiement KKiaPay.
 *
 * Partagé par les DEUX écrans d'abonnement — la fiche « Passer en mode Pro »
 * (écran Plus, seul point d'entrée d'un NON-abonné) et l'onglet « Mon
 * abonnement » de l'espace Pro (renouvellement). Sans ce partage, le bouton
 * n'existait que côté Pro, donc uniquement visible par ceux qui avaient DÉJÀ
 * payé — invisible pour le client qui veut justement s'abonner.
 *
 * Sans clé publique — ni dans « Moyens de paiement », ni dans les variables de
 * build — le bouton ne s'affiche pas du tout : le paiement Mobile Money manuel
 * reste alors le seul parcours.
 *
 * En MODE TEST (bac à sable), le bouton est caché aux clients : un paiement
 * qui ne débite personne n'a rien à faire dans l'app publiée. Seul celui qui
 * configure l'encaissement est prévenu, pour savoir quoi basculer.
 *
 * @param {number} [amount]  montant à encaisser (défaut : l'abonnement Pro).
 * @param {{type: string, commandeId?: string}} [objet]  ce qui est payé — le
 *        serveur en déduit le montant ATTENDU et ce qu'il doit débloquer.
 */
export default function KkiapayButton({
  phone, label, onPaid, disabled = false,
  amount = SUBSCRIPTION_PRICE, objet = { type: 'abonnement' },
}) {
  const { paiementConfigs } = useData();
  const { user } = useAuth();
  const { config, kkiapayKey, sandbox: SANDBOX } = reglagesKkiapay(paiementConfigs);
  const [ouvert, setOuvert] = useState(false);
  const toast = useToast();
  // Les gestionnaires sont enregistrés UNE fois auprès du widget ; cette
  // référence leur donne accès aux valeurs courantes sans réenregistrement
  // (désabonner/réabonner à chaque frappe dans le champ téléphone ferait
  // manquer le retour de paiement s'il tombait entre les deux).
  const dernier = useRef({ phone, onPaid, objet });
  dernier.current = { phone, onPaid, objet };

  // Le script du widget est chargé depuis un CDN (index.html) : au premier
  // rendu il n'est pas forcément arrivé. On attend donc sa disponibilité au
  // lieu d'abandonner définitivement — sinon le retour de paiement n'était
  // jamais enregistré quand le réseau était lent.
  useEffect(() => {
    // Mode test : le bouton n'est pas affiché, le widget n'a rien à faire ici.
    if (!kkiapayKey || SANDBOX) return undefined;
    chargerWidgetKkiapay();
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
    // Le retour du widget ne prouve rien : il est reproductible depuis la
    // console. Il ne sert qu'à connaître la référence de transaction, que le
    // SERVEUR va vérifier auprès de l'agrégateur avant toute activation.
    const succes = async (reponse = {}) => {
      const reference = reponse.transactionId || reponse.transaction_id || reponse.id || '';
      setOuvert(false);
      const verdict = await confirmerPaiement(reference, dernier.current.objet);
      dernier.current.onPaid?.(reference, verdict);
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
  }, [kkiapayKey, SANDBOX]);

  // Qui règle l'encaissement : l'admin plateforme avec un backend (c'est la
  // configuration de BestaSolar qui encaisse), le gérant en mode local. Le
  // gérant d'une entreprise cliente n'y peut rien : inutile de l'alerter.
  const configureLEncaissement = isSupabaseConfigured ? !!user?.is_platform_admin : user?.role === 'gerant';

  // Aucune clé — ni configurée dans l'app, ni héritée du build : le bouton
  // n'a rien pour fonctionner. Disparaître sans un mot laissait chercher une
  // panne là où il n'y a qu'une configuration à faire ; celui qui peut agir
  // est donc prévenu, et lui seul.
  if (!kkiapayKey) {
    if (!configureLEncaissement) return null;
    return (
      <div className="field-hint" style={{ textAlign: 'center' }}>
        Paiement en ligne indisponible : {config
          ? `l'agrégateur activé (${config.provider}) n'a pas de clé publique renseignée.`
          : 'aucun moyen de paiement activé.'}
        {' '}À configurer dans <strong>Plus › Moyens de paiement</strong>.
      </div>
    );
  }

  // Mode test : aucun bouton, aucun numéro de test — rien que les clients
  // puissent voir. Le paiement Mobile Money manuel reste disponible.
  if (SANDBOX) {
    if (!configureLEncaissement) return null;
    return (
      <div className="field-hint" style={{ textAlign: 'center' }}>
        Paiement en ligne masqué à vos clients : KKiaPay est en <strong>mode test</strong>.
        {' '}Passez-le en mode réel dans <strong>Plus › Moyens de paiement</strong> pour l'ouvrir.
      </div>
    );
  }

  const ouvrir = () => {
    // Le widget se contente de « numéro n'est pas valide » : on explique
    // d'abord ce qui cloche, sinon l'échec reste incompréhensible.
    const probleme = problemeNumero(phone);
    if (probleme) {
      toast(probleme, { type: 'error' });
      return;
    }
    if (typeof window.openKkiapayWidget !== 'function') {
      // Chargé à la demande : il peut simplement ne pas être encore arrivé.
      chargerWidgetKkiapay();
      toast('Le paiement KKiaPay se charge — réessayez dans quelques secondes. Si cela persiste, vérifiez votre connexion.', { type: 'error' });
      return;
    }
    setOuvert(true);
    window.openKkiapayWidget({
      amount,
      key: kkiapayKey,
      sandbox: SANDBOX,
      paymentmethod: 'momo',
      // Format international sans « + » : un numéro local à 8 chiffres est
      // rejeté par KKiaPay, faute d'indicatif pour trouver l'opérateur.
      phone: normaliserMomo(phone),
      position: 'center',
      theme: '#0a2472',
      // Métadonnée renvoyée par l'agrégateur : elle permet au webhook de
      // savoir à quel compte créditer le paiement si le navigateur se ferme
      // avant d'avoir confirmé. Rien de secret n'y transite.
      data: JSON.stringify({ profilId: user?.id || '', ...objet }),
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
