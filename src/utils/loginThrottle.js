// Frein de connexion : ralentit les essais automatisés depuis l'écran de
// connexion. Défense en profondeur seulement — le vrai rempart contre le
// brute force est côté serveur (limite par IP + CAPTCHA de Supabase Auth,
// voir supabase/DEPLOIEMENT.md § 3) : un appel direct à l'API Supabase,
// hors de cet écran, n'est pas soumis à ce compteur, qui vit dans le
// localStorage de l'appareil.
const KEY = 'bestasolar_login_throttle';
const MAX_ATTEMPTS = 5;
export const CAPTCHA_AFTER_ATTEMPTS = 3; // dès ce nombre d'échecs, exiger un CAPTCHA
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // fenêtre glissante de 15 min
const BASE_LOCKOUT_MS = 15 * 60 * 1000; // premier verrou : 15 min
const MAX_LOCKOUT_MS = 2 * 60 * 60 * 1000; // plafond : 2 h

const keyFor = (email) => (email || '').trim().toLowerCase();

const readAll = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
};

const writeAll = (all) => {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* stockage indisponible */ }
};

/** Verrou et échecs en cours pour cet email : { locked, remainingMs, count }. */
export const getLockState = (email) => {
  const entry = readAll()[keyFor(email)];
  const remainingMs = entry?.lockedUntil ? entry.lockedUntil - Date.now() : 0;
  const count = entry?.count || 0;
  return remainingMs > 0 ? { locked: true, remainingMs, count } : { locked: false, remainingMs: 0, count };
};

/**
 * Échec de connexion : incrémente le compteur de cet email. Au 5e échec dans
 * la fenêtre de 15 min, verrouille — durée doublée à chaque nouveau verrou
 * consécutif (15 min → 30 min → 1 h → 2 h, plafonnée). Retourne le nouvel
 * état de verrou.
 */
export const registerFailedAttempt = (email) => {
  const all = readAll();
  const k = keyFor(email);
  const now = Date.now();
  const prev = all[k];
  const withinWindow = Boolean(prev) && now - prev.firstAttemptAt < ATTEMPT_WINDOW_MS;
  const entry = {
    count: (withinWindow ? prev.count : 0) + 1,
    firstAttemptAt: withinWindow ? prev.firstAttemptAt : now,
    // Le compteur de verrous survit à l'expiration de la fenêtre : il ne
    // repart à zéro que sur une connexion réussie (clearAttempts), sinon la
    // progressivité serait annulée par la simple attente du déverrouillage.
    lockCount: prev?.lockCount || 0,
  };
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + Math.min(BASE_LOCKOUT_MS * 2 ** entry.lockCount, MAX_LOCKOUT_MS);
    entry.lockCount += 1;
    entry.count = 0;
    entry.firstAttemptAt = now;
  }
  all[k] = entry;
  writeAll(all);
  return getLockState(email);
};

/** Connexion réussie : efface l'historique d'échecs de cet email. */
export const clearAttempts = (email) => {
  const all = readAll();
  delete all[keyFor(email)];
  writeAll(all);
};

/** Texte court en français pour le temps restant avant déverrouillage. */
export const formatLockRemaining = (remainingMs) => {
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
};
