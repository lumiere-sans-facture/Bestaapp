import { createContext, useContext, useEffect, useState } from 'react';
import { users } from '../data/seed';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { setContexteErreur } from '../lib/rapportErreur';
import { setContexteAnalytique } from '../lib/analytique';
import { marquerGuideNouveauUtilisateur } from '../utils/onboarding';
import { setSyncOrg, fetchMyOrg } from '../lib/remoteSync';
import { getActiveRef } from '../utils/referral';
import { isSessionExpired, touchSession, clearSessionLifetime } from '../utils/sessionLifetime';
import { lireProfilCache, ecrireProfilCache, oublierProfilCache } from '../utils/profilCache';

const AuthContext = createContext(null);
const STORAGE_KEY = 'bestasolar_user';
// Inscription en attente de confirmation d'email : on mémorise de quoi créer
// l'organisation au premier login (le compte Auth existe, pas encore le profil).
const PENDING_KEY = 'bestasolar_pending_signup';
const OAUTH_CONTEXT_KEY = 'bestasolar_google_signup';

// select('*') : tolère l'ancien schéma (sans org_id / is_platform_admin)
// comme le schéma multi-entreprise.
//
// Renvoie { profile, injoignable }. La distinction est essentielle : un profil
// RÉELLEMENT absent (PGRST116, « aucune ligne ») déclenche la création de
// l'organisation ; un serveur injoignable, lui, ne prouve rien — il faut alors
// se rabattre sur le profil connu de l'appareil, pas conclure à un compte sans
// profil et renvoyer l'utilisateur à la connexion.
const fetchProfile = async (email) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();
    if (data) return { profile: data, injoignable: false };
    return { profile: null, injoignable: error?.code !== 'PGRST116' };
  } catch {
    return { profile: null, injoignable: true }; // requête avortée : hors-ligne
  }
};

const readPending = () => {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY)); } catch { return null; }
};

const readOAuthContext = () => {
  try { return JSON.parse(localStorage.getItem(OAUTH_CONTEXT_KEY)) || {}; } catch { return {}; }
};

