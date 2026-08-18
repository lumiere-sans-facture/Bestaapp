// Palliatif client aux réglages « Time-box user sessions » et « Inactivity
// timeout » de Supabase (Authentication → Sessions), réservés au plan
// payant. Sans backend pour les imposer, la session est bornée ici et
// revérifiée à chaque chargement de l'app : fermée au-delà d'une durée
// absolue OU d'une inactivité prolongée (l'app pas rouverte depuis longtemps).
//
// Défense en profondeur, pas une vraie révocation serveur : un jeton de
// rafraîchissement volé continuerait de fonctionner en s'adressant
// directement à l'API Supabase, hors de cet écran. Le jour où le palier
// payant est pris, ce module devient redondant — pas gênant de le garder.
const STARTED_KEY = 'bestasolar_session_started_at';
const ACTIVE_KEY = 'bestasolar_session_last_active_at';

export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours
export const SESSION_INACTIVITY_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

const readTimestamp = (key) => {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch { return null; }
};

/** true si la session dépasse la durée absolue ou l'inactivité tolérée. */
export const isSessionExpired = () => {
  const now = Date.now();
  const started = readTimestamp(STARTED_KEY);
  const active = readTimestamp(ACTIVE_KEY);
  if (started && now - started > SESSION_MAX_AGE_MS) return true;
  if (active && now - active > SESSION_INACTIVITY_MS) return true;
  return false;
};

/**
 * À appeler à chaque session valide (connexion, restauration au chargement) :
 * démarre le suivi s'il n'existe pas encore pour cet appareil, sinon
 * rafraîchit seulement l'activité — sans jamais reculer la date de départ
 * (l'âge absolu doit continuer à courir même si l'utilisateur revient
 * tous les jours).
 */
export const touchSession = () => {
  try {
    if (!localStorage.getItem(STARTED_KEY)) localStorage.setItem(STARTED_KEY, String(Date.now()));
    localStorage.setItem(ACTIVE_KEY, String(Date.now()));
  } catch { /* stockage indisponible */ }
};

/** Déconnexion (ou session expirée) : oublie le suivi, la prochaine connexion repart à zéro. */
export const clearSessionLifetime = () => {
  try {
    localStorage.removeItem(STARTED_KEY);
    localStorage.removeItem(ACTIVE_KEY);
  } catch { /* stockage indisponible */ }
};
