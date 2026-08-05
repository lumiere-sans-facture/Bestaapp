import { describe, it, expect } from 'vitest';
import {
  RETRAIT_MIN, commissionsMobilisables, soldeMobilisable, montantDemande,
  erreurDemande, demandeEnCours, resumeRetraits,
} from '../payouts';

const COM = [
  { id: 'c1', partnerId: 'p1', amount: 15000, status: 'en_attente', createdAt: '2026-08-01' },
  { id: 'c2', partnerId: 'p1', amount: 7500, status: 'en_attente', createdAt: '2026-08-03' },
  { id: 'c3', partnerId: 'p1', amount: 30000, status: 'payée', createdAt: '2026-07-01' },
  { id: 'c4', partnerId: 'p2', amount: 9000, status: 'en_attente', createdAt: '2026-08-02' },
];

describe('commissionsMobilisables — ce qu’un partenaire peut faire régler', () => {
  it('ne retient que SES commissions impayées', () => {
    expect(commissionsMobilisables(COM, 'p1', []).map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('écarte celles déjà engagées dans une demande en attente', () => {
    const demandes = [{ id: 'd1', partnerId: 'p1', status: 'en_attente', commissionIds: ['c1'] }];
    expect(commissionsMobilisables(COM, 'p1', demandes).map((c) => c.id)).toEqual(['c2']);
  });

  it('libère celles d’une demande REFUSÉE : le partenaire peut redemander', () => {
    const demandes = [{ id: 'd1', partnerId: 'p1', status: 'refuse', commissionIds: ['c1'] }];
    expect(commissionsMobilisables(COM, 'p1', demandes).map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('les présente de la plus ancienne à la plus récente', () => {
    expect(commissionsMobilisables(COM, 'p1', []).map((c) => c.createdAt))
      .toEqual(['2026-08-01', '2026-08-03']);
  });

  it('ne mélange jamais deux partenaires', () => {
    expect(commissionsMobilisables(COM, 'p2', []).map((c) => c.id)).toEqual(['c4']);
  });
});

describe('soldeMobilisable', () => {
  it('somme ce qui est réellement demandable', () => {
    expect(soldeMobilisable(COM, 'p1', [])).toBe(22500);
  });

  it('retombe à 0 quand tout est déjà engagé — pas de double demande', () => {
    const demandes = [{ id: 'd1', partnerId: 'p1', status: 'en_attente', commissionIds: ['c1', 'c2'] }];
    expect(soldeMobilisable(COM, 'p1', demandes)).toBe(0);
  });
});

describe('montantDemande', () => {
  it('additionne exactement les commissions cochées', () => {
    expect(montantDemande(COM, ['c1', 'c2'])).toBe(22500);
    expect(montantDemande(COM, ['c2'])).toBe(7500);
    expect(montantDemande(COM, [])).toBe(0);
  });

  it('ignore un identifiant inconnu plutôt que de produire NaN', () => {
    expect(montantDemande(COM, ['c1', 'fantome'])).toBe(15000);
  });
});

describe('demandeEnCours — une seule demande ouverte à la fois', () => {
  const demandes = [
    { id: 'd1', partnerId: 'p1', status: 'paye' },
    { id: 'd2', partnerId: 'p1', status: 'en_attente' },
    { id: 'd3', partnerId: 'p2', status: 'en_attente' },
  ];
  it('trouve celle du partenaire', () => {
    expect(demandeEnCours(demandes, 'p1').id).toBe('d2');
  });
  it('ne voit pas celle d’un autre', () => {
    expect(demandeEnCours(demandes, 'p3')).toBeNull();
  });
  it('ignore les demandes déjà tranchées', () => {
    expect(demandeEnCours([{ id: 'x', partnerId: 'p1', status: 'refuse' }], 'p1')).toBeNull();
  });
});

describe('erreurDemande — ce qui bloque un envoi', () => {
  const base = { commissionIds: ['c1'], montant: 15000, telephone: '+229 97', dejaEnCours: false };

  it('laisse passer une demande complète', () => {
    expect(erreurDemande(base)).toBeNull();
  });

  it('refuse une seconde demande tant que la première n’est pas tranchée', () => {
    expect(erreurDemande({ ...base, dejaEnCours: true })).toMatch(/déjà en attente/);
  });

  it('refuse une demande sans commission cochée', () => {
    expect(erreurDemande({ ...base, commissionIds: [], montant: 0 })).toMatch(/au moins une commission/);
  });

  it(`refuse en dessous du minimum (${RETRAIT_MIN} F)`, () => {
    expect(erreurDemande({ ...base, montant: RETRAIT_MIN - 1 })).toMatch(/minimum/);
    expect(erreurDemande({ ...base, montant: RETRAIT_MIN })).toBeNull();
  });

  it('refuse sans coordonnées de règlement — l’argent doit aller quelque part', () => {
    expect(erreurDemande({ ...base, telephone: '   ' })).toMatch(/numéro/);
  });
});

describe('resumeRetraits', () => {
  const demandes = [
    { partnerId: 'p1', status: 'en_attente', amount: 22500 },
    { partnerId: 'p1', status: 'paye', amount: 40000 },
    { partnerId: 'p2', status: 'en_attente', amount: 9000 },
  ];
  it('sépare ce qui est demandé de ce qui est versé, par partenaire', () => {
    expect(resumeRetraits(demandes, 'p1')).toEqual({ enAttente: 22500, paye: 40000, nbEnAttente: 1 });
  });
  it('totalise toute la plateforme sans partenaire précisé', () => {
    expect(resumeRetraits(demandes)).toEqual({ enAttente: 31500, paye: 40000, nbEnAttente: 2 });
  });
});
