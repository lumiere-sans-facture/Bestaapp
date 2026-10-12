// Enregistrer et partager un fichier (devis, fiche de dimensionnement) DEPUIS
// l'application — sans passer par l'impression ni par le navigateur.
//
// Deux mondes :
//  - application Android (Capacitor) : le fichier est écrit par le module
//    Filesystem — dans Documents/BestaSolar pour un téléchargement, puis
//    OUVERT aussitôt dans le lecteur PDF du téléphone ; dans le cache pour un
//    envoi, qui part directement dans la conversation WhatsApp du client
//    (module natif FichiersNatifs, comme la relance) ;
//  - navigateur : téléchargement classique — ouvert en plus dans un onglet
//    quand le navigateur affiche les PDF (ordinateur) —, et partage de
//    FICHIER par le menu du téléphone quand il le permet (Chrome Android,
//    Safari iOS).
import { Capacitor, registerPlugin } from '@capacitor/core';
import { numeroWhatsApp } from '../utils/phone';

const natif = () => Capacitor.isNativePlatform();
const DOSSIER = 'BestaSolar';

// Module propre à l'application Android :
// android/app/src/main/java/com/bestasolar/app/FichiersNatifsPlugin.java.
// Absent ailleurs (iPhone, navigateur) : on garde alors le menu de partage.
const FichiersNatifs = registerPlugin('FichiersNatifs');
const moduleNatif = () => natif() && Capacitor.isPluginAvailable('FichiersNatifs');

const enBase64 = (blob) => new Promise((resolve, reject) => {
  const lecteur = new FileReader();
  lecteur.onload = () => resolve(String(lecteur.result).split(',')[1] || '');
  lecteur.onerror = () => reject(lecteur.error || new Error('lecture du fichier impossible'));
  lecteur.readAsDataURL(blob);
});

/**
 * Le navigateur sait-il AFFICHER un PDF dans un onglet ? Oui sur ordinateur ;
 * non sur Chrome Android, où l'onglet le téléchargerait une seconde fois.
 */
const pdfLisibleEnOnglet = (blob) => (blob?.type || 'application/pdf') === 'application/pdf'
  && typeof navigator !== 'undefined' && navigator.pdfViewerEnabled === true;

/**
 * Enregistre le fichier sur l'appareil, et l'OUVRE : dans l'application
 * Android, dans le lecteur PDF du téléphone ; sur ordinateur, dans un onglet.
 * `ouvrir: false` : enregistrer seulement (fichier à joindre ailleurs).
 * @returns {Promise<{emplacement: string|null, ouvert: boolean, ouvrir: (() => boolean)|null}>}
 *   `emplacement` : dossier où le trouver (app), null dans un navigateur (il
 *   range lui-même ses téléchargements). `ouvrir` : quand le navigateur a
 *   bloqué l'onglet (la préparation a duré trop longtemps pour qu'il y voie
 *   encore le clic), de quoi l'ouvrir d'un nouveau toucher — null sinon.
 */
export async function telechargerFichier({ blob, nom }, { ouvrir: aOuvrir = true } = {}) {
  if (natif()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    // Android 10 et plus ancien : le dossier Documents demande l'autorisation
    // de stockage. Plus récent : rien à demander pour ses propres fichiers.
    try {
      const droits = await Filesystem.checkPermissions();
      if (droits.publicStorage !== 'granted') await Filesystem.requestPermissions();
    } catch { /* pas de gestion des droits sur cette version : on tente l'écriture */ }
    const { uri } = await Filesystem.writeFile({
      path: `${DOSSIER}/${nom}`, data: await enBase64(blob), directory: Directory.Documents, recursive: true,
    });
    // Le fichier est enregistré quoi qu'il arrive : un téléphone sans lecteur
    // PDF le retrouve dans Documents/BestaSolar.
    let ouvert = false;
    if (aOuvrir && moduleNatif()) {
      try { await FichiersNatifs.ouvrir({ chemin: uri, type: blob.type || 'application/pdf' }); ouvert = true; } catch { /* aucun lecteur PDF */ }
    }
    return { emplacement: `Documents/${DOSSIER}`, ouvert, ouvrir: null };
  }
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  const lisible = aOuvrir && pdfLisibleEnOnglet(blob);
  const ouvrirOnglet = () => {
    const onglet = window.open(url, '_blank');
    if (onglet) { try { onglet.opener = null; } catch { /* autre origine */ } }
    return !!onglet;
  };
  const ouvert = lisible ? ouvrirOnglet() : false;
  // Révoquée plus tard : certains navigateurs lisent l'URL après le clic —
  // et, onglet bloqué, le bouton « Ouvrir » de la notification s'en sert.
  setTimeout(() => URL.revokeObjectURL(url), lisible && !ouvert ? 5 * 60000 : 60000);
  return { emplacement: null, ouvert, ouvrir: lisible && !ouvert ? ouvrirOnglet : null };
}

/** Le navigateur sait-il partager un FICHIER (et pas seulement un lien) ? */
export const partageDeFichierPossible = (fichier) => {
  if (natif()) return true;
  try { return typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [fichier] }); } catch { return false; }
};

/**
 * Envoie le fichier. Dans l'application Android, il part directement dans la
 * conversation WhatsApp du client (`telephone`), comme la relance — WhatsApp
 * s'ouvre sur cette conversation, PDF et message joints, il n'y a plus qu'à
 * envoyer. Sans WhatsApp, et ailleurs, le menu de partage (WhatsApp, e-mail…).
 * @returns {Promise<'whatsapp'|'partage'|'annule'|'geste-requis'|'non-supporte'>}
 *   'geste-requis' : le navigateur exige un nouveau toucher (la préparation a
 *   duré trop longtemps) — l'appelant propose alors un bouton « Envoyer ».
 */
export async function partagerFichier({ blob, nom, titre, texte, telephone }) {
  if (natif()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const { uri } = await Filesystem.writeFile({
      path: `partage/${nom}`, data: await enBase64(blob), directory: Directory.Cache, recursive: true,
    });
    if (moduleNatif()) {
      try {
        await FichiersNatifs.envoyerWhatsApp({
          chemin: uri, type: blob.type || 'application/pdf', texte: texte || '',
          // Sans numéro exploitable, WhatsApp demande à qui envoyer.
          numero: numeroWhatsApp(telephone),
        });
        return 'whatsapp';
      } catch { /* WhatsApp absent : menu de partage */ }
    }
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
