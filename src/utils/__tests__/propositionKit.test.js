// Proposition de kit commune au Simulateur ROI et à l'assistant de devis.
//
// Le cœur de ces tests : POUR UNE MÊME CONSOMMATION, LE SIMULATEUR ET LE
// DEVIS COMPOSENT LE MÊME KIT — kit suggéré, panneaux complétés au besoin,
// modules batterie ajoutés au besoin (60 kWh porté à 72 kWh…). On calcule
// exactement comme chaque écran calcule (RoiSection d'un côté, SolarWizard de
// l'autre), et on compare kit, panneaux, modules, lignes et total — au franc
// près. Les boutons +/−, eux, n'existent que dans l'assistant de devis.
import { describe, it, expect } from 'vitest';
import { SOLAR_KITS } from '../../data/kits';
import { INVERTER_MODELS } from '../../data/inverters';
import { catalogueProducts } from '../../data/catalogue';
import { appliances } from '../../data/appliances';
import {
  consommationDimensionnement, proposerKit, propositionDepuisEtude, reglerProposition, reglagesApplicables,
} from '../propositionKit';
import { capturerDimensionnement, restaurerDimensionnement } from '../dimensionnement';
import { factureVersConsommation } from '../factureConso';
import { consommationDepuisFacture } from '../roi';
import { coefficientMainOeuvre } from '../mainOeuvre';
import { tarifPays } from '../../data/tarifsUemoa';
import { DEFAULT_PEAK_SUN_HOURS, SYSTEM_TYPES, phasesDuKit } from '../solarSizing';
import { modulesDuKit, modulesMaxKit, MODULES_MAX_DEFAUT, poserBatterie } from '../extensionBatterie';
import { normaliserKit } from '../kits';

const CATALOGUE = { kits: SOLAR_KITS, inverters: INVERTER_MODELS, products: catalogueProducts };
const appareil = (id, quantity) => ({ ...appliances.find((a) => a.id === id), quantity });
// Le client de départ du Simulateur (lignes avec rowId, comme à l'écran).
const DEPART = [
  { rowId: 1, ...appareil('ledlamp', 8) },
  { rowId: 2, ...appareil('fridge', 1) },
  { rowId: 3, ...appareil('tv32', 1) },
  { rowId: 4, ...appareil('standfan', 2) },
];

/** Le kit tel que RoiSection le calcule : sans réglage, sauf devis repris. */
const simulateur = ({ mode = 'appareils', rows = DEPART, facture = 60000, tarif = 114, pays = 'tg', kitRepris = null } = {}) => {
  const consoFacture = consommationDepuisFacture(facture, tarif);
  const conso = mode === 'facture' && consoFacture.total > 0
    ? { day: consoFacture.jour, night: consoFacture.nuit, peakLoad: 0 }
    : consommationDimensionnement({ consoMode: 'appareils', appareils: rows });
  return proposerKit({
    consumption: conso, peakLoad: conso.peakLoad,
    systemType: SYSTEM_TYPES[0].id, sunHours: DEFAULT_PEAK_SUN_HOURS,
    ...CATALOGUE, coefMainOeuvre: coefficientMainOeuvre({ pays }),
    kitId: kitRepris?.kitId, reglages: kitRepris?.reglages,
  });
};

/**
 * L'assistant de devis (SolarWizard) sur la même saisie, avec ses réglages
 * par défaut. Comme à l'écran, le « Réseau électrique » se cale sur
 * l'onduleur du kit retenu.
 */
const assistant = ({ consoMode = 'appareils', rows = DEPART, manual = {}, facture = {}, pays = 'tg', kitId = null, reglages = null } = {}) => {
  const location = { name: tarifPays(pays)?.pays || '', lat: null, lon: null, country: pays };
  const coef = coefficientMainOeuvre({ ville: location.name, pays, telephone: '' });
  const defauts = restaurerDimensionnement(null);
  const calculer = (phases) => propositionDepuisEtude(capturerDimensionnement({
    ...defauts, consoMode, rows, manual, facture, phases, location, kitId, reglages,
  }), { ...CATALOGUE, coefMainOeuvre: coef });
  return calculer(phasesDuKit(calculer(1).kit, INVERTER_MODELS));
};

/** Ce qu'on compare entre les deux écrans. */
const empreinte = (p) => ({
  kit: p.kit.id,
  panneaux: p.panneaux.poses,
  modules: p.batterie.modules,
  capacite: p.batterie.capacite,
  onduleur: p.quotation.inverterSuggested,
  lignes: [...p.quotation.components, ...p.quotation.prestations].map((c) => [c.name, c.quantity, c.totalPrice]),
  total: p.total,
});

