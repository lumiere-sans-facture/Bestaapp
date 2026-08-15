// Fiche de dimensionnement — point d'entrée : assemble les calculs
// (compute.js), le graphique (chart.js) et la mise en page 3 pages A4
// (layout.js), puis la convertit en PDF (pdf.js).
//
// Le HTML reste la source de la mise en page ; pdf.js le rend page par page.
// La fiche s'ouvre donc dans le lecteur PDF du navigateur, d'où elle se
// télécharge, s'imprime et surtout s'ENVOIE au client — ce qu'une page HTML,
// elle, ne permet pas.
import { computeSheet } from './compute';
import { renderSheet } from './layout';

/**
 * Construit le document HTML complet de la fiche (3 pages A4).
 * Contrat de données inchangé (client, appliances, consumption, systemType,
 * sunHours, cityName, solarSource, sizing, inverter, batteries, panelName,
 * apporteur) + trois champs optionnels :
 * @param {object} d.company             entreprise ÉMETTRICE côté Pro (nomEntreprise,
 *                                        logo, couleurPrimaire/Secondaire, telephone,
 *                                        adresse, rccm, ifu…). Absente → identité BestaSolar.
 * @param {number|null} d.investissement  total du devis (F CFA) pour la rentabilité
 * @param {object} d.rentabilite         surcharges { tarifElec, tauxUtilisation,
 *                                        horizon, maintenanceAnnuelle, provisionOnduleur }
 */
export function buildSizingSheetHtml(d) {
  return renderSheet(d, computeSheet(d));
}

export { ouvrirFichePdf, construireFichePdf, pdfDepuisHtml } from './pdf';
