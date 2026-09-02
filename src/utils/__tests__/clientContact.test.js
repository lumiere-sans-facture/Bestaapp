import { describe, expect, it } from 'vitest';
import { createLeadActions } from '../../context/actions/leads';
import { createProActions } from '../../context/actions/pro';
import { appendClientSource, buildClientSource, canSyncClientContact, isSameClient } from '../clientContact';

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

describe('identité et traçabilité des clients', () => {
  it('reconnaît le même téléphone malgré la mise en forme et accepte un e-mail seul', () => {
    expect(isSameClient({ phone: '+229 01 61 73 29 56' }, { phone: '0161732956' })).toBe(true);
    expect(isSameClient({ email: 'CLIENT@Exemple.com ' }, { email: 'client@exemple.com' })).toBe(true);
    expect(canSyncClientContact({ email: 'client@exemple.com' })).toBe(true);
    expect(canSyncClientContact({ name: 'Sans coordonnée' })).toBe(false);
  });

  it('conserve tous les apporteurs d’une même fiche sans dupliquer la même source', () => {
    const first = buildClientSource({ userId: 'u1', partner: { id: 'p1', name: 'Awa', code: 'AWA-ABC123' }, at: '2026-09-02T10:00:00.000Z' });
    const second = buildClientSource({ userId: 'u2', partner: { id: 'p2', name: 'Benoît', code: 'BENOIT-DEF456' }, at: '2026-09-02T11:00:00.000Z' });
    const history = appendClientSource(appendClientSource([first], second), { ...first, lastAddedAt: '2026-09-02T12:00:00.000Z' });
    expect(history).toHaveLength(2);
    expect(history[0].firstAddedAt).toBe('2026-09-02T10:00:00.000Z');
    expect(history[0].lastAddedAt).toBe('2026-09-02T12:00:00.000Z');
  });

  it('fusionne deux ajouts CRM du même client et garde les deux utilisateurs', () => {
    let state = {
      leads: [], referrals: [], commissions: [], devis: [],
      partners: [
        { id: 'p1', userId: 'u1', name: 'Awa', code: 'AWA-ABC123', status: 'actif' },
        { id: 'p2', userId: 'u2', name: 'Benoît', code: 'BENOIT-DEF456', status: 'actif' },
      ],
    };
    const actions = createLeadActions((change) => { state = change(state); });
    actions.addLead({ name: 'Kossi', phone: '+228 90 12 34 56', email: '', assignedTo: 'u1', parrainL1: null });
    actions.addLead({ name: 'Kossi Mensah', phone: '22890123456', email: 'kossi@example.com', assignedTo: 'u2', parrainL1: null });
    expect(state.leads).toHaveLength(1);
    expect(state.leads[0]).toMatchObject({ name: 'Kossi Mensah', email: 'kossi@example.com', google_contact_sync_status: 'pending' });
    expect(state.leads[0].registrationHistory.map((source) => source.userId)).toEqual(['u1', 'u2']);
  });

  it('fusionne aussi les clients Devis Pro par e-mail et relance la synchronisation', () => {
    let state = { proClients: [] };
    const actions = createProActions((change) => { state = change(state); });
    const first = actions.addProClient({ name: 'Entreprise K', email: 'contact@k.tg', userId: 'u1', registeredByUserId: 'u1', registeredByPartner: { id: 'p1', name: 'Awa', code: 'AWA-ABC123' } });
    const second = actions.addProClient({ name: 'Entreprise K SARL', email: 'CONTACT@K.TG', userId: 'u2', registeredByUserId: 'u2', registeredByPartner: { id: 'p2', name: 'Benoît', code: 'BENOIT-DEF456' } });
    expect(state.proClients).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(state.proClients[0].registrationHistory.map((source) => source.userId)).toEqual(['u1', 'u2']);
    expect(state.proClients[0].google_contact_sync_status).toBe('pending');
  });
});
