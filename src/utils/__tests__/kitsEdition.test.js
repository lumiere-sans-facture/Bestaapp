import { describe, it, expect } from 'vitest';
import { SOLAR_KITS } from '../../data/kits';
import { normaliserKit, kitTotal, kitEstValide, resumeKit, dupliquerKit, nouveauKit, UNITES_KIT } from '../kits';

const brouillon = (patch = {}) => ({
  id: 'k1', name: '  Kit test  ', battery: '5', panels: '4', panelW: '590', inverter: '6',
  lines: [
    { designation: '  Batterie  ', qty: '1', unit: 'pcs', pu: '460000', labor: false },
    { designation: "Main d'œuvre", qty: '1', unit: 'forfait', pu: '75000', labor: true },
  ],
  ...patch,
});

describe('normaliserKit — un brouillon de formulaire devient un kit exploitable', () => {
  it('coerce les nombres saisis en texte', () => {
    const k = normaliserKit(brouillon());
    expect(k.battery).toBe(5);
    expect(k.panels).toBe(4);
    expect(k.panelW).toBe(590);
    expect(k.inverter).toBe(6);
    expect(k.lines[0].qty).toBe(1);
    expect(k.lines[0].pu).toBe(460000);
  });

  it('accepte la virgule décimale (clavier français)', () => {
    expect(normaliserKit(brouillon({ battery: '2,5' })).battery).toBe(2.5);
  });

  it('supprime les espaces autour du nom et des désignations', () => {
    const k = normaliserKit(brouillon());
    expect(k.name).toBe('Kit test');
    expect(k.lines[0].designation).toBe('Batterie');
  });

  it('écarte les lignes sans désignation (le formulaire en laisse toujours une vide)', () => {
    const k = normaliserKit(brouillon({
      lines: [...brouillon().lines, { designation: '   ', qty: '1', unit: 'pcs', pu: '0' }],
    }));
    expect(k.lines).toHaveLength(2);
  });

  it('ramène une quantité absurde à 1 — jamais 0, sinon la ligne serait gratuite', () => {
    expect(normaliserKit(brouillon({ lines: [{ designation: 'X', qty: '0', pu: '100' }] })).lines[0].qty).toBe(1);
    expect(normaliserKit(brouillon({ lines: [{ designation: 'X', qty: 'abc', pu: '100' }] })).lines[0].qty).toBe(1);
    expect(normaliserKit(brouillon({ lines: [{ designation: 'X', qty: '-3', pu: '100' }] })).lines[0].qty).toBe(1);
  });

  it('refuse un prix négatif ou illisible : 0, jamais une valeur inventée', () => {
    expect(normaliserKit(brouillon({ lines: [{ designation: 'X', qty: '1', pu: '-5' }] })).lines[0].pu).toBe(0);
    expect(normaliserKit(brouillon({ lines: [{ designation: 'X', qty: '1', pu: 'zz' }] })).lines[0].pu).toBe(0);
  });

  it('retombe sur « pcs » quand l’unité est inconnue', () => {
    expect(normaliserKit(brouillon({ lines: [{ designation: 'X', qty: 1, pu: 1, unit: 'litres' }] })).lines[0].unit).toBe('pcs');
    for (const u of UNITES_KIT) {
      expect(normaliserKit(brouillon({ lines: [{ designation: 'X', qty: 1, pu: 1, unit: u }] })).lines[0].unit).toBe(u);
    }
  });

  it('conserve les champs non gérés par le formulaire (fiche technique)', () => {
    const k = normaliserKit(brouillon({ batteryModules: [{ capacity: 16, qty: 2 }] }));
    expect(k.batteryModules).toEqual([{ capacity: 16, qty: 2 }]);
  });
});

describe('kitTotal', () => {
  it('additionne quantité × prix, matériel et prestations confondus', () => {
    expect(kitTotal(normaliserKit(brouillon()))).toBe(535000);
  });

  it('retourne 0 sur un kit vide plutôt que NaN', () => {
    expect(kitTotal(nouveauKit())).toBe(0);
    expect(kitTotal(null)).toBe(0);
  });

  it('donne le même total que la liste officielle', () => {
    const kit5 = SOLAR_KITS.find((k) => k.id === 'kit-5kwh');
    expect(kitTotal(kit5)).toBe(1200000);
  });
});

describe('kitEstValide — ce qui peut partir dans un devis', () => {
  it('accepte un kit nommé et chiffré', () => {
    expect(kitEstValide(brouillon())).toBe(true);
  });

  it('refuse un kit sans nom', () => {
    expect(kitEstValide(brouillon({ name: '   ' }))).toBe(false);
  });

  it('refuse un kit sans aucune ligne', () => {
    expect(kitEstValide(brouillon({ lines: [] }))).toBe(false);
  });

  it('refuse un kit entièrement à 0 F : il partirait en devis gratuit', () => {
    expect(kitEstValide(brouillon({ lines: [{ designation: 'X', qty: '1', pu: '0' }] }))).toBe(false);
  });

  it('accepte les kits officiels', () => {
    for (const k of SOLAR_KITS) expect(kitEstValide(k)).toBe(true);
  });
});

describe('resumeKit', () => {
  it('résume les caractéristiques techniques', () => {
    expect(resumeKit({ battery: 5, panels: 4, panelW: 590, inverter: 6 }))
      .toBe('5 kWh · 4 × 590 Wc · onduleur 6 kVA');
  });

  it('n’invente rien quand les caractéristiques manquent', () => {
    expect(resumeKit({})).toBe('');
    expect(resumeKit({ battery: 5 })).toBe('5 kWh');
  });
});

describe('dupliquerKit', () => {
  const source = SOLAR_KITS[0];
  const copie = dupliquerKit(source);

  it('change d’identifiant — sinon la copie écraserait l’original', () => {
    expect(copie.id).not.toBe(source.id);
  });

  it('suffixe le nom', () => {
    expect(copie.name).toBe(`${source.name} (copie)`);
  });

  it('copie les lignes en profondeur : modifier la copie ne touche pas l’original', () => {
    copie.lines[0].pu = 1;
    expect(source.lines[0].pu).not.toBe(1);
  });

  it('garde le même total', () => {
    expect(kitTotal(dupliquerKit(source))).toBe(kitTotal(source));
  });
});
