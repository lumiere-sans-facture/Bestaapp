import { describe, it, expect } from 'vitest';
import { buildKitQuotation } from '../solarSizing';
import { mainOeuvreEtendue, protectionAc, sectionCablePv, ordreEscalade, panneauxPourKit } from '../ajustementsKit';
import { buildDocHtml, MODELS } from '../docTemplates';
import { SOLAR_KITS } from '../../data/kits';
import { donneesDeDevis } from '../docTemplates/shared';
import { COMPANY } from '../../config/company';
import { configurerChaines, limitesChaine, specPanneau, lireElectrique, libelleChaines } from '../chainesPv';

// ---- Données d'essai : un kit de 8 panneaux de 620 Wc ----
const ELEC_2MPPT = { vocMax: 500, mpptMin: 150, mpptMax: 425, nbMppt: 2, chainesParMppt: 1, iMaxMppt: 13, iscMaxMppt: 17, phases: 1 };
const ELEC_1MPPT = { vocMax: 500, mpptMin: 120, mpptMax: 450, nbMppt: 1, chainesParMppt: 1, iscMaxMppt: 20, phases: 1 };
const OND_8K = { id: 'test-8k', brand: 'Test', model: 'Onduleur hybride 8kVA', capacity: 8, maxPvPower: 12000, price: 500000, tension: 48, electrique: ELEC_2MPPT };
const OND_5K = { id: 'test-5k', brand: 'Petit', model: 'Onduleur hybride 5kVA', capacity: 5, maxPvPower: 6500, price: 300000, tension: 48, electrique: ELEC_1MPPT };

const kit = (inverter, nomOnduleur) => ({
  id: 'kit-essai', name: 'Kit essai 8 panneaux', battery: 10, panels: 8, panelW: 620, inverter, tension: 48,
  lines: [
    { designation: 'Batterie lithium 48V 10kWh', qty: 1, unit: 'pcs', pu: 900000, labor: false },
    { designation: 'Panneaux photovoltaïque 620Wc', qty: 8, unit: 'pcs', pu: 75000, labor: false },
    { designation: nomOnduleur, qty: 1, unit: 'pcs', pu: inverter === 8 ? 500000 : 300000, labor: false },
    { designation: 'Coffret de protection DC 2 entrée/sortie', qty: 1, unit: 'pcs', pu: 65000, labor: false },
    { designation: 'Câble PV 1x6mm²', qty: 60, unit: 'm', pu: 700, labor: false },
    { designation: 'Connecteurs MC4 (paire)', qty: 4, unit: 'pcs', pu: 1000, labor: false },
    { designation: 'Structure de montage PV rails galvanisé (Tôle)', qty: 8, unit: 'pcs', pu: 10000, labor: false },
    { designation: "Main d'œuvre", qty: 1, unit: 'pcs', pu: 100000, labor: true },
  ],
});
const KIT_8K = kit(8, 'Onduleur hybride Test 8kVA');
const KIT_5K = kit(5, 'Onduleur hybride Petit 5kVA');
const besoin = (panneaux, peakLoad = 5000) => ({ requiredPanelPower: panneaux * 620, peakLoad });
const devis = (k, panneaux, onduleurs, opts = {}) =>
  buildKitQuotation(k, 'tole', true, besoin(panneaux, opts.peakLoad), onduleurs, [], opts.coef ?? 1);
const ligne = (q, re) => [...q.components, ...q.prestations].find((c) => re.test(c.name));

describe('kit de base conservé sans ajustement', () => {
  it('8 panneaux demandés pour un kit de 8 : aucun ajustement, prix du kit', () => {
    const q = devis(KIT_8K, 8, [OND_8K]);
    expect(q.ajustements).toBeNull();
    expect(q.total).toBe(buildKitQuotation(KIT_8K, 'tole', true, null, [OND_8K]).total);
    expect(q.components.some((c) => /extension/.test(c.name))).toBe(false);
  });

  it('demande inférieure au kit : les panneaux DIMENSIONNÉS, main-d’œuvre du kit GARDÉE', () => {
    // 5 panneaux : une chaîne valide sur le 8 kVA (tension MPPT minimale tenue).
    const q = devis(KIT_8K, 5, [OND_8K]);
    expect(q.panelsIncluded).toBe(5);
    expect(q.ajustements.panneaux).toMatchObject({ base: 8, demande: 5, final: 5, ajoutes: 0, retires: 3, cas: 'inferieur' });
    expect(q.inverterSuggested).toBeNull();
    // Main-d'œuvre : celle du kit, jamais réduite.
    expect(q.installationCost).toBe(100000);
    expect(q.ajustements.mainOeuvre.panneaux.montant).toBe(0);
    expect(ligne(q, /^Panneaux/).quantity).toBe(5);
    // Prix : seulement 3 panneaux et 3 structures en moins.
    const base = devis(KIT_8K, 8, [OND_8K]);
    expect(base.total - q.total).toBe(3 * ligne(base, /^Panneaux/).unitPrice + 3 * 10000);
    expect(q.ajustements.impact.ecart).toBe(q.total - base.total);
  });

  it('jamais sous une chaîne valide pour l’onduleur du kit', () => {
    // Tension MPPT minimale du 8 kVA : 150 V ; un seul panneau n'y suffit pas.
    const { nMin } = limitesChaine(specPanneau(620), lireElectrique({ electrique: ELEC_2MPPT }));
    const q = devis(KIT_8K, 1, [OND_8K]);
    expect(q.panelsIncluded).toBe(nMin);
    expect(panneauxPourKit(KIT_8K, 1, OND_8K)).toBe(nMin);
    // Onduleur inconnu : les panneaux dimensionnés, au moins un.
    expect(panneauxPourKit(KIT_8K, 1, null)).toBe(1);
    // Sans dimensionnement : le kit tel quel.
    expect(panneauxPourKit(KIT_8K, 0, OND_8K)).toBe(8);
  });
});

