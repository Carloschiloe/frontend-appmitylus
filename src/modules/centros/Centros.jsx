import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { 
  Building2, 
  Map as MapIcon, 
  ShieldCheck, 
  Plus, 
  FileUp, 
  TableProperties
} from 'lucide-react';

// Lazy loading de sub-componentes para optimizar carga
const CentrosTable = lazy(() => import('./components/CentrosTable'));
const CentrosMap = lazy(() => import('./components/CentrosMap'));
const SanitarioDashboard = lazy(() => import('./components/SanitarioDashboard'));

import './centros.css';

const CENTROS_TABS = [
  { id: 'directorio', label: 'Directorio', to: '/centros/directorio', icon: TableProperties },
  { id: 'mapa',       label: 'Mapa',       to: '/centros/mapa',       icon: MapIcon },
  { id: 'sanitario',  label: 'Sanitario',  to: '/centros/sanitario',  icon: ShieldCheck }
];

export default function Centros() {
  return (
    <div className="centros-page">
      <header className="mx-hero centros-hero-shell">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Operaciones · Centros</p>
          <h1>Directorio de Centros</h1>
          <p>Gestión de concesiones, consulta de mapa y trazabilidad de datos sanitarios.</p>
        </div>
        <div className="centros-hero-actions">
          <button className="mx-btn mx-btn-outline">
            <FileUp size={18} /> Importar
          </button>
          <button className="mx-btn mx-btn-primary">
            <Plus size={20} /> Nuevo Centro
          </button>
        </div>
      </header>

      <div className="centros-content-frame">
        <div className="mx-tabs-container">
          <div className="mx-tabs">
            {CENTROS_TABS.map(tab => (
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

        <div className="centros-module-body">
          <Suspense fallback={
            <div className="mx-loading-placeholder am-flex-center" style={{ height: '200px', flexDirection: 'column', gap: '12px' }}>
              <div className="mx-spinner"></div>
              <p className="am-muted">Cargando sección...</p>
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
