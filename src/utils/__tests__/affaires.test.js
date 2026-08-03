import { describe, it, expect } from 'vitest';
import { buildAffaires, devisStage } from '../affaires';
import { missingCommissionsForDevis, reconcileMissingCommissions } from '../commissionSync';

const RATES = { 1: 0.03, 2: 0.015 };

describe('devisStage', () => {
  it('prend l’étape du devis, sinon celle de la piste, sinon « proposition »', () => {
    expect(devisStage({ stage: 'negociation' }, { stage: 'nouveau' })).toBe('negociation');
    expect(devisStage({}, { stage: 'visite' })).toBe('visite');
    expect(devisStage({}, null)).toBe('proposition');
  });
});

describe('buildAffaires — une carte par CLIENT, ses devis attachés', () => {
  const leads = [
    { id: 'l1', name: 'Hôtel du Parc', stage: 'qualifie', estimatedValue: 100000 },
    { id: 'l2', name: 'Pharmacie', stage: 'nouveau', estimatedValue: 0 },
  ];
  const devis = [
    { id: 'd1', leadId: 'l1', total: 250000, stage: 'proposition' },
    { id: 'd2', leadId: 'l1', total: 900000, stage: 'negociation' },
    { id: 'dpro', leadId: 'l1', total: 50000, type: 'pro', stage: 'proposition' },
  ];

  it('un client = une seule carte, à SON étape (le kanban suit le client)', () => {
    const affaires = buildAffaires(leads, devis);
    const carte = affaires.filter((a) => a.lead.id === 'l1');
    expect(carte).toHaveLength(1);
    expect(carte[0].stage).toBe('qualifie');
  });

  it('les devis du client sont attachés à sa carte, suivis séparément', () => {
    const carte = buildAffaires(leads, devis).find((a) => a.lead.id === 'l1');
    expect(carte.devis.map((d) => d.id).sort()).toEqual(['d1', 'd2']);
    expect(carte.devis.map((d) => devisStage(d, carte.lead)).sort())
      .toEqual(['negociation', 'proposition']);
  });

  it('la valeur du client cumule ses devis en cours', () => {
    const carte = buildAffaires(leads, devis).find((a) => a.lead.id === 'l1');
    expect(carte.value).toBe(1150000);
  });

  it('un devis perdu ne compte plus dans la valeur du client', () => {
    const carte = buildAffaires(leads, [
      { id: 'd1', leadId: 'l1', total: 250000, stage: 'proposition' },
      { id: 'd2', leadId: 'l1', total: 900000, stage: 'perdu' },
    ]).find((a) => a.lead.id === 'l1');
    expect(carte.value).toBe(250000);
  });

  it('sans devis, la carte garde la valeur estimée du client', () => {
    const carte = buildAffaires(leads, devis).find((a) => a.lead.id === 'l2');
    expect(carte.devis).toHaveLength(0);
    expect(carte.stage).toBe('nouveau');
    expect(carte.value).toBe(0);
  });

  it('les devis de l’espace Pro ne sont jamais rattachés', () => {
    const carte = buildAffaires(leads, devis).find((a) => a.lead.id === 'l1');
    expect(carte.devis.some((d) => d.id === 'dpro')).toBe(false);
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

describe('attribution automatique — toute affaire gagnée a son apporteur', () => {
  const equipe = [
    { id: 'p-user-u2', userId: 'u2', name: 'Ibrahim', sponsorId: null },
    { id: 'p-user-u3', userId: 'u3', name: 'Fatou', sponsorId: null },
  ];

  it('sans parrain ni partenaire, le CRÉATEUR du devis est rémunéré', () => {
    const coms = missingCommissionsForDevis(
      { devis: { id: 'd1', leadId: 'l1', total: 300000, createdBy: 'u2' }, lead: { id: 'l1' }, partners: equipe, commissions: [] },
      RATES, '2026-08-03'
    );
    expect(coms).toHaveLength(1);
    expect(coms[0]).toMatchObject({ partnerId: 'p-user-u2', level: 1, amount: 9000 });
  });

  it('à défaut de créateur, le commercial assigné à la piste est rémunéré', () => {
    const coms = missingCommissionsForDevis(
      { devis: { id: 'd1', leadId: 'l1', total: 200000 }, lead: { id: 'l1', assignedTo: 'u3' }, partners: equipe, commissions: [] },
      RATES, '2026-08-03'
    );
    expect(coms[0].partnerId).toBe('p-user-u3');
  });

  it('le parrain de la piste reste prioritaire sur le créateur', () => {
    const coms = missingCommissionsForDevis(
      { devis: { id: 'd1', leadId: 'l1', total: 100000, createdBy: 'u2' },
        lead: { id: 'l1', parrainL1: 'p-user-u3' }, partners: equipe, commissions: [] },
      RATES, '2026-08-03'
    );
    expect(coms[0].partnerId).toBe('p-user-u3');
  });
});

describe('reconcileMissingCommissions — rattrapage du suivi par affaire', () => {
  const partners = [{ id: 'p1', name: 'Mamadou', sponsorId: null }];

  it('rattrape un DEVIS gagné même si sa piste n’est pas « gagné »', () => {
    const created = reconcileMissingCommissions({
      leads: [{ id: 'l1', stage: 'negociation', parrainL1: 'p1' }],
      devis: [{ id: 'd1', leadId: 'l1', total: 500000, stage: 'gagne' }],
      partners, commissions: [], referrals: [],
    }, RATES, '2026-08-03');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ devisId: 'd1', amount: 15000 });
  });

  it('deux devis gagnés du même client donnent deux commissions', () => {
    const created = reconcileMissingCommissions({
      leads: [{ id: 'l1', stage: 'gagne', parrainL1: 'p1' }],
      devis: [
        { id: 'd1', leadId: 'l1', total: 500000, stage: 'gagne' },
        { id: 'd2', leadId: 'l1', total: 300000, stage: 'gagne' },
      ],
      partners, commissions: [], referrals: [],
    }, RATES, '2026-08-03');
    expect(created.map((c) => c.devisId).sort()).toEqual(['d1', 'd2']);
  });

  it('ne double pas la commission d’une piste déjà rémunérée par affaire', () => {
    const created = reconcileMissingCommissions({
      leads: [{ id: 'l1', stage: 'gagne', parrainL1: 'p1', estimatedValue: 500000 }],
      devis: [{ id: 'd1', leadId: 'l1', total: 500000, stage: 'gagne', statut: 'finalise' }],
      partners, commissions: [], referrals: [],
    }, RATES, '2026-08-03');
    expect(created).toHaveLength(1);
  });

  it('idempotent : relancé, il ne crée plus rien', () => {
    const input = {
      leads: [{ id: 'l1', stage: 'gagne', parrainL1: 'p1' }],
      devis: [{ id: 'd1', leadId: 'l1', total: 500000, stage: 'gagne' }],
      partners, referrals: [],
    };
    const first = reconcileMissingCommissions({ ...input, commissions: [] }, RATES, '2026-08-03');
    const again = reconcileMissingCommissions({ ...input, commissions: first }, RATES, '2026-08-03');
    expect(again).toHaveLength(0);
  });

  it('ignore les devis de l’espace Pro payant', () => {
    const created = reconcileMissingCommissions({
      leads: [{ id: 'l1', stage: 'negociation', parrainL1: 'p1' }],
      devis: [{ id: 'dpro', leadId: 'l1', total: 500000, stage: 'gagne', type: 'pro' }],
      partners, commissions: [], referrals: [],
    }, RATES, '2026-08-03');
    expect(created).toHaveLength(0);
  });
});
