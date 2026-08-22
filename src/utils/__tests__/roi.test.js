import { describe, it, expect } from 'vitest';
import {
  consommationAppareils, coutActuel, economieAnnee, projection, retourInvestissement,
  co2EviteAn, simulerRoi,
  JOURS_PAR_AN, DUREE_SYSTEME_ANS, KWH_PAR_LITRE_GAZOLE, MAINTENANCE_ANNUELLE,
  HAUSSE_TARIF_DEFAUT, DEGRADATION_ANNUELLE, CO2_PAR_LITRE_GAZOLE, CO2_PAR_KWH_RESEAU,
} from '../roi';
import { appliances } from '../../data/appliances';

// Petit commerce de Lomé : 10 lampes LED la nuit, un réfrigérateur et un
// téléviseur — pris tels quels dans le catalogue d'appareils de l'app.
const lampe = appliances.find((a) => a.id === 'ledlamp');   // 10 W · 0 j · 12 n
const frigo = appliances.find((a) => a.id === 'fridge');    // 250 W · 12 j · 12 n
const tele = appliances.find((a) => a.id === 'tv32');       // 50 W · 3 j · 2 n
const CLIENT = [
  { ...lampe, quantity: 10 },
  { ...frigo, quantity: 1 },
  { ...tele, quantity: 1 },
];

describe('consommationAppareils — étape 1 : des appareils à des kWh', () => {
  it('applique puissance × quantité × heures, jour et nuit séparés', () => {
    const c = consommationAppareils(CLIENT);
    // Jour : frigo 250×12 + télé 50×3 = 3150 Wh
    expect(c.jour).toBe(3.15);
    // Nuit : lampes 10×10×12 + frigo 250×12 + télé 50×2 = 1200 + 3000 + 100 = 4300 Wh
    expect(c.nuit).toBe(4.3);
    expect(c.total).toBe(7.45);
  });

  it('donne le même résultat que l’assistant de devis (même formule)', () => {
    // C'est le calcul de SolarWizard, à la ligne près : les deux écrans ne
    // doivent jamais annoncer deux consommations différentes.
    const jour = CLIENT.reduce((s, r) => s + r.power * r.quantity * r.day, 0) / 1000;
    const nuit = CLIENT.reduce((s, r) => s + r.power * r.quantity * r.night, 0) / 1000;
    const c = consommationAppareils(CLIENT);
    expect(c.jour).toBeCloseTo(jour, 2);
    expect(c.nuit).toBeCloseTo(nuit, 2);
  });

  it('calcule le pic de charge (tout allumé en même temps)', () => {
    expect(consommationAppareils(CLIENT).pic).toBe(10 * 10 + 250 + 50);
  });

  it('quantité absente = 1, valeurs illisibles ignorées', () => {
    expect(consommationAppareils([{ power: 100, day: 2, night: 0 }]).jour).toBe(0.2);
    expect(consommationAppareils([{ power: 'x', day: 2 }]).total).toBe(0);
  });

  it('aucune liste, aucune consommation', () => {
    expect(consommationAppareils().total).toBe(0);
    expect(consommationAppareils([]).total).toBe(0);
  });
});

