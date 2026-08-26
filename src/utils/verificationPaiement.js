// Vérification d'un paiement d'abonnement — logique pure, partagée entre le
// navigateur et la fonction serveur (api/paiement/*).
//
// POURQUOI CE MODULE EXISTE : jusqu'ici, l'abonnement s'activait sur la
// PAROLE DU NAVIGATEUR. Le widget annonçait « payé », l'app enregistrait.
// N'importe qui sachant ouvrir la console pouvait déclencher le même retour
// et s'offrir un abonnement sans payer un franc. La vérité d'un paiement ne
// peut venir que de l'agrégateur, interrogé depuis le serveur avec des clés
// que le navigateur n'a pas.
//
// Ce fichier ne contient QUE les règles de décision. L'appel réseau et les
// clés vivent côté serveur ; le navigateur réutilise les mêmes règles pour
// afficher un message juste.
// Extensions explicites : ce module est aussi chargé tel quel par Node dans
// les fonctions serveur (api/paiement/*), où un import sans extension échoue.
import { SUBSCRIPTION_PRICE, formule } from './subscription.js';
import { DAY_MS } from './date.js';

/** Seul statut KkiaPay qui vaut « argent reçu ». */
export const STATUT_SUCCES = 'SUCCESS';

// Statuts documentés par KkiaPay, traduits pour l'utilisateur. Un statut
// inconnu n'est jamais traité comme un succès (liste blanche, pas noire).
export const MOTIF_STATUT = {
  FAILED: 'Paiement échoué chez l’opérateur.',
  INSUFFICIENT_FUND: 'Solde insuffisant sur le compte Mobile Money.',
  TRANSACTION_NOT_FOUND: 'Transaction introuvable chez l’agrégateur.',
  INVALID_TRANSACTION: 'Cette transaction n’appartient pas à ce compte marchand.',
  TRANSACTION_NOT_ELIGIBLE: 'Transaction déjà remboursée ou inéligible.',
  PENDING: 'Paiement encore en cours de traitement.',
};

/** Identifiant de transaction plausible : ni vide, ni fantaisiste. */
export const transactionIdValide = (id) => /^[A-Za-z0-9_-]{6,64}$/.test(String(id || '').trim());

/**
 * La réponse de l'agrégateur autorise-t-elle l'activation ?
 *
 * Le montant est comparé au prix ATTENDU CÔTÉ SERVEUR, jamais à celui annoncé
 * par le navigateur : sinon il suffirait de payer 100 F en déclarant 5 000.
 *
 * @param {object} reponse  réponse brute de l'agrégateur
 * @param {{montantAttendu?: number, deviseAttendue?: string}} options
 * @returns {{valide: boolean, motif: string|null, montant: number, statut: string}}
 */
export const verdictTransaction = (reponse, { montantAttendu = SUBSCRIPTION_PRICE, deviseAttendue = 'XOF' } = {}) => {
  const statut = String(reponse?.status || '').toUpperCase();
  const montant = Number(reponse?.amount) || 0;
  const devise = String(reponse?.currency || deviseAttendue).toUpperCase();
  const base = { montant, statut };

  if (!reponse || !statut) return { ...base, valide: false, motif: 'Réponse illisible de l’agrégateur.' };
  if (statut !== STATUT_SUCCES)
    return { ...base, valide: false, motif: MOTIF_STATUT[statut] || `Paiement non abouti (${statut}).` };
  // Une devise différente rendrait la comparaison de montant absurde.
  if (devise !== deviseAttendue)
    return { ...base, valide: false, motif: `Devise inattendue (${devise}).` };
  if (montant < montantAttendu)
    return { ...base, valide: false, motif: `Montant reçu insuffisant (${montant} au lieu de ${montantAttendu} F).` };
  return { ...base, valide: true, motif: null };
};

/**
 * Abonnement après un paiement confirmé : la durée de SA formule s'ajoute à
 * aujourd'hui, ou à l'échéance en cours si elle court encore — renouveler tôt
 * ne doit jamais faire perdre les jours déjà payés.
 *
 * La formule est lue sur l'abonnement lui-même, jamais sur la requête : c'est
 * l'appelant serveur qui l'y a inscrite après l'avoir validée contre le
 * catalogue. Un abonnement antérieur au catalogue n'en porte aucune et
 * retombe sur la mensuelle — trente jours, comme avant.
 *
 * Utilisé par la validation manuelle du gérant ET par la confirmation
 * serveur : une seule règle, donc jamais deux échéances contradictoires.
 */
export const abonnementApresPaiement = (sub, maintenant = Date.now()) => {
  const f = formule(sub?.formule);
  const finActuelle = sub?.dateFin ? new Date(sub.dateFin).getTime() : 0;
  const base = finActuelle > maintenant ? finActuelle : maintenant;
  return {
    ...sub,
    status: 'actif',
    formule: f.id,
    montant: f.prix,
    recurrence: f.id,
    dateDebut: sub?.dateDebut || new Date(maintenant).toISOString(),
    dateFin: new Date(base + f.jours * DAY_MS).toISOString(),
    lastPaymentAt: new Date(maintenant).toISOString(),
  };
};
