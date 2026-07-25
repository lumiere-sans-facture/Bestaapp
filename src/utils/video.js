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
        return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&autoplay=1&modestbranding=1&iv_load_policy=3${s ? `&start=${s}` : ''}` };
      }
    }
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      if (id) {
        return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&autoplay=1&modestbranding=1&iv_load_policy=3${s ? `&start=${s}` : ''}` };
      }
    }

    // Vimeo — gère aussi les vidéos non répertoriées : leur lien contient un
    // code de confidentialité (vimeo.com/ID/code ou ?h=code) que le lecteur
    // DOIT recevoir (paramètre h), sinon Vimeo refuse la lecture.
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const m = u.pathname.match(/(\d{6,})/);
      if (m) {
        const id = m[1];
        const hash = u.searchParams.get('h')
          || (u.pathname.match(new RegExp(`${id}/([a-zA-Z0-9]{6,})`)) || [])[1]
          || '';
        // Lecteur « nu » façon plateforme de cours : ni titre, ni auteur, ni
        // avatar, ni badge — impossible de deviner l'hébergeur. (Le petit logo
        // Vimeo se retire dans les réglages du compte, plan payant requis.)
        const clean = 'title=0&byline=0&portrait=0&badge=0&pip=0&dnt=1';
        return {
          kind: 'iframe',
          src: `https://player.vimeo.com/video/${id}?autoplay=1&playsinline=1&${clean}${hash ? `&h=${hash}` : ''}${s ? `#t=${s}s` : ''}`,
        };
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
