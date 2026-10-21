import { describe, it, expect } from 'vitest';
import {
  echeancierDepuisModele, repartirEnTranches, totalEcheancier, ecartEcheancier, statutEcheance,
  repartirPaiements, etatEcheancier, echeancierEnRetard, controlerPaiement, quandEcheance, JOURS_COMPLEMENT,
} from '../echeancier';
import { decalerJour } from '../date';
import { isEnRetard, joursRetard, statutEffectif } from '../paiement';

// La facture d'exemple : un projet de centrale hybride en trois tranches,
// acompte reçu, complément attendu la semaine du 12 au 16 octobre.
const facture = {
  totalTTC: 66876000,
  echeancier: [
    { id: 'e1', libelle: 'Acompte', type: 'date', date: '2026-09-23', montant: 11000000 },
    { id: 'e2', libelle: 'Complément d’acompte', type: 'periode', date: '2026-10-12', dateFin: '2026-10-16', montant: 30000000 },
    { id: 'e3', libelle: 'Solde', type: 'condition', condition: 'À la réception / mise en service', montant: 25876000 },
  ],
};

describe('la facture d’exemple, au 14 octobre 2026', () => {
  const etat = etatEcheancier(facture, 11000000, '2026-10-14');

  it('reste à payer 55 876 000 F, échéancier cohérent', () => {
    expect(etat).toMatchObject({ total: 66876000, paye: 11000000, reste: 55876000, tropPercu: 0, ecart: 0 });
  });

  it('acompte reçu, complément attendu, solde à venir', () => {
    expect(etat.lignes.map((l) => l.statut)).toEqual(['recu', 'attendu', 'a_venir']);
  });

  it('la prochaine échéance est le complément de 30 000 000 F', () => {
    expect(etat.prochaine).toMatchObject({ id: 'e2', du: 30000000 });
  });

  it('la période se lit « Du 12 au 16/10/2026 »', () => {
    expect(quandEcheance(facture.echeancier[1])).toBe('Du 12 au 16/10/2026');
    expect(quandEcheance(facture.echeancier[0])).toBe('23/09/2026');
    expect(quandEcheance(facture.echeancier[2])).toBe('À la réception / mise en service');
  });
});

describe('affectation des paiements dans l’ordre de l’échéancier', () => {
  it('un paiement partiel couvre l’acompte puis entame le complément', () => {
    const lignes = repartirPaiements(facture.echeancier, 21000000, '2026-10-14');
    expect(lignes.map((l) => [l.couvert, l.du, l.statut])).toEqual([
      [11000000, 0, 'recu'], [10000000, 20000000, 'partiel'], [0, 25876000, 'a_venir'],
    ]);
  });

  it('passé la période sans paiement, le complément est en retard', () => {
    expect(repartirPaiements(facture.echeancier, 11000000, '2026-10-20')[1].statut).toBe('en_retard');
    expect(echeancierEnRetard(facture.echeancier, 11000000, '2026-10-20')).toBe(true);
    expect(echeancierEnRetard(facture.echeancier, 41000000, '2026-10-20')).toBe(false);
  });

  it('au-delà du total : tout est reçu, le surplus est un trop-perçu', () => {
    const etat = etatEcheancier(facture, 70000000, '2026-10-14');
    expect(etat).toMatchObject({ reste: 0, tropPercu: 3124000, prochaine: null });
    expect(etat.lignes.every((l) => l.statut === 'recu')).toBe(true);
  });
});

