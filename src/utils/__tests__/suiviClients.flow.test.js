globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
// Test d'intégration : exécute les VRAIES actions du store (createActions) pour
// verrouiller le comportement du suivi clients bout en bout.
import { describe, it, expect } from 'vitest';
import { createActions } from '../../context/dataActions';
import { buildAffaires } from '../affaires';

function store() {
  let state = { devisCounter: 0, leads: [], devis: [], partners: [], commissions: [], referrals: [] };
  const setState = (fn) => { state = typeof fn === 'function' ? fn(state) : fn; };
  return { a: createActions(setState), get: () => state };
}
const USER = { id: 'u1', name: 'Soumana', role: 'gerant' };

describe('flux réel du suivi clients', () => {
  it('deux devis d’un client = deux cartes, avancées séparément', () => {
    const s = store();
    s.a.ensurePartnerForUser(USER);
    s.a.addLead({ name: 'Hôtel du Parc', contact: 'M. Kossi', phone: '+229', address: 'Parakou', estimatedValue: 0, assignedTo: 'u1', parrainL1: null });
    const lead = s.get().leads[0];

    // Prospection : une carte piste, pilotée à la main
    s.a.updateLeadStage(lead.id, 'visite', 'u1');
    let cartes = buildAffaires(s.get().leads, s.get().devis);
    expect(cartes).toHaveLength(1);
    expect(cartes[0]).toMatchObject({ kind: 'piste', stage: 'visite' });

    // Premier devis : la carte piste devient une carte devis
    s.a.addDevis({ leadId: lead.id, type: 'manual', total: 500000, statut: 'finalise', createdBy: 'u1', items: [] });
    cartes = buildAffaires(s.get().leads, s.get().devis);
    expect(cartes).toHaveLength(1);
    expect(cartes[0].kind).toBe('devis');
    // Créer un devis ne fait sauter aucune étape au client
    expect(s.get().leads[0].stage).toBe('visite');

    // Deuxième devis du MÊME client : DEUX cartes
    s.a.addDevis({ leadId: lead.id, type: 'solar', total: 300000, statut: 'finalise', createdBy: 'u1', items: [] });
    cartes = buildAffaires(s.get().leads, s.get().devis);
    expect(cartes).toHaveLength(2);

    // Chacune avance indépendamment
    const [recent, ancien] = cartes;
    s.a.updateDevisStage(recent.devis.id, 'negociation');
    cartes = buildAffaires(s.get().leads, s.get().devis);
    expect(cartes.find((c) => c.devis.id === recent.devis.id).stage).toBe('negociation');
    expect(cartes.find((c) => c.devis.id === ancien.devis.id).stage).toBe('proposition');

    // Chacune se conclut séparément et rapporte SA commission
    s.a.updateDevisStage(recent.devis.id, 'gagne');
    expect(s.get().commissions).toHaveLength(1);
    s.a.updateDevisStage(ancien.devis.id, 'gagne');
    expect(s.get().commissions).toHaveLength(2);
    expect(s.get().commissions.reduce((t, c) => t + c.amount, 0)).toBe(24000);
  });
});

describe('le VENDEUR fait progresser lui-même (aucune validation gérant)', () => {
  it('un technicien applique l’étape directement, sans demande', () => {
    const s = store();
    s.a.ensurePartnerForUser({ id: 'u2', name: 'Fatou' });
    s.a.addLead({ name: 'Pharmacie', contact: '', phone: '', address: '', estimatedValue: 0, assignedTo: 'u2', parrainL1: null });
    const lead = s.get().leads[0];

    s.a.updateLeadStage(lead.id, 'negociation', 'u2');
    expect(s.get().leads[0].stage).toBe('negociation');
    expect(s.get().leads[0].pendingStage).toBeUndefined(); // plus de circuit de demande
  });

  it('un devis passé à « gagné » par le vendeur crée la commission immédiatement', () => {
    const s = store();
    s.a.ensurePartnerForUser({ id: 'u2', name: 'Fatou' });
    s.a.addLead({ name: 'Hôtel', contact: '', phone: '', address: '', estimatedValue: 0, assignedTo: 'u2', parrainL1: null });
    const lead = s.get().leads[0];
    s.a.addDevis({ leadId: lead.id, type: 'manual', total: 400000, statut: 'finalise', createdBy: 'u2', items: [] });
    const d = s.get().devis[0];

    s.a.updateDevisStage(d.id, 'gagne');
    expect(s.get().devis[0].stage).toBe('gagne');
    expect(s.get().commissions).toHaveLength(1);
    expect(s.get().commissions[0].amount).toBe(12000);
  });

  it('le passage direct reste tracé dans l’activité du client', () => {
    const s = store();
    s.a.addLead({ name: 'Boulangerie', contact: '', phone: '', address: '', estimatedValue: 0, assignedTo: 'u2', parrainL1: null });
    const lead = s.get().leads[0];
    s.a.updateLeadStage(lead.id, 'visite', 'u1');
    expect(s.get().leads[0].activities[0].text).toMatch(/Étape passée de « Nouveau » à « Visite »/);
  });
});

