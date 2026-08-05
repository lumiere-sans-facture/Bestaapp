// État applicatif : forme initiale, chargement depuis localStorage (avec
// migrations de seed) et persistance. Aucune dépendance React — logique pure.
import * as seed from '../data/seed';
import { SOLAR_KITS } from '../data/kits';
import { isSupabaseConfigured } from '../lib/supabase';
import { generatePartnerCode, codeBaseFromName } from '../utils/referral';

export const STORAGE_KEY = 'bestasolar_data';

// Clé de stockage par PÉRIMÈTRE de compte. En mode SaaS (backend configuré),
// le cache local est séparé par organisation : sans cela, deux comptes
// utilisés sur le même appareil partageraient leurs données — et la sync
// pousserait celles du premier dans l'entreprise du second (fuite croisée).
// En mode local (démo, sans backend), la clé historique est conservée.
const keyFor = (scope) => (scope ? `${STORAGE_KEY}_${scope}` : STORAGE_KEY);

export const buildInitialState = () => ({
  version: seed.SEED_VERSION,
  // Backend configuré (mode SaaS) : une nouvelle entreprise démarre SANS
  // données de démonstration ni catalogue — le catalogue est l'actif interne
  // BestaSolar, reçu du serveur en lecture partagée (jamais copié). Seuls les
  // cours de formation sont dotés.
  // Mode local (sans backend) : jeu de démonstration complet, comme avant.
  leads: isSupabaseConfigured ? [] : seed.leads,
  products: isSupabaseConfigured ? [] : seed.products,
  partners: isSupabaseConfigured ? [] : seed.partners,
  commissions: isSupabaseConfigured ? [] : seed.commissions,
  devis: [],
  referrals: [],
  orders: [],
  // Les kits sont dotés partout, y compris en SaaS — contrairement au
  // catalogue boutique. L'assistant de devis solaire ne propose QUE des kits :
  // démarrer à zéro le rendrait inutilisable. Ils appartiennent ensuite à
  // l'entreprise, qui les modifie depuis « Mes kits ».
  kits: SOLAR_KITS,
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

export const loadState = (scope = null) => {
  try {
    const saved = JSON.parse(localStorage.getItem(keyFor(scope)));
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
      // Migration « Mes kits » : les kits vivaient dans le code, ils passent
      // dans l'état pour devenir modifiables. Dotation UNE SEULE FOIS — ne
      // jamais réinjecter ensuite, sinon un kit supprimé par le gérant
      // reviendrait à chaque ouverture de l'application.
      if (!Array.isArray(saved.kits)) saved.kits = SOLAR_KITS;
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

/**
 * Écrit l'état dans localStorage. Retourne `false` si l'écriture a échoué
 * (quota dépassé — typiquement des photos produits volumineuses — ou
 * navigation privée). L'appelant DOIT en avertir l'utilisateur : sans cela,
 * l'app continue de fonctionner à l'écran alors que plus rien n'est
 * enregistré, et tout est perdu à la fermeture.
 */
export const persist = (state, scope = null) => {
  try {
    localStorage.setItem(keyFor(scope), JSON.stringify(state));
    return true;
  } catch {
    return false; // quota dépassé / navigation privée
  }
};
