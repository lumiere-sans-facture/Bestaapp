import { useState } from 'react';
import { Sun, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { users } from '../data/seed';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    if (!login(email, password)) {
      setError('Email ou mot de passe incorrect');
      setLoading(false);
    }
  };

  const handleQuickLogin = (role) => {
    const demo = users.find((u) => u.role === role);
    if (demo) {
      setEmail(demo.email);
      setPassword(demo.password);
      setError('');
    }
  };

  return (
    <div className="login-screen">
      <div className="login-panel">
        <div className="login-header">
          <div className="logo-icon"><Sun size={32} /></div>
          <h1 className="login-title">BestaSolar Pro</h1>
          <p className="login-subtitle">CRM solaire — Parakou, Bénin</p>
        </div>
        <form className="login-form card" onSubmit={handleSubmit}>
          <h2 className="login-form-title">Connexion</h2>
          {error && <div className="login-error">{error}</div>}
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
          <div className="input-group">
            <label className="input-label" htmlFor="login-password">Mot de passe</label>
            <div className="input-with-icon">
              <Lock className="input-icon" size={18} />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="input input-has-icon"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
          <div className="login-divider"><span>Accès démo</span></div>
          <div className="quick-login-buttons">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => handleQuickLogin('gerant')}>Gérant</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => handleQuickLogin('technicien')}>Technicien</button>
          </div>
        </form>
      </div>
    </div>
  );
}
