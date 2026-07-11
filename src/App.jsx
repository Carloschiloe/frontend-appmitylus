import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider, useToast } from './context/ToastContext.jsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Menu } from 'lucide-react';
import Sidebar from './components/Layout/Sidebar.jsx';
import AppHeader from './components/Layout/AppHeader.jsx';
import QuickCaptureModal from './modules/gestion/components/QuickCaptureModal.jsx';
import CopilotPanel from './components/CopilotPanel.jsx';
import SpeedDialFab from './components/SpeedDialFab.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import SupportReportModal from './components/SupportReportModal.jsx';
import { installGlobalErrorCapture } from './utils/errorReporter.js';
import { installActionTrail, recordAction } from './utils/actionTrail.js';
import { apiClient } from './api/apiClient.js';

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
const Configuracion = lazy(() => import('./modules/configuracion/Configuracion.jsx'));
const Historial = lazy(() => import('./modules/historial/Historial.jsx'));
const Ayuda     = lazy(() => import('./modules/ayuda/Ayuda.jsx'));
const Login          = lazy(() => import('./modules/auth/Login.jsx'));
const ActivarCuenta  = lazy(() => import('./modules/auth/ActivarCuenta.jsx'));
const Empresas       = lazy(() => import('./modules/configuracion/Empresas.jsx'));
const MiPerfil       = lazy(() => import('./modules/perfil/MiPerfil.jsx'));
const SharedMuestreo    = lazy(() => import('./modules/public/SharedMuestreo.jsx'));
const SaasAdminShell   = lazy(() => import('./modules/saas-admin/SaasAdminShell.jsx'));

const MainLayout = ({ children }) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [supportModal, setSupportModal] = React.useState({ open: false, initialData: {} });
  const location = useLocation();
  const selectedTenantDb = localStorage.getItem('selected_tenant_db') || '';

  // Cerrar el menú lateral al cambiar de ruta
  React.useEffect(() => {
    setIsMobileOpen(false);
    recordAction({ type: 'route', label: `Ruta ${location.pathname}`, route: location.pathname });
  }, [location.pathname]);

  React.useEffect(() => {
    const openSupport = (event) => setSupportModal({ open: true, initialData: event.detail || {} });
    window.addEventListener('mitynex:open-support-report', openSupport);
    return () => window.removeEventListener('mitynex:open-support-report', openSupport);
  }, []);

  // Rol "lectura": oculta vía CSS todo lo marcado como data-nuevo/data-edit/
  // data-delete/write-only en toda la app (ver body.modo-lectura en base-ui.css).
  React.useEffect(() => {
    document.body.classList.toggle('modo-lectura', user?.rol === 'lectura');
  }, [user?.rol]);

  React.useEffect(() => {
    if (!user) return;
    if (sessionStorage.getItem('mitynex_reports_checked')) return;
    sessionStorage.setItem('mitynex_reports_checked', '1');

    let stored;
    try {
      stored = JSON.parse(localStorage.getItem('mitynex_my_reports') || '[]');
    } catch { stored = []; }
    if (!stored.length) return;

    apiClient.get(`/support/error-reports/my-status?codes=${stored.join(',')}`)
      .then((data) => {
        if (!data?.results?.length) return;
        const resolved = data.results.filter((r) => r.status === 'fixed' || r.status === 'released');
        if (!resolved.length) return;

        const resolvedCodes = resolved.map((r) => r.errorCode);
        addToast({
          type: 'success',
          title: resolved.length === 1
            ? `Reporte ${resolvedCodes[0]} resuelto`
            : `${resolved.length} reportes tuyos fueron resueltos`,
          message: 'El equipo de soporte solucionó el problema que reportaste.',
          duration: 12000,
        });

        try {
          const remaining = stored.filter((c) => !resolvedCodes.includes(c));
          localStorage.setItem('mitynex_my_reports', JSON.stringify(remaining));
        } catch { /* ignore */ }
      })
      .catch(() => {});
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPublicRoute = ['/login', '/activar-cuenta'].includes(location.pathname);
  const isSaasAdminRoute = location.pathname.startsWith('/saas-admin');

  // Superadmin sin empresa seleccionada → forzar Panel SaaS (bloquea /dashboard y todo lo demás)
  if (user?.rol === 'superadmin' && !selectedTenantDb && !isSaasAdminRoute && !isPublicRoute) {
    return <Navigate to="/saas-admin" replace />;
  }

  // Usuario con acceso acotado a módulos específicos (ej. cuenta de un
  // departamento externo): si navega fuera de su alcance permitido, lo
  // manda de vuelta a su módulo. "/perfil" siempre queda accesible.
  if (user && !isPublicRoute && !isSaasAdminRoute) {
    const modulosPermitidos = user.modulosPermitidos || [];
    if (modulosPermitidos.length > 0) {
      const dentroDeAlcance = location.pathname === '/perfil'
        || modulosPermitidos.some((m) => location.pathname === m || location.pathname.startsWith(`${m}/`));
      if (!dentroDeAlcance) {
        return <Navigate to={modulosPermitidos[0]} replace />;
      }
    }
  }

  // Rutas SaaS Admin y rutas públicas: sin shell normal
  if (!user || isPublicRoute || isSaasAdminRoute) return children;

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
        <div className="mx-mobile-header-spacer" aria-hidden="true" />
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
        <AppHeader />
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
      <CopilotPanel queryClient={queryClient} />
      <QuickCaptureModal />
      <SpeedDialFab />
      <SupportReportModal
        open={supportModal.open}
        initialData={supportModal.initialData}
        onClose={() => setSupportModal({ open: false, initialData: {} })}
      />
    </div>
  );
};

