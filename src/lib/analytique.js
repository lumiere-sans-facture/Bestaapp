// Envoi des événements d'analytique à PostHog.
//
// PAS DE SDK — VOLONTAIREMENT. posthog-js pèse une cinquantaine de kilooctets
// et sa force est la capture automatique : clics, formulaires, rejeu de
// session. Or c'est précisément ce qu'on ne veut pas ici — cela filmerait les
// coordonnées des clients de chaque installateur, et ferait payer la donnée
// mobile à des techniciens en tournée. Ne restant que l'envoi d'événements,
// une requête HTTP suffit : coût nul dans le bundle, contrôle total.
//
// Format de l'API PostHog (endpoint /e/, comme le SDK officiel) :
//   { api_key, batch: [{ event, distinct_id, timestamp, properties }] }
//
// LOCAL-FIRST : les événements sont mis en file sur l'appareil et partent par
// lots quand le réseau revient. Un technicien hors ligne n'est pas invisible.
import {
  construireEvenement,
  cheminNormalise,
  EVENEMENTS,
  evenementsOuvertureApp,
  problemeAnalytique as evaluerConfig,
} from '../utils/analytique';
import { estAppNative } from '../utils/liensLegaux';
import {
  demarrerPeriode, noterActivite, proprietesTemps, sessionPour, uuidV7,
} from '../utils/tempsUtilisation';

const CLE = String(import.meta.env.VITE_POSTHOG_KEY || '').trim();
// RÉGION DU PROJET. PostHog héberge en « eu » ou en « us », et un projet créé
// dans l'une est inconnu de l'autre : viser la mauvaise région n'échoue pas
// bruyamment, les événements disparaissent simplement. La valeur par défaut
// ne peut donc être qu'un pari — d'où l'affichage de l'hôte réellement
// utilisé dans Plus → Diagnostic, et le bouton de test qui rend le verdict.
const HOTE = String(import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com').trim().replace(/\/$/, '');

// Évalué une fois : une variable d'environnement ne change pas en cours de vie.
const PROBLEME = CLE ? evaluerConfig({ cle: CLE, hote: HOTE }) : null;

/** Destination réelle des événements — affichée au gérant. */
export const hoteAnalytique = () => HOTE;

/** Ce qui empêche l'analytique de fonctionner, en clair, ou null. */
export const problemeAnalytique = () => PROBLEME;

if (PROBLEME && typeof console !== 'undefined') {
  // Le gérant ne lit pas la console : c'est Plus → Diagnostic qui le lui dira.
  // Cette trace sert au développeur, et évite un envoi vers notre propre
  // serveur — un hôte non absolu est résolu comme un chemin relatif.
  console.warn(`[analytique] configuration ignorée — ${PROBLEME}`);
}

const CLE_FILE = 'bestasolar_analytique_file';
const MAX_FILE = 100;      // au-delà, on jette les plus anciens
const DELAI_LOT = 15000;   // regroupement : un envoi toutes les 15 s au plus

/** Vraiment opérationnelle : clé présente ET configuration cohérente. */
export const analytiqueConfiguree = () => !!CLE && !PROBLEME;

// Identifiant ANONYME de l'appareil : tiré au hasard une fois, gardé sur le
// téléphone. Ni nom, ni numéro, ni rien qui désigne une personne — il sert
// seulement à compter les appareils (installations de l'app, visiteurs).
const CLE_APPAREIL = 'bestasolar_appareil';
const identifiantAppareil = () => {
  try {
    let id = localStorage.getItem(CLE_APPAREIL);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLE_APPAREIL, id);
    }
    return id;
  } catch { return null; }
};

// Web, ou l'application installée (Android via l'APK).
const plateforme = () => {
  if (typeof window === 'undefined' || !estAppNative()) return 'web';
  try { return window.Capacitor?.getPlatform?.() || 'android'; } catch { return 'android'; }
};

