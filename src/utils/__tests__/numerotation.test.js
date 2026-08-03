import { describe, it, expect } from 'vitest';
import { prochainNumeroDevis } from '../affaires';
import { prochainNumeroFacture } from '../facture';

const LE_3_AOUT = new Date(2026, 7, 3);

describe('prochainNumeroDevis — unique même entre deux appareils', () => {
  it('démarre à 0001 le premier devis du jour', () => {
    expect(prochainNumeroDevis([], LE_3_AOUT)).toBe('BS-20260803-0001');
  });

  it('suit le rang le plus élevé DÉJÀ enregistré (source répliquée)', () => {
    const devis = [
      { devisNumber: 'BS-20260803-0001' },
      { devisNumber: 'BS-20260803-0002' },
    ];
    expect(prochainNumeroDevis(devis, LE_3_AOUT)).toBe('BS-20260803-0003');
  });

  it('un devis créé sur un AUTRE appareil est pris en compte après sync', () => {
    // Le compteur local vaudrait 1 ; c'est le devis reçu qui fait foi.
    expect(prochainNumeroDevis([{ devisNumber: 'BS-20260803-0007' }], LE_3_AOUT))
      .toBe('BS-20260803-0008');
  });

  it('les devis des autres jours ne décalent pas la numérotation', () => {
    const devis = [{ devisNumber: 'BS-20260802-0042' }];
    expect(prochainNumeroDevis(devis, LE_3_AOUT)).toBe('BS-20260803-0001');
  });

  it('tolère les numéros absents ou malformés', () => {
    const devis = [{}, { devisNumber: 'BS-20260803-XX' }, { devisNumber: 'BS-20260803-0005' }];
    expect(prochainNumeroDevis(devis, LE_3_AOUT)).toBe('BS-20260803-0006');
  });
});

describe('prochainNumeroFacture — unique par émetteur', () => {
  const company = { facturePrefix: 'FAC', factureCounter: 0 };

  it('démarre à 001', () => {
    expect(prochainNumeroFacture([], 'u1', company, 2026).numero).toBe('FAC-2026-001');
  });

  it('suit les factures déjà émises, même si le compteur local est en retard', () => {
    const factures = [{ userId: 'u1', numero: 'FAC-2026-004' }];
    expect(prochainNumeroFacture(factures, 'u1', company, 2026).numero).toBe('FAC-2026-005');
  });

  it('ne réutilise jamais un numéro libéré par une suppression (plancher = compteur)', () => {
    expect(prochainNumeroFacture([], 'u1', { facturePrefix: 'FAC', factureCounter: 9 }, 2026).numero)
      .toBe('FAC-2026-010');
  });

  it('ignore les factures des autres émetteurs', () => {
    const factures = [{ userId: 'u2', numero: 'FAC-2026-050' }];
    expect(prochainNumeroFacture(factures, 'u1', company, 2026).numero).toBe('FAC-2026-001');
  });

  it('respecte le préfixe personnalisé de l’entreprise', () => {
    const c = { facturePrefix: 'BS', factureCounter: 0 };
    expect(prochainNumeroFacture([], 'u1', c, 2026).numero).toBe('BS-2026-001');
  });

  it('repart à 001 l’année suivante', () => {
    const factures = [{ userId: 'u1', numero: 'FAC-2026-030' }];
    expect(prochainNumeroFacture(factures, 'u1', company, 2027).numero).toBe('FAC-2027-001');
  });
});
