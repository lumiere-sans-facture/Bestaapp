// Suppression de compte : ce qui doit disparaître de l'APPAREIL une fois le
// compte supprimé côté serveur (supabase/suppression-compte.sql).
//
// Le nettoyage ne peut pas se faire au moment du clic : en quittant la page,
// l'app réécrit son état en mémoire dans le stockage (sauvegarde de
// fermeture, voir DataContext). On pose donc une consigne, et c'est le
// démarrage suivant — avant que React ne relise quoi que ce soit — qui
// l'exécute.

export const CLE_CONSIGNE_PURGE = 'bestasolar_purge_compte';

// Clés propres à la personne connectée, quelle que soit l'entreprise.
const CLES_PERSONNELLES = [
  'bestasolar_user', 'bestasolar_profil', 'bestasolar_cart', 'bestasolar_formule_choisie',
  'bestasolar_analytique_file', 'bestasolar_erreurs_file',
  'bestasolar_session_last_active_at', 'bestasolar_session_started_at',
  'bestasolar_pending_signup', 'bestasolar_google_signup',
];

/**
 * Clés du stockage local à effacer pour ce compte. Les données d'une AUTRE
 * entreprise connectée un jour sur le même appareil sont laissées : elles
 * peuvent contenir des envois pas encore partis.
 * @param {string[]} cles  toutes les clés présentes
 * @param {{scope?: string|null, userId?: string|null}} compte
 */
export const clesAPurger = (cles = [], { scope = null, userId = null } = {}) => cles.filter((k) => (
  CLES_PERSONNELLES.includes(k)
  // Jeton de session Supabase : s'il survivait, l'app rouvrirait la session
  // du compte supprimé, ne lui trouverait plus de profil… et en recréerait
  // un. Il part donc toujours, même si la déconnexion réseau a échoué.
  || /^sb-.+-auth-token$/.test(k)
  || (!!scope && [`bestasolar_data_${scope}`, `bestasolar_file_sync_${scope}`, `bestasolar_cart_${scope}`].includes(k))
  || (!!userId && (k === `bestasolar_mode_${userId}` || (k.startsWith('bestasolar_guide_accueil_') && k.endsWith(`:${userId}`))))
));

/** Pose la consigne de nettoyage, exécutée au prochain démarrage. */
export const poserConsignePurge = (compte, stockage = globalThis.localStorage) => {
  try { stockage.setItem(CLE_CONSIGNE_PURGE, JSON.stringify(compte)); } catch { /* stockage indisponible */ }
};

/**
 * Exécute la consigne s'il y en a une. À appeler au tout début du
 * démarrage, avant le premier rendu.
 * @returns {number} nombre de clés effacées
 */
export const executerConsignePurge = (stockage = globalThis.localStorage) => {
  try {
    const brut = stockage.getItem(CLE_CONSIGNE_PURGE);
    if (!brut) return 0;
    const compte = JSON.parse(brut) || {};
    const cles = Array.from({ length: stockage.length }, (_, i) => stockage.key(i)).filter(Boolean);
    const aEffacer = clesAPurger(cles, compte);
    aEffacer.forEach((k) => stockage.removeItem(k));
    stockage.removeItem(CLE_CONSIGNE_PURGE);
    return aEffacer.length;
  } catch {
    return 0;
  }
};

/** Mot à recopier pour confirmer : une suppression ne part pas sur un clic égaré. */
export const MOT_CONFIRMATION = 'SUPPRIMER';

export const confirmationValide = (saisie) => String(saisie ?? '').trim().toUpperCase() === MOT_CONFIRMATION;

/** Messages de refus du serveur — jamais de donnée du compte dedans. */
export const MESSAGES_REFUS_SUPPRESSION = {
  admin: 'Ce compte administre la plateforme : il ne peut pas être supprimé depuis l’app.',
  gerant: 'Vous êtes le gérant d’une équipe : l’équipe ne peut pas rester sans gérant. Écrivez-nous pour transférer le rôle, puis supprimez votre compte.',
  interne: 'Ce compte porte le catalogue partagé de BestaSolar : il ne peut pas être supprimé depuis l’app.',
  session: 'Session expirée : reconnectez-vous, puis recommencez.',
  reseau: 'Suppression impossible : serveur injoignable. Vérifiez votre connexion et réessayez.',
  indisponible: 'La suppression depuis l’app n’est pas encore ouverte sur ce serveur. Écrivez-nous pour supprimer votre compte :',
};

export const messageRefusSuppression = (raison) =>
  MESSAGES_REFUS_SUPPRESSION[raison] || MESSAGES_REFUS_SUPPRESSION.reseau;
