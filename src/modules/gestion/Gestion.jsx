import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import {
  Calendar,
  Handshake,
} from 'lucide-react';
import QuickCaptureModal from './components/QuickCaptureModal';

const Bandeja = lazy(() => import('./submodules/Bandeja'));
const Directorio = lazy(() => import('./submodules/Directorio'));
const Calendario = lazy(() => import('./submodules/Calendario'));
const Interacciones = lazy(() => import('./submodules/Interacciones'));
const Tratos = lazy(() => import('./submodules/Tratos'));

const OPERATION_TABS = [
  { id: 'tratos', label: 'Tratos', to: '/gestion/tratos', icon: Handshake },
  { id: 'agenda', label: 'Agenda', to: '/gestion/agenda', icon: Calendar },
];

const PAGE_META = {
  '/gestion/proveedores': {
    eyebrow: 'Directorio · Proveedores',
    title: 'Directorio de Proveedores',
  },
  '/gestion/bandeja': {
    eyebrow: 'Operacion · Resumen',
    title: 'Resumen Operativo',
  },
  '/gestion/agenda': {
    eyebrow: 'Operacion · Agenda',
    title: 'Agenda Operacional',
  },
  '/gestion/calendario': {
    eyebrow: 'Operacion · Agenda',
    title: 'Agenda Operacional',
  },
  '/gestion/tratos': {
    eyebrow: 'Operacion · Tratos',
    title: 'Tratos Comerciales',
  },
};

export default function Gestion() {
  const location = useLocation();
  const isOperationalPath = ['/gestion/tratos', '/gestion/agenda', '/gestion/calendario'].some((path) =>
    location.pathname.startsWith(path)
  );
  const pageMeta = PAGE_META[location.pathname] || PAGE_META['/gestion/tratos'];

  return (
    <div className="mx-page">
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">{pageMeta.eyebrow}</p>
          <h1>{pageMeta.title}</h1>
        </div>
      </header>

      <div className="mx-content-frame">
        {isOperationalPath && (
          <div className="mx-tabs-container">
            <div className="mx-tabs">
              {OPERATION_TABS.map((tab) => (
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
        )}

        <div className="mx-submodule-body">
          <Suspense
            fallback={
              <div className="mx-loading-placeholder">
                <div className="mx-spinner"></div>
                <p>Cargando modulo...</p>
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Navigate to="tratos" replace />} />
              <Route path="bandeja" element={<Bandeja />} />
              <Route path="proveedores" element={<Directorio />} />
              <Route path="directorio" element={<Navigate to="/gestion/proveedores" replace />} />
              <Route path="agenda" element={<Calendario />} />
              <Route path="calendario" element={<Navigate to="/gestion/agenda" replace />} />
              <Route path="interacciones" element={<Interacciones />} />
              <Route path="tratos" element={<Tratos />} />
              <Route path="muestreos" element={<Navigate to="/biomasa/muestreos" replace />} />
            </Routes>
          </Suspense>
        </div>
      </div>

      <QuickCaptureModal />
    </div>
  );
}
