// Normalisation unique des numéros : le navigateur, les Edge Functions et les
// comparaisons Google Contacts utilisent exactement les mêmes règles.
const digitsOnly = (value) => String(value ?? '').replace(/[^0-9]/g, '');

// L'application s'adresse au marché togolais (voir config/company.js) : un
// numéro saisi sans indicatif est donc togolais par défaut. L'entreprise
// émettrice reste béninoise, mais ça ne concerne que les documents.
export const PAYS_PAR_DEFAUT = 'TG';

// Indicatifs des pays dont on sait interpréter une saisie locale. Un numéro
// écrit en international dans l'un d'eux est reconnu quel que soit le pays
// demandé : c'est le numéro qui fait foi, jamais le réglage.
const INDICATIFS = { TG: '228', BJ: '229' };

/**
 * Corrige un numéro national selon le plan de numérotation du pays.
 *
 * Bénin : le plan est passé à dix chiffres le 30 novembre 2024, les anciens
 * numéros à huit chiffres prenant le préfixe « 01 ». Togo : huit chiffres,
 * sans préfixe d'acheminement, rien à corriger.
 */
function corrigePlanNational(indicatif, national) {
  if (indicatif === '229' && /^\d{8}$/.test(national)) return `01${national}`;
  return national;
}

/**
 * Retourne un numéro comparable au format E.164, ou null quand il est vide.
 *
 * Deux cas seulement. Le numéro porte son indicatif (« + », « 00 » ou un
 * indicatif connu en tête) : on le garde tel quel, le pays écrit l'emporte.
 * Sinon c'est une saisie locale, interprétée dans le pays demandé.
 *
 * Ainsi « 90 12 34 56 » devient « +22890123456 » au Togo, tandis que
 * « +229 61 73 29 56 » reste béninois et devient « +2290161732956 ».
 */
export function normalizePhoneNumber(phone, country = PAYS_PAR_DEFAUT) {
  const brut = String(phone ?? '').trim();
  let digits = digitsOnly(brut);
  if (!digits) return null;

  const indicatif = INDICATIFS[String(country).toUpperCase()] || null;

  // Le « + » et le « 00 » sont explicites ; un indicatif connu suivi d'un
  // numéro complet l'est assez pour ne pas re-préfixer un numéro déjà entier.
  let international = brut.startsWith('+');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
    international = true;
  }
  const indicatifPorte = Object.values(INDICATIFS)
    .find((code) => digits.startsWith(code) && digits.length > code.length + 6);
  if (indicatifPorte) international = true;

  if (international) {
    const code = Object.values(INDICATIFS).find((item) => digits.startsWith(item));
    if (code) digits = `${code}${corrigePlanNational(code, digits.slice(code.length))}`;
    return /^\d{7,15}$/.test(digits) ? `+${digits}` : null;
  }

  // Saisie locale : sans pays connu, on ne peut pas deviner l'indicatif.
  if (!indicatif) return /^\d{7,15}$/.test(digits) ? `+${digits}` : null;
  const national = corrigePlanNational(indicatif, digits);
  return /^\d{7,12}$/.test(national) ? `+${indicatif}${national}` : null;
}

/** Compare uniquement les représentations canoniques, jamais les chaînes saisies. */
export function samePhoneNumber(a, b, country = PAYS_PAR_DEFAUT) {
  const left = normalizePhoneNumber(a, country);
  const right = normalizePhoneNumber(b, country);
  return Boolean(left && right && left === right);
}


/** Trouve un contact dont AU MOINS un numéro est identique après normalisation.
 *  La People API fournit { phoneNumbers: [{ value }] }; le format tableau de
 *  chaînes est aussi admis afin de garder la fonction pure et testable. */
export function findContactByNormalizedPhone(contacts, phone, country = PAYS_PAR_DEFAUT) {
  const target = normalizePhoneNumber(phone, country);
  if (!target) return null;
  return (contacts || []).find((contact) => {
    const items = contact?.phoneNumbers || contact?.phones || [];
    return items.some((item) => normalizePhoneNumber(typeof item === 'string' ? item : item?.value, country) === target);
  }) || null;
}
