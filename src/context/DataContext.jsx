import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as seed from '../data/seed';

const DataContext = createContext(null);
const STORAGE_KEY = 'bestasolar_data';

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

    updateLeadStage: (leadId, stage) =>
      setState((s) => ({
        ...s,
        leads: s.leads.map((l) =>
          l.id === leadId
            ? {
                ...l,
                stage,
                lastActivity: new Date().toISOString().slice(0, 10),
                wonAt: stage === 'gagne' ? new Date().toISOString().slice(0, 10) : l.wonAt,
              }
            : l
        ),
      })),

    addDevis: (devis) =>
      setState((s) => ({
        ...s,
        devis: [
          { ...devis, id: `d${Date.now()}`, createdAt: new Date().toISOString() },
          ...s.devis,
        ],
      })),

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
    <DataContext.Provider value={{ ...state, ...actions, ...helpers, stages: seed.stages, productCategories: seed.productCategories, monthlyData: seed.monthlyData, team: seed.users }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData doit être utilisé dans <DataProvider>');
  return ctx;
}
