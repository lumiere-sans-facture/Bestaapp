import { useState } from 'react';
import { Sun, Mail, Lock, Eye, EyeOff, Building2, KeyRound, UserPlus, ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { users } from '../data/seed';

/**
 * Écran d'entrée : connexion, et — quand le backend est configuré —
 * inscription self-service (créer son entreprise ou rejoindre une équipe
 * avec un code d'invitation), mot de passe oublié et réinitialisation.
 * En mode local (sans backend), seul le formulaire de connexion est monté.
 */
export default function Login() {
  const { login, signUp, resetPassword, updatePassword, recovery } = useAuth();
  const [view, setView] = useState('login'); // login | signup | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  // Inscription
  const [signupMode, setSignupMode] = useState('create'); // create | join
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const switchView = (v) => { setView(v); setError(''); setNotice(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const ok = await login(email, password);
    if (!ok) {
      setError('Email ou mot de passe incorrect');
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Le mot de passe doit faire au moins 8 caractères.'); return; }
    setLoading(true);
    const res = await signUp({
      email, password, name,
      companyName: signupMode === 'create' ? companyName : null,
      inviteCode: signupMode === 'join' ? inviteCode : null,
    });
    setLoading(false);
    if (!res.ok) { setError(res.error || 'Inscription impossible.'); return; }
    if (res.needsConfirmation) {
      setNotice('Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.');
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

  return (
    <div className="login-screen">
      <div className="login-panel">
        <div className="login-header">
          <div className="logo-icon"><Sun size={32} /></div>
          <h1 className="login-title">BestaSolar Pro</h1>
          <p className="login-subtitle">CRM solaire — Parakou, Bénin</p>
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
        ) : view === 'signup' && isSupabaseConfigured ? (
          <form className="login-form card" onSubmit={handleSignup}>
            <h2 className="login-form-title">Créer un compte</h2>
            {error && <div className="login-error">{error}</div>}
            <div className="segmented" role="group" aria-label="Type d'inscription" style={{ marginBottom: 16 }}>
              <button type="button" className={`segmented-btn ${signupMode === 'create' ? 'active' : ''}`} onClick={() => setSignupMode('create')}>
                <Building2 size={15} /> Espace Devis Pro
              </button>
              <button type="button" className={`segmented-btn ${signupMode === 'join' ? 'active' : ''}`} onClick={() => setSignupMode('join')}>
                <UserPlus size={15} /> Rejoindre une équipe
              </button>
            </div>
            {signupMode === 'create' ? (
              <div className="input-group">
                <label className="input-label" htmlFor="signup-company">Nom de votre entreprise</label>
                <input id="signup-company" className="input" required value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)} placeholder="Ex : Fatou Solaire Services" />
                <div className="field-hint">Vos devis et factures à votre identité + dimensionnement solaire — 5 000 F/mois, activé après paiement.</div>
              </div>
            ) : (
              <div className="input-group">
                <label className="input-label" htmlFor="signup-code">Code d'invitation</label>
                <input id="signup-code" className="input" required value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())} placeholder="Code fourni par votre gérant" />
                <div className="field-hint">Votre gérant le trouve dans Plus → Équipe.</div>
              </div>
            )}
            <div className="input-group">
              <label className="input-label" htmlFor="signup-name">Votre nom complet</label>
              <input id="signup-name" className="input" required value={name}
                onChange={(e) => setName(e.target.value)} placeholder="Prénom et nom" />
            </div>
            {emailField}
            {passwordField('Mot de passe (8 caractères min.)', 'new-password')}
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? 'Création…' : signupMode === 'create' ? 'Créer mon espace Devis Pro' : "Rejoindre l'équipe"}
            </button>
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
      </div>
    </div>
  );
}
