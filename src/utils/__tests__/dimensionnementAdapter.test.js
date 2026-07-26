import { describe, it, expect } from 'vitest';
import { construireEntrees, dimensionnerDepuisWizard, estAncienneMethodologie, moteurVersionDe } from '../dimensionnementAdapter';
import { withSpecs, specsDepuisDesignation, specsManquantes, onduleurPourMoteur, panneauPourMoteur } from '../materielSpecs';
import { PARAMETRES_DEFAUT } from '../../components/dimensionnement/ParametresProjet';

const PRODUITS = [
  { id: 'p1', name: 'Panneau solaire monocristallin 620W', category: 'panneaux', basePrice: 95000 },
  { id: 'o1', name: 'Onduleur hybride 5kVA 48V', category: 'onduleurs', basePrice: 580000 },
  { id: 'o2', name: 'Onduleur hybride 8kVA 48V', category: 'onduleurs', basePrice: 980000 },
  { id: 'b1', name: 'Batterie lithium 5kwh 48V', category: 'batteries', basePrice: 850000 },
  { id: 'x1', name: 'Câble PV 4mm²', category: 'accessoires', basePrice: 500 },
];

const SITE = {
  nom: 'Parakou',
  productibleMensuel: [5.1, 5.3, 5.2, 4.9, 4.7, 4.3, 4.0, 3.9, 4.4, 4.8, 5.0, 5.0],
  source: 'PVGIS',
};

const CHARGES = [
  { rowId: 1, nom: 'Climatiseur', puissanceW: 1100, quantite: 2, heuresJour: 3, heuresNuit: 4, demarrage: true },
  { rowId: 2, nom: 'Éclairage LED', puissanceW: 10, quantite: 12, heuresJour: 0, heuresNuit: 5 },
];

describe('extraction des caractéristiques matériel', () => {
  it('déduit la puissance crête d’un panneau depuis sa désignation', () => {
    expect(specsDepuisDesignation(PRODUITS[0])).toEqual({ puissanceWc: 620 });
  });

  it('convertit les kVA en watts à facteur de puissance 1 (jamais × 800)', () => {
    expect(specsDepuisDesignation(PRODUITS[1])).toEqual({ puissanceW: 5000 });
    expect(specsDepuisDesignation(PRODUITS[2])).toEqual({ puissanceW: 8000 });
    expect(onduleurPourMoteur(PRODUITS[1]).puissanceW).toBe(5000);
  });

  it('déduit la capacité d’une batterie', () => {
    expect(specsDepuisDesignation(PRODUITS[3])).toEqual({ capaciteKwh: 5 });
  });

  it('n’invente aucune valeur de fiche constructeur', () => {
    const p = withSpecs(PRODUITS[0]);
    expect(p.specs.puissanceWc).toBe(620);
    // Voc, Vmp, Isc, Imp restent à renseigner depuis la fiche constructeur.
    expect(p.specs.voc).toBeNull();
    expect(specsManquantes(p).sort()).toEqual(['imp', 'isc', 'vmp', 'voc']);
    // Les coefficients de température sont normatifs, donc posés par défaut.
    expect(p.specs.coeffVoc).toBe(-0.27);
  });

  it('ne touche pas aux produits hors périmètre', () => {
    expect(withSpecs(PRODUITS[4]).specs).toBeUndefined();
  });

  it('laisse la saisie manuelle prioritaire sur les valeurs déduites', () => {
    const saisi = { ...PRODUITS[0], specs: { voc: 41.5, puissanceWc: 615 } };
    const p = withSpecs(saisi);
    expect(p.specs.voc).toBe(41.5);
    expect(p.specs.puissanceWc).toBe(615); // la saisie prime sur « 620W » du nom
  });

  it('expose le panneau au format attendu par le moteur', () => {
    expect(panneauPourMoteur(PRODUITS[0])).toMatchObject({ puissanceWc: 620, coeffVmp: -0.35 });
  });
});

