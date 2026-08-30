// Point d'entrée côté application. La règle est partagée avec les Edge
// Functions pour garantir des comparaisons identiques côté client et serveur.
export { findContactByNormalizedPhone, normalizePhoneNumber, samePhoneNumber, PAYS_PAR_DEFAUT } from '../../shared/phone.js';
