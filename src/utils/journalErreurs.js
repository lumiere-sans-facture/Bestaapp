// Rapport d'erreur : ce qu'on retient d'un plantage, et surtout ce qu'on
// n'en retient PAS. Logique pure, sans React ni réseau.
//
// L'app contient les noms et téléphones des clients de chaque installateur.
// Un message d'erreur peut très bien les contenir (« impossible d'enregistrer
// le client Kossi Adjé (+228 90 12 34 56) »). Envoyer ça ailleurs — chez nous
// ou chez un prestataire — serait une fuite de données qui ne nous
// appartiennent pas. Tout passe donc par `nettoyer()` avant de partir.

/** Longueur au-delà de laquelle une pile d'appel n'apprend plus rien. */
const MAX_PILE = 2000;
const MAX_MESSAGE = 500;

// Motifs de données personnelles, remplacés par un marqueur explicite : voir
// « [tel] » dans un rapport dit qu'il y avait un numéro, sans le divulguer.
const MOTIFS = [
  [/(?:\+|00)\d[\d\s.-]{6,16}\d/g, '[tel]'],
  [/\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/g, '[email]'],
  // Suites de 8 chiffres et plus : numéros locaux, IFU, comptes bancaires.
  [/\b\d{8,}\b/g, '[numero]'],
  // Jetons et clés éventuellement présents dans une URL ou un message.
  [/\b(?:eyJ[\w-]{10,}\.[\w-]+\.[\w-]+)\b/g, '[jeton]'],
  [/\b(?:sk|pk|wsk|tk)_[A-Za-z0-9_-]{6,}\b/g, '[cle]'],
];

/** Retire les données personnelles d'un texte libre. */
export const nettoyer = (texte) => {
  let t = String(texte || '');
  for (const [motif, remplacement] of MOTIFS) t = t.replace(motif, remplacement);
  return t;
};

/**
 * Signature de regroupement : deux plantages identiques doivent tomber
 * ensemble, même survenus sur des données différentes. On normalise donc ce
 * qui varie — nombres, identifiants, empreintes de build.
 */
export const signature = (message, pile = '') => {
  const base = `${String(message || '').split('\n')[0]} | ${String(pile || '').split('\n')[1] || ''}`;
  return nettoyer(base)
    .replace(/https?:\/\/[^\s)]+/g, '')       // l'URL varie selon le déploiement
    .replace(/[0-9a-f]{8,}/gi, '')            // empreintes de fichiers buildés
    .replace(/\d+/g, '')                      // lignes, colonnes, quantités
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
};

/**
 * Code court à montrer à l'utilisateur (« ERR-7F3A »).
 * Il sert à retrouver le plantage : sans lui, un signalement se résume à
 * « ça n'a pas marché ». Dérivé de la signature, donc identique pour deux
 * occurrences du même bug — c'est voulu.
 */
export const codeErreur = (sign) => {
  let h = 0;
  for (let i = 0; i < sign.length; i += 1) {
    h = ((h << 5) - h + sign.charCodeAt(i)) | 0;
  }
  return `ERR-${(h & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
};

/** Navigateur et système, à gros traits — jamais l'empreinte complète. */
export const appareilResume = (ua = '') => {
  const s = String(ua);
  const os = /Android/i.test(s) ? 'Android'
    : /iPhone|iPad|iOS/i.test(s) ? 'iOS'
      : /Windows/i.test(s) ? 'Windows'
        : /Mac OS/i.test(s) ? 'macOS'
          : /Linux/i.test(s) ? 'Linux' : 'inconnu';
  const nav = /Edg\//i.test(s) ? 'Edge'
    : /OPR\//i.test(s) ? 'Opera'
      : /Chrome\//i.test(s) ? 'Chrome'
        : /Firefox\//i.test(s) ? 'Firefox'
          : /Safari\//i.test(s) ? 'Safari' : 'inconnu';
  return `${nav} · ${os}`;
};

/**
 * Rapport prêt à être transmis. Ne contient QUE des identifiants internes
 * (userId, orgId) — jamais un nom, jamais un numéro.
 *
 * @param {Error|string} erreur
 * @param {{ecran?: string, version?: string, userId?: string, orgId?: string,
 *           role?: string, ua?: string, enLigne?: boolean, origine?: string,
 *           date?: string}} contexte
 */
export const construireRapport = (erreur, contexte = {}) => {
  const message = nettoyer(erreur?.message || erreur || 'Erreur inconnue').slice(0, MAX_MESSAGE);
  const pile = nettoyer(erreur?.stack || '').slice(0, MAX_PILE);
  const sign = signature(message, pile);
  return {
    code: codeErreur(sign),
    signature: sign,
    message,
    pile,
    // L'écran, pas l'URL complète : un chemin peut porter un identifiant.
    ecran: nettoyer(contexte.ecran || '').slice(0, 120),
    origine: contexte.origine || 'rendu',
    version: contexte.version || '',
    appareil: appareilResume(contexte.ua),
    userId: contexte.userId || null,
    orgId: contexte.orgId || null,
    role: contexte.role || null,
    enLigne: contexte.enLigne !== false,
    date: contexte.date || new Date().toISOString(),
  };
};

/**
 * Message de signalement prêt pour WhatsApp. L'utilisateur décrit ce qu'il
 * faisait ; le contexte technique est déjà là, sinon il manque toujours.
 */
export const messageSignalement = (rapport, nomUtilisateur = '') => [
  'Bonjour, je rencontre un problème sur BestaSolar Pro.',
  '',
  `Code : ${rapport.code}`,
  `Écran : ${rapport.ecran || 'inconnu'}`,
  `Version : ${rapport.version || 'inconnue'}`,
  `Appareil : ${rapport.appareil}`,
  nomUtilisateur ? `Compte : ${nomUtilisateur}` : '',
  '',
  'Ce que je faisais : ',
].filter((l) => l !== '').join('\n');
