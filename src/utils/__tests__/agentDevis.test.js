import { describe, it, expect } from 'vitest';
import { executerOutil, calculerProposition, consommationDe, ensoleillementDe, devisDepuisProposition } from '../agentDevis';
import { OUTILS_AGENT, SYSTEME_AGENT, MODELE_AGENT, validerConversation, LIMITES_AGENT } from '../agentDevisDefinitions';
import { calculateSystemSize, suggestKitsForBattery, buildKitQuotation } from '../solarSizing';
import { SOLAR_KITS } from '../../data/kits';
import { INVERTER_MODELS } from '../../data/inverters';
import { appliances } from '../../data/appliances';
import { ENSOLEILLEMENT } from '../../data/ensoleillement';

const ctx = { kits: SOLAR_KITS, inverters: INVERTER_MODELS, products: [], appareils: appliances, ensoleillement: ENSOLEILLEMENT };
const DEMANDE = {
  appareils: [
    { nom: 'Réfrigérateur', puissance_w: 250, quantite: 1, heures_jour: 12, heures_nuit: 12 },
    { nom: 'Ampoule LED', puissance_w: 10, quantite: 6, heures_jour: 0, heures_nuit: 6 },
    { nom: 'Télévision', puissance_w: 100, quantite: 1, heures_jour: 3, heures_nuit: 4 },
  ],
  conso_jour_kwh: 0, conso_nuit_kwh: 0, ville: 'lome', telephone: '', type_systeme: 'off-grid', support: 'tole',
};

describe('définitions envoyées à Claude', () => {
  it('modèle, consignes et trois outils au schéma strict', () => {
    expect(MODELE_AGENT).toBe('claude-opus-5-5');
    expect(SYSTEME_AGENT).toMatch(/N'invente JAMAIS un prix/);
    expect(OUTILS_AGENT.map((o) => o.name)).toEqual(['chercher_appareils', 'calculer_proposition', 'preparer_devis']);
    for (const o of OUTILS_AGENT) {
      expect(o.strict).toBe(true);
      expect(o.input_schema.additionalProperties).toBe(false);
      expect(o.input_schema.required.sort()).toEqual(Object.keys(o.input_schema.properties).sort());
    }
  });

  it('conversation validée avant tout appel payant', () => {
    expect(validerConversation([{ role: 'user', content: 'Bonjour' }])).toBeNull();
    expect(validerConversation([])).toMatch(/vide/);
    expect(validerConversation([{ role: 'assistant', content: 'x' }])).toMatch(/premier message/);
    expect(validerConversation([{ role: 'user', content: 'x' }, { role: 'system', content: 'x' }])).toMatch(/rôle/);
    expect(validerConversation(Array.from({ length: LIMITES_AGENT.messagesMax + 1 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x' })))).toMatch(/longue/);
    expect(validerConversation([{ role: 'user', content: 'x'.repeat(LIMITES_AGENT.octetsMax) }])).toMatch(/volumineuse/);
  });
});

describe('outils exécutés dans l’app', () => {
  it('chercher_appareils : puissance habituelle du catalogue, synonymes compris', () => {
    const r = JSON.parse(executerOutil('chercher_appareils', { requete: 'frigo' }, ctx).contenu);
    expect(r.appareils.some((a) => /Réfrigérateur/.test(a.nom) && a.puissance_w === 250)).toBe(true);
    const rien = JSON.parse(executerOutil('chercher_appareils', { requete: 'zzz' }, ctx).contenu);
    expect(rien.note).toMatch(/demander la puissance/);
  });

  it('calculer_proposition : les MÊMES chiffres que l’assistant de devis', () => {
    const r = calculerProposition(DEMANDE, ctx);
    const { consumption, peakLoad } = consommationDe(DEMANDE.appareils);
    const sizing = calculateSystemSize(consumption, 'off-grid', 4.3, undefined, 1, { peakLoad, inverters: INVERTER_MODELS });
    // Lomé : chantier togolais, main-d'œuvre × 2 — comme dans l'assistant.
    const attendus = suggestKitsForBattery(SOLAR_KITS, sizing.batteryCapacity)
      .map((k) => ({ kit_id: k.id, total_fcfa: Math.round(buildKitQuotation(k, 'tole', true, sizing, INVERTER_MODELS, [], 2).total) }));
    expect(r.options.map(({ kit_id, total_fcfa }) => ({ kit_id, total_fcfa }))).toEqual(attendus);
    expect(r.besoin).toMatchObject({ conso_jour_kwh: 3.3, pic_w: 410, ensoleillement_source: 'Lomé', chantier_au_togo: true });
  });

  it('chantier au Togo : main-d’œuvre doublée, comme dans l’assistant', () => {
    const togo = calculerProposition(DEMANDE, ctx).options[0];
    const benin = calculerProposition({ ...DEMANDE, ville: 'Cotonou', telephone: '+229 01 97 00 00 00' }, ctx).options[0];
    expect(togo.total_fcfa).toBeGreaterThan(benin.total_fcfa);
    expect(ensoleillementDe('Cotonou', ENSOLEILLEMENT)).toEqual({ psh: 4.3, source: null });
  });

  it('consommation nulle : refusée, pas de devis à 0', () => {
    const r = executerOutil('calculer_proposition', { ...DEMANDE, appareils: [] }, ctx);
    expect(r.erreur).toBe(true);
    expect(JSON.parse(r.contenu).erreur).toMatch(/Consommation nulle/);
  });

  it('preparer_devis : devis complet, identique au chiffrage, en attente de relecture', () => {
    const calcul = executerOutil('calculer_proposition', DEMANDE, ctx);
    const kitId = JSON.parse(calcul.contenu).options[0].kit_id;
    const r = executerOutil('preparer_devis', { kit_id: kitId, client_nom: 'Afi Mensah', client_telephone: '+228 90 11 22 33', client_ville: 'Lomé' },
      { ...ctx, derniereDemande: calcul.demande });
    expect(JSON.parse(r.contenu)).toMatchObject({ ok: true, statut: expect.stringMatching(/relecture/) });
    expect(r.proposition.client).toEqual({ nom: 'Afi Mensah', telephone: '+228 90 11 22 33', ville: 'Lomé' });
    expect(r.proposition.devis).toMatchObject({ type: 'solar', kit: { id: kitId } });
    expect(r.proposition.devis.total).toBe(JSON.parse(calcul.contenu).options[0].total_fcfa);
    expect(r.proposition.devis.quotation.components.length).toBeGreaterThan(0);
  });

  it('preparer_devis : refusé sans calcul, sans téléphone complet ou pour un kit inconnu', () => {
    const calcul = executerOutil('calculer_proposition', DEMANDE, ctx);
    const base = { kit_id: 'kit-5kwh', client_nom: 'Afi', client_telephone: '+228 90 11 22 33', client_ville: 'Lomé' };
    expect(executerOutil('preparer_devis', base, ctx).erreur).toBe(true);
    expect(executerOutil('preparer_devis', { ...base, client_telephone: '90' }, { ...ctx, derniereDemande: calcul.demande }).erreur).toBe(true);
    expect(executerOutil('preparer_devis', { ...base, kit_id: 'inconnu' }, { ...ctx, derniereDemande: calcul.demande }).erreur).toBe(true);
    expect(devisDepuisProposition(calcul.demande, 'inconnu', ctx)).toBeNull();
  });

  it('outil inconnu : erreur renvoyée à l’agent', () => {
    expect(executerOutil('supprimer_tout', {}, ctx)).toMatchObject({ erreur: true });
  });
});