describe('statut d’une échéance datée', () => {
  const ech = (date) => ({ type: 'date', date, montant: 1000 });
  it.each([
    ['2026-10-13', 'en_retard'],
    ['2026-10-14', 'attendu'],
    ['2026-10-21', 'attendu'],
    ['2026-10-22', 'a_venir'],
  ])('échéance du %s, vue le 14/10/2026 → %s', (date, attendu) => {
    expect(statutEcheance(ech(date), 0, '2026-10-14')).toBe(attendu);
  });

  it('une période qui commence dans plus de 7 jours est à venir', () => {
    expect(statutEcheance({ type: 'periode', date: '2026-11-02', dateFin: '2026-11-06', montant: 1 }, 0, '2026-10-14')).toBe('a_venir');
  });

  it('un statut forcé à la main l’emporte, et la prochaine échéance le saute', () => {
    const force = { ...facture, echeancier: facture.echeancier.map((e) => (e.id === 'e2' ? { ...e, statutForce: 'recu' } : e)) };
    const etat = etatEcheancier(force, 11000000, '2026-10-20');
    expect(etat.lignes[1].statut).toBe('recu');
    expect(etat.prochaine.id).toBe('e3');
  });
});

describe('modèles d’échéancier', () => {
  it('la somme des tranches vaut exactement le total', () => {
    for (const modele of ['comptant', 'acompte-solde', 'trois-tranches', 'personnalise']) {
      const lignes = echeancierDepuisModele(modele, 66876000, { emission: '2026-09-23' });
      expect(totalEcheancier(lignes), modele).toBe(66876000);
      expect(ecartEcheancier(lignes, 66876000), modele).toBe(0);
      expect(new Set(lignes.map((l) => l.id)).size, modele).toBe(lignes.length);
    }
  });

  it('3 tranches : tranches arrondies au millier, le solde prend l’appoint', () => {
    expect(repartirEnTranches(66876000, [30, 40, 30])).toEqual([20063000, 26750000, 20063000]);
    const [acompte, complement, solde] = echeancierDepuisModele('trois-tranches', 66876000, { emission: '2026-09-23' });
    expect(acompte).toMatchObject({ libelle: 'Acompte', type: 'date', date: '2026-09-23' });
    expect(complement.date).toBe(decalerJour('2026-09-23', JOURS_COMPLEMENT));
    expect(solde).toMatchObject({ type: 'condition', condition: 'À la réception / mise en service' });
  });

  it('Acompte / Solde : pourcentage réglable', () => {
    const [acompte, solde] = echeancierDepuisModele('acompte-solde', 1500000, { emission: '2026-10-01', acomptePct: 30 });
    expect([acompte.montant, solde.montant]).toEqual([450000, 1050000]);
  });

  it('un échéancier incomplet se signale par son écart', () => {
    expect(ecartEcheancier(facture.echeancier.slice(0, 2), 66876000)).toBe(25876000);
  });
});

describe('contrôle d’un paiement', () => {
  it('refuse un montant nul', () => {
    expect(controlerPaiement(0, 55876000).valide).toBe(false);
  });
  it('signale le trop-perçu au-delà du reste', () => {
    expect(controlerPaiement(60000000, 55876000)).toEqual({ valide: true, tropPercu: 4124000 });
    expect(controlerPaiement(30000000, 55876000)).toEqual({ valide: true, tropPercu: 0 });
  });
});

describe('retard d’une facture à échéancier', () => {
  const f = { ...facture, statut: 'emise', paiements: [{ id: 'p1', montant: 11000000 }] };
  const le = (jour) => new Date(`${jour}T12:00:00`).getTime();

  it('pas en retard tant que la période du complément court', () => {
    expect(isEnRetard(f, le('2026-10-14'))).toBe(false);
    expect(statutEffectif(f, le('2026-10-14'))).toBe('partiel');
  });

  it('en retard le lendemain de la fin de période, jours comptés depuis le 16/10', () => {
    expect(isEnRetard(f, le('2026-10-20'))).toBe(true);
    expect(joursRetard(f, le('2026-10-20'))).toBe(4);
    expect(statutEffectif(f, le('2026-10-20'))).toBe('retard');
  });

  it('une facture annulée n’est jamais en retard', () => {
    expect(statutEffectif({ ...f, statut: 'annulee' }, le('2026-10-20'))).toBe('annulee');
    expect(isEnRetard({ ...f, statut: 'annulee' }, le('2026-10-20'))).toBe(false);
  });
});