describe('extension de 8 à 14 panneaux', () => {
  const q = devis(KIT_8K, 14, [OND_8K]);
  const a = q.ajustements;

  it('panneaux et puissance : base, demandés, ajoutés', () => {
    expect(a.panneaux).toMatchObject({ base: 8, demande: 14, final: 14, ajoutes: 6, cas: 'superieur' });
    expect(a.panneaux.kwcBase).toBeCloseTo(4.96);
    expect(a.panneaux.kwcFinal).toBeCloseTo(8.68);
    expect(a.panneaux.kwcAjoutes).toBeCloseTo(3.72);
  });

  it('deux chaînes équilibrées de 7, une par MPPT', () => {
    expect(a.chaines.base.chaines).toEqual([8]);
    expect(a.chaines.final[0].chaines).toEqual([7, 7]);
    expect(a.chaines.final[0].mppt).toEqual([[7], [7]]);
    expect(a.chaines.libelle).toBe('2 chaînes de 7 panneaux');
    expect(a.chaines.ajoutees).toBe(1);
    expect(a.chaines.mpptAjoutes).toBe(1);
  });

  it('onduleur déjà compatible : conservé, sans remplacement', () => {
    expect(a.onduleur.statut).toBe('conserve');
    expect(q.inverterSuggested).toBeNull();
    expect(ligne(q, /^Onduleur/).quantity).toBe(1);
  });

  it('matériel de la chaîne et de l’entrée MPPT ajoutés, au prix du kit quand il l’a', () => {
    const cable = ligne(q, /Câble PV 1x6mm² — extension/);
    expect(cable).toMatchObject({ quantity: 30, unitPrice: 700 });
    expect(ligne(q, /MC4.*extension/)).toMatchObject({ quantity: 2, unitPrice: 1000 });
    expect(ligne(q, /Fusible.*extension/)).toMatchObject({ quantity: 2 });
    expect(ligne(q, /sectionneur.*extension/i)).toMatchObject({ quantity: 1 });
    expect(ligne(q, /Parafoudre DC.*extension/)).toMatchObject({ quantity: 1 });
    // Le coffret du kit (2 entrées) suffit pour 2 chaînes : pas de doublon.
    expect(ligne(q, /combiner/)).toBeUndefined();
    // La ligne d'origine du kit n'est pas retouchée.
    expect(ligne(q, /^Câble PV 1x6mm²$/).quantity).toBe(60);
  });

  it('panneaux et structure suivent', () => {
    expect(ligne(q, /^Panneaux/).quantity).toBe(14);
    expect(ligne(q, /Structure de montage/).quantity).toBe(14);
  });

  it('impact sur le prix : l’écart au kit de base se répartit par poste', () => {
    const base = buildKitQuotation(KIT_8K, 'tole', true, null, [OND_8K]).total;
    expect(a.impact.totalBase).toBe(base);
    expect(a.impact.ecart).toBe(q.total - base);
    expect(a.impact.postes.reduce((s, p) => s + p.montant, 0)).toBe(a.impact.ecart);
  });
});

