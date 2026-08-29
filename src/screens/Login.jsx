import { useEffect, useRef, useState } from 'react';
import { Sun, Mail, Lock, Eye, EyeOff, KeyRound, UserPlus, ChevronLeft, ChevronDown, Handshake, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { getActiveRef } from '../utils/referral';
import { lireFormuleChoisie } from '../utils/formuleChoisie';
import { vueLogin } from '../utils/entree';
import { formule } from '../utils/subscription';
import { formatCFA } from '../utils/format';
import { users } from '../data/seed';
import { getLockState, registerFailedAttempt, clearAttempts, formatLockRemaining } from '../utils/loginThrottle';
import { AsYouType, getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js/min';

// Tous les pays sont disponibles. Togo et Bénin restent en tête : ce sont
// les marchés de départ, sans enfermer un installateur étranger.
const PRIORITY_COUNTRIES = ['TG', 'BJ'];
const countryNames = (() => {
  try {
    const french = new Intl.DisplayNames(['fr'], { type: 'region' });
    const english = new Intl.DisplayNames(['en'], { type: 'region' });
    return (code) => {
      const frenchName = french.of(code) || code;
      const englishName = english.of(code) || frenchName;
      // Le format reprend le modèle fourni : anglais suivi du nom français
      // lorsqu'ils diffèrent (Benin (Bénin), Senegal (Sénégal)…).
      if (code === 'CI') return 'Côte d’Ivoire (Ivory Coast)';
      return englishName === frenchName ? frenchName : `${englishName} (${frenchName})`;
    };
  } catch {
    return (code) => code;
  }
})();
const PHONE_COUNTRIES = getCountries()
  .map((code) => ({ code, dialCode: getCountryCallingCode(code), label: countryNames(code) }))
  .sort((a, b) => {
    const rank = (code) => {
      const index = PRIORITY_COUNTRIES.indexOf(code);
      return index === -1 ? PRIORITY_COUNTRIES.length : index;
    };
    const priority = rank(a.code) - rank(b.code);
    return priority || a.label.localeCompare(b.label, 'fr');
  });

function CountryFlag({ country }) {
  return (
    <img
      className="phone-country-flag"
      src={`https://flagcdn.com/w40/${country.toLowerCase()}.png`}
      width="20"
      height="15"
      alt=""
      aria-hidden="true"
    />
  );
}

function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
      <path fill="#4285f4" d="M21.6 12.23c0-.72-.06-1.26-.2-1.82H12v3.42h5.52a4.7 4.7 0 0 1-2.05 3.09v2.22h3.32c1.94-1.79 2.81-4.42 2.81-6.91Z" />
      <path fill="#34a853" d="M12 22c2.7 0 4.96-.89 6.61-2.42l-3.32-2.22c-.9.61-2.06.98-3.29.98-2.6 0-4.8-1.76-5.59-4.12H2.98v2.29A10 10 0 0 0 12 22Z" />
      <path fill="#fbbc05" d="M6.41 14.22A6.01 6.01 0 0 1 6.1 12c0-.77.13-1.52.31-2.22V7.49H2.98A10 10 0 0 0 2 12c0 1.61.39 3.13.98 4.51l3.43-2.29Z" />
      <path fill="#ea4335" d="M12 5.66c1.47 0 2.79.51 3.82 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-9.02 5.49l3.43 2.29C7.2 7.42 9.4 5.66 12 5.66Z" />
    </svg>
  );
}

/**
 * Écran d'entrée : connexion, et — quand le backend est configuré —
 * inscription self-service (créer son entreprise ou rejoindre une équipe
 * avec un code d'invitation), mot de passe oublié et réinitialisation.
 * En mode local (sans backend), seul le formulaire de connexion est monté.
 *
 * `vueInitiale` impose la vue : « signup » pour la route /inscription, où
 * mènent les appels à l'action de la page d'accueil, « login » pour
 * /connexion. Sans elle, c'est un code partenaire ou d'invitation qui décide
 * (voir `utils/entree.js`, `vueLogin`).
 */
