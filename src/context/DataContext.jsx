import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as seed from '../data/seed';
import { consumeRefClick } from '../utils/referral';
import { useAuth } from './AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { fetchTeamProfiles } from '../lib/remoteSync';
import { loadState, persist, STORAGE_KEY } from './dataState';
import { createActions, newReferral, COMMISSION_RATES } from './dataActions';
import { useRemoteSync } from './useRemoteSync';

// Équipe du mode local : les utilisateurs du seed, SANS leurs mots de passe
// (le contexte est lisible depuis tous les écrans).
const LOCAL_TEAM = seed.users.map(({ password: _pw, ...u }) => u);

// Taux de commission ré-exporté : conservé sur l'API publique du contexte
// (consommé par l'écran Plus pour estimer les commissions).
export { COMMISSION_RATES };

const DataContext = createContext(null);

// Composition root du domaine : assemble l'état (dataState), les actions
// (dataActions), la réplication (useRemoteSync) et les sélecteurs, puis les
// expose via useData(). Aucune logique métier ici — uniquement le câblage.
export function DataProvider({ children }) {
  const { user } = useAuth();
  // Périmètre du cache local : par ORGANISATION en mode SaaS (deux comptes sur
  // le même appareil ne partagent jamais leurs données), clé historique en
  // mode local. Stable pendant toute la vie du Provider (remonté au login).
  const scopeRef = useRef(isSupabaseConfigured ? (user.org?.id || user.org_id || user.id) : null);
  const scope = scopeRef.current;
  const [state, setState] = useState(() => loadState(scope));

  // Durcissement : en mode SaaS, on efface l'ancien tiroir PARTAGÉ de
  // l'appareil (clés historiques non préfixées). Même si un navigateur
  // ressert une vieille version de l'app depuis son cache, elle n'y
  // trouvera plus les données d'un autre compte à re-pousser.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('bestasolar_cart');
    } catch { /* stockage indisponible */ }
  }, []);

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
    const id = setTimeout(() => persist(state, scope), 400);
    return () => clearTimeout(id);
  }, [state, scope]);

  // Flush immédiat de la dernière valeur avant fermeture ou passage en
  // arrière-plan (crucial sur mobile) — garantit zéro perte malgré le débat.
  useEffect(() => {
    const flush = () => persist(stateRef.current, scope);
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps

  // Réplication Supabase (optionnelle, auto-détectée)
  const syncStatus = useRemoteSync(state, setState, stateRef);

  // Équipe : profils de l'organisation quand le backend est configuré,
  // utilisateurs du seed sinon (mode local / démo).
  const [team, setTeam] = useState(LOCAL_TEAM);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let on = true;
    fetchTeamProfiles()
      .then((t) => { if (on && t.length) setTeam(t); })
      .catch(() => {}); // hors-ligne : on garde l'équipe connue
    return () => { on = false; };
  }, []);

  // Actions métier (stables : créées une fois sur setState)
  const actions = useMemo(() => createActions(setState), []);

  // Sélecteurs dérivés de l'état courant
  const helpers = useMemo(() => ({
    getPartnerById: (id) => state.partners.find((p) => p.id === id),
    getPartnerByUserId: (userId) => state.partners.find((p) => p.userId === userId),
    getSubscriptionForUser: (userId) => (state.subscriptions || []).find((x) => x.userId === userId),
    getCompanyForUser: (userId) => (state.companies || []).find((c) => c.userId === userId),
    getLeadById: (id) => state.leads.find((l) => l.id === id),
    getUserById: (id) => team.find((u) => u.id === id),
    proClientsForUser: (userId) => (state.proClients || []).filter((c) => c.userId === userId),
    getProClientById: (id) => (state.proClients || []).find((c) => c.id === id),
    leadsForUser: (user) =>
      user.role === 'gerant' ? state.leads : state.leads.filter((l) => l.assignedTo === user.id),
  }), [state, team]);

  return (
    <DataContext.Provider value={{ ...state, ...actions, ...helpers, syncStatus, stages: seed.stages, lostStage: seed.LOST_STAGE, productCategories: seed.productCategories, monthlyData: seed.monthlyData, team }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData doit être utilisé dans <DataProvider>');
  return ctx;
}
