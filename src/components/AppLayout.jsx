import { Suspense } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import ChunkErrorBoundary from './ChunkErrorBoundary';
import { LayoutDashboard, FolderKanban, ShoppingCart, FileText, MoreHorizontal, Sun, LogOut, Crown, ArrowLeft, Users, Building2, CreditCard, DollarSign, DatabaseBackup, GraduationCap, Share2, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useMode } from '../context/ModeContext';
import { SyncDot } from './SyncStatus';

const publicNavItems = [
  { path: '/dashboard', label: 'Tableau de bord', shortLabel: 'Tableau', icon: LayoutDashboard },
  { path: '/pipeline', label: 'Suivi clients', shortLabel: 'Suivi', icon: FolderKanban },
  { path: '/boutique', label: 'Boutique', shortLabel: 'Boutique', icon: ShoppingCart },
  { path: '/devis', label: 'Devis', shortLabel: 'Devis', icon: FileText },
  { path: '/plus', label: 'Plus', shortLabel: 'Plus', icon: MoreHorizontal },
];

// Répertoire clients (ajout + carnet d'adresses) : dans la barre latérale
// après le suivi ; sur mobile, accessible depuis le menu « Plus ».
const clientsItem = { path: '/clients', label: 'Clients', icon: Users };

const proNavItems = [
  { path: '/pro', label: 'Tableau de bord', shortLabel: 'Tableau', icon: LayoutDashboard },
  { path: '/pro/documents', label: 'Devis & Factures', shortLabel: 'Devis', icon: FileText },
  { path: '/pro/clients', label: 'Clients', shortLabel: 'Clients', icon: Users },
  { path: '/pro/entreprise', label: 'Mon entreprise', shortLabel: 'Société', icon: Building2 },
  { path: '/pro/abonnement', label: 'Mon abonnement', shortLabel: 'Abo', icon: CreditCard },
];

// Sous-sections de « Plus » remontées dans la barre latérale (desktop), par rôle.
// « Mon profil » est rendu à part, en dernier, après le bouton « Passer en mode Pro ».
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
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { getCompanyForUser } = useData();
  const { mode, setMode, proActive } = useMode();
  const navigate = useNavigate();
  const isPro = mode === 'pro';
  const navItems = isPro ? proNavItems : publicNavItems;
  // Barre latérale publique : « Plus » n'y figure pas (toutes ses entrées y
  // sont détaillées) — il reste dans la barre d'onglets mobile.
  const sidebarItems = isPro
    ? proNavItems
    : publicNavItems
        .filter((i) => i.path !== '/plus')
        .flatMap((i) => (i.path === '/pipeline' ? [i, clientsItem] : [i]));
  // Bascule Pro depuis la barre latérale : abonné → espace Pro direct ;
  // sinon → parcours d'abonnement (le formulaire vit sur l'écran Plus).
  const goPro = () => (proActive ? setMode('pro') : navigate('/plus/gopro'));
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
        <nav className="sidebar-nav" aria-label="Navigation principale">
          {sidebarItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/pro'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <item.icon size={20} strokeWidth={2} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          {!isPro && (
            <>
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
              <button className="sidebar-link sidebar-pro-link" onClick={goPro}>
                <Crown size={20} strokeWidth={2} />
                <span>Passer en mode Pro</span>
              </button>
              <NavLink to="/plus/profile" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                <User size={20} strokeWidth={2} />
                <span>Mon profil</span>
              </NavLink>
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
      <nav className="tab-bar" aria-label="Navigation par onglets">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            // `end` seulement sur la racine Pro : « Plus » doit rester allumé
            // sur toutes ses sous-pages /plus/:section (sinon aucun onglet actif).
            end={item.path === '/pro'}
            className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={22} strokeWidth={2} />
            <span>{item.shortLabel}</span>
          </NavLink>
        ))}
        {isPro && (
          <button className="tab-item" onClick={() => setMode('public')} aria-label="Revenir au mode public">
            <ArrowLeft size={22} strokeWidth={2} />
            <span>Retour</span>
          </button>
        )}
      </nav>
    </div>
  );
}
