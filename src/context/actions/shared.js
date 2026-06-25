// Helpers partagés entre plusieurs domaines d'actions (affiliation, commissions).
import { getActiveRef } from '../../utils/referral';

export const COMMISSION_RATES = { 1: 0.03, 2: 0.015 };

// Partenaire actif correspondant à l'attribution d'affiliation en cours (?ref=…)
export const partnerFromActiveRef = (partners) => {
  const ref = getActiveRef();
  if (!ref) return null;
  return partners.find((p) => p.code === ref.code && p.status === 'actif') || null;
};

export const newReferral = (partnerCode, type, extra = {}) => ({
  id: crypto.randomUUID(),
  partnerCode,
  type, // 'clic' | 'piste' | 'devis'
  status: type === 'clic' ? 'validé' : 'en_attente',
  amount: null,
  leadId: null,
  createdAt: new Date().toISOString(),
  ...extra,
});
