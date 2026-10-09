// Documents de l'espace Pro (devis et factures), produits DANS l'application
// à l'identité de l'abonné : téléchargés en PDF, ou envoyés sur WhatsApp avec
// le fichier joint. Plus d'onglet à imprimer soi-même — inopérant dans
// l'application Android. Même mécanique que le devis public (useEnvoiPdf).
import { useData } from '../../../context/DataContext';
import { devisEnvoiMessage } from '../../../utils/affaires';
import { factureEnvoiMessage } from '../../../utils/paiement';
import { useEnvoiPdf } from '../../devis/useEnvoiPdf';
import { normalizeModele } from './constants';

/**
 * @param {object} o
 * @param {object} o.company       entreprise de l'abonné
 * @param {string} o.modeleDefaut  modèle réglé sur l'entreprise
 */
export function useDocumentsPro({ company, modeleDefaut }) {
  const { getLeadById, products, markDevisPro } = useData();
  const pdf = useEnvoiPdf({ ecran: '/pro/documents', origine: 'document-pro' });

  /** Modèle d'un document : celui qu'il porte, sinon celui de l'entreprise. */
  const modeleDe = (doc) => (doc?.modele ? normalizeModele(doc.modele) : modeleDefaut);

  const pdfDevis = async (d, modele) => {
    const { construireDevisPdf } = await import('../../../utils/docTemplates/pdf');
    const model = normalizeModele(modele || modeleDe(d));
    const lead = getLeadById(d.leadId);
    const fichier = await construireDevisPdf({ devis: d, company, lead, products, model });
    URL.revokeObjectURL(fichier.url); // seul le Blob sert ici
    // Le devis retient le modèle et l'identité avec lesquels il est parti.
    markDevisPro(d.id, { modele: model, companySnapshot: company });
    return { fichier, lead };
  };

  const pdfFacture = async (f, modele) => {
    const { construireFacturePdf } = await import('../../../utils/docTemplates/pdf');
    const fichier = await construireFacturePdf({ facture: f, company, model: normalizeModele(modele || modeleDe(f)) });
    URL.revokeObjectURL(fichier.url);
    return fichier;
  };

  // Jamais le nom du client dans un rapport d'erreur : le numéro suffit.
  const titreDevis = (d) => `Devis ${d.devisNumber || ''}`.trim();
  const titreFacture = (f) => `Facture ${f.numero || ''}`.trim();

  const telechargerDevis = (d, modele) => pdf.produire(d.id, 'devis', async () => {
    const { fichier } = await pdfDevis(d, modele);
    await pdf.telecharger(fichier, titreDevis(d));
  }, { reference: d.devisNumber });

  const envoyerDevis = (d, modele) => pdf.produire(d.id, 'whatsapp', async () => {
    const { fichier, lead } = await pdfDevis(d, modele);
    await pdf.envoyer({
      ...fichier,
      titre: titreDevis(d),
      texte: devisEnvoiMessage(d, lead, company?.nomEntreprise),
      telephone: d.clientPhone || lead?.phone || '',
      confirmation: 'Devis partagé.',
      nature: 'devis',
    });
  }, { reference: d.devisNumber });

  const telechargerFacture = (f, modele) => pdf.produire(f.id, 'facture', async () => {
    await pdf.telecharger(await pdfFacture(f, modele), titreFacture(f), { feminin: true });
  }, { reference: f.numero });

  const envoyerFacture = (f, modele) => pdf.produire(f.id, 'whatsapp', async () => {
    await pdf.envoyer({
      ...(await pdfFacture(f, modele)),
      titre: titreFacture(f),
      texte: factureEnvoiMessage(f, company),
      telephone: f.clientPhone || '',
      confirmation: 'Facture partagée.',
      nature: 'facture',
    });
  }, { reference: f.numero });

  return {
    modeleDe,
    enCours: pdf.enCours,
    occupe: (doc, action) => pdf.occupe(doc?.id, action),
    telechargerDevis, envoyerDevis, telechargerFacture, envoyerFacture,
    envoiPret: pdf.envoiPret, partagerMaintenant: pdf.partagerMaintenant, fermerEnvoi: pdf.fermerEnvoi,
  };
}
