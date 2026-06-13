// Conversion d'un lien vidéo public en lecteur intégrable dans l'app.
// Pris en charge : YouTube (watch, youtu.be, shorts, live, embed),
// Vimeo, et fichiers vidéo directs (mp4/webm).

export const toEmbed = (url = '') => {
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
        return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&autoplay=1` };
      }
    }
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      if (id) {
        return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&autoplay=1` };
      }
    }

    // Vimeo
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const m = u.pathname.match(/(\d{6,})/);
      if (m) {
        return { kind: 'iframe', src: `https://player.vimeo.com/video/${m[1]}?autoplay=1&playsinline=1` };
      }
    }

    // Fichier vidéo direct
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(u.pathname)) {
      return { kind: 'video', src: url };
    }
  } catch {
    // URL invalide : pas de lecteur intégré
  }
  return null;
};
