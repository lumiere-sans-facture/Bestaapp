// Fiche de dimensionnement — calculs de productible mensuel et de rentabilité.
import { describe, it, expect } from 'vitest';
import {
  couvertureMensuelle, normaliserProfil, moyennePonderee, profilPourVille,
  productibles, calculerRentabilite, libelleRoi, JOURS_MOIS, RATIO_PRODUCTIBLE_NET,
} from '../sizingSheet/compute';

describe('productible mensuel', () => {
  it('la moyenne pondérée du profil normalisé retombe sur le HSP retenu (± 0,01)', () => {
    const profil = normaliserProfil(profilPourVille('Lomé'), 4.3);
    expect(moyennePonderee(profil)).toBeCloseTo(4.3, 2);
  });

  it('la somme des 12 mois égale le productible net annuel (± 2 kWh)', () => {
    const kwc = 4.96;
    const { mois } = couvertureMensuelle({ kwc, hspRetenu: 4.3, ville: 'Lomé', consoJour: 17.6, tauxUtilisation: 0.85 });
    const somme = mois.reduce((s, m) => s + m.prod, 0);
    expect(Math.abs(somme - productibles(kwc, 4.3).net)).toBeLessThanOrEqual(2);
  });

  it('marque « inférieur au besoin » exactement les mois où prod < besoin', () => {
    const { mois } = couvertureMensuelle({ kwc: 3, hspRetenu: 4.3, ville: 'Lomé', consoJour: 12, tauxUtilisation: 0.85 });
    mois.forEach((m) => expect(m.deficit).toBe(m.prod < m.besoin));
    // Le creux de saison des pluies (juillet-août) est le premier en déficit.
    const parProd = [...mois].sort((a, b) => a.prod - b.prod);
    expect(['Juil', 'Août']).toContain(parProd[0].mois);
  });

  it('le déficit cumulé additionne uniquement les mois déficitaires', () => {
    const { mois, deficitCumule } = couvertureMensuelle({ kwc: 3, hspRetenu: 4.3, ville: 'Lomé', consoJour: 12, tauxUtilisation: 0.85 });
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

  it('le productible net applique le ratio de pertes système', () => {
    const p = productibles(5, 4.3);
    expect(p.theorique).toBe(Math.round(5 * 4.3 * 365));
    expect(p.net).toBe(Math.round(p.theorique * RATIO_PRODUCTIBLE_NET));
  });
});
