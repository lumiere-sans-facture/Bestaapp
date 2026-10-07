// Choix « Monophasé / Triphasé » : en triphasé, un onduleur triphasé de
// « Mes onduleurs » remplace celui du kit s'il ne l'est pas déjà.
import { describe, it, expect } from 'vitest';
import { buildKitQuotation } from '../solarSizing';
import { phasesOnduleur, estTriphase, normaliserOnduleur } from '../inverters';
import { SOLAR_KITS } from '../../data/kits';
import { INVERTER_MODELS } from '../../data/inverters';

const kit = (id) => SOLAR_KITS.find((k) => k.id === id);
const besoinDuKit = (k) => ({ requiredPanelPower: k.panels * k.panelW });
const devis = (k, phases, inverters = INVERTER_MODELS) =>
  buildKitQuotation(k, 'tole', true, besoinDuKit(k), inverters, [], 1, { phases });

describe('phases d’un onduleur', () => {
  it('réglage « Phases », sinon la désignation, sinon inconnu', () => {
    expect(phasesOnduleur(INVERTER_MODELS.find((o) => o.id === 'deye-12kva'))).toBe(3);
    expect(phasesOnduleur(INVERTER_MODELS.find((o) => o.id === 'deye-6kva'))).toBe(1);
    expect(phasesOnduleur({ model: 'Onduleur Hybride Deye SUN-30K-SG02HP3-EU-AM3' })).toBe(3);
    expect(phasesOnduleur({ model: 'Onduleur PCS Deye 125 kW' })).toBe(3);
    expect(phasesOnduleur({ model: 'Onduleur hybride 6kva HZ' })).toBeNull();
    expect(estTriphase({ model: 'Onduleur triphasé 10 kVA' })).toBe(true);
  });

  it('« Triphasé » choisi seul dans le formulaire n’est plus perdu', () => {
    expect(normaliserOnduleur({ model: 'X', capacity: '10', electrique: { phases: 3 } }).electrique).toMatchObject({ phases: 3 });
    expect(normaliserOnduleur({ model: 'X', capacity: '10', electrique: { phases: 1 } }).electrique).toBeNull();
  });
});

describe('devis de kit en triphasé', () => {
  it('monophasé (par défaut) : rien ne change', () => {
    const k = kit('kit-5kwh-deye');
    const sans = buildKitQuotation(k, 'tole', true, besoinDuKit(k), INVERTER_MODELS, [], 1);
    const mono = devis(k, 1);
    expect(mono.total).toBe(sans.total);
    expect(mono.inverterSuggested).toBeNull();
    expect(mono.phases).toBe(1);
  });

  it('kit à onduleur monophasé : le plus petit triphasé de même tension le remplace', () => {
    const q = devis(kit('kit-5kwh-deye'), 3); // Deye 6 kVA mono, 48 V
    expect(q.inverterSuggested).toMatchObject({ id: 'deye-12kva', quantite: 1 });
    expect(q.components.find((c) => /onduleur/i.test(c.name)).name).toMatch(/12kVA/);
    expect(q.triphaseIndisponible).toBe(false);
    expect(q.phases).toBe(3);
  });

  it('kit déjà triphasé : son onduleur est gardé', () => {
    expect(devis(kit('kit-48kwh'), 3).inverterSuggested).toBeNull(); // Deye 12 kVA triphasé
    expect(devis(kit('kit-60kwh-deye-hv'), 3).inverterSuggested).toBeNull(); // HV triphasé
  });

  it('aucun triphasé de la tension du kit : onduleur gardé, et signalé', () => {
    const q = devis(kit('kit-2.5kwh-eco'), 3); // 24 V, seuls des 3 kVA mono
    expect(q.inverterSuggested).toBeNull();
    expect(q.triphaseIndisponible).toBe(true);
  });

  it('le triphasé substitué exige plus de panneaux en série : le devis les pose', () => {
    // Deye 12 kVA : 200 V de démarrage MPPT, soit 6 panneaux de 620 Wc au moins.
    const k = kit('kit-5kwh-deye');
    const q = buildKitQuotation(k, 'tole', true, { requiredPanelPower: 5 * k.panelW }, INVERTER_MODELS, [], 1, { phases: 3 });
    expect(q.panelsIncluded).toBe(6);
    expect(q.configurationImpossible).toBe(false);
    // En monophasé, le même besoin garde 5 panneaux sur le 6 kVA du kit.
    expect(buildKitQuotation(k, 'tole', true, { requiredPanelPower: 5 * k.panelW }, INVERTER_MODELS, [], 1).panelsIncluded).toBe(5);
  });

  it('kit étendu en triphasé : la section dit pourquoi l’onduleur change', () => {
    const k = kit('kit-5kwh-deye');
    const q = buildKitQuotation(k, 'tole', true, { requiredPanelPower: (k.panels + 4) * k.panelW }, INVERTER_MODELS, [], 1, { phases: 3 });
    expect(q.ajustements.onduleur.statut).toBe('remplace');
    expect(q.ajustements.onduleur.ancien.capacity).toBe(6);
    expect(q.ajustements.onduleur.raisons[0]).toMatch(/triphasé demandé/);
    expect(q.inverterSuggested).toMatchObject({ id: 'deye-12kva' });
  });
});
