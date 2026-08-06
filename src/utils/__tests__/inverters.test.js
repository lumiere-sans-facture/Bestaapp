import { describe, it, expect } from 'vitest';
import { SOLAR_KITS } from '../../data/kits';
import { INVERTER_MODELS } from '../../data/inverters';
import { normaliserOnduleur, onduleurEstValide, resumeOnduleur, dupliquerOnduleur } from '../inverters';
import { buildKitQuotation, suggestInverterForPower, SIZING_PARAMS } from '../solarSizing';

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

describe('suggestInverterForPower', () => {
  const inverters = [
    { id: 'i3', capacity: 3, maxPvPower: 3900 },
    { id: 'i5', capacity: 5, maxPvPower: 6500 },
    { id: 'i8', capacity: 8, maxPvPower: 10400 },
  ];

  it('suggère le plus petit onduleur dont la puissance PV max couvre le besoin + marge', () => {
    // Besoin 4000 W × marge 1.2 = 4800 W → l'onduleur 3kVA (3900 W) ne suffit pas, le 5kVA (6500 W) oui.
    expect(suggestInverterForPower(inverters, 4000).id).toBe('i5');
  });

  it('ne suggère jamais un onduleur dont la puissance PV max est insuffisante quand un autre convient', () => {
    expect(suggestInverterForPower(inverters, 4000).maxPvPower).toBeGreaterThanOrEqual(4000 * SIZING_PARAMS.inverterMargin);
  });

  it('retombe sur le plus grand disponible si aucun ne couvre le besoin', () => {
    expect(suggestInverterForPower(inverters, 20000).id).toBe('i8');
  });

  it('gère une liste vide', () => {
    expect(suggestInverterForPower([], 4000)).toBeNull();
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
