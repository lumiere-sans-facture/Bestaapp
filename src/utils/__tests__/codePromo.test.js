import { describe, it, expect } from 'vitest';
import {
  normaliserCode, formatCodeValide, genererCode, joursDuCode, verifierCode, messageCode,
  abonnementApresCode, estEssai, JOURS_ESSAI, JOURS_ESSAI_MAX, FORMULE_ESSAI, MESSAGES_CODE,
} from '../codePromo';
import { DAY_MS } from '../date';
import { isSubscriptionActive } from '../subscription';

const MAINTENANT = Date.UTC(2026, 8, 22, 12);
const code = (extra = {}) => ({ code: 'ESSAI30', jours: 30, actif: true, maxUtilisations: null, expireLe: null, utilisations: [], ...extra });

describe('normaliserCode / formatCodeValide', () => {
  it('ramène un code dicté à sa forme canonique', () => {
    expect(normaliserCode(' besta 30 ')).toBe('BESTA30');
    expect(normaliserCode(null)).toBe('');
  });
  it('accepte lettres, chiffres et tirets, de 4 à 32 caractères', () => {
    expect(formatCodeValide('essai-7kq4pm')).toBe(true);
    expect(formatCodeValide('abc')).toBe(false);
    expect(formatCodeValide('ESSAI_30')).toBe(false);
    expect(formatCodeValide('A'.repeat(33))).toBe(false);
  });
});

describe('genererCode', () => {
  it('produit un code valide, sans caractères ambigus', () => {
    for (let i = 0; i < 50; i += 1) {
      const c = genererCode();
      expect(formatCodeValide(c)).toBe(true);
      expect(c).toMatch(/^ESSAI-[A-HJ-NP-Z2-9]{6}$/);
    }
  });
});

describe('joursDuCode', () => {
  it('30 jours par défaut, bornés à un an', () => {
    expect(joursDuCode({})).toBe(JOURS_ESSAI);
    expect(joursDuCode({ jours: 0 })).toBe(JOURS_ESSAI);
    expect(joursDuCode({ jours: '14' })).toBe(14);
    expect(joursDuCode({ jours: 5000 })).toBe(JOURS_ESSAI_MAX);
  });
});

describe('verifierCode', () => {
  it('accepte un code actif, jamais utilisé par ce compte', () => {
    expect(verifierCode('essai30', code(), 'u1', MAINTENANT)).toEqual({ ok: true });
  });
  it('refuse chaque cas avec sa raison', () => {
    expect(verifierCode('a b', code(), 'u1', MAINTENANT).raison).toBe('format');
    expect(verifierCode('ESSAI30', null, 'u1', MAINTENANT).raison).toBe('inconnu');
    expect(verifierCode('ESSAI30', code({ actif: false }), 'u1', MAINTENANT).raison).toBe('desactive');
    expect(verifierCode('ESSAI30', code({ expireLe: new Date(MAINTENANT - 1000).toISOString() }), 'u1', MAINTENANT).raison).toBe('expire');
    expect(verifierCode('ESSAI30', code({ utilisations: [{ userId: 'u1' }] }), 'u1', MAINTENANT).raison).toBe('deja');
    expect(verifierCode('ESSAI30', code({ maxUtilisations: 1, utilisations: [{ userId: 'u2' }] }), 'u1', MAINTENANT).raison).toBe('epuise');
  });
  it('un plafond non atteint laisse passer', () => {
    expect(verifierCode('ESSAI30', code({ maxUtilisations: 2, utilisations: [{ userId: 'u2' }] }), 'u1', MAINTENANT).ok).toBe(true);
  });
  it('chaque raison a son message, sans jamais citer le code', () => {
    for (const raison of ['format', 'inconnu', 'desactive', 'expire', 'epuise', 'deja', 'trop', 'reseau', 'profil']) {
      expect(MESSAGES_CODE[raison]).toBeTruthy();
    }
    expect(messageCode('raison-inconnue')).toBe(MESSAGES_CODE.inconnu);
  });
});

describe('abonnementApresCode', () => {
  it('sans abonnement : essai actif de 30 jours à partir de maintenant', () => {
    const sub = abonnementApresCode(undefined, { userId: 'u1', code: 'essai30', jours: 30 }, MAINTENANT);
    expect(sub).toMatchObject({ id: 'sub-u1', userId: 'u1', status: 'actif', formule: FORMULE_ESSAI, montant: 0, codePromo: 'ESSAI30' });
    expect(new Date(sub.dateFin).getTime()).toBe(MAINTENANT + 30 * DAY_MS);
    expect(estEssai(sub)).toBe(true);
  });

  it('un abonné payant garde sa formule et ses jours restants', () => {
    const payant = { id: 'sub-u1', userId: 'u1', status: 'actif', formule: 'annuel', montant: 45000,
      dateDebut: '2026-01-01T00:00:00.000Z', dateFin: new Date(MAINTENANT + 10 * DAY_MS).toISOString() };
    const sub = abonnementApresCode(payant, { userId: 'u1', code: 'ESSAI30', jours: 30 }, MAINTENANT);
    expect(sub.formule).toBe('annuel');
    expect(sub.montant).toBe(45000);
    expect(sub.dateDebut).toBe('2026-01-01T00:00:00.000Z');
    expect(new Date(sub.dateFin).getTime()).toBe(MAINTENANT + 40 * DAY_MS);
    expect(estEssai(sub)).toBe(false);
  });

  it('un abonnement expiré repart de maintenant, en essai', () => {
    const expire = { id: 'sub-u1', userId: 'u1', status: 'actif', formule: 'mensuel', montant: 5000,
      dateFin: new Date(MAINTENANT - 5 * DAY_MS).toISOString() };
    const sub = abonnementApresCode(expire, { userId: 'u1', code: 'ESSAI30', jours: 30 }, MAINTENANT);
    expect(sub.formule).toBe(FORMULE_ESSAI);
    expect(new Date(sub.dateFin).getTime()).toBe(MAINTENANT + 30 * DAY_MS);
  });

  it('une demande de paiement en attente ne bloque pas l’essai', () => {
    const attente = { id: 'sub-u1', userId: 'u1', status: 'en_attente_paiement', formule: 'mensuel', dateFin: null };
    // Horloge réelle : isSubscriptionActive compare à Date.now().
    const sub = abonnementApresCode(attente, { userId: 'u1', code: 'ESSAI30', jours: 30 }, Date.now());
    expect(sub.status).toBe('actif');
    expect(isSubscriptionActive(sub)).toBe(true);
  });
});
