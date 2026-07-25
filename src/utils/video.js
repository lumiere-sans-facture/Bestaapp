// Conversion d'un lien vidéo public en lecteur intégrable dans l'app.
// Pris en charge : YouTube (watch, youtu.be, shorts, live, embed),
// Vimeo, et fichiers vidéo directs (mp4/webm).

/**
 * @param {string} url        lien public de la vidéo
 * @param {number} [start=0]  démarrage en secondes (sommaire minuté des leçons)
 */
export const toEmbed = (url = '', start = 0) => {
  const s = Math.max(0, Math.floor(Number(start) || 0));
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');

    // YouTube
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      let id = null;
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else {
        const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})/);
        if (m) id = m[1];
      }
      if (id) {
        return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&autoplay=1${s ? `&start=${s}` : ''}` };
      }
    }
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      if (id) {
        return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&autoplay=1${s ? `&start=${s}` : ''}` };
      }
    }

    // Vimeo
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const m = u.pathname.match(/(\d{6,})/);
      if (m) {
        return { kind: 'iframe', src: `https://player.vimeo.com/video/${m[1]}?autoplay=1&playsinline=1${s ? `#t=${s}s` : ''}` };
      }
    }

    // Fichier vidéo direct
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(u.pathname)) {
      return { kind: 'video', src: url, start: s };
    }
  } catch {
    // URL invalide : pas de lecteur intégré
  }
  return null;
};
