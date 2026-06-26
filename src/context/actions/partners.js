// Domaine programme d'affiliation : réseau de partenaires, validation des
// conversions et paiement des commissions de parrainage.
import { generatePartnerCode } from '../../utils/referral';
import { partnerFromActiveRef } from './shared';

export function createPartnerActions(setState) {
  return {
    addPartner: (partner) =>
      setState((s) => ({
        ...s,
        partners: [
          {
            ...partner,
            id: crypto.randomUUID(),
            code: generatePartnerCode(partner.name, s.partners.map((p) => p.code).filter(Boolean)),
            status: 'actif',
            registeredAt: new Date().toISOString().slice(0, 10),
          },
          ...s.partners,
        ],
      })),

    updatePartner: (partnerId, patch) =>
      setState((s) => ({
        ...s,
        partners: s.partners.map((p) => (p.id === partnerId ? { ...p, ...patch } : p)),
      })),

    // Chaque utilisateur de l'app (technicien ou gérant) dispose de son propre
    // profil partenaire, créé automatiquement à la première visite de son espace.
    ensurePartnerForUser: (user) =>
      setState((s) => {
        if (s.partners.some((p) => p.userId === user.id)) return s;
        // Rattachement automatique : si un lien de parrainage (?ref=…) est
        // actif sur l'appareil à la création du profil, son propriétaire
        // devient le parrain — sans saisie manuelle.
        const refPartner = partnerFromActiveRef(s.partners);
        return {
          ...s,
          partners: [
            {
              id: `p-user-${user.id}`,
              userId: user.id,
              name: user.name,
              phone: user.phone || '',
              email: user.email || '',
              momoNumber: '',
              photo: '',
              zone: '',
              tier: 'standard',
              sponsorId: refPartner && refPartner.userId !== user.id ? refPartner.id : null,
              status: 'actif',
              registeredAt: new Date().toISOString().slice(0, 10),
              code: generatePartnerCode(user.name, s.partners.map((p) => p.code).filter(Boolean)),
            },
            ...s.partners,
          ],
        };
      }),

    // Validation manuelle des conversions d'affiliation avant paiement
    updateReferralStatus: (referralId, status) =>
      setState((s) => ({
        ...s,
        referrals: (s.referrals || []).map((r) => (r.id === referralId ? { ...r, status } : r)),
      })),

    addCommission: (commission) =>
      setState((s) => ({
        ...s,
        commissions: [
          {
            ...commission,
            id: crypto.randomUUID(),
            status: 'en_attente',
            paidAt: null,
            createdAt: new Date().toISOString().slice(0, 10),
          },
          ...s.commissions,
        ],
      })),

    payCommission: (commissionId) =>
      setState((s) => ({
        ...s,
        commissions: s.commissions.map((c) =>
          c.id === commissionId
            ? { ...c, status: 'payée', paidAt: new Date().toISOString().slice(0, 10) }
            : c
        ),
      })),

    payAllCommissionsForPartner: (partnerId) =>
      setState((s) => ({
        ...s,
        commissions: s.commissions.map((c) =>
          c.partnerId === partnerId && c.status === 'en_attente'
            ? { ...c, status: 'payée', paidAt: new Date().toISOString().slice(0, 10) }
            : c
        ),
      })),
  };
}