describe('création AUTOMATIQUE de la commission (aucun réglage préalable)', () => {
  // Reproduit le mode SaaS : état vide, aucun partenaire pré-créé. Seule
  // l'app peut créer le profil partenaire de l'utilisateur.
  const OWNER = { id: 'u9', name: 'Siddo Bou', role: 'gerant' };

  it('gagner un CLIENT crée la commission, même sans être passé par l’espace partenaire', () => {
    const s = store();
    s.a.ensurePartnerForUser(OWNER); // ce que fait DataContext au démarrage
    s.a.addLead({ name: 'beta', contact: 'abou', phone: '', address: '', estimatedValue: 0, assignedTo: OWNER.id, parrainL1: null });
    const lead = s.get().leads[0];
    s.a.addDevis({ leadId: lead.id, type: 'manual', total: 1724000, statut: 'finalise', createdBy: OWNER.id, items: [] });

    s.a.updateLeadStage(lead.id, 'gagne', OWNER.id);
    expect(s.get().commissions).toHaveLength(1);
    expect(s.get().commissions[0]).toMatchObject({ partnerId: 'p-user-u9', level: 1, amount: 51720 });
  });

  it('sans AUCUN profil partenaire, aucune commission : le profil est indispensable', () => {
    const s = store();
    s.a.addLead({ name: 'beta', contact: '', phone: '', address: '', estimatedValue: 500000, assignedTo: OWNER.id, parrainL1: null });
    s.a.updateLeadStage(s.get().leads[0].id, 'gagne', OWNER.id);
    expect(s.get().commissions).toHaveLength(0); // ← d'où l'appel au démarrage
  });

  it('gagner un CLIENT sans devis mais avec valeur estimée crée la commission', () => {
    const s = store();
    s.a.ensurePartnerForUser(OWNER);
    s.a.addLead({ name: 'Ecole', contact: '', phone: '', address: '', estimatedValue: 3200000, assignedTo: OWNER.id, parrainL1: null });
    s.a.updateLeadStage(s.get().leads[0].id, 'gagne', OWNER.id);
    expect(s.get().commissions).toHaveLength(1);
    expect(s.get().commissions[0].amount).toBe(96000);
  });
});

describe('jamais de commission payée en double', () => {
  const OWNER = { id: 'u9', name: 'Siddo', role: 'gerant' };
  const prepare = () => {
    const s = store();
    s.a.ensurePartnerForUser(OWNER);
    s.a.addLead({ name: 'Hôtel', contact: '', phone: '', address: '', estimatedValue: 0, assignedTo: OWNER.id, parrainL1: null });
    const lead = s.get().leads[0];
    s.a.addDevis({ leadId: lead.id, type: 'manual', total: 1000000, statut: 'finalise', createdBy: OWNER.id, items: [] });
    return { s, lead, devis: s.get().devis[0] };
  };

  it('client gagné PUIS devis gagné = une seule commission de 30 000', () => {
    const { s, lead, devis } = prepare();
    s.a.updateLeadStage(lead.id, 'gagne', OWNER.id);
    s.a.updateDevisStage(devis.id, 'gagne');
    expect(s.get().commissions).toHaveLength(1);
    expect(s.get().commissions[0].amount).toBe(30000);
  });

  it('devis gagné PUIS client gagné = une seule commission', () => {
    const { s, lead, devis } = prepare();
    s.a.updateDevisStage(devis.id, 'gagne');
    s.a.updateLeadStage(lead.id, 'gagne', OWNER.id);
    expect(s.get().commissions).toHaveLength(1);
  });

  it('client gagné puis DEUX devis gagnés = 15 000 + 9 000, pas plus', () => {
    const s = store();
    s.a.ensurePartnerForUser(OWNER);
    s.a.addLead({ name: 'Hôtel', contact: '', phone: '', address: '', estimatedValue: 0, assignedTo: OWNER.id, parrainL1: null });
    const lead = s.get().leads[0];
    s.a.addDevis({ leadId: lead.id, type: 'manual', total: 500000, statut: 'finalise', createdBy: OWNER.id, items: [] });
    s.a.addDevis({ leadId: lead.id, type: 'solar', total: 300000, statut: 'finalise', createdBy: OWNER.id, items: [] });
    s.a.updateLeadStage(lead.id, 'gagne', OWNER.id);
    const ids = s.get().devis.map((d) => d.id);
    ids.forEach((id) => s.a.updateDevisStage(id, 'gagne'));
    const total = s.get().commissions.reduce((t, c) => t + c.amount, 0);
    expect(total).toBe(24000);
    expect(s.get().commissions).toHaveLength(2);
  });

  it('une commission DÉJÀ PAYÉE n’est jamais supprimée : elle est rattachée au devis', () => {
    const { s, lead, devis } = prepare();
    s.a.updateLeadStage(lead.id, 'gagne', OWNER.id);
    const com = s.get().commissions[0];
    s.a.payCommission(com.id, { mode: 'momo', reference: 'MM-1' });
    s.a.updateDevisStage(devis.id, 'gagne');
    const restantes = s.get().commissions;
    expect(restantes).toHaveLength(1);
    expect(restantes[0].id).toBe(com.id);        // le versement est conservé
    expect(restantes[0].status).toBe('payée');
    expect(restantes[0].devisId).toBe(devis.id); // et rattaché au devis
  });

  it('« Synchroniser » répare un doublon déjà enregistré et n’en crée jamais', () => {
    const { s, lead, devis } = prepare();
    s.a.updateLeadStage(lead.id, 'gagne', OWNER.id);
    s.a.updateDevisStage(devis.id, 'gagne');
    s.a.syncCommissions();
    expect(s.get().commissions).toHaveLength(1);
    s.a.syncCommissions(); // idempotent
    expect(s.get().commissions).toHaveLength(1);
  });
});

