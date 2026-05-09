import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import {
  Inbox,
  Building2,
  Calendar,
  MessageSquare,
  Handshake,
} from 'lucide-react';
import QuickCaptureModal from './components/QuickCaptureModal';

const Bandeja = lazy(() => import('./submodules/Bandeja'));
const Directorio = lazy(() => import('./submodules/Directorio'));
const Calendario = lazy(() => import('./submodules/Calendario'));
const Interacciones = lazy(() => import('./submodules/Interacciones'));
const Tratos = lazy(() => import('./submodules/Tratos'));

const GESTION_TABS = [
  { id: 'bandeja', label: 'Resumen', to: '/gestion/bandeja', icon: Inbox },
  { id: 'proveedores', label: 'Proveedores', to: '/gestion/proveedores', icon: Building2 },
  { id: 'tratos', label: 'Negociaciones', to: '/gestion/tratos', icon: Handshake },
  { id: 'agenda', label: 'Agenda', to: '/gestion/agenda', icon: Calendar },
];

const GESTION_TOOL_LINKS = [
  { id: 'interacciones', label: 'Interacciones', to: '/gestion/interacciones', icon: MessageSquare },
];

export default function Gestion() {
  return (
    <div className="mx-page">
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Abastecimiento · Operaciones</p>
          <h1>Gestión de Proveedores</h1>
        </div>
      </header>

      <div className="mx-content-frame">
        <div className="mx-tabs-container">
          <div className="mx-tabs">
            {GESTION_TABS.map((tab) => (
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

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            flexWrap: 'wrap',
            marginTop: '10px',
            marginBottom: '18px',
            paddingInline: '6px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#64748b',
            }}
          >
            Herramientas
          </span>

          <div className="mx-toggle-group">
            {GESTION_TOOL_LINKS.map((tool) => (
              <NavLink
                key={tool.id}
                to={tool.to}
                className={({ isActive }) => `mx-toggle-btn ${isActive ? 'active' : ''}`}
              >
                <tool.icon size={16} />
                {tool.label}
              </NavLink>
            ))}
          </div>

          <p
            style={{
              flexBasis: '100%',
              margin: 0,
              color: '#64748b',
              fontSize: '0.88rem',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: '#0f172a' }}>Interacciones</strong> se mantiene como herramienta de registro y carga manual para el equipo operativo.
          </p>
        </div>

        <div className="mx-submodule-body">
          <Suspense
            fallback={
              <div className="mx-loading-placeholder">
                <div className="mx-spinner"></div>
                <p>Cargando sub-módulo...</p>
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Navigate to="bandeja" replace />} />
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