describe('main-d’œuvre : base + 10 000 F par panneau + 3 500 F par kWh de batterie', () => {
  it('formule, kWh décimaux, arrondi du seul montant final', () => {
    const mo = mainOeuvreEtendue(100000, 6, 36);
    expect(mo.panneaux.montant).toBe(60000);
    expect(mo.batterie).toMatchObject({ kwh: 36, tarif: 3500, montant: 126000 });
    expect(mo.total).toBe(286000);
    // 5,12 kWh → 17 920 F ; 2,5 kWh → 8 750 F.
    expect(mainOeuvreEtendue(0, 0, 5.12).batterie.montant).toBe(17920);
    expect(mainOeuvreEtendue(50000, 0, 2.5).total).toBe(58750);
    // Des panneaux sans batterie ajoutée : aucun supplément batterie.
    expect(mainOeuvreEtendue(100000, 6, 0).total).toBe(160000);
  });

  it('au devis : panneaux ajoutés, batterie inchangée → seul le supplément panneaux', () => {
    const q = devis(KIT_8K, 14, [OND_8K]);
    // Une SEULE ligne de main-d'œuvre au devis, au montant final.
    expect(q.prestations).toEqual([expect.objectContaining({ name: "Main d'œuvre", quantity: 1, totalPrice: 160000 })]);
    expect(ligne(q, /supplément/)).toBeUndefined();
    expect(ligne(q, /kWc\)/)).toBeUndefined();
    expect(q.installationCost).toBe(160000);
    expect(q.ajustements.mainOeuvre).toMatchObject({ base: 100000, total: 160000, coef: 1, totalFinal: 160000 });
  });

  it('chantier togolais : coefficient appliqué à toute la main-d’œuvre', () => {
    const q = devis(KIT_8K, 14, [OND_8K], { coef: 2 });
    expect(q.installationCost).toBe(320000);
    expect(q.ajustements.mainOeuvre.totalFinal).toBe(320000);
  });

  it('batterie étendue sans panneau ajouté : supplément batterie seul', () => {
    const k60 = SOLAR_KITS.find((k) => k.id === 'kit-60kwh-deye-hv');
    const q = buildKitQuotation(k60, 'tole', true, { batteryCapacity: 80 });
    // 60 → 84 kWh (2 modules de 12) : +24 kWh × 3 500 F.
    expect(q.ajustements).toMatchObject({ actif: true, batterie: { base: 60, finale: 84, ajoutes: 24 }, chaines: null, onduleur: null });
    expect(q.prestations).toEqual([expect.objectContaining({ name: "Main d'œuvre", totalPrice: 734000 })]);
    expect(q.ajustements.mainOeuvre).toMatchObject({ base: 650000, total: 734000 });
    expect(q.total).toBe(15044000 + 2 * 1245000 + 84000);
    expect(q.ajustements.impact.postes.map((x) => x.libelle)).toEqual(['Main-d’œuvre (suppléments)', 'Modules batterie (+24 kWh)']);
  });

  it('panneaux ET batterie ajoutés : les deux suppléments', () => {
    const k60 = SOLAR_KITS.find((k) => k.id === 'kit-60kwh-deye-hv');
    const q = buildKitQuotation(k60, 'tole', true, { batteryCapacity: 80, requiredPanelPower: 49 * 620 });
    expect(q.prestations).toEqual([expect.objectContaining({ name: "Main d'œuvre", totalPrice: 650000 + 70000 + 84000 })]);
    expect(q.ajustements.mainOeuvre.total).toBe(650000 + 70000 + 84000);
    // Le détail des suppléments reste à l'écran (section « Ajustements du
    // kit ») ; le document n'imprime que la main-d'œuvre finale.
    expect(q.ajustements.mainOeuvre.batterie).toMatchObject({ kwh: 24, tarif: 3500, montant: 84000 });
    const html = buildDocHtml({ kind: 'devis', model: 'studio', data: donneesDeDevis({ devis: { devisNumber: 'BS-2', type: 'solar', createdAt: '2026-10-05', quotation: q }, company: COMPANY, lead: null, partner: null }) });
    expect(html).not.toContain('Supplément');
    expect(html).not.toContain('en modules');
  });
});

