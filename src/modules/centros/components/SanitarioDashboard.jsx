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

const STATUS_LABELS = {
  rojo: 'Bloqueada',
  naranja: 'Alerta',
  amarillo: 'Observacion',
  verde: 'OK',
  gris: 'Sin datos',
};

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
  const [tipoFilter, setTipoFilter] = useState('');
  const [tiposAnalisis, setTiposAnalisis] = useState([]);
  const [page, setPage] = useState(1);
  const [totalAreas, setTotalAreas] = useState(0);
  const [historyModal, setHistoryModal] = useState({ open: false, area: null, loading: false, items: [] });
  const [centersModal, setCentersModal] = useState({ open: false, area: null, items: [] });

  const formatDate = useCallback((value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
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
      if (tipoFilter) params.set('tipoAnalisis', tipoFilter);

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
  }, [addToast, deferredSearchTerm, estadoFilter, selectedTenantDb, tipoFilter]);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal, 1, false);
    return () => controller.abort();
  }, [loadData]);

  useEffect(() => {
    if (!selectedTenantDb) {
      setTiposAnalisis([]);
      return undefined;
    }

    const controller = new AbortController();
    apiClient.get('/sanitario/tipos-analisis', { signal: controller.signal })
      .then((res) => setTiposAnalisis(res.items || []))
      .catch((err) => {
        if (err.name !== 'AbortError') setTiposAnalisis([]);
      });

    return () => controller.abort();
  }, [selectedTenantDb]);

  const hasMoreAreas = areas.length < totalAreas;

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
      addToast({
        title: 'No se pudo cargar historial',
        message: err?.data?.error || err?.message || 'Intenta nuevamente en unos segundos.',
        type: 'error',
      });
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
      addToast({
        title: 'Datos actualizados',
        message: 'El estado sanitario fue sincronizado correctamente desde mrSAT.',
        type: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Error',
        message: err?.data?.error || err?.message || 'No se pudo completar la sincronizacion sanitaria.',
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
          <header className="centros-kpi-label"><AlertTriangle size={16} color="#ef4444" /> Bloqueadas</header>
          <div className="centros-kpi-value">{resumen?.rojo || 0}</div>
        </article>
        <article className="centros-kpi" style={{ borderLeft: '4px solid #f97316' }}>
          <header className="centros-kpi-label"><AlertTriangle size={16} color="#f97316" /> Alerta</header>
          <div className="centros-kpi-value">{resumen?.naranja || 0}</div>
        </article>
        <article className="centros-kpi" style={{ borderLeft: '4px solid #facc15' }}>
          <header className="centros-kpi-label"><AlertTriangle size={16} color="#ca8a04" /> Observacion</header>
          <div className="centros-kpi-value">{resumen?.amarillo || 0}</div>
        </article>
        <article className="centros-kpi" style={{ borderLeft: '4px solid #22c55e' }}>
          <header className="centros-kpi-label"><CheckCircle2 size={16} color="#22c55e" /> OK</header>
          <div className="centros-kpi-value">{resumen?.verde || 0}</div>
        </article>
        <article className="centros-kpi" style={{ borderLeft: '4px solid #94a3b8' }}>
          <header className="centros-kpi-label"><Clock size={16} color="#64748b" /> Sin datos</header>
          <div className="centros-kpi-value">{resumen?.gris || 0}</div>
        </article>
      </div>

      <div className="centros-filters">
        <div className="centros-search-wrap" style={{ maxWidth: '400px' }}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar area PSMB o codigo..."
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
          <option value="rojo">Bloqueadas</option>
          <option value="naranja">Alerta</option>
          <option value="amarillo">Observacion</option>
          <option value="verde">OK</option>
          <option value="gris">Sin datos</option>
        </select>
        <select
          className="mx-input"
          style={{ width: 'auto', minWidth: '220px' }}
          value={tipoFilter}
          onChange={(event) => setTipoFilter(event.target.value)}
        >
          <option value="">Todos los analisis</option>
          {tiposAnalisis.map((tipo) => (
            <option key={tipo} value={tipo}>{tipo}</option>
          ))}
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
                <th>Codigo</th>
                <th>Area PSMB</th>
                <th>Ultimo muestreo mrSAT</th>
                <th>Estado Sernapesca</th>
                <th>Centros</th>
                <th>Ultima sync</th>
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
                        {STATUS_LABELS[area.estado || 'gris'] || 'Sin datos'}
                      </div>
                    </td>
                    <td><code>{area.codigoArea || '-'}</code></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{area.areaPSMB}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Region: {area.region}</div>
                    </td>
                    <td>
                      <div>{formatDate(area.ultimoMuestreoMrsat)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {area.ultimoAnalisisMrsat || 'Sin analisis visible'}
                      </div>
                    </td>
                    <td>{area.estadoSernapesca || 'Abierta'}</td>
                    <td>{area.centrosCount || 0}</td>
                    <td>{formatDateTime(area.ultimaSyncMrsat)}</td>
                    <td>
                      <div className="centros-actions">
                        <button className="mx-btn-icon" title="Ver centros involucrados" onClick={() => handleOpenCenters(area)}><Building2 size={16} /></button>
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
              <div className="sanitario-history-table-wrap">
                <table className="sanitario-history-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Categoria</th>
                      <th>Analisis</th>
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
                        <td>{item.categoriaTipo || '-'}</td>
                        <td>{item.tipoAnalisis || '-'}</td>
                        <td>{item.recurso || '-'}</td>
                        <td>{item.bancaNatural || '-'}</td>
                        <td>
                          <span className={item.resultadoPositivo ? 'sanitario-result is-alert' : 'sanitario-result'}>
                            {item.glosaResultado || (item.resultadoPositivo ? 'Positivo' : 'Sin alerta')}
                          </span>
                        </td>
                        <td>{[item.valorNumerico, item.unidad].filter(Boolean).join(' ') || '-'}</td>
                        <td>{item.agenteCausal || '-'}</td>
                        <td>{item.laboratorio || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {centersModal.open ? (
        <div className="sanitario-modal-backdrop" role="dialog" aria-modal="true">
          <div className="sanitario-history-modal sanitario-centers-modal">
            <header className="sanitario-modal-header">
              <div>
                <h3>Centros involucrados</h3>
                <p>{centersModal.area?.areaPSMB || 'Area sanitaria'} - Codigo {centersModal.area?.codigoArea || 'N/A'}</p>
              </div>
              <button className="mx-btn-icon" onClick={closeCentersModal} title="Cerrar">
                <X size={18} />
              </button>
            </header>

            {centersModal.items.length === 0 ? (
              <div className="sanitario-history-empty">No hay centros asociados visibles para esta area.</div>
            ) : (
              <div className="sanitario-history-table-wrap">
                <table className="sanitario-history-table sanitario-centers-table">
                  <thead>
                    <tr>
                      <th>Codigo centro</th>
                      <th>Titular</th>
                      <th>Comuna</th>
                      <th>Codigo area</th>
                      <th>Estado area</th>
                    </tr>
                  </thead>
                  <tbody>
                    {centersModal.items.map((centro) => (
                      <tr key={`${centro.code}-${centro.proveedor}`}>
                        <td><code>{centro.code || '-'}</code></td>
                        <td>{centro.proveedor || '-'}</td>
                        <td>{centro.comuna || '-'}</td>
                        <td>{centro.codigoArea || '-'}</td>
                        <td>{centro.estadoAreaSernapesca || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
