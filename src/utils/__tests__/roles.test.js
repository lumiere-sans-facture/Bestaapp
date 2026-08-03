import { describe, it, expect } from 'vitest';
import { peutValiderProgression, estProprietaireEspace } from '../roles';

const GERANT = { id: 'u1', role: 'gerant' };
const TECH = { id: 'u2', role: 'technicien' };
const ADMIN = { id: 'u3', role: 'technicien', is_platform_admin: true };

describe('peutValiderProgression — qui tranche les progressions', () => {
  it('le gérant applique et valide', () => {
    expect(peutValiderProgression(GERANT)).toBe(true);
  });

  it("l'admin plateforme applique et valide, quel que soit son rôle", () => {
    expect(peutValiderProgression(ADMIN)).toBe(true);
  });

  it('TOUT commercial doit demander — y compris seul dans son espace', () => {
    // Règle métier : la progression commerciale se suit à deux, le commercial
    // propose et BestaSolar tranche. Aucune exception, sinon un inscrit
    // s'auto-validerait en créant simplement son propre espace.
    expect(peutValiderProgression(TECH)).toBe(false);
  });

  it('ne dépend plus de l’annuaire : aucune fenêtre de chargement exploitable', () => {
    expect(peutValiderProgression(TECH)).toBe(false);
    expect(peutValiderProgression({ role: 'technicien' })).toBe(false);
    expect(peutValiderProgression(undefined)).toBe(false);
  });
});

describe('estProprietaireEspace — qui engage l’entreprise (parrainage…)', () => {
  it('le gérant et l’admin plateforme', () => {
    expect(estProprietaireEspace(GERANT, [GERANT, TECH], true)).toBe(true);
    expect(estProprietaireEspace(ADMIN, [GERANT], true)).toBe(true);
  });

  it('un inscrit SEUL dans son espace en est le propriétaire de fait', () => {
    expect(estProprietaireEspace(TECH, [TECH], true)).toBe(true);
  });

  it('un commercial d’une équipe avec gérant ne l’est pas', () => {
    expect(estProprietaireEspace(TECH, [GERANT, TECH], true)).toBe(false);
  });

  it("tant que l'annuaire n'a pas répondu, on ne conclut rien", () => {
    expect(estProprietaireEspace(TECH, [TECH], false)).toBe(false);
  });
});
