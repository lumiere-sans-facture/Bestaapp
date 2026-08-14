// Transport des rapports d'erreur. Ce module décide QUAND et OÙ envoyer ;
// ce qui part est décidé par utils/journalErreurs.js (nettoyage compris).
//
// LOCAL-FIRST : un technicien plante souvent là où il n'a pas de réseau —
// c'est même corrélé. Un rapport perdu faute de connexion serait donc le
// rapport le plus utile. Tout est mis en file d'attente sur l'appareil et
// repart à la prochaine occasion.
//
// DEUX DESTINATIONS, complémentaires et indépendantes :
//   • Sentry (si VITE_SENTRY_DSN est configuré) — pile d'appel lisible grâce
//     aux source maps, regroupement, alerte. Envoi immédiat, sans file : son
//     SDK gère lui-même les reprises.
//   • notre journal (/api/erreur) — la trace nous reste, même si Sentry est
//     bloqué par un pare-feu ou un bloqueur de publicité, et c'est lui qui
//     porte la file d'attente hors-ligne.
// L'échec de l'un n'empêche jamais l'autre.
import { construireRapport } from '../utils/journalErreurs';
import { envoyerASentry, sentryConfigure } from './sentry';

const CLE_FILE = 'bestasolar_erreurs_file';
const MAX_FILE = 30;          // au-delà, ce sont les mêmes qui se répètent
const MAX_PAR_SESSION = 10;   // garde-fou : une boucle de rendu peut en cracher mille

let envoyesCetteSession = 0;
// __APP_VERSION__ / __APP_ENV__ sont injectés au build (vite.config.js) :
// sans eux, impossible de dire QUELLE version a planté.
let contexte = {
  version: `${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'}`
    + `${typeof __APP_ENV__ === 'string' ? ` (${__APP_ENV__})` : ''}`,
  userId: null, orgId: null, role: null,
};

/** Renseigné par l'app une fois l'utilisateur connu. */
export const setContexteErreur = (partiel) => { contexte = { ...contexte, ...partiel }; };

const lireFile = () => {
  try { return JSON.parse(localStorage.getItem(CLE_FILE)) || []; } catch { return []; }
};
const ecrireFile = (file) => {
  try { localStorage.setItem(CLE_FILE, JSON.stringify(file.slice(-MAX_FILE))); } catch { /* stockage plein */ }
};

/**
 * Envoi d'un lot vers NOTRE journal. Sentry, lui, reçoit chaque plantage à
 * l'unité au moment où il survient (voir signalerErreur) : son SDK a sa
 * propre file, la doubler ferait des doublons au retour du réseau.
 * @returns {Promise<boolean>} vrai si le lot est parti (donc retirable de la file)
 */
async function envoyerVersService(rapports) {
  try {
    const res = await fetch('/api/erreur', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rapports }),
      // L'onglet peut se fermer juste après un plantage : keepalive laisse la
      // requête se terminer quand même.
      keepalive: true,
    });
    // 404 : l'app tourne sans les fonctions serveur (npm run dev, APK).
    // Inutile de garder la file indéfiniment dans ce cas.
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

/** Tente de vider la file. Silencieux : un échec ne doit jamais gêner l'utilisateur. */
export async function viderFile() {
  const file = lireFile();
  if (!file.length || !navigator.onLine) return;
  if (await envoyerVersService(file)) ecrireFile([]);
}

/**
 * Consigne une erreur. Retourne le rapport (avec son code) pour que l'écran
 * d'erreur puisse l'afficher — même si l'envoi échoue.
 * @param {Error|string} erreur
 * @param {{ecran?: string, origine?: string}} [extra]
 */
export function signalerErreur(erreur, extra = {}) {
  const rapport = construireRapport(erreur, {
    ...contexte,
    ...extra,
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    enLigne: typeof navigator === 'undefined' ? true : navigator.onLine,
  });
  // Une erreur qui se répète en boucle ne doit pas noyer la file ni le réseau.
  if (envoyesCetteSession < MAX_PAR_SESSION) {
    envoyesCetteSession += 1;
    ecrireFile([...lireFile(), rapport]);
    viderFile();
    // L'objet Error d'origine part vers Sentry : sa pile est structurée, donc
    // traduisible par les source maps. Le rapport, lui, est déjà nettoyé.
    if (sentryConfigure()) {
      envoyerASentry(erreur instanceof Error ? erreur : null, rapport);
    }
  }
  return rapport;
}

/**
 * Branche les filets globaux : erreurs hors React (événements, minuteurs) et
 * promesses rejetées sans `catch`. Sans eux, tout un pan des plantages reste
 * invisible — l'écran ne casse pas toujours, mais l'action échoue en silence.
 */
export function installerFiletsGlobaux() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (e) => {
    // Les erreurs de chargement de ressource (image, script) n'ont pas de
    // `error` : elles n'apprennent rien d'exploitable.
    if (e?.error) signalerErreur(e.error, { origine: 'globale', ecran: window.location?.pathname });
  });
  window.addEventListener('unhandledrejection', (e) => {
    signalerErreur(e?.reason || 'Promesse rejetée', { origine: 'promesse', ecran: window.location?.pathname });
  });
  // Retour du réseau : c'est le moment d'écouler ce qui attend.
  window.addEventListener('online', viderFile);
}
