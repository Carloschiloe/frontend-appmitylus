import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
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
  TableProperties,
  Bug,
  CircleHelp,
  ArrowLeft,
  Inbox,
  Handshake,
  ShoppingCart,
  TestTube2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiClient } from '../../api/apiClient.js';
import TenantSelector from './TenantSelector.jsx';
import './Sidebar.css';

const MENU_STRUCTURE = [
  {
    id: 'inicio',
    label: 'Inicio',
    icon: LayoutDashboard,
    links: [
      { label: 'Dashboard',  to: '/dashboard',     icon: LayoutDashboard },
      { label: 'Agenda',     to: '/gestion/agenda', icon: Calendar },
    ],
  },
  {
    id: 'proveedores',
    label: 'Proveedores',
    icon: Building2,
    links: [
      { label: 'Centros',    to: '/centros/directorio',  icon: TableProperties, activeFor: ['/centros/directorio', '/centros/mapa', '/centros/sanitario'], alertId: 'sanitario' },
      { label: 'Directorio', to: '/gestion/proveedores', icon: Building2 },
      { label: 'Historial',  to: '/historial',           icon: History },
    ],
  },
  {
    id: 'operaciones',
    label: 'Operaciones',
    icon: Droplet,
    links: [
      { label: 'Disponibilidad', to: '/biomasa/status',    icon: Inbox },
      { label: 'Tratos',         to: '/biomasa/tratos',    icon: Handshake },
      { label: 'Prog. Cosecha',  to: '/biomasa/programa',  icon: ShoppingCart },
      { label: 'Muestreos',      to: '/biomasa/muestreos', icon: TestTube2 },
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
      { label: 'Configuración', to: '/configuracion', icon: Settings, activeFor: ['/configuracion/maestros', '/configuracion/usuarios', '/configuracion/importar'] },
    ],
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [openGroup, setOpenGroup] = useState('inicio');
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
          setOpenGroup('proveedores');
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

  const modulosPermitidos = user?.modulosPermitidos || [];
  const tieneAccesoAcotado = modulosPermitidos.length > 0;

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
      // Acceso acotado (ej. cuenta de un departamento externo): solo se ven
      // los módulos explícitamente permitidos, el resto del menú se oculta.
      .map((group) => (
        tieneAccesoAcotado
          ? { ...group, links: group.links.filter((l) => l.onClick || modulosPermitidos.includes(l.to)) }
          : group
      ))
      // Un grupo solo cuenta como visible si le queda al menos un link real
      // (navegable); un botón de acción como "Cerrar sesión" (mobileOnly) no
      // alcanza para mantener el header del grupo (ej. "Ayuda") visible.
      .filter((group) => group.links.some((l) => !l.onClick))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [user?.rol, tieneAccesoAcotado, modulosPermitidos.join(','), logout]);

  return (
    <aside className="mx-sidebar">
      <div className="mx-sidebar-brand">
        <img src="/img/brand/mitynex-logo-new.svg" alt="Mitynex" />
      </div>

      <TenantSelector />

      {user?.rol === 'superadmin' && selectedTenantDb && (
        <Link to="/saas-admin" className="mx-sidebar-saas-back">
          <ArrowLeft size={13} />
          Panel SaaS
        </Link>
      )}

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
        {filteredMenu.map((group) => {
          const realLinks = group.links.filter((l) => !l.onClick && !l.mobileOnly);
          const mobileActions = group.links.filter((l) => l.mobileOnly);

          // Single real-link group → render as a direct NavLink (no accordion)
          if (realLinks.length === 1) {
            const directLink = realLinks[0];
            const isActive = directLink.activeFor
              ? directLink.activeFor.some((p) => location.pathname.startsWith(p))
              : location.pathname.startsWith(directLink.to.split('?')[0]);
            return (
              <div key={group.id} className="mx-menu-group">
                <NavLink
                  to={directLink.to}
                  className={`mx-menu-head${isActive ? ' is-active' : ''}`}
                >
                  <span className="mx-menu-head-label">
                    <group.icon size={18} />
                    {group.label}
                  </span>
                </NavLink>
                {mobileActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="mx-submenu-action mx-submenu-action--mobile-only"
                    onClick={action.onClick}
                  >
                    <action.icon size={16} />
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            );
          }

          // Multi-link group → accordion (existing behavior)
          return (
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
          );
        })}
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
