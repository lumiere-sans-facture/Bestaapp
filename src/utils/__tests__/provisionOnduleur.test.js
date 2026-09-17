// La provision de remplacement doit valoir l'onduleur DU DEVIS. Un montant
// fixe provisionnait 320 000 F pour un 12 kVA à 1 100 000 comme pour un
// 3 kVA à 160 000 : la rentabilité annoncée au client était fausse des deux
// côtés, trop optimiste sur le gros, trop pessimiste sur le petit.
import { describe, it, expect } from 'vitest';
import { provisionOnduleurDuDevis, calculerRentabilite, RENTA_DEFAUTS } from '../sizingSheet/compute';
import { buildKitQuotation } from '../solarSizing';
import { SOLAR_KITS } from '../../data/kits';

describe('provisionOnduleurDuDevis', () => {
  it('lit un devis de kit (name / totalPrice)', () => {
    const kit = SOLAR_KITS.find((k) => k.id === 'kit-48kwh');
    const devis = buildKitQuotation(kit);
    expect(provisionOnduleurDuDevis(devis.components)).toBe(1100000);
  });

  it('lit une ligne Pro (designation / qty / pu)', () => {
    expect(provisionOnduleurDuDevis([
      { designation: 'Panneau 620 Wc', qty: 24, pu: 74800 },
      { designation: 'Onduleur Hybride 6kva Itel Energy', qty: 1, pu: 290000 },
    ])).toBe(290000);
  });

  it('compte deux onduleurs en parallèle pour deux', () => {
    expect(provisionOnduleurDuDevis([
      { designation: 'Onduleur hybride 6kVA Deye', qty: 2, pu: 390000 },
    ])).toBe(780000);
  });

  it('ne ramasse PAS un accessoire qui mentionne l’onduleur', () => {
    expect(provisionOnduleurDuDevis([
      { designation: 'Module dongle Wi-Fi pour onduleur Felicity', qty: 1, pu: 40000 },
      { designation: 'Contrôleur de charge MPPT Felicity', qty: 1, pu: 60000 },
    ])).toBeNull();
  });

  it('rend null quand le devis n’a pas d’onduleur — au repli de jouer', () => {
    expect(provisionOnduleurDuDevis([])).toBeNull();
    expect(provisionOnduleurDuDevis()).toBeNull();
    expect(provisionOnduleurDuDevis([{ designation: 'Batterie 10 kWh', qty: 1, pu: 850000 }])).toBeNull();
  });
});

describe('effet sur la rentabilité', () => {
  const consoJour = 48.37;
  const investissement = 8538700;

  it('un onduleur cher allonge le retour sur investissement', () => {
    const parDefaut = calculerRentabilite(consoJour, investissement, {});
    const reel = calculerRentabilite(consoJour, investissement, { provisionOnduleur: 1100000 });
    expect(parDefaut.provisionOnduleur).toBe(RENTA_DEFAUTS.provisionOnduleur);
    expect(reel.provisionOnduleur).toBe(1100000);
    expect(reel.gainNet).toBe(parDefaut.gainNet - (1100000 - RENTA_DEFAUTS.provisionOnduleur));
    expect(reel.roiMois).toBeGreaterThan(parDefaut.roiMois);
  });

  it('un onduleur bon marché le raccourcit', () => {
    const parDefaut = calculerRentabilite(consoJour, investissement, {});
    const reel = calculerRentabilite(consoJour, investissement, { provisionOnduleur: 160000 });
    expect(reel.gainNet).toBeGreaterThan(parDefaut.gainNet);
    expect(reel.roiMois).toBeLessThanOrEqual(parDefaut.roiMois);
  });
});
