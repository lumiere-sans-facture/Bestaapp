import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, ShoppingCart, FileText, MoreHorizontal, Sun, LogOut, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';
import { SyncDot } from './SyncStatus';

const navItems = [
  { path: '/dashboard', label: 'Tableau de bord', shortLabel: 'Tableau', icon: LayoutDashboard },
  { path: '/pipeline', label: 'Suivi clients', shortLabel: 'Clients', icon: FolderKanban },
  { path: '/boutique', label: 'Boutique', shortLabel: 'Boutique', icon: ShoppingCart },
  { path: '/devis', label: 'Devis', shortLabel: 'Devis', icon: FileText },
  { path: '/plus', label: 'Plus', shortLabel: 'Plus', icon: MoreHorizontal },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { setMode, proActive } = useMode();

  return (
    <div className="app-shell">
      {/* Barre latérale — visible uniquement sur grand écran */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo"><Sun size={22} /></div>
          <div>
            <div className="sidebar-title">BestaSolar Pro</div>
            <div className="sidebar-subtitle">Parakou, Bénin</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <item.icon size={20} strokeWidth={2} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          {proActive && (
            <button className="btn btn-accent btn-block sidebar-pro-btn" onClick={() => setMode('pro')}>
              <Crown size={16} /> Mode Pro
            </button>
          )}
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{user.avatar}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.name} <SyncDot /></div>
              <div className="sidebar-user-role">{user.role === 'gerant' ? 'Gérant' : 'Technicien'}</div>
            </div>
            <button className="sidebar-logout" onClick={logout} title="Déconnexion" aria-label="Déconnexion">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <Outlet />
      </main>

      {/* Barre d'onglets — visible uniquement sur mobile */}
      <nav className="tab-bar">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={22} strokeWidth={2} />
            <span>{item.shortLabel}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
