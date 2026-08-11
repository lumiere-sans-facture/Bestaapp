// Fiche de dimensionnement — point d'entrée : assemble les calculs
// (compute.js), le graphique (chart.js) et la mise en page 3 pages A4
// (layout.js). Document HTML autonome, ouvert dans un onglet, export PDF
// par Ctrl+P — même mécanique que les modèles de devis.
import { computeSheet } from './compute';
import { renderSheet } from './layout';

/**
 * Construit le document HTML complet de la fiche.
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

/** Ouvre la fiche dans un nouvel onglet (repli : téléchargement du fichier). */
export function openSizingSheet(data) {
  const html = buildSizingSheetHtml(data);
  const fenetre = window.open('', '_blank');
  if (fenetre) {
    fenetre.document.write(html);
    fenetre.document.close();
    return;
  }
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fiche-dimensionnement.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
