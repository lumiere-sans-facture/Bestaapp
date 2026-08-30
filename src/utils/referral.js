// Programme d'affiliation : codes partenaires et tracking du lien de parrainage.

// Alphabet sans ambiguïté pour les suffixes : pas de 0/O ni de 1/I.
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Partie « nom » du code : premier mot du nom, sans accents ni caractères spéciaux. */
export const codeBaseFromName = (name = '') =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents
    .toUpperCase()
    .replace(/[^A-Z ]/g, ' ')
    .trim()
    .split(/\s+/)[0]
    .slice(0, 10) || 'PARTENAIRE';

// Ancien préfixe des codes partenaires. Il a été retiré du format, mais des
// liens « ?ref=BESTA-… » circulent toujours (WhatsApp, affiches, cartes) :
// tout code reçu est donc débarrassé de ce préfixe avant comparaison.
const PREFIXE_HISTORIQUE = 'BESTA-';

/**
 * Forme canonique d'un code partenaire : majuscules, sans espaces, et sans le
 * préfixe historique. C'est la SEULE forme sur laquelle on compare deux codes.
 */
export const normaliseCode = (code = '') => {
  const propre = String(code || '').trim().toUpperCase();
  return propre.startsWith(PREFIXE_HISTORIQUE) ? propre.slice(PREFIXE_HISTORIQUE.length) : propre;
};

/** Deux codes désignent-ils le même partenaire, quelle que soit leur écriture ? */
export const memeCode = (a, b) => {
  const gauche = normaliseCode(a);
  return Boolean(gauche && gauche === normaliseCode(b));
};

/**
 * Code lisible basé sur le nom : AMINATA.
 * En cas d'homonyme, un suffixe court est ajouté : AMINATA-K7.
 */
export const generatePartnerCode = (name, existingCodes = []) => {
  const nom = codeBaseFromName(name);
  // « BESTA » est réservé : un code commençant par lui serait raccourci à tort
  // en retirant le préfixe historique.
  const base = nom === 'BESTA' ? 'PARTENAIRE' : nom;
  const pris = existingCodes.map(normaliseCode);
  let code = base;
  while (pris.includes(code)) {
    const suffix = Array.from({ length: 2 }, () => CHARSET[Math.floor(Math.random() * CHARSET.length)]).join('');
    code = `${base}-${suffix}`;
  }
  return code;
};

export const partnerLink = (code) => `${window.location.origin}/?ref=${code}`;

// ---- Attribution « last-click » avec expiration 30 jours ----

const REF_KEY = 'bestasolar_ref';
export const REF_TTL_DAYS = 30;

/** À appeler au chargement de l'app : capture ?ref=NOM-XX et nettoie l'URL. */
export const captureRefFromUrl = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (!ref) return null;
    const code = normaliseCode(ref);
    // last-click : un nouveau clic remplace l'attribution précédente
    localStorage.setItem(REF_KEY, JSON.stringify({
      code,
      expiresAt: Date.now() + REF_TTL_DAYS * 86400000,
      clickPending: true,
    }));
    const url = new URL(window.location.href);
    url.searchParams.delete('ref');
    window.history.replaceState({}, '', url);
    return code;
  } catch {
    return null;
  }
};

/** Attribution active (non expirée), ou null. */
export const getActiveRef = () => {
  try {
    const r = JSON.parse(localStorage.getItem(REF_KEY));
    if (r && r.expiresAt > Date.now()) return r;
  } catch { /* attribution illisible */ }
  localStorage.removeItem(REF_KEY);
  return null;
};

/** Retourne le code si un clic vient d'être capturé et pas encore comptabilisé. */
export const consumeRefClick = () => {
  const r = getActiveRef();
  if (r && r.clickPending) {
    localStorage.setItem(REF_KEY, JSON.stringify({ ...r, clickPending: false }));
    return r.code;
  }
  return null;
};

/**
 * Attribution automatique du partenaire pour une affaire :
 * 1) le parrain niveau 1 de la piste s'il existe,
 * 2) sinon le partenaire du lien d'affiliation actif (?ref=…),
 * 3) sinon le profil partenaire du créateur du devis — chaque affaire a
 *    impérativement un apporteur.
 */
export const resolveAutoPartner = (lead, partners, creatorUserId = null) => {
  if (lead?.parrainL1) {
    return partners.find((p) => p.id === lead.parrainL1) || null;
  }
  const ref = getActiveRef();
  if (ref) {
    const refPartner = partners.find((p) => memeCode(p.code, ref.code) && p.status === 'actif');
    if (refPartner) return refPartner;
  }
  if (creatorUserId) {
    return partners.find((p) => p.userId === creatorUserId) || null;
  }
  return null;
};
