import { describe, it, expect } from 'vitest';
import { estProprietaireEspace } from '../roles';

const GERANT = { id: 'u1', role: 'gerant' };
const TECH = { id: 'u2', role: 'technicien' };

describe('estProprietaireEspace — qui engage l’entreprise', () => {
  it('le gérant est propriétaire de son espace', () => {
    expect(estProprietaireEspace(GERANT, [GERANT, TECH])).toBe(true);
  });

  it('un technicien dans une équipe AVEC gérant ne l’est pas', () => {
    expect(estProprietaireEspace(TECH, [GERANT, TECH])).toBe(false);
  });

  it('un inscrit SEUL dans son espace en est le propriétaire', () => {
    // Inscription self-service : rôle « technicien », aucun gérant dans l'org.
    expect(estProprietaireEspace(TECH, [TECH])).toBe(true);
  });

  it('équipe pas encore chargée : on ne bloque pas l’utilisateur', () => {
    expect(estProprietaireEspace(TECH, [])).toBe(true);
  });

  it('l’admin plateforme l’est toujours, même entouré d’un gérant', () => {
    expect(estProprietaireEspace({ id: 'u3', role: 'technicien', is_platform_admin: true }, [GERANT])).toBe(true);
  });

  it('une équipe polluée par un gérant d’une AUTRE entreprise bloquerait à tort', () => {
    // Régression réelle : fetchTeamProfiles renvoyait tous les profils de la
    // plateforme à un admin. La règle reste juste, c'est son entrée qui doit
    // être filtrée par organisation (cf. DataContext).
    const gerantAutreOrg = { id: 'x', role: 'gerant' };
    expect(estProprietaireEspace(TECH, [TECH, gerantAutreOrg])).toBe(false);
  });
});
