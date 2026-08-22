import { describe, it, expect } from 'vitest';
import {
  idsModifies, fileEnAttente, totalEnAttente, enAttentePourTable, fusionnerCollection, unionFiles,
} from '../fileSync';

describe('idsModifies', () => {
  const a = { id: 'a', n: 1 };
  const b = { id: 'b', n: 1 };

  it('ne retient que les éléments dont la référence a changé', () => {
    const modifie = { ...a, n: 2 };
    expect(idsModifies([a, b], [modifie, b])).toEqual(['a']);
  });

  it('une collection inchangée ne met rien en attente', () => {
    expect(idsModifies([a, b], [a, b])).toEqual([]);
  });

  it('un élément créé localement est en attente', () => {
    const neuf = { id: 'c', n: 1 };
    expect(idsModifies([a, b], [a, b, neuf])).toEqual(['c']);
  });

  it('une suppression ne met rien en attente (elle passe par les tombstones)', () => {
    expect(idsModifies([a, b], [a])).toEqual([]);
  });

  it('tolère des collections absentes', () => {
    expect(idsModifies(undefined, undefined)).toEqual([]);
    expect(idsModifies(undefined, [a])).toEqual(['a']);
  });
});

describe('fileEnAttente', () => {
  const l1 = { id: 'l1' };
  const d1 = { id: 'd1' };

  it('liste les ids en attente par table, sans les tables à jour', () => {
    const repliques = { leads: [l1], devis: [d1] };
    const courant = { leads: [{ ...l1, stage: 'gagne' }], devis: [d1] };
    expect(fileEnAttente(['leads', 'devis'], repliques, courant)).toEqual({ leads: ['l1'] });
  });

  it('tout est en attente tant que rien n’a été répliqué', () => {
    const file = fileEnAttente(['leads'], null, { leads: [l1] });
    expect(file).toEqual({ leads: ['l1'] });
    expect(totalEnAttente(file)).toBe(1);
  });

  it('compte les éléments, pas les tables', () => {
    expect(totalEnAttente({ leads: ['a', 'b'], devis: ['c'] })).toBe(3);
    expect(totalEnAttente({})).toBe(0);
    expect(totalEnAttente(null)).toBe(0);
  });

  it('expose les ids d’une table en Set', () => {
    expect(enAttentePourTable({ leads: ['a'] }, 'leads').has('a')).toBe(true);
    expect(enAttentePourTable({}, 'leads').size).toBe(0);
  });
});

describe('unionFiles', () => {
  it('réunit deux files sans doublon', () => {
    expect(unionFiles({ leads: ['a'] }, { leads: ['a', 'b'], devis: ['c'] }))
      .toEqual({ leads: ['a', 'b'], devis: ['c'] });
  });

  it('tolère des files absentes ou vides', () => {
    expect(unionFiles()).toEqual({});
    expect(unionFiles({ leads: ['a'] }, {})).toEqual({ leads: ['a'] });
    expect(unionFiles({}, { leads: [] })).toEqual({});
  });
});

describe('fusionnerCollection', () => {
  it('une modification locale EN ATTENTE gagne contre la version reçue', () => {
    // Le cas de perte silencieuse : hors-ligne, l'étape passe à « gagne » ;
    // au lancement suivant, la copie serveur (plus ancienne) l'écrasait.
    const distant = { id: 'l1', stage: 'negociation' };
    const local = { id: 'l1', stage: 'gagne' };
    const r = fusionnerCollection([local], [distant], new Set(), new Set(['l1']));
    expect(r).toEqual([local]);
  });

  it('sans attente, la version du serveur fait foi', () => {
    const distant = { id: 'l1', stage: 'negociation' };
    const local = { id: 'l1', stage: 'perime' };
    expect(fusionnerCollection([local], [distant])).toEqual([distant]);
  });

  it('un élément créé hors-ligne est conservé', () => {
    const distant = { id: 'l1' };
    const cree = { id: 'l2' };
    expect(fusionnerCollection([distant, cree], [distant])).toEqual([distant, cree]);
  });

  it('un élément supprimé ailleurs n’est pas ressuscité', () => {
    const cree = { id: 'l2' };
    expect(fusionnerCollection([cree], [], new Set(['l2']))).toEqual([]);
  });

  it('un élément partagé retiré à la source disparaît (pas de zombie sans propriétaire)', () => {
    const partage = { id: 'f1', partage: true };
    expect(fusionnerCollection([partage], [])).toEqual([]);
  });

  it('un élément partagé n’est jamais remplacé par la copie locale', () => {
    const distant = { id: 'f1', titre: 'à jour', partage: true };
    const local = { id: 'f1', titre: 'périmé', partage: true };
    expect(fusionnerCollection([local], [distant], new Set(), new Set(['f1']))).toEqual([distant]);
  });

  it('rend la RÉFÉRENCE reçue quand rien ne change (aucun renvoi inutile au serveur)', () => {
    // Un nouveau tableau ferait croire à une modification locale : l'app
    // repousserait toutes les collections à chaque réception.
    const distants = [{ id: 'a' }, { id: 'b' }];
    expect(fusionnerCollection([...distants], distants)).toBe(distants);
  });

  it('rend un NOUVEAU tableau dès qu’un élément local est retenu', () => {
    const distants = [{ id: 'a' }];
    const local = { id: 'a', n: 2 };
    expect(fusionnerCollection([local], distants, new Set(), new Set(['a']))).not.toBe(distants);
  });

  it('combine attente, création hors-ligne et suppression distante', () => {
    const distants = [{ id: 'a', n: 1 }, { id: 'b', n: 1 }];
    const locaux = [
      { id: 'a', n: 2 },        // modifié ici, pas encore envoyé
      { id: 'b', n: 0 },        // version locale périmée
      { id: 'c' },              // créé hors-ligne
      { id: 'd' },              // supprimé sur un autre appareil
    ];
    const r = fusionnerCollection(locaux, distants, new Set(['d']), new Set(['a']));
    expect(r).toEqual([{ id: 'a', n: 2 }, { id: 'b', n: 1 }, { id: 'c' }]);
  });

  it('tolère des entrées absentes', () => {
    expect(fusionnerCollection()).toEqual([]);
    expect(fusionnerCollection(undefined, [{ id: 'a' }])).toEqual([{ id: 'a' }]);
  });
});
