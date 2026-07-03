import React, { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Building2, Bug, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import './SaasAdminShell.css';

export default function SaasAdminShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate('/login', { replace: true });
    else if (user.rol !== 'superadmin') navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  if (!user || user.rol !== 'superadmin') return null;

  return (
    <div className="saas-shell">
      <aside className="saas-sidebar">
        <div className="saas-sidebar-brand">
          <img src="/img/brand/mitynex-logo-new.svg" alt="Mitynex" />
        </div>

        <div className="saas-sidebar-badge">
          <Shield size={12} />
          Panel SaaS
        </div>

        <nav className="saas-nav">
          <NavLink
            to="/saas-admin/empresas"
            className={({ isActive }) => `saas-nav-link${isActive ? ' is-active' : ''}`}
          >
            <Building2 size={17} />
            <span>Empresas</span>
          </NavLink>
          <NavLink
            to="/saas-admin/soporte"
            className={({ isActive }) => `saas-nav-link${isActive ? ' is-active' : ''}`}
          >
            <Bug size={17} />
            <span>Soporte técnico</span>
          </NavLink>
        </nav>

        <div className="saas-sidebar-foot">
          <div className="saas-user">
            <span className="saas-user-name">{user?.nombre || 'Admin'}</span>
            <span className="saas-user-role">Super Admin</span>
          </div>
          <button
            type="button"
            className="saas-logout-btn"
            onClick={logout}
            title="Cerrar sesión"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="saas-main">
        {children}
      </main>
    </div>
  );
}
