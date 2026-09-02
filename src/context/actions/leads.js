// Domaine CRM : pistes commerciales. Le passage à « gagné » génère les
// commissions de parrainage (couplage métier assumé piste → commission).
// Les commerciaux DEMANDENT un changement d'étape (pendingStage) ; le gérant
// valide ou refuse — les commissions ne naissent qu'à la validation. Le gérant
// (et l'utilisateur seul dans son espace, faute de valideur) applique
// directement.
import { COMMISSION_RATES, STAGE_LABEL, newReferral, note, partnerFromActiveRef } from './shared';
import { missingCommissionsForLead } from '../../utils/commissionSync';
import { appendClientSource, buildClientSource, canSyncClientContact, isSameClient, sourceHistoryFor } from '../../utils/clientContact';

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
        let parrainL1 = lead.parrainL1 || null;
        if (!parrainL1) {
          const refPartner = partnerFromActiveRef(s.partners);
          if (refPartner) parrainL1 = refPartner.id;
        }
        const parrain = parrainL1 ? s.partners.find((p) => p.id === parrainL1) : null;
        const sponsor = parrainL1
          ? s.partners.find((p) => p.id === parrainL1)?.sponsorId || null
          : null;
        // Cette attribution ne doit jamais changer lors d'une réaffectation
        // commerciale : elle constitue la trace de la personne qui a créé la
        // fiche client et sera reprise dans Google Contacts.
        const enregistrant = s.partners.find((p) => p.userId === lead.assignedTo);
        const now = new Date().toISOString();
        const source = buildClientSource({ userId: lead.assignedTo, partner: enregistrant, referrer: parrain, at: now });
        const existing = s.leads.find((item) => isSameClient(item, lead));

        // Téléphone ou e-mail déjà connu : la fiche existante est enrichie au
        // lieu de créer un doublon. L'auteur d'origine reste figé, tandis que
        // l'historique garde aussi le nouvel apporteur / parrain.
        if (existing) {
          const fields = ['name', 'contact', 'phone', 'email', 'address', 'notes', 'clientType'];
          const patch = Object.fromEntries(fields
            .filter((field) => lead[field] !== undefined && lead[field] !== null && String(lead[field]).trim() !== '')
            .map((field) => [field, lead[field]]));
          const history = appendClientSource(sourceHistoryFor(existing), source);
          const referrals = parrain && !(s.referrals || []).some((ref) => ref.leadId === existing.id && ref.partnerCode === parrain.code)
            ? [newReferral(parrain.code, 'piste', { leadId: existing.id }), ...(s.referrals || [])]
            : (s.referrals || []);
          return {
            ...s,
            referrals,
            leads: s.leads.map((item) => item.id !== existing.id ? item : {
              ...item,
              ...patch,
              parrainL1: item.parrainL1 || parrainL1,
              parrainL2: item.parrainL2 || sponsor,
              registrationHistory: history,
              lastActivity: now.slice(0, 10),
              ...(canSyncClientContact({ ...item, ...patch }) ? {
                google_contact_sync_status: 'pending',
                google_contact_sync_error: null,
                google_contact_sync_next_retry_at: null,
              } : {}),
            }),
          };
        }

        const leadId = crypto.randomUUID();
        const referrals = parrain
          ? [newReferral(parrain.code, 'piste', { leadId }), ...(s.referrals || [])]
          : (s.referrals || []);
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
              createdAt: now.slice(0, 10),
              lastActivity: now.slice(0, 10),
              registeredByUserId: lead.assignedTo || null,
              registeredByPartnerId: enregistrant?.id || null,
              registeredByPartnerName: enregistrant?.name || null,
              registeredByPartnerCode: enregistrant?.code || null,
              registrationHistory: appendClientSource([], source),
              ...(canSyncClientContact(lead) ? { google_contact_sync_status: 'pending' } : {}),
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
          l.id !== leadId ? l : (() => {
            // Toute coordonnée ou identité modifiée repart dans la file : un
            // doublon Google existant est alors mis à jour, pas recréé.
            const next = { ...l, ...patch };
            const changedContact = ['name', 'contact', 'phone', 'email', 'clientType'].some((field) => field in patch && patch[field] !== l[field]);
            const needsSync = canSyncClientContact(next) && (changedContact || !l.google_contact_sync_status);
            return {
              ...l,
              ...patch,
              lastActivity: new Date().toISOString().slice(0, 10),
              ...(needsSync ? {
                google_contact_sync_status: 'pending',
                google_contact_sync_error: null,
                google_contact_sync_next_retry_at: null,
              } : {}),
            };
          })()
        ),
      })),

    // Retour de l'Edge Function pour une fiche Client. Le statut est
    // répliqué avec la piste, ce qui évite toute seconde création sur un
    // autre appareil.
    setLeadGoogleContactSync: (leadId, result = {}) =>
      setState((s) => ({
        ...s,
        leads: s.leads.map((lead) => (lead.id === leadId ? {
          ...lead,
          google_contact_sync_status: result.status || 'pending',
          ...(result.resourceName ? { google_contact_resource_name: result.resourceName } : {}),
          ...(result.status === 'synced' || result.status === 'already_exists'
            ? { google_contact_synced_at: new Date().toISOString(), google_contact_sync_error: null, google_contact_sync_next_retry_at: null }
            : {}),
          ...(result.error ? { google_contact_sync_error: result.error } : {}),
          ...(result.nextRetryAt ? { google_contact_sync_next_retry_at: result.nextRetryAt } : {}),
        } : lead)),
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

    // Un commercial DEMANDE un changement d'étape : la piste ne bouge pas, la
    // demande attend la validation du gérant (une nouvelle demande remplace la
    // précédente).
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

    // Le gérant valide : l'étape s'applique réellement (commissions comprises)
    // et la validation est tracée dans l'activité du client.
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