describe('règle du gérant : l’onduleur du kit d’abord, puis en parallèle, puis plus grand', () => {
  it('il prend les panneaux : GARDÉ, même si un plus grand existe et que le pic est élevé', () => {
    // Les 8 panneaux du kit (1 chaîne) sur son 5 kVA ; pic de 9 000 W, bien
    // au-delà de sa sortie. Kit posé tel quel : aucun ajustement.
    const q = devis(KIT_5K, 8, [OND_5K, OND_8K], { peakLoad: 9000 });
    expect(q.ajustements).toBeNull();
    expect(q.inverterSuggested).toBeNull();
    expect(ligne(q, /^Onduleur/).name).toMatch(/Petit 5kVA/);
    // Le pic n'est pas corrigé en douce : il est signalé.
    expect(q.picNonCouvert).toMatchObject({ picW: 9000, sortieW: 5000 });
  });

  it('il ne les prend pas seul : la solution la MOINS CHÈRE, doublé ou plus grand', () => {
    // 14 panneaux : impossible sur un seul 5 kVA (1 MPPT) ; deux 5 kVA ou un 8 kVA conviennent.
    // 2 × 300 000 F > 500 000 F : le 8 kVA, seul.
    const q = devis(KIT_5K, 14, [OND_5K, OND_8K]);
    expect(q.ajustements.onduleur.statut).toBe('remplace');
    expect(q.inverterSuggested).toMatchObject({ id: 'test-8k', quantite: 1 });
    // 8 kVA plus cher que deux 5 kVA : le kit doublé.
    const r = devis(KIT_5K, 14, [OND_5K, { ...OND_8K, price: 700000 }]);
    expect(r.ajustements.onduleur.statut).toBe('double');
    expect(r.inverterSuggested).toMatchObject({ id: 'test-5k', quantite: 2 });
  });

  it('l’exemple du gérant : un 16 kW à lui seul plutôt que deux 12 kW, s’il coûte moins', () => {
    // 2 × 6 kVA et un 12 kVA trop petits ; 16 kVA (1 500 000 F) < 2 × 12 kVA (2 × 1 100 000 F).
    const ond6 = { ...OND_5K, id: 'o6', capacity: 6, maxPvPower: 5000, price: 390000, maxParallele: 2, electrique: ELEC_2MPPT };
    const ond12 = { ...OND_8K, id: 'o12', capacity: 12, maxPvPower: 11000, price: 1100000, maxParallele: 2 };
    const ond16 = { ...OND_8K, id: 'o16', capacity: 16, maxPvPower: 16000, price: 1500000, electrique: { ...ELEC_2MPPT, nbMppt: 3, chainesParMppt: 2, iscMaxMppt: 40 } };
    const k6 = kit(6, 'Onduleur hybride Test 6kVA');
    const q = devis(k6, 22, [ond6, ond12, ond16]); // 22 × 620 = 13 640 Wc
    expect(q.inverterSuggested).toMatchObject({ id: 'o16', quantite: 1 });
    // Sans tension max ni MPPT renseignés, le 16 kW ne peut pas être vérifié :
    // il est écarté, et les deux 12 kW (vérifiés) restent la solution.
    const sansFiche = devis(k6, 22, [ond6, ond12, { ...ond16, electrique: undefined }]);
    expect(sansFiche.inverterSuggested).toMatchObject({ id: 'o12', quantite: 2 });
  });

  it('pas de pic signalé quand il est couvert ou non mesuré', () => {
    expect(devis(KIT_5K, 8, [OND_5K], { peakLoad: 3000 }).picNonCouvert).toBeNull();
    expect(devis(KIT_5K, 8, [OND_5K], { peakLoad: 0 }).picNonCouvert).toBeNull();
  });

  it('kit de base (aucun panneau ajouté) : son onduleur n’est JAMAIS remplacé', () => {
    // Puissance PV estimée (panneau de référence) au-delà de l'onduleur du
    // kit, mais les panneaux posés sont ceux du kit : rien ne change.
    const sansFiche = { ...OND_5K, electrique: undefined, maxPvPower: 4000 };
    const q = buildKitQuotation(KIT_5K, 'tole', true, { requiredPanelPower: 8 * 620, installedPvPower: 9000 }, [sansFiche, OND_8K], [], 1);
    expect(q.panelsIncluded).toBe(8);
    expect(q.inverterSuggested).toBeNull();
    expect(ligne(q, /^Onduleur/).name).toMatch(/Petit 5kVA/);
  });

  it('ordreEscalade : kit ×1, kit ×2…, puis les autres seuls, puis en parallèle', () => {
    const autres = [{ id: 'a', maxParallele: 2 }, { id: 'b', parallele: false }];
    const ordre = ordreEscalade({ id: 'kit', maxParallele: 3 }, autres).map((e) => `${e.modele.id}×${e.quantite}`);
    expect(ordre).toEqual(['kit×1', 'kit×2', 'kit×3', 'a×1', 'b×1', 'a×2']);
    // Prix connus : du moins cher au plus cher, le kit seul toujours en tête.
    const prix = ordreEscalade({ id: 'kit', price: 400, maxParallele: 2 }, [{ id: 'g', price: 700, maxParallele: 2 }, { id: 'p', price: 300 }])
      .map((e) => `${e.modele.id}×${e.quantite}`);
    expect(prix).toEqual(['kit×1', 'p×1', 'p×2', 'g×1', 'kit×2', 'g×2']);
    expect(ordreEscalade({ id: 'kit', parallele: false }, []).map((e) => e.quantite)).toEqual([1]);
  });
});

describe('changement d’onduleur requis', () => {
  // Onduleur du kit SANS mise en parallèle : seul un autre modèle peut suivre.
  const OND_5K_SEUL = { ...OND_5K, parallele: false };
  const q = devis(KIT_5K, 14, [OND_5K_SEUL, OND_8K]);
  const a = q.ajustements;

  it('l’onduleur du kit (1 MPPT, sans parallèle) ne tient pas 14 panneaux : remplacé par le 8 kVA', () => {
    expect(a.onduleur.statut).toBe('remplace');
    expect(a.onduleur.ancien.capacity).toBe(5);
    expect(a.onduleur.nouveau).toMatchObject({ id: 'test-8k', capacity: 8 });
    expect(a.onduleur.raisons.join(' ')).toMatch(/au plus 1 chaîne/);
    expect(ligne(q, /^Onduleur/)).toMatchObject({ unitPrice: 500000, quantity: 1 });
    expect(a.chaines.final[0].chaines).toEqual([7, 7]);
  });

  it('protection AC adaptée au nouvel onduleur', () => {
    // 8 kVA mono : 8 000 / 230 × 1,25 = 43,5 A → 50 A.
    expect(ligne(q, /Disjoncteur AC 50 A — extension/)).toBeDefined();
  });
});

