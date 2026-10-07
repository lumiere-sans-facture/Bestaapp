import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { URL_APK } from '../config/android';
import { derniereReleaseAndroid } from '../lib/releaseAndroid';
import { miseAJourDisponible, tailleLisible } from '../utils/miseAJourAndroid';
import { estAppNative } from '../utils/liensLegaux';

// Numéro de build gravé à la construction de l'APK (CI) ; absent sur le web.
const BUILD_INSTALLE = Number(import.meta.env.VITE_ANDROID_BUILD) || 0;

/**
 * Bandeau « Nouvelle version disponible » — dans l'application Android
 * installée (APK hors Play Store) uniquement. Vérifié à l'ouverture et à
 * chaque retour dans l'app. Android n'autorise pas une app hors Play Store à
 * se remplacer seule : le bandeau télécharge la nouvelle version, que
 * l'utilisateur installe d'un geste par-dessus l'ancienne (ses données
 * restent).
 */
export default function MiseAJourAndroid() {
  const [release, setRelease] = useState(null);
  const [masque, setMasque] = useState(false);

  useEffect(() => {
    if (!estAppNative() || !BUILD_INSTALLE) return undefined;
    let actif = true;
    const verifier = () => derniereReleaseAndroid().then((r) => {
      if (actif && miseAJourDisponible(BUILD_INSTALLE, r)) setRelease(r);
    });
    verifier();
    const auRetour = () => { if (document.visibilityState === 'visible') verifier(); };
    document.addEventListener('visibilitychange', auRetour);
    return () => { actif = false; document.removeEventListener('visibilitychange', auRetour); };
  }, []);

  if (!release || masque) return null;
  return (
    <div className="storage-alert abo-alert is-info" role="status">
      <Download size={16} />
      <span style={{ flex: 1 }}>
        <strong>Nouvelle version de l’application disponible</strong>
        {release.version ? ` (${release.version}, build ${release.build}` : ` (build ${release.build}`}
        {release.tailleOctets ? ` · ${tailleLisible(release.tailleOctets)})` : ')'}.{' '}
        <a href={URL_APK} style={{ fontWeight: 700, textDecoration: 'underline' }}>Mettre à jour</a>
      </span>
      <button type="button" onClick={() => setMasque(true)} aria-label="Plus tard"><X size={16} /></button>
    </div>
  );
}
