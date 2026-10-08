// Application Android distribuée HORS Play Store, en APK téléchargeable.
//
// Chaque mise en production (fusion dans `main`) construit l'APK et le publie
// dans une Release GitHub du dépôt public (voir .github/workflows/
// android-apk.yml). La dernière est toujours servie à la même adresse : la
// page d'accueil et le bandeau de mise à jour de l'app pointent dessus.

export const DEPOT_GITHUB = 'lumiere-sans-facture/Bestaapp';

/** Nom FIXE de l'APK dans chaque Release (l'adresse « latest » en dépend). */
export const NOM_APK = 'BestaSolar.apk';

/** Téléchargement direct de la dernière version — sans compte GitHub. */
export const URL_APK = `https://github.com/${DEPOT_GITHUB}/releases/latest/download/${NOM_APK}`;

/** Informations publiques de la dernière Release (version, taille, date). */
export const URL_DERNIERE_RELEASE = `https://api.github.com/repos/${DEPOT_GITHUB}/releases/latest`;

/** Étiquette des Releases Android : « android-<numéro de build> ». */
export const PREFIXE_ETIQUETTE = 'android-';

/** Toutes les Releases (compteurs de téléchargement), page par page. */
export const URL_RELEASES = `https://api.github.com/repos/${DEPOT_GITHUB}/releases`;