// Certaines erreurs de Supabase Auth révèlent qu'un email est déjà inscrit
// (« User already registered »…) : les remplacer par un message générique à
// affichage conditionnel évite d'énumérer les comptes existants depuis
// l'écran d'inscription, sans pour autant masquer les erreurs utiles
// (mot de passe trop faible, email invalide…).
const ACCOUNT_EXISTS_PATTERN = /already (registered|exists|been registered)|existe déjà/i;
const sanitizeSignupError = (message) =>
  ACCOUNT_EXISTS_PATTERN.test(message || '')
    ? 'Inscription impossible. Si vous avez déjà un compte avec cet email, connectez-vous plutôt.'
    : message;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // true après un clic sur le lien « mot de passe oublié » reçu par email :
  // l'app demande alors le nouveau mot de passe avant tout le reste.
  const [recovery, setRecovery] = useState(false);
  // Session Auth valide mais profil métier absent : cas normal au premier
  // retour de Google OAuth. L'écran de connexion termine alors l'inscription.
  const [pendingAuthUser, setPendingAuthUser] = useState(null);

  // Attache l'organisation au profil (type interne/pro, nom, code d'invitation).
  // user.org absent = ancien schéma mono-équipe ou mode local → comportement
  // « interne » (CRM complet), comme avant.
  const adoptProfile = async (profile) => {
    setPendingAuthUser(null);
    localStorage.removeItem(OAUTH_CONTEXT_KEY);
    setSyncOrg(profile?.org_id);
    let org = null;
    if (profile?.org_id) org = await fetchMyOrg();
    // Serveur injoignable : `fetchMyOrg` rend null. Reprendre l'organisation
    // connue plutôt que de repartir sans — un type d'organisation inconnu
    // suspend la réplication du catalogue pour toute la session.
    if (!org && profile?.org_id) org = profile.org || lireProfilCache(profile.email || '')?.org || null;
    // Le type (interne/pro) conditionne la sync du catalogue partagé.
    setSyncOrg(profile?.org_id, org?.kind);
    // Les rapports d'erreur portent désormais l'identifiant du compte et de
    // l'entreprise (jamais le nom ni le téléphone) : sans eux, impossible de
    // savoir qui est bloqué.
    setContexteErreur({
      userId: profile?.id || null,
      orgId: profile?.org_id || null,
      role: profile?.role || null,
    });
    setContexteAnalytique({ distinctId: profile?.id || null });
    const adopte = org ? { ...profile, org } : profile;
    ecrireProfilCache(adopte);
    setUser(adopte);
  };

  // Le compte Auth existe mais pas encore le profil : crée l'organisation (ou
  // rejoint celle du code d'invitation) mémorisée à l'inscription.
  const provisionProfile = async (email) => {
    const pending = readPending();
    if (!pending || pending.email?.toLowerCase() !== email.toLowerCase()) return null;
    try {
      if (pending.inviteCode) {
        await supabase.rpc('signup_join_org', { p_invite_code: pending.inviteCode, p_user_name: pending.name, p_phone: pending.phone || '' });
      } else {
        await supabase.rpc('signup_create_org', {
          p_org_name: pending.companyName,
          p_user_name: pending.name,
          p_ref_code: pending.refCode || null,
          p_phone: pending.phone || '',
        });
      }
      localStorage.removeItem(PENDING_KEY);
      const nouveauProfil = (await fetchProfile(email)).profile;
      if (nouveauProfil?.id) marquerGuideNouveauUtilisateur(nouveauProfil.id);
      return nouveauProfil;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (isSupabaseConfigured) {
      // Session Supabase persistée : restaurer le profil de l'équipe — sauf
      // au-delà de la durée de vie ou de l'inactivité tolérées (palliatif à
      // « Authentication → Sessions », payant, voir utils/sessionLifetime.js).
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        const email = session?.user?.email;
        if (!email) { setIsLoading(false); return; }
        if (isSessionExpired()) {
          clearSessionLifetime();
          oublierProfilCache();
          await supabase.auth.signOut();
          setIsLoading(false);
          return;
        }
        touchSession();
        // Profil déjà connu de cet appareil : l'app s'ouvre IMMÉDIATEMENT,
        // sans attendre le serveur. C'est ce qui la rend utilisable sur le
        // terrain : sans réseau, la lecture du profil est réessayée quatre
        // fois avec un délai croissant, et l'utilisateur restait sept
        // secondes devant « Chargement… » avant d'être renvoyé à la
        // connexion. Le profil est rafraîchi juste après, en arrière-plan.
        const cache = lireProfilCache(email);
        if (cache) { await adoptProfile(cache); setIsLoading(false); }

        const { profile, injoignable } = await fetchProfile(email);
        if (profile) await adoptProfile(profile);
        else if (!injoignable) {
          // Le serveur répond clairement : ce compte n'a pas de profil.
          const cree = await provisionProfile(email);
          if (cree) await adoptProfile(cree);
          // Ouvert sur un profil mémorisé que le serveur ne reconnaît plus
          // (membre retiré de l'entreprise) : la session est refermée.
          else if (cache) {
            oublierProfilCache();
            await supabase.auth.signOut();
            setUser(null);
          } else {
            // Compte Auth sans profil (connexion Google d'un nouvel arrivant) :
            // l'inscription se termine à l'écran, elle n'est pas un échec.
            const oauthContext = readOAuthContext();
            setPendingAuthUser({
              email,
              name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
              inviteCode: oauthContext.inviteCode || null,
              refCode: oauthContext.refCode || null,
            });
          }
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
  }, []);

  // Google Identity Services s'exécute sur app.bestasolar.com et transmet un
  // ID token à Supabase. On évite ainsi la redirection visible vers le domaine
  // technique du projet Supabase, tout en conservant Supabase Auth pour la
  // session, les règles RLS et les comptes existants.
  const signInWithGoogle = async ({ credential, inviteCode, refCode } = {}) => {
    if (!isSupabaseConfigured) return { ok: false, error: 'Backend non configuré.' };
    if (!credential) return { ok: false, error: 'Jeton Google absent. Réessayez.' };
    localStorage.setItem(OAUTH_CONTEXT_KEY, JSON.stringify({
      inviteCode: inviteCode || null,
      refCode: refCode || null,
    }));

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: credential,
    });
    if (error) localStorage.removeItem(OAUTH_CONTEXT_KEY);
    if (error) return { ok: false, error: error.message };

    const googleUser = data.user || data.session?.user;
    const email = googleUser?.email;
    if (!email) {
      localStorage.removeItem(OAUTH_CONTEXT_KEY);
      await supabase.auth.signOut();
      return { ok: false, error: 'Le compte Google ne contient pas d’adresse email utilisable.' };
    }

    touchSession();
    const { profile, injoignable } = await fetchProfile(email);
    if (profile) {
      await adoptProfile(profile);
      return { ok: true };
    }

    if (injoignable) {
      return { ok: false, error: 'Google a accepté la connexion, mais Besta ne peut pas joindre le serveur. Réessayez dans un instant.' };
    }

    // Premier compte Google : l'utilisateur termine son profil métier sur
    // l'écran déjà prévu pour ce cas (téléphone, entreprise ou équipe).
    const cree = await provisionProfile(email);
    if (cree) {
      await adoptProfile(cree);
      return { ok: true };
    }
    const oauthContext = readOAuthContext();
    setPendingAuthUser({
      email,
      name: googleUser.user_metadata?.full_name || googleUser.user_metadata?.name || '',
      inviteCode: oauthContext.inviteCode || null,
      refCode: oauthContext.refCode || null,
    });
    return { ok: true };
  };

  const login = async (email, password) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return false;
      touchSession();
      const profile = (await fetchProfile(email.trim())).profile || (await provisionProfile(email.trim()));
      if (!profile) {
        // Compte Auth valide mais profil jamais créé (inscription interrompue,
        // autre navigateur…) : on garde la session et on laisse l'écran de
        // connexion proposer de terminer l'inscription.
        return 'incomplete';
      }
      await adoptProfile(profile);
      return true;
    }
    const found = users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
    );
    if (!found) return false;
    const { password: _pw, ...safeUser } = found;
    // Mode local (démo) : le contexte d'erreur se renseigne aussi ici, sinon
    // un plantage en démonstration remonterait sans savoir qui l'a vécu.
    setContexteErreur({ userId: safeUser.id, orgId: null, role: safeUser.role });
    setContexteAnalytique({ distinctId: safeUser.id });
    setUser(safeUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeUser));
    return true;
  };

  /**
   * Inscription self-service (backend requis) — une seule page simple.
   * Sans code d'invitation : espace personnel créé silencieusement (utilisateur
   * classique) ; avec `inviteCode` (lien ?equipe=) : rejoint l'équipe.
   * Retourne { ok, needsConfirmation, error }.
   */
  const signUp = async ({ email, password, name, phone, companyName, inviteCode, refCode }) => {
    if (!isSupabaseConfigured) return { ok: false, error: 'Backend non configuré.' };
    // L'espace personnel porte le nom de l'utilisateur (renommable plus tard
    // dans « Mon entreprise » de l'espace Pro).
    if (!inviteCode && !companyName) companyName = name;
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name, phone: phone || '', companyName: companyName || null, inviteCode: inviteCode || null } },
    });
    if (error) return { ok: false, error: sanitizeSignupError(error.message) };
    // Si la confirmation d'email est activée, le profil sera créé au premier
    // login : on mémorise l'entreprise / le code (invitation, parrainage) en attendant.
    localStorage.setItem(PENDING_KEY, JSON.stringify({ email: email.trim(), name, phone: phone || '', companyName, inviteCode, refCode: refCode || null }));
    if (!data.session) return { ok: true, needsConfirmation: true };
    touchSession();
    const profile = await provisionProfile(email.trim());
    if (!profile) return { ok: false, error: 'Compte créé mais profil introuvable — reconnectez-vous.' };
    await adoptProfile(profile);
    return { ok: true };
  };

  /**
   * Termine une inscription interrompue : la session Auth existe déjà, il ne
   * manque que le profil (et son entreprise ou son rattachement d'équipe).
   */
  const completeSignup = async ({ name, phone, companyName, inviteCode, refCode }) => {
    if (!isSupabaseConfigured) return { ok: false };
    if (!inviteCode && !companyName) companyName = name;
    try {
      if (inviteCode) {
        await supabase.rpc('signup_join_org', { p_invite_code: inviteCode, p_user_name: name, p_phone: phone || '' });
      } else {
        await supabase.rpc('signup_create_org', {
          p_org_name: companyName,
          p_user_name: name,
          // Code saisi dans le formulaire, sinon parrainage encore actif sur
          // l'appareil (lien ?ref= cliqué) : conservé même quand l'inscription
          // se termine à la connexion.
          p_ref_code: refCode || getActiveRef()?.code || null,
          p_phone: phone || '',
        });
      }
    } catch (e) {
      return { ok: false, error: e.message };
    }
    const { data: { session } } = await supabase.auth.getSession();
    const profile = session?.user?.email ? (await fetchProfile(session.user.email)).profile : null;
    if (!profile) return { ok: false, error: 'Profil introuvable après création — réessayez.' };
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(OAUTH_CONTEXT_KEY);
    setPendingAuthUser(null);
    marquerGuideNouveauUtilisateur(profile.id);
    await adoptProfile(profile);
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
        touchSession();
        const profile = (await fetchProfile(session.user.email)).profile;
        if (profile) await adoptProfile(profile);
      }
    }
    return { ok: !error, error: error?.message };
  };

  const logout = () => {
    if (isSupabaseConfigured) supabase.auth.signOut();
    // Le profil mémorisé pour l'ouverture hors-ligne part avec la session :
    // le laisser rouvrirait l'app sur le compte précédent.
    oublierProfilCache();
    // Le compte quitte l'app : les rapports suivants ne doivent plus lui être
    // attribués.
    setContexteErreur({ userId: null, orgId: null, role: null });
    setContexteAnalytique({ distinctId: null });
    setUser(null);
    setPendingAuthUser(null);
    setSyncOrg(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(OAUTH_CONTEXT_KEY);
    clearSessionLifetime();
  };

  /** Recharge l'organisation attachée au profil (après attribution du parrainage…). */
  const refreshOrg = async () => {
    if (!isSupabaseConfigured) return;
    const org = await fetchMyOrg();
    if (org) {
      setSyncOrg(org.id, org.kind);
      setUser((u) => (u ? { ...u, org } : u));
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signInWithGoogle, logout, signUp, completeSignup, resetPassword, updatePassword, refreshOrg, recovery, pendingAuthUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
