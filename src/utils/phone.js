// Point d'entrée côté application. La règle est partagée avec les Edge
// Functions pour garantir des comparaisons identiques côté client et serveur.
export { normalizePhoneNumber, samePhoneNumber } from '../../shared/phone.js';
