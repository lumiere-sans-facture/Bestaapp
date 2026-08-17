// Sommaire minuté d'une vidéo YouTube : extraction depuis sa DESCRIPTION.
// Logique pure, sans réseau ni React — c'est elle qui décide ce qui est un
// chapitre et ce qui n'en est pas un. Le téléchargement de la description,
// lui, se fait côté serveur (YouTube refuse les requêtes du navigateur).

/** Identifiant d'une vidéo YouTube, quelle que soit la forme du lien.
 *  Retourne null pour tout ce qui n'est pas YouTube (Vimeo, mp4, PDF…). */
export const youtubeVideoId = (url) => {
  const s = String(url || '').trim();
  if (!s) return null;
  const m = s.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
};

// Un chapitre YouTube s'écrit « 0:00 Introduction ». Autour de cette base, les
// auteurs ajoutent puces, tirets et parenthèses ; on les tolère toutes. Le
// libellé, lui, ne doit pas être vide : « 1:30 » seul n'est pas un chapitre.
const LIGNE_CHAPITRE = /^[\s\-–—•*·]*\(?(\d{1,2}:\d{2}(?::\d{2})?)\)?\s*[)\].:–—-]*\s*(.+?)\s*$/;
// Forme inverse, plus rare : « Introduction — 0:00 ».
const LIGNE_INVERSE = /^\s*(.+?)\s*[[(–—:-]+\s*\(?(\d{1,2}:\d{2}(?::\d{2})?)\)?\s*[\])]?\s*$/;

/** « mm:ss » ou « h:mm:ss » → secondes (NaN si illisible). */
const enSecondes = (txt) => {
  const parts = String(txt).split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n)) || parts.length < 2 || parts.length > 3) return NaN;
  return parts.reduce((s, n) => s * 60 + n, 0);
};

/**
 * Chapitres d'une description YouTube, triés par minutage.
 *
 * Règles retenues, calquées sur celles de YouTube :
 *  - il faut au moins DEUX chapitres pour parler d'un sommaire ; une seule
 *    ligne minutée dans une description est presque toujours un renvoi
 *    (« voir 4:32 ») et non un plan ;
 *  - les minutages doivent être croissants — une liste désordonnée n'est pas
 *    un sommaire ;
 *  - un même minutage n'apparaît qu'une fois (le premier libellé gagne).
 * Retourne [] si rien de convaincant : mieux vaut un champ vide qu'un
 * sommaire inventé.
 */
export const chapitresDeDescription = (description) => {
  const trouves = [];
  for (const ligne of String(description || '').split(/\r?\n/)) {
    if (!ligne.trim()) continue;
    let m = ligne.match(LIGNE_CHAPITRE);
    let t;
    let label;
    if (m) {
      t = enSecondes(m[1]);
      label = m[2];
    } else if ((m = ligne.match(LIGNE_INVERSE))) {
      t = enSecondes(m[2]);
      label = m[1];
    } else continue;
    label = String(label).replace(/^[\s\-–—:.)\]]+/, '').trim();
    if (Number.isNaN(t) || !label) continue;
    trouves.push({ t, label });
  }
  if (trouves.length < 2) return [];
  // Ordre croissant obligatoire : sinon ce sont des renvois épars, pas un plan.
  for (let i = 1; i < trouves.length; i += 1) {
    if (trouves[i].t < trouves[i - 1].t) return [];
  }
  const vus = new Set();
  return trouves.filter((c) => (vus.has(c.t) ? false : vus.add(c.t)));
};

/** Minutes → « 8 min » / « 1 h 05 ». */
const formatMinutes = (total) => {
  if (!total) return '';
  if (total < 60) return `${total} min`;
  const reste = total % 60;
  return `${Math.floor(total / 60)} h${reste ? ` ${String(reste).padStart(2, '0')}` : ''}`;
};

/** Durée ISO 8601 de l'API YouTube (« PT1H5M30S ») → « 1 h 06 » / « 8 min ». */
export const dureeDepuisIso = (iso) => {
  const m = String(iso || '').match(/^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return '';
  const secondes = (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
  return formatMinutes(Math.round(secondes / 60));
};

/** Durée en secondes (page YouTube) → même format lisible. */
export const dureeDepuisSecondes = (secondes) => {
  const s = Math.round(Number(secondes) || 0);
  // Une vidéo de moins de 30 s reste « 1 min » : afficher « 0 min » n'aide personne.
  return s > 0 ? formatMinutes(Math.max(1, Math.round(s / 60))) : '';
};