describe('remplacement à calibre égal (autre modèle)', () => {
  it('la ligne onduleur change aussi quand la puissance est la même', () => {
    // Un 5 kVA à 2 MPPT accepte 2 × 7 là où celui du kit (1 MPPT) ne le peut pas.
    const autre5k = { ...OND_8K, id: 'autre-5k', brand: 'Autre', model: 'Onduleur hybride 5kVA', capacity: 5, maxPvPower: 9000, price: 350000 };
    // Pic de 3 000 W : un seul 5 kVA suffit en sortie (3 600 W marge comprise).
    const q = devis(KIT_5K, 14, [{ ...OND_5K, parallele: false }, autre5k], { peakLoad: 3000 });
    expect(q.ajustements.onduleur.statut).toBe('remplace');
    expect(q.inverterSuggested).toMatchObject({ id: 'autre-5k', capacity: 5 });
    expect(ligne(q, /^Onduleur/)).toMatchObject({ unitPrice: 350000 });
  });
});

describe('onduleur doublé, faute d’autre modèle', () => {
  it('2 × le 5 kVA, 7 panneaux chacun', () => {
    const couplable = { ...OND_5K, parallele: true, maxParallele: 2 };
    const q = devis({ ...KIT_5K }, 14, [couplable]);
    expect(q.ajustements.onduleur.statut).toBe('double');
    expect(q.ajustements.onduleur.quantite).toBe(2);
    expect(q.ajustements.chaines.final.map((f) => f.chaines)).toEqual([[7], [7]]);
    expect(ligne(q, /^Onduleur/).quantity).toBe(2);
    // Une protection AC pour le second appareil : 5 000 / 230 × 1,25 = 27 A → 32 A.
    expect(ligne(q, /Disjoncteur AC 32 A — extension/).quantity).toBe(1);
  });
});

describe('configuration techniquement impossible', () => {
  it('aucun onduleur, même doublé : signalé, jamais autorisé', () => {
    const seul = { ...OND_5K, parallele: false };
    const q = devis(KIT_5K, 14, [seul]);
    expect(q.configurationImpossible).toBe(true);
    expect(q.ajustements.verification).toBe('impossible');
    expect(q.ajustements.onduleur.statut).toBe('impossible');
    expect(q.ajustements.alertes.join(' ')).toMatch(/Configuration impossible/);
    // Rien n'est substitué en silence.
    expect(q.inverterSuggested).toBeNull();
  });
});

describe('caractéristiques électriques manquantes', () => {
  it('chaînes « non vérifiées », main-d’œuvre quand même ajustée', () => {
    const sansElec = { ...OND_8K, electrique: undefined };
    const q = devis(KIT_8K, 14, [sansElec]);
    expect(q.ajustements.verification).toBe('non-verifie');
    expect(q.ajustements.alertes[0]).toMatch(/non vérifiées/);
    expect(q.configurationImpossible).toBe(false);
    expect(q.installationCost).toBe(160000);
    expect(q.components.some((c) => /extension/.test(c.name))).toBe(false);
  });
});

describe('chaînes : limites électriques jamais dépassées', () => {
  const p620 = specPanneau(620);
  const elec = lireElectrique({ electrique: ELEC_2MPPT });

  it('panneau de référence et limites de chaîne', () => {
    expect(specPanneau(999)).toBeNull();
    const lim = limitesChaine(p620, elec);
    expect(lim.nMax).toBe(8); // 8 × 57,8 V = 462 V ≤ 500 V à 10 °C
    expect(lim.nMin).toBe(4); // 4 × 40,0 V ≥ 150 V à 70 °C
  });

  it('pour tout nombre de panneaux, aucune chaîne hors limites', () => {
    const lim = limitesChaine(p620, elec);
    for (let n = 1; n <= 30; n += 1) {
      const c = configurerChaines(n, p620, elec);
      if (!c.ok) continue;
      expect(c.chaines.reduce((s, x) => s + x, 0)).toBe(n);
      for (const len of c.chaines) {
        expect(len * lim.vocFroid).toBeLessThanOrEqual(elec.vocMax);
        expect(len).toBeGreaterThanOrEqual(lim.nMin);
      }
      expect(c.mppt.length).toBeLessThanOrEqual(elec.nbMppt);
      for (const entree of c.mppt) expect(new Set(entree).size).toBe(1);
    }
    // 17 panneaux : 2 MPPT × 8 au plus = 16 — refusé.
    expect(configurerChaines(17, p620, elec).ok).toBe(false);
  });

  it('chaînes inégales seulement sur des entrées distinctes, et en dernier recours', () => {
    const c = configurerChaines(13, p620, elec);
    expect(c).toMatchObject({ ok: true, equilibre: false, chaines: [7, 6], mppt: [[7], [6]] });
    expect(configurerChaines(13, p620, elec, { equilibreSeulement: true }).ok).toBe(false);
    expect(libelleChaines([7, 6])).toBe('1 chaîne de 7 panneaux + 1 chaîne de 6 panneaux');
  });

  it('courant : une entrée n’accepte pas plus de chaînes que son Isc max', () => {
    const deux = { ...elec, chainesParMppt: 2, iscMaxMppt: 20 };
    // 2 × 14,2 A = 28,4 A > 20 A : une seule chaîne par entrée.
    expect(configurerChaines(16, p620, deux).mppt).toEqual([[8], [8]]);
  });

  it('section de câble et protection AC', () => {
    expect(sectionCablePv(p620).section).toBe(4); // 14,2 × 1,25 = 17,8 A
    expect(protectionAc({ capacity: 12 }, 3).a).toBe(25); // 12 kW tri : 17,3 A × 1,25
  });
});