const ErrorInstrumentation = () => {
  const location = useLocation();
  React.useEffect(() => {
    installGlobalErrorCapture();
    installActionTrail();
  }, []);
  React.useEffect(() => {
    recordAction({ type: 'route', label: `Ruta ${location.pathname}`, route: location.pathname });
  }, [location.pathname]);
  return null;
};

const TenantContextRequired = ({ title = 'Selecciona una empresa', description }) => (
  <div className="mx-card mx-tenant-required">
    <p className="mx-tenant-required__eyebrow">
      Contexto requerido
    </p>
    <h2 className="mx-tenant-required__title">{title}</h2>
    <p className="mx-tenant-required__description">
      {description || 'Debes elegir una empresa en el selector lateral para trabajar en este módulo sin errores de contexto.'}
    </p>
  </div>
);

// Componente para proteger rutas (Integración con AuthContext)
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const isPublicReport = window.location.pathname.startsWith('/r/muestreo/') || window.location.pathname.startsWith('/r/trato/') || window.location.pathname.startsWith('/m/');

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
  const isPublicReport = window.location.pathname.startsWith('/r/muestreo/') || window.location.pathname.startsWith('/r/trato/') || window.location.pathname.startsWith('/m/');

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
  const isPublicReportRoute = path.toLowerCase().startsWith('/r/muestreo') || path.toLowerCase().startsWith('/r/trato') || path.toLowerCase().startsWith('/m/');
  

  // VISTA PÚBLICA AISLADA (Sin Auth, Sin Sidebar, Sin contexto privado)
  if (isPublicReportRoute) {
    return (
      <QueryClientProvider client={queryClient}>
        <Router>
          <ErrorInstrumentation />
          <Suspense fallback={
            <div className="mx-loading-screen">
              <div className="mx-spinner"></div>
              <p>Cargando reporte público...</p>
            </div>
          }>
            <Routes>
              <Route path="/r/muestreo/:token" element={<SharedMuestreo />} />
              <Route path="/r/trato/:token" element={<SharedMuestreo />} />
              <Route path="/m/:shortCode" element={<SharedMuestreo />} />
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
            <ErrorInstrumentation />
            <MainLayout>
              <Suspense fallback={
                <div className="mx-loading-screen">
                  <div className="mx-spinner"></div>
                  <p>Cargando módulo...</p>
                </div>
              }>
                <Routes>
                  {/* Panel SaaS Admin — layout propio, sin sidebar normal */}
                  <Route path="/saas-admin/*" element={
                    <SuperAdminRoute>
                      <SaasAdminShell />
                    </SuperAdminRoute>
                  } />

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

                  <Route path="/configuracion/*" element={
                    <AdminRoute>
                      <Configuracion />
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

                  <Route path="/ayuda" element={
                    <PrivateRoute>
                      <Ayuda />
                    </PrivateRoute>
                  } />

                  <Route path="/perfil" element={
                    <PrivateRoute>
                      <MiPerfil />
                    </PrivateRoute>
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
