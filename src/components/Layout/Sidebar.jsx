import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Droplet,
  History,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  Calendar,
  Users,
  ShieldCheck,
  TableProperties,
  Database,
  BarChart3,
  ClipboardList,
  Bug,
  CircleHelp,
  FileUp,
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
      { label: 'Resumen', to: '/gestion/bandeja', icon: ClipboardList },
    ],
  },
  {
    id: 'directorio',
    label: 'Directorio',
    icon: Building2,
    links: [
      { label: 'Proveedores', to: '/gestion/proveedores', icon: Building2 },
      { label: 'Centros', to: '/centros/directorio', icon: TableProperties, activeFor: ['/centros/directorio', '/centros/mapa'] },
      { label: 'Agenda', to: '/gestion/agenda', icon: Calendar },
      { label: 'Biomasa', to: '/biomasa/status', icon: Droplet, activeFor: ['/biomasa/status', '/biomasa/tratos', '/biomasa/programa', '/biomasa/muestreos'] },
    ],
  },
  {
    id: 'inteligencia',
    label: 'Trazabilidad',
    icon: BarChart3,
    links: [
      { label: 'Sanitario', to: '/centros/sanitario', icon: ShieldCheck, alertId: 'sanitario' },
      { label: 'Historial', to: '/historial', icon: History },
    ],
  },
  {
    id: 'ayuda',
    label: 'Ayuda',
    icon: CircleHelp,
    links: [
      { label: 'Ayuda', to: '/ayuda', icon: CircleHelp },
    ],
  },
  {
    id: 'administracion',
    label: 'Administración',
    icon: Settings,
    requiereRol: 'admin',
    links: [
      { label: 'Maestros', to: '/configuracion/maestros', icon: Database },
      { label: 'Usuarios', to: '/configuracion/usuarios', icon: Users },
      { label: 'Importar datos', to: '/configuracion/importar', icon: FileUp },
      { label: 'Soporte tecnico', to: '/gestion/soporte/errores', icon: Bug, alertId: 'errorReports' },
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
  const [openGroup, setOpenGroup] = useState('dashboard');
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
          setOpenGroup('inteligencia');
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError' || err.status === 401) return;
      });

    if (user.rol === 'admin' || user.rol === 'superadmin') {
      apiClient.get('/support/error-reports?status=new&limit=1', { signal: controller.signal })
        .then((data) => {
          if (!data) return;
          if ((data.total || 0) > 0) {
            setAlerts((prev) => ({ ...prev, errorReports: data.total }));
          }
        })
        .catch((err) => {
          if (err.name === 'AbortError' || err.status === 401) return;
        });
    }

    return () => controller.abort();
  }, [selectedTenantDb, user]);

  useEffect(() => {
    if (location.pathname.startsWith('/gestion/soporte/errores')) {
      setAlerts((prev) => ({ ...prev, errorReports: 0 }));
    }
  }, [location.pathname]);

  useEffect(() => {
    const activeGroup = MENU_STRUCTURE.find((group) => (
      group.links.some((link) => {
        if (link.onClick) return false;
        if (link.activeFor) {
          return link.activeFor.some((p) => location.pathname.startsWith(p));
        }
        const [path] = link.to.split('?');
        return location.pathname.startsWith(path);
      })
    ));
    if (activeGroup) {
      setOpenGroup(activeGroup.id);
    }
  }, [location.pathname]);

  const toggleGroup = useCallback((id) => {
    setOpenGroup((prev) => (prev === id ? null : id));
  }, []);

  const filteredMenu = useMemo(() => (
    MENU_STRUCTURE
      .filter((group) => {
        if (!group.requiereRol) return true;
        if (user?.rol === 'superadmin') return true;
        if (user?.rol === 'admin' && group.requiereRol === 'admin') return true;
        return false;
      })
      .map((group) => {
        if (group.id !== 'ayuda') return group;
        return {
          ...group,
          links: [
            ...group.links,
            { label: 'Cerrar sesión', icon: LogOut, onClick: logout, mobileOnly: true },
          ],
        };
      })
  ), [user?.rol, logout]);

  return (
    <aside className="mx-sidebar">
      <div className="mx-sidebar-brand">
        <img src="/img/brand/mitynex-logo-new.svg" alt="Mitynex" />
      </div>

      <TenantSelector />

      {user?.rol !== 'superadmin' && user?.empresaId && (
        <div className="mx-sidebar-company">
          {user.empresaId.config?.logo ? (
            <img
              src={user.empresaId.config.logo}
              alt={user.empresaId.nombre}
              className="mx-sidebar-company-logo"
            />
          ) : (
            <Building2 size={16} className="mx-sidebar-company-icon" />
          )}
          <span className="mx-sidebar-company-name">
            {user.empresaId.nombre}
          </span>
        </div>
      )}

      <nav className="mx-sidebar-menu">
        {filteredMenu.map((group) => (
          <div key={group.id} className={`mx-menu-group ${openGroup === group.id ? 'is-open' : ''}`}>
            <button className="mx-menu-head" onClick={() => toggleGroup(group.id)}>
              <span className="mx-menu-head-label">
                <group.icon size={18} />
                {group.label}
              </span>
              {openGroup === group.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <div className="mx-submenu">
              {group.links.map((link) => {
                if (link.onClick) {
                  return (
                    <button
                      key={link.label}
                      type="button"
                      className={link.mobileOnly ? 'mx-submenu-action mx-submenu-action--mobile-only' : 'mx-submenu-action'}
                      onClick={link.onClick}
                    >
                      <link.icon size={16} />
                      <span>{link.label}</span>
                    </button>
                  );
                }
                return (
                  <NavLink
                    key={link.label}
                    to={link.to}
                    className={({ isActive }) => {
                      if (link.activeFor) {
                        return link.activeFor.some((p) => location.pathname.startsWith(p)) ? 'is-active' : '';
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
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Reportar problema — botón standalone al fondo del sidebar ── */}
      <div className="mx-sidebar-report">
        <button
          type="button"
          className="mx-sidebar-report-btn"
          onClick={() => window.dispatchEvent(new CustomEvent('mitynex:open-support-report'))}
        >
          <Bug size={15} />
          <span>Reportar problema</span>
        </button>
      </div>

    </aside>
  );
}
