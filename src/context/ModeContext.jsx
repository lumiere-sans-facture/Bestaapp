import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useData } from './DataContext';
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
  const proActive = isSubscriptionActive(getSubscriptionForUser(user.id));

  const [mode, setModeState] = useState(() => {
    try {
      return localStorage.getItem(storageKey(user.id)) === 'pro' ? 'pro' : 'public';
    } catch {
      return 'public';
    }
  });

  // Garde : sans abonnement actif, le mode effectif est toujours public.
  const effectiveMode = proActive ? mode : 'public';

  const setMode = (next) => {
    if (next === 'pro' && !proActive) return; // bascule Pro réservée aux abonnés
    setModeState(next);
    try {
      localStorage.setItem(storageKey(user.id), next);
    } catch {
      // stockage indisponible : on garde le mode en mémoire
    }
  };

  // Repli automatique en public si l'abonnement expire pendant la session Pro.
  useEffect(() => {
    if (!proActive && mode === 'pro') setModeState('public');
  }, [proActive, mode]);

  return (
    <ModeContext.Provider value={{ mode: effectiveMode, setMode, proActive }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode doit être utilisé dans <ModeProvider>');
  return ctx;
}
