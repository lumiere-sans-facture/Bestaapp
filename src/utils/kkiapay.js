// Paiement KKiaPay : préparation du numéro Mobile Money. Logique pure, sans
// React ni réseau.
//
// Le widget KKiaPay refuse un numéro qu'il ne sait pas rattacher à un
// opérateur, avec un laconique « numéro n'est pas valide ». Deux pièges :
//
//  1. il attend le numéro AU FORMAT INTERNATIONAL, indicatif compris et sans
//     « + » (« 22890123456 ») ; un numéro local à 8 chiffres est rejeté ;
//  2. en SANDBOX, seuls les numéros de test de KKiaPay fonctionnent — tous
//     béninois. Un vrai numéro togolais, même parfaitement écrit, échoue.
//
// D'où ce module : normaliser, puis dire précisément ce qui bloque AVANT
// d'ouvrir le widget, plutôt que de laisser l'utilisateur buter dessus.

/** Indicatifs des pays desservis. Le Togo est le marché d'origine. */
export const INDICATIFS = { TG: '228', BJ: '229' };
export const INDICATIF_DEFAUT = INDICATIFS.TG;

const CONNUS = Object.values(INDICATIFS);

/**
 * Numéro saisi → format international sans « + » (« 22890123456 »).
 * Accepte « +228 90 12 34 56 », « 00228… », « 228… » et le local « 90123456 »
 * (l'indicatif par défaut est alors ajouté).
 * @returns {string} chaîne vide si la saisie ne contient aucun chiffre.
 */
export const normaliserMomo = (saisie, indicatifDefaut = INDICATIF_DEFAUT) => {
  let n = String(saisie || '').replace(/\D/g, '');
  if (!n) return '';
  n = n.replace(/^00+/, ''); // préfixe international composé « 00 »
  // Aucun numéro local togolais ou béninois ne commence par 228/229 : un tel
  // début ne peut être qu'un indicatif — à condition qu'il reste un numéro
  // derrière, sinon c'est un local de 8 chiffres qui y ressemble.
  if (CONNUS.some((i) => n.startsWith(i)) && n.length > 8) return n;
  return `${indicatifDefaut}${n}`;
};

// Togo : 8 chiffres. Bénin : 10 chiffres depuis le 30 novembre 2024
// (plan national ARCEP Bénin) — l'ancien format à 8 chiffres est refusé.
const FORMAT_VALIDE = new RegExp(`^(${INDICATIFS.TG}\\d{8}|${INDICATIFS.BJ}\\d{10})// Paiement KKiaPay : préparation du numéro Mobile Money. Logique pure, sans
// React ni réseau.
//
// Le widget KKiaPay refuse un numéro qu'il ne sait pas rattacher à un
// opérateur, avec un laconique « numéro n'est pas valide ». Deux pièges :
//
//  1. il attend le numéro AU FORMAT INTERNATIONAL, indicatif compris et sans
//     « + » (« 22890123456 ») ; un numéro local à 8 chiffres est rejeté ;
//  2. en SANDBOX, seuls les numéros de test de KKiaPay fonctionnent — tous
//     béninois. Un vrai numéro togolais, même parfaitement écrit, échoue.
//
// D'où ce module : normaliser, puis dire précisément ce qui bloque AVANT
// d'ouvrir le widget, plutôt que de laisser l'utilisateur buter dessus.

/** Indicatifs des pays desservis. Le Togo est le marché d'origine. */
export const INDICATIFS = { TG: '228', BJ: '229' };
export const INDICATIF_DEFAUT = INDICATIFS.TG;

const CONNUS = Object.values(INDICATIFS);

/**
 * Numéro saisi → format international sans « + » (« 22890123456 »).
 * Accepte « +228 90 12 34 56 », « 00228… », « 228… » et le local « 90123456 »
 * (l'indicatif par défaut est alors ajouté).
 * @returns {string} chaîne vide si la saisie ne contient aucun chiffre.
 */
export const normaliserMomo = (saisie, indicatifDefaut = INDICATIF_DEFAUT) => {
  let n = String(saisie || '').replace(/\D/g, '');
  if (!n) return '';
  n = n.replace(/^00+/, ''); // préfixe international composé « 00 »
  // Aucun numéro local togolais ou béninois ne commence par 228/229 : un tel
  // début ne peut être qu'un indicatif — à condition qu'il reste un numéro
  // derrière, sinon c'est un local de 8 chiffres qui y ressemble.
  if (CONNUS.some((i) => n.startsWith(i)) && n.length > 8) return n;
  return `${indicatifDefaut}${n}`;
};

);

/** Le numéro respecte-t-il le plan actuel du Togo ou du Bénin ? */
export const momoValide = (saisie, indicatifDefaut = INDICATIF_DEFAUT) =>
  FORMAT_VALIDE.test(normaliserMomo(saisie, indicatifDefaut));

/**
 * Numéros de test du bac à sable KKiaPay (tous béninois — le sandbox ne
 * connaît pas les opérateurs togolais). Source : guide de test KKiaPay.
 */
export const NUMEROS_TEST_SANDBOX = [
  { numero: '22997000000', operateur: 'MTN Bénin', scenario: 'Paiement réussi' },
  { numero: '22968000000', operateur: 'Moov Bénin', scenario: 'Paiement réussi' },
  { numero: '22997000002', operateur: 'MTN Bénin', scenario: 'Solde insuffisant' },
  { numero: '22997000003', operateur: 'MTN Bénin', scenario: 'Paiement refusé' },
];

/** « 22997000000 » → « +229 97 00 00 00 » (lisible, et relisible à la saisie). */
export const formatMomo = (numero) => {
  const n = String(numero || '').replace(/\D/g, '');
  if (!n) return '';
  const ind = CONNUS.find((i) => n.startsWith(i) && n.length > 8);
  if (!ind) return n.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  return `+${ind} ${n.slice(ind.length).replace(/(\d{2})(?=\d)/g, '$1 ').trim()}`;
};

/** Ce numéro est-il un numéro de test du sandbox ? */
export const estNumeroTest = (saisie) => {
  const n = normaliserMomo(saisie, INDICATIFS.BJ);
  return NUMEROS_TEST_SANDBOX.some((t) => t.numero === n);
};

/**
 * Ce qui empêche le paiement de partir, en français, ou null si tout va bien.
 * En sandbox, un vrai numéro est refusé par KKiaPay : autant le dire ici.
 * @param {string} saisie      numéro tel que tapé par l'utilisateur
 * @param {{sandbox?: boolean}} options
 * @returns {string|null}
 */
export const problemeNumero = (saisie, { sandbox = false } = {}) => {
  const brut = String(saisie || '').replace(/\D/g, '');
  if (!brut) return 'Renseignez votre numéro Mobile Money avant de payer.';
  if (!momoValide(saisie))
    return 'Numéro Mobile Money incomplet : 8 chiffres au Togo (ex. 90 12 34 56) ou 10 chiffres au Bénin (préfixe 01), indicatif +228 ou +229 accepté.';
  if (sandbox && !estNumeroTest(saisie))
    return 'Mode test : KKiaPay n’accepte que ses numéros de test (voir la liste sous le bouton). Un vrai numéro sera refusé.';
  return null;
};
