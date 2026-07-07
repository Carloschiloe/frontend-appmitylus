import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { Database, Users, FileUp } from 'lucide-react';

const Maestros     = lazy(() => import('./Maestros'));
const Usuarios     = lazy(() => import('./Usuarios'));
const ImportarDatos = lazy(() => import('./ImportarDatos'));

const TABS = [
  { id: 'maestros', label: 'Maestros',       to: '/configuracion/maestros', icon: Database },
  { id: 'usuarios', label: 'Usuarios',        to: '/configuracion/usuarios', icon: Users   },
  { id: 'importar', label: 'Importar datos',  to: '/configuracion/importar', icon: FileUp  },
];

const getPageMeta = (pathname) => {
  if (pathname.startsWith('/configuracion/usuarios')) return { eyebrow: 'Administración · Usuarios',      title: 'Gestión de Usuarios' };
  if (pathname.startsWith('/configuracion/importar'))  return { eyebrow: 'Administración · Importar',     title: 'Importar Datos' };
  return { eyebrow: 'Administración · Parámetros', title: 'Maestros del Sistema' };
};

export default function Configuracion() {
  const location = useLocation();
  const { eyebrow, title } = getPageMeta(location.pathname);

  return (
    <div className="mx-page">
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
      </header>

      <div className="mx-content-frame configuracion-content-frame">
        <div className="mx-tabs-container">
          <div className="mx-tabs">
            {TABS.map((tab) => (
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

        <div className="mx-submodule-body">
          <Suspense fallback={
            <div className="mx-loading-placeholder" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px' }}>
              <div className="mx-spinner"></div>
              <p>Cargando...</p>
            </div>
          }>
            <Routes>
              <Route path="/" element={<Navigate to="maestros" replace />} />
              <Route path="maestros" element={<Maestros noPage />} />
              <Route path="usuarios" element={<Usuarios noPage />} />
              <Route path="importar" element={<ImportarDatos noPage />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </div>
  );
}
