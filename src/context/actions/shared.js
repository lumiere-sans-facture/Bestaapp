// Helpers partagés entre plusieurs domaines d'actions (affiliation, commissions,
// suivi des affaires).
import { getActiveRef } from '../../utils/referral';
import { stages, LOST_STAGE } from '../../data/seed';

export const COMMISSION_RATES = { 1: 0.03, 2: 0.015 };

export const STAGE_LABEL = Object.fromEntries([...stages, LOST_STAGE].map((st) => [st.id, st.label]));

/** Entrée d'activité horodatée sur une piste (notes, validations d'étape…). */
export const note = (text, userId) => ({ id: crypto.randomUUID(), date: new Date().toISOString(), text, by: userId });

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
