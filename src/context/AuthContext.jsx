import { createContext, useContext, useEffect, useState } from 'react';
import { users } from '../data/seed';
import { supabase, isSupabaseConfigured, emailSessionMemorisee, estCoupureReseauAuth } from '../lib/supabase';
import { setContexteErreur, signalerErreur } from '../lib/rapportErreur';
import { setContexteAnalytique } from '../lib/analytique';
import { marquerGuideNouveauUtilisateur } from '../utils/onboarding';
import { setSyncOrg, fetchMyOrg } from '../lib/remoteSync';
import { getActiveRef } from '../utils/referral';
import { isSessionExpired, touchSession, clearSessionLifetime } from '../utils/sessionLifetime';
import { lireProfilCache, ecrireProfilCache, oublierProfilCache } from '../utils/profilCache';
import { isNativeGoogleAuth, signInWithGoogleNative, signOutGoogleNative } from '../lib/nativeGoogleAuth';
import { fetchAuthProfile } from '../lib/authProfile';

const AuthContext = createContext(null);
const STORAGE_KEY = 'bestasolar_user';
// Inscription en attente de confirmation d'email : on mémorise de quoi créer
// l'organisation au premier login (le compte Auth existe, pas encore le profil).
const PENDING_KEY = 'bestasolar_pending_signup';
const OAUTH_CONTEXT_KEY = 'bestasolar_google_signup';

// L'uid Auth est prioritaire ; l'email (sans sensibilité à la casse) couvre les
// profils historiques. Une erreur RLS/réseau ne signifie pas « nouveau compte ».
const fetchProfile = (authUser) => fetchAuthProfile(supabase, authUser);

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

