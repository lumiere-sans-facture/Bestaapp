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
