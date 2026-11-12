// Prix du kWh proposé au dimensionnement par FACTURE : celui de l'opérateur
// du pays du client (SBEE au Bénin, 145 F ; CEET au Togo, 114 F…). Il n'est
// qu'un point de départ, modifiable : c'est la facture du client qui fait foi.
// Logique pure, sans React.
import { paysDuNom, paysParId, paysDuTelephone } from '../data/pays';
import { estVilleDuTogo } from './sizingSheet/compute';
import { estNumeroTogolais } from './mainOeuvre';

/** Pays retenu quand rien ne dit où est le client : le Bénin, pays de BestaSolar. */
export const PAYS_TARIF_DEFAUT = 'bj';

/**
 * Pays dont le tarif d'électricité s'applique au client. Dans l'ordre :
 *  1. le pays du lieu géocodé (étape « Système & localisation ») ;
 *  2. une ville togolaise reconnue ;
 *  3. le numéro du client : indicatif écrit (+229, +228, +225…), sinon un
 *     numéro local à 8 chiffres, togolais — la règle de la main d'œuvre
 *     (utils/mainOeuvre.js), qui ne devine rien de plus ;
 *  4. le pays de l'entreprise (espace Pro) ;
 *  5. le Bénin.
 * Le numéro passe avant le pays de l'entreprise : une adresse comme
 * « Quartier Zongo, Lomé » n'est pas reconnue comme une ville, mais le
 * « +228 » du client dit bien qu'il paie la CEET.
 *
 * @returns {object} l'entrée de data/pays.js (prixKwh, operateurElec, dans…)
 */
export const paysTarifFacture = ({ ville = '', pays = '', telephone = '', paysEntreprise = '' } = {}) =>
  paysDuNom(pays)
  || (estVilleDuTogo(ville, pays) ? paysParId('tg') : null)
  || paysDuTelephone(telephone)
  || (estNumeroTogolais(telephone) ? paysParId('tg') : null)
  || paysDuNom(paysEntreprise)
  || paysParId(PAYS_TARIF_DEFAUT);

/**
 * Le prix de la facture quand le pays du client change (client choisi, lieu
 * géocodé) : il suit le nouveau tarif tant qu'il vaut encore l'ancien. Un
 * prix tapé à la main n'est jamais écrasé.
 */
export const prixFactureSuivantPays = (prixActuel, ancienTarif, nouveauTarif) =>
  (Number(prixActuel) === Number(ancienTarif) ? nouveauTarif : prixActuel);
