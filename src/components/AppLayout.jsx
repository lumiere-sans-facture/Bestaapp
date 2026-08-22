import { Suspense, useCallback, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import ChunkErrorBoundary from './ChunkErrorBoundary';
import AbonnementAlert from './AbonnementAlert';
import SkeletonPageContent from './SkeletonPageContent';
import { LayoutDashboard, FolderKanban, ShoppingCart, FileText, MoreHorizontal, LogOut, Crown, ArrowLeft, Users, Building2, CreditCard, DollarSign, GraduationCap, Share2, Settings, AlertTriangle, Package, Cpu, Droplets, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useMode } from '../context/ModeContext';
import { initials } from '../utils/format';
import { SyncDot } from './SyncStatus';
import NotificationBell from './NotificationBell';

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
  { path: '/pro/entreprise', label: 'Mon entreprise', shortLabel: 'Entreprise', icon: Building2 },
  { path: '/pro/abonnement', label: 'Mon abonnement', shortLabel: 'Abonnement', icon: CreditCard },
];

// Sous-sections de « Plus » remontées dans la barre latérale (desktop), par rôle.
// « Mon profil » est rendu à part, en dernier, après le bouton « Passer en mode Pro ».
// L'administration du SaaS n'est ouverte qu'à BestaSolar : le gérant d'une
// autre entreprise verrait sinon un lien que l'écran lui refuse.
// Ce qui se RÈGLE (profil, apparence, abonnement, moyens de paiement,
// sauvegarde, administration) n'est plus énuméré ici : tout est réuni sous
// « Paramètres », rendu en dernier. La barre latérale ne liste donc que le
// travail quotidien.
const plusSections = (user) => [
  ...(user.role === 'gerant' ? [
    { path: '/plus/team', label: 'Équipe', icon: Users },
    { path: '/plus/partners', label: 'Partenaires', icon: Share2 },
    { path: '/plus/orders', label: 'Commandes en ligne', icon: ShoppingCart },
    { path: '/plus/commissions', label: 'Commissions', icon: DollarSign },
    { path: '/plus/kits', label: 'Mes kits', icon: Package },
    { path: '/plus/inverters', label: 'Onduleurs', icon: Cpu },
    { path: '/plus/pompekits', label: 'Kits pompage', icon: Droplets },
  ] : []),
  { path: '/plus/formation', label: 'Formation', icon: GraduationCap },
  { path: '/plus/mypartner', label: 'Mon espace partenaire', icon: Users },
];

// Écrans atteints depuis « Paramètres » (voir screens/Plus.jsx) : l'entrée
// de la barre latérale y reste allumée.
const SETTINGS_PATHS = ['/plus/profile', '/plus/apparence', '/plus/backup', '/plus/paiements', '/plus/subsadmin'];

