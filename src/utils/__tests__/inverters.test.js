import { describe, it, expect } from 'vitest';
import { SOLAR_KITS } from '../../data/kits';
import { INVERTER_MODELS } from '../../data/inverters';
import { normaliserOnduleur, onduleurEstValide, resumeOnduleur, dupliquerOnduleur } from '../inverters';
import {
  buildKitQuotation, suggestInverterFor, puissanceSortie, limitePv, resoudreOnduleur,
  calibreRequis, sortieOnduleurRequise, onduleurSuffisant, onduleurTientLePic,
  onduleurAccepteLePv, designationOnduleur, calculateSystemSize, SIZING_PARAMS,
} from '../solarSizing';

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
    expect(resumeOnduleur({ capacity: 5, maxPvPower: 6500, efficiency: 96 })).toBe('5 kVA · PV max 6500 Wc · parallèle ×2 max · rendement 96%');
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

describe('designationOnduleur — jamais deux fois le même nom', () => {
  it('n’ajoute pas « Onduleur hybride n kVA » devant un modèle qui le dit déjà', () => {
    // Les modèles configurés s'appellent « Onduleur hybride 6kVA » : préfixer
    // produisait « Onduleur hybride 6kVA Deye Onduleur hybride 6kVA ».
    expect(designationOnduleur({ brand: 'Deye', model: 'Onduleur hybride 6kVA', capacity: 6 }))
      .toBe('Onduleur hybride 6kVA Deye');
  });

  it('n’ajoute pas la marque si le modèle la porte déjà (catalogue boutique)', () => {
    expect(designationOnduleur({ brand: 'Growatt', model: 'Onduleur Hybride 6kva Growatt', capacity: 6 }))
      .toBe('Onduleur Hybride 6kva Growatt');
  });

  it('compose un nom complet quand le modèle est nu', () => {
    expect(designationOnduleur({ brand: 'Deye', model: 'SUN-8K', capacity: 8 }))
      .toBe('Onduleur hybride 8kVA SUN-8K Deye');
    expect(designationOnduleur({ capacity: 5, model: '', brand: '' })).toBe('Onduleur hybride 5kVA');
  });
});

