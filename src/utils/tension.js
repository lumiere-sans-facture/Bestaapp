// Tension de batterie (12, 24 ou 48 V) des onduleurs et des kits.
//
// Un onduleur hybride ne fonctionne qu'avec un parc batterie de SA tension :
// un 6 kVA 48 V branché sur une batterie 24 V ne démarre pas. L'assistant ne
// doit donc jamais remplacer l'onduleur d'un kit par un modèle d'une autre
// tension, même plus puissant.
//
// Logique pure : le champ `tension` saisi fait foi ; à défaut, la tension est
// lue dans les désignations (« Batterie lithium 24V … »). Une tension
// inconnue ne bloque rien — comme une limite PV inconnue, elle ne peut pas
// être contredite.

export const TENSIONS_BATTERIE = [12, 24, 48];

/** Valeur saisie → 12 | 24 | 48, sinon null. */
export const lireTension = (valeur) => {
  const n = Number(String(valeur ?? '').replace(',', '.').replace(/\s*v$/i, ''));
  return TENSIONS_BATTERIE.includes(n) ? n : null;
};

/**
 * Tension écrite dans un libellé : « 24V », « 48 V », « 51,2V » (une batterie
 * lithium « 48 V » est souvent annoncée 51,2 V nominal).
 */
export const tensionDansTexte = (texte = '') => {
  const m = /(?:^|[^\d.,])(12|24|48|51[.,]2)\s*v(?![a-z])/i.exec(String(texte));
  if (!m) return null;
  return /^51/.test(m[1]) ? 48 : Number(m[1]);
};

/** Tension d'un onduleur : champ saisi, sinon sa désignation. */
export const tensionOnduleur = (onduleur) =>
  lireTension(onduleur?.tension)
  ?? tensionDansTexte(`${onduleur?.brand || ''} ${onduleur?.model || ''}`);

const LIGNE_BATTERIE = /batterie/i;

/** Tension d'un kit : champ saisi, sinon celle écrite sur sa ligne batterie. */
export const tensionKit = (kit) => {
  const saisie = lireTension(kit?.tension);
  if (saisie) return saisie;
  for (const l of kit?.lines || []) {
    if (!LIGNE_BATTERIE.test(l?.designation || '')) continue;
    const t = tensionDansTexte(l.designation);
    if (t) return t;
  }
  return null;
};

/** Même tension — ou l'une des deux inconnue, donc invérifiable. */
export const tensionsCompatibles = (a, b) => !a || !b || a === b;

/** Onduleurs utilisables avec une batterie de cette tension. */
export const onduleursCompatibles = (onduleurs = [], tension = null) =>
  (onduleurs || []).filter((o) => tensionsCompatibles(tensionOnduleur(o), tension));

/** « 24 V », ou chaîne vide si inconnue. */
export const libelleTension = (tension) => (lireTension(tension) ? `${lireTension(tension)} V` : '');

/**
 * Complète la tension des éléments qui n'en ont JAMAIS eu (enregistrés avant
 * l'existence du champ) à partir de la référence de même identifiant — les
 * kits et onduleurs officiels. Un élément dont la tension a été saisie, ou
 * volontairement vidée (champ présent, valeur nulle), n'est pas touché.
 * Renvoie la liste d'origine si rien ne change (pas de réplication inutile).
 */
export const completerTensions = (liste = [], reference = []) => {
  if (!Array.isArray(liste)) return liste;
  const parId = new Map((reference || []).map((r) => [r.id, lireTension(r.tension)]));
  let change = false;
  const suite = liste.map((item) => {
    if (!item || Object.prototype.hasOwnProperty.call(item, 'tension')) return item;
    const t = parId.get(item.id);
    if (!t) return item;
    change = true;
    return { ...item, tension: t };
  });
  return change ? suite : liste;
};
