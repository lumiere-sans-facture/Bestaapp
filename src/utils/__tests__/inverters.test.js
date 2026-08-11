import { describe, it, expect } from 'vitest';
import { SOLAR_KITS } from '../../data/kits';
import { INVERTER_MODELS } from '../../data/inverters';
import { normaliserOnduleur, onduleurEstValide, resumeOnduleur, dupliquerOnduleur } from '../inverters';
import { buildKitQuotation, suggestInverterFor, puissanceSortie, limitePv, SIZING_PARAMS } from '../solarSizing';

describe('normaliserOnduleur / onduleurEstValide', () => {
  it('coerce les champs texte du formulaire en nombres', () => {
    const o = normaliserOnduleur({ brand: ' Growatt ', model: ' SPF 5000TL ', capacity: '5', maxPvPower: '6500', price: '580000', efficiency: '96' });
    expect(o).toMatchObject({ brand: 'Growatt', model: 'SPF 5000TL', capacity: 5, maxPvPower: 6500, price: 580000, efficiency: 96 });
  });

  it('est invalide sans modèle, capacité, prix ou puissance PV max', () => {
    expect(onduleurEstValide({ model: 'SPF 5000TL', capacity: 5, maxPvPower: 6500, price: 580000 })).toBe(true);
    expect(onduleurEstValide({ model: '', capacity: 5, maxPvPower: 6500, price: 580000 })).toBe(false);
    expect(onduleurEstValide({ model: 'SPF 5000TL', capacity: 0, maxPvPower: 6500, price: 580000 })).toBe(false);
    expect(onduleurEstValide({ model: 'SPF 5000TL', capacity: 5, maxPvPower: 0, price: 580000 })).toBe(false);
    expect(onduleurEstValide({ model: 'SPF 5000TL', capacity: 5, maxPvPower: 6500, price: 0 })).toBe(false);
  });

  it('resumeOnduleur assemble capacité, puissance PV max et rendement', () => {
    expect(resumeOnduleur({ capacity: 5, maxPvPower: 6500, efficiency: 96 })).toBe('5 kVA · PV max 6500 Wc · rendement 96%');
  });

  it('dupliquerOnduleur change l’id et suffixe le modèle', () => {
    const o = { id: 'a', model: 'SPF 5000TL', capacity: 5 };
    const copie = dupliquerOnduleur(o);
    expect(copie.id).not.toBe('a');
    expect(copie.model).toBe('SPF 5000TL (copie)');
    expect(copie.capacity).toBe(5);
  });

  it('chaque onduleur du seed est valide et a une vraie puissance PV max', () => {
    for (const o of INVERTER_MODELS) {
      expect(onduleurEstValide(o)).toBe(true);
      // La puissance PV max doit dépasser la capacité kVA nominale (sortie AC) :
      // sinon le champ ne veut rien dire (entrée PV ≤ sortie n'a pas de sens).
      expect(o.maxPvPower).toBeGreaterThan(o.capacity * 1000);
    }
  });
});

