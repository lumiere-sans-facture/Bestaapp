// Durée d'utilisation de l'application (web et Android). Logique pure, sans
// navigateur : lib/analytique.js branche ces fonctions sur les événements de
// la page (affichage, masquage, gestes).
//
// CE QUI EST MESURÉ : le temps ACTIF, écran affiché. Une « période » commence
// quand l'app passe au premier plan et se termine quand elle passe en arrière-
// plan (autre application, écran éteint, onglet changé ou fermé). Chaque
// période donne un événement « temps_utilisation » avec sa durée.
//
// UN ONGLET OUBLIÉ NE COMPTE PAS DES HEURES. Entre deux gestes (toucher,
// défilement, frappe), au plus INACTIVITE_MAX_MS sont comptées : un silence
// plus long est lu comme une absence. On lit une fiche sans la toucher — pas
// une demi-journée.
//
// SESSIONS : des périodes séparées de moins de PAUSE_SESSION_MS forment une
// même session (le technicien qui passe sur WhatsApp envoyer un devis puis
// revient). C'est la convention de PostHog lui-même (30 minutes).

export const INACTIVITE_MAX_MS = 5 * 60 * 1000;
export const PAUSE_SESSION_MS = 30 * 60 * 1000;
// En dessous : un aller-retour involontaire, pas de l'usage.
export const DUREE_MIN_MS = 2000;
// Au-dessus : horloge déréglée ou valeur aberrante, plafonnée.
export const DUREE_MAX_MS = 12 * 60 * 60 * 1000;

/** Nouvelle période d'utilisation commencée à `maintenant` (ms). */
export const demarrerPeriode = (maintenant) => ({ debut: maintenant, derniere: maintenant, actifMs: 0 });

/**
 * Un geste à `maintenant` : le temps écoulé depuis le précédent est compté,
 * plafonné à INACTIVITE_MAX_MS. Une horloge qui recule ne retire rien.
 */
export const noterActivite = (periode, maintenant) => {
  if (!periode) return periode;
  const ecart = Math.max(0, (Number(maintenant) || 0) - periode.derniere);
  return {
    ...periode,
    derniere: Math.max(periode.derniere, Number(maintenant) || 0),
    actifMs: periode.actifMs + Math.min(ecart, INACTIVITE_MAX_MS),
  };
};

/**
 * Propriétés de l'événement « temps_utilisation » pour une période close à
 * `fin`, ou null si elle est trop courte pour compter.
 * @returns {{duree_secondes: number, duree_minutes: number}|null}
 */
export const proprietesTemps = (periode, fin) => {
  if (!periode) return null;
  const actif = Math.min(noterActivite(periode, fin).actifMs, DUREE_MAX_MS);
  // Écrit ainsi pour écarter aussi NaN (copie abîmée sur l'appareil).
  if (!(actif >= DUREE_MIN_MS)) return null;
  const secondes = Math.round(actif / 1000);
  // Minutes à une décimale : lisibles telles quelles dans PostHog.
  return { duree_secondes: secondes, duree_minutes: Math.round(secondes / 6) / 10 };
};

/**
 * Session à utiliser pour une période qui commence à `maintenant` : la même
 * si la précédente s'est terminée il y a moins de PAUSE_SESSION_MS, sinon une
 * nouvelle (identifiant fourni par `nouvelId`).
 * @param {{id: string, fin: number}|null} session
 */
export const sessionPour = (session, maintenant, nouvelId) => (
  session?.id && Number.isFinite(session.fin) && maintenant - session.fin <= PAUSE_SESSION_MS
    ? session
    : { id: nouvelId(), fin: maintenant }
);

/**
 * Identifiant de session au format UUID v7 — celui qu'attend PostHog pour
 * `$session_id` : il commence par l'heure, ce qui permet à PostHog de ranger
 * et de mesurer les sessions. Le reste est tiré au hasard.
 * @param {number} maintenant  horodatage en ms
 * @param {Uint8Array} aleatoire  10 octets aléatoires
 */
export const uuidV7 = (maintenant, aleatoire) => {
  const o = new Uint8Array(16);
  let t = Math.max(0, Math.floor(Number(maintenant) || 0));
  for (let i = 5; i >= 0; i -= 1) { o[i] = t % 256; t = Math.floor(t / 256); }
  o[6] = 0x70 | (aleatoire[0] & 0x0f);   // version 7
  o[7] = aleatoire[1];
  o[8] = 0x80 | (aleatoire[2] & 0x3f);   // variante RFC 4122
  for (let i = 9; i < 16; i += 1) o[i] = aleatoire[i - 6];
  const h = Array.from(o, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
