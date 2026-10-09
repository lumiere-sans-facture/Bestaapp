// Barre d'état du téléphone (application Android) : heure, réseau, batterie.
//
// Depuis Android 15, l'app s'affiche aussi sous cette barre. index.css y
// réserve une bande bleue (--haut-securise) ; ses icônes, sombres par défaut,
// y seraient peu lisibles : on les passe en CLAIR dès que la bande existe.
// Sur un téléphone plus ancien, Android garde sa propre barre (bande nulle) :
// on laisse alors le réglage par défaut. Sur le web : rien.
import { Capacitor, SystemBars, SystemBarsStyle, SystemBarType } from '@capacitor/core';

const bandeReservee = () => {
  try { return parseFloat(getComputedStyle(document.body).paddingTop) > 0; } catch { return false; }
};

let styleApplique = null;
const appliquer = () => {
  const style = bandeReservee() ? SystemBarsStyle.Dark : SystemBarsStyle.Default;
  if (style === styleApplique) return;
  styleApplique = style;
  // Trace lisible (inspecteur, parcours e2e/barre-etat.mjs) du choix fait.
  document.documentElement.dataset.barreEtat = style;
  try {
    SystemBars.setStyle({ style, bar: SystemBarType.StatusBar }).catch(() => { styleApplique = null; });
  } catch { styleApplique = null; }
};

export function installerBarreEtat() {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) return;
  appliquer();
  // Capacitor communique la hauteur de la barre APRÈS le chargement (variable
  // --safe-area-inset-top posée sur <html>), et la recalcule à la rotation.
  try {
    new MutationObserver(appliquer).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  } catch { /* navigateur sans MutationObserver : la rotation suffira */ }
  window.addEventListener('resize', appliquer);
}
