// Le catalogue est une donnée saisie à la main, reprise de PDF fournisseurs :
// une photo mal nommée ou une catégorie inventée ne casse aucun test métier —
// elle se voit en boutique, sur une fiche produit vide, souvent trop tard.
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { catalogueProducts } from '../../data/catalogue';
import { productCategories } from '../../data/seed';

const CATEGORIES = new Set(productCategories.map((c) => c.id));

describe('catalogue produits', () => {
  it('n’a aucun identifiant en double : un doublon écrase l’autre au panier', () => {
    const ids = catalogueProducts.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('range chaque produit dans une catégorie qui existe', () => {
    const inconnues = catalogueProducts
      .filter((p) => !CATEGORIES.has(p.category))
      .map((p) => `${p.id} → ${p.category}`);
    expect(inconnues).toEqual([]);
  });

  it('a une photo réellement présente pour chaque produit', () => {
    const absentes = catalogueProducts
      .filter((p) => !existsSync(new URL(`../../../public${p.image}`, import.meta.url)))
      .map((p) => `${p.id} → ${p.image}`);
    expect(absentes).toEqual([]);
  });

  it('a un prix partenaire strictement positif et entier', () => {
    const mauvais = catalogueProducts
      .filter((p) => !Number.isInteger(p.basePrice) || p.basePrice <= 0)
      .map((p) => `${p.id} → ${p.basePrice}`);
    expect(mauvais).toEqual([]);
  });

  it('nomme et décrit chaque produit', () => {
    const vides = catalogueProducts
      .filter((p) => !p.name?.trim() || !p.description?.trim())
      .map((p) => p.id);
    expect(vides).toEqual([]);
  });
});
