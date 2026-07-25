// Domaine CRM : pistes commerciales. Le passage à « gagné » génère les
// commissions de parrainage (couplage métier assumé piste → commission).
// Les techniciens DEMANDENT un changement d'étape (pendingStage) ; le gérant
// valide ou refuse — les commissions ne naissent qu'à la validation.
import { COMMISSION_RATES, newReferral, partnerFromActiveRef } from './shared';
import { missingCommissionsForLead } from '../../utils/commissionSync';
import { stages, LOST_STAGE } from '../../data/seed';

const STAGE_LABEL = Object.fromEntries([...stages, LOST_STAGE].map((st) => [st.id, st.label]));
const note = (text, userId) => ({ id: crypto.randomUUID(), date: new Date().toISOString(), text, by: userId });

export function createLeadActions(setState) {
  // Application effective d'un changement d'étape (commissions comprises) —
  // partagée entre le passage direct (gérant) et la validation d'une demande.
  const stageState = (s, leadId, stage) => {
    const today = new Date().toISOString().slice(0, 10);
    const lead = s.leads.find((l) => l.id === leadId);
    let commissions = s.commissions;
    let referrals = s.referrals || [];
    if (stage === 'gagne' && lead) {
      // Base de calcul : total du dernier devis finalisé (sinon valeur
      // estimée) ; apporteur : parrain de la piste, sinon celui du devis.
      const generated = missingCommissionsForLead(
        { lead, devis: s.devis, partners: s.partners, commissions: s.commissions },
        COMMISSION_RATES,
        today
      );
      if (generated.length) commissions = [...generated, ...s.commissions];
      // Affaire gagnée : les conversions d'affiliation encore en attente sur
      // cette piste sont validées d'office (registre cohérent avec la commission).
      referrals = referrals.map((r) =>
        r.leadId === leadId && r.status === 'en_attente' ? { ...r, status: 'validé' } : r
      );
    }
    return {
      ...s,
      commissions,
      referrals,
      leads: s.leads.map((l) =>
        l.id === leadId
          ? {
              ...l,
              stage,
              pendingStage: null,
              lastActivity: today,
              wonAt: stage === 'gagne' ? today : l.wonAt,
              lostAt: stage === 'perdu' ? today : null,
            }
          : l
      ),
    };
  };

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

    // Passage direct (gérant) : applique l'étape immédiatement — le « gagné »
    // génère les commissions de parrainage (3 % N1, 1,5 % N2) si absentes.
    updateLeadStage: (leadId, stage) => setState((s) => stageState(s, leadId, stage)),

    // Un technicien DEMANDE un changement d'étape : la piste ne bouge pas,
    // la demande attend la validation du gérant (une nouvelle demande remplace
    // la précédente).
    requestStageChange: (leadId, stage, userId) =>
      setState((s) => ({
        ...s,
        leads: s.leads.map((l) =>
          l.id === leadId
            ? {
                ...l,
                pendingStage: { stage, requestedBy: userId, requestedAt: new Date().toISOString() },
                activities: [note(`Demande de passage à « ${STAGE_LABEL[stage] || stage} » — en attente de validation du gérant.`, userId), ...(l.activities || [])],
                lastActivity: new Date().toISOString().slice(0, 10),
              }
            : l
        ),
      })),

    // Le gérant valide la demande : l'étape s'applique réellement
    // (commissions comprises) et la validation est tracée dans l'activité.
    approveStageChange: (leadId, approverId) =>
      setState((s) => {
        const lead = s.leads.find((l) => l.id === leadId);
        if (!lead?.pendingStage) return s;
        const { stage } = lead.pendingStage;
        const ns = stageState(s, leadId, stage);
        return {
          ...ns,
          leads: ns.leads.map((l) =>
            l.id === leadId
              ? { ...l, activities: [note(`Passage à « ${STAGE_LABEL[stage] || stage} » validé par le gérant.`, approverId), ...(l.activities || [])] }
              : l
          ),
        };
      }),

    // Le gérant refuse : la piste reste à son étape, la demande est levée.
    rejectStageChange: (leadId, approverId) =>
      setState((s) => ({
        ...s,
        leads: s.leads.map((l) =>
          l.id === leadId && l.pendingStage
            ? {
                ...l,
                pendingStage: null,
                activities: [note(`Demande de passage à « ${STAGE_LABEL[l.pendingStage.stage] || l.pendingStage.stage} » refusée par le gérant.`, approverId), ...(l.activities || [])],
              }
            : l
        ),
      })),

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
