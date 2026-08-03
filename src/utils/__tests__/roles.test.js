import { describe, it, expect } from 'vitest';
import { peutValiderProgression } from '../roles';

const GERANT = { id: 'u1', role: 'gerant' };
const TECH = { id: 'u2', role: 'technicien' };

describe('peutValiderProgression — qui applique, qui doit demander', () => {
  it('le gérant applique et valide', () => {
    expect(peutValiderProgression(GERANT, [GERANT, TECH], true)).toBe(true);
  });

  it('un commercial dans une équipe AVEC gérant doit DEMANDER', () => {
    expect(peutValiderProgression(TECH, [GERANT, TECH], true)).toBe(false);
  });

  it('un utilisateur SEUL dans son espace applique (personne pour valider)', () => {
    expect(peutValiderProgression(TECH, [TECH], true)).toBe(true);
  });

  it("tant que l'annuaire n'a pas répondu, un commercial DOIT demander", () => {
    // Régression réelle : au démarrage l'annuaire ne contient que
    // l'utilisateur. En conclure « aucun gérant, donc je décide » laissait un
    // commercial appliquer ses progressions sans validation.
    expect(peutValiderProgression(TECH, [TECH], false)).toBe(false);
    expect(peutValiderProgression(TECH, [], false)).toBe(false);
  });

  it("le gérant garde ses droits même avant le chargement de l'annuaire", () => {
    expect(peutValiderProgression(GERANT, [], false)).toBe(true);
  });

  it("l'admin plateforme applique toujours", () => {
    expect(peutValiderProgression({ id: 'u3', role: 'technicien', is_platform_admin: true }, [GERANT], true)).toBe(true);
  });

  it("une équipe polluée par le gérant d'une AUTRE entreprise bloquerait à tort", () => {
    // La règle est juste ; c'est son entrée qui doit être filtrée par
    // organisation (cf. fetchTeamProfiles).
    expect(peutValiderProgression(TECH, [TECH, { id: 'x', role: 'gerant' }], true)).toBe(false);
  });
});
