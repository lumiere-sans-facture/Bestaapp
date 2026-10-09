// Pays de l'espace Pro : référentiel (data/pays.js) et ce qu'il règle —
// TVA des documents, prix du kWh de la fiche, numéros WhatsApp, messages.
import { describe, it, expect } from 'vitest';
import {
  PAYS, PAYS_ENTREPRISE_DEFAUT, paysParId, paysDuTelephone, paysDuNom, paysDeLEntreprise,
  numeroInternational, tvaPct, libelleDevise, indicationTva,
} from '../../data/pays';
import { TARIFS_UEMOA } from '../../data/tarifsUemoa';
import { computeFactureTotals } from '../facture';
import { tarifElectriciteParDefaut, TARIF_ELECTRICITE_TOGO, TARIF_ELECTRICITE_BENIN } from '../sizingSheet/compute';
import { factureEnvoiMessage, relanceMessage } from '../paiement';

describe('référentiel des pays', () => {
  it('les huit pays demandés, chacun complet', () => {
    expect(PAYS.map((p) => p.nom)).toEqual([
      'Bénin', 'Burkina Faso', 'Cameroun', 'Côte d’Ivoire', 'Mali', 'Niger', 'Sénégal', 'Togo',
    ]);
    for (const p of PAYS) {
      expect(p.indicatif).toMatch(/^\+2\d\d$/);
      expect(p.exempleTel.startsWith(p.indicatif)).toBe(true);
      expect(p.fiscal.sigle).toMatch(/^[A-Z]{3,5}$/);
      expect(p.fiscal.nom.length).toBeGreaterThan(5);
      expect(p.mobileMoney.length).toBeGreaterThan(0);
      expect(p.prixKwh).toBeGreaterThan(0);
      expect(p.dans).toMatch(/^(au|en) /);
    }
    expect(new Set(PAYS.map((p) => p.indicatif)).size).toBe(8);
    expect(new Set(PAYS.map((p) => p.id)).size).toBe(8);
  });

  it('TVA : 18 %, sauf le Niger (19 %) et le Cameroun (19,25 %)', () => {
    const tva = Object.fromEntries(PAYS.map((p) => [p.id, p.tva]));
    expect(tva).toEqual({ bj: 0.18, bf: 0.18, cm: 0.1925, ci: 0.18, ml: 0.18, ne: 0.19, sn: 0.18, tg: 0.18 });
    expect(tvaPct(0.1925)).toBe('19,25');
    expect(tvaPct(0.18)).toBe('18');
  });

  it('identifiant fiscal propre à chaque pays', () => {
    const sigles = Object.fromEntries(PAYS.map((p) => [p.id, p.fiscal.sigle]));
    expect(sigles).toEqual({ bj: 'IFU', bf: 'IFU', cm: 'NIU', ci: 'NCC', ml: 'NIF', ne: 'NIF', sn: 'NINEA', tg: 'NIF' });
  });

  it('devise : franc CFA BCEAO (UEMOA), BEAC au Cameroun', () => {
    expect(libelleDevise(paysParId('cm'))).toBe('Franc CFA (BEAC)');
    for (const p of PAYS.filter((x) => x.id !== 'cm')) expect(libelleDevise(p)).toBe('Franc CFA (BCEAO)');
  });

  it('prix du kWh : Togo et Bénin inchangés, les autres alignés sur le tableau UEMOA', () => {
    expect(paysParId('tg').prixKwh).toBe(TARIF_ELECTRICITE_TOGO);
    expect(paysParId('bj').prixKwh).toBe(TARIF_ELECTRICITE_BENIN);
    for (const id of ['bf', 'ci', 'ml', 'ne', 'sn']) {
      expect(paysParId(id).prixKwh).toBe(TARIFS_UEMOA.find((t) => t.id === id).prixKwh);
    }
  });

  it('indication TVA : seule l’exonération togolaise est affirmée', () => {
    expect(indicationTva(paysParId('tg'))).toBe('Le solaire est exonéré de TVA par défaut au Togo.');
    expect(indicationTva(paysParId('cm'))).toMatch(/^TVA à 19,25 % au Cameroun\. .*vérifiez/);
    expect(indicationTva(paysParId('ci'))).toMatch(/^TVA à 18 % en Côte d’Ivoire\./);
  });
});

