// Adresse d'une page légale selon l'endroit où tourne l'app.
//
// Sur le web, un chemin relatif suffit, ouvert dans un nouvel onglet. Dans
// l'app native (Capacitor), le même chemin ouvrirait la page DANS l'app, sans
// bouton retour sur iOS : on vise le site public, que Capacitor confie au
// navigateur du téléphone.
import { PAGES_LEGALES, SITE_PUBLIC } from '../config/legal';

/** L'app tourne-t-elle dans une coquille native (Android / iOS) ? */
export const estAppNative = (fenetre = globalThis.window) =>
  !!fenetre?.Capacitor?.isNativePlatform?.();

/**
 * @param {'confidentialite'|'conditions'|'suppression'} page
 * @returns {{href: string, target?: string, rel?: string}} attributs du lien
 */
export const lienLegal = (page, { natif = estAppNative() } = {}) => {
  const chemin = PAGES_LEGALES[page]?.chemin || PAGES_LEGALES.confidentialite.chemin;
  return natif
    ? { href: `${SITE_PUBLIC}${chemin}` }
    : { href: chemin, target: '_blank', rel: 'noopener' };
};