export default function Login({ vueInitiale = null }) {
  const { login, signInWithGoogle, signUp, completeSignup, resetPassword, updatePassword, recovery, pendingAuthUser } = useAuth();
  // Lien de parrainage (?ref=BESTA-XXX) actif sur cet appareil : on ouvre
  // directement l'inscription, code partenaire prérempli.
  const [refCode, setRefCode] = useState(() => (isSupabaseConfigured ? getActiveRef()?.code || '' : ''));
  // Venu par un lien partenaire (le champ est alors prérempli, hint adapté).
  const [refFromLink] = useState(() => refCode !== '');
  // Lien d'invitation d'équipe (?equipe=CODE) partagé par un gérant : la même
  // page d'inscription rattache silencieusement le compte à son équipe.
  const [teamCode, setTeamCode] = useState(() => {
    try { return (new URLSearchParams(window.location.search).get('equipe') || '').trim().toUpperCase(); } catch { return ''; }
  });
  // Formule retenue sur la page d'accueil : annoncée ici pour que la suite ne
  // surprenne pas — le paiement arrive juste après la création du compte.
  const [formuleChoisie] = useState(() => lireFormuleChoisie());
  const [view, setView] = useState(() => vueLogin({ vueDemandee: vueInitiale, refCode, teamCode })); // login | signup | forgot | complete
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const countryMenuRef = useRef(null);

  useEffect(() => {
    const closeCountryMenu = (event) => {
      if (!countryMenuRef.current?.contains(event.target)) setCountryMenuOpen(false);
    };
    document.addEventListener('mousedown', closeCountryMenu);
    return () => document.removeEventListener('mousedown', closeCountryMenu);
  }, []);

  // Inscription (une seule page simple : nom, téléphone, email, mot de passe)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(''); // numéro national, formaté au fil de la saisie
  const [phoneCountry, setPhoneCountry] = useState('TG');
  const nationalPhoneDigits = () => phone.replace(/\D/g, '');
  const fullPhone = () => {
    // Le plan de numérotation béninois est passé à 10 chiffres en 2024.
    // On ne s'appuie pas sur des métadonnées de bibliothèque éventuellement
    // anciennes pour enregistrer un numéro Bénin pourtant valide.
    if (phoneCountry === 'BJ') return nationalPhoneDigits() ? `+229${nationalPhoneDigits()}` : '';
    return parsePhoneNumberFromString(phone, phoneCountry)?.number || '';
  };
  const selectedPhoneCountry = PHONE_COUNTRIES.find((country) => country.code === phoneCountry) || PHONE_COUNTRIES[0];
  const phoneError = () => {
    const digits = nationalPhoneDigits();
    // ARCEP Bénin : le plan national est à 10 chiffres depuis le 30 novembre 2024.
    // Cette règle est volontairement vérifiée avant libphonenumber-js, dont
    // certaines versions continuent de connaître l'ancien format à 8 chiffres.
    if (phoneCountry === 'BJ') {
      return digits.length === 10 ? '' : 'Au Bénin, le numéro doit comporter exactement 10 chiffres.';
    }
    const parsed = parsePhoneNumberFromString(phone, phoneCountry);
    if (!parsed || !isValidPhoneNumber(phone, phoneCountry)) return 'Saisissez un numéro valide pour le pays sélectionné.';
    return '';
  };

  // Premier retour Google : l'email est déjà vérifié par Google, mais Bestaapp
  // demande encore les données métier nécessaires à la création du profil.
  useEffect(() => {
    if (!pendingAuthUser) return;
    setView('complete');
    setEmail(pendingAuthUser.email || '');
    setName((current) => current || pendingAuthUser.name || '');
    if (pendingAuthUser.inviteCode) setTeamCode(pendingAuthUser.inviteCode);
    if (pendingAuthUser.refCode) setRefCode(pendingAuthUser.refCode);
  }, [pendingAuthUser]);

  const switchView = (v) => { setView(v); setError(''); setNotice(''); };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    const res = await signInWithGoogle({
      inviteCode: teamCode || null,
      refCode: teamCode ? null : refCode.trim() || null,
    });
    if (!res.ok) {
      setLoading(false);
      setError(res.error || 'Connexion avec Google impossible.');
    }
  };

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

  const googleAccess = import.meta.env.VITE_ENABLE_GOOGLE_AUTH === 'true' && isSupabaseConfigured && (
    <>
      <button type="button" className="btn btn-google btn-block btn-lg" onClick={handleGoogle} disabled={loading}>
        <GoogleIcon /> {loading ? 'Ouverture de Google…' : 'Continuer avec Google'}
      </button>
      <div className="login-divider"><span>ou avec votre email</span></div>
    </>
  );

  const phoneField = (idPrefix) => (
    <div className="input-group">
      <label className="input-label" htmlFor={`${idPrefix}-phone`}>Numéro de téléphone</label>
      <div className="phone-field">
        <div className="phone-field-country-wrap" ref={countryMenuRef}>
          <button
            type="button"
            className="phone-field-country-trigger"
            aria-label={`Pays : ${selectedPhoneCountry.label}, +${selectedPhoneCountry.dialCode}`}
            aria-expanded={countryMenuOpen}
            aria-haspopup="listbox"
            aria-controls={`${idPrefix}-country-options`}
            onClick={() => setCountryMenuOpen((open) => !open)}
          >
            <CountryFlag country={selectedPhoneCountry.code} />
            <span>+{selectedPhoneCountry.dialCode}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          {countryMenuOpen && (
            <div id={`${idPrefix}-country-options`} className="phone-field-country-menu" role="listbox" aria-label="Choisir un pays">
              {PHONE_COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  className="phone-field-country-option"
                  role="option"
                  aria-selected={c.code === phoneCountry}
                  onClick={() => { setPhoneCountry(c.code); setCountryMenuOpen(false); }}
                >
                  <CountryFlag country={c.code} />
                  <span className="phone-field-country-name">{c.label}</span>
                  <span className="phone-field-country-code">+{c.dialCode}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          id={`${idPrefix}-phone`}
          className="input"
          type="tel"
          required
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(new AsYouType(phoneCountry).input(e.target.value))}
          placeholder={phoneCountry === 'BJ' ? '10 chiffres, sans l’indicatif' : 'Numéro sans l’indicatif'}
          autoComplete="tel-national"
        />
      </div>
      {phoneCountry === 'BJ' && <div className="field-hint">Bénin : saisissez exactement 10 chiffres, sans +229.</div>}
    </div>
  );

  return (
    <div className="login-screen">
      <div className="login-left">
        <div className="login-panel">
          <div className="login-header">
            <div className="logo-icon"><Sun size={22} /></div>
            <div>
              <h1 className="login-title">BestaSolar Pro</h1>
              <p className="login-subtitle">CRM solaire — Lomé, Togo</p>
            </div>
          </div>

          {/* Lien « mot de passe oublié » cliqué : définir le nouveau mot de passe. */}
          {recovery ? (
            <form className="login-form" onSubmit={handleRecovery}>
              <h2 className="login-form-title">Nouveau mot de passe</h2>
              {error && <div className="login-error">{error}</div>}
              {passwordField('Choisissez un nouveau mot de passe', 'new-password')}
              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
                {loading ? 'Enregistrement…' : 'Enregistrer et continuer'}
              </button>
            </form>
          ) : view === 'complete' && isSupabaseConfigured ? (
            <form className="login-form" onSubmit={handleComplete}>
              <h2 className="login-form-title">Terminer l'inscription</h2>
              <p className="text-sm text-secondary" style={{ marginBottom: 14 }}>
                {pendingAuthUser
                  ? `Compte Google ${pendingAuthUser.email} — complétez votre profil :`
                  : 'Votre compte existe — une dernière étape :'}
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
            <form className="login-form" onSubmit={handleSignup}>
              <h2 className="login-form-title">Créer un compte</h2>
              {error && <div className="login-error">{error}</div>}
              {googleAccess}
              {teamCode && (
                <div className="login-notice">
                  <UserPlus size={14} style={{ verticalAlign: -2, marginRight: 5 }} />
                  Vous rejoignez une équipe (invitation {teamCode}).
                </div>
              )}
              {formuleChoisie && (
                <div className="login-notice">
                  <Crown size={14} style={{ verticalAlign: -2, marginRight: 5 }} />
                  Formule <strong>{formule(formuleChoisie).libelle}</strong> — {formatCFA(formule(formuleChoisie).prix)} / {formule(formuleChoisie).periode}.
                  Le paiement vous sera proposé juste après la création du compte.
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
              <button type="button" className="login-link" onClick={() => switchView('login')}>
                <ChevronLeft size={14} /> J'ai déjà un compte — me connecter
              </button>
            </form>
          ) : view === 'forgot' && isSupabaseConfigured ? (
            <form className="login-form" onSubmit={handleForgot}>
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
            <form className="login-form" onSubmit={handleSubmit}>
              <h2 className="login-form-title">Connexion</h2>
              {notice && <div className="login-notice">{notice}</div>}
              {error && <div className="login-error">{error}</div>}
              {googleAccess}
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
      {/* Volet de marque : purement illustratif, masqué sur mobile (voir CSS). */}
      <div className="login-right" aria-hidden="true">
        <div className="login-right-content">
          <h2 className="login-right-title">Le CRM solaire qui va plus loin</h2>
          <p className="login-right-text">
            Pipeline commercial, devis en quelques minutes, boutique et commissions
            partenaires — avec un outil de dimensionnement exceptionnel qui calcule
            puissance, batterie et onduleur, puis génère une fiche complète prête à
            partager.
          </p>
        </div>
      </div>
    </div>
  );
}
