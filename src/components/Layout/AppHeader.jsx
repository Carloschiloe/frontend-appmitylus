import React, { useState, useRef, useEffect } from 'react';
import { Search, User, LogOut, ChevronDown, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import AlertasCampana from './AlertasCampana.jsx';
import './AppHeader.css';

export default function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

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

      <AlertasCampana />

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
