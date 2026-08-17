// Rôle et autorisations — logique pure.

/**
 * Vrai si l'utilisateur applique lui-même les changements d'étape et valide
 * les demandes des autres : le gérant de l'entreprise, ou l'admin de la
 * plateforme (BestaSolar).
 *
 * TOUT autre compte — y compris un inscrit seul dans son espace — DEMANDE :
 * la progression commerciale se suit à deux, le commercial propose et
 * BestaSolar tranche. C'est une règle métier, pas une contrainte technique.
 *
 * @param {{role?: string, is_platform_admin?: boolean}} user
 */
export const peutValiderProgression = (user) =>
  user?.role === 'gerant' || !!user?.is_platform_admin;

/**
 * Vrai si l'utilisateur peut engager l'entreprise entière (code de
 * parrainage…). Un inscrit seul dans son espace en est le propriétaire de
 * fait : il doit pouvoir le régler, même sans être « gérant ».
 * @param {Array<{role?: string}>} team profils de SON organisation uniquement
 * @param {boolean} equipeChargee annuaire réellement reçu du serveur
 */
export const estProprietaireEspace = (user, team = [], equipeChargee = true) => {
  if (peutValiderProgression(user)) return true;
  if (!equipeChargee) return false; // annuaire inconnu : on ne déduit rien
  return !team.some((u) => u.role === 'gerant');
};
