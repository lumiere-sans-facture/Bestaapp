import { describe, it, expect } from 'vitest';
import { peutValiderProgression } from '../roles';

const GERANT = { id: 'u1', role: 'gerant' };
const TECH = { id: 'u2', role: 'technicien' };

describe('peutValiderProgression — agir et valider suivent la même règle', () => {
  it('le gérant pilote et valide', () => {
    expect(peutValiderProgression(GERANT, [GERANT, TECH])).toBe(true);
  });

  it('un technicien dans une équipe AVEC gérant ne fait que demander', () => {
    expect(peutValiderProgression(TECH, [GERANT, TECH])).toBe(false);
  });

  it('un inscrit SEUL dans son espace pilote ses propres clients', () => {
    // Cas de l'inscription self-service : rôle « technicien », aucun gérant.
    expect(peutValiderProgression(TECH, [TECH])).toBe(true);
  });

  it('équipe pas encore chargée : l’utilisateur n’est jamais bloqué', () => {
    expect(peutValiderProgression(TECH, [])).toBe(true);
  });

  it('l’admin plateforme pilote toujours, même entouré d’un gérant', () => {
    expect(peutValiderProgression({ id: 'u3', role: 'technicien', is_platform_admin: true }, [GERANT])).toBe(true);
  });

  it('une équipe polluée par un gérant d’une AUTRE entreprise bloquerait à tort', () => {
    // Régression réelle : fetchTeamProfiles renvoyait tous les profils de la
    // plateforme à un admin. La règle reste juste, c'est l'entrée qui doit
    // être filtrée par organisation (cf. DataContext).
    const gerantAutreOrg = { id: 'x', role: 'gerant' };
    expect(peutValiderProgression(TECH, [TECH, gerantAutreOrg])).toBe(false);
  });
});
