import { describe, it, expect } from 'vitest';
import { consommer, purger, adresseAppelant, FENETRE_MS, CLES_MAX } from '../limiteRequetes';

const t0 = 1_700_000_000_000;

describe('consommer — plafond par fenêtre glissante', () => {
  it('laisse passer jusqu’à la limite, puis refuse', () => {
    const table = new Map();
    for (let i = 0; i < 3; i += 1) {
      expect(consommer(table, 'ip', 3, { maintenant: t0 }).autorise).toBe(true);
    }
    expect(consommer(table, 'ip', 3, { maintenant: t0 }).autorise).toBe(false);
  });

  it('décompte les places restantes', () => {
    const table = new Map();
    expect(consommer(table, 'ip', 3, { maintenant: t0 }).restant).toBe(2);
    expect(consommer(table, 'ip', 3, { maintenant: t0 }).restant).toBe(1);
    expect(consommer(table, 'ip', 3, { maintenant: t0 }).restant).toBe(0);
  });

  it('rouvre dès que la fenêtre a glissé', () => {
    const table = new Map();
    for (let i = 0; i < 3; i += 1) consommer(table, 'ip', 3, { maintenant: t0 });
    expect(consommer(table, 'ip', 3, { maintenant: t0 + FENETRE_MS - 1 }).autorise).toBe(false);
    expect(consommer(table, 'ip', 3, { maintenant: t0 + FENETRE_MS + 1 }).autorise).toBe(true);
  });

  it('annonce le délai d’attente, pour l’en-tête Retry-After', () => {
    const table = new Map();
    consommer(table, 'ip', 1, { maintenant: t0 });
    const refus = consommer(table, 'ip', 1, { maintenant: t0 + 20_000 });
    expect(refus.autorise).toBe(false);
    expect(refus.resetDans).toBe(40); // 60 s de fenêtre − 20 s écoulées
  });

  it('jamais 0 seconde d’attente : un client qui réessaie aussitôt boucle', () => {
    const table = new Map();
    consommer(table, 'ip', 1, { maintenant: t0 });
    expect(consommer(table, 'ip', 1, { maintenant: t0 + FENETRE_MS - 1 }).resetDans).toBeGreaterThanOrEqual(1);
  });

  it('chaque appelant a son propre compteur', () => {
    const table = new Map();
    consommer(table, 'a', 1, { maintenant: t0 });
    expect(consommer(table, 'a', 1, { maintenant: t0 }).autorise).toBe(false);
    expect(consommer(table, 'b', 1, { maintenant: t0 }).autorise).toBe(true);
  });

  it('la liste d’horodatages reste bornée par la limite', () => {
    // Sinon un attaquant ferait grossir la mémoire à chaque tentative REFUSÉE.
    const table = new Map();
    for (let i = 0; i < 500; i += 1) consommer(table, 'ip', 2, { maintenant: t0 });
    expect(table.get('ip').length).toBe(2);
  });

  it('une limite absurde est ramenée à au moins 1', () => {
    const table = new Map();
    expect(consommer(table, 'ip', 0, { maintenant: t0 }).autorise).toBe(true);
    expect(consommer(table, 'ip', 0, { maintenant: t0 }).autorise).toBe(false);
  });
});

describe('purger — la mémoire de l’instance doit redescendre', () => {
  it('retire les clés dont toutes les requêtes sont périmées', () => {
    const table = new Map();
    consommer(table, 'vieille', 5, { maintenant: t0 });
    consommer(table, 'recente', 5, { maintenant: t0 + FENETRE_MS });
    expect(purger(table, { maintenant: t0 + FENETRE_MS + 1 })).toBe(1);
    expect(table.has('vieille')).toBe(false);
    expect(table.has('recente')).toBe(true);
  });

  it('borne la table même sous rotation d’adresses', () => {
    // Un attaquant changeant d'IP à chaque appel ferait sinon du limiteur
    // lui-même le déni de service.
    const table = new Map();
    for (let i = 0; i < 60; i += 1) consommer(table, `ip-${i}`, 5, { maintenant: t0 });
    purger(table, { maintenant: t0, clesMax: 50 });
    expect(table.size).toBe(50);
  });

  it('le plafond par défaut est raisonnable', () => {
    expect(CLES_MAX).toBeGreaterThanOrEqual(1000);
  });

  it('une table vide ne pose pas de problème', () => {
    expect(purger(new Map())).toBe(0);
  });
});

describe('adresseAppelant', () => {
  it('retient le DERNIER maillon de x-forwarded-for', () => {
    // Le client peut préfixer l'en-tête ; le proxy ajoute la vraie adresse à
    // la fin. Prendre la première laisserait choisir son identité — et donc
    // contourner le plafond en changeant d'en-tête à chaque appel.
    expect(adresseAppelant({ 'x-forwarded-for': '1.1.1.1, 203.0.113.7' })).toBe('203.0.113.7');
  });

  it('un en-tête forgé ne permet pas de se faire passer pour un autre', () => {
    const forge = adresseAppelant({ 'x-forwarded-for': '9.9.9.9, 9.9.9.9, 203.0.113.7' });
    expect(forge).toBe('203.0.113.7');
  });

  it('accepte une seule adresse', () => {
    expect(adresseAppelant({ 'x-forwarded-for': '203.0.113.7' })).toBe('203.0.113.7');
  });

  it('retombe sur x-real-ip', () => {
    expect(adresseAppelant({ 'x-real-ip': '203.0.113.9' })).toBe('203.0.113.9');
  });

  it('sans en-tête exploitable, une clé neutre plutôt qu’un plantage', () => {
    expect(adresseAppelant({})).toBe('inconnue');
    expect(adresseAppelant()).toBe('inconnue');
    expect(adresseAppelant({ 'x-forwarded-for': '  ,  ' })).toBe('inconnue');
  });

  it('tolère un en-tête livré en tableau', () => {
    expect(adresseAppelant({ 'x-forwarded-for': ['1.1.1.1', '203.0.113.7'] })).toBe('203.0.113.7');
  });
});
