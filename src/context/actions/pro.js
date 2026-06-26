// Domaine Devis Pro (abonnement premium 5 000 F/mois) : abonnements + paiements
// Mobile Money, identité d'entreprise du technicien et facturation.
export function createProActions(setState) {
  return {
    // Le technicien initie le paiement Mobile Money (stub) : l'abonnement
    // passe « en attente de paiement » jusqu'à validation par le gérant.
    requestSubscription: (userId, { methode, phone, reference }) =>
      setState((s) => {
        const subId = `sub-${userId}`;
        const existing = (s.subscriptions || []).find((x) => x.id === subId);
        const sub = existing
          ? { ...existing, status: 'en_attente_paiement' }
          : {
              id: subId, userId, type: 'devis_pro', status: 'en_attente_paiement',
              dateDebut: null, dateFin: null, montant: 5000, recurrence: 'mensuel',
              lastPaymentAt: null,
            };
        const payment = {
          id: crypto.randomUUID(),
          subscriptionId: subId, userId, montant: 5000,
          methode, phone: phone || '', referenceTransaction: reference || '',
          statut: 'initie', date: new Date().toISOString(),
        };
        return {
          ...s,
          subscriptions: [sub, ...(s.subscriptions || []).filter((x) => x.id !== subId)],
          subscriptionPayments: [payment, ...(s.subscriptionPayments || [])],
        };
      }),

    // Validation manuelle par le gérant : +30 jours à partir d'aujourd'hui
    // (ou de la fin actuelle si l'abonnement court encore).
    confirmSubscriptionPayment: (paymentId) =>
      setState((s) => {
        const payment = (s.subscriptionPayments || []).find((p) => p.id === paymentId);
        if (!payment) return s;
        const now = Date.now();
        return {
          ...s,
          subscriptionPayments: s.subscriptionPayments.map((p) =>
            p.id === paymentId ? { ...p, statut: 'confirme' } : p
          ),
          subscriptions: (s.subscriptions || []).map((sub) => {
            if (sub.id !== payment.subscriptionId) return sub;
            const base = sub.dateFin && new Date(sub.dateFin).getTime() > now
              ? new Date(sub.dateFin).getTime()
              : now;
            return {
              ...sub,
              status: 'actif',
              dateDebut: sub.dateDebut || new Date(now).toISOString(),
              dateFin: new Date(base + 30 * 86400000).toISOString(),
              lastPaymentAt: new Date(now).toISOString(),
            };
          }),
        };
      }),

    rejectSubscriptionPayment: (paymentId) =>
      setState((s) => {
        const payment = (s.subscriptionPayments || []).find((p) => p.id === paymentId);
        if (!payment) return s;
        return {
          ...s,
          subscriptionPayments: s.subscriptionPayments.map((p) =>
            p.id === paymentId ? { ...p, statut: 'rejete' } : p
          ),
          subscriptions: (s.subscriptions || []).map((sub) =>
            sub.id === payment.subscriptionId && sub.status === 'en_attente_paiement'
              ? { ...sub, status: sub.dateFin && new Date(sub.dateFin).getTime() > Date.now() ? 'actif' : 'expire' }
              : sub
          ),
        };
      }),

    // Identité de l'entreprise du technicien (logo, couleurs, coordonnées)
    saveCompany: (userId, data) =>
      setState((s) => {
        const id = `comp-${userId}`;
        const existing = (s.companies || []).find((c) => c.id === id);
        const company = { facturePrefix: 'FAC', factureCounter: 0, ...existing, ...data, id, userId };
        return { ...s, companies: [company, ...(s.companies || []).filter((c) => c.id !== id)] };
      }),

    // Création d'une facture avec numérotation auto par technicien (FAC-2026-001)
    addFacture: (facture) => {
      let created = null;
      setState((s) => {
        const company = (s.companies || []).find((c) => c.userId === facture.userId);
        const counter = (company?.factureCounter || 0) + 1;
        const prefix = company?.facturePrefix || 'FAC';
        const numero = `${prefix}-${new Date().getFullYear()}-${String(counter).padStart(3, '0')}`;
        created = {
          ...facture,
          id: crypto.randomUUID(),
          numero,
          companySnapshot: company ? { ...company } : null,
          createdAt: new Date().toISOString(),
        };
        return {
          ...s,
          factures: [created, ...(s.factures || [])],
          companies: company
            ? s.companies.map((c) => (c.id === company.id ? { ...c, factureCounter: counter } : c))
            : s.companies,
        };
      });
      return created;
    },

    updateFacture: (factureId, patch) =>
      setState((s) => ({
        ...s,
        factures: (s.factures || []).map((f) => (f.id === factureId ? { ...f, ...patch } : f)),
      })),

    deleteFacture: (factureId) =>
      setState((s) => ({
        ...s,
        factures: (s.factures || []).filter((f) => f.id !== factureId),
      })),
  };
}