describe('cohérence client ↔ devis (régressions vérifiées)', () => {
  const USR = { id: 'u5', name: 'Vendeur', role: 'technicien' };

  it('l’étape du CLIENT suit ses devis (plus de badge « Nouveau » sur un client gagné)', () => {
    const s = store();
    s.a.ensurePartnerForUser(USR);
    s.a.addLead({ name: 'Hôtel', contact: '', phone: '', address: '', estimatedValue: 0, assignedTo: USR.id, parrainL1: null });
    const lead = s.get().leads[0];
    s.a.addDevis({ leadId: lead.id, type: 'manual', total: 500000, statut: 'finalise', createdBy: USR.id, items: [] });
    const d = s.get().devis[0];

    expect(s.get().leads[0].stage).toBe('nouveau'); // création : rien ne bouge
    s.a.updateDevisStage(d.id, 'negociation');
    expect(s.get().leads[0].stage).toBe('negociation');
    s.a.updateDevisStage(d.id, 'gagne');
    expect(s.get().leads[0].stage).toBe('gagne');
    expect(s.get().leads[0].wonAt).toBeTruthy();
  });

  it('l’étape du client est la plus avancée de ses devis, « perdu » seulement si tous le sont', () => {
    const s = store();
    s.a.ensurePartnerForUser(USR);
    s.a.addLead({ name: 'Ecole', contact: '', phone: '', address: '', estimatedValue: 0, assignedTo: USR.id, parrainL1: null });
    const lead = s.get().leads[0];
    s.a.addDevis({ leadId: lead.id, type: 'manual', total: 100000, statut: 'finalise', createdBy: USR.id, items: [] });
    s.a.addDevis({ leadId: lead.id, type: 'solar', total: 200000, statut: 'finalise', createdBy: USR.id, items: [] });
    const [d2, d1] = s.get().devis;

    s.a.updateDevisStage(d1.id, 'perdu');
    expect(s.get().leads[0].stage).toBe('proposition'); // d2 est encore ouvert
    s.a.updateDevisStage(d2.id, 'perdu');
    expect(s.get().leads[0].stage).toBe('perdu');
  });

  it('chaque devis gagné porte SA commission, identifiable par devisId', () => {
    const s = store();
    s.a.ensurePartnerForUser(USR);
    s.a.addLead({ name: 'Hôtel', contact: '', phone: '', address: '', estimatedValue: 0, assignedTo: USR.id, parrainL1: null });
    const lead = s.get().leads[0];
    s.a.addDevis({ leadId: lead.id, type: 'manual', total: 500000, statut: 'finalise', createdBy: USR.id, items: [] });
    s.a.addDevis({ leadId: lead.id, type: 'solar', total: 300000, statut: 'finalise', createdBy: USR.id, items: [] });
    const [dB, dA] = s.get().devis;
    s.a.updateDevisStage(dA.id, 'gagne');
    s.a.updateDevisStage(dB.id, 'gagne');

    // Chaque commission est rattachée à SON devis : l'affichage par affaire
    // ne peut plus montrer le montant de l'autre devis.
    const parDevis = Object.fromEntries(s.get().commissions.map((c) => [c.devisId, c.amount]));
    expect(parDevis[dA.id]).toBe(15000); // 3 % de 500 000
    expect(parDevis[dB.id]).toBe(9000);  // 3 % de 300 000
  });
});
