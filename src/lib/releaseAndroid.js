// Dernière Release Android publiée sur GitHub (APK hors Play Store).
//
// Lecture PUBLIQUE de l'API GitHub, sans clé : rien de privé ne transite. En
// cas d'échec (hors ligne, limite de requêtes de GitHub atteinte), null —
// la page d'accueil garde son bouton de téléchargement, l'app n'affiche
// simplement pas de bandeau. Résultat gardé quelques minutes en mémoire de
// session pour ne pas réinterroger GitHub à chaque écran.
import { URL_DERNIERE_RELEASE } from '../config/android';
import { lireRelease } from '../utils/miseAJourAndroid';

const CLE = 'bestasolar_release_android';
const DUREE_MS = 10 * 60 * 1000;

export async function derniereReleaseAndroid() {
  try {
    const memo = JSON.parse(sessionStorage.getItem(CLE) || 'null');
    if (memo && Date.now() - memo.le < DUREE_MS) return memo.release;
  } catch { /* stockage indisponible : on interroge GitHub */ }
  try {
    const rep = await fetch(URL_DERNIERE_RELEASE, { headers: { Accept: 'application/vnd.github+json' } });
    if (!rep.ok) return null;
    const release = lireRelease(await rep.json());
    try { sessionStorage.setItem(CLE, JSON.stringify({ le: Date.now(), release })); } catch { /* sans gravité */ }
    return release;
  } catch {
    return null;
  }
}
