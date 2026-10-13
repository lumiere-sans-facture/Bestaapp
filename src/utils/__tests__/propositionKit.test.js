// Proposition de kit commune au Simulateur ROI et à l'assistant de devis.
//
// Le cœur de ces tests : POUR UN MÊME BESOIN, LE SIMULATEUR ET LE DEVIS
// DONNENT LE MÊME RÉSULTAT. On construit l'étude exactement comme chaque
// écran la construit (RoiSection, puis SolarWizard après le passage « Créer
// le devis avec cette proposition »), et on compare kit, panneaux, modules,
// lignes et total — au franc près.
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
import { coefficientMainOeuvre } from '../mainOeuvre';
import { tarifPays } from '../../data/tarifsUemoa';
import {
  DEFAULT_PEAK_SUN_HOURS, DEFAULT_AUTONOMY_NIGHTS, DEFAULT_MOUNTING_TYPE, SYSTEM_TYPES,
} from '../solarSizing';
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

/** L'étude telle que RoiSection la calcule, et la proposition qui en sort. */
const simulateur = ({ mode = 'appareils', rows = DEPART, facture = 60000, tarif = 114, repartition = 'equilibre', pays = 'tg', kitId = null, reglages = null } = {}) => {
  const lieu = { name: tarifPays(pays)?.pays || '', lat: null, lon: null, country: pays };
  const consoFacture = factureVersConsommation(facture, tarif, repartition);
  const etudeCalcul = {
    consoMode: mode === 'facture' && consoFacture.day + consoFacture.night > 0 ? 'facture' : 'appareils',
    appareils: rows, manuel: {}, facture: { montant: facture, prixKwh: tarif, repartition },
    systemType: SYSTEM_TYPES[0].id, autonomyNights: DEFAULT_AUTONOMY_NIGHTS, sunHours: DEFAULT_PEAK_SUN_HOURS,
    mountingType: DEFAULT_MOUNTING_TYPE, includeMounting: true, phases: null, kitId, reglages,
  };
  const proposition = propositionDepuisEtude(etudeCalcul, { ...CATALOGUE, coefMainOeuvre: coefficientMainOeuvre({ ville: lieu.name, pays }) });
  // « Créer le devis avec cette proposition » : l'étude transmise au devis.
  const transmise = capturerDimensionnement({
    consoMode: etudeCalcul.consoMode, rows, facture: { montant: String(facture), prixKwh: tarif, repartition },
    systemType: etudeCalcul.systemType, autonomyNights: etudeCalcul.autonomyNights, sunHours: etudeCalcul.sunHours,
    mountingType: etudeCalcul.mountingType, includeMounting: true, phases: proposition.phases,
    location: lieu, kitId: proposition.kit.id, reglages: proposition.reglages,
  });
  return { proposition, transmise };
};