describe('document imprimé : la composition retenue, sans les ajustements', () => {
  const donnees = (quotation, extra = {}) => donneesDeDevis({ devis: { devisNumber: 'BS-1', type: 'solar', createdAt: '2026-10-05', quotation, ...extra }, company: COMPANY, lead: null, partner: null });
  const doc = (quotation, model = 'studio', extra = {}) => buildDocHtml({ kind: 'devis', model, data: donnees(quotation, extra) });

  it('kit étendu : ni annexe, ni « — extension », ni suppléments — dans les trois modèles', () => {
    const q = devis(KIT_8K, 14, [OND_8K]);
    // Le calcul garde bien ses ajustements (section à l'écran)…
    expect(q.ajustements?.actif).toBe(true);
    expect([...q.components, ...q.prestations].some((c) => /— extension$/.test(c.name))).toBe(true);
    for (const m of MODELS) {
      const html = doc(q, m.id);
      // … le document du client, non.
      expect(html).not.toContain('Ajustements du kit');
      expect(html).not.toContain('— extension');
      expect(html).not.toContain('Supplément');
      expect(html).not.toContain('class="page annexe"');
    }
  });

  it('les extensions rejoignent les lignes du kit : même total, moins de lignes', () => {
    const q = devis(KIT_8K, 14, [OND_8K]);
    const { lignes, totaux } = donnees(q);
    const brutes = [...q.components, ...q.prestations];
    expect(totaux.totalHT).toBe(brutes.reduce((s, c) => s + c.quantity * c.unitPrice, 0));
    expect(lignes.length).toBeLessThanOrEqual(brutes.length);
    expect(new Set(lignes.map((l) => `${l.designation}|${l.pu}`)).size).toBe(lignes.length);
    expect(lignes.find((l) => /^Panneau/i.test(l.designation)).qty).toBe(14);
  });
});

describe('onduleur décrit par sa seule tension max et son nombre de MPPT', () => {
  const p620 = specPanneau(620);
  const minimal = { electrique: { vocMax: 500, nbMppt: 2 } };

  it('ces deux valeurs suffisent au calcul ; le reste prend des valeurs prudentes', () => {
    const e = lireElectrique(minimal);
    expect(e).toMatchObject({ vocMax: 500, nbMppt: 2, chainesParMppt: 1, mpptMax: 500, plageMppt: false });
    expect(lireElectrique({ electrique: { vocMax: 500 } })).toBeNull();
    expect(lireElectrique({ electrique: { nbMppt: 2 } })).toBeNull();
  });

  it('la tension max n’est jamais dépassée ; la plage inconnue est signalée', () => {
    const c = configurerChaines(14, p620, lireElectrique(minimal));
    expect(c).toMatchObject({ ok: true, chaines: [7, 7] });
    expect(c.alertes.join(' ')).toMatch(/plage MPPT .* non renseignée/);
    // 1 MPPT : 14 panneaux en une chaîne dépasseraient 500 V à froid.
    expect(configurerChaines(14, p620, lireElectrique({ electrique: { vocMax: 500, nbMppt: 1 } })).ok).toBe(false);
  });

  it('au devis : un kit étendu est vérifié avec ces deux seules valeurs', () => {
    const onduleur = { ...OND_8K, electrique: { vocMax: 500, nbMppt: 2 } };
    const q = devis(KIT_8K, 14, [onduleur]);
    expect(q.ajustements.verification).toBe('verifie');
    expect(q.ajustements.chaines.final[0].chaines).toEqual([7, 7]);
  });
});

// ---- Kits étendus : accessoires, nombre de chaînes, diagnostic ----
// Onduleur PCS du kit 208 kWh tel que saisi par le gérant : haute tension
// (tension vide), 10 MPPT de 2 chaînes, 40 A de court-circuit par entrée.
const PCS_125 = {
  id: 'pcs-125', brand: 'Deye', model: 'Onduleur PCS 125 kW', capacity: 125, maxPvPower: 200000, price: 4150000,
  tension: null, maxParallele: 2,
  electrique: { vocMax: 1000, mpptMin: 200, mpptMax: 850, nbMppt: 10, chainesParMppt: 2, iscMaxMppt: 40, phases: 3 },
};
const KIT_208 = SOLAR_KITS.find((k) => k.id === 'kit-208kwh-deye-hv');
const kit208 = (panneaux, onduleurs = [PCS_125], products = []) =>
  buildKitQuotation(KIT_208, 'tole', true, null, onduleurs, products, 1, { panneaux });
const extensions = (q) => q.components.filter((c) => / — extension$/.test(c.name));

