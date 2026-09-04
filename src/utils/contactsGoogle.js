// Quels contacts partent vers le carnet Google — logique pure, sans réseau.
import { canSyncClientContact } from './clientContact';

/**
 * Règle métier, posée par le gérant : le carnet Google reçoit les partenaires
 * et les clients du côté PUBLIC. Les clients de l'espace Devis Pro n'y vont
 * PAS — cet espace est l'entreprise personnelle de l'abonné, ses clients ne
 * regardent que lui. C'est la même frontière que celle des politiques de
 * sécurité sur `leads` et `proClients`.
 */
export const TYPES_ENVOYES_A_GOOGLE = ['partner', 'lead'];

/** Un contact est à envoyer tant qu'il n'a pas été accepté par Google. */
const aEnvoyer = (contact, maintenant) => {
  const statut = contact.google_contact_sync_status;
  // Sans statut, le contact n'a JAMAIS été proposé : les clients saisis avant
  // la mise en place de la file sont dans ce cas, et resteraient invisibles
  // dans le carnet Google si on ne les reprenait pas ici.
  if (statut && statut !== 'pending' && statut !== 'failed') return false;
  const reprise = contact.google_contact_sync_next_retry_at;
  if (!reprise) return true;
  const quand = Date.parse(reprise);
  return Number.isNaN(quand) || quand <= maintenant;
};

/**
 * Ordre de passage. Le carnet n'accepte que quelques contacts à la fois : ce
 * qui part en premier décide de ce que l'utilisateur voit arriver tout de
 * suite. Trois rangs, du plus urgent au moins urgent :
 *
 *   0. `pending` — le contact vient d'être enregistré et attend son tour.
 *      C'est CELUI-LÀ que quelqu'un regarde apparaître dans son téléphone.
 *   1. `failed`  — déjà tenté, en reprise. Son échéance le retient déjà.
 *   2. sans statut — le rattrapage des contacts d'avant la file d'attente.
 *
 * Sans ce classement, un nouveau numéro passait DERRIÈRE tout l'historique :
 * l'enregistrement était instantané avant qu'on ne reprenne les anciens
 * contacts, il ne l'était plus après.
 */
const rang = (contact) => {
  const statut = contact.google_contact_sync_status;
  if (statut === 'pending') return 0;
  if (statut === 'failed') return 1;
  return 2;
};

/**
 * @param {{partners?: Array, leads?: Array, maintenant?: number,
 *          enCours?: Set<string>, limite?: number}} etat
 * @returns {Array<{contact: object, contactType: string, cle: string}>}
 */
export const contactsGoogleAEnvoyer = ({
  partners = [], leads = [], maintenant = Date.now(), enCours = new Set(), limite = 3,
} = {}) => [
  ...partners.map((contact) => ({ contact, contactType: 'partner' })),
  ...leads.map((contact) => ({ contact, contactType: 'lead' })),
]
  .map((item) => ({ ...item, cle: `${item.contactType}:${item.contact?.id}` }))
  .filter(({ contact, cle }) => canSyncClientContact(contact)
    && aEnvoyer(contact, maintenant)
    && !enCours.has(cle))
  // `sort` est stable : à rang égal, l'ordre des listes est conservé — les
  // créations récentes sont en tête (les actions les ajoutent par le début).
  .sort((a, b) => rang(a.contact) - rang(b.contact))
  .slice(0, limite);
