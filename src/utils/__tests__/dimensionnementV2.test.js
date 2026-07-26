import { describe, it, expect } from 'vitest';
import {
  dimensionner, bilanConsommation, chaineRendement, sectionCable, choisirOnduleur,
  configurationStrings, irradiationDeDimensionnement, normaliserEquipement,
  vocFroid, vmpChaud, fmt, alertesBloquantes, DEFAUTS,
} from '../dimensionnementV2';

// Site complet : productible mensuel PVGIS (kWh/kWc/jour), août le plus faible.
const SITE = {
  nom: 'Parakou',
  productibleMensuel: [5.1, 5.3, 5.2, 4.9, 4.7, 4.3, 4.0, 3.9, 4.4, 4.8, 5.0, 5.0],
  source: 'PVGIS',
};

const PANNEAU = {
  puissanceWc: 620, voc: 41.5, vmp: 34.5, isc: 18.9, imp: 17.9,
  coeffVoc: -0.27, coeffVmp: -0.35,
};

const ONDULEURS = [
  { id: '3k', kva: 3, puissanceW: 3000, surgeW: 6000, pvMaxWc: 4000, vDcMax: 500, vMpptMin: 120, iMppt: 26, iChargeMax: 60 },
  { id: '5k', kva: 5, puissanceW: 5000, surgeW: 10000, pvMaxWc: 6500, vDcMax: 500, vMpptMin: 120, iMppt: 26, iChargeMax: 110 },
  { id: '8k', kva: 8, puissanceW: 8000, surgeW: 16000, pvMaxWc: 10400, vDcMax: 550, vMpptMin: 150, iMppt: 26, iChargeMax: 190 },
];

const BATTERIE = { capaciteKwh: 5, dod: 0.8, rendement: 0.975, cRateChargeMax: 0.5 };

/** Cas de référence : 17,60 kWh/jour dont 8,80 nocturne, parc 48 V. */
const casReference = (surcharges = {}) => dimensionner({
  equipements: [
    { nom: 'Charges de journée', puissanceW: 4400, quantite: 1, heuresJour: 2, heuresNuit: 0 },
    { nom: 'Charges de nuit', puissanceW: 2200, quantite: 1, heuresJour: 0, heuresNuit: 4 },
  ],
  site: SITE,
  tensionSysteme: 48,
  distances: { pvOnduleurM: 25, batterieOnduleurM: 3, onduleurTableauM: 12 },
  materiel: { panneau: PANNEAU, batterie: BATTERIE, catalogueOnduleurs: ONDULEURS },
  ...surcharges,
});

describe('cas de référence — 17,60 kWh/jour dont 8,80 nocturne, 48 V', () => {
  const r = casReference();

  it('sépare bien les deux flux de consommation', () => {
    expect(r.consommation.jourKwh).toBe(8.8);
    expect(r.consommation.nuitKwh).toBe(8.8);
    expect(r.consommation.totalKwh).toBe(17.6);
  });

  it('applique un rendement de nuit INFÉRIEUR au rendement de jour', () => {
    // Le flux nocturne traverse en plus le stockage.
    expect(r.rendements.etaNuit).toBeLessThan(r.rendements.etaJour);
    expect(r.rendements.etaNuit).toBeCloseTo(r.rendements.etaJour * r.rendements.rendementBatterie, 4);
  });

  it('somme deux flux corrigés SÉPARÉMENT (et non le total corrigé une fois)', () => {
    const jour = r.consommation.jourKwh / r.rendements.etaJour;
    const nuit = r.consommation.nuitKwh / r.rendements.etaNuit;
    expect(r.energie.jourAProduire).toBeCloseTo(jour, 2);
    expect(r.energie.nuitAProduire).toBeCloseTo(nuit, 2);
    expect(r.energie.totalAProduire).toBeCloseTo(jour + nuit, 2);
    // Une correction unique au rendement de jour sous-estimerait le besoin.
    const correctionUnique = r.consommation.totalKwh / r.rendements.etaJour;
    expect(r.energie.totalAProduire).toBeGreaterThan(correctionUnique);
  });

  it('dimensionne le parc batterie sur la consommation nocturne, à 48 V', () => {
    expect(r.batterie.baseKwh).toBe(8.8);
    expect(r.batterie.tension).toBe(48);
    // C = 8,8 ÷ (0,8 × 0,975) = 11,28 kWh → 235 Ah sous 48 V
    expect(r.batterie.capaciteBruteKwh).toBeCloseTo(11.28, 1);
    expect(r.batterie.capaciteAh).toBe(Math.round((r.batterie.capaciteBruteKwh * 1000) / 48));
  });

  it('cale l’irradiation sur le mois le plus défavorable, nommé', () => {
    expect(r.irradiation.moisNom).toBe('août');
    expect(r.irradiation.productible).toBe(3.9);
    expect(r.irradiation.mention).toMatch(/mois le plus défavorable/i);
  });
});