// Barre latérale repliée : le choix suit l'utilisateur d'un écran à l'autre et
// d'une session à l'autre. Replier pour gagner de la place et devoir le
// refaire à chaque page serait pire que de ne pas pouvoir replier du tout.
const REPLI_KEY = 'bestasolar_sidebar_repliee';
const lireRepli = () => {
  try { return localStorage.getItem(REPLI_KEY) === '1'; } catch { return false; }
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { getCompanyForUser, storageError } = useData();
  const { mode, setMode, proActive } = useMode();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isPro = mode === 'pro';
  const [repliee, setRepliee] = useState(lireRepli);
  const basculerRepli = useCallback(() => {
    setRepliee((r) => {
      try { localStorage.setItem(REPLI_KEY, r ? '0' : '1'); } catch { /* stockage indisponible */ }
      return !r;
    });
  }, []);
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
    <div className={`app-shell ${repliee ? 'sidebar-repliee' : ''}`}>
      {/* Barre latérale — visible uniquement sur grand écran */}
      <aside className="sidebar">
        {/* Marque, cloche et repli sur la même ligne : la cloche vit ici, au
            coin de l'app, plutôt que dans le bandeau de chaque page. */}
        <div className={`sidebar-brand ${isPro ? '' : 'sidebar-brand-public'}`}>
          <div className="sidebar-brand-row">
            {isPro ? (
              <>
                <div className="sidebar-logo">
                  {company?.logo
                    ? <img src={company.logo} alt={`Logo ${company.nomEntreprise || 'entreprise'}`} />
                    : <Crown size={22} />}
                </div>
                {!repliee && (
                  <div className="sidebar-brand-nom">
                    <div className="sidebar-title">{company?.nomEntreprise || 'Espace Pro'}</div>
                    <div className="sidebar-subtitle">Espace Pro</div>
                  </div>
                )}
              </>
            ) : (
              <img
                src={repliee ? '/besta-solar-icon-blanc.png' : '/besta-solar-pro-logo-blanc.png'}
                alt="BestaSolar Pro"
                className={repliee ? 'sidebar-brand-icone' : 'sidebar-brand-logo'}
              />
            )}
            <div className="sidebar-brand-tools">
              <NotificationBell />
              <button
                type="button"
                className="sidebar-repli"
                onClick={basculerRepli}
                aria-expanded={!repliee}
                aria-label={repliee ? 'Déplier le menu' : 'Replier le menu'}
                title={repliee ? 'Déplier le menu' : 'Replier le menu'}
              >
                {repliee ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
            </div>
          </div>
          {!isPro && !repliee && <div className="sidebar-subtitle">Lomé, Togo</div>}
        </div>
        <nav className="sidebar-nav" aria-label="Navigation principale">
          {sidebarItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/pro'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              title={repliee ? item.label : undefined}
            >
              <item.icon size={20} strokeWidth={2} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          {!isPro && (
            <>
              {plusSections(user).map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  title={repliee ? item.label : undefined}
                >
                  <item.icon size={20} strokeWidth={2} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
              <button className="sidebar-link sidebar-pro-link" onClick={goPro} title={repliee ? 'Passer en mode Pro' : undefined}>
                <Crown size={20} strokeWidth={2} />
                <span>Passer en mode Pro</span>
              </button>
              {/* Reste allumé sur les écrans ouverts DEPUIS les paramètres
                  (profil, sauvegarde, moyens de paiement, abonnements) —
                  sinon aucune entrée de la barre latérale n'y est active. */}
              <NavLink
                to="/plus/parametres"
                className={({ isActive }) => `sidebar-link ${isActive || SETTINGS_PATHS.includes(pathname) ? 'active' : ''}`}
                title={repliee ? 'Paramètres' : undefined}
              >
                <Settings size={20} strokeWidth={2} />
                <span>Paramètres</span>
              </NavLink>
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          {/* Le réglage d'apparence a quitté la barre latérale : il vit dans
              Paramètres → Apparence (/plus/apparence), avec la densité. */}
          {isPro && (
            <button
              className="btn btn-accent btn-block sidebar-pro-btn"
              onClick={() => setMode('public')}
              title={repliee ? 'Revenir au mode public' : undefined}
              aria-label={repliee ? 'Revenir au mode public' : undefined}
            >
              <ArrowLeft size={16} /> Revenir au mode public
            </button>
          )}
          <div className="sidebar-user">
            <div className="sidebar-user-avatar" title={repliee ? user.name : undefined}>{user.avatar || initials(user.name)}</div>
            {/* Barre repliée : le nom et le rôle s'effacent, mais l'état de
                synchronisation reste — c'est lui qui dit si le travail est
                parti. Il vit d'ordinaire à côté du nom. */}
            {repliee ? <SyncDot /> : (
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user.name} <SyncDot /></div>
                <div className="sidebar-user-role">{user.role === 'gerant' ? 'Gérant' : 'Utilisateur'}</div>
              </div>
            )}
            <button className="sidebar-logout" onClick={logout} title="Déconnexion" aria-label="Déconnexion">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className="app-main">
        {/* Stockage local saturé : l'app fonctionne encore à l'écran mais plus
            rien n'est enregistré. Alerte permanente, jamais un simple toast. */}
        {storageError && (
          <div className="storage-alert" role="alert">
            <AlertTriangle size={16} />
            <span>
              <strong>Enregistrement impossible sur cet appareil.</strong> La mémoire est
              saturée (souvent à cause des photos du catalogue) ou vous naviguez en privé.
              Vos dernières modifications ne seront pas conservées à la fermeture —
              allégez les photos ou libérez de l'espace.
            </span>
          </div>
        )}
        <AbonnementAlert />
        <ChunkErrorBoundary>
          <Suspense fallback={<SkeletonPageContent />}>
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
      </nav>
    </div>
  );
}
