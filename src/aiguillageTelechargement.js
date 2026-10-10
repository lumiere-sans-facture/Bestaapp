// Lien de téléchargement de l'APK sur notre domaine : /telecharger.
//
// En production, Vercel le traite avant même de servir l'app (vercel.json) :
// sans code partenaire, renvoi direct vers l'APK ; avec « ?ref=CODE », la page
// public/telecharger.html, qui copie le code pour l'application installée.
// Ici, le même aiguillage en secours, pour un serveur qui servirait l'app à sa
// place (développement, cache hors-ligne).
//
// Importé par main.jsx AVANT l'application : celle-ci retire « ?ref= » de
// l'adresse dès son chargement (utils/referral.js → captureRefFromUrl).
import { CHEMIN_TELECHARGEMENT, URL_APK } from './config/android';

if (location.pathname === CHEMIN_TELECHARGEMENT) {
  const ref = new URLSearchParams(location.search).get('ref');
  location.replace(ref ? `/telecharger.html?ref=${encodeURIComponent(ref)}` : URL_APK);
}