describe('construction des entrées du moteur', () => {
  const entrees = construireEntrees({
    charges: CHARGES,
    params: { ...PARAMETRES_DEFAUT, siteId: 'site-parakou' },
    site: SITE,
    products: PRODUITS,
    kit: { name: 'Kit 20 kWh', panels: 8, panelW: 620, battery: 16, batteryModules: [{ capacity: 16, qty: 2 }] },
  });

  it('reprend les charges et les paramètres de projet', () => {
    expect(entrees.equipements).toHaveLength(2);
    expect(entrees.strategieIrradiation).toBe('mois-defavorable');
    expect(entrees.baseAutonomie).toBe('nuit');
    expect(entrees.coefficientSimultaneite).toBe(0.75);
    expect(entrees.distances).toEqual(PARAMETRES_DEFAUT.distances);
  });

  it('impose le matériel du kit (panneaux et capacité de module)', () => {
    expect(entrees.materiel.nbPanneauxImpose).toBe(8);
    expect(entrees.materiel.kitNom).toBe('Kit 20 kWh');
    expect(entrees.materiel.panneau.puissanceWc).toBe(620);
    expect(entrees.materiel.batterie.capaciteKwh).toBe(16);
  });

  it('transmet tout le catalogue d’onduleurs (le moteur choisit sur les charges)', () => {
    expect(entrees.materiel.catalogueOnduleurs.map((o) => o.puissanceW).sort()).toEqual([5000, 8000]);
  });

  it('synthétise deux charges en saisie directe, pointe saisie faisant foi', () => {
    const e = construireEntrees({
      charges: [], params: PARAMETRES_DEFAUT, site: SITE, products: PRODUITS,
      consommationDirecte: { jourKwh: 6, nuitKwh: 4, puissanceSimultanee: 3000 },
    });
    expect(e.equipements).toHaveLength(2);
    expect(e.coefficientSimultaneite).toBe(1); // la valeur saisie EST la pointe
    const r = dimensionnerDepuisWizard({
      charges: [], params: PARAMETRES_DEFAUT, site: SITE, products: PRODUITS,
      consommationDirecte: { jourKwh: 6, nuitKwh: 4, puissanceSimultanee: 3000 },
    });
    expect(r.consommation.jourKwh).toBeCloseTo(6, 2);
    expect(r.consommation.nuitKwh).toBeCloseTo(4, 2);
    expect(r.consommation.puissanceSimultanee).toBe(3000);
  });

  it('produit un dimensionnement complet de bout en bout', () => {
    const r = dimensionnerDepuisWizard({
      charges: CHARGES,
      params: { ...PARAMETRES_DEFAUT, siteId: 'site-parakou' },
      site: SITE,
      products: PRODUITS,
      kit: { name: 'Kit 20 kWh', panels: 8, panelW: 620, battery: 16, batteryModules: [{ capacity: 16, qty: 2 }] },
    });
    expect(r.moteurVersion).toBe('v2');
    expect(r.irradiation.moisNom).toBe('août');
    expect(r.pv.puissanceInstalleeW).toBe(8 * 620);
    // Charges : 2 × 1 100 + 12 × 10 = 2 320 W crête → 1 740 W simultanés
    expect(r.consommation.puissanceSimultanee).toBe(1740);
    // 1 740 × 1,2 = 2 088 W → le 5 kVA suffit, le 8 kVA n'est pas imposé.
    expect(r.onduleur.retenu.puissanceW).toBe(5000);
    // Specs constructeur absentes → vérifications strings non réalisables, signalé.
    expect(r.verifications.strings.possible).toBeNull();
    expect(r.alertes.map((a) => a.code)).toContain('specs-manquantes');
  });
});

describe('version de moteur d’un dimensionnement enregistré', () => {
  it('considère l’absence de marqueur comme de la v1', () => {
    expect(moteurVersionDe({ numberOfPanels: 8 })).toBe('v1');
    expect(estAncienneMethodologie({ numberOfPanels: 8 })).toBe(true);
    expect(estAncienneMethodologie(undefined)).toBe(true);
  });

  it('reconnaît un enregistrement v2', () => {
    expect(estAncienneMethodologie({ moteurVersion: 'v2' })).toBe(false);
  });
});
