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
import { construireEvenement, cheminNormalise, EVENEMENTS } from '../utils/analytique';

const CLE = String(import.meta.env.VITE_POSTHOG_KEY || '').trim();
// Région du projet : « eu » par défaut (données hébergées en Europe).
const HOTE = String(import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com').trim().replace(/\/$/, '');

const CLE_FILE = 'bestasolar_analytique_file';
const MAX_FILE = 100;      // au-delà, on jette les plus anciens
const DELAI_LOT = 15000;   // regroupement : un envoi toutes les 15 s au plus

export const analytiqueConfiguree = () => !!CLE;

let contexte = {
  distinctId: null,
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
  if (!CLE) return;
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
export function suivre(nom, props = {}) {
  if (!CLE) return;
  const evenement = construireEvenement(nom, props, contexte);
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

/** Filets d'envoi : retour du réseau, et fermeture de l'onglet. */
export function installerAnalytique() {
  if (!CLE || typeof window === 'undefined') return;
  window.addEventListener('online', viderFileAnalytique);
  // `pagehide` est le seul événement fiable sur mobile pour capter une
  // fermeture : `beforeunload` ne se déclenche pas sur iOS.
  window.addEventListener('pagehide', () => { viderFileAnalytique({ beacon: true }); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') viderFileAnalytique({ beacon: true });
  });
}

export { EVENEMENTS };
