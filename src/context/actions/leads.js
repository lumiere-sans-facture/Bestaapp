// Domaine CRM : pistes commerciales. Le passage à « gagné » génère les
// commissions de parrainage (couplage métier assumé piste → commission).
// Le vendeur fait progresser ses affaires LUI-MÊME : aucune validation
// préalable du gérant (règle métier). Le changement est tracé dans l'activité
// du client pour que l'équipe voie qui a fait quoi.
import { COMMISSION_RATES, STAGE_LABEL, newReferral, note, partnerFromActiveRef } from './shared';
import { missingCommissionsForLead } from '../../utils/commissionSync';

export function createLeadActions(setState) {
  // Application effective d'un changement d'étape (commissions comprises).
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

    // Mise à jour des informations d'un client (fiche : coordonnées, type,
    // valeur, notes). L'étape et le parrainage ne passent pas par ici.
    updateLead: (leadId, patch) =>
      setState((s) => ({
        ...s,
        leads: s.leads.map((l) =>
          l.id === leadId
            ? { ...l, ...patch, lastActivity: new Date().toISOString().slice(0, 10) }
            : l
        ),
      })),

    // Le vendeur applique l'étape immédiatement — le « gagné » génère les
    // commissions de parrainage (3 % N1, 1,5 % N2) si absentes. Le passage est
    // TRACÉ dans l'activité du client (avec son auteur), pour que l'équipe
    // sache qui a fait avancer l'affaire.
    updateLeadStage: (leadId, stage, byUserId = null) =>
      setState((s) => {
        const avant = s.leads.find((l) => l.id === leadId);
        if (!avant || avant.stage === stage) return stageState(s, leadId, stage);
        const ns = stageState(s, leadId, stage);
        if (!byUserId) return ns;
        return {
          ...ns,
          leads: ns.leads.map((l) =>
            l.id === leadId
              ? { ...l, activities: [note(`Étape passée de « ${STAGE_LABEL[avant.stage] || avant.stage} » à « ${STAGE_LABEL[stage] || stage} ».`, byUserId), ...(l.activities || [])] }
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
