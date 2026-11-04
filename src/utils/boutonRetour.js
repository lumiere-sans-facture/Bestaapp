// Bouton « retour » d'Android — logique pure, sans React ni Capacitor.
//
// Avant : rien ne gérait ce bouton, et Android fermait l'application à la
// première pression, quel que soit l'écran. Désormais, dans l'ordre :
//   1. une fenêtre ouverte (fiche, confirmation, aperçu) se ferme ;
//   2. hors de la page d'accueil, on y revient ;
//   3. sur la page d'accueil, on quitte l'application.

/** Chemin sans barre finale (« /dashboard/ » → « /dashboard »), la racine exceptée. */
const normaliser = (chemin = '/') => (chemin.length > 1 ? chemin.replace(/\/+$/, '') : chemin) || '/';

/**
 * Page d'accueil de la situation en cours : le tableau de bord de l'espace
 * Pro ou de l'espace public pour un compte connecté, la racine (écran de
 * connexion dans l'application) sinon.
 * @param {object} o
 * @param {string} o.chemin    adresse affichée
 * @param {boolean} o.connecte compte connecté, dans l'application
 */
export const accueilPour = ({ chemin = '/', connecte = false } = {}) => {
  if (!connecte) return '/';
  const c = normaliser(chemin);
  return c === '/pro' || c.startsWith('/pro/') ? '/pro' : '/dashboard';
};

/**
 * Que faire d'une pression sur « retour » ?
 * @param {object} o
 * @param {string} o.chemin
 * @param {boolean} o.connecte
 * @param {boolean} o.fenetreOuverte une fenêtre modale est ouverte (et n'a pas déjà refusé de se fermer)
 * @returns {{ type: 'fermer' } | { type: 'aller', vers: string } | { type: 'quitter' }}
 */
export function actionRetour({ chemin = '/', connecte = false, fenetreOuverte = false } = {}) {
  if (fenetreOuverte) return { type: 'fermer' };
  const accueil = accueilPour({ chemin, connecte });
  if (normaliser(chemin) !== accueil) return { type: 'aller', vers: accueil };
  return { type: 'quitter' };
}
