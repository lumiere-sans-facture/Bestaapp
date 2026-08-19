import { useState } from 'react';
import { Sun, Mail, Lock, Eye, EyeOff, KeyRound, UserPlus, ChevronLeft, Handshake } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { getActiveRef } from '../utils/referral';
import { users } from '../data/seed';
import { getLockState, registerFailedAttempt, clearAttempts, formatLockRemaining } from '../utils/loginThrottle';
import { AsYouType, getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js/min';

// Tous les pays sont disponibles. Togo et Bénin restent en tête : ce sont
// les marchés de départ, sans enfermer un installateur étranger.
const PRIORITY_COUNTRIES = ['TG', 'BJ'];
const countryName = (() => {
  try {
    const labels = new Intl.DisplayNames(['fr'], { type: 'region' });
    return (code) => labels.of(code) || code;
  } catch {
    return (code) => code;
  }
})();
const PHONE_COUNTRIES = getCountries()
  .map((code) => ({ code, dialCode: getCountryCallingCode(code), label: countryName(code) }))
  .sort((a, b) => {
    const rank = (code) => {
      const index = PRIORITY_COUNTRIES.indexOf(code);
      return index === -1 ? PRIORITY_COUNTRIES.length : index;
    };
    const priority = rank(a.code) - rank(b.code);
    return priority || a.label.localeCompare(b.label, 'fr');
  });

/**
 * Écran d'entrée : connexion, et — quand le backend est configuré —
 * inscription self-service (créer son entreprise ou rejoindre une équipe
 * avec un code d'invitation), mot de passe oublié et réinitialisation.
 * En mode local (sans backend), seul le formulaire de connexion est monté.
 */
export default function Login() {
  const { login, signUp, completeSignup, resetPassword, updatePassword, recovery } = useAuth();
  // Lien de parrainage (?ref=BESTA-XXX) actif sur cet appareil : on ouvre
  // directement l'inscription, code partenaire prérempli.
  const [refCode, setRefCode] = useState(() => (isSupabaseConfigured ? getActiveRef()?.code || '' : ''));
  // Venu par un lien partenaire (le champ est alors prérempli, hint adapté).
  const [refFromLink] = useState(() => refCode !== '');
  // Lien d'invitation d'équipe (?equipe=CODE) partagé par un gérant : la même
  // page d'inscription rattache silencieusement le compte à son équipe.
  const [teamCode] = useState(() => {
    try { return (new URLSearchParams(window.location.search).get('equipe') || '').trim().toUpperCase(); } catch { return ''; }
  });
  const [view, setView] = useState(refCode || teamCode ? 'signup' : 'login'); // login | signup | forgot | complete
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  // Inscription (une seule page simple : nom, téléphone, email, mot de passe)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(''); // numéro national, formaté au fil de la saisie
  const [phoneCountry, setPhoneCountry] = useState('TG');
  const fullPhone = () => parsePhoneNumberFromString(phone, phoneCountry)?.number || '';
  const phoneError = () => {
    const parsed = parsePhoneNumberFromString(phone, phoneCountry);
    if (!parsed || !isValidPhoneNumber(phone, phoneCountry)) return 'Saisissez un numéro valide pour le pays sélectionné.';
    // ARCEP Bénin : le plan national est à 10 chiffres depuis le 30 novembre 2024.
    if (phoneCountry === 'BJ' && parsed.nationalNumber.length !== 10) return 'Au Bénin, le numéro doit comporter 10 chiffres.';
    return '';
  };

  const switchView = (v) => { setView(v); setError(''); setNotice(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    // Frein anti-brute-force côté écran (défense en profondeur — la limite
    // qui compte vraiment est côté serveur, voir supabase/DEPLOIEMENT.md § 3).
    const lock = getLockState(email);
    if (lock.locked) {
      setError(`Trop de tentatives. Réessayez dans ${formatLockRemaining(lock.remainingMs)}.`);
      return;
    }
    setLoading(true);
    const ok = await login(email, password);
    if (ok === 'incomplete') {
      // Compte valide mais inscription jamais terminée (profil absent) :
      // on propose de la finir ici, sans repasser par la création de compte.
      clearAttempts(email);
      setLoading(false);
      switchView('complete');
      return;
    }
    if (!ok) {
      const newLock = registerFailedAttempt(email);
      setError(newLock.locked
        ? `Trop de tentatives. Réessayez dans ${formatLockRemaining(newLock.remainingMs)}.`
        : 'Email ou mot de passe incorrect');
      setLoading(false);
      return;
    }
    clearAttempts(email);
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    setError('');
    const phoneProblem = phoneError();
    if (phoneProblem) {
      setError(phoneProblem);
      return;
    }
    setLoading(true);
    const res = await completeSignup({ name, phone: fullPhone(), inviteCode: teamCode || null, refCode: teamCode ? null : refCode.trim() || null });
    setLoading(false);
    if (!res.ok) setError(res.error || 'Impossible de terminer l’inscription.');
    // Succès : l'app monte toute seule (profil chargé).
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Le mot de passe doit faire au moins 8 caractères.'); return; }
    const phoneProblem = phoneError();
    if (phoneProblem) {
      setError(phoneProblem);
      return;
    }
    setLoading(true);
    const res = await signUp({
      email, password, name, phone: fullPhone(),
      inviteCode: teamCode || null,
      refCode: teamCode ? null : refCode.trim() || null,
    });
    setLoading(false);
    if (!res.ok) { setError(res.error || 'Inscription impossible.'); return; }
    if (res.needsConfirmation) {
      // Formulation volontairement double : Supabase renvoie ce même succès
      // que l'email soit neuf ou déjà pris (anti-énumération des comptes,
      // voir AuthContext.sanitizeSignupError) — impossible de savoir lequel
      // s'est produit, donc le message couvre les deux sans jamais trancher.
      setNotice('Si cette adresse est nouvelle, un e-mail de confirmation vient d’être envoyé. Si vous avez déjà un compte, connectez-vous directement ou utilisez « Mot de passe oublié ».');
      setView('login');
    }
    // Sinon : la session est ouverte, l'app monte toute seule.
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await resetPassword(email);
    setLoading(false);
    if (!res.ok) { setError(res.error || 'Envoi impossible.'); return; }
    setNotice('Email envoyé ! Cliquez sur le lien reçu pour choisir un nouveau mot de passe.');
    setView('login');
  };

  const handleRecovery = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Le mot de passe doit faire au moins 8 caractères.'); return; }
    setLoading(true);
    const res = await updatePassword(password);
    setLoading(false);
    if (!res.ok) setError(res.error || 'Impossible de changer le mot de passe.');
  };

  const handleQuickLogin = (role) => {
    const demo = users.find((u) => u.role === role);
    if (demo) {
      setEmail(demo.email);
      setPassword(demo.password);
      setError('');
    }
  };

  const emailField = (
    <div className="input-group">
      <label className="input-label" htmlFor="login-email">Email</label>
      <div className="input-with-icon">
        <Mail className="input-icon" size={18} />
        <input
          id="login-email"
          type="email"
          className="input input-has-icon"
          placeholder="votre@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
      </div>
    </div>
  );

  const passwordField = (label = 'Mot de passe', autoComplete = 'current-password') => (
    <div className="input-group">
      <label className="input-label" htmlFor="login-password">{label}</label>
      <div className="input-with-icon">
        <Lock className="input-icon" size={18} />
        <input
          id="login-password"
          type={showPassword ? 'text' : 'password'}
          className="input input-has-icon"
          placeholder="••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          className="input-password-toggle"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );

  const phoneField = (idPrefix) => (
    <div className="input-group">
      <label className="input-label" htmlFor={`${idPrefix}-phone`}>Numéro de téléphone</label>
      <div className="phone-field">
        <select
          className="input phone-field-country"
          aria-label="Pays"
          value={phoneCountry}
          onChange={(e) => setPhoneCountry(e.target.value)}
        >
          {PHONE_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
        <input
          id={`${idPrefix}-phone`}
          className="input"
          type="tel"
          required
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(new AsYouType(phoneCountry).input(e.target.value))}
          placeholder="Numéro sans l’indicatif"
          autoComplete="tel-national"
        />
      </div>
    </div>
  );

  return (
    <div className="login-screen">
      <div className="login-panel">
        <div className="login-header">
          <div className="logo-icon"><Sun size={32} /></div>
          <h1 className="login-title">BestaSolar Pro</h1>
          <p className="login-subtitle">CRM solaire — Lomé, Togo</p>
        </div>

        {/* Lien « mot de passe oublié » cliqué : définir le nouveau mot de passe. */}
        {recovery ? (
          <form className="login-form card" onSubmit={handleRecovery}>
            <h2 className="login-form-title">Nouveau mot de passe</h2>
            {error && <div className="login-error">{error}</div>}
            {passwordField('Choisissez un nouveau mot de passe', 'new-password')}
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? 'Enregistrement…' : 'Enregistrer et continuer'}
            </button>
          </form>
        ) : view === 'complete' && isSupabaseConfigured ? (
          <form className="login-form card" onSubmit={handleComplete}>
            <h2 className="login-form-title">Terminer l'inscription</h2>
            <p className="text-sm text-secondary" style={{ marginBottom: 14 }}>
              Votre compte existe — une dernière étape :
            </p>
            {error && <div className="login-error">{error}</div>}
            <div className="input-group">
              <label className="input-label" htmlFor="complete-name">Votre nom complet</label>
              <input id="complete-name" className="input" required value={name}
                onChange={(e) => setName(e.target.value)} placeholder="Prénom et nom" />
            </div>
            {phoneField('complete')}
            {!teamCode && (
              <div className="input-group">
                <label className="input-label" htmlFor="complete-ref"><Handshake size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Code partenaire (facultatif)</label>
                <input id="complete-ref" className="input" value={refCode}
                  onChange={(e) => setRefCode(e.target.value.toUpperCase())} placeholder="BESTA-…" />
              </div>
            )}
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? 'Finalisation…' : "Terminer et entrer dans l'app"}
            </button>
          </form>
        ) : view === 'signup' && isSupabaseConfigured ? (
          <form className="login-form card" onSubmit={handleSignup}>
            <h2 className="login-form-title">Créer un compte</h2>
            {error && <div className="login-error">{error}</div>}
            {teamCode && (
              <div className="login-notice">
                <UserPlus size={14} style={{ verticalAlign: -2, marginRight: 5 }} />
                Vous rejoignez une équipe (invitation {teamCode}).
              </div>
            )}
            <div className="input-group">
              <label className="input-label" htmlFor="signup-name">Votre nom complet</label>
              <input id="signup-name" className="input" required value={name}
                onChange={(e) => setName(e.target.value)} placeholder="Prénom et nom" />
            </div>
            {phoneField('signup')}
            {emailField}
            {passwordField('Mot de passe (8 caractères min.)', 'new-password')}
            {!teamCode && (
              <div className="input-group">
                <label className="input-label" htmlFor="signup-ref"><Handshake size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Code partenaire (facultatif)</label>
                <input id="signup-ref" className="input" value={refCode}
                  onChange={(e) => setRefCode(e.target.value.toUpperCase())} placeholder="BESTA-…" />
                <div className="field-hint">
                  {refFromLink
                    ? "Vous arrivez par le lien d'un partenaire BestaSolar — son code est prérempli."
                    : 'Un partenaire BestaSolar vous a recommandé l’app ? Saisissez son code — sinon laissez vide (attribuable une seule fois plus tard, dans Plus → Parrainage).'}
                </div>
              </div>
            )}
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? 'Création…' : 'Créer mon compte'}
            </button>
            {!teamCode && (
              <div className="field-hint" style={{ textAlign: 'center' }}>
                Gratuit : tableau de bord, suivi clients, boutique, formations, espace partenaire.
                L'option Devis Pro (documents à votre identité) : 5 000 F/mois.
              </div>
            )}
            <button type="button" className="login-link" onClick={() => switchView('login')}>
              <ChevronLeft size={14} /> J'ai déjà un compte — me connecter
            </button>
          </form>
        ) : view === 'forgot' && isSupabaseConfigured ? (
          <form className="login-form card" onSubmit={handleForgot}>
            <h2 className="login-form-title">Mot de passe oublié</h2>
            {error && <div className="login-error">{error}</div>}
            <p className="text-sm text-secondary" style={{ marginBottom: 14 }}>
              Saisissez votre email : vous recevrez un lien pour choisir un nouveau mot de passe.
            </p>
            {emailField}
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              <KeyRound size={17} /> {loading ? 'Envoi…' : 'Envoyer le lien'}
            </button>
            <button type="button" className="login-link" onClick={() => switchView('login')}>
              <ChevronLeft size={14} /> Retour à la connexion
            </button>
          </form>
        ) : (
          <form className="login-form card" onSubmit={handleSubmit}>
            <h2 className="login-form-title">Connexion</h2>
            {notice && <div className="login-notice">{notice}</div>}
            {error && <div className="login-error">{error}</div>}
            {emailField}
            {passwordField()}
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
            {isSupabaseConfigured ? (
              <div className="login-links">
                <button type="button" className="login-link" onClick={() => switchView('forgot')}>Mot de passe oublié ?</button>
                <button type="button" className="login-link" onClick={() => switchView('signup')}>Créer un compte</button>
              </div>
            ) : (
              <div className="login-help">Mot de passe oublié ? Contactez votre gérant.</div>
            )}
            {/* Accès démo : outil de développement, jamais livré dans l'APK. */}
            {import.meta.env.DEV && !isSupabaseConfigured && (
              <>
                <div className="login-divider"><span>Accès démo</span></div>
                <div className="quick-login-buttons">
                  <button type="button" className="btn btn-outline" onClick={() => handleQuickLogin('gerant')}>Gérant</button>
                  <button type="button" className="btn btn-outline" onClick={() => handleQuickLogin('technicien')}>Technicien</button>
                </div>
              </>
            )}
          </form>
        )}
        {/* Version du build : diagnostic des appareils restés sur une vieille
            version en cache (doit correspondre au dernier déploiement). */}
        <div className="login-version">version {__APP_VERSION__} · {__APP_ENV__}</div>
      </div>
    </div>
  );
}
