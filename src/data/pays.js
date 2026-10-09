// Pays de l'espace Pro — ce qui change d'un pays à l'autre sur les documents
// d'un installateur abonné : indicatif téléphonique, identifiant fiscal, taux
// de TVA, devise, Mobile Money, prix du kWh pour la rentabilité de la fiche.
//
// Tous sont membres de l'OHADA : le registre de commerce s'appelle partout
// RCCM. Sept sont dans l'UEMOA (franc CFA BCEAO, XOF) ; le Cameroun est dans
// la CEMAC (franc CFA BEAC, XAF) — « F CFA » sur les documents dans les deux cas.
//
// ⚠️ Données de RÉFÉRENCE, pas des avis fiscaux :
//  - TVA : taux normal. 18 % (directive UEMOA), sauf le Niger (19 %) et le
//    Cameroun (19,25 % = 17,5 % + 10 % de centimes additionnels communaux).
//    Les exonérations (matériel solaire notamment) varient selon le pays et
//    l'année : l'installateur choisit « Exonérée » ou non, document par document.
//  - prixKwh : ORDRE DE GRANDEUR de la tranche domestique courante, point de
//    départ du calcul de rentabilité — modifiable dans l'assistant, et c'est
//    la facture du client qui fait foi. Togo et Bénin gardent les valeurs que
//    la fiche employait déjà ; les autres reprennent data/tarifsUemoa.js ;
//    Cameroun : tranche ENEO 111-220 kWh (79 F, grille de novembre 2024).
//  - mobileMoney : SUGGESTIONS du champ « Opérateur », qui reste libre
//    (vérifiées en octobre 2026 ; les marques changent : Free Money est
//    devenu Mixx by Yas au Sénégal).
//  - fiscal : sigles vérifiés auprès des administrations (IFU Bénin et
//    Burkina, NIF Togo/Niger/Mali, NCC Côte d'Ivoire, NINEA Sénégal, NIU
//    Cameroun : une lettre P ou M, 12 chiffres, une lettre).
//  - exemples (téléphone, identifiant, RCCM) : simples aides à la saisie.
export const PAYS = [
  {
    id: 'bj', nom: 'Bénin', dans: 'au Bénin', drapeau: '🇧🇯', indicatif: '+229', exempleTel: '+229 01 97 00 00 00',
    zone: 'UEMOA', devise: 'XOF', tva: 0.18,
    fiscal: { sigle: 'IFU', nom: 'Identifiant fiscal unique', exemple: '3202412345678' },
    exempleRccm: 'RB/COT/24 B 12345',
    mobileMoney: ['MTN MoMo', 'Moov Money', 'Celtiis Cash'],
    operateurElec: 'SBEE', prixKwh: 145,
  },
  {
    id: 'bf', nom: 'Burkina Faso', dans: 'au Burkina Faso', drapeau: '🇧🇫', indicatif: '+226', exempleTel: '+226 70 00 00 00',
    zone: 'UEMOA', devise: 'XOF', tva: 0.18,
    fiscal: { sigle: 'IFU', nom: 'Identifiant financier unique', exemple: '00012345A' },
    exempleRccm: 'BF-OUA-01-2024-B12-01234',
    mobileMoney: ['Orange Money', 'Moov Money', 'Wave'],
    operateurElec: 'SONABEL', prixKwh: 127,
  },
  {
    id: 'cm', nom: 'Cameroun', dans: 'au Cameroun', drapeau: '🇨🇲', indicatif: '+237', exempleTel: '+237 6 70 00 00 00',
    zone: 'CEMAC', devise: 'XAF', tva: 0.1925,
    fiscal: { sigle: 'NIU', nom: 'Numéro d’identifiant unique', exemple: 'M012400012345A' },
    exempleRccm: 'RC/DLA/2024/B/1234',
    mobileMoney: ['MTN MoMo', 'Orange Money'],
    operateurElec: 'ENEO', prixKwh: 79,
  },
  {
    id: 'ci', nom: 'Côte d’Ivoire', dans: 'en Côte d’Ivoire', drapeau: '🇨🇮', indicatif: '+225', exempleTel: '+225 07 00 00 00 00',
    zone: 'UEMOA', devise: 'XOF', tva: 0.18,
    fiscal: { sigle: 'NCC', nom: 'Numéro de compte contribuable', exemple: '2400123A' },
    exempleRccm: 'CI-ABJ-03-2024-B12-01234',
    mobileMoney: ['Orange Money', 'MTN MoMo', 'Moov Money', 'Wave'],
    operateurElec: 'CIE', prixKwh: 90,
  },
  {
    id: 'ml', nom: 'Mali', dans: 'au Mali', drapeau: '🇲🇱', indicatif: '+223', exempleTel: '+223 70 00 00 00',
    zone: 'UEMOA', devise: 'XOF', tva: 0.18,
    fiscal: { sigle: 'NIF', nom: 'Numéro d’identification fiscale', exemple: '' },
    exempleRccm: 'MA.BKO.2024.B.1234',
    mobileMoney: ['Orange Money', 'Moov Money', 'Wave'],
    operateurElec: 'EDM', prixKwh: 100,
  },
  {
    id: 'ne', nom: 'Niger', dans: 'au Niger', drapeau: '🇳🇪', indicatif: '+227', exempleTel: '+227 90 00 00 00',
    zone: 'UEMOA', devise: 'XOF', tva: 0.19,
    fiscal: { sigle: 'NIF', nom: 'Numéro d’identification fiscale', exemple: '' },
    exempleRccm: 'NE-NIM-01-2024-B12-01234',
    mobileMoney: ['Airtel Money', 'Moov Money', 'Zamani Cash'],
    operateurElec: 'NIGELEC', prixKwh: 86,
  },
  {
    id: 'sn', nom: 'Sénégal', dans: 'au Sénégal', drapeau: '🇸🇳', indicatif: '+221', exempleTel: '+221 77 000 00 00',
    zone: 'UEMOA', devise: 'XOF', tva: 0.18,
    // NINEA suivi du code fiscal (COFI) à trois caractères.
    fiscal: { sigle: 'NINEA', nom: 'Numéro d’identification national des entreprises et associations', exemple: '012345678 2G3' },
    exempleRccm: 'SN-DKR-2024-B-12345',
    mobileMoney: ['Orange Money', 'Wave', 'Mixx by Yas'],
    operateurElec: 'Senelec', prixKwh: 115,
  },
  {
    id: 'tg', nom: 'Togo', dans: 'au Togo', drapeau: '🇹🇬', indicatif: '+228', exempleTel: '+228 90 00 00 00',
    zone: 'UEMOA', devise: 'XOF', tva: 0.18,
    fiscal: { sigle: 'NIF', nom: 'Numéro d’identification fiscale', exemple: '1000123456' },
    exempleRccm: 'TG-LFW-01-2025-A10-01086',
    mobileMoney: ['Flooz (Moov Africa)', 'TMoney (Yas)', 'Mixx by Yas'],
    operateurElec: 'CEET', prixKwh: 114,
  },
];

