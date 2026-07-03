import React, { useState, useEffect } from 'react';
import { NavLink, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Building2, Bug, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiClient } from '../../api/apiClient.js';
import './SaasAdminShell.css';

const Empresas = React.lazy(() => import('../configuracion/Empresas.jsx'));
const ErrorReports = React.lazy(() => import('../gestion/soporte/ErrorReports.jsx'));

export default function SaasAdminShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [soporteBadge, setSoporteBadge] = useState(0);

  useEffect(() => {
    if (!user) return;
    apiClient.get('/support/error-reports?status=new&limit=1')
      .then((data) => { if (data?.total > 0) setSoporteBadge(data.total); })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (location.pathname === '/saas-admin/soporte') setSoporteBadge(0);
  }, [location.pathname]);

  return (
    <div className="saas-shell">
      <aside className="saas-sidebar">
        <div className="saas-sidebar-top">
          <div className="saas-brand">
            <img src="/img/brand/mitynex-logo-new.svg" alt="Mitynex" />
          </div>
          <div className="saas-badge">
            <ShieldCheck size={12} />
            Panel SaaS
          </div>
        </div>

        <nav className="saas-nav">
          <NavLink
            to="/saas-admin/empresas"
            className={({ isActive }) => `saas-nav-link${isActive ? ' is-active' : ''}`}
          >
            <Building2 size={16} />
            <span>Empresas</span>
          </NavLink>
          <NavLink
            to="/saas-admin/soporte"
            className={({ isActive }) => `saas-nav-link${isActive ? ' is-active' : ''}`}
          >
            <Bug size={16} />
            <span>Soporte técnico</span>
            {soporteBadge > 0 && <span className="saas-nav-badge">{soporteBadge}</span>}
          </NavLink>
        </nav>

        <div className="saas-sidebar-foot">
          <div className="saas-user">
            <span className="saas-user-name">{user?.nombre || user?.email}</span>
            <span className="saas-user-role">Superadmin</span>
          </div>
          <button type="button" className="saas-logout-btn" onClick={logout}>
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="saas-main">
        <React.Suspense fallback={<div className="saas-loading"><div className="mx-spinner" /></div>}>
          <Routes>
            <Route index element={<Navigate to="/saas-admin/empresas" replace />} />
            <Route path="empresas" element={<Empresas />} />
            <Route path="soporte" element={<ErrorReports />} />
            <Route path="*" element={<Navigate to="/saas-admin/empresas" replace />} />
          </Routes>
        </React.Suspense>
      </main>
    </div>
  );
}
