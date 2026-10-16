// Produits Deye importés (scripts/scrape_deye.py importer → data/catalogueDeye.js) :
// en brouillon, au prix client validé lors du dry-run, sans doublon avec le
// catalogue officiel, et invisibles du dimensionnement tant qu'ils ne sont
// pas publiés.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { produitsDeye } = await import('../../data/catalogueDeye');
const { catalogueProducts } = await import('../../data/catalogue');
const seed = await import('../../data/seed');
const { loadState, STORAGE_KEY } = await import('../../context/dataState');
const { prixPublic } = await import('../price');
const { produitsPublies, estBrouillon } = await import('../publication');
const { inverterOptionsFromCatalog, batteryOptionsFromCatalog } = await import('../solarSizing');

const racine = new URL('../../../', import.meta.url);
const dryRun = JSON.parse(readFileSync(new URL('deye_import/products.json', racine), 'utf8'));
const prixDryRun = new Map(dryRun.map((p) => [p.sku, p.prix_fcfa]));
const modele = (p) => (p.description.match(/Modèle\s+([^·]+)/)?.[1] || '').trim().toUpperCase();

beforeEach(() => store.clear());

describe('catalogue Deye importé', () => {
  it('29 produits, tous en brouillon, identifiants et SKU uniques', () => {
    expect(produitsDeye).toHaveLength(29);
    expect(produitsDeye.every(estBrouillon)).toBe(true);
    expect(new Set(produitsDeye.map((p) => p.id)).size).toBe(29);
    expect(new Set(produitsDeye.map((p) => p.sku)).size).toBe(29);
    for (const p of produitsDeye) {
      expect(p.id).toMatch(/^deye-[a-z0-9-]+$/);
      expect(p.sku).toMatch(/^DEYE-/);
    }
  });

  it('aucun identifiant ni modèle en double avec le catalogue officiel', () => {
    const ids = new Set(catalogueProducts.map((p) => p.id));
    expect(produitsDeye.filter((p) => ids.has(p.id))).toEqual([]);
    const modelesOfficiels = new Set(catalogueProducts.map(modele).filter(Boolean));
    expect(produitsDeye.filter((p) => modelesOfficiels.has(modele(p)))).toEqual([]);
    // Les trois déjà vendus par BestaSolar ne sont pas réimportés.
    const skus = produitsDeye.map((p) => p.sku);
    for (const sku of ['DEYE-SUN-20K-SG05LP3-EU-SM2', 'DEYE-BOS-G-PDU-2', 'DEYE-BOS-G-PACK5.1']) expect(skus).not.toContain(sku);
  });

  it('le prix public affiché est le prix converti du dry-run (au pire 1 F au-dessus, jamais en dessous)', () => {
    for (const p of produitsDeye) {
      const attendu = prixDryRun.get(p.sku);
      expect(attendu, p.sku).toBeGreaterThan(0);
      const ecart = prixPublic(p.basePrice) - attendu;
      expect(ecart, p.sku).toBeGreaterThanOrEqual(0);
      expect(ecart, p.sku).toBeLessThanOrEqual(1);
    }
  });

  it('rangés dans les catégories existantes de la boutique', () => {
    const categories = new Set(seed.productCategories.map((c) => c.id));
    for (const p of produitsDeye) expect(categories.has(p.category), p.sku).toBe(true);
    const parCategorie = (c) => produitsDeye.filter((p) => p.category === c).length;
    expect([parCategorie('onduleurs'), parCategorie('batteries'), parCategorie('accessoires'), parCategorie('controleurs')]).toEqual([13, 7, 8, 1]);
  });

  it('textes sans mention de la source, du pays ni de sa monnaie, et sans anglais résiduel', () => {
    for (const p of produitsDeye) {
      const texte = `${p.name} ${p.description} ${p.presentation}`;
      expect(texte, p.sku).not.toMatch(/fouani|nig[eé]ria|naira|₦|\bNGN\b/i);
      expect(texte, p.sku).not.toMatch(/\b(from|to|with|and)\b|[~～]/);
    }
  });

  it('les onduleurs réseau (string) ne se disent pas « batterie »', () => {
    for (const p of produitsDeye.filter((x) => /réseau \(string\)/.test(x.name))) {
      expect(p.description, p.sku).not.toMatch(/batterie/i);
    }
  });

  it('chaque produit a son image dans public/products', () => {
    for (const p of produitsDeye) {
      expect(p.image).toBe(`/products/${p.id}.jpg`);
      expect(existsSync(new URL(`public${p.image}`, racine)), p.image).toBe(true);
    }
  });
});

describe('dotation et brouillon', () => {
  it('un appareil déjà installé reçoit les produits Deye, en brouillon', () => {
    store.set(STORAGE_KEY, JSON.stringify({
      version: seed.SEED_VERSION,
      products: catalogueProducts,
      partners: [], referrals: [], orders: [], formations: [], formationProgress: [], kits: [],
    }));
    const produits = loadState().products;
    const recus = produits.filter((p) => p.id.startsWith('deye-'));
    expect(recus).toHaveLength(29);
    expect(recus.every(estBrouillon)).toBe(true);
    expect(new Set(produits.map((p) => p.id)).size).toBe(produits.length);
  });

  it('tant qu’ils sont en brouillon, le dimensionnement ne les voit pas', () => {
    const publies = produitsPublies(seed.products);
    expect(publies).toHaveLength(catalogueProducts.length);
    expect(inverterOptionsFromCatalog(publies)).toEqual(inverterOptionsFromCatalog(catalogueProducts));
    expect(batteryOptionsFromCatalog(publies)).toEqual(batteryOptionsFromCatalog(catalogueProducts));
  });
});
