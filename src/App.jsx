import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { CartProvider } from './context/CartContext';
import { ModeProvider, useMode } from './context/ModeContext';
import { captureRefFromUrl } from './utils/referral';

// Capture l'attribution d'affiliation (?ref=BESTA-XXXX) dès le chargement,
// avant même la connexion — durée 30 jours, last-click.
captureRefFromUrl();
import AppLayout from './components/AppLayout';
import ProApp from './ProApp';
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import Pipeline from './screens/Pipeline';
import Boutique from './screens/Boutique';
import Devis from './screens/Devis';
import Plus from './screens/Plus';

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

// Bascule exclusive entre les deux vues : une seule est montée à la fois.
// mode === 'pro'  → uniquement <ProApp /> (espace entreprise)
// mode === 'public' → uniquement l'app publique (tableau de bord, suivi clients…)
// Zéro superposition, zéro fuite de données entre les deux.
function ModeSwitch() {
  const { mode } = useMode();

  if (mode === 'pro') return <ProApp />;

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