/** La facture convertie par le Simulateur, saisie en kWh dans l'assistant. */
const memeConsommation = (facture, tarif) => {
  const c = consommationDepuisFacture(facture, tarif);
  return { consoMode: 'direct', manual: { day: c.jour, night: c.nuit } };
};

const F250_BJ = { consoMode: 'facture', facture: { montant: '250000', prixKwh: 115, repartition: 'equilibre' }, pays: 'bj' };

describe('Simulateur = Devis : même consommation, même kit', () => {
  it('les 4 appareils de départ au Togo : Kit 10 kWh, 1 851 000 F des deux côtés', () => {
    const sim = simulateur();
    expect(sim.kit.id).toBe('kit-10kwh-taico');
    // L'écart mesuré avant : 1 771 000 F au Simulateur (main-d'œuvre du Togo
    // oubliée) contre 1 851 000 F au Devis.
    expect(sim.total).toBe(1851000);
    expect(sim.manuel).toBe(false);
    expect(empreinte(assistant())).toEqual(empreinte(sim));
  });

  it('au Bénin, la main-d’œuvre n’est pas doublée — des deux côtés', () => {
    const togo = simulateur({ pays: 'tg' });
    const benin = simulateur({ pays: 'bj' });
    expect(benin.total).toBeLessThan(togo.total);
    expect(empreinte(assistant({ pays: 'bj' }))).toEqual(empreinte(benin));
  });

  it('kit 60 kWh porté à 72 kWh par un module, panneaux ajustés au besoin : la même composition', () => {
    // Facture de 300 000 F à 114 F le kWh (CEET).
    const sim = simulateur({ mode: 'facture', facture: 300000, tarif: 114 });
    expect(sim.kit.id).toBe('kit-60kwh-deye-hv');
    expect(sim.batterie).toMatchObject({ base: 5, modules: 6, capacite: 72 });
    expect(sim.panneaux.poses).toBeLessThan(sim.kit.panels);
    expect(empreinte(assistant(memeConsommation(300000, 114)))).toEqual(empreinte(sim));
  });

  it('plus de besoin : plus de modules ET panneaux complétés au-delà du kit, des deux côtés', () => {
    const sim = simulateur({ mode: 'facture', facture: 370000, tarif: 114 });
    expect(sim.kit.id).toBe('kit-60kwh-deye-hv');
    expect(sim.batterie.capacite).toBe(96);
    expect(sim.panneaux.poses).toBeGreaterThan(sim.kit.panels);
    expect(empreinte(assistant(memeConsommation(370000, 114)))).toEqual(empreinte(sim));
  });

  it('le Simulateur n’a pas de réglage : sa proposition est l’automatique de l’assistant', () => {
    const sim = simulateur({ mode: 'facture', facture: 250000, tarif: 115, pays: 'bj' });
    expect(sim.reglages).toBeNull();
    expect(sim.panneaux.poses).toBe(sim.panneaux.auto);
    expect(sim.batterie.modules).toBe(sim.batterie.auto);
  });

  it('devis repris au Simulateur : son kit et ses réglages, la même composition', () => {
    let d = assistant();
    d = assistant({ reglages: reglerProposition(d, 'modules', d.batterie.plus) });
    d = assistant({ reglages: reglerProposition(d, 'panneaux', d.panneaux.plus) });
    expect(d.manuel).toBe(true);
    // « Reprendre l'étude d'un devis » : ce que le devis a enregistré.
    const enregistree = capturerDimensionnement({ rows: DEPART, kitId: d.kit.id, reglages: d.reglages });
    const etude = restaurerDimensionnement({ type: 'solar', dimensionnement: enregistree });
    const sim = simulateur({ rows: etude.appareils, kitRepris: { kitId: etude.kitId, reglages: etude.reglages } });
    expect(sim.batterie.modules).toBe(2);
    expect(empreinte(sim)).toEqual(empreinte(d));
  });

  it('variante retenue dans un devis repris : la même au Simulateur', () => {
    // Facture d'un ménage de Parakou (20 000 F) : le besoin tombe sur les deux kits 5 kWh.
    const besoin5 = simulateur({ mode: 'facture', facture: 20000, tarif: 115, pays: 'bj' });
    expect(besoin5.suggeres.map((k) => k.id)).toEqual(['kit-5kwh', 'kit-5kwh-deye']);
    const autre = besoin5.suggeres[1];
    const sim = simulateur({ mode: 'facture', facture: 20000, tarif: 115, pays: 'bj', kitRepris: { kitId: autre.id } });
    expect(sim.kit.id).toBe(autre.id);
    expect(empreinte(assistant({ ...memeConsommation(20000, 115), pays: 'bj', kitId: autre.id }))).toEqual(empreinte(sim));
  });
});

