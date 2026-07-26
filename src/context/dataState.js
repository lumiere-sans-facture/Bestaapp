// État applicatif : forme initiale, chargement depuis localStorage (avec
// migrations de seed) et persistance. Aucune dépendance React — logique pure.
import * as seed from '../data/seed';
import { IRRADIATION_SITES } from '../data/irradiation';
import { generatePartnerCode, codeBaseFromName } from '../utils/referral';
import { withSpecsAll } from '../utils/materielSpecs';

export const STORAGE_KEY = 'bestasolar_data';

export const buildInitialState = () => ({
  version: seed.SEED_VERSION,
  leads: seed.leads,
  // Le catalogue porte les caractéristiques électriques (specs) attendues par
  // le moteur de dimensionnement v2 : squelette + valeurs déductibles de la
  // désignation. Les données de fiche constructeur restent à null.
  products: withSpecsAll(seed.products),
  irradiationSites: IRRADIATION_SITES,
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
      // Migration formation : structure « école » (cours → modules → leçons).
      // Les anciens modules plats ajoutés par le gérant sont conservés dans un
      // cours dédié ; ceux du seed sont remplacés par les nouveaux cours.
      if ((saved.formations || []).some((f) => !Array.isArray(f.modules))) {
        const seedIds = new Set(seed.formations.map((c) => c.id));
        const custom = saved.formations.filter((f) => !Array.isArray(f.modules) && !seedIds.has(f.id));
        const customCourse = custom.length ? [{
          id: 'fperso',
          title: 'Modules ajoutés',
          description: 'Vos modules créés avant la mise à jour de l’espace formation.',
          modules: [{
            id: 'fperso-m1', title: 'Modules',
            lecons: custom.map((f) => ({ id: f.id, title: f.title, type: f.type === 'pdf' ? 'pdf' : 'video', url: f.url, duration: f.duration || '' })),
          }],
        }] : [];
        saved.formations = [...seed.formations, ...customCourse, ...saved.formations.filter((f) => Array.isArray(f.modules))];
        // L'avancement par module n'a pas d'équivalent leçon : on ne garde que les lignes par leçon.
        saved.formationProgress = (saved.formationProgress || []).filter((p) => p.leconId);
      }
      if (!saved.subscriptions) saved.subscriptions = [];
      if (!saved.subscriptionPayments) saved.subscriptionPayments = [];
      if (!saved.companies) saved.companies = [];
      if (!saved.factures) saved.factures = [];
      if (!saved.proClients) saved.proClients = [];
      // Dimensionnement v2 : référentiel d'irradiation + squelette de specs
      // matériel. Les sites du seed absents localement sont ajoutés, sans
      // toucher à ceux que le gérant a complétés (productible PVGIS saisi).
      if (!saved.irradiationSites) saved.irradiationSites = IRRADIATION_SITES;
      else {
        const connus = new Set(saved.irradiationSites.map((s) => s.id));
        const nouveaux = IRRADIATION_SITES.filter((s) => !connus.has(s.id));
        if (nouveaux.length) saved.irradiationSites = [...saved.irradiationSites, ...nouveaux];
      }
      saved.products = withSpecsAll(saved.products || []);
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
