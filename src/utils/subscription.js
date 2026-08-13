// Module Devis Pro : règles de l'abonnement premium.
// Extension explicite : chargé aussi par Node côté serveur (api/paiement/*).
import { DAY_MS } from './date.js';

export const SUBSCRIPTION_PRICE = 5000; // F CFA / mois
export const SUBSCRIPTION_DAYS = 30;
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
