globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
// Test d'intégration : exécute les VRAIES actions du store (createActions) pour
// verrouiller le comportement du suivi clients bout en bout.
import { describe, it, expect } from 'vitest';
import { createActions } from '../../context/dataActions';
import { buildAffaires, devisStage } from '../affaires';

function store() {
  let state = { devisCounter: 0, leads: [], devis: [], partners: [], commissions: [], referrals: [] };
  const setState = (fn) => { state = typeof fn === 'function' ? fn(state) : fn; };
  return { a: createActions(setState), get: () => state };
}
const USER = { id: 'u1', name: 'Soumana', role: 'gerant' };

describe('flux réel du suivi clients', () => {
  it('kanban par client + issues par devis + commissions', () => {
    const s = store();
    s.a.ensurePartnerForUser(USER);
    s.a.addLead({ name: 'Hôtel du Parc', contact: 'M. Kossi', phone: '+229', address: 'Parakou', estimatedValue: 0, assignedTo: 'u1', parrainL1: null });
    const lead = s.get().leads[0];

    // Les étapes amont restent pilotées à la main
    s.a.updateLeadStage(lead.id, 'visite');
    expect(s.get().leads[0].stage).toBe('visite');

    // Créer un devis NE déplace PAS le client (régression corrigée)
    s.a.addDevis({ leadId: lead.id, type: 'manual', total: 500000, statut: 'finalise', createdBy: 'u1', items: [] });
    expect(s.get().leads[0].stage).toBe('visite');
    let cartes = buildAffaires(s.get().leads, s.get().devis);
    expect(cartes).toHaveLength(1);
    expect(cartes[0].stage).toBe('visite');
    expect(cartes[0].devis).toHaveLength(1);

    // Deux devis pour le même client : toujours UNE carte, DEUX devis suivis
    s.a.addDevis({ leadId: lead.id, type: 'solar', total: 300000, statut: 'finalise', createdBy: 'u1', items: [] });
    cartes = buildAffaires(s.get().leads, s.get().devis);
    expect(cartes).toHaveLength(1);
    expect(cartes[0].devis).toHaveLength(2);
    expect(cartes[0].value).toBe(800000); // cumul des devis en cours

    // Chaque devis se conclut séparément → une commission chacun
    const [d2, d1] = s.get().devis; // le plus récent d'abord
    s.a.updateDevisStage(d1.id, 'gagne');
    expect(s.get().commissions).toHaveLength(1);
    expect(s.get().leads[0].stage).toBe('visite'); // le client ne bouge pas tout seul
    s.a.updateDevisStage(d2.id, 'gagne');
    expect(s.get().commissions).toHaveLength(2);
    expect(s.get().commissions.map((c) => c.amount).sort((x, y) => x - y)).toEqual([9000, 15000]);

    // Le gérant conclut le client : pas de commission en double
    s.a.updateLeadStage(lead.id, 'gagne');
    expect(s.get().commissions).toHaveLength(2);
    expect(s.get().leads[0].stage).toBe('gagne');

    // Un devis perdu sort de la valeur du client
    s.a.updateDevisStage(d2.id, 'perdu');
    cartes = buildAffaires(s.get().leads, s.get().devis);
    expect(cartes[0].value).toBe(500000);
    expect(devisStage(s.get().devis.find((x) => x.id === d2.id), lead)).toBe('perdu');
  });
});

describe('validation gérant et visibilité pour le commercial', () => {
  it('le technicien demande, le gérant valide, la trace reste sur la fiche', () => {
    const s = store();
    s.a.addLead({ name: 'Pharmacie', contact: 'Mme A', phone: '', address: '', estimatedValue: 0, assignedTo: 'u2', parrainL1: null });
    const lead = s.get().leads[0];

    // Le technicien demande : la piste NE bouge PAS
    s.a.requestStageChange(lead.id, 'negociation', 'u2');
    expect(s.get().leads[0].stage).toBe('nouveau');
    expect(s.get().leads[0].pendingStage.stage).toBe('negociation');
    // ...et la demande est visible dans l'activité du client
    expect(s.get().leads[0].activities[0].text).toMatch(/Demande de passage/);

    // Le gérant valide : la piste avance et la validation est tracée
    s.a.approveStageChange(lead.id, 'u1');
    expect(s.get().leads[0].stage).toBe('negociation');
    expect(s.get().leads[0].pendingStage).toBeNull();
    expect(s.get().leads[0].activities[0].text).toMatch(/validé par le gérant/);
  });

  it('le gérant fait progresser SANS demande : le commercial en voit la trace', () => {
    const s = store();
    s.a.addLead({ name: 'Boulangerie', contact: 'M. B', phone: '', address: '', estimatedValue: 0, assignedTo: 'u2', parrainL1: null });
    const lead = s.get().leads[0];

    s.a.updateLeadStage(lead.id, 'visite', 'u1');
    expect(s.get().leads[0].stage).toBe('visite');
    expect(s.get().leads[0].activities[0].text).toMatch(/Étape passée de « Nouveau » à « Visite » par le gérant/);
  });

  it('le gérant refuse : la piste reste en place, le refus est tracé', () => {
    const s = store();
    s.a.addLead({ name: 'Station', contact: 'M. C', phone: '', address: '', estimatedValue: 0, assignedTo: 'u2', parrainL1: null });
    const lead = s.get().leads[0];
    s.a.requestStageChange(lead.id, 'gagne', 'u2');
    s.a.rejectStageChange(lead.id, 'u1');
    expect(s.get().leads[0].stage).toBe('nouveau');
    expect(s.get().leads[0].pendingStage).toBeNull();
    expect(s.get().leads[0].activities[0].text).toMatch(/refusée par le gérant/);
  });

  it('demande sur un DEVIS : validée par le gérant, elle crée la commission', () => {
    const s = store();
    s.a.ensurePartnerForUser({ id: 'u2', name: 'Fatou' });
    s.a.addLead({ name: 'Hôtel', contact: 'M. D', phone: '', address: '', estimatedValue: 0, assignedTo: 'u2', parrainL1: null });
    const lead = s.get().leads[0];
    s.a.addDevis({ leadId: lead.id, type: 'manual', total: 400000, statut: 'finalise', createdBy: 'u2', items: [] });
    const d = s.get().devis[0];

    s.a.requestDevisStageChange(d.id, 'gagne', 'u2');
    expect(s.get().devis[0].pendingStage.stage).toBe('gagne');
    expect(s.get().commissions).toHaveLength(0); // rien avant validation

    s.a.approveDevisStageChange(d.id, 'u1');
    expect(s.get().devis[0].stage).toBe('gagne');
    expect(s.get().commissions).toHaveLength(1);
    expect(s.get().commissions[0].amount).toBe(12000);
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
