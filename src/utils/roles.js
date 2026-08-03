// Règle d'autorisation du suivi commercial — logique pure.
//
// Deux usages, une seule règle : qui peut APPLIQUER une progression
// directement, et qui peut VALIDER la demande d'un autre. Les deux doivent
// coïncider, sinon une demande peut être créée sans que personne ne puisse la
// valider (verrou mortel : l'affaire n'avance plus, la commission ne naît pas).

/**
 * Vrai si l'utilisateur pilote lui-même les étapes (et valide les demandes) :
 *  - le gérant de l'entreprise ;
 *  - l'admin plateforme (BestaSolar), propriétaire de fait de ses affaires ;
 *  - tout utilisateur dont l'espace n'a PAS de gérant — un inscrit seul est le
 *    propriétaire de son espace : sans cela, sa demande n'aurait aucun
 *    destinataire.
 * @param {{role?: string, is_platform_admin?: boolean}} user
 * @param {Array<{role?: string}>} team profils de SON organisation uniquement
 */
export const peutValiderProgression = (user, team = []) =>
  user?.role === 'gerant'
  || !!user?.is_platform_admin
  || !team.some((u) => u.role === 'gerant');
