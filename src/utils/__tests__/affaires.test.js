import { describe, it, expect } from 'vitest';
import { buildAffaires, aggregateLeadStage, devisStage } from '../affaires';
import { missingCommissionsForDevis } from '../commissionSync';

const RATES = { 1: 0.03, 2: 0.015 };

describe('devisStage', () => {
  it('prend l’étape du devis, sinon celle de la piste, sinon « proposition »', () => {
    expect(devisStage({ stage: 'negociation' }, { stage: 'nouveau' })).toBe('negociation');
    expect(devisStage({}, { stage: 'visite' })).toBe('visite');
    expect(devisStage({}, null)).toBe('proposition');
  });
});

describe('buildAffaires — le suivi se fait par devis, pas par client', () => {
  const leads = [
    { id: 'l1', name: 'Hôtel du Parc', stage: 'qualifie', estimatedValue: 100000 },
    { id: 'l2', name: 'Pharmacie', stage: 'nouveau', estimatedValue: 0 },
  ];
  const devis = [
    { id: 'd1', leadId: 'l1', total: 250000, stage: 'proposition' },
    { id: 'd2', leadId: 'l1', total: 900000, stage: 'negociation' },
    { id: 'dpro', leadId: 'l1', total: 50000, type: 'pro', stage: 'proposition' },
  ];

  it('un client avec deux devis a DEUX affaires indépendantes', () => {
    const affaires = buildAffaires(leads, devis);
    const affL1 = affaires.filter((a) => a.lead.id === 'l1');
    expect(affL1).toHaveLength(2);
    expect(affL1.map((a) => a.stage).sort()).toEqual(['negociation', 'proposition']);
    expect(affL1.map((a) => a.value).sort((x, y) => x - y)).toEqual([250000, 900000]);
  });

  it('un client sans devis reste une affaire « piste » (prospection)', () => {
    const affaires = buildAffaires(leads, devis);
    const piste = affaires.find((a) => a.lead.id === 'l2');
    expect(piste.kind).toBe('piste');
    expect(piste.stage).toBe('nouveau');
  });

  it('les devis de l’espace Pro ne créent jamais d’affaire publique', () => {
    const affaires = buildAffaires(leads, devis);
    expect(affaires.some((a) => a.devis?.id === 'dpro')).toBe(false);
  });

  it('la carte piste disparaît dès que le client a un devis', () => {
    const affaires = buildAffaires(leads, devis);
    expect(affaires.filter((a) => a.lead.id === 'l1' && a.kind === 'piste')).toHaveLength(0);
  });
});

describe('aggregateLeadStage — étape client cohérente avec ses affaires', () => {
  it('retient la plus avancée des affaires non perdues', () => {
    expect(aggregateLeadStage(['proposition', 'negociation'])).toBe('negociation');
    expect(aggregateLeadStage(['gagne', 'proposition'])).toBe('gagne');
    expect(aggregateLeadStage(['perdu', 'visite'])).toBe('visite');
  });
  it('« perdu » seulement si toutes les affaires le sont', () => {
    expect(aggregateLeadStage(['perdu', 'perdu'])).toBe('perdu');
  });
  it('null sans devis (la piste garde sa propre étape)', () => {
    expect(aggregateLeadStage([])).toBeNull();
  });
});

describe('missingCommissionsForDevis — une commission PAR devis gagné', () => {
  const partners = [
    { id: 'p1', name: 'Mamadou', sponsorId: null },
    { id: 'p2', name: 'Aminata', sponsorId: 'p1' },
  ];
  const lead = { id: 'l1', parrainL1: 'p2', parrainL2: 'p1' };

  it('génère N1 (3 %) et N2 (1,5 %) sur le total du devis', () => {
    const coms = missingCommissionsForDevis(
      { devis: { id: 'd1', leadId: 'l1', total: 1000000 }, lead, partners, commissions: [] },
      RATES, '2026-08-03'
    );
    expect(coms).toHaveLength(2);
    expect(coms.find((c) => c.level === 1)).toMatchObject({ partnerId: 'p2', amount: 30000, devisId: 'd1', status: 'en_attente' });
    expect(coms.find((c) => c.level === 2)).toMatchObject({ partnerId: 'p1', amount: 15000, devisId: 'd1' });
  });

  it('deux devis gagnés du même client = deux commissions distinctes', () => {
    const first = missingCommissionsForDevis(
      { devis: { id: 'd1', leadId: 'l1', total: 500000 }, lead, partners, commissions: [] },
      RATES, '2026-08-03'
    );
    const second = missingCommissionsForDevis(
      { devis: { id: 'd2', leadId: 'l1', total: 800000 }, lead, partners, commissions: first },
      RATES, '2026-08-03'
    );
    expect(second).toHaveLength(2);
    expect(second.find((c) => c.level === 1).amount).toBe(24000);
  });

  it('idempotent : regagner le MÊME devis ne crée aucun doublon', () => {
    const first = missingCommissionsForDevis(
      { devis: { id: 'd1', leadId: 'l1', total: 500000 }, lead, partners, commissions: [] },
      RATES, '2026-08-03'
    );
    const again = missingCommissionsForDevis(
      { devis: { id: 'd1', leadId: 'l1', total: 500000 }, lead, partners, commissions: first },
      RATES, '2026-08-03'
    );
    expect(again).toHaveLength(0);
  });

  it('sans parrain de piste, l’apporteur du devis (et son sponsor) sont rémunérés', () => {
    const coms = missingCommissionsForDevis(
      { devis: { id: 'd1', leadId: 'l1', total: 200000, partnerId: 'p2' }, lead: { id: 'l1' }, partners, commissions: [] },
      RATES, '2026-08-03'
    );
    expect(coms.find((c) => c.level === 1).partnerId).toBe('p2');
    expect(coms.find((c) => c.level === 2).partnerId).toBe('p1');
  });

  it('aucune commission sans montant', () => {
    expect(missingCommissionsForDevis(
      { devis: { id: 'd1', leadId: 'l1', total: 0 }, lead, partners, commissions: [] },
      RATES, '2026-08-03'
    )).toHaveLength(0);
  });
});
