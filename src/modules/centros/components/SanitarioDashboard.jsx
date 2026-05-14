import React, { useCallback, useEffect, useDeferredValue, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { useToast } from '../../../context/ToastContext';

const PAGE_SIZE = 100;

export default function SanitarioDashboard() {
  const { addToast } = useToast();
  const selectedTenantDb = localStorage.getItem('selected_tenant_db') || '';
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [resumen, setResumen] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [estadoFilter, setEstadoFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalAreas, setTotalAreas] = useState(0);
  const [historyModal, setHistoryModal] = useState({ open: false, area: null, loading: false, items: [] });

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

  const loadData = useCallback(async (signal, nextPage = 1, append = false) => {
    if (!selectedTenantDb) {
      setAreas([]);
      setResumen(null);
      setTotalAreas(0);
      setLoading(false);
      return;
    }
    if (!append) setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(PAGE_SIZE),
      });
      if (deferredSearchTerm.trim()) params.set('q', deferredSearchTerm.trim());
      if (estadoFilter) params.set('estado', estadoFilter);

      const [resAreas, resResumen] = await Promise.all([
        apiClient.get(`/sanitario/areas?${params.toString()}`, { signal }),
        apiClient.get('/sanitario/resumen', { signal }),
      ]);
      setAreas((current) => append ? [...current, ...(resAreas.items || [])] : (resAreas.items || []));
      setTotalAreas(Number(resAreas.total) || 0);
      setPage(Number(resAreas.page) || nextPage);
      setResumen(resResumen);
    } catch (err) {
      if (err.name === 'AbortError') return;
      addToast({ title: 'Error', message: 'No se pudieron cargar los datos sanitarios.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addToast, deferredSearchTerm, estadoFilter, selectedTenantDb]);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal, 1, false);
    return () => controller.abort();
  }, [loadData]);

  const hasMoreAreas = areas.length < totalAreas;

  const handleLoadMore = useCallback(() => {
    loadData(undefined, page + 1, true);
  }, [loadData, page]);

  const handleOpenHistory = useCallback(async (area) => {
    if (!area?.areaPSMB) return;
    setHistoryModal({ open: true, area, loading: true, items: [] });
    try {
      const res = await apiClient.get(`/sanitario/historial/${encodeURIComponent(area.areaPSMB)}?limit=20`);
      setHistoryModal({ open: true, area, loading: false, items: res.items || [] });
    } catch (err) {
      setHistoryModal({ open: true, area, loading: false, items: [] });
      addToast({
        title: 'No se pudo cargar historial',
        message: err?.data?.error || err?.message || 'Intenta nuevamente en unos segundos.',
        type: 'error',
      });
    }
  }, [addToast]);

  const closeHistoryModal = useCallback(() => {
    setHistoryModal({ open: false, area: null, loading: false, items: [] });
  }, []);

  const handleSyncMrSat = useCallback(async () => {
    if (!selectedTenantDb || syncing) return;
    setSyncing(true);

    try {
      await apiClient.post('/sanitario/sync/mrsat', {});
      await loadData(undefined, 1, false);
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

      <div className="centros-kpis sanitario-kpis">
        <article className="centros-kpi" style={{ borderLeft: '4px solid #ef4444' }}>
          <header className="centros-kpi-label"><AlertTriangle size={16} color="#ef4444" /> Bloqueadas (Rojo)</header>
          <div className="centros-kpi-value">{resumen?.rojo || 0}</div>
        </article>
        <article className="centros-kpi" style={{ borderLeft: '4px solid #f97316' }}>
          <header className="centros-kpi-label"><AlertTriangle size={16} color="#f97316" /> Alerta (Naranja)</header>
          <div className="centros-kpi-value">{resumen?.naranja || 0}</div>
        </article>
        <article className="centros-kpi" style={{ borderLeft: '4px solid #facc15' }}>
          <header className="centros-kpi-label"><AlertTriangle size={16} color="#ca8a04" /> Observacion (Amarillo)</header>
          <div className="centros-kpi-value">{resumen?.amarillo || 0}</div>
        </article>
        <article className="centros-kpi" style={{ borderLeft: '4px solid #22c55e' }}>
          <header className="centros-kpi-label"><CheckCircle2 size={16} color="#22c55e" /> OK (Verde)</header>
          <div className="centros-kpi-value">{resumen?.verde || 0}</div>
        </article>
        <article className="centros-kpi" style={{ borderLeft: '4px solid #94a3b8' }}>
          <header className="centros-kpi-label"><Clock size={16} color="#64748b" /> Sin datos (Gris)</header>
          <div className="centros-kpi-value">{resumen?.gris || 0}</div>
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
        <select
          className="mx-input"
          style={{ width: 'auto' }}
          value={estadoFilter}
          onChange={(event) => setEstadoFilter(event.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="rojo">Rojo</option>
          <option value="naranja">Naranja</option>
          <option value="amarillo">Amarillo</option>
          <option value="verde">Verde</option>
          <option value="gris">Sin datos</option>
        </select>
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
              ) : areas.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                    <p>No se encontraron areas sanitarias con los filtros actuales.</p>
                  </td>
                </tr>
              ) : (
                areas.map((area) => (
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
                        <button className="mx-btn-icon" title="Ver historial" onClick={() => handleOpenHistory(area)}><Clock size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && totalAreas > 0 ? (
        <div className="centros-pagination-footer">
          <span>Mostrando {areas.length} de {totalAreas} areas sanitarias</span>
          {hasMoreAreas ? (
            <button className="mx-btn mx-btn-outline" onClick={handleLoadMore}>
              Ver mas
            </button>
          ) : null}
        </div>
      ) : null}

      {historyModal.open ? (
        <div className="sanitario-modal-backdrop" role="dialog" aria-modal="true">
          <div className="sanitario-history-modal">
            <header className="sanitario-modal-header">
              <div>
                <h3>Historial sanitario</h3>
                <p>{historyModal.area?.areaPSMB || 'Area sanitaria'} - Codigo {historyModal.area?.codigoArea || 'N/A'}</p>
              </div>
              <button className="mx-btn-icon" onClick={closeHistoryModal} title="Cerrar">
                <X size={18} />
              </button>
            </header>

            {historyModal.loading ? (
              <div className="sanitario-history-empty">
                <div className="mx-spinner" style={{ margin: '0 auto 12px' }}></div>
                <span>Cargando historial...</span>
              </div>
            ) : historyModal.items.length === 0 ? (
              <div className="sanitario-history-empty">Sin registros historicos visibles para esta area.</div>
            ) : (
              <div className="sanitario-history-list">
                {historyModal.items.map((item) => (
                  <article key={item._id} className="sanitario-history-item">
                    <div>
                      <strong>{formatDate(item.fechaExtraccion || item.createdAt)}</strong>
                      <span>{item.tipoAnalisis || item.agenteCausal || item.recurso || 'Registro sanitario'}</span>
                    </div>
                    <b className={item.resultadoPositivo ? 'is-alert' : ''}>
                      {item.resultadoPositivo ? 'Positivo' : 'Sin alerta'}
                    </b>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
