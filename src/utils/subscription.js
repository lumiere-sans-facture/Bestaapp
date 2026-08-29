// Module Devis Pro : règles de l'abonnement premium.
// Extension explicite : chargé aussi par Node côté serveur (api/paiement/*).
import { DAY_MS } from './date.js';

/**
 * Formules d'abonnement Devis Pro — LA source de vérité, unique et partagée.
 *
 * Le navigateur s'en sert pour afficher un prix, le serveur pour décider du
 * montant qu'il EXIGE et du nombre de jours qu'il crédite. C'est pour cela
 * que ce catalogue ne peut pas vivre côté écran : un montant annoncé par le
 * navigateur n'engage personne — celui-ci fait foi.
 *
 * Les trois formules sont celles de la page publique d'accueil. Le prix
 * mensuel sert de référence : les remises trimestrielle (−15 %) et annuelle
 * (−25 %) en découlent, elles ne sont pas des nombres indépendants.
 */
export const FORMULES = [
  { id: 'mensuel', libelle: 'Pro Essentiel', prix: 5000, jours: 30, mois: 1, periode: 'mois' },
  { id: 'trimestriel', libelle: 'Pro Confort', prix: 12750, jours: 90, mois: 3, periode: '3 mois' },
  // 365 jours, pas 12 × 30 : un abonnement vendu « à l'année » doit couvrir
  // une année, sinon il manque cinq jours au client.
  { id: 'annuel', libelle: 'Pro Premium', prix: 45000, jours: 365, mois: 12, periode: 'an' },
];

/** Formule retenue quand aucune n'est précisée — y compris pour tous les
 *  abonnements créés avant l'existence de ce catalogue. */
export const FORMULE_DEFAUT = 'mensuel';

/** Formule par identifiant. Un identifiant inconnu retombe sur la mensuelle :
 *  jamais sur la plus chère, et jamais sur une exception. */
export const formule = (id) => FORMULES.find((f) => f.id === id) || FORMULES[0];

/** L'identifiant désigne-t-il une formule du catalogue ? */
export const formuleValide = (id) => FORMULES.some((f) => f.id === id);

/**
 * Ce que la formule revient par mois — le chiffre qui rend la remise lisible
 * (« soit 3 750 F par mois »). Calculé sur les MOIS facturés, pas sur les
 * jours crédités : l'annuel couvre 365 jours mais se vend douze mois, et le
 * client compare des mois.
 */
export const prixMensuelEquivalent = (id) => {
  const f = formule(id);
  return Math.round(f.prix / f.mois);
};

// Le tarif et la durée de référence RESTENT ceux de la formule mensuelle :
// tout le code existant (alertes, écrans, serveur) continue de les lire sans
// rien savoir du catalogue.
export const SUBSCRIPTION_PRICE = formule(FORMULE_DEFAUT).prix; // F CFA / mois
export const SUBSCRIPTION_DAYS = formule(FORMULE_DEFAUT).jours;
export const RENEWAL_ALERT_DAYS = 3; // alerte à J-3

/** Statut effectif : un abonnement « actif » dont la date de fin est passée est expiré. */
export const effectiveStatus = (sub) => {
  if (!sub) return null;
  if (sub.status === 'actif' && sub.dateFin && new Date(sub.dateFin).getTime() < Date.now()) {
    return 'expire';
  }
  return sub.status;
};

// Actif = statut « actif » non expiré, OU renouvellement demandé alors que la
// période déjà payée court encore (demander son renouvellement ne doit jamais
// couper l'accès avant l'échéance).
export const isSubscriptionActive = (sub) => {
  const st = effectiveStatus(sub);
  if (st === 'actif') return true;
  return st === 'en_attente_paiement' && !!sub?.dateFin && new Date(sub.dateFin).getTime() > Date.now();
};

export const daysLeft = (sub) => {
  if (!sub?.dateFin) return 0;
  return Math.max(0, Math.ceil((new Date(sub.dateFin).getTime() - Date.now()) / DAY_MS));
};

/** Vrai si l'abonnement actif expire dans RENEWAL_ALERT_DAYS jours ou moins. */
export const needsRenewalAlert = (sub) =>
  isSubscriptionActive(sub) && daysLeft(sub) <= RENEWAL_ALERT_DAYS;
