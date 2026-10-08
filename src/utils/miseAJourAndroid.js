// Mises à jour de l'application Android (APK hors Play Store) — logique pure.
//
// Le numéro de BUILD (numéro d'exécution du CI, toujours croissant) identifie
// chaque APK : il est gravé dans l'app à la construction (VITE_ANDROID_BUILD)
// et dans l'étiquette de la Release (« android-245 »). Une Release dont le
// build dépasse celui de l'app installée est une mise à jour.
import { PREFIXE_ETIQUETTE, NOM_APK } from '../config/android';

/** Numéro de build d'une étiquette « android-245 », sinon null. */
export const buildDeEtiquette = (etiquette = '') => {
  const s = String(etiquette || '');
  if (!s.startsWith(PREFIXE_ETIQUETTE)) return null;
  const n = Number(s.slice(PREFIXE_ETIQUETTE.length));
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Ce qu'on retient d'une Release GitHub (réponse de l'API) pour l'afficher :
 * build, version lisible, taille de l'APK, date. null si ce n'est pas une
 * Release Android exploitable (pas d'APK, étiquette inconnue).
 */
export const lireRelease = (release) => {
  const build = buildDeEtiquette(release?.tag_name);
  const apk = (release?.assets || []).find((a) => a?.name === NOM_APK);
  if (!build || !apk) return null;
  const version = /(\d+\.\d+\.\d+)/.exec(release?.name || '')?.[1] || null;
  return {
    build,
    version,
    tailleOctets: Number(apk.size) || 0,
    date: release?.published_at || null,
  };
};

/** Une mise à jour est-elle disponible pour l'app installée ? */
export const miseAJourDisponible = (buildInstalle, release) => {
  const installe = Number(buildInstalle);
  return !!release && Number.isInteger(installe) && installe > 0 && release.build > installe;
};

/** « 8,4 Mo » */
export const tailleLisible = (octets) => {
  const mo = (Number(octets) || 0) / (1024 * 1024);
  return mo > 0 ? `${mo.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo` : '';
};

/**
 * Téléchargements de l'APK, toutes versions publiées confondues (compteurs
 * GitHub). Un téléchargement n'est pas une installation : les installations
 * réelles se lisent dans l'analytique (événement « app_installee »).
 */
export const totalTelechargements = (releases = []) => (releases || [])
  .filter((r) => buildDeEtiquette(r?.tag_name))
  .reduce((total, r) => total + (r.assets || [])
    .filter((a) => a?.name === NOM_APK)
    .reduce((n, a) => n + (Number(a.download_count) || 0), 0), 0);
