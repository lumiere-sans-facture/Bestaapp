import { createContext, useContext, useEffect, useState } from 'react';
import { users } from '../data/seed';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthContext = createContext(null);
const STORAGE_KEY = 'bestasolar_user';

const fetchProfile = async (email) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role, phone, avatar')
    .eq('email', email.toLowerCase())
    .single();
  if (error || !data) return null;
  return data;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isSupabaseConfigured) {
      // Session Supabase persistée : restaurer le profil de l'équipe
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user?.email) {
          const profile = await fetchProfile(session.user.email);
          if (profile) setUser(profile);
        }
        setIsLoading(false);
      });
      return;
    }
    // Mode local (sans backend configuré)
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setUser(JSON.parse(saved));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setIsLoading(false);
  }, []);

  const login = async (email, password) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return false;
      const profile = await fetchProfile(email.trim());
      if (!profile) {
        await supabase.auth.signOut();
        return false;
      }
      setUser(profile);
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

  const logout = () => {
    if (isSupabaseConfigured) supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
