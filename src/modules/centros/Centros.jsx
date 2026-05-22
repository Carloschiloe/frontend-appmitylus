import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { 
  Map as MapIcon, 
  Plus, 
  FileUp, 
  TableProperties
} from 'lucide-react';

// Lazy loading con preload para que el cambio entre pestanas sea fluido.
const loadCentrosTable = () => import('./components/CentrosTable');
const loadCentrosMap = () => import('./components/CentrosMap');
const loadSanitarioDashboard = () => import('./components/SanitarioDashboard');

const CentrosTable = lazy(loadCentrosTable);
const CentrosMap = lazy(loadCentrosMap);
const SanitarioDashboard = lazy(loadSanitarioDashboard);

import './centros.css';

const CENTROS_TABS = [
  { id: 'directorio', label: 'Directorio', to: '/centros/directorio', icon: TableProperties, preload: loadCentrosTable },
  { id: 'mapa',       label: 'Mapa',       to: '/centros/mapa',       icon: MapIcon, preload: loadCentrosMap }
];

const getPageMeta = (pathname) => {
  if (pathname.startsWith('/centros/sanitario')) {
    return {
      eyebrow: 'Inteligencia - Sanitario',
      title: 'Estado Sanitario',
      showActions: false
    };
  }

  if (pathname.startsWith('/centros/mapa')) {
    return {
      eyebrow: 'Directorio - Mapa',
      title: 'Mapa de Centros',
      showActions: true
    };
  }

  return {
    eyebrow: 'Directorio - Centros',
    title: 'Directorio de Centros',
    showActions: true
  };
};

export default function Centros() {
  const location = useLocation();
  const isSanitarioView = location.pathname.startsWith('/centros/sanitario');
  const pageMeta = getPageMeta(location.pathname);

  const notifyCreateCentro = () => {
    window.dispatchEvent(new CustomEvent('centros:open-create'));
  };

  const notifyImportCentros = () => {
    window.dispatchEvent(new CustomEvent('centros:open-import'));
  };

  return (
    <div className="mx-page">
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">{pageMeta.eyebrow}</p>
          <h1>{pageMeta.title}</h1>
        </div>
        {pageMeta.showActions && (
          <div className="mx-hero-actions">
            <button
              className="mx-btn mx-btn-outline centros-import-btn"
              onClick={notifyImportCentros}
            >
              <FileUp size={18} /> Importar
            </button>
            <button className="mx-btn mx-btn-primary" onClick={notifyCreateCentro}>
              <Plus size={20} /> Nuevo Centro
            </button>
          </div>
        )}
      </header>

      <div className="mx-content-frame centros-content-frame">
        {!isSanitarioView && (
          <div className="mx-tabs-container">
            <div className="mx-tabs">
              {CENTROS_TABS.map(tab => (
                <NavLink
                  key={tab.id}
                  to={tab.to}
                  onMouseEnter={tab.preload}
                  onFocus={tab.preload}
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
          <Suspense fallback={
            <div className="mx-loading-placeholder am-flex-center" style={{ height: '200px', flexDirection: 'column', gap: '12px' }}>
              <div className="mx-spinner"></div>
              <p className="am-muted">Cargando seccion...</p>
            </div>
          }>
            <Routes>
              <Route path="/" element={<Navigate to="directorio" replace />} />
              <Route path="directorio" element={<CentrosTable />} />
              <Route path="mapa" element={<CentrosMap />} />
              <Route path="sanitario" element={<SanitarioDashboard />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </div>
  );

}
