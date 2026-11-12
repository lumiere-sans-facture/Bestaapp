import { describe, it, expect } from 'vitest';
import { paysTarifFacture, prixFactureSuivantPays, PAYS_TARIF_DEFAUT } from '../tarifElectricite';
import { tarifPays } from '../../data/tarifsUemoa';
import { TARIF_ELECTRICITE_BENIN, TARIF_ELECTRICITE_TOGO } from '../sizingSheet/compute';

const prix = (contexte) => paysTarifFacture(contexte).prixKwh;

describe('dimensionnement par facture : prix du kWh du pays du client', () => {
  it('au Bénin, 145 F (SBEE) — le même prix que le simulateur et la fiche', () => {
    const benin = paysTarifFacture({ pays: 'Bénin' });
    expect(benin.prixKwh).toBe(145);
    expect(benin.operateurElec).toBe('SBEE');
    expect(benin.prixKwh).toBe(tarifPays('bj').prixKwh);
    expect(benin.prixKwh).toBe(TARIF_ELECTRICITE_BENIN);
  });

  it('rien ne dit où est le client : le Bénin', () => {
    expect(PAYS_TARIF_DEFAUT).toBe('bj');
    expect(prix({})).toBe(145);
    expect(prix({ ville: 'Quartier A' })).toBe(145);
  });

  it('le lieu géocodé décide d’abord', () => {
    expect(prix({ ville: 'Lomé', pays: 'Togo' })).toBe(TARIF_ELECTRICITE_TOGO);
    expect(prix({ ville: 'Cotonou', pays: 'Bénin', telephone: '+228 90 00 00 00' })).toBe(145);
    expect(prix({ pays: 'Côte d’Ivoire' })).toBe(tarifPays('ci').prixKwh);
  });

  it('une ville togolaise reconnue : la CEET', () => {
    expect(prix({ ville: 'Lomé' })).toBe(114);
    expect(prix({ ville: 'Kara' })).toBe(114);
  });

  it('sinon le numéro du client : +228 ou 8 chiffres au Togo, +229 au Bénin', () => {
    expect(prix({ ville: 'Quartier Zongo, Lomé', telephone: '+228 94 77 88 99' })).toBe(114);
    expect(prix({ telephone: '90 00 00 00' })).toBe(114);
    expect(prix({ telephone: '+229 01 97 00 00 00', paysEntreprise: 'tg' })).toBe(145);
    expect(prix({ telephone: '+225 07 00 00 00 00' })).toBe(tarifPays('ci').prixKwh);
    // Un numéro béninois local (10 chiffres en 01) ne dit rien de plus : le Bénin.
    expect(prix({ telephone: '01 97 00 00 00' })).toBe(145);
  });

  it('enfin le pays de l’entreprise (espace Pro)', () => {
    expect(prix({ paysEntreprise: 'tg' })).toBe(114);
    expect(prix({ paysEntreprise: 'bj' })).toBe(145);
    expect(prix({ paysEntreprise: 'sn' })).toBe(tarifPays('sn').prixKwh);
  });
});

describe('le prix suit le pays tant qu’il n’a pas été saisi', () => {
  it('encore l’ancien tarif : il passe au nouveau', () => {
    expect(prixFactureSuivantPays(114, 114, 145)).toBe(145);
    expect(prixFactureSuivantPays('114', 114, 145)).toBe(145);
  });

  it('tapé à la main : jamais écrasé', () => {
    expect(prixFactureSuivantPays(130, 114, 145)).toBe(130);
    expect(prixFactureSuivantPays('', 114, 145)).toBe('');
  });
});
