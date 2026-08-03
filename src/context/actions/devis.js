// Domaine devis : création (avec attribution d'affiliation), marquage Pro et
// SUIVI DEVIS PAR DEVIS — chaque devis porte sa propre issue (gagné/perdu) et
// donc sa propre commission, sans jamais déplacer le client dans le kanban :
// l'étape du client reste pilotée à la main par le commercial.
import { COMMISSION_RATES, STAGE_LABEL, newReferral, note, partnerFromActiveRef } from './shared';
import { missingCommissionsForDevis, rattacherCommissionsClient } from '../../utils/commissionSync';

// L'issue d'un devis compte comme une activité sur la fiche du client
// (indicateur « affaire inactive depuis N jours »).
const touchLead = (leads, leadId, today) =>
  leads.map((l) => (l.id === leadId ? { ...l, lastActivity: today } : l));

export function createDevisActions(setState) {
  // Application effective du changement d'étape d'UNE affaire (devis) :
  // le « gagné » génère les commissions de CE devis (3 % N1, 1,5 % N2) —
  // deux devis gagnés d'un même client donnent bien deux commissions.
  const devisStageState = (s, devisId, stage) => {
    const today = new Date().toISOString().slice(0, 10);
    const d = s.devis.find((x) => x.id === devisId);
    if (!d) return s;
    const lead = s.leads.find((l) => l.id === d.leadId);
    let commissions = s.commissions;
    let referrals = s.referrals || [];
    if (stage === 'gagne') {
      // Une commission « niveau client » (sans devisId) devient caduque dès
      // qu'un devis de ce client est gagné : la rémunération se fait alors
      // devis par devis. Sans cela, conclure le client PUIS son devis payait
      // deux fois la même vente.
      const pool = rattacherCommissionsClient(s.commissions, d);
      const generated = missingCommissionsForDevis(
        { devis: d, lead, partners: s.partners, commissions: pool },
        COMMISSION_RATES,
        today
      );
      commissions = generated.length ? [...generated, ...pool] : pool;
      // Affaire gagnée : les conversions d'affiliation encore en attente sur
      // cette piste sont validées d'office (registre cohérent avec la commission).
      referrals = referrals.map((r) =>
        r.leadId === d.leadId && r.status === 'en_attente' ? { ...r, status: 'validé' } : r
      );
    }
    const ns = {
      ...s,
      commissions,
      referrals,
      devis: s.devis.map((x) =>
        x.id === devisId
          ? {
              ...x,
              stage,
              wonAt: stage === 'gagne' ? today : x.wonAt,
              lostAt: stage === 'perdu' ? today : null,
            }
          : x
      ),
    };
    return { ...ns, leads: touchLead(ns.leads, d.leadId, today) };
  };

  return {
    // Le devis porte la référence du partenaire apporteur : c'est par lui
    // que le parrainage est tracé. Sans partenaire explicite, l'attribution
    // d'affiliation active rattache le devis (conversion enregistrée au registre).
    addDevis: (devis) =>
      setState((s) => {
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const counter = (s.devisCounter || 0) + 1;
        const devisNumber = `BS-${dateStr}-${String(counter).padStart(4, '0')}`;
        // Attribution automatique : partenaire choisi > parrain de la piste
        // > lien d'affiliation > profil partenaire du créateur du devis
        // (chaque devis a impérativement un apporteur).
        const lead = s.leads.find((l) => l.id === devis.leadId);
        let partnerId = devis.partnerId || lead?.parrainL1 || null;
        let referrals = s.referrals || [];
        if (!partnerId) {
          const refPartner = partnerFromActiveRef(s.partners);
          if (refPartner) {
            partnerId = refPartner.id;
            referrals = [
              newReferral(refPartner.code, 'devis', { leadId: devis.leadId, amount: devis.total }),
              ...referrals,
            ];
          }
        }
        if (!partnerId && devis.createdBy) {
          partnerId = s.partners.find((p) => p.userId === devis.createdBy)?.id || null;
        }
        // Le code partenaire est figé sur le devis : il identifie l'apporteur
        // même si le partenaire est renommé plus tard.
        const partnerCode = s.partners.find((p) => p.id === partnerId)?.code || null;
        return {
          ...s,
          devisCounter: counter,
          referrals,
          devis: [
            // Une affaire naît à « Proposition » : un devis émis est, par
            // nature, une proposition faite au client.
            { ...devis, partnerId, partnerCode, stage: devis.stage || 'proposition', id: crypto.randomUUID(), devisNumber, createdAt: now.toISOString() },
            ...s.devis,
          ],
          leads: s.leads.map((l) => {
            if (l.id !== devis.leadId) return l;
            // La valeur de l'affaire se déduit du devis (pas de saisie manuelle) ;
            // le dernier devis créé fait référence. L'ÉTAPE du client, elle,
            // reste pilotée à la main dans le kanban — créer un devis ne fait
            // jamais sauter une étape dans le dos du commercial.
            let next = devis.total > 0 ? { ...l, estimatedValue: devis.total } : l;
            if (partnerId && !l.parrainL1) {
              const sponsor = s.partners.find((p) => p.id === partnerId)?.sponsorId || null;
              next = { ...next, parrainL1: partnerId, parrainL2: l.parrainL2 || sponsor };
            }
            return next;
          }),
        };
      }),

    // ---- Suivi devis par devis : chaque devis a sa propre issue ----
    // Passage direct (gérant, ou espace sans gérant) : applique l'étape
    // immédiatement — le « gagné » génère les commissions de CE devis.
    updateDevisStage: (devisId, stage) => setState((s) => devisStageState(s, devisId, stage)),

    // Marque un devis comme document Pro (rendu à l'identité du technicien)
    markDevisPro: (devisId, { modele, companySnapshot }) =>
      setState((s) => ({
        ...s,
        devis: s.devis.map((d) => (d.id === devisId ? { ...d, pro: true, modele, companySnapshot } : d)),
      })),

    // Mise à jour partielle d'un devis (ex. finaliser un brouillon : statut).
    // Si le total change, la valeur de l'affaire du client suit.
    updateDevis: (devisId, patch) =>
      setState((s) => {
        const devis = s.devis.find((d) => d.id === devisId);
        const newTotal = patch.total != null && patch.total !== devis?.total ? patch.total : null;
        return {
          ...s,
          devis: s.devis.map((d) => (d.id === devisId ? { ...d, ...patch } : d)),
          leads: newTotal > 0 && devis?.leadId
            ? s.leads.map((l) => (l.id === devis.leadId ? { ...l, estimatedValue: newTotal } : l))
            : s.leads,
        };
      }),

    // Suppression d'un devis (la réplication gère les tombstones automatiquement).
    deleteDevis: (devisId) =>
      setState((s) => ({
        ...s,
        devis: s.devis.filter((d) => d.id !== devisId),
      })),
  };
}
