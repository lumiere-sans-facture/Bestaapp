// Dimensionnement par FACTURE : convertit la facture d'électricité mensuelle
// (F CFA, CEET au Togo ou SBEE au Bénin) du client en consommation
// journalière (kWh jour/nuit) — pour les
// clients qui ne connaissent pas leurs appareils mais savent ce qu'ils paient.
// Logique pure, sans React.

// Prix moyen du kWh du réseau (tranche domestique, F CFA) — valeur indicative
// calée sur la CEET (Togo), modifiable dans le formulaire : les tarifs varient
// par opérateur (CEET, SBEE), par tranche et par usage.
export const PRIX_KWH_RESEAU = 114;

// Jours facturés par mois (moyenne annuelle).
export const JOURS_PAR_MOIS = 30;

// Répartition jour / nuit de la consommation : le client sait dire QUAND il
// consomme le plus, pas ses kWh. La part de nuit dimensionne la batterie.
export const REPARTITIONS = [
  { id: 'jour', label: 'Surtout en journée', partJour: 0.7 },
  { id: 'equilibre', label: 'Équilibré jour / nuit', partJour: 0.5 },
  { id: 'soir', label: 'Surtout le soir', partJour: 0.3 },
];
export const DEFAULT_REPARTITION = 'equilibre';

export const partJourDe = (repartitionId) =>
  REPARTITIONS.find((r) => r.id === repartitionId)?.partJour ?? 0.5;

const round2 = (n) => Number(n.toFixed(2));

/**
 * Facture mensuelle (F CFA) → consommation journalière { day, night } en kWh,
 * prête pour calculateSystemSize. Retourne aussi le volume mensuel pour
 * l'affichage. Entrées illisibles ou prix nul → consommation nulle.
 */
export const factureVersConsommation = (montantMensuel, prixKwh = PRIX_KWH_RESEAU, repartitionId = DEFAULT_REPARTITION) => {
  const montant = Number(montantMensuel) || 0;
  const prix = Number(prixKwh) || 0;
  if (montant <= 0 || prix <= 0) return { kwhMois: 0, day: 0, night: 0 };
  const kwhMois = montant / prix;
  const kwhJour = kwhMois / JOURS_PAR_MOIS;
  const part = partJourDe(repartitionId);
  return {
    kwhMois: round2(kwhMois),
    day: round2(kwhJour * part),
    night: round2(kwhJour * (1 - part)),
  };
};
