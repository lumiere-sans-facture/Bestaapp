// Devis et factures : la composition retenue du kit, sans le détail des
// ajustements (« — extension »).
import { describe, it, expect } from 'vitest';
import { compositionRetenue, designationRetenue } from '../compositionKit';

const total = (lignes) => lignes.reduce((s, l) => s + l.qty * l.pu, 0);

describe('composition retenue', () => {
  const kit = [
    { designation: 'Panneau solaire 620W', qty: 10, pu: 70000 },
    { designation: 'Câble PV 1x6mm²', qty: 40, pu: 900 },
    { designation: 'Disjoncteur DC 2P 25 A', qty: 2, pu: 6000 },
    { designation: "Main d'œuvre", qty: 1, pu: 250000 },
  ];

  it('une extension rejoint la ligne du kit : quantités additionnées, total inchangé', () => {
    const lignes = [...kit.slice(0, 3),
      { designation: 'Câble PV 1x6mm² — extension', qty: 20, pu: 900 },
      { designation: 'Disjoncteur DC 2P 25 A — extension', qty: 1, pu: 6000 },
      kit[3]];
    const c = compositionRetenue(lignes);
    expect(c.map((l) => `${l.designation} × ${l.qty}`)).toEqual([
      'Panneau solaire 620W × 10', 'Câble PV 1x6mm² × 60', 'Disjoncteur DC 2P 25 A × 3', "Main d'œuvre × 1",
    ]);
    expect(total(c)).toBe(total(lignes));
    expect(c.some((l) => /extension/i.test(l.designation))).toBe(false);
  });

  it('extension sans pareille dans le kit : sa place, son nom sans « — extension »', () => {
    const c = compositionRetenue([...kit, { designation: 'Coffret de jonction DC 4 entrées — extension', qty: 1, pu: 45000 }]);
    expect(c.at(-1)).toEqual({ designation: 'Coffret de jonction DC 4 entrées', qty: 1, pu: 45000 });
  });

  it('même désignation, autre prix : deux lignes (jamais de prix moyen)', () => {
    const c = compositionRetenue([...kit, { designation: 'Câble PV 1x6mm² — extension', qty: 10, pu: 1100 }]);
    expect(c.filter((l) => l.designation === 'Câble PV 1x6mm²')).toHaveLength(2);
  });

  it('lignes saisies à la main : rien ne fusionne, rien ne change', () => {
    const doublon = [kit[1], { ...kit[1] }];
    expect(compositionRetenue(doublon)).toEqual(doublon);
    expect(compositionRetenue(kit)).toEqual(kit);
    expect(compositionRetenue([])).toEqual([]);
    expect(compositionRetenue(undefined)).toEqual([]);
  });

  it('désignation retenue', () => {
    expect(designationRetenue('Disjoncteur AC 50 A — extension')).toBe('Disjoncteur AC 50 A');
    expect(designationRetenue('Câble — extension longue')).toBe('Câble — extension longue');
  });
});
