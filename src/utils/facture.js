import { TVA_RATE } from '../config/company';

// Statut d'une facture : libellé seul, ou couple [classe de badge, libellé].
export const FACTURE_STATUT_LABEL = { brouillon: 'Brouillon', emise: 'Émise', payee: 'Payée' };
export const FACTURE_STATUT_BADGE = {
  payee: ['badge-success', 'Payée'],
  emise: ['badge-warning', 'Émise'],
  brouillon: ['badge-muted', 'Brouillon'],
};

/**
 * Totaux d'une facture : HT, TVA arrondie (si assujettie), TTC.
 * @param {number} [taux] taux de TVA du pays de l'émetteur (espace Pro :
 *   data/pays.js) ; 18 % par défaut, celui de BestaSolar.
 */
export const computeFactureTotals = (lignes, tvaActive, taux = TVA_RATE) => {
  const totalHT = lignes.reduce((s, l) => s + (Number(l.pu) || 0) * (Number(l.qty) || 0), 0);
  // Les nouvelles lignes peuvent porter leur propre taux. Les documents plus
  // anciens n'en ont pas : ils conservent alors la TVA globale historique.
  const taxesParLigne = lignes.some((l) => l.taxRate != null);
  const tva = tvaActive
    ? Math.round(taxesParLigne
      ? lignes.reduce((s, l) => s + (Number(l.pu) || 0) * (Number(l.qty) || 0) * (Number(l.taxRate) || 0), 0)
      : totalHT * taux)
    : 0;
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

// ---- Objet de la facture, déduit des lignes ----
const FINE = ' '; // espace fine insécable entre nombre et unité (convention du projet)
const nombreFr = (v) => {
  const n = Number(v) || 0;
  const arrondi = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
  return String(arrondi).replace('.', ',');
};

/**
 * Objet d'une facture solaire, tiré de ses lignes — panneaux (nombre, Wc,
 * puissance crête), onduleur, stockage :
 * « Fourniture et installation d'une centrale solaire hybride : 262 panneaux
 * 585 Wc (≈ 153 kWc), onduleur hybride triphasé 125 kW, stockage lithium 241 kWh ».
 * Vide quand les lignes ne décrivent pas une installation solaire : l'objet
 * reste alors à écrire.
 */
export function objetDepuisLignes(lignes = []) {
  const designation = (l) => String(l?.designation || '');
  const qte = (l) => Math.max(0, Number(l?.qty) || 0);
  // « Structure et fixation des panneaux », « Câbles panneaux »… parlent de
  // panneaux sans en être : ces accessoires ne comptent pas.
  const accessoire = /structure|fixation|support|rail|c[âa]bl|connect|nettoy|pose\b|install|main d|protection|coffret/i;
  const panneaux = lignes.filter((l) => /panneau|photovolta|module pv/i.test(designation(l)) && !accessoire.test(designation(l)));
  const onduleur = lignes.find((l) => /onduleur/i.test(designation(l)));
  const batteries = lignes.filter((l) => /batter/i.test(designation(l)));
  const morceaux = [];

  const nbPanneaux = panneaux.reduce((s, l) => s + qte(l), 0);
  if (nbPanneaux) {
    const wc = designation(panneaux[0]).match(/(\d{3,4})\s*w(?:c|atts?)?\b/i)?.[1];
    const kwc = wc ? panneaux.reduce((s, l) => {
      const w = Number(designation(l).match(/(\d{3,4})\s*w(?:c|atts?)?\b/i)?.[1]) || Number(wc);
      return s + qte(l) * w;
    }, 0) / 1000 : 0;
    morceaux.push(`${nbPanneaux} panneau${nbPanneaux > 1 ? 'x' : ''}${wc ? ` ${wc}${FINE}Wc` : ''}${kwc ? ` (≈${FINE}${nombreFr(kwc)}${FINE}kWc)` : ''}`);
  }
  if (onduleur) {
    const texte = designation(onduleur).trim();
    morceaux.push(texte.charAt(0).toLowerCase() + texte.slice(1));
  }
  const kwh = batteries.reduce((s, l) => {
    const m = designation(l).match(/(\d+(?:[.,]\d+)?)\s*kwh/i);
    return s + (m ? Number(m[1].replace(',', '.')) * qte(l) : 0);
  }, 0);
  if (kwh) {
    const lithium = batteries.some((l) => /lithium|lifepo4/i.test(designation(l)));
    morceaux.push(`stockage${lithium ? ' lithium' : ''} ${nombreFr(kwh)}${FINE}kWh`);
  }
  if (!morceaux.length) return '';
  const hybride = onduleur && /hybride/i.test(designation(onduleur)) ? ' hybride' : '';
  return `Fourniture et installation d’une centrale solaire${hybride} : ${morceaux.join(', ')}`;
}

// ---- Paiement et mentions affichés sur la facture ----

/** Modes de paiement qu'une entreprise peut afficher : virement, Mobile Money du pays, espèces, chèque. */
export const modesPaiementProposes = (pays = {}) =>
  [...new Set(['Virement bancaire', ...(pays.mobileMoney || []), 'Espèces', 'Chèque'])];

/**
 * Modes de paiement affichés sur la facture : ceux cochés dans « Mon
 * entreprise », sinon ceux que ses coordonnées laissent deviner (banque
 * renseignée, opérateur Mobile Money).
 */
export function modesPaiementAffiches(company = {}, pays = {}) {
  if (Array.isArray(company.modesPaiement)) return company.modesPaiement;
  return [
    company.banque ? 'Virement bancaire' : null,
    company.momoOperateur || (company.momo ? (pays.mobileMoney?.[0] || 'Mobile Money') : null),
  ].filter(Boolean);
}

/** Mentions fiscales prêtes à l'emploi, imprimées sous les totaux. */
export const MENTIONS_FISCALES = (pays = {}) => [
  { id: 'aucune', label: 'Aucune', texte: '' },
  { id: 'non-assujettie', label: 'Non assujettie à la TVA', texte: 'Entreprise non assujettie à la TVA — montants nets.' },
  { id: 'tps', label: 'Soumise à la TPS', texte: 'Entreprise soumise à la taxe professionnelle synthétique (TPS) — montants nets.' },
  { id: 'reel', label: `Régime réel (TVA ${Math.round((Number(pays.tva) || TVA_RATE) * 10000) / 100} %)`, texte: `Régime du réel : TVA de ${String(Math.round((Number(pays.tva) || TVA_RATE) * 10000) / 100).replace('.', ',')} % incluse dans le total TTC.` },
];
