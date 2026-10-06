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
    const html = buildDocHtml({ kind: 'devis', model: 'studio', data: donneesDeDevis({ devis: { devisNumber: 'BS-2', type: 'solar', createdAt: '2026-10-05', quotation: q }, company: COMPANY, lead: null, partner: null }) });
    expect(html).toContain('Supplément batterie (24 kWh × 3 500 F)');
    expect(html).toContain('Batterie (+24 kWh en modules)');
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

  it('il ne les prend pas seul : DOUBLÉ avant tout modèle plus grand', () => {
    // 14 panneaux : impossible sur un seul 5 kVA (1 MPPT), le 8 kVA les prendrait seul.
    const q = devis(KIT_5K, 14, [OND_5K, OND_8K]);
    expect(q.ajustements.onduleur.statut).toBe('double');
    expect(q.inverterSuggested).toMatchObject({ id: 'test-5k', quantite: 2 });
  });

  it('pas de pic signalé quand il est couvert ou non mesuré', () => {
    expect(devis(KIT_5K, 8, [OND_5K], { peakLoad: 3000 }).picNonCouvert).toBeNull();
    expect(devis(KIT_5K, 8, [OND_5K], { peakLoad: 0 }).picNonCouvert).toBeNull();
  });

  it('ordreEscalade : kit ×1, kit ×2…, puis les autres seuls, puis en parallèle', () => {
    const autres = [{ id: 'a', maxParallele: 2 }, { id: 'b', parallele: false }];
    const ordre = ordreEscalade({ id: 'kit', maxParallele: 3 }, autres).map((e) => `${e.modele.id}×${e.quantite}`);
    expect(ordre).toEqual(['kit×1', 'kit×2', 'kit×3', 'a×1', 'b×1', 'a×2']);
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

describe('document imprimé : annexe « Ajustements du kit »', () => {
  const doc = (quotation, model = 'studio', extra = {}) => buildDocHtml({
    kind: 'devis', model,
    data: donneesDeDevis({ devis: { devisNumber: 'BS-1', type: 'solar', createdAt: '2026-10-05', quotation, ...extra }, company: COMPANY, lead: null, partner: null }),
  });

  it('présente dans les trois modèles quand le kit est étendu', () => {
    const q = devis(KIT_8K, 14, [OND_8K]);
    for (const m of MODELS) {
      const html = doc(q, m.id);
      expect(html).toContain('<h2>Ajustements du kit</h2>');
      expect(html).toContain('2 chaînes de 7 panneaux');
      expect(html).toContain('Supplément panneaux (6 × 10 000 F)');
      // Batterie inchangée : pas de ligne de supplément à 0 F.
      expect(html).not.toContain('Supplément batterie');
      expect(html).toContain('Main-d’œuvre finale');
    }
  });

  it('absente pour un kit posé tel quel, ou des lignes retouchées à la main', () => {
    expect(doc(devis(KIT_8K, 8, [OND_8K]))).not.toContain('<h2>Ajustements du kit</h2>');
    const q = devis(KIT_8K, 14, [OND_8K]);
    expect(doc(q, 'studio', { lignes: [{ designation: 'X', qty: 1, pu: 1 }] })).not.toContain('<h2>Ajustements du kit</h2>');
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