describe('consommation de l’assistant', () => {
  it('appareils : kWh jour/nuit au centième et pic de charge', () => {
    const c = consommationDimensionnement({ consoMode: 'appareils', appareils: DEPART });
    const somme = (h) => DEPART.reduce((s, r) => s + r.power * r.quantity * r[h], 0) / 1000;
    expect(c.day).toBe(Number(somme('day').toFixed(2)));
    expect(c.night).toBe(Number(somme('night').toFixed(2)));
    expect(c.peakLoad).toBe(DEPART.reduce((s, r) => s + r.power * r.quantity, 0));
  });

  it('facture : exactement celle de l’assistant (mois de 30 jours, répartition choisie)', () => {
    for (const repartition of ['jour', 'equilibre', 'soir']) {
      const c = consommationDimensionnement({ consoMode: 'facture', facture: { montant: '25000', prixKwh: 115, repartition } });
      const f = factureVersConsommation(25000, 115, repartition);
      expect([c.day, c.night, c.peakLoad]).toEqual([f.day, f.night, 0]);
    }
  });

  it('saisie directe : les kWh tapés', () => {
    expect(consommationDimensionnement({ consoMode: 'direct', manuel: { day: '3,5'.replace(',', '.'), night: '2' } }))
      .toEqual({ day: 3.5, night: 2, total: 5.5, peakLoad: 0 });
  });
});

describe('modules batterie : comme les panneaux, dans les limites', () => {
  const k48 = SOLAR_KITS.find((k) => k.id === 'kit-48kwh');
  const k60 = SOLAR_KITS.find((k) => k.id === 'kit-60kwh-deye-hv');

  it('modules identiques à ceux du kit, 4 au plus par défaut, réglable par kit', () => {
    expect(modulesDuKit(k48)).toMatchObject({ base: 3, moduleKwh: 16, min: 1, max: MODULES_MAX_DEFAUT });
    expect(modulesMaxKit({ ...k48, modulesMax: 6 })).toBe(6);
    expect(modulesDuKit({ ...k48, modulesMax: 6 }).max).toBe(6);
    // Un kit haute tension suit son boîtier de contrôle (GB-W : 10 modules).
    expect(modulesDuKit(k60)).toMatchObject({ base: 5, moduleKwh: 12, max: 10 });
  });

  it('« Modules max » saisi dans Mes kits : entier ≥ 1, sinon la valeur par défaut', () => {
    expect(normaliserKit({ ...k48, modulesMax: '6' }).modulesMax).toBe(6);
    expect(normaliserKit({ ...k48, modulesMax: '' }).modulesMax).toBeNull();
    expect(normaliserKit({ ...k48, modulesMax: '0' }).modulesMax).toBeNull();
    expect(modulesMaxKit(normaliserKit({ ...k48, modulesMax: '' }))).toBe(MODULES_MAX_DEFAUT);
  });

  it('poserBatterie borne le choix manuel entre 1 et le maximum', () => {
    expect(poserBatterie(k48, k48.lines, 40, 9).modules).toBe(4);
    expect(poserBatterie(k48, k48.lines, 40, 9).capacite).toBe(64);
    expect(poserBatterie(k48, k48.lines, 40, 1).capacite).toBe(16);
    expect(poserBatterie(k48, k48.lines, 40, null).modules).toBe(3);
  });

  it('sans kit assez grand, le plus grand est complété en modules jusqu’à couvrir le besoin', () => {
    const r = poserBatterie(k48, k48.lines, 55, null);
    expect(r.modules).toBe(4);
    expect(r.capacite).toBe(64);
  });

  it('+/− dans la proposition : bouton « + » désactivé au maximum, « − » à un module', () => {
    let s = assistant(F250_BJ);
    expect(s.batterie).toMatchObject({ modules: 3, max: 4, plus: 4, moins: 2 });
    s = assistant({ ...F250_BJ, reglages: reglerProposition(s, 'modules', 4) });
    expect(s.batterie.plus).toBeNull();
    expect(s.batterie.capacite).toBe(64);
    s = assistant({ ...F250_BJ, reglages: reglerProposition(s, 'modules', 1) });
    expect(s.batterie.moins).toBeNull();
  });

  it('sous le besoin : permis, avec l’alerte « autonomie insuffisante », et moins cher', () => {
    const auto = assistant();
    const s = assistant(F250_BJ);
    const reduit = assistant({ ...F250_BJ, reglages: reglerProposition(s, 'modules', 2) });
    expect(auto.alertes).toEqual([]);
    expect(reduit.alertes.map((a) => a.type)).toContain('autonomie');
    expect(reduit.batterie.autonomieNuits).toBeLessThan(1);
    expect(reduit.total).toBeLessThan(s.total);
    // Le devis peut partir : rien n'est bloqué.
    expect(reduit.quotation.configurationImpossible).toBe(false);
  });

  it('chaque module ajouté se paie : module + supplément de main-d’œuvre', () => {
    const s = assistant({ pays: 'bj' });
    const plus = assistant({ pays: 'bj', reglages: reglerProposition(s, 'modules', 2) });
    const ligne = (p) => p.quotation.components.find((c) => /^Batterie/i.test(c.name));
    expect(ligne(plus).quantity).toBe(2);
    expect(plus.total - s.total).toBeGreaterThan(ligne(s).unitPrice);
  });
});

