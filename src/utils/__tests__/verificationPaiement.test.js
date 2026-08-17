// Vérification serveur d'un paiement d'abonnement.
// Ces règles décident si quelqu'un obtient un accès payant : le risque n'est
// pas de refuser à tort, c'est d'ACCORDER à tort.
import { describe, it, expect } from 'vitest';
import {
  verdictTransaction, abonnementApresPaiement, transactionIdValide, STATUT_SUCCES,
} from '../verificationPaiement';
import { SUBSCRIPTION_PRICE } from '../subscription';

const ok = { status: STATUT_SUCCES, amount: SUBSCRIPTION_PRICE, currency: 'XOF' };

describe('transactionIdValide', () => {
  it('accepte un identifiant plausible', () => {
    expect(transactionIdValide('TRX_9f8e7d6c5b4a')).toBe(true);
    expect(transactionIdValide('abc123')).toBe(true);
  });

  it('refuse le vide, le trop court et les caractères douteux', () => {
    expect(transactionIdValide('')).toBe(false);
    expect(transactionIdValide('abc')).toBe(false);
    expect(transactionIdValide('abc; drop table')).toBe(false);
    expect(transactionIdValide(null)).toBe(false);
  });
});

describe('verdictTransaction', () => {
  it('valide un paiement abouti au bon montant', () => {
    expect(verdictTransaction(ok)).toEqual({
      valide: true, motif: null, montant: SUBSCRIPTION_PRICE, statut: 'SUCCESS',
    });
  });

  it('REFUSE un montant inférieur au prix attendu', () => {
    // Le cœur du sujet : payer 100 F ne doit pas ouvrir un abonnement à 5 000.
    const v = verdictTransaction({ ...ok, amount: 100 });
    expect(v.valide).toBe(false);
    expect(v.motif).toMatch(/insuffisant/);
  });

  it('accepte un montant supérieur (trop-perçu, pas une fraude)', () => {
    expect(verdictTransaction({ ...ok, amount: SUBSCRIPTION_PRICE + 500 }).valide).toBe(true);
  });

  it('refuse tout statut autre que SUCCESS, avec un motif lisible', () => {
    expect(verdictTransaction({ ...ok, status: 'FAILED' }).motif).toMatch(/échoué/);
    expect(verdictTransaction({ ...ok, status: 'INSUFFICIENT_FUND' }).motif).toMatch(/Solde insuffisant/);
    expect(verdictTransaction({ ...ok, status: 'PENDING' }).valide).toBe(false);
  });

  it('ne prend JAMAIS un statut inconnu pour un succès', () => {
    // Liste blanche : un statut ajouté demain par l'agrégateur reste refusé.
    const v = verdictTransaction({ ...ok, status: 'QUELQUE_CHOSE_DE_NEUF' });
    expect(v.valide).toBe(false);
    expect(v.motif).toMatch(/non abouti/);
  });

  it('refuse une réponse vide ou sans statut', () => {
    expect(verdictTransaction(null).valide).toBe(false);
    expect(verdictTransaction({}).valide).toBe(false);
    expect(verdictTransaction({ amount: 5000 }).valide).toBe(false);
  });

  it('refuse une devise inattendue', () => {
    expect(verdictTransaction({ ...ok, currency: 'EUR' }).motif).toMatch(/Devise/);
  });

  it('utilise le montant attendu fourni, pas celui de la réponse', () => {
    expect(verdictTransaction({ ...ok, amount: 5000 }, { montantAttendu: 10000 }).valide).toBe(false);
  });
});

describe('abonnementApresPaiement', () => {
  const T0 = Date.UTC(2026, 7, 13); // 13 août 2026

  it('ouvre 30 jours à partir d’aujourd’hui pour un premier paiement', () => {
    const sub = abonnementApresPaiement({ id: 'sub-1', status: 'en_attente_paiement' }, T0);
    expect(sub.status).toBe('actif');
    expect(sub.dateDebut).toBe(new Date(T0).toISOString());
    expect(new Date(sub.dateFin).getTime()).toBe(T0 + 30 * 86400000);
  });

  it('AJOUTE les 30 jours à une échéance encore en cours', () => {
    // Renouveler tôt ne doit jamais faire perdre les jours déjà payés.
    const fin = new Date(T0 + 10 * 86400000).toISOString();
    const sub = abonnementApresPaiement({ id: 'sub-1', dateFin: fin, dateDebut: '2026-07-01T00:00:00.000Z' }, T0);
    expect(new Date(sub.dateFin).getTime()).toBe(T0 + 40 * 86400000);
    expect(sub.dateDebut).toBe('2026-07-01T00:00:00.000Z'); // début d'origine conservé
  });

  it('repart d’aujourd’hui quand l’échéance est passée', () => {
    const fin = new Date(T0 - 5 * 86400000).toISOString();
    const sub = abonnementApresPaiement({ id: 'sub-1', dateFin: fin }, T0);
    expect(new Date(sub.dateFin).getTime()).toBe(T0 + 30 * 86400000);
  });
});
