// État du parrainage d'une entreprise — logique pure, sans React.
//
// Trois états, et c'est le drapeau `referral_par_defaut` qui les sépare.
// Un partenaire inscrit sans code rejoint BestaSolar par défaut : il ne doit
// pas se retrouver verrouillé sur un parrain que personne n'a désigné, mais
// il ne doit pas non plus pouvoir en changer indéfiniment.

export const PARRAINAGE_VERROUILLE = 'verrouille'; // code choisi : définitif
export const PARRAINAGE_PAR_DEFAUT = 'par-defaut'; // BestaSolar : corrigeable une fois
export const PARRAINAGE_ABSENT = 'absent';         // aucun rattachement

/** @param {{referred_by?: string, referral_par_defaut?: boolean}} org */
export const etatParrainage = (org = {}) => {
  if (!org?.referred_by) return PARRAINAGE_ABSENT;
  return org.referral_par_defaut ? PARRAINAGE_PAR_DEFAUT : PARRAINAGE_VERROUILLE;
};

/** La saisie d'un code n'est proposée que tant qu'elle est encore possible. */
export const peutChoisirParrain = (org) => etatParrainage(org) !== PARRAINAGE_VERROUILLE;

// Depuis la réunion de tous les comptes dans une organisation unique, le
// parrain est celui de la PERSONNE (table parrainages, voir mon_parrain()),
// et non plus celui de l'organisation, commune à tous. Mêmes trois états :
//   source « defaut » : inscrit sans code, rattaché à BestaSolar, corrigeable une fois ;
//   toute autre source : choix réel, définitif ;
//   aucun parrain : saisie possible.
/** @param {{source?: string}|null} parrain  ligne renvoyée par mon_parrain() */
export const etatParrainagePersonne = (parrain) => {
  if (!parrain) return PARRAINAGE_ABSENT;
  return parrain.source === 'defaut' ? PARRAINAGE_PAR_DEFAUT : PARRAINAGE_VERROUILLE;
};
