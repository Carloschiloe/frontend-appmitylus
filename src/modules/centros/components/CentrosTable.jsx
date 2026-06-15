import React, { useState, useEffect, useMemo, useCallback, useDeferredValue, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Eye,
  Edit,
  Trash2,
  Download,
  MapPin,
  Building2,
  Ruler,
  X,
  Plus,
} from 'lucide-react';
import { deleteCentro, exportCentros, getCentros, syncSubpesca, upsertCentro } from '../../../api/api-centros';
import { useToast } from '../../../context/ToastContext';
import ConfirmDeleteModal from '../../../components/ConfirmDeleteModal';

const PAGE_SIZE = 100;

const isSalmonCentro = (centro = {}) => {
  const especies = Array.isArray(centro.especies) ? centro.especies.join(' ') : centro.especies || '';
  const text = `${centro.grupoEspecie || ''} ${especies}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\b(salmon|salmonido|trucha)/.test(text);
};

export default function CentrosTable() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const selectedTenantDb = localStorage.getItem('selected_tenant_db') || '';

  const { data: rawData = [], isLoading: loading } = useQuery({
    queryKey: ['centros', 'directorio'],
    queryFn: ({ signal }) => getCentros({}, { signal }),
    enabled: Boolean(selectedTenantDb),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });

  const data = useMemo(() => {
    const items = Array.isArray(rawData) ? rawData : (rawData.items || []);
    return items
      .filter((centro) => !isSalmonCentro(centro))
      .map((centro) => ({
        ...centro,
        areaPSMB: centro.areaPSMB || centro.sanitario?.areaPSMB || '',
        codigoArea: centro.codigoArea || centro.sanitario?.codigoArea || '',
        estadoAreaSernapesca: centro.estadoAreaSernapesca || centro.sanitario?.estadoSernapesca || 'Desconocido',
      }));
  }, [rawData]);

  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [areaSearchTerm, setAreaSearchTerm] = useState(searchParams.get('areaQ') || '');
  const deferredAreaSearchTerm = useDeferredValue(areaSearchTerm);
  const [comunaFilter, setComunaFilter] = useState(searchParams.get('comuna') || '');
  const [areaFilter, setAreaFilter] = useState(searchParams.get('area') || '');
  const [providerFilter, setProviderFilter] = useState(searchParams.get('proveedor') || '');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchWrapperRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [modalState, setModalState] = useState({ open: false, mode: 'create', item: null });

  useEffect(() => {
    setSearchTerm(searchParams.get('q') || '');
    setAreaSearchTerm(searchParams.get('areaQ') || '');
    setComunaFilter(searchParams.get('comuna') || '');
    setAreaFilter(searchParams.get('area') || '');
    setProviderFilter(searchParams.get('proveedor') || '');
  }, [searchParams]);

  const syncUrl = useCallback((next = {}) => {
    const q = next.q ?? searchTerm;
    const areaQ = next.areaQ ?? areaSearchTerm;
    const comuna = next.comuna ?? comunaFilter;
    const area = next.area ?? areaFilter;
    const proveedor = next.proveedor ?? providerFilter;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (areaQ) params.set('areaQ', areaQ);
    if (comuna) params.set('comuna', comuna);
    if (area) params.set('area', area);
    if (proveedor) params.set('proveedor', proveedor);
    setSearchParams(params, { replace: true });
  }, [searchTerm, areaSearchTerm, comunaFilter, areaFilter, providerFilter, setSearchParams]);

  useEffect(() => {
    const openCreate = () => setModalState({ open: true, mode: 'create', item: null });
    const openImport = () => setConfirmImport(true);
    window.addEventListener('centros:open-create', openCreate);
    window.addEventListener('centros:open-import', openImport);
    return () => {
      window.removeEventListener('centros:open-create', openCreate);
      window.removeEventListener('centros:open-import', openImport);
    };
  }, []);

  const openCreateModal = useCallback(() => {
    setModalState({ open: true, mode: 'create', item: null });
  }, []);

  const openViewModal = useCallback((item) => {
    setModalState({ open: true, mode: 'view', item });
  }, []);

  const openEditModal = useCallback((item) => {
    setModalState({ open: true, mode: 'edit', item });
  }, []);

  const closeModal = useCallback(() => {
    setModalState({ open: false, mode: 'create', item: null });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setAreaSearchTerm('');
    setComunaFilter('');
    setAreaFilter('');
    setProviderFilter('');
    setShowSuggestions(false);
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const handleSelectProvider = useCallback((option) => {
    setSearchTerm('');
    setShowSuggestions(false);
    setProviderFilter(option.key);
    syncUrl({ q: '', proveedor: option.key });
  }, [syncUrl]);

  const handleOpenMap = useCallback((centro) => {
    const code = String(centro?.code || '').trim();
    if (!code) {
      addToast({ title: 'Sin codigo', message: 'Este centro no tiene codigo para ubicarlo en el mapa.', type: 'warning' });
      return;
    }
    navigate(`/centros/mapa?centro=${encodeURIComponent(code)}`);
  }, [addToast, navigate]);

  const handleDeleteCentro = useCallback(async () => {
    if (!confirmDelete?._id) return;
    try {
      await deleteCentro(confirmDelete._id);
      addToast({
        title: 'Centro eliminado',
        message: `El centro ${confirmDelete.code || ''} fue eliminado correctamente.`,
        type: 'success',
      });
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ['centros'] });
    } catch (err) {
      addToast({
        title: 'No se pudo eliminar',
        message: err?.data?.error || err?.message || 'No se pudo eliminar el centro.',
        type: 'error',
      });
    }
  }, [confirmDelete, addToast, queryClient]);

  const handleExportCentros = useCallback(async () => {
    try {
      const csv = await exportCentros({
        q: searchTerm,
        comuna: comunaFilter,
        proveedor: providerFilter,
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `centros-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      addToast({ title: 'Exportacion lista', message: 'El archivo CSV de centros fue generado.', type: 'success' });
    } catch (err) {
      addToast({
        title: 'No se pudo exportar',
        message: err?.data?.error || err?.message || 'No se pudo generar el archivo de centros.',
        type: 'error',
      });
    }
  }, [addToast, comunaFilter, providerFilter, searchTerm]);

  const handleImportSubpesca = useCallback(async () => {
    if (importing) return;
    setImporting(true);
    try {
      const result = await syncSubpesca();
      setConfirmImport(false);
      queryClient.invalidateQueries({ queryKey: ['centros'] });
      addToast({
        title: 'Centros actualizados',
        message: `SUBPESCA sincronizo ${result?.centros || 0} centros.`,
        type: 'success',
      });
    } catch (err) {
      addToast({
        title: 'No se pudo importar',
        message: err?.data?.error || err?.message || 'No se pudo sincronizar desde SUBPESCA.',
        type: 'error',
      });
    } finally {
      setImporting(false);
    }
  }, [addToast, importing, queryClient]);

  const handleSubmitCentro = useCallback(async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      _id: modalState.item?._id,
      proveedor: String(formData.get('proveedor') || '').trim(),
      code: String(formData.get('code') || '').trim(),
      comuna: String(formData.get('comuna') || '').trim(),
      region: String(formData.get('region') || '').trim(),
      areaPSMB: String(formData.get('areaPSMB') || '').trim(),
      estadoAreaSernapesca: String(formData.get('estadoAreaSernapesca') || '').trim(),
      hectareas: String(formData.get('hectareas') || '').trim(),
      tonsMax: String(formData.get('tonsMax') || '').trim(),
    };

    try {
      await upsertCentro(payload);
      addToast({
        title: modalState.item?._id ? 'Centro actualizado' : 'Centro creado',
        message: `${payload.code || 'El centro'} fue guardado correctamente.`,
        type: 'success',
      });
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['centros'] });
    } catch (err) {
      addToast({
        title: 'Error',
        message: err?.data?.error || err?.message || 'No se pudo guardar el centro.',
        type: 'error',
      });
    }
  }, [modalState.item, addToast, closeModal, queryClient]);

  const filteredData = useMemo(() => {
    const query = deferredSearchTerm.trim().toLowerCase();
    const areaQuery = deferredAreaSearchTerm.trim().toLowerCase();
    const isNumericAreaQuery = /^\d{3,}$/.test(areaQuery);
    const hasExactAreaCode = isNumericAreaQuery && data.some((c) => String(c.codigoArea || '').trim().toLowerCase() === areaQuery);

    return data.filter((c) => {
      const areaPSMB = c.areaPSMB || c.sanitario?.areaPSMB || '';
      const codigoArea = String(c.codigoArea || c.sanitario?.codigoArea || '').trim().toLowerCase();
      const estadoArea = c.estadoAreaSernapesca || c.sanitario?.estadoSernapesca || '';
      const matchSearch =
        query === '' ||
        c.proveedor?.toLowerCase().includes(query) ||
        c.code?.toLowerCase().includes(query);
      const matchAreaSearch =
        areaQuery === '' ||
        (hasExactAreaCode
          ? codigoArea === areaQuery
          : areaPSMB.toLowerCase().includes(areaQuery) ||
            codigoArea.includes(areaQuery));
      const matchComuna = comunaFilter === '' || c.comuna === comunaFilter;
      const matchArea =
        areaFilter === '' ||
        (areaFilter === 'con_area' && Boolean(areaPSMB)) ||
        (areaFilter === 'abierta' && String(estadoArea).toLowerCase() === 'abierta') ||
        (areaFilter === 'sin_area' && !areaPSMB);
      const matchProveedor =
        providerFilter === '' ||
        String(c.proveedorKey || '').toLowerCase() === String(providerFilter || '').toLowerCase();
      return matchSearch && matchAreaSearch && matchComuna && matchArea && matchProveedor;
    });
  }, [data, deferredSearchTerm, deferredAreaSearchTerm, comunaFilter, areaFilter, providerFilter]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [deferredSearchTerm, deferredAreaSearchTerm, comunaFilter, areaFilter, providerFilter]);

  const visibleRows = useMemo(() => filteredData.slice(0, visibleCount), [filteredData, visibleCount]);
  const hasMoreRows = visibleCount < filteredData.length;

  const stats = useMemo(() => {
    const totalHect = filteredData.reduce((acc, curr) => acc + (Number(curr.hectareas) || 0), 0);
    const uniqueComunas = new Set(filteredData.map((c) => c.comuna).filter(Boolean)).size;
    const uniqueAreas = new Set(filteredData.map((c) => c.areaPSMB || c.sanitario?.areaPSMB).filter(Boolean)).size;
    const totalTons = filteredData.reduce((acc, curr) => acc + (Number(curr.tonsMax) || 0), 0);
    return {
      count: filteredData.length,
      hectareas: totalHect.toLocaleString('es-CL', { minimumFractionDigits: 2 }),
      comunas: uniqueComunas,
      areas: uniqueAreas,
      tonsMax: totalTons.toLocaleString('es-CL'),
    };
  }, [filteredData]);

  const comunas = useMemo(() => {
    return [...new Set(data.map((c) => c.comuna).filter(Boolean))].sort();
  }, [data]);

  const providerOptions = useMemo(() => {
    const map = new Map();
    data.forEach((c) => {
      const key = c.proveedorKey;
      const nombre = c.proveedor;
      if (key && nombre) {
        if (!map.has(key)) map.set(key, { nombre, key, count: 0 });
        map.get(key).count += 1;
      }
    });
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [data]);

  const suggestions = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.trim().toLowerCase();
    return providerOptions.filter((p) => p.nombre.toLowerCase().includes(q)).slice(0, 8);
  }, [searchTerm, providerOptions]);

  const providerSummary = useMemo(() => {
    if (!providerFilter || filteredData.length === 0) return null;
    const first = filteredData[0];
    return {
      nombre: first?.proveedor || 'Proveedor filtrado',
      centros: filteredData.length,
    };
  }, [providerFilter, filteredData]);

  const isViewMode = modalState.mode === 'view';
  const hasActiveFilters = Boolean(searchTerm || areaSearchTerm || comunaFilter || areaFilter || providerFilter);

  return (
    <div className="centros-table-container">
      {providerSummary ? (
        <div className="mx-table-card" style={{ marginBottom: 12, padding: 14 }}>
          <div style={{ fontWeight: 800, color: 'var(--color-text)' }}>{providerSummary.nombre}</div>
          <div style={{ marginTop: 4, color: 'var(--color-text-subtle)', fontSize: '0.92rem' }}>
            Vista filtrada desde Proveedores - {providerSummary.centros} centro{providerSummary.centros === 1 ? '' : 's'}
          </div>
        </div>
      ) : null}

      <div className="mx-kpi-grid">
        <article className="mx-kpi-card">
          <header className="mx-kpi-label"><Building2 size={16} /> Centros</header>
          <div className="mx-kpi-value">{stats.count}</div>
        </article>
        <article className="mx-kpi-card">
          <header className="mx-kpi-label"><Ruler size={16} /> Hectareas</header>
          <div className="mx-kpi-value">{stats.hectareas} <small className="mx-kpi-sub">ha</small></div>
        </article>
        <article className="mx-kpi-card">
          <header className="mx-kpi-label"><MapPin size={16} /> Areas cultivo</header>
          <div className="mx-kpi-value">{stats.areas}</div>
        </article>
      </div>

      <div className="centros-summary-strip">
        <span>{stats.comunas} comunas</span>
        <span>{stats.tonsMax} t max</span>
        <b>{hasActiveFilters ? 'Vista filtrada' : 'Vista general'}</b>
      </div>

      <div className="mx-toolbar">
        <div className="mx-toolbar-group">
          <div className="mx-search-box" style={{ position: 'relative' }} ref={searchWrapperRef}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar proveedor o codigo centro..."
              value={searchTerm}
              onChange={(e) => {
                const value = e.target.value;
                setSearchTerm(value);
                setShowSuggestions(Boolean(value.trim()));
                syncUrl({ q: value });
              }}
              onFocus={() => { if (searchTerm.trim()) setShowSuggestions(true); }}
              onKeyDown={(e) => { if (e.key === 'Escape') setShowSuggestions(false); }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setShowSuggestions(false); syncUrl({ q: '' }); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}
                aria-label="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, margin: '4px 0 0', padding: 0, listStyle: 'none', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', maxHeight: 280, overflowY: 'auto' }}>
                {suggestions.map((opt) => (
                  <li key={opt.key} style={{ borderBottom: '1px solid var(--color-border-subtle, var(--color-border))' }}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelectProvider(opt)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)', fontSize: '0.88rem' }}
                    >
                      <Building2 size={13} style={{ flexShrink: 0, color: 'var(--color-text-muted)' }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.nombre}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>{opt.count} centro{opt.count !== 1 ? 's' : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mx-search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar area PSMB o codigo area..."
              value={areaSearchTerm}
              onChange={(e) => {
                const value = e.target.value;
                setAreaSearchTerm(value);
                syncUrl({ areaQ: value });
              }}
            />
          </div>

          <select
            className="mx-input"
            style={{ width: 'auto' }}
            value={comunaFilter}
            onChange={(e) => {
              const value = e.target.value;
              setComunaFilter(value);
              syncUrl({ comuna: value });
            }}
          >
            <option value="">Todas las comunas</option>
            {comunas.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            className="mx-input"
            style={{ width: 'auto' }}
            value={areaFilter}
            onChange={(e) => {
              const value = e.target.value;
              setAreaFilter(value);
              syncUrl({ area: value });
            }}
          >
            <option value="">Todas las areas</option>
            <option value="con_area">Solo con area cultivo</option>
            <option value="abierta">Area abierta</option>
            <option value="sin_area">Sin area asociada</option>
          </select>

          <button
            className="mx-btn mx-btn-outline"
            onClick={handleClearFilters}
          >
            Limpiar
          </button>
        </div>

        <div className="mx-toolbar-group">
          <button className="mx-btn mx-btn-outline" style={{ height: 42 }} onClick={handleExportCentros}>
            <Download size={18} /> Exportar
          </button>
          <button className="mx-btn mx-btn-primary" onClick={openCreateModal}>
            <Plus size={18} /> Nuevo Centro
          </button>
        </div>
      </div>

      <div className="mx-table-card">
        <div className="mx-table-wrap">
          <table className="mx-table">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Codigo Centro</th>
                <th>Area PSMB</th>
                <th>Estado Area</th>
                <th>Hectareas</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="mx-spinner" style={{ margin: '0 auto 12px' }}></div>
                    <p>Cargando centros...</p>
                  </td>
                </tr>
              ) : !selectedTenantDb ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                    <p>Selecciona una empresa para ver los centros de cultivo.</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                    <p>No se encontraron centros que coincidan con la busqueda.</p>
                  </td>
                </tr>
              ) : (
                visibleRows.map((centro) => (
                  <tr key={centro._id} className="centros-row">
                    <td>
                      <div className="centros-cell-main">
                        <span style={{ fontWeight: 'var(--weight-bold)' }}>{centro.proveedor}</span>
                        <span className="centros-cell-sub">{centro.comuna}</span>
                      </div>
                    </td>
                    <td><code>{centro.code}</code></td>
                    <td>
                      {centro.areaPSMB ? (
                        <div className="centros-area-cell">
                          <strong>{centro.areaPSMB}</strong>
                          {centro.codigoArea ? <span>Codigo area {centro.codigoArea}</span> : null}
                        </div>
                      ) : (
                        <span className="centros-muted">Sin area</span>
                      )}
                    </td>
                    <td>
                      <span className={`mx-badge ${centro.estadoAreaSernapesca === 'Abierta' ? 'mx-badge-success' : 'mx-badge-muted'}`}>
                        {centro.estadoAreaSernapesca || 'Desconocido'}
                      </span>
                    </td>
                    <td>{Number(centro.hectareas || 0).toLocaleString('es-CL', { minimumFractionDigits: 2 })}</td>
                    <td>
                      <div className="centros-actions">
                        <button className="mx-btn-icon" title="Ver en mapa" onClick={() => handleOpenMap(centro)}><MapPin size={16} /></button>
                        <button className="mx-btn-icon" title="Ver detalles" onClick={() => openViewModal(centro)}><Eye size={16} /></button>
                        <button className="mx-btn-icon" title="Editar" onClick={() => openEditModal(centro)}><Edit size={16} /></button>
                        <button className="mx-btn-icon" title="Eliminar" onClick={() => setConfirmDelete(centro)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && filteredData.length > 0 ? (
        <div className="centros-pagination-footer">
          <span>Mostrando {visibleRows.length} de {filteredData.length} centros</span>
          {hasMoreRows ? (
            <button
              className="mx-btn mx-btn-outline"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            >
              Ver mas
            </button>
          ) : null}
        </div>
      ) : null}

      <ConfirmDeleteModal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteCentro}
        title="¿Eliminar centro?"
        description={
          confirmDelete
            ? `Estás a punto de borrar el centro "${confirmDelete.code || 'sin código'}" de ${confirmDelete.proveedor || 'este proveedor'}. Esta acción es irreversible.`
            : ''
        }
      />

      <ConfirmDeleteModal
        isOpen={confirmImport}
        onClose={() => setConfirmImport(false)}
        onConfirm={handleImportSubpesca}
        title="Actualizar centros desde SUBPESCA"
        description={
          importing
            ? 'Sincronizando centros oficiales...'
            : 'Se consultara la fuente oficial y se actualizaran los centros existentes por codigo. Esta accion puede tardar unos segundos.'
        }
        confirmLabel={importing ? 'Sincronizando...' : 'Actualizar'}
      />

      {modalState.open && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '760px' }}>
            <div className="mx-modal-header">
              <h2>{isViewMode ? 'Detalle Centro' : modalState.item?._id ? 'Editar Centro' : 'Nuevo Centro'}</h2>
              <button type="button" className="mx-btn-icon" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>
            {isViewMode ? (
              <>
                <div className="mx-modal-body">
                  <div className="centros-detail-grid">
                    <div className="detail-item">
                      <label>Proveedor</label>
                      <span>{modalState.item?.proveedor || '-'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Codigo centro</label>
                      <span>{modalState.item?.code || '-'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Comuna</label>
                      <span>{modalState.item?.comuna || '-'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Region</label>
                      <span>{modalState.item?.region || '-'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Area PSMB</label>
                      <span>{modalState.item?.areaPSMB || '-'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Estado Area</label>
                      <span>{modalState.item?.estadoAreaSernapesca || 'Desconocido'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Hectareas</label>
                      <span>{Number(modalState.item?.hectareas || 0).toLocaleString('es-CL')} ha</span>
                    </div>
                    <div className="detail-item">
                      <label>Tons max</label>
                      <span>{Number(modalState.item?.tonsMax || 0).toLocaleString('es-CL')}</span>
                    </div>
                  </div>
                </div>
                <div className="mx-modal-footer">
                  <button type="button" className="mx-btn mx-btn-outline" onClick={closeModal}>Cerrar</button>
                  <button type="button" className="mx-btn mx-btn-outline" onClick={() => handleOpenMap(modalState.item)}>
                    <MapPin size={18} /> Ver en mapa
                  </button>
                  <button type="button" className="mx-btn mx-btn-primary" onClick={() => openEditModal(modalState.item)}>
                    <Edit size={18} /> Editar
                  </button>
                </div>
              </>
            ) : (
            <form onSubmit={handleSubmitCentro} className="mx-form">
              <div className="mx-modal-body" style={{ display: 'grid', gap: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px' }}>
                  <div className="mx-form-group">
                    <label className="mx-label">Proveedor</label>
                    <input className="mx-input" name="proveedor" defaultValue={modalState.item?.proveedor || ''} required />
                  </div>
                  <div className="mx-form-group">
                    <label className="mx-label">Codigo Centro</label>
                    <input className="mx-input" name="code" defaultValue={modalState.item?.code || ''} required />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="mx-form-group">
                    <label className="mx-label">Comuna</label>
                    <input className="mx-input" name="comuna" defaultValue={modalState.item?.comuna || ''} required />
                  </div>
                  <div className="mx-form-group">
                    <label className="mx-label">Región</label>
                    <input className="mx-input" name="region" defaultValue={modalState.item?.region || ''} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="mx-form-group">
                    <label className="mx-label">Área PSMB</label>
                    <input className="mx-input" name="areaPSMB" defaultValue={modalState.item?.areaPSMB || ''} />
                  </div>
                  <div className="mx-form-group">
                    <label className="mx-label">Estado Area</label>
                    <select className="mx-select" name="estadoAreaSernapesca" defaultValue={modalState.item?.estadoAreaSernapesca || ''}>
                      <option value="">Seleccionar</option>
                      <option value="Abierta">Abierta</option>
                      <option value="Cerrada">Cerrada</option>
                      <option value="Suspendida">Suspendida</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="mx-form-group">
                    <label className="mx-label">Hectareas</label>
                    <input className="mx-input" name="hectareas" type="number" step="0.01" defaultValue={modalState.item?.hectareas ?? ''} />
                  </div>
                  <div className="mx-form-group">
                    <label className="mx-label">Tons Máx</label>
                    <input className="mx-input" name="tonsMax" type="number" step="0.01" defaultValue={modalState.item?.tonsMax ?? ''} />
                  </div>
                </div>
              </div>
              <div className="mx-modal-footer">
                <button type="button" className="mx-btn mx-btn-outline" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" className="mx-btn mx-btn-primary">
                  {modalState.item?._id ? 'Guardar cambios' : 'Crear centro'}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}



