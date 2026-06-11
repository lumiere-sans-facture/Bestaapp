import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as seed from '../data/seed';

const DataContext = createContext(null);
const STORAGE_KEY = 'bestasolar_data';

export const COMMISSION_RATES = { 1: 0.03, 2: 0.015 };

const buildInitialState = () => ({
  version: seed.SEED_VERSION,
  leads: seed.leads,
  products: seed.products,
  partners: seed.partners,
  commissions: seed.commissions,
  devis: [],
});

const loadState = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.version === seed.SEED_VERSION) return saved;
  } catch {
    // données corrompues : on repart du seed
  }
  return buildInitialState();
};

export function DataProvider({ children }) {
  const [state, setState] = useState(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const actions = useMemo(() => ({
    addLead: (lead) =>
      setState((s) => ({
        ...s,
        leads: [
          {
            ...lead,
            id: `l${Date.now()}`,
            stage: 'nouveau',
            createdAt: new Date().toISOString().slice(0, 10),
            lastActivity: new Date().toISOString().slice(0, 10),
          },
          ...s.leads,
        ],
      })),

    // Passer une affaire à « gagné » génère automatiquement les commissions
    // de parrainage (3 % niveau 1, 1,5 % niveau 2) si elles n'existent pas déjà.
    updateLeadStage: (leadId, stage) =>
      setState((s) => {
        const today = new Date().toISOString().slice(0, 10);
        const lead = s.leads.find((l) => l.id === leadId);
        let commissions = s.commissions;
        if (stage === 'gagne' && lead) {
          const alreadyExists = (partnerId, level) =>
            s.commissions.some((c) => c.leadId === leadId && c.partnerId === partnerId && c.level === level);
          const generated = [];
          if (lead.parrainL1 && !alreadyExists(lead.parrainL1, 1)) {
            generated.push({
              id: `c${Date.now()}-1`, partnerId: lead.parrainL1, leadId, level: 1,
              amount: Math.round(lead.estimatedValue * COMMISSION_RATES[1]),
              status: 'en_attente', paidAt: null, createdAt: today,
            });
          }
          if (lead.parrainL2 && !alreadyExists(lead.parrainL2, 2)) {
            generated.push({
              id: `c${Date.now()}-2`, partnerId: lead.parrainL2, leadId, level: 2,
              amount: Math.round(lead.estimatedValue * COMMISSION_RATES[2]),
              status: 'en_attente', paidAt: null, createdAt: today,
            });
          }
          if (generated.length) commissions = [...generated, ...s.commissions];
        }
        return {
          ...s,
          commissions,
          leads: s.leads.map((l) =>
            l.id === leadId
              ? {
                  ...l,
                  stage,
                  lastActivity: today,
                  wonAt: stage === 'gagne' ? today : l.wonAt,
                  lostAt: stage === 'perdu' ? today : null,
                }
              : l
          ),
        };
      }),

    addCommission: (commission) =>
      setState((s) => ({
        ...s,
        commissions: [
          {
            ...commission,
            id: `c${Date.now()}`,
            status: 'en_attente',
            paidAt: null,
            createdAt: new Date().toISOString().slice(0, 10),
          },
          ...s.commissions,
        ],
      })),

    payCommission: (commissionId) =>
      setState((s) => ({
        ...s,
        commissions: s.commissions.map((c) =>
          c.id === commissionId
            ? { ...c, status: 'payée', paidAt: new Date().toISOString().slice(0, 10) }
            : c
        ),
      })),

    payAllCommissionsForPartner: (partnerId) =>
      setState((s) => ({
        ...s,
        commissions: s.commissions.map((c) =>
          c.partnerId === partnerId && c.status === 'en_attente'
            ? { ...c, status: 'payée', paidAt: new Date().toISOString().slice(0, 10) }
            : c
        ),
      })),

    addLeadNote: (leadId, text, userId) =>
      setState((s) => ({
        ...s,
        leads: s.leads.map((l) =>
          l.id === leadId
            ? {
                ...l,
                activities: [
                  { id: `a${Date.now()}`, date: new Date().toISOString(), text, by: userId },
                  ...(l.activities || []),
                ],
                lastActivity: new Date().toISOString().slice(0, 10),
              }
            : l
        ),
      })),

    // Le devis porte la référence du partenaire apporteur : c'est par lui
    // que le parrainage est tracé. Si la piste n'a pas encore de parrain,
    // le partenaire du devis devient son parrain niveau 1 (commission à la victoire).
    addDevis: (devis) =>
      setState((s) => {
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const devisNumber = `BS-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;
        return {
          ...s,
          devis: [
            { ...devis, id: `d${Date.now()}`, devisNumber, createdAt: now.toISOString() },
            ...s.devis,
          ],
          leads: s.leads.map((l) =>
            l.id === devis.leadId && devis.partnerId && !l.parrainL1
              ? { ...l, parrainL1: devis.partnerId }
              : l
          ),
        };
      }),

    resetData: () => setState(buildInitialState()),
  }), []);

  const helpers = useMemo(() => ({
    getPartnerById: (id) => state.partners.find((p) => p.id === id),
    getLeadById: (id) => state.leads.find((l) => l.id === id),
    getUserById: (id) => seed.users.find((u) => u.id === id),
    leadsForUser: (user) =>
      user.role === 'gerant' ? state.leads : state.leads.filter((l) => l.assignedTo === user.id),
  }), [state]);

  return (
    <DataContext.Provider value={{ ...state, ...actions, ...helpers, stages: seed.stages, lostStage: seed.LOST_STAGE, productCategories: seed.productCategories, monthlyData: seed.monthlyData, team: seed.users }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData doit être utilisé dans <DataProvider>');
  return ctx;
}