// Pays d'une entreprise qui n'en a jamais choisi et dont le téléphone ne dit
// rien : le Togo, dont l'espace Pro supposait jusqu'ici tout (NIF, +228).
export const PAYS_ENTREPRISE_DEFAUT = 'tg';

/** « Franc CFA (BCEAO) » / « Franc CFA (BEAC) ». */
export const libelleDevise = (pays) => `Franc CFA (${pays?.devise === 'XAF' ? 'BEAC' : 'BCEAO'})`;

/** « 18 » / « 19,25 » — le taux de TVA en pourcentage, à la française. */
export const tvaPct = (taux) => (Number(taux) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });

/**
 * Indication sous le réglage TVA. Seule l'exonération du solaire au Togo est
 * une règle que l'application connaît ; ailleurs, elle se vérifie.
 */
export const indicationTva = (pays) => (pays?.id === 'tg'
  ? 'Le solaire est exonéré de TVA par défaut au Togo.'
  : `TVA à ${tvaPct(pays?.tva ?? 0.18)} % ${pays?.dans || ''}. Les exonérations du matériel solaire varient d’un pays à l’autre : vérifiez auprès de votre centre des impôts.`.replace(/ {2}/g, ' '));

export const paysParId = (id) => PAYS.find((p) => p.id === String(id || '').toLowerCase()) || null;

const chiffres = (valeur) => String(valeur || '').replace(/\D/g, '');

/**
 * Pays d'un numéro écrit en international (« +225 07… », « 00225… ») ; null
 * pour un numéro local, qui ne dit rien de son pays.
 */
export function paysDuTelephone(telephone) {
  const brut = String(telephone || '').trim();
  if (!/^(\+|00)/.test(brut)) return null;
  const numero = chiffres(brut).replace(/^00/, '');
  return PAYS.find((p) => numero.startsWith(chiffres(p.indicatif))) || null;
}

const sansAccents = (texte) => String(texte || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[’']/g, ' ').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
const AUTRES_NOMS = {
  benin: 'bj', 'burkina faso': 'bf', burkina: 'bf', cameroun: 'cm', cameroon: 'cm',
  'cote d ivoire': 'ci', 'ivory coast': 'ci', mali: 'ml', niger: 'ne', senegal: 'sn', togo: 'tg',
};

/** Pays désigné par son nom (géocodage : « Côte d'Ivoire », « Bénin »…) ou son code. */
export function paysDuNom(nom) {
  const direct = paysParId(nom);
  if (direct) return direct;
  return paysParId(AUTRES_NOMS[sansAccents(nom)]);
}

/**
 * Pays d'une entreprise Pro : celui choisi, sinon celui de son téléphone (ou
 * de son numéro Mobile Money), sinon le Togo. Jamais null : une entreprise
 * enregistrée avant ce réglage garde ainsi ses documents d'avant (NIF, +228).
 */
export const paysDeLEntreprise = (company = {}) => paysParId(company?.pays)
  || paysDuTelephone(company?.telephone)
  || paysDuTelephone(company?.momo)
  || paysParId(PAYS_ENTREPRISE_DEFAUT);

/**
 * Numéro joignable depuis l'étranger (liens WhatsApp) : un numéro saisi en
 * local (« 90 00 00 00 ») reçoit l'indicatif du pays ; un numéro déjà
 * international (« +225… », « 00225… ») est laissé tel quel.
 */
export function numeroInternational(telephone, indicatif) {
  const brut = String(telephone || '').trim();
  if (!brut) return '';
  if (/^(\+|00)/.test(brut) || !indicatif) return brut;
  // Indicatif tapé sans « + » (« 228 90 00 00 00 ») : un numéro national
  // compte au moins 8 chiffres, l'indicatif ne se double pas.
  const code = chiffres(indicatif);
  const numero = chiffres(brut);
  if (numero.startsWith(code) && numero.length >= code.length + 8) return `+${numero}`;
  return `${indicatif} ${brut}`;
}
