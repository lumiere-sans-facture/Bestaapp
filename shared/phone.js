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
  const raw = String(phone ?? '').trim();
  let digits = digitsOnly(raw);
  if (!digits) return null;

  // Ne jamais réinterpréter un indicatif international explicitement saisi
  // comme un numéro local béninois. Exemple : +228… doit rester togolais.
  const isBenin = String(country).toUpperCase() === 'BJ';
  if (isBenin && (digits.startsWith('00229') || digits.startsWith('229'))) {
    if (digits.startsWith('00229')) digits = digits.slice(5);
    else digits = digits.slice(3);

    // Ancien plan de numérotation : 8 chiffres. Le nouveau format Bénin est
    // toujours 01 + les 8 chiffres historiques.
    if (/^\d{8}$/.test(digits)) return `+22901${digits}`;
    if (/^01\d{8}$/.test(digits)) return `+229${digits}`;
    return /^\d{7,12}$/.test(digits) ? `+229${digits}` : null;
  }

  // Une saisie avec « + » ou « 00 » a déjà choisi son indicatif : elle reste
  // internationale quel que soit le pays par défaut de l'organisation.
  if (raw.startsWith('+') || digits.startsWith('00')) {
    if (digits.startsWith('00')) digits = digits.slice(2);
    return /^\d{7,15}$/.test(digits) ? `+${digits}` : null;
  }

  // Accepte également un indicatif togolais saisi sans le signe +.
  if (digits.startsWith('228') && /^\d{11}$/.test(digits)) return `+${digits}`;

  if (isBenin) {
    // Ancien plan de numérotation : 8 chiffres. Le nouveau format Bénin est
    // toujours 01 + les 8 chiffres historiques.
    if (/^\d{8}$/.test(digits)) return `+22901${digits}`;
    if (/^01\d{8}$/.test(digits)) return `+229${digits}`;

    // Numéro Bénin non standard : on le met tout de même sous une forme stable
    // pour ne jamais refaire une comparaison brute de chaînes.
    return /^\d{7,12}$/.test(digits) ? `+229${digits}` : null;
  }

  // Repli E.164 pour les pays hors Bénin. Une saisie locale ne peut pas être
  // devinée sans indicatif.
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
