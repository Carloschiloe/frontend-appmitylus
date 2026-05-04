import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Sidebar from './components/Layout/Sidebar';
import 'leaflet/dist/leaflet.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutos
    },
  },
});

// Lazy loading para optimizar el bundle inicial
const Dashboard = lazy(() => import('./modules/dashboard/Dashboard'));
const Biomasa   = lazy(() => import('./modules/biomasa/Biomasa'));
const Centros   = lazy(() => import('./modules/centros/Centros'));
const Gestion   = lazy(() => import('./modules/gestion/Gestion'));
const Maestros  = lazy(() => import('./modules/configuracion/Maestros'));
const Usuarios  = lazy(() => import('./modules/configuracion/Usuarios'));
const Historial = lazy(() => import('./modules/historial/Historial'));
const Login     = lazy(() => import('./modules/auth/Login'));
const Empresas  = lazy(() => import('./modules/configuracion/Empresas'));

// Componente para proteger rutas (Integración con AuthContext)
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="mx-loading-screen">
        <div className="mx-spinner"></div>
        <p>Verificando credenciales...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="mx-app-shell">
      <Sidebar />
      <main className="mx-main-content">
        {children}
      </main>
    </div>
  );
};

// Rutas exclusivas para administradores
const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="mx-loading-screen">
        <div className="mx-spinner"></div>
        <p>Verificando credenciales...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.rol !== 'admin' && user.rol !== 'superadmin') return <Navigate to="/dashboard" replace />;

  return (
    <div className="mx-app-shell">
      <Sidebar />
      <main className="mx-main-content">
        {children}
      </main>
    </div>
  );
};

// Rutas exclusivas para SuperAdministradores (SaaS Management)
const SuperAdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="mx-loading-screen">
        <div className="mx-spinner"></div>
        <p>Verificando nivel de acceso...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.rol !== 'superadmin') return <Navigate to="/dashboard" replace />;

  return (
    <div className="mx-app-shell">
      <Sidebar />
      <main className="mx-main-content">
        {children}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <Suspense fallback={
          <div className="mx-loading-screen">
            <div className="mx-spinner"></div>
            <p>Cargando módulo...</p>
          </div>
        }>
          <Routes>
            {/* Rutas Públicas */}
            <Route path="/login" element={<Login />} />

            {/* Rutas Privadas */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            <Route path="/dashboard" element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } />

            <Route path="/biomasa/*" element={
              <PrivateRoute>
                <Biomasa />
              </PrivateRoute>
            } />

            <Route path="/centros/*" element={
              <PrivateRoute>
                <Centros />
              </PrivateRoute>
            } />

            <Route path="/gestion/*" element={
              <PrivateRoute>
                <Gestion />
              </PrivateRoute>
            } />

            <Route path="/configuracion/maestros" element={
              <AdminRoute>
                <Maestros />
              </AdminRoute>
            } />

            <Route path="/configuracion/usuarios" element={
              <AdminRoute>
                <Usuarios />
              </AdminRoute>
            } />

            <Route path="/configuracion/empresas" element={
              <SuperAdminRoute>
                <Empresas />
              </SuperAdminRoute>
            } />

            <Route path="/historial" element={
              <PrivateRoute>
                <Historial />
              </PrivateRoute>
            } />

            {/* Fallback global */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </ToastProvider>
  </AuthProvider>
  </QueryClientProvider>
  );
}
