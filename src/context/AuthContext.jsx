import { createContext, useContext, useEffect, useState } from 'react';
import { users } from '../data/seed';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { setSyncOrg } from '../lib/remoteSync';

const AuthContext = createContext(null);
const STORAGE_KEY = 'bestasolar_user';
// Inscription en attente de confirmation d'email : on mémorise de quoi créer
// l'organisation au premier login (le compte Auth existe, pas encore le profil).
const PENDING_KEY = 'bestasolar_pending_signup';

// select('*') : tolère l'ancien schéma (sans org_id / is_platform_admin)
// comme le schéma multi-entreprise.
const fetchProfile = async (email) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();
  if (error || !data) return null;
  return data;
};

const readPending = () => {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY)); } catch { return null; }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // true après un clic sur le lien « mot de passe oublié » reçu par email :
  // l'app demande alors le nouveau mot de passe avant tout le reste.
  const [recovery, setRecovery] = useState(false);

  const adoptProfile = (profile) => {
    setUser(profile);
    setSyncOrg(profile?.org_id);
  };

  // Le compte Auth existe mais pas encore le profil : crée l'organisation (ou
  // rejoint celle du code d'invitation) mémorisée à l'inscription.
  const provisionProfile = async (email) => {
    const pending = readPending();
    if (!pending || pending.email?.toLowerCase() !== email.toLowerCase()) return null;
    try {
      if (pending.inviteCode) {
        await supabase.rpc('signup_join_org', { p_invite_code: pending.inviteCode, p_user_name: pending.name });
      } else {
        await supabase.rpc('signup_create_org', { p_org_name: pending.companyName, p_user_name: pending.name });
      }
      localStorage.removeItem(PENDING_KEY);
      return await fetchProfile(email);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (isSupabaseConfigured) {
      // Session Supabase persistée : restaurer le profil de l'équipe
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user?.email) {
          const profile = (await fetchProfile(session.user.email)) || (await provisionProfile(session.user.email));
          if (profile) adoptProfile(profile);
        }
        setIsLoading(false);
      });
      // Lien de réinitialisation de mot de passe cliqué depuis l'email.
      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      });
      return () => sub.subscription.unsubscribe();
    }
    // Mode local (sans backend configuré)
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setUser(JSON.parse(saved));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setIsLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email, password) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return false;
      const profile = (await fetchProfile(email.trim())) || (await provisionProfile(email.trim()));
      if (!profile) {
        await supabase.auth.signOut();
        return false;
      }
      adoptProfile(profile);
      return true;
    }
    const found = users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
    );
    if (!found) return false;
    const { password: _pw, ...safeUser } = found;
    setUser(safeUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeUser));
    return true;
  };

  /**
   * Inscription self-service (backend requis).
   * `companyName` crée une nouvelle entreprise (rôle gérant) ;
   * `inviteCode` rejoint une entreprise existante (rôle technicien).
   * Retourne { ok, needsConfirmation, error }.
   */
  const signUp = async ({ email, password, name, companyName, inviteCode }) => {
    if (!isSupabaseConfigured) return { ok: false, error: 'Backend non configuré.' };
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name, companyName: companyName || null, inviteCode: inviteCode || null } },
    });
    if (error) return { ok: false, error: error.message };
    // Si la confirmation d'email est activée, le profil sera créé au premier
    // login : on mémorise l'entreprise / le code en attendant.
    localStorage.setItem(PENDING_KEY, JSON.stringify({ email: email.trim(), name, companyName, inviteCode }));
    if (!data.session) return { ok: true, needsConfirmation: true };
    const profile = await provisionProfile(email.trim());
    if (!profile) return { ok: false, error: 'Compte créé mais profil introuvable — reconnectez-vous.' };
    adoptProfile(profile);
    return { ok: true };
  };

  /** Envoie l'email de réinitialisation (le lien ramène vers l'app). */
  const resetPassword = async (email) => {
    if (!isSupabaseConfigured) return { ok: false };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    return { ok: !error, error: error?.message };
  };

  /** Définit le nouveau mot de passe après le clic sur le lien reçu. */
  const updatePassword = async (newPassword) => {
    if (!isSupabaseConfigured) return { ok: false };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) {
      setRecovery(false);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const profile = await fetchProfile(session.user.email);
        if (profile) adoptProfile(profile);
      }
    }
    return { ok: !error, error: error?.message };
  };

  const logout = () => {
    if (isSupabaseConfigured) supabase.auth.signOut();
    setUser(null);
    setSyncOrg(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, signUp, resetPassword, updatePassword, recovery }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
