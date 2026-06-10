import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './screens/Dashboard';
import Pipeline from './screens/Pipeline';
import Boutique from './screens/Boutique';
import Devis from './screens/Devis';
import Plus from './screens/Plus';

function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('bestasolar_user');
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch (e) { localStorage.removeItem('bestasolar_user'); }
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
    localStorage.setItem('bestasolar_user', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('bestasolar_user');
  };

  if (isLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--primary)', color: 'white', fontSize: '1.25rem' }}>Chargement...</div>;
  }

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard user={user} />} />
          <Route path="/pipeline" element={<Pipeline user={user} />} />
          <Route path="/boutique" element={<Boutique user={user} />} />
          <Route path="/devis" element={<Devis user={user} />} />
          <Route path="/plus" element={<Plus user={user} onLogout={handleLogout} />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
