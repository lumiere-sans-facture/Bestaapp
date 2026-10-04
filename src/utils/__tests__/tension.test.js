import { describe, it, expect } from 'vitest';
import {
  lireTension, tensionDansTexte, tensionOnduleur, tensionKit, tensionsCompatibles,
  onduleursCompatibles, completerTensions, libelleTension, estKitHauteTension,
} from '../tension';
import { SOLAR_KITS } from '../../data/kits';
import { INVERTER_MODELS } from '../../data/inverters';
import { buildKitQuotation } from '../solarSizing';
import { normaliserKit, resumeKit } from '../kits';
import { normaliserOnduleur, resumeOnduleur } from '../inverters';

describe('lecture de la tension', () => {
  it('ne connaît que 12, 24 et 48 V', () => {
    expect(lireTension('24')).toBe(24);
    expect(lireTension(48)).toBe(48);
    expect(lireTension('12 V')).toBe(12);
    expect(lireTension('36')).toBeNull();
    expect(lireTension('')).toBeNull();
  });
  it('retrouve la tension écrite dans une désignation', () => {
    expect(tensionDansTexte('Batterie lithium 24V (2,5kwh) HZ')).toBe(24);
    expect(tensionDansTexte('Batterie lithium 12V 300A (3,8kWh)')).toBe(12);
    expect(tensionDansTexte('Batterie 51,2V 100Ah')).toBe(48);
    expect(tensionDansTexte('Onduleur hybride 6kVA Deye')).toBeNull();
    expect(tensionDansTexte('Batterie 5kWh')).toBeNull();
  });
});

describe('onduleurs et kits', () => {
  it('le champ saisi prime sur la désignation', () => {
    expect(tensionOnduleur({ model: 'Onduleur 24V', tension: 48 })).toBe(48);
    expect(tensionOnduleur({ model: 'Onduleur hybride 48V 5kVA' })).toBe(48);
    expect(tensionOnduleur({ model: 'Onduleur hybride 5kVA' })).toBeNull();
  });
  it('un kit sans champ lit sa ligne batterie', () => {
    expect(tensionKit({ lines: [{ designation: 'Panneau 580Wc' }, { designation: 'Batterie lithium 24V 100Ah' }] })).toBe(24);
    expect(tensionKit({ lines: [{ designation: 'Batterie 5kWh' }] })).toBeNull();
  });
  it('chaque kit officiel porte une tension, cohérente avec sa ligne batterie', () => {
    for (const kit of SOLAR_KITS) {
      // Seule exception : batterie haute tension (« HV »), hors 12 / 24 / 48 V.
      if (estKitHauteTension(kit)) { expect(kit.tension, kit.id).toBeNull(); continue; }
      expect([12, 24, 48], kit.id).toContain(kit.tension);
      const lue = tensionKit({ lines: kit.lines });
      if (lue) expect(lue, kit.id).toBe(kit.tension);
    }
  });
  it('chaque onduleur officiel porte une tension, celle des kits où il est monté', () => {
    for (const o of INVERTER_MODELS) expect([12, 24, 48], o.id).toContain(o.tension);
    expect(INVERTER_MODELS.find((o) => o.id === 'hz-3kva').tension).toBe(24);
    expect(INVERTER_MODELS.find((o) => o.id === 'deye-6kva').tension).toBe(48);
  });
  it('une tension inconnue ne bloque rien', () => {
    expect(tensionsCompatibles(24, 48)).toBe(false);
    expect(tensionsCompatibles(24, 24)).toBe(true);
    expect(tensionsCompatibles(null, 48)).toBe(true);
    const liste = [{ id: 'a', tension: 24 }, { id: 'b', tension: 48 }, { id: 'c' }];
    expect(onduleursCompatibles(liste, 24).map((o) => o.id)).toEqual(['a', 'c']);
    expect(onduleursCompatibles(liste, null)).toHaveLength(3);
  });
});

describe('formulaires et résumés', () => {
  it('normalise la tension saisie, et la déduit de la ligne batterie sinon', () => {
    expect(normaliserOnduleur({ model: 'X', tension: '24' }).tension).toBe(24);
    expect(normaliserOnduleur({ model: 'X', tension: '' }).tension).toBeNull();
    expect(normaliserKit({ name: 'K', tension: '', lines: [{ designation: 'Batterie 48V 5kWh', qty: 1, pu: 1 }] }).tension).toBe(48);
    expect(normaliserKit({ name: 'K', tension: '12', lines: [{ designation: 'Batterie 48V', qty: 1, pu: 1 }] }).tension).toBe(12);
  });
  it('les résumés affichent la tension', () => {
    expect(resumeOnduleur({ capacity: 3, tension: 24, maxPvPower: 3900 })).toBe('3 kVA · 24 V · PV max 3900 Wc · parallèle ×2 max');
    expect(resumeKit({ battery: 2.5, panels: 2, panelW: 500, inverter: 3, tension: 24 })).toContain('batterie 24 V');
    expect(libelleTension(null)).toBe('');
  });
});