describe('pays d’une entreprise', () => {
  it('celui choisi, sinon celui du téléphone, sinon le Togo', () => {
    expect(paysDeLEntreprise({ pays: 'sn', telephone: '+228 90 00 00 00' }).id).toBe('sn');
    expect(paysDeLEntreprise({ telephone: '+225 07 00 00 00 00' }).id).toBe('ci');
    expect(paysDeLEntreprise({ telephone: '00237 670 00 00 00' }).id).toBe('cm');
    expect(paysDeLEntreprise({ telephone: '90 00 00 00', momo: '+227 90 11 22 33' }).id).toBe('ne');
    expect(paysDeLEntreprise({ telephone: '90 00 00 00' }).id).toBe(PAYS_ENTREPRISE_DEFAUT);
    expect(paysDeLEntreprise(null).id).toBe('tg');
    expect(paysDeLEntreprise({ pays: 'xx' }).id).toBe('tg');
  });

  it('un numéro local ne dit rien de son pays', () => {
    expect(paysDuTelephone('97 00 00 00')).toBeNull();
    expect(paysDuTelephone('+33 6 00 00 00 00')).toBeNull();
    expect(paysDuTelephone('+229 01 97 00 00 00').id).toBe('bj');
  });

  it('nom de pays du géocodage, accents et apostrophes compris', () => {
    expect(paysDuNom('Côte d\'Ivoire').id).toBe('ci');
    expect(paysDuNom('Côte d’Ivoire').id).toBe('ci');
    expect(paysDuNom('Bénin').id).toBe('bj');
    expect(paysDuNom('Sénégal').id).toBe('sn');
    expect(paysDuNom('Cameroon').id).toBe('cm');
    expect(paysDuNom('CM').id).toBe('cm');
    expect(paysDuNom('Ghana')).toBeNull();
    expect(paysDuNom('')).toBeNull();
  });
});

describe('numéro joignable par WhatsApp', () => {
  it('l’indicatif complète un numéro local, sans jamais se doubler', () => {
    expect(numeroInternational('90 00 00 00', '+228')).toBe('+228 90 00 00 00');
    expect(numeroInternational('+225 07 00 00 00 00', '+228')).toBe('+225 07 00 00 00 00');
    expect(numeroInternational('00229 01 97 00 00 00', '+228')).toBe('00229 01 97 00 00 00');
    expect(numeroInternational('228 90 00 00 00', '+228')).toBe('+22890000000');
    // Un numéro fixe togolais commence par 22 : il n'est pas pris pour l'indicatif.
    expect(numeroInternational('22 81 23 45', '+228')).toBe('+228 22 81 23 45');
    expect(numeroInternational('', '+228')).toBe('');
    expect(numeroInternational('90 00 00 00', '')).toBe('90 00 00 00');
  });
});

describe('ce que le pays règle', () => {
  const lignes = [{ designation: 'Kit', qty: 1, pu: 1000000 }];

  it('TVA des documents au taux du pays', () => {
    expect(computeFactureTotals(lignes, true)).toEqual({ totalHT: 1000000, tva: 180000, totalTTC: 1180000 });
    expect(computeFactureTotals(lignes, true, paysParId('ne').tva)).toEqual({ totalHT: 1000000, tva: 190000, totalTTC: 1190000 });
    expect(computeFactureTotals(lignes, true, paysParId('cm').tva)).toEqual({ totalHT: 1000000, tva: 192500, totalTTC: 1192500 });
    expect(computeFactureTotals(lignes, false, paysParId('cm').tva).tva).toBe(0);
  });

  it('prix du kWh de la fiche : lieu géocodé, ville togolaise, puis pays de l’entreprise', () => {
    expect(tarifElectriciteParDefaut('Abidjan', 'Côte d’Ivoire')).toBe(90);
    expect(tarifElectriciteParDefaut('Douala', 'Cameroun', 'tg')).toBe(79);
    expect(tarifElectriciteParDefaut('Kara', '', 'ci')).toBe(114);
    expect(tarifElectriciteParDefaut('Niamey', '', 'ne')).toBe(86);
    expect(tarifElectriciteParDefaut('', '', '')).toBe(TARIF_ELECTRICITE_BENIN);
  });

  it('messages de facture : l’opérateur Mobile Money nommé', () => {
    const entreprise = { nomEntreprise: 'Lumière d’Abidjan', momo: '+225 07 11 22 33 44', momoNom: 'L. A.', momoOperateur: 'Wave' };
    const f = { numero: 'FAC-1', clientName: 'Awa', totalTTC: 50000, statut: 'emise' };
    expect(factureEnvoiMessage(f, entreprise)).toContain('Règlement Wave : +225 07 11 22 33 44 (L. A.).');
    expect(relanceMessage(f, entreprise)).toContain('Règlement Wave : +225 07 11 22 33 44 (L. A.).');
    expect(factureEnvoiMessage(f, { ...entreprise, momoOperateur: '' })).toContain('Règlement Mobile Money :');
  });
});
