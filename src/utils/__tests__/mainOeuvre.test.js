// La main d'œuvre vaut le double au Togo. Deux signaux la déclenchent, et
// aucun ne doit se déclencher à tort : doubler la pose d'un client béninois
// est une erreur de facturation qui se voit sur le devis remis en main propre.
import { describe, it, expect } from 'vitest';
import { coefficientMainOeuvre, estChantierAuTogo, estNumeroTogolais, COEFFICIENT_MAIN_OEUVRE_TOGO } from '../mainOeuvre';
import { buildKitQuotation } from '../solarSizing';
import { SOLAR_KITS } from '../../data/kits';

describe('estNumeroTogolais', () => {
  it('reconnaît un numéro togolais, écrit comme on veut', () => {
    expect(estNumeroTogolais('+228 90 12 34 56')).toBe(true);
    expect(estNumeroTogolais('00228 90123456')).toBe(true);
    expect(estNumeroTogolais('90 12 34 56')).toBe(true); // saisie locale, 8 chiffres
  });

  it('ne prend PAS un Béninois pour un Togolais', () => {
    expect(estNumeroTogolais('+229 01 61 73 29 56')).toBe(false);
    expect(estNumeroTogolais('0161732956')).toBe(false); // plan béninois, 10 chiffres
    expect(estNumeroTogolais('00229 0161732956')).toBe(false);
  });

  it('dans le doute, ne surfacture pas', () => {
    expect(estNumeroTogolais('')).toBe(false);
    expect(estNumeroTogolais(null)).toBe(false);
    expect(estNumeroTogolais('12345')).toBe(false);
    expect(estNumeroTogolais('+33 6 12 34 56 78')).toBe(false);
  });
});

describe('estChantierAuTogo — la ville OU le numéro suffit', () => {
  it('ville togolaise seule', () => {
    expect(estChantierAuTogo({ ville: 'Lomé' })).toBe(true);
    expect(estChantierAuTogo({ ville: 'Kara, Togo' })).toBe(true);
    expect(estChantierAuTogo({ ville: 'Quelque part', pays: 'TG' })).toBe(true);
  });

  it('numéro togolais seul, même sans ville reconnue', () => {
    expect(estChantierAuTogo({ ville: 'Village inconnu', telephone: '+22890123456' })).toBe(true);
  });

  it('ni l’un ni l’autre : chantier béninois', () => {
    expect(estChantierAuTogo({ ville: 'Cotonou', telephone: '+2290161732956' })).toBe(false);
    expect(estChantierAuTogo({})).toBe(false);
  });

  it('la ville béninoise ne désamorce pas un numéro togolais — un seul signal suffit', () => {
    expect(estChantierAuTogo({ ville: 'Cotonou', telephone: '+22890123456' })).toBe(true);
  });
});

describe('coefficientMainOeuvre', () => {
  it('vaut 2 au Togo et 1 au Bénin', () => {
    expect(coefficientMainOeuvre({ ville: 'Lomé' })).toBe(COEFFICIENT_MAIN_OEUVRE_TOGO);
    expect(coefficientMainOeuvre({ ville: 'Lomé' })).toBe(2);
    expect(coefficientMainOeuvre({ ville: 'Cotonou' })).toBe(1);
  });
});

describe('devis d’un kit — ce que le coefficient touche, et ce qu’il ne touche pas', () => {
  const kit = SOLAR_KITS.find((k) => k.lines.some((l) => l.labor));

  it('double la main d’œuvre, et elle seule', () => {
    const benin = buildKitQuotation(kit, 'tole', true, null, [], [], 1);
    const togo = buildKitQuotation(kit, 'tole', true, null, [], [], 2);
    expect(togo.installationCost).toBe(benin.installationCost * 2);
    expect(togo.equipmentCost).toBe(benin.equipmentCost); // le matériel ne bouge pas
    expect(togo.total).toBe(benin.total + benin.installationCost);
  });

  it('le prix unitaire affiché sur la ligne est bien le prix doublé', () => {
    const benin = buildKitQuotation(kit, 'tole', true, null, [], [], 1).prestations[0];
    const togo = buildKitQuotation(kit, 'tole', true, null, [], [], 2).prestations[0];
    expect(togo.unitPrice).toBe(benin.unitPrice * 2);
    expect(togo.totalPrice).toBe(benin.totalPrice * 2);
  });

  it('sans coefficient, rien ne change — les devis existants sont intacts', () => {
    const sans = buildKitQuotation(kit, 'tole', true, null, [], []);
    const un = buildKitQuotation(kit, 'tole', true, null, [], [], 1);
    expect(sans.total).toBe(un.total);
  });
});