// « Error sending confirmation email » / « … recovery email » : Supabase n'a
// pas pu remettre l'e-mail à son serveur d'envoi (SMTP Brevo refusé, quota
// atteint, modèle invalide). Ce n'est pas la faute du client : message en
// français pour lui, et rapport au journal des erreurs pour le gérant — la
// cause exacte se lit dans Supabase → Logs → Auth (DEPLOIEMENT § 10).
const ENVOI_EMAIL_ECHOUE = /error sending .*e-?mail/i;
const messageEnvoiEmail = (error, operation) => {
  if (!ENVOI_EMAIL_ECHOUE.test(error?.message || '')) return null;
  signalerErreur(new Error(`Supabase : envoi de l'e-mail refusé (${operation}) — ${error.message}`), { origine: 'auth' });
  return 'L’e-mail n’a pas pu être envoyé pour le moment. Réessayez dans quelques minutes ; si cela continue, contactez BestaSolar.';
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // true après un clic sur le lien « mot de passe oublié » reçu par email :
  // l'app demande alors le nouveau mot de passe avant tout le reste.
  const [recovery, setRecovery] = useState(false);
  // Session Auth valide mais profil métier absent : cas normal au premier
  // retour de Google OAuth. L'écran de connexion termine alors l'inscription.
  const [pendingAuthUser, setPendingAuthUser] = useState(null);

  // Adopte un profil dont l'organisation est connue (type interne/pro, nom,
  // code d'invitation). user.org absent = ancien schéma mono-équipe ou mode
  // local → comportement « interne » (CRM complet), comme avant.
  const appliquerProfil = (profile, org) => {
    setPendingAuthUser(null);
    localStorage.removeItem(OAUTH_CONTEXT_KEY);
    // Le type (interne/pro) conditionne la sync du catalogue partagé. Fixés
    // ENSEMBLE : l'app peut déjà synchroniser (ouverture sur le profil
    // mémorisé), et un type d'organisation momentanément inconnu y
    // suspendrait l'envoi du catalogue.
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

  // Profil mémorisé sur l'appareil : adopté tel quel, organisation comprise,
  // SANS le moindre appel réseau — c'est ce qui ouvre l'app instantanément.
  const adopterProfilMemorise = (cache) => appliquerProfil(cache, cache.org || null);

  // Lit l'organisation puis adopte le profil.
  // `orgEnCours` : lecture de l'organisation déjà lancée par l'appelant, EN
  // PARALLÈLE de celle du profil — un aller-retour réseau de moins à la
  // connexion (sur mobile, chaque aller-retour compte).
  const adoptProfile = async (profile, orgEnCours = null) => {
    setPendingAuthUser(null);
    localStorage.removeItem(OAUTH_CONTEXT_KEY);
    let org = null;
    if (profile?.org_id) org = await (orgEnCours || fetchMyOrg());
    // Serveur injoignable : `fetchMyOrg` rend null. Reprendre l'organisation
    // connue plutôt que de repartir sans — un type d'organisation inconnu
    // suspend la réplication du catalogue pour toute la session.
    if (!org && profile?.org_id) org = profile.org || lireProfilCache(profile.email || '')?.org || null;
    appliquerProfil(profile, org);
  };

  // Le compte Auth existe mais pas encore le profil : crée l'organisation (ou
  // rejoint celle du code d'invitation) mémorisée à l'inscription.
  const provisionProfile = async (authUser) => {
    const email = authUser?.email;
    if (!email) return null;
    const pending = readPending();
    if (!pending || pending.email?.toLowerCase() !== email.toLowerCase()) return null;
    try {
      let resultat;
      if (pending.inviteCode) {
        resultat = await supabase.rpc('signup_join_org', { p_invite_code: pending.inviteCode, p_user_name: pending.name, p_phone: pending.phone || '' });
      } else {
        resultat = await supabase.rpc('signup_create_org', {
          p_org_name: pending.companyName,
          p_user_name: pending.name,
          p_ref_code: pending.refCode || null,
          p_phone: pending.phone || '',
        });
      }
      if (resultat.error) return null;
      const nouveauProfil = (await fetchProfile(authUser)).profile;
      if (!nouveauProfil) return null;
      localStorage.removeItem(PENDING_KEY);
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
      // La connexion Google Android est native : le jeton est remis directement
      // à Supabase, sans navigateur ni callback à reprendre au démarrage.
      //
      // Profil déjà connu de cet appareil : l'app s'ouvre IMMÉDIATEMENT, sans
      // attendre le serveur — ni le renouvellement du jeton (expiré au-delà
      // d'une heure, donc à presque chaque réouverture), ni la lecture de
      // l'organisation. Ces deux allers-retours tenaient l'utilisateur devant
      // « Chargement… » à chaque ouverture, d'autant plus longtemps que le
      // réseau était faible. Session et profil sont vérifiés juste après, en
      // arrière-plan ; la synchronisation attend d'elle-même la session.
      const emailMemorise = emailSessionMemorisee();
      // Profil mémorisé actuellement affiché, en attendant le serveur.
      let affiche = emailMemorise && !isSessionExpired() ? lireProfilCache(emailMemorise) : null;
      if (affiche) {
        adopterProfilMemorise(affiche);
        setIsLoading(false);
      }
      // Referme l'app ouverte sur le profil mémorisé : session disparue
      // (refusée au renouvellement), périmée, ou compte retiré.
      const refermer = () => {
        if (!affiche) return;
        affiche = null;
        oublierProfilCache();
        setSyncOrg(null);
        setUser(null);
      };

      supabase.auth.getSession().then(async ({ data: { session }, error }) => {
        // Pas de réseau pour renouveler le jeton : la session est toujours sur
        // l'appareil, la librairie la renouvellera au retour du réseau. L'app
        // ouverte sur le profil mémorisé le reste — la refermer ici renvoyait
        // un technicien en zone blanche à une connexion impossible.
        if (!session && estCoupureReseauAuth(error)) { setIsLoading(false); return; }
        const email = session?.user?.email;
        // La session n'est plus celle du profil affiché (disparue, ou ouverte
        // pour un autre compte par un lien reçu par e-mail) : on referme
        // AVANT tout, pour que les données d'un compte ne passent jamais
        // sous l'identité d'un autre.
        if (affiche && affiche.email.toLowerCase() !== (email || '').toLowerCase()) refermer();
        if (!email) { setIsLoading(false); return; }
        if (isSessionExpired()) {
          clearSessionLifetime();
          oublierProfilCache();
          await supabase.auth.signOut();
          refermer();
          setIsLoading(false);
          return;
        }
        touchSession();
        // Repli quand l'adresse n'a pas pu être lue sans réseau : même
        // ouverture sur le profil mémorisé, une fois la session obtenue.
        if (!affiche) {
          affiche = lireProfilCache(email);
          if (affiche) { adopterProfilMemorise(affiche); setIsLoading(false); }
        }

        // Profil et organisation relus EN MÊME TEMPS, pas l'un après l'autre.
        const orgEnCours = fetchMyOrg();
        const { profile, injoignable } = await fetchProfile(session.user);
        if (profile) await adoptProfile(profile, orgEnCours);
        else if (!injoignable) {
          // Le serveur répond clairement : ce compte n'a pas de profil.
          const cree = await provisionProfile(session.user);
          if (cree) await adoptProfile(cree);
          // Ouvert sur un profil mémorisé que le serveur ne reconnaît plus
          // (membre retiré de l'entreprise) : la session est refermée.
          else if (affiche) {
            await supabase.auth.signOut();
            refermer();
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
  // Restauration de la session : UNE FOIS, au montage. Les fonctions
  // d'adoption sont recréées à chaque rendu mais ne lisent que des setters
  // stables — les déclarer relancerait la restauration à chaque rendu.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Google Identity Services s'exécute sur app.bestasolar.com et transmet un
  // ID token à Supabase. On évite ainsi la redirection visible vers le domaine
  // technique du projet Supabase, tout en conservant Supabase Auth pour la
  // session, les règles RLS et les comptes existants.
  const signInWithGoogle = async ({ credential, inviteCode, refCode } = {}) => {
    if (!isSupabaseConfigured) return { ok: false, error: 'Backend non configuré.' };
    const native = isNativeGoogleAuth();
    if (!native && !credential) return { ok: false, error: 'Jeton Google absent. Réessayez.' };
    localStorage.setItem(OAUTH_CONTEXT_KEY, JSON.stringify({
      inviteCode: inviteCode || null,
      refCode: refCode || null,
    }));

    const { data, error } = native
      ? await signInWithGoogleNative()
      : await supabase.auth.signInWithIdToken({
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
    // Profil et organisation lus en même temps, pas l'un après l'autre.
    const orgEnCours = fetchMyOrg();
    const { profile, injoignable } = await fetchProfile(googleUser);
    if (profile) {
      await adoptProfile(profile, orgEnCours);
      return { ok: true };
    }

    if (injoignable) {
      const cache = lireProfilCache(email);
      if (cache) {
        await adoptProfile(cache);
        return { ok: true };
      }
      return { ok: false, error: 'Google a accepté la connexion, mais Besta ne peut pas joindre le serveur. Réessayez dans un instant.' };
    }

    // Premier compte Google : l'utilisateur termine son profil métier sur
    // l'écran déjà prévu pour ce cas (téléphone, entreprise ou équipe).
    const cree = await provisionProfile(googleUser);
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
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      // Adresse jamais confirmée : Supabase ne le dit qu'avec le BON mot de
      // passe (aucune énumération possible) — l'écran propose alors le code.
      if (error) return error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message || '') ? 'unconfirmed' : false;
      touchSession();
      // Profil et organisation lus EN MÊME TEMPS : la connexion enchaînait
      // trois allers-retours (identifiants, profil, organisation), soit une à
      // deux secondes de plus sur un réseau mobile.
      const orgEnCours = fetchMyOrg();
      const authUser = data.user || data.session?.user;
      const { profile: existant, injoignable } = await fetchProfile(authUser);
      if (injoignable && !existant) {
        const cache = lireProfilCache(authUser?.email || email.trim());
        if (cache) {
          await adoptProfile(cache, orgEnCours);
          return true;
        }
        return 'unavailable';
      }
      const profile = existant || (await provisionProfile(authUser));
      if (!profile) {
        // Compte Auth valide mais profil jamais créé (inscription interrompue,
        // autre navigateur…) : on garde la session et on laisse l'écran de
        // connexion proposer de terminer l'inscription.
        return 'incomplete';
      }
      // Profil tout juste créé : l'organisation aussi — la lecture lancée
      // avant sa création ne la connaissait pas, on la relit.
      await adoptProfile(profile, existant ? orgEnCours : null);
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
    if (error) return { ok: false, error: messageEnvoiEmail(error, 'inscription') || sanitizeSignupError(error.message) };
    // Si la confirmation d'email est activée, le profil sera créé au premier
    // login : on mémorise l'entreprise / le code (invitation, parrainage) en attendant.
    localStorage.setItem(PENDING_KEY, JSON.stringify({ email: email.trim(), name, phone: phone || '', companyName, inviteCode, refCode: refCode || null }));
    if (!data.session) return { ok: true, needsConfirmation: true };
    touchSession();
    const profile = await provisionProfile(data.user || data.session?.user);
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
      let resultat;
      if (inviteCode) {
        resultat = await supabase.rpc('signup_join_org', { p_invite_code: inviteCode, p_user_name: name, p_phone: phone || '' });
      } else {
        resultat = await supabase.rpc('signup_create_org', {
          p_org_name: companyName,
          p_user_name: name,
          // Code saisi dans le formulaire, sinon parrainage encore actif sur
          // l'appareil (lien ?ref= cliqué) : conservé même quand l'inscription
          // se termine à la connexion.
          p_ref_code: refCode || getActiveRef()?.code || null,
          p_phone: phone || '',
        });
      }
      if (resultat.error) return { ok: false, error: resultat.error.message };
    } catch (e) {
      return { ok: false, error: e.message };
    }
    const { data: { session } } = await supabase.auth.getSession();
    const profile = session?.user?.email ? (await fetchProfile(session.user)).profile : null;
    if (!profile) return { ok: false, error: 'Profil introuvable après création — réessayez.' };
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(OAUTH_CONTEXT_KEY);
    setPendingAuthUser(null);
    marquerGuideNouveauUtilisateur(profile.id);
    await adoptProfile(profile);
    return { ok: true };
  };

  /**
   * Confirme l'inscription avec le CODE reçu par e-mail, en plus du lien.
   * Le lien ouvre la session dans le navigateur qui le reçoit — souvent celui
   * du téléphone, ni l'application ni l'ordinateur de l'inscription. Le code
   * se tape ici, sur l'appareil où attendent l'entreprise et le code de
   * parrainage (PENDING_KEY). Sa longueur suit le réglage Supabase « Email
   * OTP Length » (6 chiffres par défaut, jusqu'à 10).
   * Retourne { ok, incomplete?, error? } ; `incomplete` : adresse confirmée,
   * profil à terminer à l'écran (inscription commencée sur un autre appareil).
   */
  const confirmerCodeInscription = async (email, code) => {
    if (!isSupabaseConfigured) return { ok: false, error: 'Backend non configuré.' };
    const token = String(code || '').replace(/\D/g, '');
    if (token.length < 6 || token.length > 10) return { ok: false, error: 'Saisissez le code à 6 chiffres reçu par e-mail.' };
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
    if (error || !data?.session) {
      return {
        ok: false,
        error: estCoupureReseauAuth(error)
          ? 'Pas de connexion Internet : le code n’a pas pu être vérifié. Réessayez dès le retour du réseau.'
          : 'Code incorrect ou expiré. Vérifiez le dernier e-mail reçu, ou demandez-en un nouveau.',
      };
    }
    touchSession();
    const orgEnCours = fetchMyOrg();
    const authUser = data.user || data.session.user;
    const { profile: existant, injoignable } = await fetchProfile(authUser);
    if (injoignable && !existant) {
      return { ok: false, error: 'Adresse confirmée, mais le serveur ne répond pas. Connectez-vous dans un instant avec votre mot de passe.' };
    }
    const profile = existant || (await provisionProfile(authUser));
    if (!profile) return { ok: true, incomplete: true };
    // Profil tout juste créé : l'organisation aussi, on la relit.
    await adoptProfile(profile, existant ? orgEnCours : null);
    return { ok: true };
  };

  /**
   * Renvoie l'e-mail de confirmation (nouveau lien, nouveau code). Supabase
   * limite les envois : un par minute et par adresse.
   */
  const renvoyerCodeInscription = async (email) => {
    if (!isSupabaseConfigured) return { ok: false, error: 'Backend non configuré.' };
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
    if (!error) return { ok: true };
    const envoi = messageEnvoiEmail(error, 'renvoi de la confirmation');
    if (envoi) return { ok: false, error: envoi };
    const attendre = error.status === 429 || /seconds|security purposes|rate limit/i.test(error.message || '');
    return {
      ok: false,
      error: attendre
        ? 'Un e-mail vient déjà de partir. Patientez une minute avant d’en demander un autre.'
        : 'Envoi impossible pour le moment. Réessayez dans un instant.',
    };
  };

  /** Envoie l'email de réinitialisation (le lien ramène vers l'app). */
  const resetPassword = async (email) => {
    if (!isSupabaseConfigured) return { ok: false };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    return { ok: !error, error: error ? messageEnvoiEmail(error, 'mot de passe oublié') || error.message : undefined };
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
        const profile = (await fetchProfile(session.user)).profile;
        if (profile) await adoptProfile(profile);
      }
    }
    return { ok: !error, error: error?.message };
  };

  // Renvoie la promesse de déconnexion serveur : qui recharge la page juste
  // après (suppression de compte) doit l'attendre, sinon la session survit.
  const logout = () => {
    const deconnexion = Promise.all([
      isSupabaseConfigured ? supabase.auth.signOut().catch(() => {}) : Promise.resolve(),
      signOutGoogleNative(),
    ]).then(() => {});
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
    return deconnexion;
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
    <AuthContext.Provider value={{ user, isLoading, login, signInWithGoogle, logout, signUp, confirmerCodeInscription, renvoyerCodeInscription, completeSignup, resetPassword, updatePassword, refreshOrg, recovery, pendingAuthUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
