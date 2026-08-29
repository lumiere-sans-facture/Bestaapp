const GUIDE_VERSION = 'v1';
const GUIDE_PREFIX = `bestasolar_guide_accueil_${GUIDE_VERSION}:`;
const PENDING = 'a_voir';
const DONE = 'termine';

export const onboardingStorageKey = (userId) =>
  userId ? `${GUIDE_PREFIX}${userId}` : null;

const storageDisponible = (storage) =>
  storage || (typeof localStorage !== 'undefined' ? localStorage : null);

/**
 * Marque le guide comme nécessaire uniquement lors de la création réelle du
 * profil. Un compte existant sans clé ne doit jamais être considéré comme neuf.
 */
export function marquerGuideNouveauUtilisateur(userId, storage) {
  const key = onboardingStorageKey(userId);
  const cible = storageDisponible(storage);
  if (!key || !cible) return false;
  try {
    if (cible.getItem(key) === null) cible.setItem(key, PENDING);
    return cible.getItem(key) === PENDING;
  } catch {
    return false;
  }
}

export function doitAfficherGuide(userId, storage) {
  const key = onboardingStorageKey(userId);
  const cible = storageDisponible(storage);
  if (!key || !cible) return false;
  try {
    return cible.getItem(key) === PENDING;
  } catch {
    return false;
  }
}

export function terminerGuideUtilisateur(userId, storage) {
  const key = onboardingStorageKey(userId);
  const cible = storageDisponible(storage);
  if (!key || !cible) return false;
  try {
    cible.setItem(key, DONE);
    return true;
  } catch {
    return false;
  }
}
