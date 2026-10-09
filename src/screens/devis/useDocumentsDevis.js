// Documents d'un devis, produits DANS l'application : le devis en PDF
// (téléchargé, ou envoyé sur WhatsApp avec le fichier joint) et la fiche de
// dimensionnement d'un devis solaire. Rien ne passe par l'impression du
// navigateur ni par un onglet : un toucher, un fichier.
import { useData } from '../../context/DataContext';
import { useToast } from '../../components/Toast';
import { COMPANY } from '../../config/company';
import { devisEnvoiMessage } from '../../utils/affaires';
import { enregistrerFichePdf } from '../../lib/fichiers';
import { useEnvoiPdf } from './useEnvoiPdf';

export function useDocumentsDevis() {
  const { getLeadById, getPartnerById, products, inverters } = useData();
  const toast = useToast();
  const pdf = useEnvoiPdf({ ecran: '/devis', origine: 'document-devis' });

  const contexte = (d) => ({
    lead: d._externe ? null : getLeadById(d.leadId),
    partner: d.partnerId && !d._externe ? getPartnerById(d.partnerId) : null,
  });

  const pdfDevis = async (d) => {
    const { construireDevisPdf } = await import('../../utils/docTemplates/pdf');
    const { lead, partner } = contexte(d);
    const fichier = await construireDevisPdf({ devis: d, company: COMPANY, lead, partner, products });
    URL.revokeObjectURL(fichier.url); // seul le Blob sert ici
    return fichier;
  };

  // Jamais le nom du client dans un rapport d'erreur : le numéro suffit.
  const reference = (d) => ({ reference: d.devisNumber || d.id });
  const titre = (d) => `Devis ${d.devisNumber || ''}`.trim();

  const telechargerDevis = (d) => pdf.produire(d.id, 'devis', async () => {
    await pdf.telecharger(await pdfDevis(d), titre(d));
  }, reference(d));

  const envoyerWhatsApp = (d) => pdf.produire(d.id, 'whatsapp', async () => {
    const { lead } = contexte(d);
    await pdf.envoyer({
      ...(await pdfDevis(d)),
      titre: titre(d),
      texte: devisEnvoiMessage(d, lead),
      telephone: d.clientPhone || lead?.phone || '',
      confirmation: 'Devis partagé.',
    });
  }, reference(d));

  const telechargerFiche = (d) => pdf.produire(d.id, 'fiche', async () => {
    const { lead, partner } = contexte(d);
    const { donneesFicheDepuisDevis } = await import('../../utils/sizingSheet/donnees');
    const donnees = donneesFicheDepuisDevis(d, { lead, partner, inverters: inverters || [] });
    if (!donnees) {
      toast('Ce devis ne contient pas d’étude de dimensionnement.', { type: 'error' });
      return;
    }
    pdf.annoncer('Fiche de dimensionnement', await enregistrerFichePdf(donnees), { feminin: true });
  }, reference(d));

  return {
    enCours: pdf.enCours,
    occupe: (d, action) => pdf.occupe(d?.id, action),
    telechargerDevis, envoyerWhatsApp, telechargerFiche,
    envoiPret: pdf.envoiPret, partagerMaintenant: pdf.partagerMaintenant, fermerEnvoi: pdf.fermerEnvoi,
  };
}
