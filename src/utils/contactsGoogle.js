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
  .slice(0, limite);