describe('non-régression câble — facteur 2 aller-retour', () => {
  it('cas Victron : 70 A / 48 V / chute 1 % / 3 m → 16 mm²', () => {
    const c = sectionCable({ longueurM: 3, courantA: 70, tensionV: 48, chutePct: 0.01 });
    // Si ce test passe à 10 mm², le facteur 2 (aller + retour) a sauté.
    expect(c.sectionMm2).toBe(16);
  });

  it('sans le facteur 2, la section calculée serait deux fois plus faible', () => {
    const c = sectionCable({ longueurM: 3, courantA: 70, tensionV: 48, chutePct: 0.01 });
    const sansFacteur = (3 * 70 * DEFAUTS.resistiviteCuivre) / (48 * 0.01);
    expect(c.sectionCalculeeMm2).toBeCloseTo(sansFacteur * 2, 1);
    expect(sansFacteur).toBeLessThan(10); // ← retomberait sur 10 mm²
  });

  it('retient le courant admissible quand il est plus contraignant que la chute', () => {
    const c = sectionCable({ longueurM: 1, courantA: 150, tensionV: 48, chutePct: 0.03 });
    expect(c.critere).toBe('courant admissible');
    expect(c.sectionMm2).toBeGreaterThanOrEqual(50);
  });
});

describe('anti-double-comptage de l’irradiation', () => {
  it('n’applique pas le rendement des modules en méthode pvgis (déjà inclus)', () => {
    const pvgis = chaineRendement({ methode: 'pvgis' });
    const hsp = chaineRendement({ methode: 'hsp' });
    expect(pvgis.etaJour).toBeGreaterThan(hsp.etaJour);
    // La chaîne pvgis ne contient ni température, ni conversion DC/AC.
    const cles = pvgis.chaine.map((p) => p.cle);
    expect(cles).not.toContain('temperature');
    expect(cles).not.toContain('onduleurDCAC');
    expect(hsp.chaine.map((p) => p.cle)).toContain('temperature');
  });

  it('n’appelle jamais le Performance Ratio « rendement des panneaux »', () => {
    const { mention } = chaineRendement({ methode: 'hsp' });
    expect(mention).not.toMatch(/rendement des panneaux/i);
    expect(mention).toMatch(/Performance Ratio/);
    // Un module fait ~21 % : le PR système, lui, tourne autour de 75 %.
    expect(chaineRendement({ methode: 'hsp' }).etaJour).toBeGreaterThan(0.7);
    expect(chaineRendement({ methode: 'hsp' }).etaJour).toBeLessThan(0.8);
  });
});

describe('onduleur — piloté par les charges, le PV ne fait que filtrer', () => {
  it('ne surdimensionne pas un onduleur à cause d’un grand champ PV', () => {
    const o = choisirOnduleur({
      puissanceSimultanee: 900,       // charges faibles
      puissanceAppelDemarrage: 1500,
      pvInstalleWc: 12400,            // champ PV très supérieur
      catalogue: ONDULEURS,
    });
    // La puissance de charge pilote : 900 × 1,2 = 1 080 W → le 3 kVA suffit.
    expect(o.retenu.id).toBe('3k');
    expect(o.puissanceContinueRequiseW).toBe(1080);
    // Le champ PV dépasse l'entrée du modèle retenu : c'est signalé, pas corrigé
    // par un calibre supérieur.
    expect(o.pvCompatible).toBe(false);
  });

  it('signale le dépassement d’entrée PV sans changer de calibre', () => {
    const r = dimensionner({
      equipements: [{ nom: 'Éclairage', puissanceW: 300, quantite: 1, heuresJour: 2, heuresNuit: 3 }],
      site: SITE,
      materiel: { panneau: PANNEAU, batterie: BATTERIE, catalogueOnduleurs: ONDULEURS, nbPanneauxImpose: 20 },
    });
    expect(r.onduleur.retenu.id).toBe('3k');
    expect(r.alertes.map((a) => a.code)).toContain('pv-max-depasse');
    expect(alertesBloquantes(r).map((a) => a.code)).not.toContain('pv-max-depasse');
  });

  it('dimensionne sur la pointe simultanée et l’appel au démarrage, pas sur les Wc', () => {
    const b = bilanConsommation([
      { nom: 'Climatiseur', puissanceW: 1100, quantite: 2, heuresJour: 3, heuresNuit: 4, demarrage: true },
      { nom: 'Téléviseur', puissanceW: 50, quantite: 1, heuresJour: 3, heuresNuit: 2 },
    ], { coefficientSimultaneite: 0.75 });
    expect(b.puissanceCrete).toBe(2250);
    expect(b.puissanceSimultanee).toBe(1688); // 2 250 × 0,75
    // Un seul moteur démarre à la fois : + (3 - 1) × 1 100
    expect(b.puissanceAppelDemarrage).toBe(1688 + 2200);
  });

  it('applique le facteur de puissance 1 (kVA × 1000, jamais × 800)', () => {
    const o = choisirOnduleur({
      puissanceSimultanee: 4200, puissanceAppelDemarrage: 6000, pvInstalleWc: 5000,
      catalogue: [{ id: '6k', kva: 6, surgeW: 12000, pvMaxWc: 9000 }],
    });
    expect(o.retenu.puissanceW).toBe(6000); // et non 4 800
  });
});

