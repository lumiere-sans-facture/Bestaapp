// Fonction serverless Vercel — sommaire minuté d'une vidéo YouTube.
// Le navigateur ne peut pas lire la description d'une vidéo (YouTube refuse
// les requêtes croisées) : ce proxy la récupère côté serveur et renvoie les
// chapitres déjà découpés.
//
// Deux sources, dans l'ordre :
//   1. l'API officielle si YOUTUBE_API_KEY est configurée dans Vercel —
//      stable, et elle donne aussi le titre et la durée exacte ;
//   2. à défaut, la page publique de la vidéo, dont on extrait la description.
//      Sans clé à créer, mais dépendant de la mise en page de YouTube.
//
// Réponse : { videoId, title, duration, chapters: [{ t, label }], source }
// Un échec ne renvoie jamais d'erreur 500 « nue » : l'app doit pouvoir
// continuer en saisie manuelle.

import { limiter, erreurServeur, PLAFONDS } from './_lib/garde.js';

const LIGNE_CHAPITRE = /^[\s\-–—•*·]*\(?(\d{1,2}:\d{2}(?::\d{2})?)\)?\s*[)\].:–—-]*\s*(.+?)\s*$/;
const LIGNE_INVERSE = /^\s*(.+?)\s*[[(–—:-]+\s*\(?(\d{1,2}:\d{2}(?::\d{2})?)\)?\s*[\])]?\s*$/;

const enSecondes = (txt) => {
  const parts = String(txt).split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n)) || parts.length < 2 || parts.length > 3) return NaN;
  return parts.reduce((s, n) => s * 60 + n, 0);
};

// Mêmes règles que src/utils/youtubeChapters.js (au moins deux chapitres,
// minutages croissants) : le client revalide de toute façon.
function chapitresDeDescription(description) {
  const trouves = [];
  for (const ligne of String(description || '').split(/\r?\n/)) {
    if (!ligne.trim()) continue;
    let m = ligne.match(LIGNE_CHAPITRE);
    let t;
    let label;
    if (m) { t = enSecondes(m[1]); label = m[2]; }
    else if ((m = ligne.match(LIGNE_INVERSE))) { t = enSecondes(m[2]); label = m[1]; }
    else continue;
    label = String(label).replace(/^[\s\-–—:.)\]]+/, '').trim();
    if (Number.isNaN(t) || !label) continue;
    trouves.push({ t, label });
  }
  if (trouves.length < 2) return [];
  for (let i = 1; i < trouves.length; i += 1) {
    if (trouves[i].t < trouves[i - 1].t) return [];
  }
  const vus = new Set();
  return trouves.filter((c) => (vus.has(c.t) ? false : vus.add(c.t)));
}

const videoIdDe = (url) => {
  const m = String(url || '').match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  if (m) return m[1];
  // L'appelant peut aussi passer directement l'identifiant.
  return /^[A-Za-z0-9_-]{11}$/.test(String(url || '').trim()) ? String(url).trim() : null;
};

const formatMinutes = (total) => {
  if (!total) return '';
  if (total < 60) return `${total} min`;
  const reste = total % 60;
  return `${Math.floor(total / 60)} h${reste ? ` ${String(reste).padStart(2, '0')}` : ''}`;
};

const dureeDepuisIso = (iso) => {
  const m = String(iso || '').match(/^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return '';
  const secondes = (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
  return formatMinutes(Math.round(secondes / 60));
};

async function viaApiOfficielle(videoId, cle) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${cle}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API YouTube ${res.status}`);
  const item = (await res.json())?.items?.[0];
  if (!item) throw new Error('Vidéo introuvable');
  return {
    title: item.snippet?.title || '',
    duration: dureeDepuisIso(item.contentDetails?.duration),
    chapters: chapitresDeDescription(item.snippet?.description),
    source: 'api',
  };
}

async function viaPagePublique(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=fr`, {
    headers: { 'accept-language': 'fr-FR,fr;q=0.9', 'user-agent': 'Mozilla/5.0 (compatible; BestaSolar/1.0)' },
  });
  if (!res.ok) throw new Error(`YouTube ${res.status}`);
  const html = await res.text();
  // La description brute vit dans le JSON initial de la page.
  const desc = html.match(/"shortDescription":"((?:\\.|[^"\\])*)"/);
  const titre = html.match(/"title":"((?:\\.|[^"\\])*)"/);
  const secondes = html.match(/"lengthSeconds":"(\d+)"/);
  if (!desc) throw new Error('Description illisible');
  // Le JSON échappe les sauts de ligne : on les restaure avant découpage.
  const description = JSON.parse(`"${desc[1]}"`);
  return {
    title: titre ? JSON.parse(`"${titre[1]}"`) : '',
    duration: secondes ? formatMinutes(Math.max(1, Math.round(Number(secondes[1]) / 60))) : '',
    chapters: chapitresDeDescription(description),
    source: 'page',
  };
}

export default async function handler(req, res) {
  if (limiter(req, res, PLAFONDS.youtube, 'youtube')) return;

  const videoId = videoIdDe(req.query?.url || req.query?.v);
  if (!videoId) {
    res.status(400).json({ error: 'Lien YouTube non reconnu' });
    return;
  }
  const cle = process.env.YOUTUBE_API_KEY;
  try {
    const data = cle ? await viaApiOfficielle(videoId, cle) : await viaPagePublique(videoId);
    // Le sommaire change rarement : une heure de cache épargne des appels.
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({ videoId, ...data });
    return;
  } catch (e) {
    // Repli : si l'API officielle échoue (quota, clé expirée), la page reste
    // tentable. Inutile de faire échouer l'utilisateur pour un souci de clé.
    if (cle) {
      try {
        const data = await viaPagePublique(videoId);
        res.status(200).json({ videoId, ...data });
        return;
      } catch { /* les deux sources ont échoué */ }
    }
    // `e.message` porte le statut de l'API YouTube et parfois sa réponse :
    // au journal, jamais au client.
    erreurServeur(req, res, 502, 'Sommaire indisponible', e, { videoId });
  }
}
