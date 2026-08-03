// Rôle et autorisations — logique pure.

/**
 * Vrai si l'utilisateur applique lui-même les changements d'étape (et valide
 * les demandes des autres) :
 *  - le gérant de l'entreprise ;
 *  - l'admin plateforme (BestaSolar) ;
 *  - un utilisateur SEUL dans son espace, faute de valideur — sa demande
 *    n'aurait aucun destinataire.
 *
 * `equipeChargee` est décisif : tant que l'annuaire de l'équipe n'a pas
 * répondu, il ne contient que l'utilisateur courant. S'en servir reviendrait à
 * conclure « aucun gérant, donc je décide » et un commercial appliquerait ses
 * progressions sans validation pendant cette fenêtre. On refuse donc le
 * pouvoir tant que l'équipe est inconnue.
 *
 * @param {{role?: string, is_platform_admin?: boolean}} user
 * @param {Array<{role?: string}>} team profils de SON organisation uniquement
 * @param {boolean} equipeChargee annuaire réellement reçu du serveur
 */
export const peutValiderProgression = (user, team = [], equipeChargee = true) => {
  if (user?.role === 'gerant' || user?.is_platform_admin) return true;
  if (!equipeChargee) return false;
  return !team.some((u) => u.role === 'gerant');
};

/**
 * Vrai si l'utilisateur peut engager l'entreprise entière (code de parrainage…).
 * Même règle, mêmes précautions.
 */
export const estProprietaireEspace = peutValiderProgression;
