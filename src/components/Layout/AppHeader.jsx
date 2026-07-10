import React, { useState, useRef, useEffect } from 'react';
import { Search, User, LogOut, ChevronDown, Settings, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiClient } from '../../api/apiClient.js';
import './AppHeader.css';

const ESTADO_LABEL = { rojo: 'Rojo', naranja: 'Naranja', amarillo: 'Amarillo' };
const ACTIVIDAD_LABEL = {
  programa_cosecha: 'Programa de cosecha activo',
  trato: 'Trato en seguimiento',
  biomasa_disponible: 'Biomasa disponible',
};
const ALERTAS_POLL_MS = 5 * 60 * 1000;

export default function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [alertas, setAlertas] = useState([]);
  const [alertasOpen, setAlertasOpen] = useState(false);
  const dropdownRef = useRef(null);
  const alertasRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const activeTenant = localStorage.getItem('selected_tenant_db');
    if (!activeTenant) return;

    const controller = new AbortController();
    const fetchAlertas = () => {
      apiClient.get('/alertas-sanitarias', { signal: controller.signal })
        .then((data) => setAlertas(Array.isArray(data?.items) ? data.items : []))
        .catch(() => {});
    };
    fetchAlertas();
    const interval = setInterval(fetchAlertas, ALERTAS_POLL_MS);
    return () => { controller.abort(); clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!alertasOpen) return;
    const onDown = (e) => {
      if (!alertasRef.current?.contains(e.target)) setAlertasOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [alertasOpen]);

  const irACentro = (alerta) => {
    setAlertasOpen(false);
    navigate('/centros/sanitario');
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onDown = (e) => {
      if (!dropdownRef.current?.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [dropdownOpen]);

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      const val = e.target.value.trim();
      if (val) {
        navigate(`/gestion/proveedores?q=${encodeURIComponent(val)}`);
        e.target.value = '';
        e.target.blur();
      }
    }
  };

  return (
    <div className="mx-app-header">
      <div className="mx-app-header-search">
        <Search size={15} className="mx-ahs-icon" />
        <input
          ref={searchRef}
          type="text"
          className="mx-ahs-input"
          placeholder="Buscar proveedor, centro..."
          onKeyDown={handleSearch}
        />
        <span className="mx-ahs-shortcut">Ctrl+K</span>
      </div>

      <div className="mx-app-header-alertas" ref={alertasRef}>
        <button
          type="button"
          className="mx-aha-btn"
          onClick={() => setAlertasOpen((v) => !v)}
          title="Alertas sanitarias"
        >
          <Bell size={17} />
          {alertas.length > 0 && <span className="mx-aha-badge">{alertas.length}</span>}
        </button>

        {alertasOpen && (
          <div className="mx-aha-dropdown">
            <div className="mx-aha-dropdown-header">Alertas sanitarias</div>
            {alertas.length === 0 ? (
              <div className="mx-aha-empty">No hay alertas activas.</div>
            ) : (
              <div className="mx-aha-list">
                {alertas.map((a) => (
                  <button
                    key={`${a.centroCodigo}-${a.areaPSMB}`}
                    type="button"
                    className="mx-aha-item"
                    onClick={() => irACentro(a)}
                  >
                    <span className={`mx-aha-dot mx-aha-dot-${a.estado}`} />
                    <div className="mx-aha-item-body">
                      <div className="mx-aha-item-title">
                        {a.centroCodigo} {a.centroNombre ? `- ${a.centroNombre}` : ''}
                        <span className="mx-aha-item-estado">{ESTADO_LABEL[a.estado] || a.estado}</span>
                      </div>
                      <div className="mx-aha-item-sub">Área {a.areaPSMB}</div>
                      <div className="mx-aha-item-actividades">
                        {(a.actividades || []).map((t) => ACTIVIDAD_LABEL[t] || t).join(' · ')}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mx-app-header-user" ref={dropdownRef}>
        <button
          type="button"
          className="mx-ahu-btn"
          onClick={() => setDropdownOpen((v) => !v)}
        >
          <span className="mx-ahu-avatar"><User size={16} /></span>
          <span className="mx-ahu-name">{user?.nombre || user?.email?.split('@')[0]}</span>
          <ChevronDown size={13} className={dropdownOpen ? 'mx-ahu-chevron rotated' : 'mx-ahu-chevron'} />
        </button>

        {dropdownOpen && (
          <div className="mx-ahu-dropdown">
            <div className="mx-ahu-dropdown-info">
              <p className="mx-ahu-dname">{user?.nombre || user?.email?.split('@')[0]}</p>
              <p className="mx-ahu-drole">{user?.rol}</p>
              {user?.empresaId?.nombre && (
                <p className="mx-ahu-dcompany">{user.empresaId.nombre}</p>
              )}
            </div>
            <div className="mx-ahu-divider" />
            <button type="button" className="mx-ahu-ditem" onClick={() => { setDropdownOpen(false); navigate('/perfil'); }}>
              <Settings size={14} />
              Mi perfil y seguridad
            </button>
            <button type="button" className="mx-ahu-ditem" onClick={logout}>
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