describe('completerTensions (données enregistrées avant le champ)', () => {
  it('complète les officiels sans tension, jamais une valeur saisie ou vidée', () => {
    const avant = [{ id: 'hz-3kva', model: 'Onduleur hybride 3kVA' }, { id: 'deye-6kva', tension: 24 }, { id: 'perso' }, { id: 'hz-6kva', tension: null }];
    const apres = completerTensions(avant, INVERTER_MODELS);
    expect(apres.map((o) => o.tension)).toEqual([24, 24, undefined, null]);
  });
  it('rend la même liste si rien ne change (pas de réplication inutile)', () => {
    const liste = [{ id: 'perso' }];
    expect(completerTensions(liste, INVERTER_MODELS)).toBe(liste);
  });
});

describe('kit 60 kWh Deye haute tension', () => {
  const kit = SOLAR_KITS.find((k) => k.id === 'kit-60kwh-deye-hv');
  const lignes = (d) => d.components.map((c) => c.name || c.designation);

  it('reprend le devis : 15 044 000 F CFA, structure en tôle comprise', () => {
    expect(kit.lines.reduce((s, l) => s + l.qty * l.pu, 0)).toBe(15044000);
  });

  it('garde son onduleur 30 kW : jamais remplacé par un modèle 48 V', () => {
    const devis = buildKitQuotation(kit, 'tole', true, { peakLoad: 20000, requiredPanelPower: 26000 }, INVERTER_MODELS);
    expect(lignes(devis).filter((n) => /onduleur/i.test(n))).toEqual(['Onduleur Hybride Deye SUN-30K-SG02HP3-EU-AM3']);
    expect(devis.inverterInsuffisant).toBe(false);
  });
});

describe('main d’œuvre des kits haute tension', () => {
  const kitHV = SOLAR_KITS.find((k) => k.id === 'kit-60kwh-deye-hv');
  const mo = (kit, coef) => buildKitQuotation(kit, 'tole', true, null, [], [], coef).installationCost;

  it('même tarif au Togo et au Bénin : 650 000 F, jamais doublé', () => {
    expect(mo(kitHV, 1)).toBe(650000);
    expect(mo(kitHV, 2)).toBe(650000);
    expect(buildKitQuotation(kitHV, 'tole', true, null, [], [], 2).total).toBe(15044000);
  });

  it('kit 128 kWh : 1 500 000 F au Togo comme au Bénin, onduleur 50 kW conservé', () => {
    const k128 = SOLAR_KITS.find((k) => k.id === 'kit-128kwh-deye-hv');
    expect(estKitHauteTension(k128)).toBe(true);
    expect(mo(k128, 2)).toBe(1500000);
    const devis = buildKitQuotation(k128, 'tole', true, { peakLoad: 40000, requiredPanelPower: 62000 }, INVERTER_MODELS, [], 2);
    expect(devis.total).toBe(28110000);
    expect(devis.components.filter((c) => /onduleur/i.test(c.name)).map((c) => c.name)).toEqual(['Onduleur Hybride Deye SUN-50K-SG01HP3-EU']);
  });

  it('kit 208 kWh : 2 500 000 F au Togo comme au Bénin, PCS 125 kW conservé', () => {
    const k208 = SOLAR_KITS.find((k) => k.id === 'kit-208kwh-deye-hv');
    expect(estKitHauteTension(k208)).toBe(true);
    expect(mo(k208, 2)).toBe(2500000);
    const devis = buildKitQuotation(k208, 'tole', true, { peakLoad: 100000, requiredPanelPower: 100000 }, INVERTER_MODELS, [], 2);
    expect(devis.total).toBe(50055000);
    expect(devis.components.filter((c) => /onduleur/i.test(c.name)).map((c) => c.name)).toEqual(['Onduleur PCS Deye 125 kW (DEYEPCS125K-L0)']);
  });

  it('les autres kits restent doublés au Togo', () => {
    const k48 = SOLAR_KITS.find((k) => k.id === 'kit-48kwh');
    expect(mo(k48, 2)).toBe(2 * mo(k48, 1));
  });

  it('repère un kit HV à sa ligne batterie, y compris un kit créé à la main', () => {
    expect(estKitHauteTension(kitHV)).toBe(true);
    expect(estKitHauteTension({ lines: [{ designation: 'Batterie Pylontech H2 HV 10 kWh' }] })).toBe(true);
    expect(estKitHauteTension({ lines: [{ designation: 'Batterie lithium 48V 16 kWh' }, { designation: 'Disjoncteur HV' }] })).toBe(false);
    expect(estKitHauteTension({ lines: [{ designation: 'Batterie HVAC' }] })).toBe(false);
  });
});
