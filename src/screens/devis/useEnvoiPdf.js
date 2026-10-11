// Mécanique commune aux documents produits DANS l'application (devis public,
// devis et factures Pro) : une production de PDF à la fois, le
// téléchargement (ouvert aussitôt dans l'application Android), et l'envoi
// avec le fichier JOINT — droit dans la conversation WhatsApp du client dans
// l'application Android, par le menu de partage ailleurs. Les écrans ne
// décrivent que QUOI produire ; le comment — erreurs, second toucher, repli
// sur ordinateur — est ici, une seule fois.
import { useState } from 'react';
import { useToast } from '../../components/Toast';
import { signalerErreur } from '../../lib/rapportErreur';
import { telechargerFichier, partagerFichier } from '../../lib/fichiers';

/**
 * @param {object} o
 * @param {string} o.ecran     route, pour le rapport d'erreur
 * @param {string} o.origine   préfixe du rapport d'erreur (ex. 'document-devis')
 */
export function useEnvoiPdf({ ecran, origine }) {
  const toast = useToast();
  // Une production à la fois : quelques secondes sur un téléphone d'entrée
  // de gamme, et un second toucher ne doit pas en lancer une seconde.
  const [enCours, setEnCours] = useState(null); // { id, action }
  // PDF prêt à partir quand le navigateur réclame un nouveau toucher, ou
  // quand il ne sait pas partager de fichier (ordinateur).
  const [envoiPret, setEnvoiPret] = useState(null);

  /**
   * Exécute une production. `reference` est un numéro de document ou un
   * identifiant — JAMAIS un nom de client (le rapport part vers Sentry).
   */
  const produire = async (id, action, travail, { reference } = {}) => {
    if (enCours) return;
    setEnCours({ id, action });
    try {
      await travail();
    } catch (e) {
      signalerErreur(e, { origine: `${origine}-${action}`, ecran, document: reference || id });
      toast('Le document n’a pas pu être produit. Réessayez.', { type: 'error' });
    } finally {
      setEnCours(null);
    }
  };

  /** « Devis BS-… téléchargé. » / « Facture FAC-… enregistrée dans Documents/BestaSolar. » */
  const annoncer = (libelle, { emplacement }, { feminin = false } = {}) => {
    const e = feminin ? 'ée' : 'é';
    toast(emplacement ? `${libelle} enregistr${e} dans ${emplacement}.` : `${libelle} téléchargé${feminin ? 'e' : ''}.`);
  };

  /** Télécharge le PDF et l'annonce. */
  const telecharger = async (pdf, libelle, accord) => annoncer(libelle, await telechargerFichier(pdf), accord);

  /**
   * Envoie le PDF : dans l'application Android, droit dans la conversation
   * WhatsApp du client (`telephone`) ; ailleurs, par le menu de partage.
   * @param {{blob, nom, titre, texte, telephone, confirmation}} envoi
   */
  const envoyer = async (envoi) => {
    const resultat = await partagerFichier(envoi);
    if (resultat === 'whatsapp' || resultat === 'partage') toast(envoi.confirmation || 'Document partagé.');
    else if (resultat === 'geste-requis') setEnvoiPret({ ...envoi, mode: 'partage' });
    else if (resultat === 'non-supporte') {
      await telechargerFichier(envoi);
      setEnvoiPret({ ...envoi, mode: 'joindre' });
    }
  };

  /** Second toucher, quand le premier a expiré pendant la préparation. */
  const partagerMaintenant = async () => {
    const envoi = envoiPret;
    if (!envoi) return;
    try {
      const resultat = await partagerFichier(envoi);
      if (resultat === 'whatsapp' || resultat === 'partage' || resultat === 'annule') { setEnvoiPret(null); return; }
      await telechargerFichier(envoi);
      setEnvoiPret({ ...envoi, mode: 'joindre' });
    } catch (e) {
      signalerErreur(e, { origine: `${origine}-partage`, ecran });
      toast('Le partage a échoué. Réessayez.', { type: 'error' });
    }
  };

  const occupe = (id, action) => !!id && enCours?.id === id && enCours?.action === action;

  return {
    enCours, occupe, produire, annoncer, telecharger, envoyer,
    envoiPret, partagerMaintenant, fermerEnvoi: () => setEnvoiPret(null),
  };
}
