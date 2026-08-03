globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
import { describe, it, expect } from 'vitest';
import { createActions } from '../../context/dataActions';
import { buildAffaires } from '../affaires';

function store() {
  let state = { devisCounter: 0, leads: [], devis: [], partners: [], commissions: [], referrals: [] };
  const setState = (fn) => { state = typeof fn === 'function' ? fn(state) : fn; };
  return { a: createActions(setState), get: () => state };
}
const TECH = { id: 'tech1', name: 'Fatou Tech', role: 'technicien' };
const GERANT = { id: 'g1', name: 'Siddo Gerant', role: 'gerant' };

describe('EXIGENCE 1 — deux devis du même client = deux cartes indépendantes', () => {
  it('2 cartes distinctes, clés uniques, avançables séparément', () => {
    const s = store();
    s.a.ensurePartnerForUser(TECH);
    s.a.addLead({ name: 'Hôtel du Parc', contact: 'K', phone: '', address: '', estimatedValue: 0, assignedTo: TECH.id, parrainL1: null });
    const lead = s.get().leads[0];
    s.a.addDevis({ leadId: lead.id, type: 'manual', total: 500000, statut: 'finalise', createdBy: TECH.id, items: [] });
    s.a.addDevis({ leadId: lead.id, type: 'solar', total: 300000, statut: 'finalise', createdBy: TECH.id, items: [] });

    let cartes = buildAffaires(s.get().leads, s.get().devis);
    expect(cartes).toHaveLength(2);
    expect(new Set(cartes.map((c) => c.key)).size).toBe(2); // clés React uniques
    expect(cartes.map((c) => c.key).every((k) => k.startsWith('devis-'))).toBe(true);
    expect(cartes.map((c) => c.stage)).toEqual(['proposition', 'proposition']);

    const [a, b] = cartes;
    s.a.updateDevisStage(a.devis.id, 'negociation');
    cartes = buildAffaires(s.get().leads, s.get().devis);
    expect(cartes.find((c) => c.devis.id === a.devis.id).stage).toBe('negociation');
    expect(cartes.find((c) => c.devis.id === b.devis.id).stage).toBe('proposition');

    s.a.updateDevisStage(b.devis.id, 'visite');
    cartes = buildAffaires(s.get().leads, s.get().devis);
    expect(cartes.find((c) => c.devis.id === a.devis.id).stage).toBe('negociation');
    expect(cartes.find((c) => c.devis.id === b.devis.id).stage).toBe('visite');
    // l'étape du CLIENT n'a pas bougé
    expect(s.get().leads[0].stage).toBe('nouveau');
  });
});

describe('EXIGENCE 2 — le vendeur (technicien) applique l’étape lui-même', () => {
  it('technicien : étape appliquée immédiatement, aucun pendingStage', () => {
    const s = store();
    s.a.ensurePartnerForUser(TECH);
    s.a.addLead({ name: 'Pharmacie', contact: '', phone: '', address: '', estimatedValue: 0, assignedTo: TECH.id, parrainL1: null });
    const lead = s.get().leads[0];
    s.a.updateLeadStage(lead.id, 'negociation', TECH.id);
    const l = s.get().leads[0];
    expect(l.stage).toBe('negociation');
    expect(Object.keys(l)).not.toContain('pendingStage');
    // aucune clé de circuit de validation nulle part dans l'état
    expect(JSON.stringify(s.get())).not.toMatch(/pending/i);
  });

  it('technicien : devis avancé puis gagné sans aucune validation', () => {
    const s = store();
    s.a.ensurePartnerForUser(TECH);
    s.a.addLead({ name: 'Ecole', contact: '', phone: '', address: '', estimatedValue: 0, assignedTo: TECH.id, parrainL1: null });
    const lead = s.get().leads[0];
    s.a.addDevis({ leadId: lead.id, type: 'manual', total: 400000, statut: 'finalise', createdBy: TECH.id, items: [] });
    const d = s.get().devis[0];
    s.a.updateDevisStage(d.id, 'negociation');
    expect(s.get().devis[0].stage).toBe('negociation');
    expect(s.get().devis[0].pendingStage).toBeUndefined();
    s.a.updateDevisStage(d.id, 'gagne');
    expect(s.get().devis[0].stage).toBe('gagne');
  });

  it('trace d’activité : le libellé dit « par le gérant » même pour un technicien', () => {
    const s = store();
    s.a.addLead({ name: 'Boulangerie', contact: '', phone: '', address: '', estimatedValue: 0, assignedTo: TECH.id, parrainL1: null });
    s.a.updateLeadStage(s.get().leads[0].id, 'visite', TECH.id);
    const texte = s.get().leads[0].activities[0].text;
    console.log('LIBELLE ACTIVITE (technicien) =>', texte);
    expect(texte).toContain('par le gérant'); // ← libellé faux, régression signalée
  });
});

