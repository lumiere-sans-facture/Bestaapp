// Normalisation unique des numéros : le navigateur, les Edge Functions et les
// comparaisons Google Contacts utilisent exactement les mêmes règles.
const digitsOnly = (value) => String(value ?? '').replace(/[^0-9]/g, '');

/**
 * Retourne un numéro comparable au format E.164, ou null quand il est vide.
 *
 * Au Bénin, les anciens numéros à huit chiffres passent au format à dix chiffres
 * en préfixant `01`. Ainsi « 61 73 29 56 » et « +229 01 61 73 29 56 » deviennent
 * tous les deux « +2290161732956 ».
 */
export function normalizePhoneNumber(phone, country = 'BJ') {
  let digits = digitsOnly(phone);
  if (!digits) return null;

  if (String(country).toUpperCase() === 'BJ') {
    // Accepte +229…, 00229… et les saisies locales, sans faire dépendre la
    // comparaison des espaces, tirets, parenthèses ou du signe +.
    if (digits.startsWith('00229')) digits = digits.slice(5);
    else if (digits.startsWith('229')) digits = digits.slice(3);

    // Ancien plan de numérotation : 8 chiffres. Le nouveau format Bénin est
    // toujours 01 + les 8 chiffres historiques.
    if (/^\d{8}$/.test(digits)) return `+22901${digits}`;
    if (/^01\d{8}$/.test(digits)) return `+229${digits}`;

    // Numéro Bénin non standard : on le met tout de même sous une forme stable
    // pour ne jamais refaire une comparaison brute de chaînes.
    return /^\d{7,12}$/.test(digits) ? `+229${digits}` : null;
  }

  // Repli E.164 pour les pays hors Bénin. Les appels internationaux conservent
  // leur préfixe ; une saisie locale ne peut pas être devinée sans indicatif.
  if (digits.startsWith('00')) digits = digits.slice(2);
  return /^\d{7,15}$/.test(digits) ? `+${digits}` : null;
}

/** Compare uniquement les représentations canoniques, jamais les chaînes saisies. */
export function samePhoneNumber(a, b, country = 'BJ') {
  const left = normalizePhoneNumber(a, country);
  const right = normalizePhoneNumber(b, country);
  return Boolean(left && right && left === right);
}


/** Trouve un contact dont AU MOINS un numéro est identique après normalisation.
 *  La People API fournit { phoneNumbers: [{ value }] }; le format tableau de
 *  chaînes est aussi admis afin de garder la fonction pure et testable. */
export function findContactByNormalizedPhone(contacts, phone, country = 'BJ') {
  const target = normalizePhoneNumber(phone, country);
  if (!target) return null;
  return (contacts || []).find((contact) => {
    const items = contact?.phoneNumbers || contact?.phones || [];
    return items.some((item) => normalizePhoneNumber(typeof item === 'string' ? item : item?.value, country) === target);
  }) || null;
}
