// Documents d'un devis, produits DANS l'application : le devis en PDF
// (téléchargé, ou envoyé sur WhatsApp avec le fichier joint) et la fiche de
// dimensionnement d'un devis solaire. Rien ne passe par l'impression du
// navigateur ni par un onglet : un toucher, un fichier.
import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../components/Toast';
import { COMPANY } from '../../config/company';
import { devisEnvoiMessage } from '../../utils/affaires';
import { signalerErreur } from '../../lib/rapportErreur';
import { telechargerFichier, partagerFichier, enregistrerFichePdf } from '../../lib/fichiers';

export function useDocumentsDevis() {
  const { getLeadById, getPartnerById, products, inverters } = useData();
  const toast = useToast();
  // Une production à la fois : quelques secondes sur un téléphone d'entrée
  // de gamme, et un second toucher ne doit pas en lancer une seconde.
  const [enCours, setEnCours] = useState(null); // { id, action }
  // PDF prêt à partir quand le navigateur réclame un nouveau toucher, ou
  // quand il ne sait pas partager de fichier (ordinateur).
  const [envoiPret, setEnvoiPret] = useState(null);

  const contexte = (d) => ({
    lead: d._externe ? null : getLeadById(d.leadId),
    partner: d.partnerId && !d._externe ? getPartnerById(d.partnerId) : null,
  });

  const pdfDevis = async (d) => {
    const { construireDevisPdf } = await import('../../utils/docTemplates/pdf');
    const { lead, partner } = contexte(d);
    const pdf = await construireDevisPdf({ devis: d, company: COMPANY, lead, partner, products });
    URL.revokeObjectURL(pdf.url); // seul le Blob sert ici
    return pdf;
  };

  const executer = async (d, action, travail) => {
    if (enCours) return;
    setEnCours({ id: d.id, action });
    try {
      await travail();
    } catch (e) {
      // Jamais le nom du client dans le message : l'identifiant suffit.
      signalerErreur(e, { origine: `document-devis-${action}`, ecran: '/devis', devis: d.devisNumber || d.id });
      toast('Le document n’a pas pu être produit. Réessayez.', { type: 'error' });
    } finally {
      setEnCours(null);
    }
  };

  const annoncer = (libelle, { emplacement }) =>
    toast(emplacement ? `${libelle} enregistré dans ${emplacement}.` : `${libelle} téléchargé.`);

  const telechargerDevis = (d) => executer(d, 'devis', async () => {
    const pdf = await pdfDevis(d);
    annoncer(`Devis ${d.devisNumber || ''}`.trim(), await telechargerFichier(pdf));
  });

  const envoyerWhatsApp = (d) => executer(d, 'whatsapp', async () => {
    const { lead } = contexte(d);
    const pdf = await pdfDevis(d);
    const envoi = {
      ...pdf,
      titre: `Devis ${d.devisNumber || ''}`.trim(),
      texte: devisEnvoiMessage(d, lead),
      telephone: d.clientPhone || lead?.phone || '',
    };
    const resultat = await partagerFichier(envoi);
    if (resultat === 'partage') toast('Devis partagé.');
    else if (resultat === 'geste-requis') setEnvoiPret({ ...envoi, mode: 'partage' });
    else if (resultat === 'non-supporte') {
      await telechargerFichier(envoi);
      setEnvoiPret({ ...envoi, mode: 'joindre' });
    }
  });

  /** Second toucher, quand le premier a expiré pendant la préparation. */
  const partagerMaintenant = async () => {
    const envoi = envoiPret;
    if (!envoi) return;
    try {
      const resultat = await partagerFichier(envoi);
      if (resultat === 'partage' || resultat === 'annule') { setEnvoiPret(null); return; }
      await telechargerFichier(envoi);
      setEnvoiPret({ ...envoi, mode: 'joindre' });
    } catch (e) {
      signalerErreur(e, { origine: 'document-devis-partage', ecran: '/devis' });
      toast('Le partage a échoué. Réessayez.', { type: 'error' });
    }
  };

  const telechargerFiche = (d) => executer(d, 'fiche', async () => {
    const { lead, partner } = contexte(d);
    const { donneesFicheDepuisDevis } = await import('../../utils/sizingSheet/donnees');
    const donnees = donneesFicheDepuisDevis(d, { lead, partner, inverters: inverters || [] });
    if (!donnees) {
      toast('Ce devis ne contient pas d’étude de dimensionnement.', { type: 'error' });
      return;
    }
    annoncer('Fiche de dimensionnement', await enregistrerFichePdf(donnees));
  });

  const occupe = (d, action) => enCours?.id === d?.id && enCours?.action === action;

  return {
    enCours, occupe, telechargerDevis, envoyerWhatsApp, telechargerFiche,
    envoiPret, partagerMaintenant, fermerEnvoi: () => setEnvoiPret(null),
  };
}
