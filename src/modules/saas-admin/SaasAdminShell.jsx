import React, { useState, useEffect } from 'react';
import { NavLink, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Building2, Bug, LogOut, ShieldCheck, LayoutDashboard, Users, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiClient } from '../../api/apiClient.js';
import './SaasAdminShell.css';

const Resumen = React.lazy(() => import('./SaasAdminResumen.jsx'));
const Empresas = React.lazy(() => import('../configuracion/Empresas.jsx'));
const Usuarios = React.lazy(() => import('../configuracion/Usuarios.jsx'));
const ErrorReports = React.lazy(() => import('../gestion/soporte/ErrorReports.jsx'));

export default function SaasAdminShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [soporteBadge, setSoporteBadge] = useState(0);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    apiClient.get('/support/error-reports?status=new&limit=1')
      .then((data) => { if (data?.total > 0) setSoporteBadge(data.total); })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (location.pathname === '/saas-admin/soporte') setSoporteBadge(0);
  }, [location.pathname]);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className={`saas-shell${isMobileOpen ? ' saas-shell--mobile-open' : ''}`}>
      <header className="saas-mobile-header">
        <button
          type="button"
          className="saas-mobile-menu-btn"
          onClick={() => setIsMobileOpen((v) => !v)}
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
        <div className="saas-mobile-brand">
          <img src="/img/brand/mitynex-logo-new.svg" alt="Mitynex" />
        </div>
        <div className="saas-mobile-header-spacer" aria-hidden="true" />
      </header>

      {isMobileOpen && (
        <div className="saas-sidebar-backdrop" onClick={() => setIsMobileOpen(false)} />
      )}

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
            to="/saas-admin/resumen"
            className={({ isActive }) => `saas-nav-link${isActive ? ' is-active' : ''}`}
          >
            <LayoutDashboard size={16} />
            <span>Resumen</span>
          </NavLink>
          <NavLink
            to="/saas-admin/empresas"
            className={({ isActive }) => `saas-nav-link${isActive ? ' is-active' : ''}`}
          >
            <Building2 size={16} />
            <span>Empresas</span>
          </NavLink>
          <NavLink
            to="/saas-admin/usuarios"
            className={({ isActive }) => `saas-nav-link${isActive ? ' is-active' : ''}`}
          >
            <Users size={16} />
            <span>Usuarios</span>
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
            <Route index element={<Navigate to="/saas-admin/resumen" replace />} />
            <Route path="resumen" element={<Resumen />} />
            <Route path="empresas" element={<Empresas />} />
            <Route path="usuarios" element={<Usuarios noPage forceAllEmpresas />} />
            <Route path="soporte" element={<ErrorReports />} />
            <Route path="*" element={<Navigate to="/saas-admin/resumen" replace />} />
          </Routes>
        </React.Suspense>
      </main>
    </div>
  );
}
