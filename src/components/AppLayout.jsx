import { Suspense, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import ChunkErrorBoundary from './ChunkErrorBoundary';
import { LayoutDashboard, FolderKanban, ShoppingCart, FileText, MoreHorizontal, Sun, LogOut, Crown, ArrowLeft, Users, Building2, CreditCard, DollarSign, DatabaseBackup, GraduationCap, Share2, User, ChevronDown } from 'lucide-react';
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

// Entrées d'apprentissage, à plat dans la barre (mode public).
const learnItems = [
  { path: '/plus/formation', label: 'Formation', icon: GraduationCap },
  { path: '/plus/mypartner', label: 'Espace partenaire', icon: Share2 },
];

// Gestion du gérant : regroupée dans un menu déroulant « Gestion » (façon Zervant).
const gerantMenu = [
  { path: '/plus/team', label: 'Équipe', icon: Users },
  { path: '/plus/partners', label: 'Partenaires', icon: Share2 },
  { path: '/plus/orders', label: 'Commandes en ligne', icon: ShoppingCart },
  { path: '/plus/commissions', label: 'Commissions', icon: DollarSign },
  { path: '/plus/subsadmin', label: 'Abonnements Pro', icon: Crown },
  { path: '/plus/backup', label: 'Sauvegarde', icon: DatabaseBackup },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { getCompanyForUser } = useData();
  const { mode, setMode, proActive } = useMode();
  const navigate = useNavigate();
  const isPro = mode === 'pro';
  const navItems = isPro ? proNavItems : publicNavItems;
  const [menuOpen, setMenuOpen] = useState(false);
  // En mode Pro, la marque affichée est celle de l'entreprise de l'abonné.
  const company = isPro ? getCompanyForUser(user.id) : null;

  // Bascule Pro : abonné → espace Pro direct ; sinon → parcours d'abonnement.
  const goPro = () => (proActive ? setMode('pro') : navigate('/plus/gopro'));

  const TopLink = ({ path, label, end = false }) => (
    <NavLink to={path} end={end} className={({ isActive }) => `topbar-link ${isActive ? 'active' : ''}`}>
      {label}
    </NavLink>
  );

  return (
    <div className="app-shell">
      {/* Barre de navigation horizontale — grand écran (style Zervant) */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-logo">
            {isPro
              ? (company?.logo
                ? <img src={company.logo} alt={`Logo ${company.nomEntreprise || 'entreprise'}`} />
                : <Crown size={17} />)
              : <Sun size={17} />}
          </div>
          <span className="topbar-title">{isPro ? (company?.nomEntreprise || 'Espace Pro') : 'BestaSolar Pro'}</span>
        </div>

        <nav className="topbar-nav">
          {(isPro ? proNavItems : publicNavItems.filter((i) => i.path !== '/plus')).map((item) => (
            <TopLink key={item.path} path={item.path} label={item.label} end={item.path === '/pro'} />
          ))}
          {!isPro && learnItems.map((item) => <TopLink key={item.path} path={item.path} label={item.label} />)}
          {!isPro && user.role === 'gerant' && (
            <div className="topbar-menu" onMouseLeave={() => setMenuOpen(false)}>
              <button className={`topbar-link topbar-menu-btn ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen((o) => !o)}>
                Gestion <ChevronDown size={14} />
              </button>
              {menuOpen && (
                <div className="topbar-dropdown">
                  {gerantMenu.map((item) => (
                    <NavLink key={item.path} to={item.path} className="topbar-dropdown-item" onClick={() => setMenuOpen(false)}>
                      <item.icon size={16} /> {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="topbar-right">
          {isPro ? (
            <button className="topbar-link topbar-pro" onClick={() => setMode('public')}>
              <ArrowLeft size={15} /> Mode public
            </button>
          ) : (
            <button className="topbar-link topbar-pro" onClick={goPro}>
              <Crown size={15} /> Passer en mode Pro
            </button>
          )}
          {!isPro && (
            <NavLink to="/plus/profile" className={({ isActive }) => `topbar-link ${isActive ? 'active' : ''}`}>
              <User size={15} /> Mon profil
            </NavLink>
          )}
          <div className="topbar-user" title={user.role === 'gerant' ? 'Gérant' : 'Technicien'}>
            <div className="topbar-avatar">{user.avatar}</div>
            <SyncDot />
          </div>
          <button className="topbar-logout" onClick={logout} title="Déconnexion" aria-label="Déconnexion">
            <LogOut size={17} />
          </button>
        </div>
      </header>

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
