// Sommaire minuté d'une vidéo YouTube, via le proxy serveur /api/youtube.
// Le navigateur ne peut pas lire une description YouTube directement (requête
// croisée refusée) : tout passe par la fonction serverless.
//
// Local-first : un échec (hors-ligne, proxy absent en `npm run dev`, vidéo
// privée) n'est JAMAIS une erreur bloquante — l'appelant retombe sur la
// saisie manuelle du sommaire, qui reste la référence.
import { chapitresDeDescription, youtubeVideoId } from '../utils/youtubeChapters';

/**
 * @param {string} url  lien de la vidéo
 * @returns {Promise<{title:string, duration:string, chapters:Array}|null>}
 *          null si ce n'est pas YouTube ou si rien n'a pu être récupéré.
 */
export async function fetchYoutubeSommaire(url) {
  const videoId = youtubeVideoId(url);
  if (!videoId) return null;
  try {
    const res = await fetch(`/api/youtube?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data = await res.json();
    // Le serveur a déjà découpé les chapitres ; on revalide la forme reçue
    // plutôt que de faire confiance à une réponse inattendue.
    const chapters = Array.isArray(data?.chapters)
      ? data.chapters.filter((c) => Number.isFinite(Number(c?.t)) && String(c?.label || '').trim())
        .map((c) => ({ t: Number(c.t), label: String(c.label).trim() }))
      : [];
    return {
      title: String(data?.title || ''),
      duration: String(data?.duration || ''),
      chapters,
    };
  } catch {
    return null; // hors-ligne ou proxy indisponible : saisie manuelle
  }
}

// Réexporté pour l'écran : coller une description YouTube dans le champ
// fonctionne même sans réseau (mode local, vidéo privée).
export { chapitresDeDescription, youtubeVideoId };
