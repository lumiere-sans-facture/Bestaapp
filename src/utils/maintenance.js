// Maintenance annuelle d'une installation solaire — règle du gérant, F CFA/an.
//
//   N < 10 panneaux  → 30 000
//   N ≥ 10 panneaux  → 50 000 + 2 000 × (N − 10)
//
// N = nombre TOTAL de panneaux du système dimensionné. C'est la SEULE source
// de ce montant dans l'application : simulateur de retour sur investissement,
// fiche de dimensionnement, devis sur mesure, rentabilité de l'espace Pro.
// Aucun écran ne recopie ces valeurs : il appelle calculMaintenanceAnnuelle.
import { formatNombre } from './format';

/** Forfait des petits systèmes (moins de SEUIL panneaux). */
export const BASE_PETIT = 30000;
/** Forfait à partir de SEUIL panneaux. */
export const BASE = 50000;
/** Nombre de panneaux à partir duquel le forfait BASE s'applique. */
export const SEUIL = 10;
/** Supplément par panneau au-delà de SEUIL. */
export const PAR_PANNEAU = 2000;

const nombrePanneaux = (n) => Math.max(0, Math.round(Number(n) || 0));

/** Maintenance annuelle (F CFA) d'un système de `nbPanneaux` panneaux. */
export function calculMaintenanceAnnuelle(nbPanneaux) {
  const n = nombrePanneaux(nbPanneaux);
  return n < SEUIL ? BASE_PETIT : BASE + PAR_PANNEAU * (n - SEUIL);
}

/**
 * Détail du calcul, à partir de SEUIL panneaux (null en dessous : le forfait
 * se suffit) : « 50 000 + 2 000 × 10 panneaux supplémentaires ».
 * @param {function} format  mise en forme des montants (celle de l'écran)
 */
export function detailMaintenanceAnnuelle(nbPanneaux, format = formatNombre) {
  const n = nombrePanneaux(nbPanneaux);
  if (n < SEUIL) return null;
  const supplementaires = n - SEUIL;
  if (supplementaires === 0) return `${format(BASE)} (forfait dès ${SEUIL} panneaux)`;
  const s = supplementaires > 1 ? 's' : '';
  return `${format(BASE)} + ${format(PAR_PANNEAU)} × ${supplementaires} panneau${s ? 'x' : ''} supplémentaire${s}`;
}