describe('suggestInverterFor — pic de consommation puis capacité PV', () => {
  const inverters = [
    { id: 'i3', capacity: 3, maxPvPower: 3900 },
    { id: 'i5', capacity: 5, maxPvPower: 6500 },
    { id: 'i8', capacity: 8, maxPvPower: 10400 },
  ];

  it('la puissance de sortie se déduit des kVA (facteur de puissance 0,8)', () => {
    expect(puissanceSortie({ capacity: 3 })).toBe(2400);
    expect(puissanceSortie({ capacity: 5 })).toBe(4000);
    // Une puissance de sortie explicite prime sur la déduction.
    expect(puissanceSortie({ capacity: 5, maxPower: 4600 })).toBe(4600);
  });

  it('choisit le plus petit onduleur qui TIENT LE PIC, marge comprise', () => {
    // Pic 2 000 W × 1,2 = 2 400 W → le 3 kVA (2 400 W) suffit tout juste.
    expect(suggestInverterFor(inverters, { peakLoad: 2000, pvPower: 3000 }).id).toBe('i3');
    // Pic 2 660 W × 1,2 = 3 192 W → le 3 kVA ne tient plus, le 5 kVA oui.
    expect(suggestInverterFor(inverters, { peakLoad: 2660, pvPower: 3000 }).id).toBe('i5');
  });

  it('le pic prime sur les panneaux : peu de PV mais gros pic → gros onduleur', () => {
    const choisi = suggestInverterFor(inverters, { peakLoad: 4000, pvPower: 1000 });
    expect(choisi.id).toBe('i8'); // 5 kVA = 4 000 W < 4 800 W requis
    expect(puissanceSortie(choisi)).toBeGreaterThanOrEqual(4000 * SIZING_PARAMS.inverterMargin);
  });

  it('écarte un onduleur qui n’accepte pas la puissance PV installée', () => {
    // Pic modeste (le 3 kVA suffirait) mais 5 000 Wc de panneaux : le 3 kVA
    // n'en prend que 3 900, le 5 kVA (6 500 Wc) est retenu.
    const choisi = suggestInverterFor(inverters, { peakLoad: 1500, pvPower: 5000 });
    expect(choisi.id).toBe('i5');
    expect(choisi.maxPvPower).toBeGreaterThanOrEqual(5000);
  });

  it('sans pic déclaré (saisie directe), la puissance PV sert de repère', () => {
    expect(suggestInverterFor(inverters, { peakLoad: 0, pvPower: 4000 }).id).toBe('i8');
  });

  it('limite PV inconnue : reprise de celle d’un modèle configuré de même calibre', () => {
    const sansPv = { id: 'x5', capacity: 5 };
    expect(limitePv(sansPv, inverters)).toBe(6500);
    expect(limitePv({ id: 'x9', capacity: 9 }, inverters)).toBe(0); // aucune référence
  });

  it('retombe sur le plus grand disponible si aucun ne convient, et gère la liste vide', () => {
    expect(suggestInverterFor(inverters, { peakLoad: 20000 }).id).toBe('i8');
    expect(suggestInverterFor([], { peakLoad: 4000 })).toBeNull();
  });
});

describe('buildKitQuotation — remplacement automatique de l’onduleur', () => {
  it('remplace la ligne « Onduleur » si celui du kit ne prend pas assez de panneaux', () => {
    // Kit 2,5 kWh Eco : onduleur 3 kVA (INVERTER_MODELS: hz-3kva, PV max 3900 W).
    const kit = SOLAR_KITS.find((k) => k.id === 'kit-2.5kwh-eco');
    expect(kit.inverter).toBe(3);
    // Besoin bien au-delà de ce que 3 kVA (3900 W PV max) encaisse même avec marge.
    const sizing = { requiredPanelPower: 8000 };
    const q = buildKitQuotation(kit, 'tole', true, sizing, INVERTER_MODELS);
    expect(q.inverterSuggested).not.toBeNull();
    expect(q.inverterSuggested.capacity).toBeGreaterThan(3);
    const ligneOnduleur = q.components.find((c) => /onduleur/i.test(c.name));
    expect(ligneOnduleur.name).toContain(`${q.inverterSuggested.capacity}kVA`);
    expect(ligneOnduleur.unitPrice).toBe(
      INVERTER_MODELS.find((o) => o.id === q.inverterSuggested.id).price
    );
  });

  it('ne touche pas à l’onduleur du kit s’il suffit déjà', () => {
    const kit = SOLAR_KITS.find((k) => k.id === 'kit-2.5kwh-eco'); // 3 kVA, PV max 3900 W
    const sizing = { requiredPanelPower: 1000 }; // largement couvert
    const q = buildKitQuotation(kit, 'tole', true, sizing, INVERTER_MODELS);
    expect(q.inverterSuggested).toBeNull();
    const ligneOnduleur = q.components.find((c) => /onduleur/i.test(c.name));
    expect(ligneOnduleur.name).toBe(kit.lines.find((l) => /onduleur/i.test(l.designation)).designation);
  });

  it('ne touche à rien si la capacité du kit ne correspond à aucun onduleur configuré', () => {
    // Onduleur 10 kVA — absent d'INVERTER_MODELS (3 et 6 kVA seulement, repris
    // des kits officiels) : impossible de vérifier, la ligne du kit reste inchangée.
    const kit = { ...SOLAR_KITS.find((k) => k.id === 'kit-5kwh'), inverter: 10 };
    const sizing = { requiredPanelPower: 50000 }; // besoin énorme, sans effet ici
    const q = buildKitQuotation(kit, 'tole', true, sizing, INVERTER_MODELS);
    expect(q.inverterSuggested).toBeNull();
  });

  it('sans liste d’onduleurs fournie, aucun remplacement (comportement par défaut inchangé)', () => {
    const kit = SOLAR_KITS.find((k) => k.id === 'kit-2.5kwh-eco');
    const sizing = { requiredPanelPower: 8000 };
    const q = buildKitQuotation(kit, 'tole', true, sizing); // 5e paramètre omis
    expect(q.inverterSuggested).toBeNull();
  });
});
