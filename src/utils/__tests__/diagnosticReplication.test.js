import { describe, expect, it } from 'vitest';
import { clientsNonDetenus, verdictReplication } from '../diagnosticReplication';

const complet = {
  email: 'boss@besta.tg', profilTrouve: true,
  orgBase: 'org-1', orgEcriture: 'org-1',
};

describe('verdictReplication', () => {
  it('valide une identité cohérente', () => {
    expect(verdictReplication(complet)).toMatchObject({ code: 'coherent', ok: true });
  });

  it('distingue le profil absent de l’entreprise absente', () => {
    // Les deux donnent le même refus RLS, mais PAS le même remède : l'un se
    // règle en se reconnectant avec la bonne adresse, l'autre en base.
    expect(verdictReplication({ ...complet, profilTrouve: false }).code).toBe('profil-absent');
    expect(verdictReplication({ ...complet, orgBase: null }).code).toBe('org-introuvable');
  });

  it('repère une estampille vide et une entreprise divergente', () => {
    expect(verdictReplication({ ...complet, orgEcriture: null }).code).toBe('estampille-vide');
    expect(verdictReplication({ ...complet, orgEcriture: 'org-2' }).code).toBe('org-differente');
  });

  it('ne diagnostique rien sans session ni hors ligne', () => {
    expect(verdictReplication({ local: true })).toMatchObject({ code: 'local', ok: true });
    expect(verdictReplication({}).code).toBe('sans-session');
  });

  it('signale les clients d’un autre membre, que la base refusera', () => {
    // Depuis la fusion des organisations, un client n'est écrivable que par son
    // auteur : une identité cohérente ne suffit plus à garantir l'écriture.
    expect(verdictReplication({ ...complet, clientsNonDetenus: 3 }).code).toBe('clients-non-detenus');
  });

  it('le gérant plateforme écrit même les clients des autres', () => {
    expect(verdictReplication({ ...complet, clientsNonDetenus: 3, adminPlateforme: true }).code)
      .toBe('coherent');
  });

  it('donne toujours un titre et une conduite à tenir', () => {
    for (const etat of [{ local: true }, {}, { ...complet, profilTrouve: false }, complet]) {
      const v = verdictReplication(etat);
      expect(v.titre).toBeTruthy();
      expect(v.detail.length).toBeGreaterThan(20);
    }
  });
});

describe('clientsNonDetenus', () => {
  const moi = 'u1';

  it('retient les clients dont l’auteur est quelqu’un d’autre', () => {
    const leads = [
      { id: 'a', assignedTo: 'u1' },
      { id: 'b', assignedTo: 'u2' },
      { id: 'c', registeredByUserId: 'u3', assignedTo: 'u1' },
    ];
    expect(clientsNonDetenus(leads, moi).map((l) => l.id)).toEqual(['b', 'c']);
  });

  it('ignore un client sans auteur : la base ne le refusera pas pour ça', () => {
    expect(clientsNonDetenus([{ id: 'a' }, { id: 'b', assignedTo: '' }], moi)).toEqual([]);
  });

  it('ne conclut rien sans identifiant de profil', () => {
    expect(clientsNonDetenus([{ id: 'a', assignedTo: 'u2' }], null)).toEqual([]);
  });
});
