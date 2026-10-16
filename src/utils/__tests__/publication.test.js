import { describe, it, expect } from 'vitest';
import { estBrouillon, produitsPublies, voitLesBrouillons, produitsBoutique } from '../publication';

const publie = { id: 'a', name: 'Onduleur publié' };
const brouillon = { id: 'b', name: 'Onduleur importé', brouillon: true };
const brouillonRecu = { id: 'c', name: 'Brouillon d’une autre organisation', brouillon: true, partage: true };
const publieRecu = { id: 'd', name: 'Produit partagé publié', partage: true };

describe('statut brouillon des produits', () => {
  it('seul brouillon: true fait un brouillon', () => {
    expect(estBrouillon(brouillon)).toBe(true);
    expect(estBrouillon(publie)).toBe(false);
    expect(estBrouillon({ brouillon: false })).toBe(false);
    expect(estBrouillon(undefined)).toBe(false);
  });

  it('les produits publiés excluent les brouillons, et rendent la même liste sans brouillon', () => {
    expect(produitsPublies([publie, brouillon, publieRecu])).toEqual([publie, publieRecu]);
    const liste = [publie, publieRecu];
    expect(produitsPublies(liste)).toBe(liste);
  });
});

describe('qui voit les brouillons', () => {
  it('le gérant sans organisation (mode local) ou de l’organisation interne', () => {
    expect(voitLesBrouillons({ role: 'gerant' })).toBe(true);
    expect(voitLesBrouillons({ role: 'gerant', org_id: 'o1', org: { kind: 'interne' } })).toBe(true);
  });

  it('jamais un technicien, ni le gérant d’une entreprise Pro, ni un type inconnu', () => {
    expect(voitLesBrouillons({ role: 'technicien' })).toBe(false);
    expect(voitLesBrouillons({ role: 'gerant', org_id: 'o2', org: { kind: 'pro' } })).toBe(false);
    expect(voitLesBrouillons({ role: 'gerant', org_id: 'o3' })).toBe(false);
    expect(voitLesBrouillons(null)).toBe(false);
  });
});

describe('produits affichés en boutique', () => {
  const catalogue = [publie, brouillon, brouillonRecu, publieRecu];

  it('sans droit : rien que les produits publiés', () => {
    expect(produitsBoutique(catalogue)).toEqual([publie, publieRecu]);
  });

  it('gérant du catalogue : ses brouillons en plus, jamais ceux reçus d’une autre organisation', () => {
    expect(produitsBoutique(catalogue, { brouillons: true })).toEqual([publie, brouillon, publieRecu]);
  });
});
