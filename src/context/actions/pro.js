// Domaine Devis Pro (abonnement premium, trois formules) : abonnements et
// paiements Mobile Money, identité d'entreprise du technicien et facturation.
import { defaultEcheance } from '../../utils/paiement';
import { abonnementApresPaiement } from '../../utils/verificationPaiement';
import { formule, FORMULE_DEFAUT } from '../../utils/subscription';
import { prochainNumeroFacture } from '../../utils/facture';
import { appendClientSource, buildClientSource, canSyncClientContact, isSameClient, sourceHistoryFor } from '../../utils/clientContact';

export function createProActions(setState) {
  return {
    // Le technicien initie le paiement Mobile Money (stub) : l'abonnement
    // passe « en attente de paiement » jusqu'à validation par le gérant.
    requestSubscription: (userId, { methode, phone, reference, formule: formuleId }) =>
      setState((s) => {
        const subId = `sub-${userId}`;
        const f = formule(formuleId || FORMULE_DEFAUT);
        const existing = (s.subscriptions || []).find((x) => x.id === subId);
        // La formule demandée écrase la précédente : c'est celle-ci que le
        // gérant valide, et celle-ci dont la durée sera créditée.
        const sub = existing
          ? { ...existing, status: 'en_attente_paiement', formule: f.id, montant: f.prix, recurrence: f.id }
          : {
              id: subId, userId, type: 'devis_pro', status: 'en_attente_paiement',
              dateDebut: null, dateFin: null, montant: f.prix, formule: f.id, recurrence: f.id,
              lastPaymentAt: null,
            };
        const payment = {
          id: crypto.randomUUID(),
          subscriptionId: subId, userId, montant: f.prix, formule: f.id,
          methode, phone: phone || '', referenceTransaction: reference || '',
          statut: 'initie', date: new Date().toISOString(),
        };
        return {
          ...s,
          subscriptions: [sub, ...(s.subscriptions || []).filter((x) => x.id !== subId)],
          subscriptionPayments: [payment, ...(s.subscriptionPayments || [])],
        };
      }),

    // Paiement CONFIRMÉ PAR LE SERVEUR (api/paiement/verifier) : l'abonnement
    // est déjà actif en base. On applique le même résultat localement, avec
    // les mêmes identifiants que le serveur (`pay-<transaction>`), pour que la
    // réplication fasse converger les deux au lieu de créer un doublon ou de
    // renvoyer un « en attente » qui écraserait l'activation.
    activerAbonnementVerifie: (userId, { reference, montant, dateFin, formule: formuleId }) =>
      setState((s) => {
        const subId = `sub-${userId}`;
        const f = formule(formuleId || FORMULE_DEFAUT);
        const existant = (s.subscriptions || []).find((x) => x.id === subId);
        const base = existant || {
          id: subId, userId, type: 'devis_pro', dateDebut: null, dateFin: null,
          montant: montant || f.prix, recurrence: f.id, lastPaymentAt: null,
        };
        const maintenant = new Date().toISOString();
        // La date de fin fait autorité côté serveur : la recalculer ici
        // risquerait un jour d'écart selon l'horloge de l'appareil.
        const sub = {
          ...base, status: 'actif', formule: f.id, montant: montant || f.prix, recurrence: f.id,
          dateDebut: base.dateDebut || maintenant,
          dateFin: dateFin || base.dateFin,
          lastPaymentAt: maintenant,
        };
        const payId = `pay-${reference}`;
        const paiement = {
          id: payId, subscriptionId: subId, userId, montant: montant || f.prix, formule: f.id,
          methode: 'kkiapay', phone: '', referenceTransaction: reference,
          statut: 'confirme', verifieServeur: true, date: maintenant,
        };
        return {
          ...s,
          subscriptions: [sub, ...(s.subscriptions || []).filter((x) => x.id !== subId)],
          subscriptionPayments: [paiement, ...(s.subscriptionPayments || []).filter((p) => p.id !== payId)],
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
          // Même règle que la confirmation serveur : une seule fonction
          // décide de l'échéance, donc jamais deux dates contradictoires
          // selon la porte d'entrée du paiement.
          subscriptions: (s.subscriptions || []).map((sub) =>
            (sub.id === payment.subscriptionId ? abonnementApresPaiement(sub, now) : sub)
          ),
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

    // Agrégateurs de paiement (KkiaPay, CinetPay, FedaPay…).
    // Ne transitent ici que des valeurs PUBLIQUES : clé publique, mode,
    // activation. Une clé privée ou secrète finirait dans localStorage puis
    // dans Supabase, lisible par tout membre de l'organisation — elle reste
    // en variable d'environnement serveur. Le refus est appliqué en amont
    // par problemeConfig() (utils/paiementProviders.js).
    savePaiementConfig: (config) =>
      setState((s) => {
        const liste = s.paiementConfigs || [];
        const id = config.id || crypto.randomUUID();
        const ligne = { ...config, id, majLe: new Date().toISOString() };
        // Un seul agrégateur encaisse à la fois : activer celui-ci désactive
        // les autres, sinon deux configurations actives se disputeraient le
        // paiement et le client partirait chez l'un ou l'autre au hasard.
        const autres = liste
          .filter((c) => c.id !== id)
          .map((c) => (ligne.actif ? { ...c, actif: false } : c));
        return { ...s, paiementConfigs: [ligne, ...autres] };
      }),

    deletePaiementConfig: (id) =>
      setState((s) => ({
        ...s,
        paiementConfigs: (s.paiementConfigs || []).filter((c) => c.id !== id),
      })),

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
        const companies = s.companies || [];
        const company = companies.find((c) => c.userId === facture.userId);
        const prefix = company?.facturePrefix || 'FAC';
        // Numéro déduit des factures existantes (répliquées) ET du compteur :
        // deux appareils hors-ligne ne produisent plus le même numéro.
        const { numero, rang: counter } = prochainNumeroFacture(s.factures, facture.userId, company || {});
        const createdAt = new Date().toISOString();
        created = {
          ...facture,
          id: crypto.randomUUID(),
          numero,
          // Snapshot d'identité seulement si l'entreprise est réellement configurée.
          companySnapshot: company?.nomEntreprise ? { ...company } : (facture.companySnapshot || null),
          createdAt,
          // Échéance de paiement : fixée à l'émission (les brouillons n'en ont pas).
          echeance: facture.echeance || (facture.statut === 'brouillon' ? null : defaultEcheance(createdAt)),
        };
        // Le compteur DOIT être persisté même sans entreprise configurée, sinon
        // deux factures porteraient le même numéro (FAC-2026-001 en double).
        const companies2 = company
          ? companies.map((c) => (c.id === company.id ? { ...c, factureCounter: counter } : c))
          : [{ id: `comp-${facture.userId}`, userId: facture.userId, facturePrefix: prefix, factureCounter: counter }, ...companies];
        return {
          ...s,
          factures: [created, ...(s.factures || [])],
          companies: companies2,
        };
      });
      return created;
    },

    updateFacture: (factureId, patch) =>
      setState((s) => ({
        ...s,
        factures: (s.factures || []).map((f) => {
          if (f.id !== factureId) return f;
          const next = { ...f, ...patch };
          // Émission d'un brouillon → on fixe l'échéance si elle manque.
          if (patch.statut && patch.statut !== 'brouillon' && !next.echeance) next.echeance = defaultEcheance(next.createdAt);
          return next;
        }),
      })),

    // Encaissement (total ou partiel) : ajoute au détail, recalcule le solde et
    // solde la facture dès que le total TTC est atteint.
    addPaiement: (factureId, paiement) =>
      setState((s) => ({
        ...s,
        factures: (s.factures || []).map((f) => {
          if (f.id !== factureId) return f;
          const entry = {
            id: crypto.randomUUID(),
            montant: Math.max(0, Number(paiement.montant) || 0),
            mode: paiement.mode || 'momo',
            note: (paiement.note || '').trim(),
            date: new Date().toISOString(),
          };
          const paiements = [...(f.paiements || []), entry];
          const paye = paiements.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
          const solde = paye >= (Number(f.totalTTC) || 0);
          return {
            ...f,
            paiements,
            montantPaye: paye,
            statut: solde ? 'payee' : f.statut === 'brouillon' ? 'emise' : f.statut,
            echeance: f.echeance || defaultEcheance(f.createdAt),
          };
        }),
      })),

    // Trace une relance client (WhatsApp/SMS) pour l'historique et l'affichage.
    addRelance: (factureId, canal = 'whatsapp') =>
      setState((s) => ({
        ...s,
        factures: (s.factures || []).map((f) => {
          if (f.id !== factureId) return f;
          const date = new Date().toISOString();
          return { ...f, relances: [...(f.relances || []), { date, canal }], derniereRelance: date };
        }),
      })),

    deleteFacture: (factureId) =>
      setState((s) => ({
        ...s,
        factures: (s.factures || []).filter((f) => f.id !== factureId),
      })),

    // ---- Clients Pro (carnet propre à chaque technicien abonné) ----
    // Collection dédiée, étanche des pistes publiques (invariant mode public/Pro).
    addProClient: (client) => {
      let created = null;
      setState((s) => {
        const now = new Date().toISOString();
        const source = buildClientSource({
          userId: client.registeredByUserId || client.userId,
          partner: client.registeredByPartner,
          referrer: client.referredByPartner,
          at: now,
        });
        const existing = (s.proClients || []).find((item) => isSameClient(item, client));
        if (existing) {
          const fields = ['name', 'contact', 'phone', 'email', 'ville', 'type'];
          const patch = Object.fromEntries(fields
            .filter((field) => client[field] !== undefined && client[field] !== null && String(client[field]).trim() !== '')
            .map((field) => [field, client[field]]));
          created = {
            ...existing,
            ...patch,
            registrationHistory: appendClientSource(sourceHistoryFor(existing), source),
            ...(canSyncClientContact({ ...existing, ...patch }) ? {
              google_contact_sync_status: 'pending',
              google_contact_sync_error: null,
              google_contact_sync_next_retry_at: null,
            } : {}),
          };
          return {
            ...s,
            proClients: (s.proClients || []).map((item) => item.id === existing.id ? created : item),
          };
        }
        const { registeredByPartner, referredByPartner, ...stored } = client;
        created = {
          id: crypto.randomUUID(),
          name: '', phone: '', ville: '', type: 'particulier',
          ...stored,
          createdAt: now,
          registrationHistory: appendClientSource([], source),
          ...(canSyncClientContact(stored) ? { google_contact_sync_status: 'pending' } : {}),
        };
        return { ...s, proClients: [created, ...(s.proClients || [])] };
      });
      return created;
    },

    updateProClient: (clientId, patch) =>
      setState((s) => ({
        ...s,
        proClients: (s.proClients || []).map((c) => {
          if (c.id !== clientId) return c;
          const next = { ...c, ...patch };
          const changedContact = ['name', 'contact', 'phone', 'email'].some((field) => field in patch && patch[field] !== c[field]);
          return {
            ...next,
            ...(canSyncClientContact(next) && (changedContact || !c.google_contact_sync_status) ? {
              google_contact_sync_status: 'pending',
              google_contact_sync_error: null,
              google_contact_sync_next_retry_at: null,
            } : {}),
          };
        }),
      })),

    setProClientGoogleContactSync: (clientId, result = {}) =>
      setState((s) => ({
        ...s,
        proClients: (s.proClients || []).map((client) => (client.id === clientId ? {
          ...client,
          google_contact_sync_status: result.status || 'pending',
          ...(result.resourceName ? { google_contact_resource_name: result.resourceName } : {}),
          ...(result.status === 'synced' || result.status === 'already_exists'
            ? { google_contact_synced_at: new Date().toISOString(), google_contact_sync_error: null, google_contact_sync_next_retry_at: null }
            : {}),
          ...(result.error ? { google_contact_sync_error: result.error } : {}),
          ...(result.nextRetryAt ? { google_contact_sync_next_retry_at: result.nextRetryAt } : {}),
        } : client)),
      })),

    deleteProClient: (clientId) =>
      setState((s) => ({
        ...s,
        proClients: (s.proClients || []).filter((c) => c.id !== clientId),
      })),
  };
}
