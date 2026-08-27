import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { CartProvider } from './context/CartContext';
import { ModeProvider, useMode } from './context/ModeContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/Toast';
import { captureRefFromUrl } from './utils/referral';
import { capturerFormuleUrl, lireFormuleChoisie } from './utils/formuleChoisie';
import AppLayout from './components/AppLayout';
import AppErrorBoundary from './components/AppErrorBoundary';
import LoadingShell from './components/LoadingShell';
import Login from './screens/Login';
import { installerFiletsGlobaux } from './lib/rapportErreur';
import { installerAnalytique, suivrePage } from './lib/analytique';

// Capture l'attribution d'affiliation (?ref=BESTA-XXXX) dès le chargement,
// avant même la connexion — durée 30 jours, last-click.
const REF_DU_LIEN = captureRefFromUrl();

// Formule choisie sur la page d'accueil (« Choisir Pro Premium »), captée
// avant tout rendu : elle doit survivre à la création du compte, qui
// recharge l'application.
capturerFormuleUrl();

// Venu par un lien de parrainage ou d'invitation d'équipe : ce visiteur-là
// vient créer son compte, pas lire la vitrine — on lui ouvre le formulaire
// directement, code prérempli, comme avant l'arrivée de la page d'accueil.
// Le test porte sur CE chargement de page, jamais sur l'attribution stockée :
// elle vaut 30 jours, et masquerait la vitrine pendant tout ce temps.
const VENU_PAR_LIEN = Boolean(REF_DU_LIEN) || (() => {
  try { return Boolean(new URLSearchParams(window.location.search).get('equipe')); } catch { return false; }
})();

// Erreurs hors React (minuteurs, gestionnaires d'événements) et promesses
// rejetées sans `catch` : installées au chargement, avant tout rendu.
installerFiletsGlobaux();
// Analytique : filets d'envoi (retour du réseau, fermeture de l'onglet).
installerAnalytique();

// Découpage par route : chaque écran est un chunk chargé à la demande, pour
// alléger le bundle initial (parse/eval plus rapide au démarrage — déterminant
// sur mobile bas de gamme). preload() expose l'import pour le préchargement.
const lazyWithPreload = (factory) => {
  const Comp = lazy(factory);
  Comp.preload = factory;
  return Comp;
};

const Dashboard = lazyWithPreload(() => import('./screens/Dashboard'));
const Pipeline = lazyWithPreload(() => import('./screens/Pipeline'));
const Clients = lazyWithPreload(() => import('./screens/Clients'));
const Boutique = lazyWithPreload(() => import('./screens/Boutique'));
const Devis = lazyWithPreload(() => import('./screens/Devis'));
const Plus = lazyWithPreload(() => import('./screens/Plus'));
const ProDashboard = lazyWithPreload(() => import('./screens/ProDashboard'));
const ProDocuments = lazyWithPreload(() => import('./screens/pro/ProDocuments'));
const ProClients = lazyWithPreload(() => import('./screens/pro/ProClients'));
const ProCompany = lazyWithPreload(() => import('./screens/pro/ProCompany'));
const ProSubscription = lazyWithPreload(() => import('./screens/pro/ProSubscription'));

// Page d'accueil publique : accessible à la racine, y compris après une
// actualisation lorsque l'utilisateur est déjà connecté.
const Landing = lazy(() => import('./screens/Landing'));

const ALL_SCREENS = [Dashboard, Pipeline, Clients, Boutique, Devis, Plus, ProDashboard, ProDocuments, ProClients, ProCompany, ProSubscription];

// Précharge tous les chunks dès que le navigateur est inactif : la navigation
// reste instantanée ET fonctionne hors-ligne pendant la session (invariant
// local-first préservé — le découpage ne diffère le chargement que de l'initial).
function usePreloadScreens() {
  useEffect(() => {
    const preload = () => ALL_SCREENS.forEach((c) => { c.preload?.(); });
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(preload);
      return () => window.cancelIdleCallback?.(id);
    }
    const t = setTimeout(preload, 1500);
    return () => clearTimeout(t);
  }, []);
}

