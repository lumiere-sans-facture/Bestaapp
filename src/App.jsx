import { lazy, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { CartProvider } from './context/CartContext';
import { ModeProvider, useMode } from './context/ModeContext';
import { ToastProvider } from './components/Toast';
import { captureRefFromUrl } from './utils/referral';
import AppLayout from './components/AppLayout';
import AppErrorBoundary from './components/AppErrorBoundary';
import Login from './screens/Login';
import { installerFiletsGlobaux } from './lib/rapportErreur';
import { installerAnalytique, suivrePage } from './lib/analytique';

captureRefFromUrl();
installerFiletsGlobaux();
installerAnalytique();

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
const SizingSheetViewer = lazyWithPreload(() => import('./screens/SizingSheetViewer'));

const ALL_SCREENS = [Dashboard, Pipeline, Clients, Boutique, Devis, Plus, ProDashboard, ProDocuments, ProClients, ProCompany, ProSubscription, SizingSheetViewer];

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
  const { pathname } = useLocation();
  useEffect(() => { suivrePage(pathname); }, [pathname]);

  const dernierCompte = useRef(null);
  useEffect(() => {
    const id = user?.id || null;
    if (dernierCompte.current !== null && dernierCompte.current !== id) navigate('/', { replace: true });
    dernierCompte.current = id;
  }, [user?.id, navigate]);

  if (isLoading) return <div className="splash-screen">Chargement…</div>;
  if (recovery) return <Login />;
  if (!user) return <Login />;

  return (
    <DataProvider>
      <ModeProvider>
        <CartProvider>
          <ToastProvider><ModeSwitch /></ToastProvider>
        </CartProvider>
      </ModeProvider>
    </DataProvider>
  );
}

function ModeSwitch() {
  const { mode } = useMode();
  usePreloadScreens();

  if (mode === 'pro') {
    return (
      <Routes>
        <Route path="/fiche-dimensionnement" element={<SizingSheetViewer />} />
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
      <Route path="/fiche-dimensionnement" element={<SizingSheetViewer />} />
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/clients" element={<Clients />} />
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
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider><AppRoutes /></AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}
