import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { 
  Inbox, 
  Building2, 
  Calendar, 
  MessageSquare, 
  Users, 
  TestTube2 
} from 'lucide-react';

// Lazy loading de sub-módulos
const Bandeja = lazy(() => import('./submodules/Bandeja'));
const Directorio = lazy(() => import('./submodules/Directorio'));
const Calendario = lazy(() => import('./submodules/Calendario'));
const Interacciones = lazy(() => import('./submodules/Interacciones'));
const Tratos = lazy(() => import('./submodules/Tratos'));
const Muestreos = lazy(() => import('./submodules/Muestreos'));

const GESTION_TABS = [
  { id: 'bandeja',      label: 'Gestión',      to: '/gestion/bandeja',      icon: Inbox },
  { id: 'directorio',   label: 'Directorio',   to: '/gestion/directorio',   icon: Building2 },
  { id: 'calendario',   label: 'Calendario',   to: '/gestion/calendario',   icon: Calendar },
  { id: 'interacciones', label: 'Interacciones', to: '/gestion/interacciones', icon: MessageSquare },
  { id: 'tratos',       label: 'Tratos',       to: '/gestion/tratos',       icon: Users },
  { id: 'muestreos',    label: 'Muestreos',    to: '/gestion/muestreos',    icon: TestTube2 }
];

export default function Gestion() {
  const location = useLocation();

  return (
    <div className="gestion-page">
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Abastecimiento · Operaciones</p>
          <h1>Gestión de Proveedores</h1>
          <p>Bandeja de compromisos, agenda comercial y control de calidad.</p>
        </div>
      </header>

      <div className="gestion-content-frame">
        <div className="mx-tabs-container">
          <div className="mx-tabs">
            {GESTION_TABS.map(tab => (
              <NavLink
                key={tab.id}
                to={tab.to}
                className={({ isActive }) => `mx-tab ${isActive ? 'active' : ''}`}
              >
                <tab.icon size={18} />
                {tab.label}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="gestion-submodule-body">
          <Suspense fallback={
            <div className="mx-loading-placeholder">
              <div className="mx-spinner"></div>
              <p>Cargando sub-módulo...</p>
            </div>
          }>
            <Routes>
              <Route path="/" element={<Navigate to="bandeja" replace />} />
              <Route path="bandeja" element={<Bandeja />} />
              <Route path="directorio" element={<Directorio />} />
              <Route path="calendario" element={<Calendario />} />
              <Route path="interacciones" element={<Interacciones />} />
              <Route path="tratos" element={<Tratos />} />
              <Route path="muestreos" element={<Muestreos />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </div>
  );
}