function AppRoutes() {
  const { user, isLoading, recovery } = useAuth();
  const navigate = useNavigate();
  // Page vue : UN SEUL point d'émission, à la racine des routes. Le chemin est
  // normalisé (« /clients/c-4f2a » → « /clients/:id ») avant tout envoi.
  const { pathname } = useLocation();
  useEffect(() => { suivrePage(pathname); }, [pathname]);

  // Une session neuve repart de l'accueil. L'app est une PAGE UNIQUE : sans
  // cela, l'adresse ouverte par un compte survit à sa déconnexion et le compte
  // suivant atterrit sur l'écran du précédent — un simple utilisateur se
  // retrouvait sur une page d'administration du gérant.
  const dernierCompte = useRef(null);
  useEffect(() => {
    const id = user?.id || null;
    if (dernierCompte.current !== null && dernierCompte.current !== id) {
      navigate('/', { replace: true });
    }
    dernierCompte.current = id;
  }, [user?.id, navigate]);

  if (isLoading) {
    return <LoadingShell />;
  }

  // Lien « mot de passe oublié » : le nouveau mot de passe passe avant tout.
  if (recovery) return <Login />;

  // L'accueil reste une vitrine, même pour une session active : actualiser /
  // ne doit jamais transformer l'adresse en tableau de bord.
  if (pathname === '/') {
    return <Suspense fallback={<LoadingShell />}><Landing /></Suspense>;
  }

  // Visiteur non connecté : les formulaires sont accessibles à côté. Toute
  // autre adresse (un signet vers /dashboard, par exemple) ouvre la connexion.
  if (!user) {
    return (
      <Suspense fallback={<LoadingShell />}>
        <Routes>
          <Route path="/" element={VENU_PAR_LIEN ? <Login vueInitiale="signup" /> : <Landing />} />
          <Route path="/inscription" element={<Login vueInitiale="signup" />} />
          <Route path="/connexion" element={<Login />} />
          <Route path="*" element={<Login />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <DataProvider>
      <ModeProvider>
        <CartProvider>
          <ToastProvider>
            <ModeSwitch />
          </ToastProvider>
        </CartProvider>
      </ModeProvider>
    </DataProvider>
  );
}

// Bascule exclusive : une seule arborescence de routes montée à la fois.
// mode === 'pro'    → routes Pro dans AppLayout (zéro donnée publique visible)
// mode === 'public' → routes publiques dans AppLayout
/**
 * Le client venu d'une formule de la page d'accueil arrive au paiement, pas
 * au tableau de bord : cliquer « Choisir Pro Premium » puis atterrir sur un
 * écran sans rapport, c'est perdre la vente entre les deux.
 *
 * Une seule fois par session, et seulement s'il reste quelque chose à payer :
 * un abonné actif n'a rien à faire sur l'écran d'abonnement.
 */
function useOuvrirPaiementSiFormuleChoisie(proActive) {
  const navigate = useNavigate();
  const fait = useRef(false);
  useEffect(() => {
    if (fait.current) return;
    fait.current = true;
    if (proActive) return;
    if (!lireFormuleChoisie()) return;
    navigate('/plus/gopro', { replace: true });
  }, [proActive, navigate]);
}

function ModeSwitch() {
  const { mode, proActive } = useMode();
  usePreloadScreens();
  useOuvrirPaiementSiFormuleChoisie(proActive);

  if (mode === 'pro') {
    return (
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/pro" element={<ProDashboard />} />
          <Route path="/pro/documents" element={<ProDocuments />} />
          <Route path="/pro/clients" element={<ProClients />} />
          <Route path="/pro/entreprise" element={<ProCompany />} />
          <Route path="/pro/abonnement" element={<ProSubscription />} />
        </Route>
        <Route path="*" element={<Navigate to="/pro" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/clients" element={<Clients />} />
        {/* Fiche client plein écran : même écran, piloté par l'URL (comme /plus/:section). */}
        <Route path="/clients/:id" element={<Clients />} />
        <Route path="/boutique" element={<Boutique />} />
        <Route path="/devis" element={<Devis />} />
        <Route path="/plus" element={<Plus />} />
        <Route path="/plus/:section" element={<Plus />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    // Le filet enveloppe TOUT, y compris les fournisseurs de contexte : une
    // erreur dans l'un d'eux plantait l'app entière sans laisser de trace.
    <AppErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
