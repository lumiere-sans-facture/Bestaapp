import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import AppLayout from './components/AppLayout';
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
    </DataProvider>
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
