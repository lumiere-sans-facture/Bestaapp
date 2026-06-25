import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as seed from '../data/seed';
import { consumeRefClick } from '../utils/referral';
import { loadState, persist } from './dataState';
import { createActions, newReferral, COMMISSION_RATES } from './dataActions';
import { useRemoteSync } from './useRemoteSync';

// Taux de commission ré-exporté : conservé sur l'API publique du contexte
// (consommé par l'écran Plus pour estimer les commissions).
export { COMMISSION_RATES };

const DataContext = createContext(null);

// Composition root du domaine : assemble l'état (dataState), les actions
// (dataActions), la réplication (useRemoteSync) et les sélecteurs, puis les
// expose via useData(). Aucune logique métier ici — uniquement le câblage.
export function DataProvider({ children }) {
  const [state, setState] = useState(loadState);

  const stateRef = useRef(state);
  stateRef.current = state;

  // Comptabilise le clic d'affiliation capturé à l'ouverture de l'app (?ref=…)
  useEffect(() => {
    const code = consumeRefClick();
    if (!code) return;
    setState((s) =>
      s.partners.some((p) => p.code === code && p.status === 'actif')
        ? { ...s, referrals: [newReferral(code, 'clic'), ...(s.referrals || [])] }
        : s
    );
  }, []);

  // Persistance locale débattue : éviter de sérialiser tout l'état (coût
  // O(taille des données) sur le thread principal) à chaque micro-mutation.
  useEffect(() => {
    const id = setTimeout(() => persist(state), 400);
    return () => clearTimeout(id);
  }, [state]);

  // Flush immédiat de la dernière valeur avant fermeture ou passage en
  // arrière-plan (crucial sur mobile) — garantit zéro perte malgré le débat.
  useEffect(() => {
    const flush = () => persist(stateRef.current);
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, []);

  // Réplication Supabase (optionnelle, auto-détectée)
  const syncStatus = useRemoteSync(state, setState, stateRef);

  // Actions métier (stables : créées une fois sur setState)
  const actions = useMemo(() => createActions(setState), []);

  // Sélecteurs dérivés de l'état courant
  const helpers = useMemo(() => ({
    getPartnerById: (id) => state.partners.find((p) => p.id === id),
    getPartnerByUserId: (userId) => state.partners.find((p) => p.userId === userId),
    getSubscriptionForUser: (userId) => (state.subscriptions || []).find((x) => x.userId === userId),
    getCompanyForUser: (userId) => (state.companies || []).find((c) => c.userId === userId),
    getLeadById: (id) => state.leads.find((l) => l.id === id),
    getUserById: (id) => seed.users.find((u) => u.id === id),
    leadsForUser: (user) =>
      user.role === 'gerant' ? state.leads : state.leads.filter((l) => l.assignedTo === user.id),
  }), [state]);

  return (
    <DataContext.Provider value={{ ...state, ...actions, ...helpers, syncStatus, stages: seed.stages, lostStage: seed.LOST_STAGE, productCategories: seed.productCategories, monthlyData: seed.monthlyData, team: seed.users }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData doit être utilisé dans <DataProvider>');
  return ctx;
}
