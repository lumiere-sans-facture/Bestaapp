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

/**
 * Code lisible basé sur le nom : BESTA-AMINATA.
 * En cas d'homonyme, un suffixe court est ajouté : BESTA-AMINATA-K7.
 */
export const generatePartnerCode = (name, existingCodes = []) => {
  const base = codeBaseFromName(name);
  let code = `BESTA-${base}`;
  while (existingCodes.includes(code)) {
    const suffix = Array.from({ length: 2 }, () => CHARSET[Math.floor(Math.random() * CHARSET.length)]).join('');
    code = `BESTA-${base}-${suffix}`;
  }
  return code;
};

export const partnerLink = (code) => `${window.location.origin}/?ref=${code}`;

// ---- Attribution « last-click » avec expiration 30 jours ----

const REF_KEY = 'bestasolar_ref';
export const REF_TTL_DAYS = 30;

/** À appeler au chargement de l'app : capture ?ref=BESTA-XXXX et nettoie l'URL. */
export const captureRefFromUrl = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (!ref) return null;
    const code = ref.trim().toUpperCase();
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
