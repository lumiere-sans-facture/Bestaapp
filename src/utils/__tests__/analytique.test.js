// Analytique produit. Le risque n'est pas de rater une statistique : c'est
// que la liste des pages vues devienne l'annuaire des clients d'un installateur.
import { describe, it, expect } from 'vitest';
import {
  EVENEMENTS, evenementValide, cheminNormalise, proprietesSures, construireEvenement,
} from '../analytique';

describe('cheminNormalise', () => {
  it('remplace les identifiants par :id', () => {
    expect(cheminNormalise('/clients/c-4f2a-9b3e-0011')).toBe('/clients/:id');
    expect(cheminNormalise('/devis/12')).toBe('/devis/:id');
    expect(cheminNormalise('/plus/formation/8f2c1d4e5a6b7c8d9e0f1a2b')).toBe('/plus/formation/:id');
  });

  it('laisse les vraies routes intactes', () => {
    expect(cheminNormalise('/plus/paiements')).toBe('/plus/paiements');
    expect(cheminNormalise('/boutique')).toBe('/boutique');
    expect(cheminNormalise('/')).toBe('/');
  });

  it('jette les paramètres de requête et les ancres', () => {
    // « ?ref=BESTA-XXXX » identifie un partenaire : hors de question.
    expect(cheminNormalise('/inscription?ref=BESTA-9K2P')).toBe('/inscription');
    expect(cheminNormalise('/devis#etape-3')).toBe('/devis');
  });

  it('supporte une entrée vide', () => {
    expect(cheminNormalise('')).toBe('/');
    expect(cheminNormalise(null)).toBe('/');
  });
});

describe('proprietesSures', () => {
  it('garde nombres et booléens tels quels', () => {
    expect(proprietesSures({ montant: 5000, actif: true })).toEqual({ montant: 5000, actif: true });
  });

  it('NETTOIE les chaînes', () => {
    expect(proprietesSures({ note: 'appeler le +228 90 12 34 56' }))
      .toEqual({ note: 'appeler le [tel]' });
  });

  it('ÉCARTE les objets et tableaux — trop faciles à remplir d’une fiche client', () => {
    const p = proprietesSures({ client: { nom: 'Kossi', tel: '+22890123456' }, lignes: [1, 2], ok: true });
    expect(p).toEqual({ ok: true });
  });

  it('tronque les textes longs et plafonne le nombre de propriétés', () => {
    expect(proprietesSures({ t: 'x'.repeat(200) }).t).toHaveLength(80);
    const beaucoup = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`p${i}`, i]));
    expect(Object.keys(proprietesSures(beaucoup))).toHaveLength(12);
  });

  it('supporte une entrée absente', () => {
    expect(proprietesSures()).toEqual({});
    expect(proprietesSures(null)).toEqual({});
    expect(proprietesSures('texte')).toEqual({});
  });
});

describe('evenementValide', () => {
  it('n’accepte que les noms déclarés', () => {
    expect(evenementValide(EVENEMENTS.DEVIS_CREE)).toBe(true);
    expect(evenementValide('devis_Kossi_Adje')).toBe(false);
    expect(evenementValide('')).toBe(false);
  });
});

describe('construireEvenement', () => {
  it('assemble un événement complet', () => {
    const e = construireEvenement(EVENEMENTS.PAGE_VUE, { chemin: '/devis' },
      { distinctId: 'u1', version: 'abc1234', date: '2026-08-14T10:00:00.000Z' });
    expect(e.event).toBe('page_vue');
    expect(e.distinct_id).toBe('u1');
    expect(e.timestamp).toBe('2026-08-14T10:00:00.000Z');
    expect(e.properties.chemin).toBe('/devis');
    expect(e.properties.version).toBe('abc1234');
  });

  it('REFUSE un nom non déclaré', () => {
    expect(construireEvenement('n_importe_quoi', {}, {})).toBeNull();
  });

  it('reste comptable avant connexion', () => {
    expect(construireEvenement(EVENEMENTS.PAGE_VUE, {}, {}).distinct_id).toBe('anonyme');
  });

  it('nettoie les propriétés au passage', () => {
    const e = construireEvenement(EVENEMENTS.DEVIS_CREE, { note: 'client kossi@exemple.tg' }, {});
    expect(e.properties.note).toBe('client [email]');
  });
});
