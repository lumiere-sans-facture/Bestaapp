import { describe, it, expect } from 'vitest';
import {
  joindrePaiements, paiementsARecopier, nouveauPaiement, champsApresPaiement,
  etatPaiementFacture, dateMiseAJour, jourDuPaiement,
} from '../facturePaiements';
import { objetDepuisLignes } from '../facture';

const facture = {
  id: 'f1', userId: 'u1', totalTTC: 66876000, statut: 'emise', createdAt: '2026-09-23T09:00:00.000Z',
  echeancier: [
    { id: 'e1', libelle: 'Acompte', type: 'date', date: '2026-09-23', montant: 11000000 },
    { id: 'e2', libelle: 'Complément d’acompte', type: 'periode', date: '2026-10-12', dateFin: '2026-10-16', montant: 30000000 },
    { id: 'e3', libelle: 'Solde', type: 'condition', condition: 'À la réception / mise en service', montant: 25876000 },
  ],
};
const acompte = {
  id: 'p1', factureId: 'f1', userId: 'u1', montant: 11000000, date: '2026-09-23', mode: 'virement',
  createdAt: '2026-09-23T10:00:00.000Z', majLe: '2026-09-23T10:00:00.000Z',
};

describe('paiements joints aux factures', () => {
  it('la facture d’exemple : reste 55 876 000 F, complément attendu au 14/10', () => {
    const [f] = joindrePaiements([facture], [acompte]);
    const etat = etatPaiementFacture(f, '2026-10-14');
    expect(etat).toMatchObject({ total: 66876000, paye: 11000000, reste: 55876000 });
    expect(etat.lignes.map((l) => l.statut)).toEqual(['recu', 'attendu', 'a_venir']);
    expect(etat.prochaine.du).toBe(30000000);
  });

  it('une facture sans paiement est rendue telle quelle (même objet)', () => {
    const autre = { id: 'f2', totalTTC: 1000 };
    expect(joindrePaiements([autre], [acompte])[0]).toBe(autre);
  });

  it('anciens paiements rangés dans la facture : lus, sans doublon une fois recopiés', () => {
    const ancienne = { ...facture, paiements: [{ id: 'old1', montant: 5000000, mode: 'momo', date: '2026-09-30T08:00:00.000Z' }] };
    expect(joindrePaiements([ancienne], [acompte])[0].paiements.map((p) => p.id)).toEqual(['p1', 'old1']);
    const recopies = paiementsARecopier([ancienne], [acompte]);
    expect(recopies).toEqual([expect.objectContaining({ id: 'old1', factureId: 'f1', userId: 'u1', montant: 5000000, date: '2026-09-30' })]);
    expect(joindrePaiements([ancienne], [acompte, ...recopies])[0].paiements).toHaveLength(2);
    expect(paiementsARecopier([ancienne], [acompte, ...recopies])).toEqual([]);
  });
});

describe('statut de la facture après un paiement', () => {
  it('soldée quand le total est atteint, réémise si un paiement disparaît', () => {
    expect(champsApresPaiement({ ...facture, paiements: [acompte] })).toEqual({ montantPaye: 11000000, statut: 'emise' });
    const tout = { ...acompte, id: 'p2', montant: 55876000 };
    expect(champsApresPaiement({ ...facture, paiements: [acompte, tout] })).toEqual({ montantPaye: 66876000, statut: 'payee' });
    expect(champsApresPaiement({ ...facture, statut: 'payee', montantPaye: 66876000, paiements: [] })).toEqual({ montantPaye: 0, statut: 'emise' });
  });

  it('brouillon et facture annulée gardent leur statut', () => {
    expect(champsApresPaiement({ ...facture, statut: 'annulee', paiements: [acompte] }).statut).toBe('annulee');
  });
});

describe('nouveau paiement et date de mise à jour', () => {
  it('fiche complète, datée du jour par défaut', () => {
    const p = nouveauPaiement(facture, { montant: '30000000', mode: 'momo', operateur: 'T-Money', reference: ' TX-42 ' }, new Date(2026, 9, 14, 15, 0));
    expect(p).toMatchObject({ factureId: 'f1', userId: 'u1', montant: 30000000, date: '2026-10-14', operateur: 'T-Money', reference: 'TX-42' });
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('« Mise à jour » : dernier changement de paiement ou d’échéancier, jamais le jour d’émission', () => {
    expect(dateMiseAJour({ ...facture, paiements: [acompte] })).toBe('');
    expect(dateMiseAJour({ ...facture, echeancierMajLe: '2026-10-14T08:00:00.000Z', paiements: [acompte] })).toBe('2026-10-14');
  });

  it('jour d’un ancien paiement daté d’un instant', () => {
    expect(jourDuPaiement({ date: '2026-09-23' })).toBe('2026-09-23');
    expect(jourDuPaiement({ date: new Date(2026, 8, 30, 9).toISOString() })).toBe('2026-09-30');
  });
});

describe('objet de la facture', () => {
  it('reprend panneaux, onduleur et stockage', () => {
    const objet = objetDepuisLignes([
      { designation: 'Panneaux solaires monocristallins 585 Wc', qty: 262, pu: 76000 },
      { designation: 'Onduleur hybride triphasé 125 kW', qty: 1, pu: 9000000 },
      { designation: 'Batterie lithium (LiFePO4) 241 kWh', qty: 1, pu: 24000000 },
      { designation: 'Main d’œuvre', qty: 1, pu: 1228000 },
    ]);
    expect(objet).toBe('Fourniture et installation d’une centrale solaire hybride : 262 panneaux 585 Wc (≈ 153 kWc), onduleur hybride triphasé 125 kW, stockage lithium 241 kWh');
  });

  it('les accessoires des panneaux (structure, câbles) ne comptent pas comme panneaux', () => {
    const objet = objetDepuisLignes([
      { designation: 'Panneaux solaires monocristallins 585 Wc', qty: 262, pu: 76000 },
      { designation: 'Structure et fixation des panneaux', qty: 1, pu: 1502000 },
      { designation: 'Câbles solaires panneaux 6 mm²', qty: 200, pu: 900 },
    ]);
    expect(objet).toMatch(/: 262 panneaux 585\u202fWc \(≈\u202f153\u202fkWc\)$/);
  });

  it('vide quand les lignes ne décrivent pas une installation solaire', () => {
    expect(objetDepuisLignes([{ designation: 'Câble 6 mm²', qty: 100, pu: 800 }])).toBe('');
  });
});
