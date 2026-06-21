import React, { useCallback, useEffect, useDeferredValue, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  X,
  Building2,
} from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { useToast } from '../../../context/ToastContext';

const PAGE_SIZE = 100;

const STATUS_CONFIG = {
  rojo:     { label: 'Bloqueadas',  color: '#ef4444', bg: '#fef2f2' },
  naranja:  { label: 'Alerta',      color: '#f97316', bg: '#fff7ed' },
  amarillo: { label: 'Observación', color: '#ca8a04', bg: '#fefce8' },
  verde:    { label: 'OK',          color: '#22c55e', bg: '#f0fdf4' },
  gris:     { label: 'Sin datos',   color: '#94a3b8', bg: '#f8fafc' },
};

function SernapescaBadge({ value }) {
  if (!value) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
  const v = value.toLowerCase();
  const style =
    v === 'abierta'
      ? { background: '#dcfce7', color: '#166534' }
      : v === 'inactiva' || v === 'eliminada'
      ? { background: '#fee2e2', color: '#991b1b' }
      : { background: 'var(--color-bg)', color: 'var(--color-text-muted)' };
  return (
    <span style={{
      ...style,
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 9px', borderRadius: '4px',
      fontSize: '12px', fontWeight: 500,
    }}>
      {value}
    </span>
  );
}

const sanitarioViewCache = {
  tenantDb: '',
  areas: [],
  resumen: null,
  tiposAnalisis: [],
  totalAreas: 0,
  page: 1,
};

