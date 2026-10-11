// Point d'entrée côté application. La règle est partagée avec les Edge
// Functions pour garantir des comparaisons identiques côté client et serveur.
import { normalizePhoneNumber, PAYS_PAR_DEFAUT } from '../../shared/phone.js';

export { findContactByNormalizedPhone, normalizePhoneNumber, samePhoneNumber, PAYS_PAR_DEFAUT } from '../../shared/phone.js';

/**
 * Numéro WhatsApp d'un contact : indicatif compris, chiffres seuls
 * (« 22890123456 »), ou '' s'il n'est pas exploitable. C'est la forme
 * qu'attend WhatsApp pour ouvrir directement la conversation du client.
 */
export const numeroWhatsApp = (telephone, pays = PAYS_PAR_DEFAUT) =>
  (normalizePhoneNumber(telephone, pays) || '').replace(/\D/g, '');