// Numéro de build gravé à la construction de l'APK (CI) ; absent sur le web.
const BUILD_APP = Number(import.meta.env.VITE_ANDROID_BUILD) || null;

// Plateforme et build, lus AU MOMENT de l'envoi : Capacitor peut n'être
// prêt qu'après le chargement de ce module.
const infosPlateforme = () => {
  const p = plateforme();
  return { plateforme: p, build: p === 'web' ? null : BUILD_APP };
};

let contexte = {
  distinctId: null,
  appareil: identifiantAppareil(),
  version: `${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'}`,
};
let minuteur = null;
let dernierChemin = null;

/** Renseigné à la connexion : identifiant INTERNE seulement. */
export const setContexteAnalytique = (partiel) => { contexte = { ...contexte, ...partiel }; };

const lireFile = () => {
  try { return JSON.parse(localStorage.getItem(CLE_FILE)) || []; } catch { return []; }
};
const ecrireFile = (file) => {
  try { localStorage.setItem(CLE_FILE, JSON.stringify(file.slice(-MAX_FILE))); } catch { /* stockage plein */ }
};

/**
 * Envoie tout ce qui attend. Silencieux : l'analytique ne gêne jamais l'usage.
 *
 * @param {{beacon?: boolean}} options  `beacon` quand la page est en train de
 *   se fermer. `fetch` y échoue — même avec keepalive, la promesse est
 *   rejetée dès que le document est déchargé, et les événements repartaient
 *   alors en double au chargement suivant (constaté en test). sendBeacon est
 *   fait pour ça : le navigateur prend la charge et l'envoie sans la page.
 */
export async function viderFileAnalytique({ beacon = false } = {}) {
  if (!CLE || PROBLEME) return;
  const batch = lireFile();
  if (!batch.length || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  const corps = JSON.stringify({ api_key: CLE, batch });

  if (beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    // Sans accusé de réception : on vide la file si le navigateur a accepté
    // la charge. C'est le compromis du beacon, et il vaut mieux qu'un doublon.
    if (navigator.sendBeacon(`${HOTE}/e/`, new Blob([corps], { type: 'application/json' }))) {
      ecrireFile([]);
      return;
    }
  }

  // La file est vidée AVANT l'envoi : en cas d'échec on la restaure. Sans
  // cela, deux vidages simultanés enverraient deux fois les mêmes événements.
  ecrireFile([]);
  try {
    const res = await fetch(`${HOTE}/e/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: corps,
      keepalive: true,
    });
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    // Remise en file, derrière ce qui a pu s'ajouter entre-temps.
    ecrireFile([...batch, ...lireFile()]);
  }
}

const programmerEnvoi = () => {
  if (minuteur) return;
  minuteur = setTimeout(() => { minuteur = null; viderFileAnalytique(); }, DELAI_LOT);
};

/**
 * Enregistre un événement. Le nom doit figurer dans EVENEMENTS ; sinon il est
 * ignoré sans bruit (utils/analytique.js explique pourquoi).
 */
export function suivre(nom, props = {}, { date } = {}) {
  if (!CLE || PROBLEME) return;
  const evenement = construireEvenement(nom, props, { ...contexte, ...infosPlateforme(), ...(date ? { date } : {}) });
  if (!evenement) return;
  ecrireFile([...lireFile(), evenement]);
  programmerEnvoi();
}

/** Page vue — chemin normalisé, jamais l'URL brute (elle porte des identifiants). */
export function suivrePage(chemin) {
  const c = cheminNormalise(chemin);
  // Un même écran re-rendu ne compte qu'une fois : sinon les statistiques
  // mesurent React, pas les utilisateurs.
  if (c === dernierChemin) return;
  dernierChemin = c;
  suivre(EVENEMENTS.PAGE_VUE, { chemin: c });
}

/**
 * Envoi immédiat d'un événement de test, avec le verdict de PostHog.
 *
 * C'est la seule façon de distinguer « ça marche » de « ça part dans le
 * vide » : une mauvaise région ou une clé erronée ne provoque aucun symptôme
 * visible dans l'app.
 * @returns {Promise<{ok: boolean, statut: number|string, hote: string}>}
 */
export async function testerAnalytique() {
  if (!CLE) return { ok: false, statut: 'clé absente', hote: HOTE };
  // On n'envoie pas une requête vouée à partir au mauvais endroit : sans hôte
  // absolu, elle atterrirait sur notre propre serveur (réponse « 405 »).
  if (PROBLEME) return { ok: false, statut: 'configuration invalide', hote: HOTE, probleme: PROBLEME };
  const evenement = construireEvenement(EVENEMENTS.PAGE_VUE, { chemin: '/test-diagnostic' }, { ...contexte, ...infosPlateforme() });
  try {
    const res = await fetch(`${HOTE}/e/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: CLE, batch: [evenement] }),
    });
    return { ok: res.ok, statut: res.status, hote: HOTE };
  } catch (e) {
    return { ok: false, statut: e.message || 'réseau injoignable', hote: HOTE };
  }
}

