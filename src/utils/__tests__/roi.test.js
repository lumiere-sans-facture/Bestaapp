import { describe, it, expect } from 'vitest';
import {
  coutActuel, economieNette, economieAnnee, projection, retourInvestissement,
  co2EviteAn, consommationGroupe, simulerRoi,
  JOURS_PAR_AN, MOIS_PAR_AN, DUREE_SYSTEME_ANS, TAUX_COUVERTURE_DEFAUT,
  MAINTENANCE_ANNUELLE, HAUSSE_TARIF_DEFAUT, DEGRADATION_ANNUELLE,
  CO2_PAR_LITRE_GAZOLE, CO2_PAR_KWH_RESEAU, LITRES_PAR_KVA_HEURE,
} from '../roi';

// Cas de référence : un client de Lomé, 60 000 F de facture CEET par mois,
// groupe 5 kVA tournant 6 h par jour à 750 F le litre.
const CLIENT = {
  factureMensuelle: 60000,
  groupeActif: true,
  heuresCoupureJour: 6,
  prixCarburant: 750,
  consommationLh: 1.5,
};

describe('coutActuel', () => {
  it('décompose réseau et carburant sur l’année', () => {
    const c = coutActuel(CLIENT);
    expect(c.reseau).toBe(60000 * MOIS_PAR_AN);        // 720 000
    expect(c.litresAn).toBe(6 * JOURS_PAR_AN * 1.5);   // 3 285 L
    expect(c.carburant).toBe(3285 * 750);              // 2 463 750
    expect(c.total).toBe(c.reseau + c.carburant);
  });

  it('sans groupe électrogène, seul le réseau compte', () => {
    const c = coutActuel({ ...CLIENT, groupeActif: false });
    expect(c.carburant).toBe(0);
    expect(c.litresAn).toBe(0);
    expect(c.total).toBe(720000);
  });

  it('des entrées vides ou absurdes donnent zéro, jamais NaN', () => {
    expect(coutActuel().total).toBe(0);
    expect(coutActuel({ factureMensuelle: -5000, groupeActif: true, heuresCoupureJour: 'x' }).total).toBe(0);
  });
});

describe('economieNette', () => {
  it('applique le taux de couverture et retranche l’entretien', () => {
    expect(economieNette(1000000, 0.8, 15000)).toBe(800000 - 15000);
  });

  it('reste NÉGATIVE quand l’entretien dépasse l’économie', () => {
    // Le simulateur doit pouvoir annoncer qu'un projet ne rapporte rien —
    // arrondir à zéro maquillerait une mauvaise affaire.
    expect(economieNette(10000, 0.8, 15000)).toBe(-7000);
  });

  it('borne le taux de couverture entre 0 et 100 %', () => {
    expect(economieNette(1000000, 1.5, 0)).toBe(1000000);
    expect(economieNette(1000000, -1, 0)).toBe(0);
  });
});

describe('economieAnnee', () => {
  const base = { coutAnnuel: 1000000, tauxCouverture: 1, maintenance: 0, hausse: 0.05 };

  it('la première année ne subit ni inflation ni usure', () => {
    expect(economieAnnee(1, base)).toBe(1000000);
  });

  it('l’énergie renchérit d’année en année', () => {
    // 1 000 000 × 1,05 × (1 − 0,005) = 1 044 750
    expect(economieAnnee(2, base)).toBe(Math.round(1000000 * 1.05 * (1 - DEGRADATION_ANNUELLE)));
    expect(economieAnnee(2, base)).toBeGreaterThan(economieAnnee(1, base));
  });

  it('les panneaux perdent du rendement (sans hausse, l’économie baisse)', () => {
    const sansHausse = { ...base, hausse: 0 };
    expect(economieAnnee(10, sansHausse)).toBeLessThan(economieAnnee(1, sansHausse));
    expect(economieAnnee(25, sansHausse)).toBe(Math.round(1000000 * (1 - DEGRADATION_ANNUELLE) ** 24));
  });

  it('l’entretien suit lui aussi l’inflation', () => {
    const avecEntretien = { ...base, maintenance: 100000 };
    expect(economieAnnee(2, avecEntretien))
      .toBe(Math.round(1000000 * 1.05 * (1 - DEGRADATION_ANNUELLE) - 100000 * 1.05));
  });
});

describe('projection', () => {
  it('couvre toute la durée, cumule les économies et décompte le restant dû', () => {
    const p = projection({ investissement: 3000000, coutAnnuel: 1000000, tauxCouverture: 1, maintenance: 0, hausse: 0, duree: 5 });
    expect(p).toHaveLength(5);
    expect(p[0].annee).toBe(1);
    expect(p[4].cumul).toBe(p.reduce((s, l) => s + l.economie, 0));
    expect(p[0].restant).toBeGreaterThan(p[4].restant);
  });

  it('le restant dû ne devient jamais négatif', () => {
    const p = projection({ investissement: 100000, coutAnnuel: 1000000, tauxCouverture: 1, maintenance: 0, duree: 5 });
    expect(p.every((l) => l.restant >= 0)).toBe(true);
    expect(p[4].restant).toBe(0);
  });

  it('durée par défaut : la garantie des panneaux', () => {
    expect(projection({ coutAnnuel: 1 })).toHaveLength(DUREE_SYSTEME_ANS);
  });
});

