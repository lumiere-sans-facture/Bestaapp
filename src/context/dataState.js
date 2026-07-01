// État applicatif : forme initiale, chargement depuis localStorage (avec
// migrations de seed) et persistance. Aucune dépendance React — logique pure.
import * as seed from '../data/seed';
import { generatePartnerCode, codeBaseFromName } from '../utils/referral';

export const STORAGE_KEY = 'bestasolar_data';

export const buildInitialState = () => ({
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
  subscriptions: [],
  subscriptionPayments: [],
  companies: [],
  factures: [],
  proClients: [],
  devisCounter: 0,
  orderCounter: 0,
});

// Corrections du catalogue : si l'appareil a encore l'ancienne valeur erronée,
// le produit est remplacé par sa version corrigée (les modifications locales
// volontaires, elles, ne correspondent plus à l'ancienne valeur et sont gardées).
const CATALOGUE_FIXES = { 'cat-p14r4': 65000, 'cat-p14r5': 70000 };

export const loadState = () => {
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
      if (!saved.subscriptions) saved.subscriptions = [];
      if (!saved.subscriptionPayments) saved.subscriptionPayments = [];
      if (!saved.companies) saved.companies = [];
      if (!saved.factures) saved.factures = [];
      if (!saved.proClients) saved.proClients = [];
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

/** Écrit l'état dans localStorage (silencieux en cas de quota / mode privé). */
export const persist = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota dépassé / navigation privée */
  }
};
