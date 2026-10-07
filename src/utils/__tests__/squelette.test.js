import { describe, it, expect } from 'vitest';
import { formeSquelette, titreSquelette, estAdressePro, ongletActif } from '../squelette';

describe('squelette de chargement : la forme de la page rechargée', () => {
  it('chaque page a sa forme', () => {
    expect(formeSquelette('/')).toBe('accueil');
    expect(formeSquelette('/connexion')).toBe('connexion');
    expect(formeSquelette('/dashboard')).toBe('tableau');
    expect(formeSquelette('/pro')).toBe('tableau');
    expect(formeSquelette('/pipeline')).toBe('kanban');
    expect(formeSquelette('/clients')).toBe('cartes');
    expect(formeSquelette('/clients/c-1')).toBe('fiche');
    expect(formeSquelette('/boutique')).toBe('boutique');
    expect(formeSquelette('/devis')).toBe('liste');
    expect(formeSquelette('/pro/documents')).toBe('liste');
    expect(formeSquelette('/plus')).toBe('menu');
    expect(formeSquelette('/plus/kits')).toBe('sous-page');
    expect(formeSquelette('/pro/entreprise')).toBe('formulaire');
    expect(formeSquelette('/boutique/')).toBe('boutique');
    expect(formeSquelette('/inconnue')).toBe('tableau');
  });

  it('titres fixes repris tels quels, sinon rien', () => {
    expect(titreSquelette('/boutique')).toBe('Boutique');
    expect(titreSquelette('/pro/documents')).toBe('Devis & Factures');
    expect(titreSquelette('/dashboard')).toBeNull();
    expect(titreSquelette('/plus/kits')).toBeNull();
  });

  it('onglets : espace Pro et onglet actif', () => {
    expect(estAdressePro('/pro/clients')).toBe(true);
    expect(estAdressePro('/produits')).toBe(false);
    expect(ongletActif('/plus', '/plus/kits')).toBe(true);
    expect(ongletActif('/pro', '/pro/clients')).toBe(false);
    expect(ongletActif('/pro/clients', '/pro/clients')).toBe(true);
  });
});
