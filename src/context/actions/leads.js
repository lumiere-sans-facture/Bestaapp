// Domaine CRM : pistes commerciales. Le passage à « gagné » génère les
// commissions de parrainage (couplage métier assumé piste → commission).
import { COMMISSION_RATES, newReferral, partnerFromActiveRef } from './shared';

export function createLeadActions(setState) {
  return {
    // Le niveau 2 se déduit du réseau : c'est le parrain du partenaire apporteur.
    // Sans partenaire explicite, l'attribution d'affiliation active (?ref=…,
    // 30 jours, last-click) rattache automatiquement la piste au partenaire.
    addLead: (lead) =>
      setState((s) => {
        const leadId = crypto.randomUUID();
        let parrainL1 = lead.parrainL1 || null;
        let referrals = s.referrals || [];
        if (!parrainL1) {
          const refPartner = partnerFromActiveRef(s.partners);
          if (refPartner) {
            parrainL1 = refPartner.id;
            referrals = [newReferral(refPartner.code, 'piste', { leadId }), ...referrals];
          }
        }
        const sponsor = parrainL1
          ? s.partners.find((p) => p.id === parrainL1)?.sponsorId || null
          : null;
        return {
          ...s,
          referrals,
          leads: [
            {
              ...lead,
              parrainL1,
              parrainL2: sponsor,
              id: leadId,
              stage: 'nouveau',
              createdAt: new Date().toISOString().slice(0, 10),
              lastActivity: new Date().toISOString().slice(0, 10),
            },
            ...s.leads,
          ],
        };
      }),

    // Passer une affaire à « gagné » génère automatiquement les commissions
    // de parrainage (3 % niveau 1, 1,5 % niveau 2) si elles n'existent pas déjà.
    updateLeadStage: (leadId, stage) =>
      setState((s) => {
        const today = new Date().toISOString().slice(0, 10);
        const lead = s.leads.find((l) => l.id === leadId);
        let commissions = s.commissions;
        if (stage === 'gagne' && lead) {
          const alreadyExists = (partnerId, level) =>
            s.commissions.some((c) => c.leadId === leadId && c.partnerId === partnerId && c.level === level);
          const generated = [];
          if (lead.parrainL1 && !alreadyExists(lead.parrainL1, 1)) {
            generated.push({
              id: crypto.randomUUID(), partnerId: lead.parrainL1, leadId, level: 1,
              amount: Math.round(lead.estimatedValue * COMMISSION_RATES[1]),
              status: 'en_attente', paidAt: null, createdAt: today,
            });
          }
          if (lead.parrainL2 && !alreadyExists(lead.parrainL2, 2)) {
            generated.push({
              id: crypto.randomUUID(), partnerId: lead.parrainL2, leadId, level: 2,
              amount: Math.round(lead.estimatedValue * COMMISSION_RATES[2]),
              status: 'en_attente', paidAt: null, createdAt: today,
            });
          }
          if (generated.length) commissions = [...generated, ...s.commissions];
        }
        return {
          ...s,
          commissions,
          leads: s.leads.map((l) =>
            l.id === leadId
              ? {
                  ...l,
                  stage,
                  lastActivity: today,
                  wonAt: stage === 'gagne' ? today : l.wonAt,
                  lostAt: stage === 'perdu' ? today : null,
                }
              : l
          ),
        };
      }),

    addLeadNote: (leadId, text, userId) =>
      setState((s) => ({
        ...s,
        leads: s.leads.map((l) =>
          l.id === leadId
            ? {
                ...l,
                activities: [
                  { id: crypto.randomUUID(), date: new Date().toISOString(), text, by: userId },
                  ...(l.activities || []),
                ],
                lastActivity: new Date().toISOString().slice(0, 10),
              }
            : l
        ),
      })),
  };
}
