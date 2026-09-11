// Main d'œuvre : le Togo coûte le double du Bénin.
//
// Règle métier posée par le gérant : la pose se paie deux fois plus cher au
// Togo. Elle s'applique dès que le chantier est togolais, et le chantier est
// togolais par DEUX signaux indépendants — la ville retenue au dimensionnement,
// ou le numéro du client. L'un suffit : un client joignable au +228 pour une
// ville non reconnue reste un chantier togolais.
//
// Seule la main d'œuvre est touchée. Le matériel vient du même fournisseur des
// deux côtés de la frontière : le doubler serait une erreur de facturation.
import { estVilleDuTogo } from './sizingSheet/compute';

export const COEFFICIENT_MAIN_OEUVRE_TOGO = 2;

/**
 * Le numéro est-il togolais ?
 *
 * Volontairement SANS déduction implicite. `normalizePhoneNumber` traite un
 * numéro sans indicatif comme togolais (c'est le pays par défaut de l'app) :
 * s'en servir ici facturerait au double un client béninois qui a simplement
 * omis son « +229 ». On ne tranche donc que sur ce qui est écrit :
 *
 *   - indicatif 228 ou 229 présent → il fait foi, sans discussion ;
 *   - sinon, les plans de numérotation départagent : 8 chiffres au Togo,
 *     10 chiffres commençant par 01 au Bénin depuis le 30 novembre 2024 ;
 *   - tout le reste → non togolais, et donc au tarif normal. Dans le doute,
 *     ne pas surfacturer.
 */
export const estNumeroTogolais = (telephone = '') => {
  let chiffres = String(telephone ?? '').replace(/\D/g, '');
  if (chiffres.startsWith('00')) chiffres = chiffres.slice(2);
  if (!chiffres) return false;
  if (chiffres.startsWith('229')) return false;
  if (chiffres.startsWith('228')) return true;
  return /^\d{8}$/.test(chiffres);
};

/**
 * Chantier au Togo ? La ville OU le numéro suffit.
 * @param {{ville?: string, pays?: string, telephone?: string}} contexte
 */
export const estChantierAuTogo = ({ ville = '', pays = '', telephone = '' } = {}) =>
  estVilleDuTogo(ville, pays) || estNumeroTogolais(telephone);

/** Multiplicateur à appliquer aux lignes de main d'œuvre : 2 au Togo, 1 ailleurs. */
export const coefficientMainOeuvre = (contexte) =>
  (estChantierAuTogo(contexte) ? COEFFICIENT_MAIN_OEUVRE_TOGO : 1);
