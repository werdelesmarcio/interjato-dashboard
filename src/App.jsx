import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css'
import Dashboard from './Dashboard'
import DashboardPage from './DashboardPage';
import Documents from './Documents';
import Login from './Login';
import Users from './Users';
import Profile from './Profile';
import Logs from './Logs';
import NonConformities from './NonConformities';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Definir o tema escuro como padrão e remover a lógica de troca de tema
    document.documentElement.dataset.theme = 'dark';

    // Verificar a sessão ao carregar o aplicativo
    const checkSession = async () => {
      try {
        const response = await fetch('/api/profile');
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (error) {
        setUser(null);
        console.error("Não foi possível conectar à API para verificar a sessão.", error);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    
    let inactivityTimer;
    const inactivityTimeout = 2 * 60 * 60 * 1000; // 2 horas

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        handleLogout();
      }, inactivityTimeout);
    };

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetInactivityTimer, { passive: true }));
    
    resetInactivityTimer(); // Inicia o timer

    return () => {
      clearTimeout(inactivityTimer);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetInactivityTimer));
    };
  }, [user]);

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    } finally {
      setUser(null);
    }
  };

  if (loading) {
    return <div>Carregando...</div>; // Ou um componente de spinner
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login onLoginSuccess={handleLoginSuccess} /> : <Navigate to="/dashboard" />} />
        
        {/* Rota de Layout Principal */}
        <Route 
          path="/" 
          element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
        >
          {/* Rotas Aninhadas */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="documents" element={<Documents />} />
          <Route path="users" element={user && user.role === 'admin' ? <Users /> : <Navigate to="/dashboard" />} />
          <Route path="profile" element={<Profile />} />
          <Route path="non-conformities" element={<NonConformities user={user} />} />
          <Route path="logs" element={<Logs />} />
        </Route>
        
        {/* Rota de fallback para redirecionar para o login caso não haja usuário */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