describe('coutActuel — étape 2 : ces kWh, il les paie déjà', () => {
  const base = { kwhJour: 10, tarifKwh: 114, prixCarburant: 750, groupeActif: true };

  it('sans coupure, tout vient du réseau', () => {
    const c = coutActuel({ ...base, heuresCoupureJour: 0 });
    expect(c.kwhReseauAn).toBe(10 * JOURS_PAR_AN);
    expect(c.kwhGroupeAn).toBe(0);
    expect(c.litresAn).toBe(0);
    expect(c.total).toBe(Math.round(10 * JOURS_PAR_AN * 114));
  });

  it('6 h de coupure : un quart des kWh passe par le groupe', () => {
    const c = coutActuel({ ...base, heuresCoupureJour: 6 });
    expect(c.kwhGroupeAn).toBe(Math.round(10 * 0.25 * JOURS_PAR_AN));
    expect(c.kwhReseauAn).toBe(Math.round(10 * 0.75 * JOURS_PAR_AN));
    // Les litres se déduisent des kWh, pas d'une consommation horaire saisie.
    expect(c.litresAn).toBe(Math.round((10 * 0.25 * JOURS_PAR_AN) / KWH_PAR_LITRE_GAZOLE));
  });

  it('le même kWh coûte bien plus cher au groupe qu’au réseau', () => {
    // C'est l'argument central de la visite : 250 F contre 114 F.
    const c = coutActuel({ ...base, heuresCoupureJour: 6 });
    expect(c.prixKwhReseau).toBe(114);
    expect(c.prixKwhGroupe).toBe(Math.round(750 / KWH_PAR_LITRE_GAZOLE));
    expect(c.prixKwhGroupe).toBeGreaterThan(c.prixKwhReseau);
  });

  it('sans groupe électrogène, aucune goutte de gazole', () => {
    const c = coutActuel({ ...base, heuresCoupureJour: 12, groupeActif: false });
    expect(c.litresAn).toBe(0);
    expect(c.groupe).toBe(0);
    expect(c.kwhReseauAn).toBe(10 * JOURS_PAR_AN);
  });

  it('une coupure permanente ne dépasse jamais 24 h', () => {
    const c = coutActuel({ ...base, heuresCoupureJour: 48 });
    expect(c.kwhReseauAn).toBe(0);
    expect(c.kwhGroupeAn).toBe(10 * JOURS_PAR_AN);
  });

  it('des entrées vides donnent zéro, jamais NaN', () => {
    const c = coutActuel();
    expect(c.total).toBe(0);
    expect(Number.isFinite(c.litresAn)).toBe(true);
  });
});

describe('economieAnnee et projection — étape 4', () => {
  const base = { coutAnnuel: 1000000, maintenance: 0, hausse: 0.05 };

  it('la première année ne subit ni inflation ni usure', () => {
    expect(economieAnnee(1, base)).toBe(1000000);
  });

  it('l’énergie renchérit, les panneaux s’usent', () => {
    expect(economieAnnee(2, base)).toBe(Math.round(1000000 * 1.05 * (1 - DEGRADATION_ANNUELLE)));
    const sansHausse = { ...base, hausse: 0 };
    expect(economieAnnee(10, sansHausse)).toBeLessThan(economieAnnee(1, sansHausse));
  });

  it('l’entretien suit lui aussi l’inflation', () => {
    expect(economieAnnee(2, { ...base, maintenance: 100000 }))
      .toBe(Math.round(1000000 * 1.05 * (1 - DEGRADATION_ANNUELLE) - 100000 * 1.05));
  });

  it('la projection couvre la durée et décompte le restant dû', () => {
    const p = projection({ investissement: 3000000, coutAnnuel: 1000000, maintenance: 0, hausse: 0, duree: 5 });
    expect(p).toHaveLength(5);
    // Un peu moins de 5 × 1 000 000 : les panneaux perdent 0,5 %/an, même
    // quand le prix de l'énergie, lui, ne bouge pas.
    const attendu = [0, 1, 2, 3, 4].reduce((t, i) => t + Math.round(1000000 * (1 - DEGRADATION_ANNUELLE) ** i), 0);
    expect(p[4].cumul).toBe(attendu);
    expect(p[4].cumul).toBeLessThan(5000000);
    // 3 000 000 à rembourser : il reste un souffle après 3 ans, soldé au 4e.
    expect(p[2].restant).toBeGreaterThan(0);
    expect(p[3].restant).toBe(0);
    expect(p.every((l) => l.restant >= 0)).toBe(true);
  });

  it('durée par défaut : la garantie des panneaux', () => {
    expect(projection({ coutAnnuel: 1 })).toHaveLength(DUREE_SYSTEME_ANS);
  });
});

