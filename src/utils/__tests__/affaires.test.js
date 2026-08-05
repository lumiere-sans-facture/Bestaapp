import { describe, it, expect } from 'vitest';
import { buildAffaires, devisStage, devisDuClient } from '../affaires';
import { missingCommissionsForDevis, reconcileMissingCommissions } from '../commissionSync';

const RATES = { 1: 0.03, 2: 0.015 };

describe('devisStage', () => {
  it('prend l’étape du devis, sinon celle de la piste, sinon « nouveau »', () => {
    expect(devisStage({ stage: 'negociation' }, { stage: 'nouveau' })).toBe('negociation');
    expect(devisStage({}, { stage: 'visite' })).toBe('visite');
    expect(devisStage({}, null)).toBe('nouveau');
  });
});

describe('buildAffaires — UNE CARTE PAR DEVIS (deux devis = deux suivis)', () => {
  const leads = [
    { id: 'l1', name: 'Hôtel du Parc', stage: 'qualifie', estimatedValue: 100000 },
    { id: 'l2', name: 'Pharmacie', stage: 'nouveau', estimatedValue: 0 },
  ];
  const devis = [
    { id: 'd1', leadId: 'l1', total: 250000, stage: 'proposition', createdAt: '2026-08-01' },
    { id: 'd2', leadId: 'l1', total: 900000, stage: 'negociation', createdAt: '2026-08-02' },
    { id: 'dpro', leadId: 'l1', total: 50000, type: 'pro', stage: 'proposition' },
  ];

  it('un client avec DEUX devis a DEUX cartes, à des étapes différentes', () => {
    const cartes = buildAffaires(leads, devis).filter((a) => a.lead.id === 'l1');
    expect(cartes).toHaveLength(2);
    expect(cartes.map((c) => c.devis.id)).toEqual(['d2', 'd1']); // plus récent en tête
    expect(cartes.map((c) => c.stage).sort()).toEqual(['negociation', 'proposition']);
  });

  it('chaque carte porte le montant de SON devis', () => {
    const cartes = buildAffaires(leads, devis).filter((a) => a.lead.id === 'l1');
    expect(cartes.map((c) => c.value).sort((x, y) => x - y)).toEqual([250000, 900000]);
  });

  it('un troisième devis ajoute une troisième carte', () => {
    const cartes = buildAffaires(leads, [
      ...devis, { id: 'd3', leadId: 'l1', total: 400000, stage: 'visite', createdAt: '2026-08-03' },
    ]).filter((a) => a.lead.id === 'l1');
    expect(cartes).toHaveLength(3);
  });

  it('un client SANS devis garde sa carte de prospection', () => {
    const carte = buildAffaires(leads, devis).find((a) => a.lead.id === 'l2');
    expect(carte.kind).toBe('piste');
    expect(carte.devis).toBeNull();
    expect(carte.stage).toBe('nouveau');
  });

  it('la carte de prospection disparaît dès le premier devis', () => {
    const cartes = buildAffaires(leads, devis).filter((a) => a.lead.id === 'l1');
    expect(cartes.every((c) => c.kind === 'devis')).toBe(true);
  });

  it('les devis de l’espace Pro ne créent jamais de carte publique', () => {
    expect(buildAffaires(leads, devis).some((a) => a.devis?.id === 'dpro')).toBe(false);
  });

  it('les clés des cartes sont uniques (pas de collision React)', () => {
    const cles = buildAffaires(leads, devis).map((a) => a.key);
    expect(new Set(cles).size).toBe(cles.length);
  });
});

describe('devisDuClient', () => {
  it('ne retourne que les devis publics du client', () => {
    const tous = [
      { id: 'd1', leadId: 'l1', type: 'manual' },
      { id: 'd2', leadId: 'l2', type: 'manual' },
      { id: 'd3', leadId: 'l1', type: 'pro' },
    ];
    expect(devisDuClient('l1', tous).map((d) => d.id)).toEqual(['d1']);
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
