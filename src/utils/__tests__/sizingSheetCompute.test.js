// Fiche de dimensionnement — calculs de productible mensuel et de rentabilité.
import { describe, it, expect } from 'vitest';
import {
  couvertureMensuelle, calerProfilSurPireMois, profilPourVille, productionJour,
  productionAnnuelle, calculerRentabilite, libelleRoi, JOURS_MOIS,
} from '../sizingSheet/compute';
import { calculateSystemSize, SIZING_PARAMS, PANEL_REFERENCE_WC } from '../solarSizing';

describe('production mensuelle', () => {
  it('production = puissance installée × rendement des panneaux × ensoleillement', () => {
    // La procédure tient en une ligne : aucune perte système, aucun
    // « productible théorique » en plus du rendement des panneaux.
    expect(productionJour(4.96, 4.3)).toBeCloseTo(4.96 * 0.85 * 4.3, 6);
    expect(productionJour(4.96, 4.3)).toBeCloseTo(4.96 * SIZING_PARAMS.panelEfficiency * 4.3, 6);
  });

  it('le profil est calé pour que son PIRE MOIS égale le HSP retenu (± 0,01)', () => {
    // Le HSP du dossier est celui du pire mois : le caler sur la moyenne
    // comptait la pénalité deux fois et hachurait des systèmes bien taillés.
    const profil = calerProfilSurPireMois(profilPourVille('Lomé'), 4.3);
    expect(Math.min(...profil)).toBeCloseTo(4.3, 2);
    // Tous les autres mois sont au-dessus du pire mois.
    profil.forEach((v) => expect(v).toBeGreaterThanOrEqual(4.3 - 1e-9));
  });

  it('la somme des 12 mois égale la production annuelle (± 2 kWh)', () => {
    const kwc = 4.96;
    const { mois } = couvertureMensuelle({ kwc, hspRetenu: 4.3, ville: 'Lomé', consoJour: 17.6 });
    const somme = mois.reduce((s, m) => s + m.prod, 0);
    expect(Math.abs(somme - productionAnnuelle(kwc, 4.3, 'Lomé'))).toBeLessThanOrEqual(2);
  });

  it('un système dimensionné par le moteur couvre la CONSOMMATION RÉELLE les 12 mois', () => {
    // La couverture se compare à la consommation entière, jamais à une
    // fraction d'elle : avec une seule convention de pertes, un système taillé
    // par le moteur couvre par construction, sans avoir besoin de raboter le
    // besoin. Vérifié sur plusieurs profils, pas seulement le cas témoin.
    const cas = [
      { day: 8.8, night: 8.8 },   // 17,6 kWh/j — climatiseur
      { day: 1.2, night: 0.6 },   // petit foyer
      { day: 0.4, night: 3.4 },   // consommation surtout nocturne
      { day: 24, night: 11 },     // gros site
    ];
    for (const conso of cas) {
      for (const hsp of [4.3, 4.8]) {
        const sizing = calculateSystemSize(conso, 'off-grid', hsp);
        const kwc = (sizing.numberOfPanels * PANEL_REFERENCE_WC) / 1000;
        const { mois, deficitCumule } = couvertureMensuelle({
          kwc, hspRetenu: hsp, ville: 'Lomé', consoJour: conso.day + conso.night,
        });
        mois.forEach((m) => expect(m.deficit).toBe(false));
        expect(deficitCumule).toBe(0);
      }
    }
  });

  it('marque « inférieur au besoin » exactement les mois où prod < besoin', () => {
    const { mois } = couvertureMensuelle({ kwc: 3, hspRetenu: 4.3, ville: 'Lomé', consoJour: 14 });
    mois.forEach((m) => expect(m.deficit).toBe(m.prod < m.besoin));
    // Le creux de saison des pluies est le premier en déficit — en kWh/MOIS,
    // les mois de 30 jours (Juin, Sep) passent sous Juillet (31 jours).
    const parProd = [...mois].sort((a, b) => a.prod - b.prod);
    expect(['Juin', 'Juil', 'Août', 'Sep']).toContain(parProd[0].mois);
  });

  it('le déficit cumulé additionne uniquement les mois déficitaires', () => {
    const { mois, deficitCumule } = couvertureMensuelle({ kwc: 3, hspRetenu: 4.3, ville: 'Lomé', consoJour: 14 });
    const attendu = mois.reduce((s, m) => s + Math.max(0, m.besoin - m.prod), 0);
    expect(deficitCumule).toBeCloseTo(attendu, 6);
    expect(JOURS_MOIS.reduce((a, b) => a + b, 0)).toBe(365);
  });
});

describe('rentabilité — montants recalculés depuis les valeurs affichées', () => {
  // Cas de référence (climatiseur 3 CV) : 17,6 kWh/j, investissement 2 300 000 F.
  const r = calculerRentabilite(17.6, 2300000);

  it('économie annuelle = kWh arrondis × tarif', () => {
    expect(r.kwhAnnuels).toBe(Math.round(17.6 * 0.85 * 365)); // 5 460 kWh
    expect(r.economieAnnuelle).toBe(5460 * 145);              // 791 700 F
  });

  it('l’équivalent mensuel dérive de l’annuel affiché', () => {
    // Le client compare à sa facture : 791 700 ÷ 12 = 65 975 F par mois.
    expect(r.economieMensuelle).toBe(65975);
    expect(r.economieMensuelle * 12).toBeCloseTo(r.economieAnnuelle, 0);
  });

  it('gain net = cumul − investissement − provision − maintenance, sur les montants affichés', () => {
    expect(r.economiesCumulees).toBe(7917000);
    expect(r.maintenanceTotale).toBe(450000); // 50 000 × (10 − 1)
    expect(r.gainNet).toBe(7917000 - 2300000 - 320000 - 450000); // 4 847 000
  });

  it('le ROI en mois satisfait l’inéquation de couverture au mois près', () => {
    expect(r.roiMois).toBe(42); // 3 ans et 6 mois
    expect(libelleRoi(r.roiMois)).toBe('3 ans et 6 mois');
    const couvre = (t) => r.economieAnnuelle * (t / 12) - r.maintenanceAnnuelle * Math.max(0, t / 12 - 1);
    expect(couvre(42)).toBeGreaterThanOrEqual(r.investissement + r.provisionOnduleur);
    expect(couvre(41)).toBeLessThan(r.investissement + r.provisionOnduleur);
  });

  it('sans investissement : ni gain net ni ROI, jamais de NaN', () => {
    const sans = calculerRentabilite(10, null);
    expect(sans.gainNet).toBeNull();
    expect(sans.roiMois).toBeNull();
    expect(sans.economieAnnuelle).toBeGreaterThan(0);
    expect(libelleRoi(null)).toBe('—');
  });

  it('paramètres surchargeables (maintenance dès la 2e année : horizon − 1 annuités)', () => {
    const perso = calculerRentabilite(10, 1000000, { horizon: 5, maintenanceAnnuelle: 20000, tarifElec: 100 });
    expect(perso.maintenanceTotale).toBe(20000 * 4);
    expect(perso.economiesCumulees).toBe(perso.economieAnnuelle * 5);
  });

  it('la production annuelle suit le profil réel de la localité', () => {
    const annuelle = productionAnnuelle(5, 4.3, 'Lomé');
    // Elle dépasse « pire mois × 365 » : les autres mois produisent plus.
    expect(annuelle).toBeGreaterThan(productionJour(5, 4.3) * 365);
    // …sans dépasser le meilleur mois × 365.
    expect(annuelle).toBeLessThan(productionJour(5, 5.3) * 365);
  });
});
