import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  ExternalLink,
} from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { useToast } from '../../../context/ToastContext';

export default function SanitarioDashboard() {
  const { addToast } = useToast();
  const selectedTenantDb = localStorage.getItem('selected_tenant_db') || '';
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [resumen, setResumen] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const formatDate = useCallback((value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('es-CL');
  }, []);

  const formatDateTime = useCallback((value) => {
    if (!value) return 'Nunca';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Nunca';
    return date.toLocaleString('es-CL');
  }, []);

  const loadData = useCallback(async (signal) => {
    if (!selectedTenantDb) {
      setAreas([]);
      setResumen(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [resAreas, resResumen] = await Promise.all([
        apiClient.get('/sanitario/areas', { signal }),
        apiClient.get('/sanitario/resumen', { signal }),
      ]);
      setAreas(resAreas.items || []);
      setResumen(resResumen);
    } catch (err) {
      if (err.name === 'AbortError') return;
      addToast({ title: 'Error', message: 'No se pudieron cargar los datos sanitarios.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addToast, selectedTenantDb]);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const filteredAreas = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return areas;
    return areas.filter((area) =>
      area.areaPSMB?.toLowerCase().includes(normalized) ||
      area.codigoArea?.toLowerCase().includes(normalized)
    );
  }, [areas, searchTerm]);

  const handleSyncMrSat = useCallback(async () => {
    if (!selectedTenantDb || syncing) return;
    setSyncing(true);

    try {
      await apiClient.post('/sanitario/sync/mrsat', {});
      await loadData();
      addToast({
        title: 'Datos actualizados',
        message: 'El estado sanitario fue sincronizado correctamente desde mrSAT.',
        type: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Error',
        message: err?.data?.error || err?.message || 'No se pudo completar la sincronización sanitaria.',
        type: 'error',
      });
    } finally {
      setSyncing(false);
    }
  }, [addToast, loadData, selectedTenantDb, syncing]);

  return (
    <div className="sanitario-dashboard">
      {!selectedTenantDb ? (
        <div className="mx-table-card" style={{ padding: '24px', marginBottom: '16px' }}>
          <strong style={{ display: 'block', marginBottom: '6px' }}>Selecciona una empresa</strong>
          <span style={{ color: 'var(--color-text-subtle)' }}>
            Debes elegir una empresa para consultar el estado sanitario y sincronizar mrSAT.
          </span>
        </div>
      ) : null}

      <div className="centros-kpis">
        <article className="centros-kpi" style={{ borderLeft: '4px solid #ef4444' }}>
          <header className="centros-kpi-label"><AlertTriangle size={16} color="#ef4444" /> Bloqueadas (Rojo)</header>
          <div className="centros-kpi-value">{resumen?.rojo || 0}</div>
        </article>
        <article className="centros-kpi" style={{ borderLeft: '4px solid #f97316' }}>
          <header className="centros-kpi-label"><AlertTriangle size={16} color="#f97316" /> Alerta (Naranja)</header>
          <div className="centros-kpi-value">{resumen?.naranja || 0}</div>
        </article>
        <article className="centros-kpi" style={{ borderLeft: '4px solid #22c55e' }}>
          <header className="centros-kpi-label"><CheckCircle2 size={16} color="#22c55e" /> OK (Verde)</header>
          <div className="centros-kpi-value">{resumen?.verde || 0}</div>
        </article>
      </div>

      <div className="centros-filters">
        <div className="centros-search-wrap" style={{ maxWidth: '400px' }}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar área PSMB o código..."
            className="centros-search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}></div>
        <div className="mx-sync-badge">
          <Clock size={14} />
          <span>Sincronizado: {formatDateTime(resumen?.ultimaSync)}</span>
        </div>
        <button className="mx-btn mx-btn-outline" onClick={handleSyncMrSat} disabled={syncing}>
          <RefreshCw size={18} /> {syncing ? 'Sincronizando mrSAT...' : 'Actualizar mrSAT'}
        </button>
      </div>

      <div className="centros-table-card">
        <div className="centros-table-wrap">
          <table className="centros-tbl">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Código</th>
                <th>Área PSMB</th>
                <th>Último muestreo mrSAT</th>
                <th>Estado Sernapesca</th>
                <th>Centros</th>
                <th>Última sync</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="mx-spinner" style={{ margin: '0 auto 12px' }}></div>
                    <p>Sincronizando estados sanitarios...</p>
                  </td>
                </tr>
              ) : (
                filteredAreas.map((area) => (
                  <tr key={area._id}>
                    <td>
                      <div className={`centros-badge-sanitario ${area.estado || 'gris'}`}>
                        <ShieldCheck size={14} />
                        {(area.estado || 'gris').toUpperCase()}
                      </div>
                    </td>
                    <td><code>{area.codigoArea || '—'}</code></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{area.areaPSMB}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Región: {area.region}</div>
                    </td>
                    <td>
                      <div>{formatDate(area.ultimoMuestreoMrsat)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {area.ultimoAnalisisMrsat || 'Sin análisis visible'}
                      </div>
                    </td>
                    <td>{area.estadoSernapesca || 'Abierta'}</td>
                    <td>{area.centrosCount || 0}</td>
                    <td>{formatDateTime(area.ultimaSyncMrsat)}</td>
                    <td>
                      <div className="centros-actions">
                        <button className="mx-btn-icon" title="Ver historial"><Clock size={16} /></button>
                        <button className="mx-btn-icon" title="Ver en SISCOMEX"><ExternalLink size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