export default function SanitarioDashboard() {
  const { addToast } = useToast();
  const selectedTenantDb = localStorage.getItem('selected_tenant_db') || '';
  const hasCachedView = sanitarioViewCache.tenantDb === selectedTenantDb && sanitarioViewCache.areas.length > 0;
  const [areas, setAreas] = useState(() => hasCachedView ? sanitarioViewCache.areas : []);
  const [loading, setLoading] = useState(() => !hasCachedView);
  const [syncing, setSyncing] = useState(false);
  const [resumen, setResumen] = useState(() => hasCachedView ? sanitarioViewCache.resumen : null);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [estadoFilter, setEstadoFilter] = useState('');
  const [sernapescaFilter, setSernapescaFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [tiposAnalisis, setTiposAnalisis] = useState(() =>
    sanitarioViewCache.tenantDb === selectedTenantDb ? sanitarioViewCache.tiposAnalisis : []
  );
  const [page, setPage] = useState(() => hasCachedView ? sanitarioViewCache.page : 1);
  const [totalAreas, setTotalAreas] = useState(() => hasCachedView ? sanitarioViewCache.totalAreas : 0);
  const [historyModal, setHistoryModal] = useState({ open: false, area: null, loading: false, items: [] });
  const [centersModal, setCentersModal] = useState({ open: false, area: null, items: [] });

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

    const hasUsableCache = sanitarioViewCache.tenantDb === selectedTenantDb && sanitarioViewCache.areas.length > 0;
    if (!append && !hasUsableCache) {
      setAreas([]);
      setLoading(true);
    }

    try {
      const params = new URLSearchParams({ page: String(nextPage), limit: String(PAGE_SIZE) });
      if (deferredSearchTerm.trim()) params.set('q', deferredSearchTerm.trim());
      if (estadoFilter) params.set('estado', estadoFilter);
      if (tipoFilter) params.set('tipoAnalisis', tipoFilter);

      const [resAreas, resResumen] = await Promise.all([
        apiClient.get(`/sanitario/areas?${params.toString()}`, { signal }),
        apiClient.get('/sanitario/resumen', { signal }),
      ]);

      const cachedAreas = sanitarioViewCache.tenantDb === selectedTenantDb ? sanitarioViewCache.areas : [];
      const nextAreas = append ? [...cachedAreas, ...(resAreas.items || [])] : (resAreas.items || []);
      const nextTotalAreas = Number(resAreas.total) || 0;
      const resolvedPage = Number(resAreas.page) || nextPage;

      setAreas(nextAreas);
      setTotalAreas(nextTotalAreas);
      setPage(resolvedPage);
      setResumen(resResumen);
      sanitarioViewCache.tenantDb = selectedTenantDb;
      sanitarioViewCache.areas = nextAreas;
      sanitarioViewCache.resumen = resResumen;
      sanitarioViewCache.totalAreas = nextTotalAreas;
      sanitarioViewCache.page = resolvedPage;
    } catch (err) {
      if (err.name === 'AbortError') return;
      addToast({ title: 'Error', message: 'No se pudieron cargar los datos sanitarios.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addToast, deferredSearchTerm, estadoFilter, selectedTenantDb, tipoFilter]);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal, 1, false);
    return () => controller.abort();
  }, [loadData]);

  useEffect(() => {
    if (!selectedTenantDb) { setTiposAnalisis([]); return undefined; }
    const controller = new AbortController();
    apiClient.get('/sanitario/tipos-analisis', { signal: controller.signal })
      .then((res) => {
        const items = res.items || [];
        setTiposAnalisis(items);
        sanitarioViewCache.tenantDb = selectedTenantDb;
        sanitarioViewCache.tiposAnalisis = items;
      })
      .catch((err) => { if (err.name !== 'AbortError') setTiposAnalisis([]); });
    return () => controller.abort();
  }, [selectedTenantDb]);

  // Filtro cliente por estado SERNAPESCA (complementa filtros de servidor)
  const displayedAreas = sernapescaFilter
    ? areas.filter((a) => a.estadoSernapesca === sernapescaFilter)
    : areas;

  const hasMoreAreas = areas.length < totalAreas;

  const handleKpiClick = useCallback((estado) => {
    setEstadoFilter((prev) => (prev === estado ? '' : estado));
  }, []);

  const handleLoadMore = useCallback(() => {
    loadData(undefined, page + 1, true);
  }, [loadData, page]);

  const handleOpenHistory = useCallback(async (area) => {
    if (!area?.areaPSMB) return;
    setHistoryModal({ open: true, area, loading: true, items: [] });
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (tipoFilter) params.set('tipoAnalisis', tipoFilter);
      const res = await apiClient.get(`/sanitario/historial/${encodeURIComponent(area.areaPSMB)}?${params.toString()}`);
      setHistoryModal({ open: true, area, loading: false, items: res.items || [] });
    } catch (err) {
      setHistoryModal({ open: true, area, loading: false, items: [] });
      addToast({ title: 'No se pudo cargar historial', message: err?.data?.error || err?.message || 'Intenta nuevamente.', type: 'error' });
    }
  }, [addToast, tipoFilter]);

  const closeHistoryModal = useCallback(() => {
    setHistoryModal({ open: false, area: null, loading: false, items: [] });
  }, []);

  const handleOpenCenters = useCallback((area) => {
    setCentersModal({ open: true, area, items: Array.isArray(area?.centros) ? area.centros : [] });
  }, []);

  const closeCentersModal = useCallback(() => {
    setCentersModal({ open: false, area: null, items: [] });
  }, []);

  const handleSyncMrSat = useCallback(async () => {
    if (!selectedTenantDb || syncing) return;
    setSyncing(true);
    try {
      await apiClient.post('/sanitario/sync/mrsat', {});
      await loadData(undefined, 1, false);
      addToast({ title: 'Datos actualizados', message: 'Estado sanitario sincronizado desde mrSAT.', type: 'success' });
    } catch (err) {
      addToast({ title: 'Error', message: err?.data?.error || err?.message || 'No se pudo completar la sincronización.', type: 'error' });
    } finally {
      setSyncing(false);
    }
  }, [addToast, loadData, selectedTenantDb, syncing]);

  return (
    <div className="sanitario-dashboard">
      {!selectedTenantDb && (
        <div className="mx-table-card" style={{ padding: '24px', marginBottom: '16px' }}>
          <strong style={{ display: 'block', marginBottom: '6px' }}>Selecciona una empresa</strong>
          <span style={{ color: 'var(--color-text-subtle)' }}>
            Debes elegir una empresa para consultar el estado sanitario y sincronizar mrSAT.
          </span>
        </div>
      )}

      {/* KPIs — clickables para filtrar */}
      <div className="centros-kpis sanitario-kpis">
        {Object.entries(STATUS_CONFIG).map(([key, { label, color, bg }]) => {
          const isActive = estadoFilter === key;
          return (
            <article
              key={key}
              className="centros-kpi"
              role="button"
              tabIndex={0}
              onClick={() => handleKpiClick(key)}
              onKeyDown={(e) => e.key === 'Enter' && handleKpiClick(key)}
              style={{
                borderLeft: `4px solid ${color}`,
                cursor: 'pointer',
                outline: 'none',
                boxShadow: isActive ? `0 0 0 2px ${color}` : undefined,
                background: isActive ? bg : undefined,
              }}
              title={`Filtrar por: ${label}`}
            >
              <header className="centros-kpi-label">
                {key === 'verde' ? <CheckCircle2 size={16} color={color} /> : <AlertTriangle size={16} color={color} />}
                {label}
                {isActive && <X size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
              </header>
              <div className="centros-kpi-value">{resumen?.[key] || 0}</div>
            </article>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="centros-filters">
        <div className="centros-search-wrap" style={{ maxWidth: '360px' }}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar área PSMB o código..."
            className="centros-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button type="button" onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)' }}>
              <X size={13} />
            </button>
          )}
        </div>

        <select className="mx-input" style={{ width: 'auto' }} value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="rojo">Bloqueadas</option>
          <option value="naranja">Alerta</option>
          <option value="amarillo">Observación</option>
          <option value="verde">OK</option>
          <option value="gris">Sin datos</option>
        </select>

        <select className="mx-input" style={{ width: 'auto' }} value={sernapescaFilter} onChange={(e) => setSernapescaFilter(e.target.value)}>
          <option value="">Estado SERNAPESCA</option>
          <option value="Abierta">Abierta</option>
          <option value="Inactiva">Inactiva</option>
          <option value="Eliminada">Eliminada</option>
        </select>

        <select className="mx-input" style={{ width: 'auto', minWidth: '200px' }} value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)}>
          <option value="">Todos los análisis</option>
          {tiposAnalisis.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
        </select>

        <div style={{ flex: 1 }} />

        <div className="mx-sync-badge">
          <Clock size={14} />
          <span>Sincronizado: {formatDateTime(resumen?.ultimaSync)}</span>
        </div>
        <button className="mx-btn mx-btn-outline" onClick={handleSyncMrSat} disabled={syncing}>
          <RefreshCw size={16} style={syncing ? { animation: 'spin 1s linear infinite' } : {}} />
          {syncing ? 'Sincronizando...' : 'Actualizar mrSAT'}
        </button>
      </div>

      {/* Tabla */}
      <div className="centros-table-card">
        <div className="centros-table-wrap">
          <table className="centros-tbl">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Código</th>
                <th>Área PSMB</th>
                <th>Último muestreo mrSAT</th>
                <th>Estado SERNAPESCA</th>
                <th style={{ textAlign: 'center' }}>Centros</th>
                <th style={{ textAlign: 'right' }}>Historial</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="mx-spinner" style={{ margin: '0 auto 12px' }} />
                    <p>Cargando datos sanitarios...</p>
                  </td>
                </tr>
              ) : displayedAreas.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                    <p>No se encontraron áreas sanitarias con los filtros actuales.</p>
                  </td>
                </tr>
              ) : (
                displayedAreas.map((area) => (
                  <tr key={area._id}>
                    <td>
                      <div className={`centros-badge-sanitario ${area.estado || 'gris'}`}>
                        <ShieldCheck size={14} />
                        {STATUS_CONFIG[area.estado || 'gris']?.label || 'Sin datos'}
                      </div>
                    </td>
                    <td><code>{area.codigoArea || '—'}</code></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{area.areaPSMB}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        {area.region} · sync {formatDate(area.ultimaSyncMrsat)}
                      </div>
                    </td>
                    <td>
                      <div>{formatDate(area.ultimoMuestreoMrsat)}</div>
                      {area.ultimoAnalisisMrsat && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          {area.ultimoAnalisisMrsat}
                        </div>
                      )}
                    </td>
                    <td>
                      <SernapescaBadge value={area.estadoSernapesca || null} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="sanitario-centros-count"
                        onClick={() => handleOpenCenters(area)}
                        title={`Ver ${area.centrosCount || 0} centros de ${area.areaPSMB}`}
                      >
                        {area.centrosCount || 0}
                      </button>
                    </td>
                    <td>
                      <div className="centros-actions">
                        <button className="mx-btn-icon" title="Ver historial de muestreos" onClick={() => handleOpenHistory(area)}>
                          <Clock size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && totalAreas > 0 && (
        <div className="centros-pagination-footer">
          <span>
            Mostrando {displayedAreas.length} de {sernapescaFilter ? areas.length : totalAreas} áreas sanitarias
            {sernapescaFilter && ` (filtradas por SERNAPESCA: ${sernapescaFilter})`}
          </span>
          {hasMoreAreas && !sernapescaFilter && (
            <button className="mx-btn mx-btn-outline" onClick={handleLoadMore}>Ver más</button>
          )}
        </div>
      )}

      {/* Modal historial */}
      {historyModal.open && (
        <div className="sanitario-modal-backdrop" role="dialog" aria-modal="true">
          <div className="sanitario-history-modal">
            <header className="sanitario-modal-header">
              <div>
                <h3>Historial sanitario</h3>
                <p>{historyModal.area?.areaPSMB} · Código {historyModal.area?.codigoArea || '—'}</p>
              </div>
              <button className="mx-btn-icon" onClick={closeHistoryModal} title="Cerrar"><X size={18} /></button>
            </header>
            {historyModal.loading ? (
              <div className="sanitario-history-empty">
                <div className="mx-spinner" style={{ margin: '0 auto 12px' }} />
                <span>Cargando historial...</span>
              </div>
            ) : historyModal.items.length === 0 ? (
              <div className="sanitario-history-empty">Sin registros históricos para esta área.</div>
            ) : (
              <div className="sanitario-history-table-wrap">
                <table className="sanitario-history-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Categoría</th>
                      <th>Análisis</th>
                      <th>Recurso</th>
                      <th>B. Natural</th>
                      <th>Glosa</th>
                      <th>Valor</th>
                      <th>Agente</th>
                      <th>Laboratorio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyModal.items.map((item) => (
                      <tr key={item._id}>
                        <td>{formatDate(item.fechaExtraccion || item.createdAt)}</td>
                        <td>{item.categoriaTipo || '—'}</td>
                        <td>{item.tipoAnalisis || '—'}</td>
                        <td>{item.recurso || '—'}</td>
                        <td>{item.bancaNatural || '—'}</td>
                        <td>
                          <span className={item.resultadoPositivo ? 'sanitario-result is-alert' : 'sanitario-result'}>
                            {item.glosaResultado || (item.resultadoPositivo ? 'Positivo' : 'Sin alerta')}
                          </span>
                        </td>
                        <td>{[item.valorNumerico, item.unidad].filter(Boolean).join(' ') || '—'}</td>
                        <td>{item.agenteCausal || '—'}</td>
                        <td>{item.laboratorio || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal centros */}
      {centersModal.open && (
        <div className="sanitario-modal-backdrop" role="dialog" aria-modal="true">
          <div className="sanitario-history-modal sanitario-centers-modal">
            <header className="sanitario-modal-header">
              <div>
                <h3>Centros del área</h3>
                <p>{centersModal.area?.areaPSMB} · Código {centersModal.area?.codigoArea || '—'}</p>
              </div>
              <button className="mx-btn-icon" onClick={closeCentersModal} title="Cerrar"><X size={18} /></button>
            </header>
            {centersModal.items.length === 0 ? (
              <div className="sanitario-history-empty">No hay centros asociados para esta área.</div>
            ) : (
              <div className="sanitario-history-table-wrap">
                <table className="sanitario-history-table sanitario-centers-table">
                  <thead>
                    <tr>
                      <th>Código centro</th>
                      <th>Titular</th>
                      <th>Comuna</th>
                      <th>Código área</th>
                      <th>Estado área</th>
                    </tr>
                  </thead>
                  <tbody>
                    {centersModal.items.map((centro) => (
                      <tr key={`${centro.code}-${centro.proveedor}`}>
                        <td><code>{centro.code || '—'}</code></td>
                        <td>{centro.proveedor || '—'}</td>
                        <td>{centro.comuna || '—'}</td>
                        <td>{centro.codigoArea || '—'}</td>
                        <td><SernapescaBadge value={centro.estadoAreaSernapesca || null} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
