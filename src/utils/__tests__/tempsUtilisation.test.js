// Durée d'utilisation. Le risque : un onglet oublié ouvert un week-end qui
// compte 60 heures, ou un aller-retour sur WhatsApp qui coupe la session.
import { describe, it, expect } from 'vitest';
import {
  demarrerPeriode, noterActivite, proprietesTemps, sessionPour, uuidV7,
  INACTIVITE_MAX_MS, PAUSE_SESSION_MS, DUREE_MAX_MS,
} from '../tempsUtilisation';

const S = 1000;
const MIN = 60 * S;

describe('proprietesTemps', () => {
  it('compte le temps écran affiché entre le début et la fin', () => {
    const p = noterActivite(demarrerPeriode(0), 40 * S);
    expect(proprietesTemps(p, 90 * S)).toEqual({ duree_secondes: 90, duree_minutes: 1.5 });
  });

  it('un long silence ne compte que pour INACTIVITE_MAX_MS (onglet oublié)', () => {
    const p = noterActivite(demarrerPeriode(0), 30 * S);
    // 30 s d'usage, puis l'onglet reste affiché 3 heures sans un geste.
    const t = proprietesTemps(p, 30 * S + 3 * 60 * MIN);
    expect(t.duree_secondes).toBe(30 + INACTIVITE_MAX_MS / S);
  });

  it('chaque intervalle entre deux gestes est plafonné séparément', () => {
    let p = demarrerPeriode(0);
    p = noterActivite(p, 20 * MIN);            // 20 min sans geste → 5 min
    p = noterActivite(p, 20 * MIN + 2 * MIN);  // 2 min de lecture → 2 min
    expect(proprietesTemps(p, 22 * MIN).duree_secondes).toBe(7 * 60);
  });

  it('ignore un aller-retour de moins de 2 secondes', () => {
    expect(proprietesTemps(demarrerPeriode(0), 1500)).toBeNull();
    expect(proprietesTemps(demarrerPeriode(0), 2000)).not.toBeNull();
  });

  it('plafonne une durée aberrante et ne retire rien si l’horloge recule', () => {
    let p = demarrerPeriode(0);
    for (let t = MIN; t <= 20 * 60 * MIN; t += MIN) p = noterActivite(p, t);
    expect(proprietesTemps(p, 20 * 60 * MIN).duree_secondes).toBe(DUREE_MAX_MS / S);
    const recul = noterActivite(noterActivite(demarrerPeriode(0), 10 * S), 5 * S);
    expect(recul.actifMs).toBe(10 * S);
  });

  it('une copie abîmée ne produit pas de durée', () => {
    expect(proprietesTemps({ vu: 5 }, 5)).toBeNull();
    expect(proprietesTemps(null, 5)).toBeNull();
  });
});

describe('sessionPour', () => {
  const id = () => 'nouvelle';
  it('garde la session si l’app revient en moins de 30 minutes', () => {
    const s = { id: 'a', fin: 0 };
    expect(sessionPour(s, PAUSE_SESSION_MS, id)).toBe(s);
  });
  it('en ouvre une nouvelle après une pause plus longue, ou sans session', () => {
    expect(sessionPour({ id: 'a', fin: 0 }, PAUSE_SESSION_MS + 1, id)).toEqual({ id: 'nouvelle', fin: PAUSE_SESSION_MS + 1 });
    expect(sessionPour(null, 10, id).id).toBe('nouvelle');
    expect(sessionPour({ id: 'a' }, 10, id).id).toBe('nouvelle');
  });
});

describe('uuidV7', () => {
  it('produit un UUID v7 qui commence par l’heure', () => {
    const t = Date.UTC(2026, 9, 9, 16, 0, 0);
    const u = uuidV7(t, new Uint8Array([0xff, 1, 0xff, 2, 3, 4, 5, 6, 7, 8]));
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(parseInt(u.replace(/-/g, '').slice(0, 12), 16)).toBe(t);
  });
});
