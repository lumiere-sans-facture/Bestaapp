import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { CartProvider } from './context/CartContext';
import { ModeProvider, useMode } from './context/ModeContext';
import { captureRefFromUrl } from './utils/referral';
import AppLayout from './components/AppLayout';
import Login from './screens/Login';

// Capture l'attribution d'affiliation (?ref=BESTA-XXXX) dès le chargement,
// avant même la connexion — durée 30 jours, last-click.
captureRefFromUrl();

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
const Boutique = lazyWithPreload(() => import('./screens/Boutique'));
const Devis = lazyWithPreload(() => import('./screens/Devis'));
const Plus = lazyWithPreload(() => import('./screens/Plus'));
const ProDashboard = lazyWithPreload(() => import('./screens/ProDashboard'));
const ProDocuments = lazyWithPreload(() => import('./screens/pro/ProDocuments'));
const ProClients = lazyWithPreload(() => import('./screens/pro/ProClients'));
const ProCompany = lazyWithPreload(() => import('./screens/pro/ProCompany'));
const ProSubscription = lazyWithPreload(() => import('./screens/pro/ProSubscription'));

const ALL_SCREENS = [Dashboard, Pipeline, Boutique, Devis, Plus, ProDashboard, ProDocuments, ProClients, ProCompany, ProSubscription];

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
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="splash-screen">Chargement…</div>;
  }

  if (!user) return <Login />;

  return (
    <DataProvider>
      <ModeProvider>
        <CartProvider>
          <ModeSwitch />
        </CartProvider>
      </ModeProvider>
    </DataProvider>
  );
}

// Bascule exclusive : une seule arborescence de routes montée à la fois.
// mode === 'pro'    → routes Pro dans AppLayout (zéro donnée publique visible)
// mode === 'public' → routes publiques dans AppLayout
function ModeSwitch() {
  const { mode } = useMode();
  usePreloadScreens();

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
        <Route path="/boutique" element={<Boutique />} />
        <Route path="/devis" element={<Devis />} />
        <Route path="/plus" element={<Plus />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