/**
 * Ouverture de l'application installée : « app_installee » à la toute
 * première, « app_mise_a_jour » après une nouvelle version, et
 * « app_ouverte » à chaque lancement (voir evenementsOuvertureApp). Le build
 * est mémorisé sur l'appareil pour la fois suivante. Sur le web : rien.
 */
const CLE_BUILD_VU = 'bestasolar_app_build';
export function signalerOuvertureApp() {
  // Sans analytique configurée, on ne mémorise rien : l'installation sera
  // comptée le jour où l'envoi fonctionne, au lieu d'être perdue.
  const { plateforme: p, build } = infosPlateforme();
  if (!CLE || PROBLEME || p === 'web' || !build) return;
  let memorise = null;
  try { memorise = localStorage.getItem(CLE_BUILD_VU); } catch { /* stockage indisponible */ }
  for (const { nom, props } of evenementsOuvertureApp(build, memorise)) suivre(nom, props);
  try { localStorage.setItem(CLE_BUILD_VU, String(build)); } catch { /* sans gravité */ }
}

/** Plateforme et build vus par l'analytique — affichés dans le diagnostic. */
export const plateformeAnalytique = () => infosPlateforme();

// ---------------------------------------------------------------------------
// TEMPS D'UTILISATION — web et application (règles : utils/tempsUtilisation.js)
//
// Une période s'ouvre quand l'app passe au premier plan et se ferme quand
// elle le quitte : son événement « temps_utilisation » entre aussitôt dans la
// file, AVANT l'envoi de fermeture. La file étant gardée sur l'appareil, il
// part au plus tard à la prochaine ouverture.
//
// Si l'app est tuée sans prévenir (Android à court de mémoire, plantage), la
// période en cours a été recopiée toutes les 30 s sur l'appareil : elle est
// comptée à l'ouverture suivante. Une copie par ONGLET, pour qu'un second
// onglet ouvert ne « récupère » pas la période d'un onglet encore vivant.
// ---------------------------------------------------------------------------
const PREFIXE_PERIODE = 'bestasolar_periode_';
const CLE_SESSION = 'bestasolar_session';
const BATTEMENT_MS = 30000;
// Une copie plus vieille que ça n'a plus d'onglet vivant pour la rafraîchir.
const COPIE_ORPHELINE_MS = 3 * BATTEMENT_MS;

const ONGLET = (() => { try { return crypto.randomUUID(); } catch { return String(Math.random()).slice(2); } })();
let periode = null;
let battement = null;
let session = (() => { try { return JSON.parse(localStorage.getItem(CLE_SESSION)); } catch { return null; } })();

// Appelé au démarrage de l'app : ne doit jamais lever, quel que soit le
// navigateur — un repli sur Math.random vaut mieux qu'un écran blanc.
const nouvelleSession = () => {
  const aleatoire = new Uint8Array(10);
  try { crypto.getRandomValues(aleatoire); } catch { aleatoire.forEach((_, i) => { aleatoire[i] = Math.floor(Math.random() * 256); }); }
  return uuidV7(Date.now(), aleatoire);
};