/** L'assistant de devis ouvert sur cette étude (SolarWizard, sans client). */
const assistant = (etudeTransmise) => {
  const r = restaurerDimensionnement({ type: 'solar', dimensionnement: etudeTransmise });
  const etude = capturerDimensionnement({
    consoMode: r.consoMode, rows: r.appareils, manual: r.manuel, facture: r.facture,
    systemType: r.systemType, autonomyNights: r.autonomyNights, mountingType: r.mountingType,
    includeMounting: r.includeMounting, phases: r.phases, sunHours: Number(r.sunHours) || DEFAULT_PEAK_SUN_HOURS,
    location: r.location, solar: r.solarSource ? { source: r.solarSource } : null,
    kitId: r.kitId, reglages: r.reglages,
  });
  const coef = coefficientMainOeuvre({ ville: r.location?.name || '', pays: r.location?.country || '', telephone: '' });
  return propositionDepuisEtude(etude, { ...CATALOGUE, coefMainOeuvre: coef });
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

describe('Simulateur = Devis : même besoin, même résultat', () => {
  it('les 4 appareils de départ au Togo : Kit 10 kWh, 1 851 000 F des deux côtés', () => {
    const { proposition, transmise } = simulateur();
    const devis = assistant(transmise);
    expect(proposition.kit.id).toBe('kit-10kwh-taico');
    // L'écart mesuré avant : 1 771 000 F au Simulateur (main-d'œuvre du Togo
    // oubliée) contre 1 851 000 F au Devis.
    expect(proposition.total).toBe(1851000);
    expect(empreinte(devis)).toEqual(empreinte(proposition));
  });

  it('au Bénin, la main-d’œuvre n’est pas doublée — des deux côtés', () => {
    const togo = simulateur({ pays: 'tg' });
    const benin = simulateur({ pays: 'bj' });
    expect(benin.proposition.total).toBeLessThan(togo.proposition.total);
    expect(empreinte(assistant(benin.transmise))).toEqual(empreinte(benin.proposition));
  });

  it('facture de 250 000 F : la même conversion — Kit 48 kWh, plus le 60 kWh', () => {
    const { proposition, transmise } = simulateur({ mode: 'facture', facture: 250000, tarif: 115, pays: 'bj' });
    expect(proposition.kit.id).toBe('kit-48kwh');
    expect(empreinte(assistant(transmise))).toEqual(empreinte(proposition));
  });

  it('kit haute tension étendu au besoin : mêmes modules des deux côtés', () => {
    const { proposition, transmise } = simulateur({ mode: 'facture', facture: 370000, tarif: 115, pays: 'bj' });
    expect(proposition.kit.id).toBe('kit-60kwh-deye-hv');
    expect(proposition.batterie.modules).toBeGreaterThan(proposition.batterie.base);
    expect(empreinte(assistant(transmise))).toEqual(empreinte(proposition));
  });

  it('réglages +/− faits au Simulateur : repris tels quels dans le devis', () => {
    let s = simulateur();
    let r = reglerProposition(s.proposition, 'modules', s.proposition.batterie.plus);
    s = simulateur({ reglages: r });
    r = reglerProposition(s.proposition, 'panneaux', s.proposition.panneaux.plus);
    s = simulateur({ reglages: r });
    expect(s.proposition.manuel).toBe(true);
    expect(s.proposition.batterie.modules).toBe(2);
    expect(s.proposition.panneaux.poses).toBe(s.proposition.panneaux.auto + 1);
    expect(s.transmise.reglages).toMatchObject({ modules: 2, panneaux: s.proposition.panneaux.poses });
    expect(empreinte(assistant(s.transmise))).toEqual(empreinte(s.proposition));
  });

  it('variante choisie au Simulateur : la même dans le devis', () => {
    // Facture d'un ménage de Parakou (25 000 F) : le besoin tombe sur les deux kits 5 kWh.
    const besoin5 = simulateur({ mode: 'facture', facture: 25000, tarif: 115, pays: 'bj' });
    expect(besoin5.proposition.suggeres.length).toBeGreaterThan(1);
    const autre = besoin5.proposition.suggeres[1];
    const { proposition, transmise } = simulateur({ mode: 'facture', facture: 25000, tarif: 115, pays: 'bj', kitId: autre.id });
    expect(proposition.kit.id).toBe(autre.id);
    expect(empreinte(assistant(transmise))).toEqual(empreinte(proposition));
  });
});

describe('consommation : une seule conversion', () => {
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
    let s = simulateur({ mode: 'facture', facture: 250000, tarif: 115, pays: 'bj' });
    expect(s.proposition.batterie).toMatchObject({ modules: 3, max: 4, plus: 4, moins: 2 });
    s = simulateur({ mode: 'facture', facture: 250000, tarif: 115, pays: 'bj', reglages: reglerProposition(s.proposition, 'modules', 4) });
    expect(s.proposition.batterie.plus).toBeNull();
    expect(s.proposition.batterie.capacite).toBe(64);
    s = simulateur({ mode: 'facture', facture: 250000, tarif: 115, pays: 'bj', reglages: reglerProposition(s.proposition, 'modules', 1) });
    expect(s.proposition.batterie.moins).toBeNull();
  });

  it('sous le besoin : permis, avec l’alerte « autonomie insuffisante », et moins cher', () => {
    const auto = simulateur().proposition;
    const s = simulateur({ mode: 'facture', facture: 250000, tarif: 115, pays: 'bj' });
    const reduit = simulateur({ mode: 'facture', facture: 250000, tarif: 115, pays: 'bj', reglages: reglerProposition(s.proposition, 'modules', 2) }).proposition;
    expect(auto.alertes).toEqual([]);
    expect(reduit.alertes.map((a) => a.type)).toContain('autonomie');
    expect(reduit.batterie.autonomieNuits).toBeLessThan(1);
    expect(reduit.total).toBeLessThan(s.proposition.total);
    // Le devis peut partir : rien n'est bloqué.
    expect(reduit.quotation.configurationImpossible).toBe(false);
  });

  it('chaque module ajouté se paie : module + supplément de main-d’œuvre', () => {
    const s = simulateur({ pays: 'bj' });
    const plus = simulateur({ pays: 'bj', reglages: reglerProposition(s.proposition, 'modules', 2) }).proposition;
    const ligne = (p) => p.quotation.components.find((c) => /^Batterie/i.test(c.name));
    expect(ligne(plus).quantity).toBe(2);
    expect(plus.total - s.proposition.total).toBeGreaterThan(ligne(s.proposition).unitPrice);
  });
});

describe('panneaux : +/− en direct', () => {
  it('« + » ajoute un panneau et recalcule puissance et prix ; « − » ne descend pas sous le minimum', () => {
    const s = simulateur();
    const p = s.proposition.panneaux;
    expect(p.plus).toBe(p.poses + 1);
    const plus = simulateur({ reglages: reglerProposition(s.proposition, 'panneaux', p.plus) }).proposition;
    expect(plus.panneaux.poses).toBe(p.poses + 1);
    expect(plus.panneaux.kwc).toBeGreaterThan(p.kwc);
    expect(plus.total).toBeGreaterThan(s.proposition.total);
    expect(p.moins == null || p.moins >= p.min).toBe(true);
  });

  it('moins de panneaux que le besoin : alerte « production insuffisante »', () => {
    const s = simulateur();
    const moins = simulateur({ reglages: reglerProposition(s.proposition, 'panneaux', s.proposition.panneaux.moins) }).proposition;
    expect(moins.alertes.map((a) => a.type)).toContain('production');
  });
});

describe('réglages : seulement pour le besoin qui les a vus naître', () => {
  it('le besoin change : on repart de la proposition automatique', () => {
    const s = simulateur();
    const r = reglerProposition(s.proposition, 'modules', 2);
    const autreBesoin = simulateur({ rows: [...DEPART, { rowId: 9, ...appareil('ledlamp', 20) }], reglages: r }).proposition;
    expect(autreBesoin.manuel).toBe(false);
  });

  it('une autre variante de kit ne reçoit pas les réglages d’une autre', () => {
    const s = simulateur();
    const r = reglerProposition(s.proposition, 'modules', 2);
    expect(reglagesApplicables({ ...r, kitId: 'autre-kit' }, s.proposition.kit, s.proposition.quotation))
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