describe('alerte bloquante — configuration de strings impossible', () => {
  const resultat = dimensionner({
    equipements: [
      { nom: 'Charges', puissanceW: 2000, quantite: 1, heuresJour: 3, heuresNuit: 3 },
    ],
    site: SITE,
    materiel: {
      panneau: PANNEAU, batterie: BATTERIE, catalogueOnduleurs: ONDULEURS,
      nbPanneauxImpose: 17, // nombre premier, hors plage série admissible (5 à 11)
    },
  });

  it('produit une alerte bloquante', () => {
    const bloquantes = alertesBloquantes(resultat);
    expect(bloquantes.map((a) => a.code)).toContain('strings-impossible');
    expect(resultat.bloquant).toBe(true);
  });

  it('explique le nombre de modules admissible en série', () => {
    const a = resultat.alertes.find((x) => x.code === 'strings-impossible');
    expect(a.message).toMatch(/17 panneaux/);
    expect(a.message).toMatch(/en série/);
  });

  it('accepte en revanche un nombre de panneaux compatible', () => {
    const ok = dimensionner({
      equipements: [{ nom: 'Charges', puissanceW: 2000, quantite: 1, heuresJour: 3, heuresNuit: 3 }],
      site: SITE,
      materiel: { panneau: PANNEAU, batterie: BATTERIE, catalogueOnduleurs: ONDULEURS, nbPanneauxImpose: 16 },
    });
    expect(ok.verifications.strings.possible).toBe(true);
    expect(ok.verifications.strings.serie * ok.verifications.strings.parallele).toBe(16);
    expect(alertesBloquantes(ok)).toHaveLength(0);
  });
});

describe('configuration des strings', () => {
  it('corrige Voc au froid (tension qui MONTE) et Vmp à chaud (tension qui BAISSE)', () => {
    expect(vocFroid(41.5, -0.27, 15)).toBeGreaterThan(41.5);
    expect(vmpChaud(34.5, -0.35, 70)).toBeLessThan(34.5);
  });

  it('refuse une plage série vide', () => {
    const c = configurationStrings({
      nbPanneaux: 8, panneau: PANNEAU,
      onduleur: { vDcMax: 60, vMpptMin: 50, iMppt: 26 }, // plage inatteignable
    });
    expect(c.possible).toBe(false);
    expect(c.raison).toBe('plage-serie-vide');
  });

  it('reste neutre quand les caractéristiques manquent', () => {
    const c = configurationStrings({ nbPanneaux: 8, panneau: { puissanceWc: 620 }, onduleur: {} });
    expect(c.possible).toBeNull();
    expect(c.raison).toBe('caracteristiques-manquantes');
  });
});

describe('irradiation', () => {
  it('retient le minimum mensuel en stratégie « mois défavorable »', () => {
    const i = irradiationDeDimensionnement(SITE, 'mois-defavorable');
    expect(i.productible).toBe(3.9);
    expect(i.methode).toBe('pvgis');
    expect(i.complet).toBe(true);
  });

  it('avertit explicitement en stratégie « moyenne annuelle »', () => {
    const i = irradiationDeDimensionnement(SITE, 'moyenne-annuelle');
    expect(i.productible).toBeGreaterThan(3.9);
    expect(i.mention).toMatch(/déficit/i);
    const r = dimensionner({
      equipements: [{ nom: 'C', puissanceW: 1000, quantite: 1, heuresJour: 2, heuresNuit: 2 }],
      site: SITE, strategieIrradiation: 'moyenne-annuelle',
      materiel: { panneau: PANNEAU, batterie: BATTERIE, catalogueOnduleurs: ONDULEURS },
    });
    expect(r.alertes.map((a) => a.code)).toContain('strategie-moyenne');
  });

  it('bascule en méthode dégradée sans série mensuelle, et le signale', () => {
    const i = irradiationDeDimensionnement({ nom: 'Cotonou', productibleMensuel: null }, 'mois-defavorable', 5);
    expect(i.methode).toBe('hsp');
    expect(i.complet).toBe(false);
    expect(i.mention).toMatch(/saison des pluies/i);
  });
});

