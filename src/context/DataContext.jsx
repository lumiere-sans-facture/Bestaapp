import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as seed from '../data/seed';
import { generatePartnerCode, codeBaseFromName, getActiveRef, consumeRefClick } from '../utils/referral';
import { isSupabaseConfigured } from '../lib/supabase';
import { pullAll, pushCollections, subscribeToChanges, SYNCED_COLLECTIONS } from '../lib/remoteSync';

const DataContext = createContext(null);
const STORAGE_KEY = 'bestasolar_data';

export const COMMISSION_RATES = { 1: 0.03, 2: 0.015 };

const buildInitialState = () => ({
  version: seed.SEED_VERSION,
  leads: seed.leads,
  products: seed.products,
  partners: seed.partners,
  commissions: seed.commissions,
  devis: [],
  referrals: [],
  orders: [],
  formations: seed.formations,
  formationProgress: [],
});

// Partenaire actif correspondant à l'attribution d'affiliation en cours (?ref=…)
const partnerFromActiveRef = (partners) => {
  const ref = getActiveRef();
  if (!ref) return null;
  return partners.find((p) => p.code === ref.code && p.status === 'actif') || null;
};

const newReferral = (partnerCode, type, extra = {}) => ({
  id: `r${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  partnerCode,
  type, // 'clic' | 'piste' | 'devis'
  status: type === 'clic' ? 'validé' : 'en_attente',
  amount: null,
  leadId: null,
  createdAt: new Date().toISOString(),
  ...extra,
});

// Corrections du catalogue : si l'appareil a encore l'ancienne valeur erronée,
// le produit est remplacé par sa version corrigée (les modifications locales
// volontaires, elles, ne correspondent plus à l'ancienne valeur et sont gardées).
const CATALOGUE_FIXES = { 'cat-p14r4': 65000, 'cat-p14r5': 70000 };

const loadState = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.version === seed.SEED_VERSION) {
      // Injecte les nouveaux produits du catalogue officiel sans toucher
      // aux données locales (modifications de prix, photos, pistes, devis…)
      const knownIds = new Set((saved.products || []).map((p) => p.id));
      const newOfficial = seed.products.filter((p) => !knownIds.has(p.id));
      if (newOfficial.length) saved.products = [...newOfficial, ...saved.products];
      saved.products = saved.products.map((p) =>
        CATALOGUE_FIXES[p.id] === p.basePrice
          ? seed.products.find((sp) => sp.id === p.id) || p
          : p
      );
      // Migration affiliation : registre des parrainages + codes basés sur le nom.
      // Les anciens codes aléatoires (BESTA-XXXX) sont régénérés à partir du nom,
      // et le registre des parrainages est remappé vers les nouveaux codes.
      if (!saved.referrals) saved.referrals = [];
      if (!saved.orders) saved.orders = [];
      if (!saved.formations) saved.formations = seed.formations;
      if (!saved.formationProgress) saved.formationProgress = [];
      const isNameBased = (p) => p.code && p.code.startsWith(`BESTA-${codeBaseFromName(p.name)}`);
      // 1re passe : réserver les codes déjà conformes (basés sur le nom)
      const codes = saved.partners.filter(isNameBased).map((p) => p.code);
      const remap = {};
      // 2e passe : régénérer les autres à partir du nom
      saved.partners = saved.partners.map((p) => {
        if (isNameBased(p)) return p;
        const seedCode = seed.partners.find((sp) => sp.id === p.id)?.code;
        const code = seedCode && !codes.includes(seedCode) ? seedCode : generatePartnerCode(p.name, codes);
        codes.push(code);
        if (p.code) remap[p.code] = code;
        return { ...p, code };
      });
      if (Object.keys(remap).length) {
        saved.referrals = saved.referrals.map((r) =>
          remap[r.partnerCode] ? { ...r, partnerCode: remap[r.partnerCode] } : r
        );
      }
      return saved;
    }
  } catch {
    // données corrompues : on repart du seed
  }
  return buildInitialState();
};

export function DataProvider({ children }) {
  const [state, setState] = useState(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Comptabilise le clic d'affiliation capturé à l'ouverture de l'app (?ref=…)
  useEffect(() => {
    const code = consumeRefClick();
    if (!code) return;
    setState((s) =>
      s.partners.some((p) => p.code === code && p.status === 'actif')
        ? { ...s, referrals: [newReferral(code, 'clic'), ...(s.referrals || [])] }
        : s
    );
  }, []);

  // ---- Synchronisation Supabase (si configuré) ----
  // Au démarrage : récupère les données partagées (ou y pousse les données
  // locales si la base est vide). Ensuite : réplique chaque changement local
  // et applique les changements venus des autres appareils en temps réel.
  const stateRef = useRef(state);
  stateRef.current = state;
  const syncedRef = useRef(null); // dernier état répliqué/reçu, par collection
  const lastPushAt = useRef(0);
  const [syncStatus, setSyncStatus] = useState(isSupabaseConfigured ? 'connecting' : 'local');

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    let unsubscribe = () => {};

    const applyRemote = (collections) => {
      const next = { ...stateRef.current, ...collections };
      syncedRef.current = collections;
      setState(next);
    };

    const refreshFromRemote = async () => {
      try {
        const { collections } = await pullAll();
        if (!cancelled) applyRemote(collections);
      } catch (e) {
        console.error('Synchronisation Supabase impossible :', e.message);
      }
    };

    (async () => {
      try {
        const { empty, collections } = await pullAll();
        if (cancelled) return;
        if (empty) {
          // Première initialisation : la base reçoit les données de cet appareil
          const initial = Object.fromEntries(SYNCED_COLLECTIONS.map((t) => [t, stateRef.current[t] || []]));
          lastPushAt.current = Date.now();
          await pushCollections(initial);
          syncedRef.current = initial;
        } else {
          applyRemote(collections);
        }
        setSyncStatus('online');
        let timer = null;
        unsubscribe = subscribeToChanges(() => {
          // Ignorer l'écho de nos propres écritures, regrouper les rafales
          if (Date.now() - lastPushAt.current < 2500) return;
          clearTimeout(timer);
          timer = setTimeout(refreshFromRemote, 600);
        });
      } catch (e) {
        console.error('Supabase indisponible, mode local :', e.message);
        if (!cancelled) setSyncStatus('error');
      }
    })();

    return () => { cancelled = true; unsubscribe(); };
  }, []);

  // Réplication des changements locaux vers Supabase
  useEffect(() => {
    if (!isSupabaseConfigured || syncStatus !== 'online' || !syncedRef.current) return;
    const changed = {};
    for (const table of SYNCED_COLLECTIONS) {
      if (state[table] !== syncedRef.current[table]) changed[table] = state[table] || [];
    }
    if (!Object.keys(changed).length) return;
    syncedRef.current = { ...syncedRef.current, ...changed };
    lastPushAt.current = Date.now();
    pushCollections(changed).catch((e) => console.error('Réplication Supabase échouée :', e.message));
  }, [state, syncStatus]);

  const actions = useMemo(() => ({
    // Le niveau 2 se déduit du réseau : c'est le parrain du partenaire apporteur.
    // Sans partenaire explicite, l'attribution d'affiliation active (?ref=…,
    // 30 jours, last-click) rattache automatiquement la piste au partenaire.
    addLead: (lead) =>
      setState((s) => {
        const leadId = `l${Date.now()}`;
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

    // ---- Réseau de partenaires ----
    addPartner: (partner) =>
      setState((s) => ({
        ...s,
        partners: [
          {
            ...partner,
            id: `p${Date.now()}`,
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
        return {
          ...s,
          partners: [
            {
              id: `p-user-${user.id}`,
              userId: user.id,
              name: user.name,
              phone: user.phone || '',
              momoNumber: '',
              sponsorId: null,
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

    // Passer une affaire à « gagné » génère automatiquement les commissions
    // de parrainage (3 % niveau 1, 1,5 % niveau 2) si elles n'existent pas déjà.
    updateLeadStage: (leadId, stage) =>
      setState((s) => {
        const today = new Date().toISOString().slice(0, 10);
        const lead = s.leads.find((l) => l.id === leadId);
        let commissions = s.commissions;
        if (stage === 'gagne' && lead) {
          const alreadyExists = (partnerId, level) =>
            s.commissions.some((c) => c.leadId === leadId && c.partnerId === partnerId && c.level === level);
          const generated = [];
          if (lead.parrainL1 && !alreadyExists(lead.parrainL1, 1)) {
            generated.push({
              id: `c${Date.now()}-1`, partnerId: lead.parrainL1, leadId, level: 1,
              amount: Math.round(lead.estimatedValue * COMMISSION_RATES[1]),
              status: 'en_attente', paidAt: null, createdAt: today,
            });
          }
          if (lead.parrainL2 && !alreadyExists(lead.parrainL2, 2)) {
            generated.push({
              id: `c${Date.now()}-2`, partnerId: lead.parrainL2, leadId, level: 2,
              amount: Math.round(lead.estimatedValue * COMMISSION_RATES[2]),
              status: 'en_attente', paidAt: null, createdAt: today,
            });
          }
          if (generated.length) commissions = [...generated, ...s.commissions];
        }
        return {
          ...s,
          commissions,
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
      }),

    addCommission: (commission) =>
      setState((s) => ({
        ...s,
        commissions: [
          {
            ...commission,
            id: `c${Date.now()}`,
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

    // ---- Gestion du catalogue boutique (gérant) ----
    addProduct: (product) =>
      setState((s) => ({
        ...s,
        products: [{ ...product, id: `prod${Date.now()}` }, ...s.products],
      })),

    updateProduct: (productId, patch) =>
      setState((s) => ({
        ...s,
        products: s.products.map((p) => (p.id === productId ? { ...p, ...patch } : p)),
      })),

    deleteProduct: (productId) =>
      setState((s) => ({
        ...s,
        products: s.products.filter((p) => p.id !== productId),
      })),

    addLeadNote: (leadId, text, userId) =>
      setState((s) => ({
        ...s,
        leads: s.leads.map((l) =>
          l.id === leadId
            ? {
                ...l,
                activities: [
                  { id: `a${Date.now()}`, date: new Date().toISOString(), text, by: userId },
                  ...(l.activities || []),
                ],
                lastActivity: new Date().toISOString().slice(0, 10),
              }
            : l
        ),
      })),

    // Le devis porte la référence du partenaire apporteur : c'est par lui
    // que le parrainage est tracé. Sans partenaire explicite, l'attribution
    // d'affiliation active rattache le devis (conversion enregistrée au registre).
    addDevis: (devis) =>
      setState((s) => {
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const devisNumber = `BS-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;
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
          referrals,
          devis: [
            { ...devis, partnerId, partnerCode, id: `d${Date.now()}`, devisNumber, createdAt: now.toISOString() },
            ...s.devis,
          ],
          leads: s.leads.map((l) => {
            if (l.id !== devis.leadId || !partnerId || l.parrainL1) return l;
            const sponsor = s.partners.find((p) => p.id === partnerId)?.sponsorId || null;
            return { ...l, parrainL1: partnerId, parrainL2: l.parrainL2 || sponsor };
          }),
        };
      }),

    // Commande payée en ligne (Mobile Money — stub en attendant l'agrégateur)
    addOrder: (order) => {
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const full = {
        ...order,
        id: `o${Date.now()}`,
        orderNumber: `CMD-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'initie', // initie → confirme → livre (ou annule)
        createdAt: now.toISOString(),
      };
      setState((s) => ({ ...s, orders: [full, ...(s.orders || [])] }));
      return full;
    },

    updateOrderStatus: (orderId, status) =>
      setState((s) => ({
        ...s,
        orders: (s.orders || []).map((o) => (o.id === orderId ? { ...o, status } : o)),
      })),

    resetData: () => setState(buildInitialState()),
  }), []);

  const helpers = useMemo(() => ({
    getPartnerById: (id) => state.partners.find((p) => p.id === id),
    getPartnerByUserId: (userId) => state.partners.find((p) => p.userId === userId),
    getLeadById: (id) => state.leads.find((l) => l.id === id),
    getUserById: (id) => seed.users.find((u) => u.id === id),
    leadsForUser: (user) =>
      user.role === 'gerant' ? state.leads : state.leads.filter((l) => l.assignedTo === user.id),
  }), [state]);

  return (
    <DataContext.Provider value={{ ...state, ...actions, ...helpers, syncStatus, stages: seed.stages, lostStage: seed.LOST_STAGE, productCategories: seed.productCategories, monthlyData: seed.monthlyData, team: seed.users }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData doit être utilisé dans <DataProvider>');
  return ctx;
}