describe('kit 208 kWh posé à 190 panneaux : accessoires d’extension', () => {
  const q = kit208(190);
  const chaines = q.ajustements.chaines.final[0].chaines.length;

  it('ni coffret de protection ni lot de fournitures facturés comme accessoires de chaîne', () => {
    expect(extensions(q).filter((c) => /Coffret de protection|Lot de petites fournitures/.test(c.name))).toEqual([]);
  });

  it('fusibles au prix de la règle, pour les seules chaînes au-delà du coffret du kit', () => {
    const fusibles = ligne(q, /^Fusible.*extension/);
    expect(fusibles.unitPrice).toBe(4000);
    // Coffret du kit : 8 entrées, fusibles compris ; kit de base 11 chaînes.
    const auDela = (n) => Math.max(0, n - 8);
    expect(fusibles.quantity).toBe(2 * (auDela(chaines) - auDela(q.ajustements.chaines.base.chaines.length)));
  });

  it('coffrets de jonction : un par tranche de 8 chaînes au-delà du coffret du kit', () => {
    expect(ligne(q, /combiner box/).quantity).toBe(Math.ceil((chaines - 8) / 8));
  });

  it('pas de chaînes multipliées : au plus une de plus que le minimum possible', () => {
    const { nMax } = limitesChaine(specPanneau(620), lireElectrique(PCS_125));
    expect(chaines).toBeLessThanOrEqual(Math.ceil(190 / nMax) + 1);
    expect(q.ajustements.chaines.final[0].chaines.reduce((s, n) => s + n, 0)).toBe(190);
    expect(q.ajustements.onduleur.statut).toBe('conserve');
  });

  it('un produit boutique « coffret » ou « lot » n’est jamais pris pour un fusible ou une gaine', () => {
    const pieges = [
      { id: 'p1', name: 'Coffret DC 4 entrées avec fusibles', basePrice: 100000, category: 'accessoires' },
      { id: 'p2', name: 'Lot de fournitures (moulure, gaine)', basePrice: 90000, category: 'accessoires' },
    ];
    const r = kit208(190, [PCS_125], pieges);
    expect(ligne(r, /^Fusible.*extension/).unitPrice).toBe(4000);
    expect(ligne(r, /^Gaine.*extension/).unitPrice).toBe(5500);
  });
});

describe('caractéristiques saisies incohérentes avec le kit de base', () => {
  // 2 MPPT et « chaînes par MPPT » vide (donc 1) : au plus 2 chaînes, loin
  // des 175 panneaux du kit — une erreur de saisie, pas une impossibilité.
  const pcsMalSaisi = { ...PCS_125, electrique: { ...PCS_125.electrique, nbMppt: 2, chainesParMppt: '' } };
  const q = kit208(176, [pcsMalSaisi]);

  it('verification « incoherent », jamais « configuration impossible »', () => {
    expect(q.ajustements.verification).toBe('incoherent');
    expect(q.configurationImpossible).toBe(false);
    expect(q.inverterInsuffisant).toBe(false);
  });

  it('onduleur du kit conservé, aucun matériel de chaînes', () => {
    expect(q.inverterSuggested).toBeNull();
    expect(ligne(q, /^Onduleur/).quantity).toBe(1);
    expect(extensions(q)).toEqual([]);
  });

  it('alerte claire : l’onduleur, le kit de base, la raison, où corriger', () => {
    const alerte = q.ajustements.alertes.join(' ');
    expect(alerte).toMatch(/Deye Onduleur PCS 125 kW ne permettent pas le kit de base \(175 panneaux\)/);
    expect(alerte).toMatch(/Plus › Onduleurs/);
    expect(q.ajustements.incoherence).toMatchObject({ panneaux: 175 });
  });
});

describe('diagnostic : pourquoi aucun onduleur ne convient', () => {
  it('configuration réellement impossible (kit 48 V) : diagnostic de chaque étape', () => {
    const seul = { ...OND_5K, parallele: false };
    const q = devis(KIT_5K, 14, [seul]);
    expect(q.configurationImpossible).toBe(true);
    expect(q.ajustements.diagnostic.length).toBeGreaterThan(0);
    expect(q.ajustements.diagnostic[0]).toMatchObject({ modele: 'Petit Onduleur hybride 5kVA', quantite: 1 });
    expect(q.ajustements.diagnostic[0].raisons[0]).toBeTruthy();
  });

  it('onduleur 48 V sans tension saisie : écarté, motif haute tension (HV)', () => {
    const sansTension = { ...OND_8K, id: 'sans-tension', brand: 'Autre', model: 'Onduleur hybride 8kVA', tension: null };
    const q = devis(KIT_8K, 14, [OND_8K, sansTension]);
    const ecarte = q.onduleursEcartes.find((e) => /Autre/.test(e.designation));
    expect(ecarte).toBeDefined();
    expect(ecarte.motif).toMatch(/haute tension \(HV\)/);
    // L'onduleur retenu n'est jamais listé comme écarté.
    expect(q.onduleursEcartes.some((e) => /Test/.test(e.designation))).toBe(false);
  });

  it('triphasé demandé : un monophasé de la bonne tension est écarté pour ses phases, pas sa tension', () => {
    const mono = { ...OND_8K, id: 'mono-10k', brand: 'Mono', model: 'Onduleur hybride 10kVA', capacity: 10 };
    const q = buildKitQuotation(KIT_8K, 'tole', true, besoin(14), [OND_8K, mono], [], 1, { phases: 3 });
    const ecarte = q.onduleursEcartes.find((e) => /Mono/.test(e.designation));
    expect(ecarte).toMatchObject({ type: 'phases' });
    expect(ecarte.motif).toMatch(/non triphasé/);
  });

  it('onduleur du kit retrouvé même si sa puissance revient en texte de la synchronisation', () => {
    const q = kit208(190, [{ ...PCS_125, capacity: '125' }]);
    expect(q.ajustements.verification).toBe('verifie');
  });
});