const copierPeriode = () => {
  try {
    if (periode) localStorage.setItem(PREFIXE_PERIODE + ONGLET, JSON.stringify({ ...periode, vu: Date.now(), session: session?.id }));
    else localStorage.removeItem(PREFIXE_PERIODE + ONGLET);
  } catch { /* stockage indisponible : seule la reprise après plantage est perdue */ }
};

const ouvrirPeriode = () => {
  if (periode || typeof document === 'undefined' || document.visibilityState !== 'visible') return;
  const maintenant = Date.now();
  session = sessionPour(session, maintenant, nouvelleSession);
  contexte = { ...contexte, session: session.id };
  periode = demarrerPeriode(maintenant);
  copierPeriode();
  battement = setInterval(copierPeriode, BATTEMENT_MS);
};

const fermerPeriode = () => {
  if (!periode) return;
  const fin = Date.now();
  const props = proprietesTemps(periode, fin);
  periode = null;
  clearInterval(battement);
  copierPeriode();
  session = { ...session, fin };
  try { localStorage.setItem(CLE_SESSION, JSON.stringify(session)); } catch { /* sans gravité */ }
  if (props) suivre(EVENEMENTS.TEMPS_UTILISATION, props);
};

// Les gestes de l'utilisateur. Le défilement d'une liste ne remonte pas
// jusqu'à window : on l'écoute en phase de capture.
const noterGeste = () => {
  if (!periode) return;
  const maintenant = Date.now();
  if (maintenant - periode.derniere >= 1000) periode = noterActivite(periode, maintenant);
};

/** Périodes laissées par un onglet ou une app fermés sans prévenir. */
const recupererPeriodesOrphelines = () => {
  let cles = [];
  try { cles = Object.keys(localStorage).filter((c) => c.startsWith(PREFIXE_PERIODE)); } catch { return; }
  for (const cle of cles) {
    let copie = null;
    try { copie = JSON.parse(localStorage.getItem(cle)); } catch { /* illisible : effacée */ }
    const vu = Number(copie?.vu);
    if (Number.isFinite(vu) && Date.now() - vu < COPIE_ORPHELINE_MS) continue; // onglet encore vivant
    try { localStorage.removeItem(cle); } catch { /* sans gravité */ }
    const props = Number.isFinite(vu) && proprietesTemps(copie, vu);
    if (!props) continue;
    const enCours = contexte.session;
    contexte = { ...contexte, session: copie.session || enCours };
    suivre(EVENEMENTS.TEMPS_UTILISATION, { ...props, recupere: true }, { date: new Date(vu).toISOString() });
    contexte = { ...contexte, session: enCours };
  }
};

/** Filets d'envoi (retour du réseau, fermeture de l'onglet) et temps d'utilisation. */
export function installerAnalytique() {
  if (!CLE || PROBLEME || typeof window === 'undefined') return;
  window.addEventListener('online', viderFileAnalytique);
  recupererPeriodesOrphelines();
  ouvrirPeriode();
  for (const geste of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']) {
    window.addEventListener(geste, noterGeste, { capture: true, passive: true });
  }
  // `pagehide` est le seul événement fiable sur mobile pour capter une
  // fermeture : `beforeunload` ne se déclenche pas sur iOS. La période est
  // close AVANT l'envoi, pour partir dans le même lot.
  window.addEventListener('pagehide', () => { fermerPeriode(); viderFileAnalytique({ beacon: true }); });
  // Retour d'une page gardée en cache par le navigateur (bouton « retour »).
  window.addEventListener('pageshow', ouvrirPeriode);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      fermerPeriode();
      viderFileAnalytique({ beacon: true });
    } else {
      ouvrirPeriode();
    }
  });
}

export { EVENEMENTS };
