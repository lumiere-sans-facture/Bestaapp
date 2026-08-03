// Rôle et propriété d'un espace de travail — logique pure.

/**
 * Vrai si l'utilisateur est propriétaire de son espace : le gérant de
 * l'entreprise, l'admin plateforme (BestaSolar), ou tout utilisateur dont
 * l'espace n'a pas de gérant (inscrit self-service, seul dans son espace).
 * Sert à ouvrir les réglages qui engagent l'entreprise entière (parrainage…).
 * NB : la progression des affaires, elle, n'est soumise à aucune autorisation —
 * chaque vendeur fait avancer ses propres affaires.
 * @param {{role?: string, is_platform_admin?: boolean}} user
 * @param {Array<{role?: string}>} team profils de SON organisation uniquement
 */
export const estProprietaireEspace = (user, team = []) =>
  user?.role === 'gerant'
  || !!user?.is_platform_admin
  || !team.some((u) => u.role === 'gerant');
