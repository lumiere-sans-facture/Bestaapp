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
