import { describe, it, expect } from 'vitest';
import {
  lireTension, tensionDansTexte, tensionOnduleur, tensionKit, tensionsCompatibles,
  onduleursCompatibles, completerTensions, libelleTension,
} from '../tension';
import { SOLAR_KITS } from '../../data/kits';
import { INVERTER_MODELS } from '../../data/inverters';
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
