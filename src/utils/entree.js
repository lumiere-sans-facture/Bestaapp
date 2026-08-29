// Quel écran montrer à l'ouverture de l'application — logique pure, sans React.
//
// Ce choix tenait en quatre `if` dans App.jsx, et l'arrivée de la page
// d'accueil publique en a fait sauter un : le retour de Google pour un nouvel
// arrivant (session ouverte, profil pas encore créé) tombait sur la vitrine au
// lieu du formulaire à terminer. L'inscription se perdait là, sans un mot.
//
// Sorti ici, l'ordre de priorité se lit d'un coup d'œil et se teste.

/**
 * @param {object} etat
 * @param {boolean} etat.isLoading        session pas encore résolue
 * @param {boolean} etat.recovery         lien « mot de passe oublié » cliqué
 * @param {object|null} etat.pendingAuthUser  compte Auth sans profil (Google)
 * @param {object|null} etat.user         profil adopté
 * @returns {'chargement'|'connexion'|'public'|'application'}
 */
export const ecranDentree = ({ isLoading, recovery, pendingAuthUser, user } = {}) => {
  if (isLoading) return 'chargement';
  // Ces deux-là passent AVANT tout le reste : ce sont des parcours en cours
  // d'achèvement, interrompus par un aller-retour hors de l'app (un e-mail,
  // Google). Les renvoyer à la vitrine, c'est les perdre.
  if (recovery) return 'connexion';
  if (pendingAuthUser) return 'connexion';
  if (!user) return 'public';
  return 'application';
};

/**
 * Quel formulaire ouvrir sur l'écran d'entrée.
 *
 * Une attribution de parrainage vit TRENTE JOURS sur l'appareil. Tant que
 * l'écran de connexion était le seul point d'entrée, la laisser ouvrir
 * l'inscription avait du sens. Depuis qu'il existe deux adresses distinctes,
 * elle prenait le pas sur la demande explicite : cliquer « Se connecter »
 * amenait au formulaire d'inscription, un mois durant, sur le seul appareil
 * ayant suivi un lien partenaire — d'où un bogue invisible en recette et bien
 * réel en production.
 *
 * L'adresse demandée l'emporte donc. L'attribution ne décide plus que
 * lorsqu'aucune vue n'est réclamée (un signet vers une page interne, par
 * exemple) ; elle continue, dans tous les cas, à préremplir le code.
 *
 * @param {object} etat
 * @param {'login'|'signup'|null} etat.vueDemandee  vue imposée par la route
 * @param {string} etat.refCode    code partenaire mémorisé sur l'appareil
 * @param {string} etat.teamCode   code d'invitation lu dans l'adresse
 * @returns {'login'|'signup'}
 */
export const vueLogin = ({ vueDemandee = null, refCode = '', teamCode = '' } = {}) => {
  if (vueDemandee) return vueDemandee;
  return refCode || teamCode ? 'signup' : 'login';
};
