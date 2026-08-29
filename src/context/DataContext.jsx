import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as seed from '../data/seed';
import { consumeRefClick } from '../utils/referral';
import { useAuth } from './AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { fetchTeamProfiles, syncPartnerGoogleContact } from '../lib/remoteSync';
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

  // Échec d'enregistrement local (quota saturé, navigation privée) : signalé à
  // l'utilisateur, jamais avalé — sinon il travaille sur des données qui
  // disparaîtront à la fermeture de l'app.
  const [storageError, setStorageError] = useState(false);

  // Persistance locale débattue : éviter de sérialiser tout l'état (coût
  // O(taille des données) sur le thread principal) à chaque micro-mutation.
  useEffect(() => {
    const id = setTimeout(() => setStorageError(!persist(state, scope)), 400);
    return () => clearTimeout(id);
  }, [state, scope]);

  // Flush immédiat de la dernière valeur avant fermeture ou passage en
  // arrière-plan (crucial sur mobile) — garantit zéro perte malgré le débat.
  useEffect(() => {
    const flush = () => { if (!persist(stateRef.current, scope)) setStorageError(true); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [scope]);

  // Réplication Supabase (optionnelle, auto-détectée)
  const { syncStatus, syncError, enAttente, synchroniserMaintenant } = useRemoteSync(state, setState, stateRef, scope);

  // Équipe : profils de MON organisation quand le backend est configuré,
  // utilisateurs du seed sinon (mode local / démo).
  // En mode SaaS on part d'une équipe réduite à l'utilisateur courant : les
  // utilisateurs du seed appartiennent à une entreprise de démonstration et
  // leur « gérant » ferait croire à tort que l'espace en a un — l'utilisateur
  // seul dans son espace perdrait alors le droit de faire avancer ses clients.
  const [team, setTeam] = useState(() =>
    (isSupabaseConfigured ? [{ id: user.id, name: user.name, role: user.role, phone: user.phone || '', avatar: user.avatar }] : LOCAL_TEAM));
  // L'annuaire de départ ne contient que l'utilisateur : tant que le serveur
  // n'a pas répondu, on ne peut RIEN conclure sur la présence d'un gérant.
  // (En mode local, l'équipe de démonstration est connue d'emblée.)
  const [teamChargee, setTeamChargee] = useState(!isSupabaseConfigured);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let on = true;
    fetchTeamProfiles(user.org?.id || user.org_id)
      .then((t) => { if (on && t.length) { setTeam(t); setTeamChargee(true); } })
      .catch(() => {}); // hors-ligne : équipe inconnue, aucun pouvoir déduit
    return () => { on = false; };
  }, [user.id, user.org?.id, user.org_id]);

  // Actions métier (stables : créées une fois sur setState)
  const actions = useMemo(() => createActions(setState), []);

  // Reprise asynchrone de Google Contacts. La mutation locale ne dépend jamais
  // de ce réseau : seuls les partenaires avec un statut arrivé à échéance sont
  // tentés, et un seul essai par partenaire est exécuté simultanément.
  const googleSyncInFlight = useRef(new Set());
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    const now = Date.now();
    const due = (state.partners || []).filter((partner) => {
      const status = partner.google_contact_sync_status;
      const retry = partner.google_contact_sync_next_retry_at;
      return partner.phone && (status === 'pending' || status === 'failed')
        && (!retry || Number.isNaN(Date.parse(retry)) || Date.parse(retry) <= now)
        && !googleSyncInFlight.current.has(partner.id);
    }).slice(0, 3);
    if (!due.length) return undefined;
    let active = true;
    due.forEach((partner) => {
      googleSyncInFlight.current.add(partner.id);
      syncPartnerGoogleContact(partner)
        .then((result) => { if (active) actions.setPartnerGoogleContactSync(partner.id, result); })
        .catch((error) => {
          if (active) actions.setPartnerGoogleContactSync(partner.id, {
            status: 'failed', error: error.message || 'Synchronisation Google impossible.',
            nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          });
        })
        .finally(() => googleSyncInFlight.current.delete(partner.id));
    });
    return () => { active = false; };
  }, [state.partners, actions]);

  // Profil partenaire de l'utilisateur garanti dès l'ouverture de l'app.
  // C'est lui qui porte les commissions : sans profil, une affaire gagnée
  // n'a aucun apporteur à rémunérer et la commission n'est jamais créée —
  // silencieusement. L'action est idempotente (id déterministe p-user-<id>).
  useEffect(() => {
    if (user?.id) actions.ensurePartnerForUser(user);
  }, [user?.id, actions]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <DataContext.Provider value={{ ...state, ...actions, ...helpers, syncStatus, syncError, enAttente, synchroniserMaintenant, stages: seed.stages, lostStage: seed.LOST_STAGE, productCategories: seed.productCategories, monthlyData: seed.monthlyData, team, teamChargee, storageError }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData doit être utilisé dans <DataProvider>');
  return ctx;
}