describe('retourInvestissement', () => {
  const lignes = (cout) => projection({ coutAnnuel: cout, maintenance: 0, hausse: 0, duree: 25 });

  it('donne l’année, fraction comprise', () => {
    expect(retourInvestissement(lignes(1000000), 2500000)).toBe(2.5);
    expect(retourInvestissement(lignes(1000000), 500000)).toBe(0.5);
  });

  it('rend null quand l’installation ne se rembourse JAMAIS', () => {
    expect(retourInvestissement(lignes(100000), 50000000)).toBeNull();
  });

  it('rend null quand l’économie annuelle est négative', () => {
    const p = projection({ coutAnnuel: 10000, maintenance: 500000, duree: 25 });
    expect(retourInvestissement(p, 2000000)).toBeNull();
  });

  it('rend null sans investissement saisi (rien à rentabiliser)', () => {
    expect(retourInvestissement(lignes(1000000), 0)).toBeNull();
  });
});

describe('co2EviteAn', () => {
  it('compte le gazole non brûlé et les kWh non tirés du réseau', () => {
    expect(co2EviteAn({ litresAn: 1000, kwhReseauAn: 2000 }))
      .toBe(Math.round(1000 * CO2_PAR_LITRE_GAZOLE + 2000 * CO2_PAR_KWH_RESEAU));
  });

  it('sans consommation, aucune émission évitée', () => {
    expect(co2EviteAn()).toBe(0);
  });
});

describe('simulerRoi — la chaîne complète', () => {
  const sim = simulerRoi({
    appareils: CLIENT,
    investissement: 2500000,
    heuresCoupureJour: 6,
    tarifKwh: 114,
    prixCarburant: 750,
    groupeActif: true,
  });

  it('chaque étape part du résultat de la précédente', () => {
    // 1 → 2 : ce sont bien les kWh des appareils qui sont facturés.
    expect(sim.conso.total).toBe(7.45);
    expect(sim.cout.kwhAn).toBe(Math.round(7.45 * JOURS_PAR_AN));
    expect(sim.cout.kwhReseauAn + sim.cout.kwhGroupeAn).toBeCloseTo(sim.cout.kwhAn, 0);
    // 2 → 4 : l'économie de l'an 1, c'est ce coût moins l'entretien.
    expect(sim.economieAn1).toBe(sim.cout.total - MAINTENANCE_ANNUELLE);
  });

  it('donne un remboursement plausible pour ce client', () => {
    expect(sim.retourAns).toBeGreaterThan(1);
    expect(sim.retourAns).toBeLessThan(12);
  });

  it('le gain sur la durée déduit l’investissement', () => {
    const cumul = sim.projection[sim.projection.length - 1].cumul;
    expect(sim.gainDuree).toBe(cumul - 2500000);
    expect(sim.roiPct).toBe(Math.round((sim.gainDuree / 2500000) * 100));
  });

  it('sans installation chiffrée, aucun ROI n’est inventé', () => {
    const s = simulerRoi({ appareils: CLIENT, investissement: 0, tarifKwh: 114 });
    expect(s.roiPct).toBeNull();
    expect(s.retourAns).toBeNull();
  });

  it('sans appareil saisi, tout est à zéro — ni NaN ni Infinity', () => {
    const s = simulerRoi();
    expect(s.conso.total).toBe(0);
    expect(s.cout.total).toBe(0);
    expect(s.economieAn1).toBe(-MAINTENANCE_ANNUELLE);
    expect(s.retourAns).toBeNull();
    expect(s.projection.every((l) => Number.isFinite(l.cumul))).toBe(true);
  });

  it('retirer le groupe électrogène réduit l’économie', () => {
    const sansGroupe = simulerRoi({
      appareils: CLIENT, investissement: 2500000, heuresCoupureJour: 6,
      tarifKwh: 114, prixCarburant: 750, groupeActif: false,
    });
    expect(sansGroupe.cout.total).toBeLessThan(sim.cout.total);
  });

  it('la hausse tarifaire par défaut joue bien sur la durée', () => {
    const fige = simulerRoi({
      appareils: CLIENT, investissement: 2500000, heuresCoupureJour: 6,
      tarifKwh: 114, prixCarburant: 750, groupeActif: true, hausse: 0,
    });
    expect(sim.gainDuree).toBeGreaterThan(fige.gainDuree);
    expect(HAUSSE_TARIF_DEFAUT).toBeGreaterThan(0);
  });
});
