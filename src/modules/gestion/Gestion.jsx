import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './gestion.css';

const Bandeja = lazy(() => import('./submodules/Bandeja'));
const Directorio = lazy(() => import('./submodules/Directorio'));
const Calendario = lazy(() => import('./submodules/Calendario'));
const Tratos = lazy(() => import('./submodules/Tratos'));

const PAGE_META = {
  '/gestion/proveedores': {
    eyebrow: 'Directorio · Proveedores',
    title: 'Directorio de Proveedores',
  },
  '/gestion/bandeja': {
    eyebrow: 'Operaciones · Resumen',
    title: 'Resumen Operativo',
    description: 'Bandeja diaria: seguimiento comercial, visitas, interacciones y muestreos.',
  },
  '/gestion/agenda': {
    eyebrow: 'Operaciones · Agenda',
    title: 'Agenda Operacional',
  },
  '/gestion/calendario': {
    eyebrow: 'Operaciones · Agenda',
    title: 'Agenda Operacional',
  },
  '/gestion/tratos': {
    eyebrow: 'Operaciones · Tratos',
    title: 'Tratos Comerciales',
  },
};

export default function Gestion() {
  const location = useLocation();
  const pageMeta = PAGE_META[location.pathname] || PAGE_META['/gestion/tratos'];
  const isProvidersView = location.pathname === '/gestion/proveedores';

  return (
    <div className="mx-page">
      <header className={`mx-hero${pageMeta.description ? ' mx-hero--with-desc' : ''}`}>
        <div className="mx-hero-content">
          <p className="mx-eyebrow">{pageMeta.eyebrow}</p>
          <h1>{pageMeta.title}</h1>
          {pageMeta.description && <p>{pageMeta.description}</p>}
        </div>
      </header>

      <div className={`mx-content-frame gestion-content-frame ${isProvidersView ? 'gestion-content-frame--providers' : ''}`}>
        <div className="mx-submodule-body">
          <Suspense
            fallback={
              <div className="mx-loading-placeholder">
                <div className="mx-spinner"></div>
                <p>Cargando módulo...</p>
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
              <Route path="interacciones" element={<Navigate to="/historial" replace />} />
              <Route path="tratos" element={<Tratos />} />
              <Route path="muestreos" element={<Navigate to="/biomasa/muestreos" replace />} />
            </Routes>
          </Suspense>
        </div>
      </div>

    </div>
  );
}
