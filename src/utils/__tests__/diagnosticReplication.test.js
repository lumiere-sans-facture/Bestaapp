import { describe, expect, it } from 'vitest';
import { verdictReplication } from '../diagnosticReplication';

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

  it('donne toujours un titre et une conduite à tenir', () => {
    for (const etat of [{ local: true }, {}, { ...complet, profilTrouve: false }, complet]) {
      const v = verdictReplication(etat);
      expect(v.titre).toBeTruthy();
      expect(v.detail.length).toBeGreaterThan(20);
    }
  });
});
