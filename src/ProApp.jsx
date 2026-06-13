import { useMode } from './context/ModeContext';
import { useAuth } from './context/AuthContext';
import { Sun, ArrowLeft, LogOut } from 'lucide-react';

// Espace Pro — coquille dédiée rendue EXCLUSIVEMENT lorsque mode === 'pro'.
// Aucune route ni composant de l'app publique n'est monté ici : zéro fuite
// de données (suivi clients, devis publics…) entre les deux vues.
// Étape 2 : version minimale, juste de quoi prouver la bascule exclusive.
// Le contenu complet (Documents, Mon entreprise, Mon abonnement) arrive à l'étape 3.
export default function ProApp() {
  const { setMode } = useMode();
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <main className="app-main">
        <div style={{ padding: '24px', maxWidth: 720, margin: '0 auto' }}>
          <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div className="sidebar-logo"><Sun size={22} /></div>
            <div style={{ flex: 1 }}>
              <div className="sidebar-title">Espace Pro</div>
              <div className="sidebar-subtitle">{user.name}</div>
            </div>
            <button className="btn btn-secondary" onClick={() => setMode('public')}>
              <ArrowLeft size={18} /> Mode public
            </button>
            <button className="sidebar-logout" onClick={logout} title="Déconnexion" aria-label="Déconnexion">
              <LogOut size={18} />
            </button>
          </header>
          <div className="card" style={{ padding: 24 }}>
            <h2 style={{ marginTop: 0 }}>Bienvenue dans votre espace entreprise</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Cette vue est entièrement séparée du tableau de bord public. Le contenu
              complet (documents, informations de l'entreprise, abonnement) sera ajouté
              à l'étape suivante.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