describe('retourInvestissement', () => {
  const lignes = (invest, cout) => projection({ investissement: invest, coutAnnuel: cout, tauxCouverture: 1, maintenance: 0, hausse: 0, duree: 25 });

  it('donne l’année, fraction comprise', () => {
    // 2 500 000 remboursés à 1 000 000/an → 2,5 ans
    expect(retourInvestissement(lignes(2500000, 1000000), 2500000)).toBe(2.5);
  });

  it('un investissement remboursé dès la première année', () => {
    expect(retourInvestissement(lignes(500000, 1000000), 500000)).toBe(0.5);
  });

  it('rend null quand l’installation ne se rembourse JAMAIS sur la durée', () => {
    // 50 millions face à 100 000 F d'économie par an : jamais remboursé.
    expect(retourInvestissement(lignes(50000000, 100000), 50000000)).toBeNull();
  });

  it('rend null quand l’économie annuelle est négative', () => {
    const p = projection({ investissement: 2000000, coutAnnuel: 10000, tauxCouverture: 0.8, maintenance: 500000, duree: 25 });
    expect(retourInvestissement(p, 2000000)).toBeNull();
  });

  it('rend null sans investissement saisi (rien à rentabiliser)', () => {
    expect(retourInvestissement(lignes(0, 1000000), 0)).toBeNull();
  });
});

describe('co2EviteAn', () => {
  it('compte le gazole non brûlé et les kWh non tirés du réseau', () => {
    const kg = co2EviteAn({ litresAn: 1000, kwhReseauAn: 2000, tauxCouverture: 1 });
    expect(kg).toBe(Math.round(1000 * CO2_PAR_LITRE_GAZOLE + 2000 * CO2_PAR_KWH_RESEAU));
  });

  it('au prorata de ce que le solaire couvre réellement', () => {
    const total = co2EviteAn({ litresAn: 1000, tauxCouverture: 1 });
    expect(co2EviteAn({ litresAn: 1000, tauxCouverture: 0.5 })).toBe(Math.round(total * 0.5));
  });
});

describe('consommationGroupe', () => {
  it('un 5 kVA consomme environ 1,5 L/h', () => {
    expect(consommationGroupe(5)).toBe(5 * LITRES_PAR_KVA_HEURE);
    expect(consommationGroupe(5)).toBe(1.5);
  });

  it('une puissance absente ou absurde ne casse rien', () => {
    expect(consommationGroupe(0)).toBe(0);
    expect(consommationGroupe(-3)).toBe(0);
    expect(consommationGroupe('abc')).toBe(0);
  });
});

describe('simulerRoi (cas complet)', () => {
  const sim = simulerRoi({ ...CLIENT, investissement: 4000000, tarifKwh: 114 });

  it('reprend la décomposition du coût actuel', () => {
    expect(sim.cout.total).toBe(720000 + 2463750);
  });

  it('l’économie de l’année 1 suit le taux de couverture par défaut', () => {
    expect(sim.economieAn1).toBe(Math.round(sim.cout.total * TAUX_COUVERTURE_DEFAUT) - MAINTENANCE_ANNUELLE);
  });

  it('le retour sur investissement est plausible (entre 1 et 5 ans ici)', () => {
    expect(sim.retourAns).toBeGreaterThan(1);
    expect(sim.retourAns).toBeLessThan(5);
  });

  it('le gain sur la durée déduit bien l’investissement', () => {
    const cumul = sim.projection[sim.projection.length - 1].cumul;
    expect(sim.gainDuree).toBe(cumul - 4000000);
    expect(sim.roiPct).toBe(Math.round((sim.gainDuree / 4000000) * 100));
  });

  it('convertit la facture en kWh réseau pour le calcul du CO₂', () => {
    expect(sim.kwhReseauAn).toBe(Math.round((60000 * MOIS_PAR_AN) / 114));
    expect(sim.co2AnKg).toBeGreaterThan(0);
    expect(sim.co2DureeT).toBeCloseTo((sim.co2AnKg * DUREE_SYSTEME_ANS) / 1000, 1);
  });

  it('sans investissement, aucun ROI n’est annoncé plutôt qu’une division par zéro', () => {
    const s = simulerRoi({ ...CLIENT, investissement: 0, tarifKwh: 114 });
    expect(s.roiPct).toBeNull();
    expect(s.retourAns).toBeNull();
    expect(Number.isFinite(s.gainDuree)).toBe(true);
  });

  it('un formulaire vide ne produit ni NaN ni Infinity', () => {
    const s = simulerRoi();
    expect(s.cout.total).toBe(0);
    expect(s.economieAn1).toBe(-MAINTENANCE_ANNUELLE);
    expect(s.retourAns).toBeNull();
    expect(s.roiPct).toBeNull();
    expect(s.projection.every((l) => Number.isFinite(l.cumul))).toBe(true);
  });

  it('la hausse tarifaire par défaut est bien appliquée', () => {
    const sansHausse = simulerRoi({ ...CLIENT, investissement: 4000000, tarifKwh: 114, hausse: 0 });
    expect(sim.gainDuree).toBeGreaterThan(sansHausse.gainDuree);
    expect(HAUSSE_TARIF_DEFAUT).toBeGreaterThan(0);
  });
});
