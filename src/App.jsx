import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Menu } from 'lucide-react';
import Sidebar from './components/Layout/Sidebar.jsx';
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
const Dashboard = lazy(() => import('./modules/dashboard/Dashboard.jsx'));
const Biomasa   = lazy(() => import('./modules/biomasa/Biomasa.jsx'));
const Centros   = lazy(() => import('./modules/centros/Centros.jsx'));
const Gestion   = lazy(() => import('./modules/gestion/Gestion.jsx'));
const Maestros  = lazy(() => import('./modules/configuracion/Maestros.jsx'));
const Usuarios  = lazy(() => import('./modules/configuracion/Usuarios.jsx'));
const Historial = lazy(() => import('./modules/historial/Historial.jsx'));
const Login          = lazy(() => import('./modules/auth/Login.jsx'));
const ActivarCuenta  = lazy(() => import('./modules/auth/ActivarCuenta.jsx'));
const Empresas       = lazy(() => import('./modules/configuracion/Empresas.jsx'));
const SharedMuestreo = lazy(() => import('./modules/public/SharedMuestreo.jsx'));

const MainLayout = ({ children }) => {
  const { user } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const location = useLocation();

  // Cerrar el menú lateral al cambiar de ruta
  React.useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Si no hay usuario, es una ruta pública (Login/Activar), no mostramos Sidebar
  if (!user) return children;

  return (
    <div className={`mx-app-shell ${isMobileOpen ? 'mobile-sidebar-open' : ''}`}>
      {/* Encabezado móvil premium */}
      <header className="mx-mobile-header">
        <button 
          type="button" 
          className="mx-mobile-menu-btn"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
        <div className="mx-mobile-brand">
          <img src="/img/brand/mitynex-logo-new.svg" alt="Mitynex" />
        </div>
        <div style={{ width: 36 }}></div> {/* Espaciador para centrado óptico del logo */}
      </header>

      {/* Fondo oscuro traslúcido para cerrar el menú al hacer click fuera */}
      {isMobileOpen && (
        <div 
          className="mx-sidebar-backdrop" 
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <Sidebar />
      <main className="mx-main-content">
        {children}
      </main>
    </div>
  );
};

const TenantContextRequired = ({ title = 'Selecciona una empresa', description }) => (
  <div className="mx-card" style={{ maxWidth: 760, margin: '48px auto', padding: '32px 28px' }}>
    <p
      style={{
        margin: 0,
        color: 'var(--mx-muted, #6b7a90)',
        fontSize: '0.82rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase'
      }}
    >
      Contexto requerido
    </p>
    <h2 style={{ margin: '10px 0 12px', fontSize: '2rem', lineHeight: 1.1 }}>{title}</h2>
    <p style={{ margin: 0, color: 'var(--mx-muted, #6b7a90)', fontSize: '1rem', lineHeight: 1.7 }}>
      {description || 'Debes elegir una empresa en el selector lateral para trabajar en este módulo sin errores de contexto.'}
    </p>
  </div>
);

// Componente para proteger rutas (Integración con AuthContext)
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const isPublicReport = window.location.pathname.startsWith('/r/muestreo/') || window.location.pathname.startsWith('/r/trato/');

  if (loading) {
    return (
      <div className="mx-loading-screen">
        <div className="mx-spinner"></div>
        <p>Verificando credenciales...</p>
      </div>
    );
  }

  if (!user && !isPublicReport) return <Navigate to="/login" replace />;

  return children;
};

const TenantScopedRoute = ({ children, title, description }) => {
  const { user, loading } = useAuth();
  const isPublicReport = window.location.pathname.startsWith('/r/muestreo/') || window.location.pathname.startsWith('/r/trato/');

  const selectedTenantDb = typeof window !== 'undefined'
    ? window.localStorage.getItem('selected_tenant_db') || ''
    : '';

  if (loading) {
    return (
      <div className="mx-loading-screen">
        <div className="mx-spinner"></div>
        <p>Verificando contexto...</p>
      </div>
    );
  }

  if (!user && !isPublicReport) return <Navigate to="/login" replace />;

  if (user.rol === 'superadmin' && !selectedTenantDb) {
    return <TenantContextRequired title={title} description={description} />;
  }

  return children;
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

  return children;
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

  return children;
};

export default function App() {
  const path = window.location.pathname;
  const isPublicReportRoute = path.toLowerCase().startsWith('/r/muestreo') || path.toLowerCase().startsWith('/r/trato');
  

  // VISTA PÚBLICA AISLADA (Sin Auth, Sin Sidebar, Sin contexto privado)
  if (isPublicReportRoute) {
    return (
      <QueryClientProvider client={queryClient}>
        <Router>
          <Suspense fallback={
            <div className="mx-loading-screen">
              <div className="mx-spinner"></div>
              <p>Cargando reporte público...</p>
            </div>
          }>
            <Routes>
              <Route path="/r/muestreo/:token" element={<SharedMuestreo />} />
              <Route path="/r/trato/:token" element={<SharedMuestreo />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </QueryClientProvider>
    );
  }

  // VISTA PRIVADA NORMAL
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <MainLayout>
              <Suspense fallback={
                <div className="mx-loading-screen">
                  <div className="mx-spinner"></div>
                  <p>Cargando módulo...</p>
                </div>
              }>
                <Routes>
                  {/* Rutas Públicas (Auth) */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/activar-cuenta" element={<ActivarCuenta />} />

                  {/* Rutas Privadas Protegidas */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  
                  <Route path="/dashboard" element={
                    <PrivateRoute>
                      <Dashboard />
                    </PrivateRoute>
                  } />

                  <Route path="/biomasa/*" element={
                    <TenantScopedRoute
                      title="Selecciona una empresa para trabajar Biomasa"
                      description="Debes elegir una empresa en el selector lateral antes de revisar negociación, muestreos o programas."
                    >
                      <Biomasa />
                    </TenantScopedRoute>
                  } />

                  <Route path="/centros/*" element={
                    <TenantScopedRoute
                      title="Selecciona una empresa para revisar Centros"
                      description="Debes elegir una empresa en el selector lateral antes de abrir el directorio, mapa o estado sanitario."
                    >
                      <Centros />
                    </TenantScopedRoute>
                  } />

                  <Route path="/gestion/*" element={
                    <TenantScopedRoute
                      title="Selecciona una empresa para trabajar en Gestión"
                      description="Debes elegir una empresa en el selector lateral antes de revisar seguimiento, proveedores y agenda."
                    >
                      <Gestion />
                    </TenantScopedRoute>
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
                    <TenantScopedRoute
                      title="Selecciona una empresa para revisar Historial"
                      description="Debes elegir una empresa en el selector lateral antes de consultar expedientes o la actividad del equipo."
                    >
                      <Historial />
                    </TenantScopedRoute>
                  } />

                  {/* Fallback global */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Suspense>
            </MainLayout>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