// ---- Panneaux d'équilibrage : un nombre qui ne se câble pas, le suivant oui ----
// Onduleur 80 kW à 6 MPPT de 2 chaînes : deux chaînes d'une même entrée ont la
// même longueur, et 17 panneaux de 620 Wc au plus par chaîne. 201 panneaux ne
// se répartissent pas (nombre impair au-delà de 187), 202 si.
const OND_80 = {
  id: 'ond-80', brand: 'Deye', model: 'SUN-80K-SG02HP3', capacity: 80, maxPvPower: 126000, price: 6000000, tension: null, maxParallele: 2,
  electrique: { vocMax: 1000, mpptMin: 180, mpptMax: 850, nbMppt: 6, chainesParMppt: 2, iMaxMppt: 36, iscMaxMppt: 55, phases: 3 },
};
const OND_50 = {
  id: 'ond-50', brand: 'Deye', model: 'SUN-50K-SG01HP3', capacity: 50, maxPvPower: 65000, price: 3650000, tension: null,
  electrique: { vocMax: 1000, mpptMin: 200, mpptMax: 850, nbMppt: 4, chainesParMppt: 2, iscMaxMppt: 55, phases: 3 },
};
const KIT_128 = SOLAR_KITS.find((k) => k.id === 'kit-128kwh-deye-hv');
const KIT_80 = {
  ...KIT_128, id: 'kit-80', name: 'Kit maison 80 kW', inverter: 80, panels: 160,
  lines: KIT_128.lines.map((l) => (/onduleur/i.test(l.designation) ? { ...l, designation: 'Onduleur Deye SUN-80K-SG02HP3' }
    : /^Panneaux/.test(l.designation) ? { ...l, qty: 160 } : l)),
};
const poser = (k, panneaux, onduleurs) => buildKitQuotation(k, 'tole', true, null, onduleurs, [], 1, { panneaux, phases: 3 });

describe('panneaux d’équilibrage : jamais un onduleur écarté pour un panneau', () => {
  it('l’onduleur de 80 kW ne câble pas 201 panneaux, mais 202', () => {
    const e = lireElectrique(OND_80);
    expect(configurerChaines(201, specPanneau(620), e).ok).toBe(false);
    expect(configurerChaines(202, specPanneau(620), e).ok).toBe(true);
  });

  it('kit à 80 kW, 201 panneaux demandés : onduleur GARDÉ, 202 posés, et l’écran dit pourquoi', () => {
    const q = poser(KIT_80, 201, [OND_80]);
    expect(q.configurationImpossible).toBe(false);
    expect(q.ajustements.onduleur.statut).toBe('conserve');
    expect(q.inverterSuggested).toBeNull();
    expect(q.panelsIncluded).toBe(202);
    expect(ligne(q, /^Panneaux/).quantity).toBe(202);
    expect(ligne(q, /Structure de montage/).quantity).toBe(202);
    expect(q.ajustements.panneaux).toMatchObject({ demande: 201, final: 202 });
    expect(q.ajustements.alertes[0]).toMatch(/1 panneau ajouté pour câbler les chaînes : 201 panneaux ne se répartissent pas sur Deye SUN-80K-SG02HP3.*202 oui/);
  });

  it('sans autre modèle ni parallèle, plus de « configuration impossible » à 201 panneaux', () => {
    const q = poser(KIT_80, 201, [{ ...OND_80, parallele: false }]);
    expect(q.configurationImpossible).toBe(false);
    expect(q.panelsIncluded).toBe(202);
  });

  it('kit 128 kWh : un seul 80 kW avec 202 panneaux, plutôt que deux 50 kW pour 201', () => {
    const q = poser(KIT_128, 201, [OND_50, OND_80]);
    expect(q.inverterSuggested).toMatchObject({ id: 'ond-80', quantite: 1 });
    expect(q.panelsIncluded).toBe(202);
  });

  it('jamais au-delà de la puissance PV admise : 203 panneaux (204 dépasseraient 126 kWc) restent sur deux 50 kW', () => {
    const q = poser(KIT_128, 203, [OND_50, OND_80]);
    expect(q.inverterSuggested).toMatchObject({ id: 'ond-50', quantite: 2 });
    expect(q.panelsIncluded).toBe(203);
  });

  it('nombre exact câblable : aucun panneau ajouté', () => {
    const q = poser(KIT_80, 200, [OND_80]);
    expect(q.panelsIncluded).toBe(200);
    expect(q.ajustements.equilibrage).toBeNull();
  });
});
