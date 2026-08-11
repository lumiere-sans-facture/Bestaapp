import { describe, it, expect } from 'vitest';
import { nouveauPompeKit, normaliserPompeKit, pompeKitEstValide, resumePompeKit, dupliquerPompeKit } from '../pompeKitEdition';

describe('pompeKitEdition — saisie et validation des kits pompage', () => {
  it('normalise un brouillon de formulaire (virgules, textes, arrondis)', () => {
    const k = normaliserPompeKit({
      name: '  Kit 1 HP  ', hp: '1,5', powerW: '750.4', maxHmt: '60',
      maxDebit: '3,2', panels: '3', panelW: '550', price: '780000', usage: ' Forage ',
    });
    expect(k.name).toBe('Kit 1 HP');
    expect(k.hp).toBe(1.5);
    expect(k.powerW).toBe(750);
    expect(k.maxDebit).toBe(3.2);
    expect(k.price).toBe(780000);
    expect(k.usage).toBe('Forage');
  });

  it('valide : nom, prix, HMT max et débit max obligatoires', () => {
    const complet = { name: 'Kit', price: '100000', maxHmt: '40', maxDebit: '2' };
    expect(pompeKitEstValide(complet)).toBe(true);
    expect(pompeKitEstValide({ ...complet, name: ' ' })).toBe(false);
    expect(pompeKitEstValide({ ...complet, price: '0' })).toBe(false);
    // Sans HMT ou débit, l'assistant ne peut jamais suggérer ce kit.
    expect(pompeKitEstValide({ ...complet, maxHmt: '' })).toBe(false);
    expect(pompeKitEstValide({ ...complet, maxDebit: '' })).toBe(false);
  });

  it('résume la carte kit sans afficher les champs vides', () => {
    expect(resumePompeKit({ hp: 1, maxHmt: 60, maxDebit: 3, panels: 3, panelW: 550 }))
      .toBe('1 HP · 60 m HMT · 3 m³/h · 3 × 550 Wc');
    expect(resumePompeKit({})).toBe('');
  });

  it('duplique avec un identifiant NEUF — les devis émis gardent leur référence', () => {
    const source = { id: 'pk-1hp', name: 'Kit 1 HP', price: 780000 };
    const copie = dupliquerPompeKit(source);
    expect(copie.id).not.toBe(source.id);
    expect(copie.name).toBe('Kit 1 HP (copie)');
    expect(copie.price).toBe(780000);
  });

  it('un kit vierge a un identifiant et des champs prêts pour le formulaire', () => {
    const k = nouveauPompeKit();
    expect(k.id).toBeTruthy();
    expect(k.name).toBe('');
    expect(pompeKitEstValide(k)).toBe(false);
  });
});