describe('EXIGENCE 3 — commission créée AUTOMATIQUEMENT sur affaire gagnée', () => {
  it('carte DEVIS gagnée → commission auto, montant = 3 % du devis', () => {
    const s = store();
    s.a.ensurePartnerForUser(TECH);
    s.a.addLead({ name: 'Hôtel', contact: '', phone: '', address: '', estimatedValue: 0, assignedTo: TECH.id, parrainL1: null });
    const lead = s.get().leads[0];
    s.a.addDevis({ leadId: lead.id, type: 'manual', total: 1000000, statut: 'finalise', createdBy: TECH.id, items: [] });
    s.a.updateDevisStage(s.get().devis[0].id, 'gagne');
    expect(s.get().commissions).toHaveLength(1);
    expect(s.get().commissions[0]).toMatchObject({ partnerId: 'p-user-tech1', level: 1, amount: 30000, status: 'en_attente' });
    expect(s.get().commissions[0].devisId).toBe(s.get().devis[0].id);
  });

  it('carte PISTE gagnée (aucun devis) → commission auto sur valeur estimée', () => {
    const s = store();
    s.a.ensurePartnerForUser(GERANT);
    s.a.addLead({ name: 'Mairie', contact: '', phone: '', address: '', estimatedValue: 3200000, assignedTo: GERANT.id, parrainL1: null });
    const lead = s.get().leads[0];
    expect(buildAffaires(s.get().leads, s.get().devis)[0].kind).toBe('piste');
    s.a.updateLeadStage(lead.id, 'gagne', GERANT.id);
    expect(s.get().commissions).toHaveLength(1);
    expect(s.get().commissions[0].amount).toBe(96000); // 3 %
  });

  it('deux devis gagnés du même client → deux commissions distinctes', () => {
    const s = store();
    s.a.ensurePartnerForUser(TECH);
    s.a.addLead({ name: 'Hôtel', contact: '', phone: '', address: '', estimatedValue: 0, assignedTo: TECH.id, parrainL1: null });
    const lead = s.get().leads[0];
    s.a.addDevis({ leadId: lead.id, type: 'manual', total: 500000, statut: 'finalise', createdBy: TECH.id, items: [] });
    s.a.addDevis({ leadId: lead.id, type: 'solar', total: 300000, statut: 'finalise', createdBy: TECH.id, items: [] });
    s.get().devis.forEach((d) => s.a.updateDevisStage(d.id, 'gagne'));
    expect(s.get().commissions).toHaveLength(2);
    expect(s.get().commissions.reduce((t, c) => t + c.amount, 0)).toBe(24000);
  });
});

describe('EXIGENCE 3bis — aucun double paiement client + devis', () => {
  const prep = () => {
    const s = store();
    s.a.ensurePartnerForUser(GERANT);
    s.a.addLead({ name: 'Hôtel', contact: '', phone: '', address: '', estimatedValue: 0, assignedTo: GERANT.id, parrainL1: null });
    const lead = s.get().leads[0];
    s.a.addDevis({ leadId: lead.id, type: 'manual', total: 1000000, statut: 'finalise', createdBy: GERANT.id, items: [] });
    return { s, lead, devis: s.get().devis[0] };
  };
  it('client gagné puis devis gagné = 1 seule commission de 30 000', () => {
    const { s, lead, devis } = prep();
    s.a.updateLeadStage(lead.id, 'gagne', GERANT.id);
    s.a.updateDevisStage(devis.id, 'gagne');
    expect(s.get().commissions).toHaveLength(1);
    expect(s.get().commissions[0].amount).toBe(30000);
  });
  it('devis gagné puis client gagné = 1 seule commission', () => {
    const { s, lead, devis } = prep();
    s.a.updateDevisStage(devis.id, 'gagne');
    s.a.updateLeadStage(lead.id, 'gagne', GERANT.id);
    expect(s.get().commissions).toHaveLength(1);
  });
});

describe('NAVIGATION — clé client:<id> depuis la fiche client', () => {
  // Réplique EXACTE de Pipeline.jsx:105-106
  const findAff = (toutes, key) => toutes.find((a) => a.key === key)
    || (key?.startsWith('client:') ? toutes.find((a) => a.lead.id === key.slice(7)) : null);

  it('résout la carte piste', () => {
    const s = store();
    s.a.addLead({ name: 'X', contact: '', phone: '', address: '', estimatedValue: 0, assignedTo: TECH.id, parrainL1: null });
    const lead = s.get().leads[0];
    const toutes = buildAffaires(s.get().leads, s.get().devis);
    const aff = findAff(toutes, `client:${lead.id}`);
    expect(aff).toBeTruthy();
    expect(aff.key).toBe(`piste-${lead.id}`);
  });

  it('résout la carte du devis le plus récent quand il y a 2 devis', () => {
    const s = store();
    s.a.ensurePartnerForUser(TECH);
    s.a.addLead({ name: 'X', contact: '', phone: '', address: '', estimatedValue: 0, assignedTo: TECH.id, parrainL1: null });
    const lead = s.get().leads[0];
    s.a.addDevis({ leadId: lead.id, type: 'manual', total: 100000, statut: 'finalise', createdBy: TECH.id, items: [] });
    s.a.addDevis({ leadId: lead.id, type: 'solar', total: 200000, statut: 'finalise', createdBy: TECH.id, items: [] });
    const toutes = buildAffaires(s.get().leads, s.get().devis);
    const aff = findAff(toutes, `client:${lead.id}`);
    expect(aff).toBeTruthy();
    expect(aff.key).toBe(toutes[0].key);
    console.log('client:<id> =>', aff.key, '| autres cartes:', toutes.map((c) => c.key).join(', '));
  });
});
