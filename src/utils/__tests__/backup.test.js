import { describe, it, expect } from 'vitest';
import { buildBackup, isValidBackup, extractState, BACKUP_MARKER } from '../backup';

const sampleState = {
  version: 5,
  products: [{ id: 'p1' }],
  leads: [{ id: 'l1' }],
  partners: [], commissions: [], devis: [], referrals: [], orders: [],
  formations: [], formationProgress: [], subscriptions: [], subscriptionPayments: [],
  companies: [], factures: [],
  devisCounter: 3, orderCounter: 2,
  syncStatus: 'online', // clé hors sauvegarde — doit être ignorée
};

describe('buildBackup', () => {
  it('produit un objet marqué avec collections et compteurs', () => {
    const b = buildBackup(sampleState, '2026-06-26T00:00:00.000Z');
    expect(b.app).toBe(BACKUP_MARKER);
    expect(b.version).toBe(5);
    expect(b.exportedAt).toBe('2026-06-26T00:00:00.000Z');
    expect(b.data.products).toEqual([{ id: 'p1' }]);
    expect(b.data.devisCounter).toBe(3);
    expect(b.data.orderCounter).toBe(2);
    expect(b.data).not.toHaveProperty('syncStatus');
  });
});

describe('isValidBackup', () => {
  it('accepte une sauvegarde valide', () => {
    expect(isValidBackup(buildBackup(sampleState, 'x'))).toBe(true);
  });
  it('rejette objet nul, vide, mauvais marqueur ou sans data', () => {
    expect(isValidBackup(null)).toBe(false);
    expect(isValidBackup({})).toBe(false);
    expect(isValidBackup({ app: 'autre', data: {} })).toBe(false);
    expect(isValidBackup({ app: BACKUP_MARKER })).toBe(false);
  });
  it('rejette si une collection présente n’est pas un tableau', () => {
    expect(isValidBackup({ app: BACKUP_MARKER, data: { products: 'nope' } })).toBe(false);
  });
});

describe('extractState', () => {
  it('ne garde que les clés connues (collections + compteurs)', () => {
    const out = extractState({ data: { products: [{ id: 'p1' }], devisCounter: 7, hacker: 'x' } });
    expect(out.products).toEqual([{ id: 'p1' }]);
    expect(out.devisCounter).toBe(7);
    expect(out).not.toHaveProperty('hacker');
  });
  it('ignore les clés absentes', () => {
    expect(extractState({ data: { leads: [] } })).toEqual({ leads: [] });
  });
});
