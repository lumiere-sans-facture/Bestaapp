import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as seed from '../data/seed';
import { consumeRefClick } from '../utils/referral';
import { useAuth } from './AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { fetchTeamProfiles, syncGoogleContact } from '../lib/remoteSync';
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

  // Une tentative ratée ne nécessite aucune action manuelle : tant que l'app
  // est ouverte, on réveille la file chaque minute et immédiatement au retour
  // du réseau. Le planificateur serveur documenté complète ce filet quand
  // aucun appareil n'est ouvert.
  const [googleRetryTick, setGoogleRetryTick] = useState(0);
  useEffect(() => {
    const wake = () => setGoogleRetryTick((n) => n + 1);
    const interval = setInterval(wake, 60 * 1000);
    window.addEventListener('online', wake);
    return () => { clearInterval(interval); window.removeEventListener('online', wake); };
  }, []);

  // Reprise asynchrone de Google Contacts. La mutation locale ne dépend jamais
  // de ce réseau : les partenaires et les fiches Clients (collection leads)
  // avec un statut arrivé à échéance sont tentés. Un seul essai par contact est
  // exécuté simultanément.
  const googleSyncInFlight = useRef(new Set());
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    const now = Date.now();
    const due = [
      ...(state.partners || []).map((contact) => ({ contact, contactType: 'partner' })),
      ...(state.leads || []).map((contact) => ({ contact, contactType: 'lead' })),
    ].filter(({ contact, contactType }) => {
      const status = contact.google_contact_sync_status;
      const retry = contact.google_contact_sync_next_retry_at;
      const key = `${contactType}:${contact.id}`;
      return contact.phone && (status === 'pending' || status === 'failed')
        && (!retry || Number.isNaN(Date.parse(retry)) || Date.parse(retry) <= now)
        && !googleSyncInFlight.current.has(key);
    }).slice(0, 3);
    if (!due.length) return undefined;
    let active = true;
    due.forEach(({ contact, contactType }) => {
      const key = `${contactType}:${contact.id}`;
      const setSyncStatus = contactType === 'lead'
        ? actions.setLeadGoogleContactSync
        : actions.setPartnerGoogleContactSync;
      // L'auteur de la fiche est figé à la création. Ce repli couvre les
      // anciens clients créés avant l'ajout du champ de traçabilité.
      const enregistrant = contactType === 'lead'
        ? (state.partners || []).find((partner) => partner.id === contact.registeredByPartnerId
          || partner.userId === contact.registeredByUserId
          || partner.userId === contact.assignedTo)
        : null;
      const membre = contactType === 'lead'
        ? team.find((member) => member.id === contact.registeredByUserId || member.id === contact.assignedTo)
        : null;
      const contactToSync = contactType === 'lead' ? {
        ...contact,
        registeredByPartnerName: contact.registeredByPartnerName || enregistrant?.name || membre?.name || '',
        registeredByPartnerCode: contact.registeredByPartnerCode || enregistrant?.code || '',
      } : contact;
      googleSyncInFlight.current.add(key);
      syncGoogleContact(contactToSync, contactType)
        .then((result) => { if (active) setSyncStatus(contact.id, result); })
        .catch((error) => {
          if (active) setSyncStatus(contact.id, {
            status: 'failed', error: error.message || 'Synchronisation Google impossible.',
            nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          });
        })
        .finally(() => googleSyncInFlight.current.delete(key));
    });
    return () => { active = false; };
  }, [state.partners, state.leads, actions, googleRetryTick]);

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

