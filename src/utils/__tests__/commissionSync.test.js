import { describe, it, expect } from 'vitest';
import {
  commissionBasis,
  resolveLeadPartners,
  missingCommissionsForLead,
  reconcileMissingCommissions,
} from '../commissionSync';

const RATES = { 1: 0.03, 2: 0.015 };
const TODAY = '2026-07-25';

const partners = [
  { id: 'p1', name: 'Mamadou', sponsorId: null },
  { id: 'p2', name: 'Aminata', sponsorId: 'p1' },
];

describe('commissionBasis', () => {
  const lead = { id: 'l1', estimatedValue: 1000000 };

  it('prend le total du dernier devis finalisé', () => {
    const devis = [
      { leadId: 'l1', statut: 'finalise', total: 800000, createdAt: '2026-06-01' },
      { leadId: 'l1', statut: 'finalise', total: 950000, createdAt: '2026-07-01' },
    ];
    expect(commissionBasis(lead, devis)).toBe(950000);
  });

  it('ignore les brouillons et les devis des autres pistes', () => {
    const devis = [
      { leadId: 'l1', statut: 'brouillon', total: 500000, createdAt: '2026-07-10' },
      { leadId: 'l9', statut: 'finalise', total: 700000, createdAt: '2026-07-10' },
    ];
    expect(commissionBasis(lead, devis)).toBe(1000000);
  });

  it('retombe sur la valeur estimée puis sur 0', () => {
    expect(commissionBasis(lead, [])).toBe(1000000);
    expect(commissionBasis({ id: 'l2' }, [])).toBe(0);
    expect(commissionBasis(null, [])).toBe(0);
  });
});

describe('resolveLeadPartners', () => {
  it('prend les parrains de la piste en priorité', () => {
    expect(resolveLeadPartners({ id: 'l1', parrainL1: 'p2', parrainL2: 'p1' }, [], partners))
      .toEqual({ l1: 'p2', l2: 'p1' });
  });

  it('retombe sur le partenaire du dernier devis (et son parrain en N2)', () => {
    const devis = [
      { leadId: 'l1', partnerId: 'p2', createdAt: '2026-07-01' },
      { leadId: 'l1', partnerId: 'p1', createdAt: '2026-06-01' },
    ];
    expect(resolveLeadPartners({ id: 'l1' }, devis, partners)).toEqual({ l1: 'p2', l2: 'p1' });
  });

  it('ne cumule jamais deux niveaux pour le même partenaire', () => {
    expect(resolveLeadPartners({ id: 'l1', parrainL1: 'p1', parrainL2: 'p1' }, [], partners))
      .toEqual({ l1: 'p1', l2: null });
  });
});

describe('missingCommissionsForLead', () => {
  const lead = { id: 'l1', parrainL1: 'p2', parrainL2: 'p1', estimatedValue: 1000000 };

  it('génère N1 et N2 sur la base du devis finalisé', () => {
    const devis = [{ leadId: 'l1', statut: 'finalise', total: 900000, createdAt: '2026-07-01' }];
    const out = missingCommissionsForLead({ lead, devis, partners, commissions: [] }, RATES, TODAY);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ partnerId: 'p2', leadId: 'l1', level: 1, amount: 27000, status: 'en_attente', createdAt: TODAY });
    expect(out[1]).toMatchObject({ partnerId: 'p1', leadId: 'l1', level: 2, amount: 13500 });
  });

  it('ne recrée pas une commission déjà enregistrée (idempotence)', () => {
    const commissions = [{ leadId: 'l1', partnerId: 'p2', level: 1, amount: 30000 }];
    const out = missingCommissionsForLead({ lead, devis: [], partners, commissions }, RATES, TODAY);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ partnerId: 'p1', level: 2 });
  });

  it('ne génère rien sans base de calcul ni sans apporteur', () => {
    expect(missingCommissionsForLead({ lead: { id: 'l2', parrainL1: 'p1' }, devis: [], partners, commissions: [] }, RATES, TODAY)).toHaveLength(0);
    expect(missingCommissionsForLead({ lead: { id: 'l3', estimatedValue: 500000 }, devis: [], partners, commissions: [] }, RATES, TODAY)).toHaveLength(0);
  });
});

describe('reconcileMissingCommissions', () => {
  const leads = [
    { id: 'l1', stage: 'gagne', parrainL1: 'p1', parrainL2: null, estimatedValue: 980000 },
    { id: 'l2', stage: 'proposition', parrainL1: 'p2', parrainL2: 'p1', estimatedValue: 1850000 },
    { id: 'l3', stage: 'nouveau', parrainL1: 'p1', parrainL2: null, estimatedValue: 400000 },
  ];
  const devis = [{ leadId: 'l2', statut: 'finalise', total: 1700000, createdAt: '2026-07-10' }];
  const referrals = [
    { id: 'r1', type: 'devis', status: 'validé', leadId: 'l2' },
    { id: 'r2', type: 'devis', status: 'en_attente', leadId: 'l3' },
    { id: 'r3', type: 'clic', status: 'validé', leadId: null },
  ];

  it('couvre les pistes gagnées ET les conversions devis validées', () => {
    const out = reconcileMissingCommissions({ leads, devis, partners, commissions: [], referrals }, RATES, TODAY);
    // l1 gagnée → 1 commission (pas de N2) ; l2 conversion validée → 2 (base devis 1 700 000)
    expect(out).toHaveLength(3);
    expect(out.find((c) => c.leadId === 'l1')).toMatchObject({ partnerId: 'p1', level: 1, amount: 29400 });
    expect(out.find((c) => c.leadId === 'l2' && c.level === 1)).toMatchObject({ partnerId: 'p2', amount: 51000 });
    expect(out.find((c) => c.leadId === 'l2' && c.level === 2)).toMatchObject({ partnerId: 'p1', amount: 25500 });
    expect(out.some((c) => c.leadId === 'l3')).toBe(false); // conversion non validée
  });

  it('est idempotent : un second passage ne retourne rien', () => {
    const first = reconcileMissingCommissions({ leads, devis, partners, commissions: [], referrals }, RATES, TODAY);
    const second = reconcileMissingCommissions({ leads, devis, partners, commissions: first, referrals }, RATES, TODAY);
    expect(second).toHaveLength(0);
  });

  it('ne double pas quand la piste est à la fois gagnée et validée au registre', () => {
    const both = [{ id: 'l9', stage: 'gagne', parrainL1: 'p1', estimatedValue: 600000 }];
    const refs = [{ id: 'r9', type: 'devis', status: 'validé', leadId: 'l9' }];
    const out = reconcileMissingCommissions({ leads: both, devis: [], partners, commissions: [], referrals: refs }, RATES, TODAY);
    expect(out).toHaveLength(1);
  });
});
