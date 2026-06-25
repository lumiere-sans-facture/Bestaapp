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
        // Attribution automatique : partenaire choisi > parrain de la piste > lien d'affiliation
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
            if (l.id !== devis.leadId || !partnerId || l.parrainL1) return l;
            const sponsor = s.partners.find((p) => p.id === partnerId)?.sponsorId || null;
            return { ...l, parrainL1: partnerId, parrainL2: l.parrainL2 || sponsor };
          }),
        };
      }),

    // Marque un devis comme document Pro (rendu à l'identité du technicien)
    markDevisPro: (devisId, { modele, companySnapshot }) =>
      setState((s) => ({
        ...s,
        devis: s.devis.map((d) => (d.id === devisId ? { ...d, pro: true, modele, companySnapshot } : d)),
      })),
  };
}
