// Module Devis Pro : règles de l'abonnement premium.
export const SUBSCRIPTION_PRICE = 5000; // F CFA / mois
export const SUBSCRIPTION_DAYS = 30;
export const RENEWAL_ALERT_DAYS = 3; // alerte à J-3

const DAY = 86400000;

/** Statut effectif : un abonnement « actif » dont la date de fin est passée est expiré. */
export const effectiveStatus = (sub) => {
  if (!sub) return null;
  if (sub.status === 'actif' && sub.dateFin && new Date(sub.dateFin).getTime() < Date.now()) {
    return 'expire';
  }
  return sub.status;
};

export const isSubscriptionActive = (sub) => effectiveStatus(sub) === 'actif';

export const daysLeft = (sub) => {
  if (!sub?.dateFin) return 0;
  return Math.max(0, Math.ceil((new Date(sub.dateFin).getTime() - Date.now()) / DAY));
};

/** Vrai si l'abonnement actif expire dans RENEWAL_ALERT_DAYS jours ou moins. */
export const needsRenewalAlert = (sub) =>
  isSubscriptionActive(sub) && daysLeft(sub) <= RENEWAL_ALERT_DAYS;
