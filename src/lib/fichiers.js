// Enregistrer et partager un fichier (devis, fiche de dimensionnement) DEPUIS
// l'application — sans passer par l'impression ni par le navigateur.
//
// Deux mondes :
//  - application Android (Capacitor) : le fichier est écrit par le module
//    Filesystem — dans Documents/BestaSolar pour un téléchargement, dans le
//    cache pour un partage — puis remis au menu de partage natif (WhatsApp…) ;
//  - navigateur : téléchargement classique, et partage de FICHIER par le menu
//    du téléphone quand il le permet (Chrome Android, Safari iOS).
import { Capacitor } from '@capacitor/core';

const natif = () => Capacitor.isNativePlatform();
const DOSSIER = 'BestaSolar';

const enBase64 = (blob) => new Promise((resolve, reject) => {
  const lecteur = new FileReader();
  lecteur.onload = () => resolve(String(lecteur.result).split(',')[1] || '');
  lecteur.onerror = () => reject(lecteur.error || new Error('lecture du fichier impossible'));
  lecteur.readAsDataURL(blob);
});

/**
 * Enregistre le fichier sur l'appareil.
 * @returns {Promise<{emplacement: string|null}>} dossier où le trouver (app),
 *   null dans un navigateur (il range lui-même ses téléchargements).
 */
export async function telechargerFichier({ blob, nom }) {
  if (natif()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    // Android 10 et plus ancien : le dossier Documents demande l'autorisation
    // de stockage. Plus récent : rien à demander pour ses propres fichiers.
    try {
      const droits = await Filesystem.checkPermissions();
      if (droits.publicStorage !== 'granted') await Filesystem.requestPermissions();
    } catch { /* pas de gestion des droits sur cette version : on tente l'écriture */ }
    await Filesystem.writeFile({
      path: `${DOSSIER}/${nom}`, data: await enBase64(blob), directory: Directory.Documents, recursive: true,
    });
    return { emplacement: `Documents/${DOSSIER}` };
  }
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  // Révoquée plus tard : certains navigateurs lisent l'URL après le clic.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return { emplacement: null };
}

/** Le navigateur sait-il partager un FICHIER (et pas seulement un lien) ? */
export const partageDeFichierPossible = (fichier) => {
  if (natif()) return true;
  try { return typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [fichier] }); } catch { return false; }
};

/**
 * Ouvre le menu de partage avec le fichier joint (WhatsApp, e-mail…).
 * @returns {Promise<'partage'|'annule'|'geste-requis'|'non-supporte'>}
 *   'geste-requis' : le navigateur exige un nouveau toucher (la préparation a
 *   duré trop longtemps) — l'appelant propose alors un bouton « Envoyer ».
 */
export async function partagerFichier({ blob, nom, titre, texte }) {
  if (natif()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const { uri } = await Filesystem.writeFile({
      path: `partage/${nom}`, data: await enBase64(blob), directory: Directory.Cache, recursive: true,
    });
    try {
      await Share.share({ title: titre, text: texte, files: [uri], dialogTitle: titre });
      return 'partage';
    } catch (e) {
      if (/cancel/i.test(String(e?.message || e))) return 'annule';
      throw e;
    }
  }
  const fichier = new File([blob], nom, { type: blob.type || 'application/pdf' });
  if (!partageDeFichierPossible(fichier)) return 'non-supporte';
  try {
    await navigator.share({ files: [fichier], title: titre, text: texte });
    return 'partage';
  } catch (e) {
    if (e?.name === 'AbortError') return 'annule';
    if (e?.name === 'NotAllowedError') return 'geste-requis';
    throw e;
  }
}

/** Produit la fiche de dimensionnement en PDF et l'enregistre (voir telechargerFichier). */
export async function enregistrerFichePdf(donnees) {
  const { construireFichePdf } = await import('../utils/sizingSheet');
  const pdf = await construireFichePdf(donnees);
  URL.revokeObjectURL(pdf.url); // seul le Blob sert ici
  return telechargerFichier(pdf);
}
