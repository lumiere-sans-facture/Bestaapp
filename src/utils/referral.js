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

/** Suffixe déterministe d'une identité partenaire.
 * Une même identité garde le même code sur deux appareils ; deux UUID
 * différents reçoivent un suffixe différent avec une probabilité de collision
 * négligeable, ensuite verrouillée en base de données. */
const suffixFromSeed = (seed, attempt = 0) => {
  let hash = 0x811c9dc5;
  for (const char of `${seed}:${attempt}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  }
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    // Mélange supplémentaire : les six caractères ne dépendent pas seulement
    // des cinq bits de poids faible du hash initial.
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    hash >>>= 0;
    suffix += CHARSET[hash % CHARSET.length];
  }
  return suffix;
};

// Ancien préfixe des codes partenaires. Il a disparu du format, mais des liens
// « ?ref=BESTA-… », des cartes et des affiches le portant circulent toujours :
// tout code reçu en est débarrassé avant comparaison. Sans ça, un filleul venu
// par un ancien lien ne serait plus rattaché à son parrain.
const PREFIXE_HISTORIQUE = 'BESTA-';

/** Forme canonique d'un code : majuscules, sans espaces, sans le préfixe
 *  historique. C'est la SEULE forme sur laquelle on compare deux codes. */
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
 * Code lisible et toujours distinct : AMINATA-K8R4MZ.
 * `identity` est l'id immutable du partenaire (UUID ou p-user-...) : le code
 * reste stable si l'application est ouverte simultanément sur deux appareils.
 */
export const generatePartnerCode = (name, existingCodes = [], identity = '') => {
  const nom = codeBaseFromName(name);
  // « BESTA » est réservé : un code commençant par lui serait raccourci à tort
  // par normaliseCode, qui y verrait l'ancien préfixe.
  const base = nom === 'BESTA' ? 'PARTENAIRE' : nom;
  const used = new Set(existingCodes.map(normaliseCode));
  const seed = identity || `${base}:${Math.random()}:${Date.now()}`;
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const code = `${base}-${suffixFromSeed(seed, attempt)}`;
    if (!used.has(code)) return code;
  }
  throw new Error('Génération du code partenaire impossible.');
};

export const partnerLink = (code) => `${window.location.origin}/?ref=${code}`;

// ---- Attribution « last-click » avec expiration 30 jours ----

const REF_KEY = 'bestasolar_ref';
export const REF_TTL_DAYS = 30;

/** À appeler au chargement de l'app : capture ?ref=NOM-XXXXXX et nettoie l'URL. */
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

