import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import ChunkErrorBoundary from './ChunkErrorBoundary';
import { LayoutDashboard, FolderKanban, ShoppingCart, FileText, MoreHorizontal, Sun, LogOut, Crown, ArrowLeft, Users, Building2, CreditCard, DollarSign, DatabaseBackup, GraduationCap, Share2, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useMode } from '../context/ModeContext';
import { SyncDot } from './SyncStatus';

const publicNavItems = [
  { path: '/dashboard', label: 'Tableau de bord', shortLabel: 'Tableau', icon: LayoutDashboard },
  { path: '/pipeline', label: 'Suivi clients', shortLabel: 'Clients', icon: FolderKanban },
  { path: '/boutique', label: 'Boutique', shortLabel: 'Boutique', icon: ShoppingCart },
  { path: '/devis', label: 'Devis', shortLabel: 'Devis', icon: FileText },
  { path: '/plus', label: 'Plus', shortLabel: 'Plus', icon: MoreHorizontal },
];

const proNavItems = [
  { path: '/pro', label: 'Tableau de bord', shortLabel: 'Tableau', icon: LayoutDashboard },
  { path: '/pro/documents', label: 'Devis & Factures', shortLabel: 'Devis', icon: FileText },
  { path: '/pro/clients', label: 'Clients', shortLabel: 'Clients', icon: Users },
  { path: '/pro/entreprise', label: 'Mon entreprise', shortLabel: 'Société', icon: Building2 },
  { path: '/pro/abonnement', label: 'Mon abonnement', shortLabel: 'Abo', icon: CreditCard },
];

// Sous-sections de « Plus » remontées dans la barre latérale (desktop), par rôle.
const plusSections = (role) => [
  ...(role === 'gerant' ? [
    { path: '/plus/team', label: 'Équipe', icon: Users },
    { path: '/plus/partners', label: 'Partenaires', icon: Share2 },
    { path: '/plus/orders', label: 'Commandes en ligne', icon: ShoppingCart },
    { path: '/plus/commissions', label: 'Commissions', icon: DollarSign },
    { path: '/plus/subsadmin', label: 'Abonnements Pro', icon: Crown },
    { path: '/plus/backup', label: 'Sauvegarde', icon: DatabaseBackup },
  ] : []),
  { path: '/plus/formation', label: 'Formation', icon: GraduationCap },
  { path: '/plus/mypartner', label: 'Mon espace partenaire', icon: Users },
  { path: '/plus/profile', label: 'Mon profil', icon: User },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { getCompanyForUser } = useData();
  const { mode, setMode } = useMode();
  const isPro = mode === 'pro';
  const navItems = isPro ? proNavItems : publicNavItems;
  // En mode Pro, la marque affichée est celle de l'entreprise de l'abonné
  // (logo + nom configurés dans « Mon entreprise ») — repli sur la couronne.
  const company = isPro ? getCompanyForUser(user.id) : null;

  return (
    <div className="app-shell">
      {/* Barre latérale — visible uniquement sur grand écran */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            {isPro
              ? (company?.logo
                ? <img src={company.logo} alt={`Logo ${company.nomEntreprise || 'entreprise'}`} />
                : <Crown size={22} />)
              : <Sun size={22} />}
          </div>
          <div>
            <div className="sidebar-title">{isPro ? (company?.nomEntreprise || 'Espace Pro') : 'BestaSolar Pro'}</div>
            <div className="sidebar-subtitle">{isPro ? 'Espace Pro' : 'Parakou, Bénin'}</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/pro' || item.path === '/plus'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <item.icon size={20} strokeWidth={2} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          {!isPro && (
            <>
              <div className="sidebar-group-label">Plus</div>
              {plusSections(user.role).map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <item.icon size={20} strokeWidth={2} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          {isPro && (
            <button className="btn btn-accent btn-block sidebar-pro-btn" onClick={() => setMode('public')}>
              <ArrowLeft size={16} /> Revenir au mode public
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
        <ChunkErrorBoundary>
          <Suspense fallback={<div className="splash-screen">Chargement…</div>}>
            <Outlet />
          </Suspense>
        </ChunkErrorBoundary>
      </main>

      {/* Barre d'onglets — visible uniquement sur mobile */}
      <nav className="tab-bar">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/pro' || item.path === '/plus'}
            className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={22} strokeWidth={2} />
            <span>{item.shortLabel}</span>
          </NavLink>
        ))}
        {isPro && (
          <button className="tab-item" onClick={() => setMode('public')}>
            <ArrowLeft size={22} strokeWidth={2} />
            <span>Retour</span>
          </button>
        )}
      </nav>
    </div>
  );
}
