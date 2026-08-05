// Domaine « demandes de paiement » : le partenaire demande le règlement de ses
// commissions, le gérant tranche. La décision est ce qui fait bouger l'argent —
// c'est donc elle, et elle seule, qui marque les commissions payées.
import { montantDemande } from '../../utils/payouts';

const aujourdhui = () => new Date().toISOString().slice(0, 10);

export function createPayoutActions(setState) {
  return {
    requestPayout: ({ partnerId, commissionIds = [], methode = 'momo', telephone = '', note = '', requestedBy }) =>
      setState((s) => {
        const partner = (s.partners || []).find((p) => p.id === partnerId);
        // Une seule demande en cours par partenaire : deux demandes ouvertes
        // pourraient couvrir les mêmes commissions et se payer deux fois.
        if ((s.payoutRequests || []).some((d) => d.partnerId === partnerId && d.status === 'en_attente')) return s;
        const id = crypto.randomUUID();
        return {
          ...s,
          payoutRequests: [{
            id,
            partnerId,
            // Nom et code figés : le partenaire peut être renommé, le reçu
            // déjà remis doit rester fidèle à ce qui a été demandé.
            partnerName: partner?.name || '',
            partnerCode: partner?.code || '',
            commissionIds,
            amount: montantDemande(s.commissions || [], commissionIds),
            methode,
            telephone: telephone.trim(),
            note: note.trim(),
            status: 'en_attente',
            requestedBy: requestedBy || null,
            requestedAt: new Date().toISOString(),
            decidedBy: null, decidedAt: null, motif: null,
            payRef: null, paidAt: null,
          }, ...(s.payoutRequests || [])],
        };
      }),

    // Le partenaire retire sa demande tant qu'elle n'est pas tranchée : les
    // commissions redeviennent mobilisables d'elles-mêmes (plus d'engagement).
    cancelPayout: (payoutId) =>
      setState((s) => ({
        ...s,
        payoutRequests: (s.payoutRequests || []).filter(
          (d) => !(d.id === payoutId && d.status === 'en_attente')
        ),
      })),

    /**
     * Validation : l'argent part. Les commissions couvertes passent « payée »
     * dans le même mouvement — sans cela, les totaux mentiraient et la même
     * commission pourrait repartir dans une seconde demande.
     */
    approvePayout: (payoutId, { mode = 'momo', reference = '', note = '', decidedBy } = {}) =>
      setState((s) => {
        const demande = (s.payoutRequests || []).find((d) => d.id === payoutId);
        if (!demande || demande.status !== 'en_attente') return s;
        const jour = aujourdhui();
        const couvertes = new Set(demande.commissionIds || []);
        return {
          ...s,
          commissions: (s.commissions || []).map((c) =>
            couvertes.has(c.id) && c.status !== 'payée'
              ? { ...c, status: 'payée', paidAt: jour, payMode: mode, payRef: reference || null, paidBy: decidedBy || null, payoutId }
              : c
          ),
          payoutRequests: (s.payoutRequests || []).map((d) =>
            d.id === payoutId
              ? { ...d, status: 'paye', payMode: mode, payRef: reference || null, motif: note || null,
                  decidedBy: decidedBy || null, decidedAt: new Date().toISOString(), paidAt: jour }
              : d
          ),
        };
      }),

    // Refus : rien ne bouge côté commissions, elles redeviennent mobilisables.
    // Le motif est obligatoire côté écran — un refus sans explication est
    // ingérable pour un partenaire qui compte sur cet argent.
    rejectPayout: (payoutId, { motif = '', decidedBy } = {}) =>
      setState((s) => ({
        ...s,
        payoutRequests: (s.payoutRequests || []).map((d) =>
          d.id === payoutId && d.status === 'en_attente'
            ? { ...d, status: 'refuse', motif: motif.trim() || null,
                decidedBy: decidedBy || null, decidedAt: new Date().toISOString() }
            : d
        ),
      })),
  };
}
