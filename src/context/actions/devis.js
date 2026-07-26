// Domaine devis : création (avec attribution d'affiliation) et marquage Pro.
import { newReferral, partnerFromActiveRef } from './shared';

export function createDevisActions(setState) {
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
            { ...devis, partnerId, partnerCode, id: crypto.randomUUID(), devisNumber, createdAt: now.toISOString() },
            ...s.devis,
          ],
          leads: s.leads.map((l) => {
            if (l.id !== devis.leadId) return l;
            // La valeur de l'affaire se déduit du devis (pas de saisie manuelle) ;
            // le dernier devis créé fait référence.
            let next = devis.total > 0 ? { ...l, estimatedValue: devis.total } : l;
            if (partnerId && !l.parrainL1) {
              const sponsor = s.partners.find((p) => p.id === partnerId)?.sponsorId || null;
              next = { ...next, parrainL1: partnerId, parrainL2: l.parrainL2 || sponsor };
            }
            return next;
          }),
        };
      }),

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
