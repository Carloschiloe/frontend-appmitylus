import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  X,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { useToast } from '../../../context/ToastContext';

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

const SS_CACHE_KEY = 'mx_sanitario_v1';
const SS_CACHE_TTL = 15 * 60 * 1000; // 15 min

function ssLoad(tenantDb) {
  try {
    const raw = sessionStorage.getItem(SS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.tenantDb !== tenantDb) return null;
    if (Date.now() - parsed.ts > SS_CACHE_TTL) return null;
    return parsed;
  } catch { return null; }
}
function ssSave(tenantDb, areas, resumen, tiposAnalisis) {
  try {
    sessionStorage.setItem(SS_CACHE_KEY, JSON.stringify({ tenantDb, ts: Date.now(), areas, resumen, tiposAnalisis }));
  } catch {}
}
function ssClear() {
  try { sessionStorage.removeItem(SS_CACHE_KEY); } catch {}
}

// Cache en módulo para evitar re-cargas entre navegaciones dentro de la misma pestaña
const sanitarioViewCache = {
  tenantDb: '',
  areas: [],
  resumen: null,
  tiposAnalisis: [],
};

const MRSAT_SYNC_TIMEOUT_MS = 180000;

export default function SanitarioDashboard() {
  const { addToast } = useToast();
  const selectedTenantDb = localStorage.getItem('selected_tenant_db') || '';

  const _ssCache = ssLoad(selectedTenantDb);
  const hasCachedView =
    (_ssCache && _ssCache.areas.length > 0) ||
    (sanitarioViewCache.tenantDb === selectedTenantDb && sanitarioViewCache.areas.length > 0);

  // Estado base — áreas SIN filtrar (se filtran client-side)
  const [allAreas, setAllAreas] = useState(() => {
    if (_ssCache?.areas?.length) return _ssCache.areas;
    if (sanitarioViewCache.tenantDb === selectedTenantDb) return sanitarioViewCache.areas;
    return [];
  });
  const [loading, setLoading]   = useState(() => !hasCachedView);
  const [syncing, setSyncing]   = useState(false);
  const [resumen, setResumen]   = useState(() => {
    if (_ssCache?.resumen) return _ssCache.resumen;
    if (sanitarioViewCache.tenantDb === selectedTenantDb) return sanitarioViewCache.resumen;
    return null;
  });
  const [tiposAnalisis, setTiposAnalisis] = useState(() => {
    if (_ssCache?.tiposAnalisis?.length) return _ssCache.tiposAnalisis;
    if (sanitarioViewCache.tenantDb === selectedTenantDb) return sanitarioViewCache.tiposAnalisis;
    return [];
  });

  // Filtros — todos client-side excepto tipoAnalisis (que cambia el dataset)
  const [searchTerm,      setSearchTerm]      = useState('');
  const [estadoFilter,    setEstadoFilter]    = useState('');
  const [sernapescaFilter,setSernapescaFilter] = useState('');
  const [tipoFilter,      setTipoFilter]      = useState('');
  const [sortConfig,      setSortConfig]      = useState({ key: null, dir: 'asc' });

  // Modales
  const [historyModal,  setHistoryModal]  = useState({ open: false, area: null, loading: false, items: [] });
  const [centersModal,  setCentersModal]  = useState({ open: false, area: null, items: [] });

  // ── Helpers de formato ─────────────────────────────────────────
  const formatDate = useCallback((value) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-CL');
  }, []);

  const formatDateTime = useCallback((value) => {
    if (!value) return 'Nunca';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 'Nunca' : d.toLocaleString('es-CL');
  }, []);

  // ── Carga de datos — sin filtros de búsqueda (carga TODO) ──────
  const loadData = useCallback(async (signal) => {
    if (!selectedTenantDb) {
      setAllAreas([]);
      setResumen(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // limit=200 para traer todas las áreas en una sola llamada
      const params = new URLSearchParams({ page: '1', limit: '200' });
      if (tipoFilter) params.set('tipoAnalisis', tipoFilter);

      const [resAreas, resResumen] = await Promise.all([
        apiClient.get(`/sanitario/areas?${params.toString()}`, { signal }),
        apiClient.get('/sanitario/resumen', { signal }),
      ]);

      const items = resAreas.items || [];
      setAllAreas(items);
      setResumen(resResumen);
      sanitarioViewCache.tenantDb = selectedTenantDb;
      sanitarioViewCache.areas    = items;
      sanitarioViewCache.resumen  = resResumen;
      ssSave(selectedTenantDb, items, resResumen, sanitarioViewCache.tiposAnalisis);
    } catch (err) {
      if (err.name === 'AbortError') return;
      addToast({ title: 'Error', message: 'No se pudieron cargar los datos sanitarios.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addToast, selectedTenantDb, tipoFilter]);

  useEffect(() => {
    const ctrl = new AbortController();
    loadData(ctrl.signal);
    return () => ctrl.abort();
  }, [loadData]);

  // Tipos de análisis disponibles
  useEffect(() => {
    if (!selectedTenantDb) { setTiposAnalisis([]); return undefined; }
    const ctrl = new AbortController();
    apiClient.get('/sanitario/tipos-analisis', { signal: ctrl.signal })
      .then((res) => {
        const items = res.items || [];
        setTiposAnalisis(items);
        sanitarioViewCache.tiposAnalisis = items;
        ssSave(selectedTenantDb, sanitarioViewCache.areas, sanitarioViewCache.resumen, items);
      })
      .catch((err) => { if (err.name !== 'AbortError') setTiposAnalisis([]); });
    return () => ctrl.abort();
  }, [selectedTenantDb]);

  // ── Filtrado + orden client-side ────────────────────────────
  const displayedAreas = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = allAreas.filter((area) => {
      if (q) {
        const matchesQ =
          (area.areaPSMB  || '').toLowerCase().includes(q) ||
          String(area.codigoArea || '').toLowerCase().includes(q);
        if (!matchesQ) return false;
      }
      if (estadoFilter && area.estado !== estadoFilter) return false;
      if (sernapescaFilter && area.estadoSernapesca !== sernapescaFilter) return false;
      return true;
    });

    if (sortConfig.key) {
      const ESTADO_ORD = { rojo: 4, naranja: 3, amarillo: 2, verde: 1, gris: 0 };
      filtered.sort((a, b) => {
        let av, bv;
        if (sortConfig.key === 'estado') {
          av = ESTADO_ORD[a.estado] ?? 0;
          bv = ESTADO_ORD[b.estado] ?? 0;
        } else if (sortConfig.key === 'ultimoMuestreoMrsat') {
          av = a.ultimoMuestreoMrsat ? new Date(a.ultimoMuestreoMrsat).getTime() : 0;
          bv = b.ultimoMuestreoMrsat ? new Date(b.ultimoMuestreoMrsat).getTime() : 0;
        } else if (sortConfig.key === 'centrosCount') {
          av = a.centrosCount || 0;
          bv = b.centrosCount || 0;
        } else {
          av = String(a[sortConfig.key] || '').toLowerCase();
          bv = String(b[sortConfig.key] || '').toLowerCase();
        }
        if (av < bv) return sortConfig.dir === 'asc' ? -1 : 1;
        if (av > bv) return sortConfig.dir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [allAreas, searchTerm, estadoFilter, sernapescaFilter, sortConfig]);

  const handleSort = useCallback((key) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
  }, []);

  // ── Handlers ──────────────────────────────────────────────────
  const handleKpiClick = useCallback((estado) => {
    setEstadoFilter((prev) => (prev === estado ? '' : estado));
  }, []);

  const handleSyncMrSat = useCallback(async () => {
    if (!selectedTenantDb || syncing) return;
    setSyncing(true);
    ssClear();
    try {
      await apiClient.post('/sanitario/sync/mrsat', {}, { timeoutMs: MRSAT_SYNC_TIMEOUT_MS });
      await loadData(undefined);
      addToast({ title: 'Datos actualizados', message: 'Estado sanitario sincronizado desde mrSAT.', type: 'success' });
    } catch (err) {
      if (err?.name === 'AbortError') {
        await loadData(undefined);
        addToast({
          title: 'Sincronizacion en curso',
          message: 'mrSAT tardo mas de lo esperado. Actualice la tabla con la ultima informacion disponible; si faltan datos, vuelve a intentar en unos segundos.',
          type: 'warning',
        });
        return;
      }
      addToast({ title: 'Error', message: err?.data?.error || err?.message || 'No se pudo completar la sincronización.', type: 'error' });
    } finally {
      setSyncing(false);
    }
  }, [addToast, loadData, selectedTenantDb, syncing]);

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

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="sanitario-dashboard">
      {!selectedTenantDb && (
        <div className="mx-table-card" style={{ padding: '24px', marginBottom: '16px' }}>
          <strong style={{ display: 'block', marginBottom: '6px' }}>Selecciona una empresa</strong>
          <span style={{ color: 'var(--color-text-subtle)' }}>
            Debes elegir una empresa para consultar el estado sanitario.
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
                {key === 'verde'
                  ? <CheckCircle2 size={16} color={color} />
                  : <AlertTriangle size={16} color={color} />}
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
        {/* Búsqueda — client-side, respuesta instantánea */}
        <div className="centros-search-wrap" style={{ maxWidth: '340px' }}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar área o código..."
            className="centros-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)' }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <select
          className="mx-input"
          style={{ width: 'auto' }}
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="rojo">Bloqueadas</option>
          <option value="naranja">Alerta</option>
          <option value="amarillo">Observación</option>
          <option value="verde">OK</option>
          <option value="gris">Sin datos</option>
        </select>

        <select
          className="mx-input"
          style={{ width: 'auto' }}
          value={sernapescaFilter}
          onChange={(e) => setSernapescaFilter(e.target.value)}
        >
          <option value="">Estado SERNAPESCA</option>
          <option value="Abierta">Abierta</option>
          <option value="Inactiva">Inactiva</option>
          <option value="Eliminada">Eliminada</option>
        </select>

        <select
          className="mx-input"
          style={{ width: 'auto', minWidth: '190px' }}
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value)}
        >
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
                {[
                  { label: 'Estado',               key: 'estado' },
                  { label: 'Código',               key: 'codigoArea' },
                  { label: 'Área PSMB',            key: 'areaPSMB' },
                  { label: 'Último muestreo mrSAT',key: 'ultimoMuestreoMrsat' },
                  { label: 'Estado SERNAPESCA',    key: 'estadoSernapesca' },
                  { label: 'Centros',              key: 'centrosCount', center: true },
                ].map(({ label, key, center }) => (
                  <th key={key} style={center ? { textAlign: 'center' } : undefined}>
                    <button className="sanitario-th-sort" onClick={() => handleSort(key)}>
                      {label}
                      {sortConfig.key === key
                        ? sortConfig.dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                        : <ChevronsUpDown size={12} className="sanitario-th-sort-idle" />}
                    </button>
                  </th>
                ))}
                <th style={{ textAlign: 'right' }}>Historial</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="sanitario-skel-row">
                    <td><div className="skel skel-badge" /></td>
                    <td><div className="skel skel-sm" /></td>
                    <td>
                      <div className="skel skel-md" />
                      <div className="skel skel-xs" style={{ marginTop: 5 }} />
                    </td>
                    <td><div className="skel skel-sm" /></td>
                    <td><div className="skel skel-badge" /></td>
                    <td style={{ textAlign: 'center' }}><div className="skel skel-xs" style={{ margin: '0 auto' }} /></td>
                    <td style={{ textAlign: 'right' }}><div className="skel skel-icon" style={{ marginLeft: 'auto' }} /></td>
                  </tr>
                ))
              ) : displayedAreas.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                    <p style={{ color: 'var(--color-text-muted)' }}>
                      No se encontraron áreas con los filtros actuales.
                    </p>
                    {(searchTerm || estadoFilter || sernapescaFilter) && (
                      <button
                        className="mx-btn mx-btn-outline"
                        style={{ marginTop: '10px' }}
                        onClick={() => { setSearchTerm(''); setEstadoFilter(''); setSernapescaFilter(''); }}
                      >
                        Limpiar filtros
                      </button>
                    )}
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

      {/* Contador de resultados */}
      {!loading && allAreas.length > 0 && (
        <div className="centros-pagination-footer">
          <span>
            {displayedAreas.length === allAreas.length
              ? `${allAreas.length} áreas sanitarias`
              : `${displayedAreas.length} de ${allAreas.length} áreas`}
          </span>
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
