import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useData } from './DataContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { fetchMySubscription } from '../lib/remoteSync';
import { isSubscriptionActive } from '../utils/subscription';

// Mode d'affichage de l'application :
// - 'public' : tableau de bord standard (suivi clients, devis, boutique…)
// - 'pro'    : espace entreprise du technicien (réservé aux abonnés Devis Pro)
// La bascule vers 'pro' n'est possible que si un abonnement est actif.
const ModeContext = createContext(null);
const storageKey = (userId) => `bestasolar_mode_${userId}`;

export function ModeProvider({ children }) {
  const { user } = useAuth();
  const { getSubscriptionForUser } = useData();

  // Vérité serveur : quand le backend est configuré, l'abonnement est relu
  // directement sur Supabase (une ligne « actif » forgée dans le stockage
  // local ne suffit plus). Hors-ligne, on retombe sur l'état local répliqué —
  // l'abonné réel n'est jamais coupé en plein chantier (local-first).
  const [serverSub, setServerSub] = useState(undefined); // undefined = pas encore vérifié
  const localSub = getSubscriptionForUser(user.id);
  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return;
    let on = true;
    fetchMySubscription(user.id)
      .then((sub) => { if (on) setServerSub(sub); })
      .catch(() => {}); // réseau indisponible : on garde le repli local
    return () => { on = false; };
    // Re-vérifié quand l'abonnement local change (ex. : activation qui vient
    // d'être validée) — sinon la bascule attendrait un rechargement.
  }, [user?.id, localSub?.status, localSub?.dateFin]);

  const sub = isSupabaseConfigured && serverSub !== undefined ? serverSub : localSub;
  const proActive = isSubscriptionActive(sub);

  // Organisation de type 'pro' (installateur abonné Devis Pro) : l'app EST
  // l'espace Pro — pas de CRM interne BestaSolar (boutique, partenaires,
  // commissions, équipe). Le mode public n'existe pas pour ces comptes.
  const espaceProSeul = user.org?.kind === 'pro';

  const [mode, setModeState] = useState(() => {
    try {
      return localStorage.getItem(storageKey(user.id)) === 'pro' ? 'pro' : 'public';
    } catch {
      return 'public';
    }
  });

  // Gardes : une org 'pro' est toujours en mode pro (même sans abonnement —
  // les routes se chargent alors de la limiter à Abonnement / Entreprise) ;
  // une org interne sans abonnement actif reste en mode public.
  const effectiveMode = espaceProSeul ? 'pro' : (proActive ? mode : 'public');

  const setMode = (next) => {
    if (espaceProSeul && next !== 'pro') return; // pas de mode public pour les orgs pro
    if (next === 'pro' && !proActive && !espaceProSeul) return; // bascule Pro réservée aux abonnés
    setModeState(next);
    try {
      localStorage.setItem(storageKey(user.id), next);
    } catch {
      // stockage indisponible : on garde le mode en mémoire
    }
  };

  // Repli automatique en public si l'abonnement expire pendant la session Pro
  // (orgs internes uniquement — une org pro n'a nulle part où « replier »).
  useEffect(() => {
    if (!espaceProSeul && !proActive && mode === 'pro') setModeState('public');
  }, [espaceProSeul, proActive, mode]);

  return (
    <ModeContext.Provider value={{ mode: effectiveMode, setMode, proActive, espaceProSeul }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode doit être utilisé dans <ModeProvider>');
  return ctx;
}