describe('suggestInverterFor — pic de consommation puis capacité PV', () => {
  const inverters = [
    { id: 'i3', capacity: 3, maxPvPower: 3900 },
    { id: 'i5', capacity: 5, maxPvPower: 6500 },
    { id: 'i8', capacity: 8, maxPvPower: 10400 },
  ];

  it('un hybride étiqueté « n kVA » délivre n kW', () => {
    // Les modèles vendus ici sont étiquetés en kVA mais tiennent autant de kW.
    expect(puissanceSortie({ capacity: 3 })).toBe(3000);
    expect(puissanceSortie({ capacity: 8 })).toBe(8000);
    // Une puissance de sortie explicite prime toujours sur la déduction.
    expect(puissanceSortie({ capacity: 5, maxPower: 4600 })).toBe(4600);
  });

  it('choisit le plus petit onduleur qui TIENT LE PIC, marge comprise', () => {
    // Pic 2 500 W × 1,2 = 3 000 W → le 3 kVA (3 000 W) suffit tout juste.
    expect(suggestInverterFor(inverters, { peakLoad: 2500, pvPower: 3000 }).id).toBe('i3');
    // Pic 2 660 W × 1,2 = 3 192 W → le 3 kVA ne tient plus, le 5 kVA oui.
    expect(suggestInverterFor(inverters, { peakLoad: 2660, pvPower: 3000 }).id).toBe('i5');
  });

  it('le pic prime sur les panneaux : peu de PV mais gros pic → gros onduleur', () => {
    const choisi = suggestInverterFor(inverters, { peakLoad: 5000, pvPower: 1000 });
    expect(choisi.id).toBe('i8'); // 5 kVA = 5 000 W < 6 000 W requis
    expect(puissanceSortie(choisi)).toBeGreaterThanOrEqual(5000 * SIZING_PARAMS.inverterMargin);
  });

  it('écarte un onduleur qui n’accepte pas la puissance PV installée', () => {
    // Pic modeste (le 3 kVA suffirait) mais 5 000 Wc de panneaux : le 3 kVA
    // n'en prend que 3 900, le 5 kVA (6 500 Wc) est retenu.
    const choisi = suggestInverterFor(inverters, { peakLoad: 1500, pvPower: 5000 });
    expect(choisi.id).toBe('i5');
    expect(choisi.maxPvPower).toBeGreaterThanOrEqual(5000);
  });

  it('sans pic déclaré (saisie directe), la puissance PV sert de repère', () => {
    expect(suggestInverterFor(inverters, { peakLoad: 0, pvPower: 4000 }).id).toBe('i5'); // 4 000 × 1,2
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

describe('aucun onduleur disponible ne convient : le dire, pas le taire', () => {
  const petits = [
    { id: 'o3', capacity: 3, maxPvPower: 3900 },
    { id: 'o6', capacity: 6, maxPvPower: 7800 },
  ];

  it('calcule la sortie exigée et le calibre du marché correspondant', () => {
    // Pic 6 600 W × 1,2 = 7 920 W → un 6 kVA (6 000 W) ne suffit pas ; un
    // 8 kVA (8 000 W) fait l'affaire, inutile de monter à 10.
    expect(sortieOnduleurRequise(6600)).toBe(7920);
    expect(calibreRequis(7920)).toBe(8);
    expect(calibreRequis(2400)).toBe(3);
  });

  it('onduleurSuffisant refuse le repli sous-calibré', () => {
    const choisi = suggestInverterFor(petits, { peakLoad: 6600, pvPower: 5580 });
    expect(choisi.capacity).toBe(6); // repli : le plus grand disponible
    expect(onduleurSuffisant(choisi, { peakLoad: 6600, pvPower: 5580 })).toBe(false);
  });

  it('plutôt que d’échouer, monte à DEUX onduleurs en parallèle', () => {
    // Pic 6 600 W → 7 920 W exigés. Le catalogue s'arrête à 6 kVA (6 000 W) :
    // deux 6 kVA en parallèle fournissent 12 000 W et font l'affaire.
    const sizing = calculateSystemSize({ day: 20, night: 15 }, 'off-grid', 4.3, undefined, undefined, {
      peakLoad: 6600, inverters: petits,
    });
    expect(sizing.inverter.capacity).toBe(6);
    expect(sizing.inverterQuantite).toBe(2);
    expect(sizing.inverterSuffisant).toBe(true);
    // Le calibre d'un appareil SEUL reste annoncé pour information.
    expect(sizing.inverterCalibreRequis).toBe(8);
    expect(sizing.inverterSortieRequise).toBe(7920);
  });

  it('un seul appareil est préféré à deux dès qu’un modèle suffit', () => {
    const avecHuit = [...petits, { id: 'o8', capacity: 8, maxPvPower: 10400 }];
    const sizing = calculateSystemSize({ day: 20, night: 15 }, 'off-grid', 4.3, undefined, undefined, {
      peakLoad: 6600, inverters: avecHuit,
    });
    expect(sizing.inverter.capacity).toBe(8);
    expect(sizing.inverterQuantite).toBe(1);
  });

  it('un modèle supérieur SEUL passe avant le doublage de l’onduleur du kit', () => {
    // Cas relevé sur les onduleurs configurés de l'entreprise : kit en 6 kVA
    // (entrée PV 7 800 Wc), 11 780 Wc de panneaux posés, pic 5 000 W. Le
    // 6 kVA tient le pic mais pas les panneaux : deux en parallèle y
    // suffiraient — sauf qu'un seul 12 kVA (15 000 Wc) suffit aussi. Deux
    // boîtiers là où un seul convient, c'est un câblage et une facture de trop.
    const configures = [
      { id: 'o3', capacity: 3, maxPvPower: 3900, price: 300000 },
      { id: 'o6', capacity: 6, maxPvPower: 7800, price: 600000 },
      { id: 'o12', capacity: 12, maxPvPower: 15000, price: 1100000 },
    ];
    const critere = { peakLoad: 5000, pvPower: 11780, configures };
    const kitSix = configures.find((o) => o.capacity === 6);
    const retenu = resoudreOnduleur(configures, critere, { prefere: kitSix });
    expect(retenu.modele.capacity).toBe(12);
    expect(retenu.quantite).toBe(1);
    expect(retenu.suffisant).toBe(true);
  });

  it('l’onduleur du kit reste préféré tant qu’il suffit SEUL', () => {
    const configures = [
      { id: 'o6', capacity: 6, maxPvPower: 7800, price: 600000 },
      { id: 'o12', capacity: 12, maxPvPower: 15000, price: 1100000 },
    ];
    const retenu = resoudreOnduleur(configures, { peakLoad: 4000, pvPower: 7000, configures }, {
      prefere: configures[0],
    });
    expect(retenu.modele.capacity).toBe(6);
    expect(retenu.quantite).toBe(1);
  });

  it('on ne double qu’une fois tous les modèles seuls épuisés', () => {
    // Pic 13 000 W → 15 600 W exigés : aucun modèle seul ne tient. Deux
    // 12 kVA (24 000 W) sont alors légitimes.
    const configures = [
      { id: 'o6', capacity: 6, maxPvPower: 7800, price: 600000 },
      { id: 'o12', capacity: 12, maxPvPower: 15000, price: 1100000 },
    ];
    const retenu = resoudreOnduleur(configures, { peakLoad: 13000, pvPower: 11780, configures }, {
      prefere: configures[0],
    });
    expect(retenu.modele.capacity).toBe(12);
    expect(retenu.quantite).toBe(2);
    expect(retenu.suffisant).toBe(true);
  });

  it('deux appareils au maximum : au-delà, l’insuffisance est signalée', () => {
    const sizing = calculateSystemSize({ day: 20, night: 15 }, 'off-grid', 4.3, undefined, undefined, {
      peakLoad: 20000, inverters: petits, // 24 000 W exigés, 2 × 6 kVA = 12 000
    });
    expect(sizing.inverterQuantite).toBe(2);
    expect(sizing.inverterSuffisant).toBe(false);
    expect(sizing.inverterTientPic).toBe(false);
  });

  it('distingue les deux causes : puissance de sortie et entrée PV (MPPT)', () => {
    const gros = { id: 'o8', capacity: 8, maxPvPower: 10400 };
    // Le pic passe (8 000 W ≥ 6 000), mais 12 000 Wc de panneaux dépassent
    // l'entrée PV : c'est le MPPT qui bloque, pas la puissance de sortie.
    expect(onduleurTientLePic(gros, { peakLoad: 5000, pvPower: 12000 })).toBe(true);
    expect(onduleurAccepteLePv(gros, { pvPower: 12000 })).toBe(false);
    expect(onduleurSuffisant(gros, { peakLoad: 5000, pvPower: 12000 })).toBe(false);
    // Cas inverse : peu de panneaux mais un pic hors de portée.
    expect(onduleurTientLePic(gros, { peakLoad: 9000, pvPower: 3000 })).toBe(false);
    expect(onduleurAccepteLePv(gros, { pvPower: 3000 })).toBe(true);
  });

  it('le dimensionnement dit LAQUELLE des deux contraintes bloque', () => {
    // Pic modeste (deux 6 kVA le tiennent largement) mais un champ PV qui
    // dépasse même deux entrées PV cumulées : seul le MPPT coince.
    const sizing = calculateSystemSize({ day: 40, night: 25 }, 'off-grid', 4.3, undefined, undefined, {
      peakLoad: 3000, inverters: [{ id: 'o6', capacity: 6, maxPvPower: 7800 }],
    });
    expect(sizing.inverterTientPic).toBe(true);
    expect(sizing.inverterAcceptePv).toBe(false);
    expect(sizing.inverterSuffisant).toBe(false);
    expect(sizing.inverterPvMax).toBe(15600); // 2 × 7 800 Wc cumulés
    expect(sizing.installedPvPower).toBeGreaterThan(15600);
  });

  it('un catalogue suffisant ne déclenche aucune alerte', () => {
    const sizing = calculateSystemSize({ day: 2, night: 2 }, 'off-grid', 4.3, undefined, undefined, {
      peakLoad: 2000, inverters: petits,
    });
    expect(sizing.inverterSuffisant).toBe(true);
    expect(sizing.inverterTientPic).toBe(true);
    expect(sizing.inverterAcceptePv).toBe(true);
    expect(sizing.inverter.capacity).toBe(3);
  });
});

describe('buildKitQuotation — remplacement automatique de l’onduleur', () => {
  it('remplace la ligne « Onduleur » par un modèle PLUS GRAND DE LA MÊME TENSION', () => {
    // Kit 2,5 kWh Eco : batterie 24 V, onduleur 3 kVA (hz-3kva, PV max 3900 W).
    const kit = SOLAR_KITS.find((k) => k.id === 'kit-2.5kwh-eco');
    expect(kit.inverter).toBe(3);
    expect(kit.tension).toBe(24);
    // Un 5 kVA 24 V est configuré à côté des modèles 48 V.
    const cinq24 = { id: 'x-5kva-24', brand: 'Must', model: 'Onduleur hybride 5kVA', capacity: 5, maxPvPower: 6500, price: 420000, tension: 24 };
    // 5 000 Wc de panneaux : au-delà de l'entrée PV du 3 kVA (3 900 Wc).
    const sizing = { requiredPanelPower: 5000, installedPvPower: 5000, peakLoad: 2000 };
    const q = buildKitQuotation(kit, 'tole', true, sizing, [...INVERTER_MODELS, cinq24]);
    expect(q.inverterSuggested).toMatchObject({ id: 'x-5kva-24', quantite: 1 });
    const ligneOnduleur = q.components.find((c) => /onduleur/i.test(c.name));
    expect(ligneOnduleur.name).toContain('5kVA');
    // Le nom n'apparaît qu'une fois, marque comprise.
    expect(ligneOnduleur.name.match(/onduleur/gi)).toHaveLength(1);
    expect(ligneOnduleur.unitPrice).toBe(420000);
  });

  it('ne propose JAMAIS un onduleur 48 V pour un kit 24 V, même plus puissant', () => {
    // Seuls les modèles officiels : aucun onduleur 24 V au-dessus de 3 kVA.
    const kit = SOLAR_KITS.find((k) => k.id === 'kit-2.5kwh-eco');
    const sizing = { requiredPanelPower: 8000 };
    const q = buildKitQuotation(kit, 'tole', true, sizing, INVERTER_MODELS);
    const retenu = INVERTER_MODELS.find((o) => o.id === q.inverterSuggested?.id);
    expect(retenu?.tension).toBe(24);
    expect(q.components.some((c) => /6kVA|12kVA/i.test(c.name))).toBe(false);
    // Deux 3 kVA 24 V ne suffisent pas : l'écran doit le dire.
    expect(q.inverterInsuffisant).toBe(true);
    expect(q.tension).toBe(24);
  });

  it('un kit 48 V garde l’accès aux onduleurs 48 V', () => {
    const kit = SOLAR_KITS.find((k) => k.id === 'kit-32kwh'); // 48 V, 6 kVA
    const q = buildKitQuotation(kit, 'tole', true, { requiredPanelPower: 11780, installedPvPower: 11780, peakLoad: 5000 }, INVERTER_MODELS);
    expect(q.inverterSuggested).toMatchObject({ capacity: 12, quantite: 1 });
    expect(q.inverterInsuffisant).toBe(false);
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
