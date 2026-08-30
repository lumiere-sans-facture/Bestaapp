// Domaine programme d'affiliation : réseau de partenaires, validation des
// conversions et paiement des commissions de parrainage.
import { generatePartnerCode, memeCode, normaliseCode } from '../../utils/referral';
import { missingCommissionsForLead, reconcileMissingCommissions, rattacherCommissionsClient } from '../../utils/commissionSync';
import { COMMISSION_RATES, partnerFromActiveRef } from './shared';

export function createPartnerActions(setState) {
  return {
    // Création locale d'abord : même sans réseau ou sans compte Google relié,
    // le partenaire apparaît immédiatement. Le contexte reprendra ensuite les
    // entrées « pending » auprès de la file Google Contacts.
    addPartner: (partner) => {
      const id = crypto.randomUUID();
      const created = { ...partner, id };
      setState((s) => ({
        ...s,
        partners: [
          {
            ...created,
            code: generatePartnerCode(partner.name, s.partners.map((p) => p.code).filter(Boolean)),
            status: 'actif',
            registeredAt: new Date().toISOString().slice(0, 10),
            ...(partner.phone?.trim() ? { google_contact_sync_status: 'pending' } : {}),
          },
          ...s.partners,
        ],
      }));
      return created;
    },

    // Résultat renvoyé par l'Edge Function ou par sa file de reprise. Il reste
    // attaché au partenaire pour être répliqué comme le reste des données.
    setPartnerGoogleContactSync: (partnerId, result = {}) =>
      setState((s) => ({
        ...s,
        partners: s.partners.map((p) => (p.id === partnerId ? {
          ...p,
          google_contact_sync_status: result.status || 'pending',
          ...(result.resourceName ? { google_contact_resource_name: result.resourceName } : {}),
          ...(result.status === 'synced' || result.status === 'already_exists'
            ? { google_contact_synced_at: new Date().toISOString(), google_contact_sync_error: null, google_contact_sync_next_retry_at: null }
            : {}),
          ...(result.error ? { google_contact_sync_error: result.error } : {}),
          ...(result.nextRetryAt ? { google_contact_sync_next_retry_at: result.nextRetryAt } : {}),
        } : p)),
      })),

    updatePartner: (partnerId, patch) =>
      setState((s) => ({
        ...s,
        partners: s.partners.map((p) => (p.id === partnerId ? { ...p, ...patch } : p)),
      })),

    // Chaque utilisateur de l'app (technicien ou gérant) dispose de son propre
    // profil partenaire, créé automatiquement à la première visite de son espace.
    //
    // Le parrain se note de DEUX façons, et les deux comptent :
    //  - `sponsorId` quand son profil partenaire vit dans la même organisation
    //    (réseau interne monté par le gérant) ;
    //  - `sponsorCode` sinon. À l'inscription sur la plateforme, le parrain est
    //    dans une AUTRE organisation : aucun `sponsorId` local ne peut le
    //    désigner. Sans le code, le niveau 2 n'a plus aucun support et la
    //    commission de 1,5 % n'est jamais attribuée.
    ensurePartnerForUser: (user) =>
      setState((s) => {
        // Le code venu du serveur peut encore porter l'ancien préfixe BESTA-.
        const codeOrg = normaliseCode(user.org?.referred_by) || null;
        const existant = s.partners.find((p) => p.userId === user.id);
        if (existant) {
          // Réparation des profils créés avant que le code d'organisation ne
          // soit connu : sans parrain, aucune commission de niveau 2.
          if (!codeOrg || existant.sponsorId || existant.sponsorCode) return s;
          const local = s.partners.find((p) => memeCode(p.code, codeOrg) && p.id !== existant.id);
          return {
            ...s,
            partners: s.partners.map((p) => (p.id === existant.id
              ? { ...p, sponsorCode: codeOrg, sponsorId: local?.id || null }
              : p)),
          };
        }
        // Rattachement automatique : si un lien de parrainage (?ref=…) est
        // actif sur l'appareil à la création du profil, son propriétaire
        // devient le parrain — sans saisie manuelle.
        const refPartner = partnerFromActiveRef(s.partners);
        const parrain = (refPartner && refPartner.userId !== user.id ? refPartner : null)
          || (codeOrg ? s.partners.find((p) => memeCode(p.code, codeOrg)) : null)
          || null;
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
              sponsorId: parrain?.id || null,
              sponsorCode: parrain?.code || codeOrg,
              status: 'actif',
              registeredAt: new Date().toISOString().slice(0, 10),
              code: generatePartnerCode(user.name, s.partners.map((p) => p.code).filter(Boolean)),
            },
            ...s.partners,
          ],
        };
      }),

    // Validation manuelle des conversions d'affiliation. Valider une
    // conversion « devis » attribue immédiatement la commission de
    // l'apporteur (même règle et même déduplication que le passage à
    // « gagné » : aucun doublon possible entre les deux chemins).
    updateReferralStatus: (referralId, status) =>
      setState((s) => {
        const referral = (s.referrals || []).find((r) => r.id === referralId);
        let commissions = s.commissions;
        if (status === 'validé' && referral?.type === 'devis' && referral.leadId) {
          const lead = s.leads.find((l) => l.id === referral.leadId);
          const generated = missingCommissionsForLead(
            { lead, devis: s.devis, partners: s.partners, commissions: s.commissions },
            COMMISSION_RATES,
            new Date().toISOString().slice(0, 10)
          );
          if (generated.length) commissions = [...generated, ...commissions];
        }
        return {
          ...s,
          commissions,
          referrals: (s.referrals || []).map((r) => (r.id === referralId ? { ...r, status } : r)),
        };
      }),

    // Rattrapage : recrée toutes les commissions manquantes sur les affaires
    // déjà validées (pistes gagnées, conversions devis validées). Idempotent —
    // relancer ne crée jamais de doublon.
    syncCommissions: () =>
      setState((s) => {
        const today = new Date().toISOString().slice(0, 10);
        // 1) Réparer les doublons déjà enregistrés (commission « niveau
        // client » sur une piste dont un devis est gagné).
        let commissions = s.commissions;
        for (const d of (s.devis || []).filter((x) => x.stage === 'gagne' && x.type !== 'pro')) {
          commissions = rattacherCommissionsClient(commissions, d);
        }
        // 2) Créer les commissions manquantes sur les affaires validées.
        const created = reconcileMissingCommissions(
          { leads: s.leads, devis: s.devis, partners: s.partners, commissions, referrals: s.referrals },
          COMMISSION_RATES,
          today
        );
        const next = created.length ? [...created, ...commissions] : commissions;
        return next === s.commissions ? s : { ...s, commissions: next };
      }),

    // Commission attribuée à la main. Le bénéficiaire peut être un partenaire
    // (partnerId) OU un membre de l'équipe (beneficiaire = { userId, name }) :
    // dans ce cas son profil partenaire est créé à la volée s'il n'en a pas
    // encore — toute l'équipe est ainsi commissionnable.
    addCommission: ({ beneficiaire, ...commission }) =>
      setState((s) => {
        let partners = s.partners;
        let partnerId = commission.partnerId || null;
        if (!partnerId && beneficiaire?.userId) {
          const existant = partners.find((p) => p.userId === beneficiaire.userId);
          if (existant) {
            partnerId = existant.id;
          } else {
            partnerId = `p-user-${beneficiaire.userId}`;
            partners = [
              {
                id: partnerId,
                userId: beneficiaire.userId,
                name: beneficiaire.name || 'Membre de l’équipe',
                phone: beneficiaire.phone || '',
                email: beneficiaire.email || '',
                momoNumber: '', photo: '', zone: '', tier: 'standard',
                sponsorId: null,
                status: 'actif',
                registeredAt: new Date().toISOString().slice(0, 10),
                code: generatePartnerCode(beneficiaire.name || 'Membre', partners.map((p) => p.code).filter(Boolean)),
              },
              ...partners,
            ];
          }
        }
        if (!partnerId) return s;
        return {
          ...s,
          partners,
          commissions: [
            {
              ...commission,
              partnerId,
              id: crypto.randomUUID(),
              status: 'en_attente',
              paidAt: null,
              createdAt: new Date().toISOString().slice(0, 10),
            },
            ...s.commissions,
          ],
        };
      }),

    // Paiement tracé (norme comptable) : mode de règlement, référence de la
    // transaction (n° Mobile Money…), payeur et note sont archivés sur la commission.
    payCommission: (commissionId, paiement = {}) =>
      setState((s) => ({
        ...s,
        commissions: s.commissions.map((c) =>
          c.id === commissionId
            ? {
                ...c,
                status: 'payée',
                paidAt: new Date().toISOString().slice(0, 10),
                payMode: paiement.mode || 'momo',
                payRef: (paiement.reference || '').trim(),
                payNote: (paiement.note || '').trim(),
                paidBy: paiement.paidBy || null,
              }
            : c
        ),
      })),

    payAllCommissionsForPartner: (partnerId, paiement = {}) =>
      setState((s) => ({
        ...s,
        commissions: s.commissions.map((c) =>
          c.partnerId === partnerId && c.status === 'en_attente'
            ? {
                ...c,
                status: 'payée',
                paidAt: new Date().toISOString().slice(0, 10),
                payMode: paiement.mode || 'momo',
                payRef: (paiement.reference || '').trim(),
                payNote: (paiement.note || '').trim(),
                paidBy: paiement.paidBy || null,
              }
            : c
        ),
      })),
  };
}
