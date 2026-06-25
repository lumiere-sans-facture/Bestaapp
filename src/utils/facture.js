import { TVA_RATE } from '../config/company';

// Statut d'une facture : libellé seul, ou couple [classe de badge, libellé].
export const FACTURE_STATUT_LABEL = { brouillon: 'Brouillon', emise: 'Émise', payee: 'Payée' };
export const FACTURE_STATUT_BADGE = {
  payee: ['badge-success', 'Payée'],
  emise: ['badge-warning', 'Émise'],
  brouillon: ['badge-muted', 'Brouillon'],
};

/** Totaux d'une facture : HT, TVA arrondie (si assujettie) au taux officiel, TTC. */
export const computeFactureTotals = (lignes, tvaActive) => {
  const totalHT = lignes.reduce((s, l) => s + (Number(l.pu) || 0) * (Number(l.qty) || 0), 0);
  const tva = tvaActive ? Math.round(totalHT * TVA_RATE) : 0;
  return { totalHT, tva, totalTTC: totalHT + tva };
};