describe('base d’autonomie', () => {
  it('« journée complète » exige plus de capacité que « nuit seule »', () => {
    const nuit = casReference({ baseAutonomie: 'nuit' });
    const journee = casReference({ baseAutonomie: 'journee-complete' });
    expect(journee.batterie.capaciteBruteKwh).toBeGreaterThan(nuit.batterie.capaciteBruteKwh);
    expect(journee.batterie.baseKwh).toBe(17.6);
    expect(journee.alertes.map((a) => a.code)).toContain('autonomie-journee');
  });

  it('multiplie la capacité par le nombre de jours d’autonomie', () => {
    const un = casReference({ joursAutonomie: 1 });
    const deux = casReference({ joursAutonomie: 2 });
    expect(deux.batterie.capaciteBruteKwh).toBeCloseTo(un.batterie.capaciteBruteKwh * 2, 1);
  });
});

describe('écart puissance PV minimale → installée', () => {
  it('justifie l’écart par le pas du matériel, pas par un coefficient occulte', () => {
    const r = casReference({
      materiel: {
        panneau: PANNEAU, batterie: BATTERIE, catalogueOnduleurs: ONDULEURS,
        nbPanneauxImpose: 12, kitNom: 'Kit 20 kWh',
      },
    });
    expect(r.pv.justification).toMatch(/Kit 20 kWh/);
    expect(r.pv.justification).toMatch(/écart/i);
    expect(r.pv.justification).toMatch(/pas du matériel/i);
    expect(r.pv.puissanceInstalleeW).toBe(12 * 620);
  });

  it('alerte quand le champ installé est nettement insuffisant', () => {
    const r = casReference({
      materiel: {
        panneau: PANNEAU, batterie: BATTERIE, catalogueOnduleurs: ONDULEURS, nbPanneauxImpose: 2,
      },
    });
    expect(r.alertes.map((a) => a.code)).toContain('pv-insuffisant');
  });
});

describe('compatibilité ascendante des charges', () => {
  it('bascule un total d’heures en heures de journée et le signale', () => {
    const e = normaliserEquipement({ name: 'Frigo', power: 250, quantity: 1, hours: 12 });
    expect(e.heuresJour).toBe(12);
    expect(e.heuresNuit).toBe(0);
    expect(e.repartitionAVerifier).toBe(true);
  });

  it('respecte une répartition déjà renseignée', () => {
    const e = normaliserEquipement({ nom: 'Frigo', puissanceW: 250, heuresJour: 12, heuresNuit: 12 });
    expect(e.repartitionAVerifier).toBe(false);
    expect(e.heuresNuit).toBe(12);
  });

  it('remonte l’alerte de répartition dans le dimensionnement', () => {
    const r = dimensionner({
      equipements: [{ name: 'Frigo', power: 250, quantity: 1, hours: 12 }],
      site: SITE,
      materiel: { panneau: PANNEAU, batterie: BATTERIE, catalogueOnduleurs: ONDULEURS },
    });
    expect(r.alertes.map((a) => a.code)).toContain('repartition-jour-nuit');
  });
});

describe('C-rate du parc batterie', () => {
  it('alerte quand le courant de charge de l’onduleur dépasse le C-rate admissible', () => {
    const r = casReference();
    // 8 kVA retenu (charges 6 600 W × 0,75 × 1,2 = 5 940 W) → 190 A de charge
    // sur un parc de 15 kWh / 48 V = 312 Ah → 0,61 C > 0,5 C
    expect(r.batterie.tauxChargeC).toBeGreaterThan(0.5);
    expect(r.alertes.map((a) => a.code)).toContain('c-rate-depasse');
  });
});

describe('formatage — fin de la fausse précision', () => {
  it('arrondit les puissances crête au dixième de kWc', () => {
    expect(fmt.kwc(4889)).toBe('4,9 kWc');
    expect(fmt.kwc(12400)).toBe('12,4 kWc');
  });

  it('arrondit les énergies au dixième de kWh', () => {
    expect(fmt.kwh(12.941)).toBe('12,9 kWh');
    expect(fmt.kwhJour(17.6)).toBe('17,6 kWh/jour');
  });

  it('sépare les milliers par des espaces et utilise la virgule décimale', () => {
    expect(fmt.w(4500)).toBe('4 500 W');
    expect(fmt.num(1234567)).toBe('1 234 567');
    expect(fmt.pct(0.7539)).toBe('75,4 %');
    expect(fmt.productible(3.9)).toBe('3,90 kWh/kWc/jour');
  });
});
