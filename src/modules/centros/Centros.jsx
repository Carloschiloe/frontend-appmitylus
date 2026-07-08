import React, { Suspense, lazy, useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Map as MapIcon,
  Plus,
  TableProperties,
  RefreshCw,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { syncSernapescaAreas, getUltimaSyncSernapesca } from '../../api/api-centros';
import { useToast } from '../../context/ToastContext';

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
  { id: 'mapa',       label: 'Mapa',       to: '/centros/mapa',       icon: MapIcon,         preload: loadCentrosMap },
  { id: 'sanitario',  label: 'Sanitario',  to: '/centros/sanitario',  icon: ShieldCheck,     preload: loadSanitarioDashboard },
];

const getPageMeta = (pathname) => {
  if (pathname.startsWith('/centros/sanitario')) {
    return {
      eyebrow: 'Centros · Sanitario',
      title: 'Estado Sanitario',
      showActions: false,
    };
  }

  if (pathname.startsWith('/centros/mapa')) {
    return {
      eyebrow: 'Centros · Mapa',
      title: 'Mapa de Centros',
      showActions: true,
    };
  }

  return {
    eyebrow: 'Proveedores · Centros',
    title: 'Directorio de Centros',
    showActions: true,
  };
};

export default function Centros() {
  const location = useLocation();
  const pageMeta = getPageMeta(location.pathname);
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [ultimaSync, setUltimaSync] = useState(null);

  const loadUltimaSync = useCallback(() => {
    getUltimaSyncSernapesca().then(setUltimaSync).catch(() => {});
  }, []);

  useEffect(() => {
    loadUltimaSync();
  }, [loadUltimaSync]);

  const notifyCreateCentro = () => {
    window.dispatchEvent(new CustomEvent('centros:open-create'));
  };

  const notifyImportCentros = () => {
    window.dispatchEvent(new CustomEvent('centros:open-import'));
  };

  const handleSyncSernapesca = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await syncSernapescaAreas();
      addToast({ title: 'Áreas SERNAPESCA actualizadas', message: `Se sincronizaron ${result?.areas || 0} áreas.`, type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['centros'] });
      loadUltimaSync();
    } catch (err) {
      addToast({ title: 'Error al sincronizar', message: err?.data?.error || err?.message || 'No se pudo conectar con SERNAPESCA.', type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const formatUltimaSync = (value) => {
    if (!value) return 'Nunca';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 'Nunca' : d.toLocaleString('es-CL');
  };

  return (
    <div className="mx-page">
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">{pageMeta.eyebrow}</p>
          <h1>{pageMeta.title}</h1>
        </div>
      </header>

      <div className="mx-content-frame centros-content-frame">
        <div className="mx-tabs-container centros-tabs-row">
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
          {pageMeta.showActions && (
            <div className="centros-tab-actions">
              <div className="centros-sync-group">
                <button
                  className="mx-btn mx-btn-outline centros-import-btn"
                  onClick={handleSyncSernapesca}
                  disabled={syncing}
                  title="Descargar estado actualizado de áreas desde SERNAPESCA"
                >
                  <RefreshCw size={16} style={syncing ? { animation: 'spin 1s linear infinite' } : {}} />
                  {syncing ? 'Actualizando...' : 'Actualizar Est. Áreas'}
                </button>
                <span className="centros-sync-caption">
                  <Clock size={11} /> Última actualización: {formatUltimaSync(ultimaSync)}
                </span>
              </div>
              <button
                className="mx-btn mx-btn-outline centros-import-btn"
                onClick={notifyImportCentros}
                title="Sincronizar centros desde SUBPESCA"
              >
                <RefreshCw size={16} /> Actualizar Centros
              </button>
              <button className="mx-btn mx-btn-primary" onClick={notifyCreateCentro}>
                <Plus size={20} /> Nuevo Centro
              </button>
            </div>
          )}
        </div>

        <div className="mx-submodule-body">
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