describe('panneaux : +/− en direct', () => {
  it('« + » ajoute un panneau et recalcule puissance et prix ; « − » ne descend pas sous le minimum', () => {
    const s = assistant();
    const p = s.panneaux;
    expect(p.plus).toBe(p.poses + 1);
    const plus = assistant({ reglages: reglerProposition(s, 'panneaux', p.plus) });
    expect(plus.panneaux.poses).toBe(p.poses + 1);
    expect(plus.panneaux.kwc).toBeGreaterThan(p.kwc);
    expect(plus.total).toBeGreaterThan(s.total);
    expect(p.moins == null || p.moins >= p.min).toBe(true);
  });

  it('moins de panneaux que le besoin : alerte « production insuffisante »', () => {
    const s = assistant();
    const moins = assistant({ reglages: reglerProposition(s, 'panneaux', s.panneaux.moins) });
    expect(moins.alertes.map((a) => a.type)).toContain('production');
  });
});

describe('réglages : seulement pour le besoin qui les a vus naître', () => {
  it('le besoin change : on repart de la proposition automatique', () => {
    const s = assistant();
    const r = reglerProposition(s, 'modules', 2);
    const autreBesoin = assistant({ rows: [...DEPART, { rowId: 9, ...appareil('ledlamp', 20) }], reglages: r });
    expect(autreBesoin.manuel).toBe(false);
  });

  it('une autre variante de kit ne reçoit pas les réglages d’une autre', () => {
    const s = assistant();
    const r = reglerProposition(s, 'modules', 2);
    expect(reglagesApplicables({ ...r, kitId: 'autre-kit' }, s.kit, s.quotation))
      .toEqual({ panneaux: null, modules: null });
  });

  it('les réglages voyagent avec l’étude enregistrée, nettoyés', () => {
    const etude = capturerDimensionnement({ kitId: 'kit-48kwh', reglages: { kitId: 'kit-48kwh', autoPanneaux: '32', autoModules: 3, modules: '2', panneaux: null, intrus: 'x' } });
    expect(etude.reglages).toEqual({ kitId: 'kit-48kwh', autoPanneaux: 32, autoModules: 3, panneaux: null, modules: 2 });
    expect(restaurerDimensionnement({ dimensionnement: etude }).reglages).toEqual(etude.reglages);
    expect(capturerDimensionnement({ reglages: { kitId: 'k', panneaux: null, modules: null } }).reglages).toBeNull();
  });
});

describe('proposerKit : cas limites', () => {
  it('aucune consommation : pas de proposition', () => {
    expect(proposerKit({ consumption: { day: 0, night: 0 }, ...CATALOGUE })).toBeNull();
  });
  it('aucun kit configuré : le besoin seul, sans kit', () => {
    const p = proposerKit({ consumption: { day: 3, night: 3 }, kits: [], inverters: INVERTER_MODELS, products: [] });
    expect(p.kit).toBeNull();
    expect(p.sizing.batteryCapacity).toBeGreaterThan(0);
  });
});
