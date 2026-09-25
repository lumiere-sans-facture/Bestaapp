import { describe, it, expect } from 'vitest';
import { maxEnParallele, normaliserOnduleur, resumeOnduleur, PARALLELE_MAX_SAISIE } from '../inverters';
import { resoudreOnduleur, buildKitQuotation } from '../solarSizing';
import { SOLAR_KITS } from '../../data/kits';

// Onduleur 3 kVA 24 V : sortie 2 400 W (FP 0,8), entrée PV 3 900 Wc.
const trois = (extra = {}) => ({ id: 'o3', brand: 'HZ', model: 'Onduleur hybride 3kVA', capacity: 3, maxPvPower: 3900, price: 160000, tension: 24, ...extra });

describe('réglage de la mise en parallèle', () => {
  it('non couplable = un seul appareil ; non réglé = deux, comme avant', () => {
    expect(maxEnParallele({ parallele: false, maxParallele: 6 })).toBe(1);
    expect(maxEnParallele({})).toBe(2);
    expect(maxEnParallele({ parallele: true, maxParallele: 4 })).toBe(4);
    expect(maxEnParallele({ parallele: true, maxParallele: '' })).toBe(2);
    expect(maxEnParallele({ parallele: true, maxParallele: 99 })).toBe(PARALLELE_MAX_SAISIE);
  });
  it('le formulaire enregistre oui/non et le nombre maximal', () => {
    expect(normaliserOnduleur({ model: 'X', parallele: true, maxParallele: '3' })).toMatchObject({ parallele: true, maxParallele: 3 });
    expect(normaliserOnduleur({ model: 'X', parallele: false, maxParallele: '3' })).toMatchObject({ parallele: false, maxParallele: 1 });
    expect(normaliserOnduleur({ model: 'X' })).toMatchObject({ parallele: true, maxParallele: 2 });
  });
  it('le résumé le dit', () => {
    expect(resumeOnduleur(trois({ parallele: false }))).toContain('sans parallèle');
    expect(resumeOnduleur(trois({ parallele: true, maxParallele: 4 }))).toContain('parallèle ×4 max');
  });
});

describe('escalade selon le maximum de chaque modèle', () => {
  const critere = { peakLoad: 2000, pvPower: 10000 }; // 10 000 Wc : trois 3 kVA (11 700 Wc)
  it('va jusqu’à trois appareils si le modèle en accepte quatre', () => {
    const r = resoudreOnduleur([trois({ parallele: true, maxParallele: 4 })], critere);
    expect(r).toMatchObject({ quantite: 3, suffisant: true });
  });
  it('s’arrête à deux sans réglage (règle historique)', () => {
    const r = resoudreOnduleur([trois()], critere);
    expect(r).toMatchObject({ quantite: 2, suffisant: false });
  });
  it('un modèle non couplable ne se double jamais', () => {
    const r = resoudreOnduleur([trois({ parallele: false })], { peakLoad: 0, pvPower: 5000 });
    expect(r).toMatchObject({ quantite: 1, suffisant: false });
  });
  it('préfère toujours le moins d’appareils possible', () => {
    const six = { id: 'o6', model: 'Onduleur hybride 6kVA', capacity: 6, maxPvPower: 7800, price: 250000, parallele: true, maxParallele: 6 };
    const r = resoudreOnduleur([trois({ parallele: true, maxParallele: 6 }), six], { peakLoad: 2000, pvPower: 7000 });
    expect(r).toMatchObject({ quantite: 1, suffisant: true });
    expect(r.modele.id).toBe('o6');
  });
  it('à défaut, retient l’ensemble le plus puissant autorisé', () => {
    const seul = { id: 'g', model: 'Gros', capacity: 12, maxPvPower: 15000, parallele: false };
    const r = resoudreOnduleur([trois({ parallele: true, maxParallele: 6 }), seul], { peakLoad: 0, pvPower: 40000 });
    expect(r).toMatchObject({ quantite: 6, suffisant: false });
    expect(r.modele.id).toBe('o3');
  });
});

describe('devis de kit', () => {
  it('le kit 24 V reçoit trois 3 kVA quand le modèle l’autorise, sans alerte', () => {
    const kit = SOLAR_KITS.find((k) => k.id === 'kit-2.5kwh-eco');
    const onduleurs = [trois({ id: 'hz-3kva', parallele: true, maxParallele: 4 })];
    const q = buildKitQuotation({ ...kit, panels: 20 }, 'tole', true, { requiredPanelPower: 10000, peakLoad: 2000 }, onduleurs);
    expect(q.inverterSuggested).toMatchObject({ quantite: 3 });
    expect(q.inverterInsuffisant).toBe(false);
    expect(q.components.find((c) => /onduleur/i.test(c.name)).quantity).toBe(3);
  });
});
