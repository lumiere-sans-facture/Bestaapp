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

/**
 * Prochain numéro de facture d'un émetteur : `PREFIXE-ANNEE-NNN`.
 *
 * Le rang est déduit des factures DÉJÀ enregistrées (donc répliquées), et non
 * du seul compteur de l'entreprise : hors-ligne, deux appareils incrémentaient
 * chacun leur copie du compteur et produisaient le même numéro. Le compteur
 * reste pris en compte comme plancher, pour ne jamais réutiliser un numéro
 * libéré par une facture supprimée.
 * @param {Array<{userId?: string, numero?: string}>} factures toutes les factures connues
 * @param {string} userId émetteur
 * @param {{facturePrefix?: string, factureCounter?: number}} company
 * @param {number} annee
 */
export function prochainNumeroFacture(factures = [], userId, company = {}, annee = new Date().getFullYear()) {
  const prefixe = `${company.facturePrefix || 'FAC'}-${annee}-`;
  const rangs = factures
    .filter((f) => f.userId === userId && typeof f.numero === 'string' && f.numero.startsWith(prefixe))
    .map((f) => parseInt(f.numero.slice(prefixe.length), 10))
    .filter((n) => Number.isFinite(n));
  const plancher = Number(company.factureCounter) || 0;
  const rang = Math.max(plancher, ...(rangs.length ? rangs : [0])) + 1;
  return { numero: `${prefixe}${String(rang).padStart(3, '0')}`, rang };
}
