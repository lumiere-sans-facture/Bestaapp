// Devis en VRAI PDF, composé dans l'application.
//
// Le document imprimable (index.js, openDoc) s'ouvrait dans un onglet, à
// exporter soi-même par « Imprimer » : impossible à envoyer tel quel, et
// inopérant dans l'application Android. Ses pages `.page` font exactement
// 794 × 1123 px (A4) : le moteur de la fiche de dimensionnement (pdfDepuisHtml)
// les convertit telles quelles, une page HTML donnant une page PDF.
import { buildDocHtml, MODEL_DEFAUT } from './index';
import { donneesDeDevis } from './shared';
import { pdfDepuisHtml } from '../sizingSheet/pdf';
import { nomFichierPdf } from '../nomFichier';

/**
 * @param {object} o
 * @param {object} o.devis
 * @param {object} o.company   entreprise émettrice (COMPANY côté public)
 * @param {object} [o.lead]    client du devis
 * @param {object} [o.partner] apporteur
 * @param {Array}  [o.products]
 * @param {string} [o.model]   modèle de document ('studio' en public)
 * @returns {Promise<{blob: Blob, url: string, nom: string, pages: number}>}
 */
export async function construireDevisPdf({ devis, company, lead = null, partner = null, products = [], model = MODEL_DEFAUT }) {
  const data = donneesDeDevis({ devis, company, lead, partner, products });
  const client = data.client?.name && data.client.name !== 'Client' ? data.client.name : '';
  return pdfDepuisHtml(buildDocHtml({ kind: 'devis', model, data }), {
    titre: `Devis ${data.numero}${client ? ` — ${client}` : ''}`.trim(),
    sujet: 'Devis',
    auteur: company?.nomEntreprise || company?.name || 'BestaSolar',
    // Nom de fichier : c'est ce que le client verra dans WhatsApp.
    nom: nomFichierPdf('Devis', data.numero, client),
  });
}
