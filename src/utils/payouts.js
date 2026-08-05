// Demandes de paiement des commissions (« retraits ») — logique pure.
//
// Règle du jeu, telle qu'elle se pratique dans les programmes d'affiliation :
// le partenaire ne demande pas un montant en l'air, il demande le RÈGLEMENT DE
// COMMISSIONS PRÉCISES. Le montant est la somme de ce qu'il a coché. C'est ce
// qui rend le circuit vérifiable de bout en bout : chaque franc versé se
// rattache à une affaire, le reçu le prouve, et rien ne peut être payé deux
// fois. Un simple montant libre obligerait à deviner ce qu'il solde.

/** En dessous, une demande ne vaut pas les frais d'un transfert Mobile Money. */
export const RETRAIT_MIN = 5000;

export const MODES_RETRAIT = {
  momo: 'Mobile Money',
  especes: 'Espèces',
  virement: 'Virement bancaire',
};

export const STATUTS_RETRAIT = {
  en_attente: 'En attente de validation',
  paye: 'Payée',
  refuse: 'Refusée',
};

/** Demande encore en cours d'examen pour ce partenaire, s'il y en a une. */
export const demandeEnCours = (demandes = [], partnerId) =>
  demandes.find((d) => d.partnerId === partnerId && d.status === 'en_attente') || null;

/**
 * Commissions qu'un partenaire peut faire régler : impayées et pas déjà
 * engagées dans une demande en cours. Sans cette seconde condition, il
 * demanderait deux fois le même argent et le gérant le paierait deux fois.
 */
export const commissionsMobilisables = (commissions = [], partnerId, demandes = []) => {
  const engagees = new Set(
    demandes
      .filter((d) => d.status === 'en_attente')
      .flatMap((d) => d.commissionIds || [])
  );
  return commissions
    .filter((c) => c.partnerId === partnerId && c.status !== 'payée' && !engagees.has(c.id))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); // les plus anciennes d'abord
};

/** Total mobilisable — ce que le partenaire peut demander aujourd'hui. */
export const soldeMobilisable = (commissions, partnerId, demandes) =>
  commissionsMobilisables(commissions, partnerId, demandes).reduce((s, c) => s + (c.amount || 0), 0);

/** Somme des commissions cochées. */
export const montantDemande = (commissions = [], ids = []) => {
  const choisies = new Set(ids);
  return commissions.filter((c) => choisies.has(c.id)).reduce((s, c) => s + (c.amount || 0), 0);
};

/**
 * Contrôle d'une demande avant envoi. Retourne `null` si tout va bien, sinon
 * le message à afficher — un seul, le premier qui bloque.
 */
export const erreurDemande = ({ commissionIds = [], montant = 0, telephone = '', dejaEnCours = false }) => {
  if (dejaEnCours) return 'Une demande est déjà en attente de validation.';
  if (!commissionIds.length) return 'Choisissez au moins une commission à faire régler.';
  if (montant < RETRAIT_MIN) {
    return `Le minimum est de ${RETRAIT_MIN.toLocaleString('fr-FR')} F CFA — sélectionnez davantage de commissions.`;
  }
  if (!telephone.trim()) return 'Indiquez le numéro qui recevra le paiement.';
  return null;
};

/** Totaux affichés au partenaire comme au gérant. */
export const resumeRetraits = (demandes = [], partnerId = null) => {
  const miennes = partnerId ? demandes.filter((d) => d.partnerId === partnerId) : demandes;
  const somme = (statut) => miennes.filter((d) => d.status === statut).reduce((s, d) => s + (d.amount || 0), 0);
  return {
    enAttente: somme('en_attente'),
    paye: somme('paye'),
    nbEnAttente: miennes.filter((d) => d.status === 'en_attente').length,
  };
};
