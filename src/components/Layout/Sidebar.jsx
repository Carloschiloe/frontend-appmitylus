import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Inbox,
  Building2,
  Droplet,
  History,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  User,
  Calendar,
  Users,
  Map,
  ShieldCheck,
  TableProperties,
  Search,
  TestTube2,
  Handshake,
  Database,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiClient } from '../../api/apiClient.js';
import TenantSelector from './TenantSelector.jsx';
import './Sidebar.css';

const MENU_STRUCTURE = [
  {
    id: 'dashboard',
    label: 'Inicio',
    icon: LayoutDashboard,
    links: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    id: 'operacion',
    label: 'Operacion',
    icon: Inbox,
    links: [
      { label: 'Agenda', to: '/gestion/agenda', icon: Calendar },
      { label: 'Tratos', to: '/gestion/tratos', icon: Handshake },
      { label: 'Cosechas', to: '/biomasa/programa', icon: Droplet },
      { label: 'Muestreos', to: '/biomasa/muestreos', icon: TestTube2 },
    ],
  },
  {
    id: 'directorio',
    label: 'Directorio',
    icon: Building2,
    links: [
      { label: 'Proveedores', to: '/gestion/proveedores', icon: Building2 },
      { label: 'Centros', to: '/centros/directorio', icon: TableProperties },
      { label: 'Mapa', to: '/centros/mapa', icon: Map },
    ],
  },
  {
    id: 'inteligencia',
    label: 'Inteligencia',
    icon: BarChart3,
    links: [
      { label: 'Sanitario', to: '/centros/sanitario', icon: ShieldCheck, alertId: 'sanitario' },
      { label: 'Historial', to: '/historial', icon: History },
      { label: 'Actividad del equipo', to: '/historial?view=equipo', icon: Users },
    ],
  },
  {
    id: 'administracion',
    label: 'Administracion',
    icon: Settings,
    requiereRol: 'admin',
    links: [
      { label: 'Maestros', to: '/configuracion/maestros', icon: Database },
      { label: 'Usuarios', to: '/configuracion/usuarios', icon: Users },
    ],
  },
  {
    id: 'saas',
    label: 'SaaS',
    icon: ShieldCheck,
    requiereRol: 'superadmin',
    links: [
      { label: 'Empresas', to: '/configuracion/empresas', icon: Building2 },
    ],
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [openGroups, setOpenGroups] = useState({ dashboard: true });
  const [alerts, setAlerts] = useState({});
  const selectedTenantDb = localStorage.getItem('selected_tenant_db') || '';

  useEffect(() => {
    if (!user) return undefined;
    if (user.rol === 'superadmin' && !selectedTenantDb) {
      setAlerts({});
      return undefined;
    }

    const controller = new AbortController();

    apiClient.get('/sanitario/resumen', { signal: controller.signal })
      .then((data) => {
        if (!data) return;
        const criticas = (data.rojo || 0) + (data.naranja || 0);
        if (criticas > 0) {
          setAlerts((prev) => ({ ...prev, sanitario: criticas }));
          setOpenGroups({ inteligencia: true });
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError' || err.status === 401) return;
      });

    return () => controller.abort();
  }, [selectedTenantDb, user]);

  useEffect(() => {
    const activeGroup = MENU_STRUCTURE.find((group) => (
      group.links.some((link) => {
        const [path] = link.to.split('?');
        return location.pathname.startsWith(path);
      })
    ));
    if (activeGroup) {
      setOpenGroups({ [activeGroup.id]: true });
    }
  }, [location.pathname]);

  const toggleGroup = useCallback((id) => {
    setOpenGroups((prev) => ({
      [id]: !prev[id],
    }));
  }, []);

  const filteredMenu = useMemo(() => (
    MENU_STRUCTURE.filter((group) => {
      if (!group.requiereRol) return true;
      if (user?.rol === 'superadmin') return true;
      if (user?.rol === 'admin' && group.requiereRol === 'admin') return true;
      return false;
    })
  ), [user?.rol]);

  return (
    <aside className="mx-sidebar">
      <div className="mx-sidebar-brand">
        <img src="/img/brand/mitynex-logo-new.svg" alt="Mitynex" />
      </div>

      <TenantSelector />

      {user?.rol !== 'superadmin' && user?.empresaId && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 14px', margin: '0 8px 4px',
          background: 'rgba(255,255,255,0.06)', borderRadius: '8px',
          minWidth: 0,
        }}>
          {user.empresaId.config?.logo ? (
            <img
              src={user.empresaId.config.logo}
              alt={user.empresaId.nombre}
              style={{ width: '22px', height: '22px', objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }}
            />
          ) : (
            <Building2 size={16} style={{ flexShrink: 0, opacity: 0.7 }} />
          )}
          <span style={{
            fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {user.empresaId.nombre}
          </span>
        </div>
      )}

      <div className="mx-global-search">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder="Buscar proveedor, centro..."
          className="mx-search-input"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = e.target.value.trim();
              if (val) {
                navigate(`/gestion/proveedores?q=${encodeURIComponent(val)}`);
                e.target.value = '';
              }
            }
          }}
        />
        <div className="search-shortcut">Ctrl+K</div>
      </div>

      <nav className="mx-sidebar-menu">
        {filteredMenu.map((group) => (
          <div key={group.id} className={`mx-menu-group ${openGroups[group.id] ? 'is-open' : ''}`}>
            <button className="mx-menu-head" onClick={() => toggleGroup(group.id)}>
              <span className="mx-menu-head-label">
                <group.icon size={18} />
                {group.label}
              </span>
              {openGroups[group.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <div className="mx-submenu">
              {group.links.map((link) => (
                <NavLink
                  key={link.label}
                  to={link.to}
                  className={({ isActive }) => {
                    if (link.to.includes('?view=equipo')) {
                      return location.pathname === '/historial' && location.search.includes('view=equipo') ? 'is-active' : '';
                    }
                    if (link.to === '/historial') {
                      return location.pathname === '/historial' && !location.search.includes('view=equipo') ? 'is-active' : '';
                    }
                    return isActive ? 'is-active' : '';
                  }}
                >
                  <link.icon size={16} />
                  <span>{link.label}</span>
                  {link.alertId && alerts[link.alertId] > 0 && (
                    <span className="mx-sidebar-alert">{alerts[link.alertId]}</span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mx-sidebar-foot">
        {user && (
          <div className="mx-sidebar-user">
            <div className="mx-user-avatar">
              <User size={20} />
            </div>
            <div className="mx-user-info">
              <p className="mx-user-name">{user.nombre || user.email.split('@')[0]}</p>
              <p className="mx-user-role">{user.rol}</p>
            </div>
          </div>
        )}
        <button className="mx-btn-logout" onClick={logout}>
          <LogOut size={16} />
          Cerrar sesion
        </button>
      </div>
    </aside>
  );
}
