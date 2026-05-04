import React, { useState, useEffect } from 'react';
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
  MessageSquare,
  Users,
  TestTube2,
  Map,
  ShieldCheck,
  TableProperties,
  Search
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../api/apiClient';
import TenantSelector from './TenantSelector';
import './Sidebar.css';

const MENU_STRUCTURE = [
  {
    id: 'dashboard',
    label: 'Inicio',
    icon: LayoutDashboard,
    links: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard }
    ]
  },
  {
    id: 'gestion',
    label: 'Gestión',
    icon: Inbox,
    links: [
      { label: 'Bandeja', to: '/gestion/bandeja', icon: Inbox },
      { label: 'Calendario', to: '/gestion/calendario', icon: Calendar },
      { label: 'Interacciones', to: '/gestion/interacciones', icon: MessageSquare },
      { label: 'Tratos', to: '/gestion/tratos', icon: Users },
      { label: 'Muestreos', to: '/gestion/muestreos', icon: TestTube2 }
    ]
  },
  {
    id: 'centros',
    label: 'Centros',
    icon: Building2,
    links: [
      { label: 'Directorio', to: '/centros/directorio', icon: TableProperties },
      { label: 'Mapa', to: '/centros/mapa', icon: Map },
      { label: 'Estado Sanitario', to: '/centros/sanitario', icon: ShieldCheck, alertId: 'sanitario' }
    ]
  },
  {
    id: 'biomasa',
    label: 'Biomasa',
    icon: Droplet,
    links: [
      { label: 'Status', to: '/biomasa/status', icon: LayoutDashboard },
      { label: 'Programa', to: '/biomasa/programa', icon: Calendar }
    ]
  },
  {
    id: 'historial',
    label: 'Historial',
    icon: History,
    links: [
      { label: 'Gestiones', to: '/historial', icon: History }
    ]
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    icon: Settings,
    requiereRol: 'admin',
    links: [
      { label: 'Maestros', to: '/configuracion/maestros', icon: Settings },
      { label: 'Usuarios', to: '/configuracion/usuarios', icon: Users }
    ]
  },
  {
    id: 'saas',
    label: 'Administración SaaS',
    icon: ShieldCheck,
    requiereRol: 'superadmin',
    links: [
      { label: 'Empresas', to: '/configuracion/empresas', icon: Building2 }
    ]
  }
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [openGroups, setOpenGroups] = useState({ dashboard: true });
  const [alerts, setAlerts] = useState({});

  useEffect(() => {
    // Cargar alertas sanitarias solo si hay usuario
    if (!user) return;

    const controller = new AbortController();

    apiClient.get('/sanitario/resumen', { signal: controller.signal })
      .then(data => {
        if (!data) return;
        const criticas = (data.rojo || 0) + (data.naranja || 0);
        if (criticas > 0) {
          setAlerts(prev => ({ ...prev, sanitario: criticas }));
          setOpenGroups({ centros: true });
        }
      })
      .catch(err => {
        if (err.name === 'AbortError' || err.status === 401) return;
      });

    return () => controller.abort();
  }, [user]);

  // Abrir automáticamente el grupo que contiene la ruta activa
  useEffect(() => {
    const activeGroup = MENU_STRUCTURE.find(group => 
      group.links.some(link => location.pathname.startsWith(link.to))
    );
    if (activeGroup) {
      setOpenGroups({ [activeGroup.id]: true }); // Solo el grupo activo se mantiene abierto
    }
  }, [location.pathname]);

  const toggleGroup = (id) => {
    setOpenGroups(prev => ({
      [id]: !prev[id]
    }));
  };

  return (
    <aside className="mx-sidebar">
      <div className="mx-sidebar-brand">
        <img src="/img/logo-sidebar.png" alt="Mitynex" />
      </div>

      <TenantSelector />

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
                navigate(`/gestion/directorio?q=${encodeURIComponent(val)}`);
                e.target.value = ''; // clean up input
              }
            }
          }}
        />
        <div className="search-shortcut">⌘K</div>
      </div>

      <nav className="mx-sidebar-menu">
        {MENU_STRUCTURE.filter(group => {
          if (!group.requiereRol) return true;
          // Superadmin ve todo
          if (user?.rol === 'superadmin') return true;
          // Admin ve configuración y lo demás (excepto saas que requiere explícitamente superadmin)
          if (user?.rol === 'admin' && group.requiereRol === 'admin') return true;
          return false;
        }).map(group => (
          <div key={group.id} className={`mx-menu-group ${openGroups[group.id] ? 'is-open' : ''}`}>
            <button className="mx-menu-head" onClick={() => toggleGroup(group.id)}>
              <span className="mx-menu-head-label">
                <group.icon size={18} />
                {group.label}
              </span>
              {openGroups[group.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <div className="mx-submenu">
              {group.links.map(link => (
                <NavLink 
                  key={link.label} 
                  to={link.to}
                  className={({ isActive }) => isActive ? 'is-active' : ''}
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
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
