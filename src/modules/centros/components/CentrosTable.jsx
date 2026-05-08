import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { deleteCentro, getCentros, upsertCentro } from '../../../api/api-centros';
import { useToast } from '../../../context/ToastContext';
import ConfirmDeleteModal from '../../../components/ConfirmDeleteModal';

export default function CentrosTable() {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const selectedTenantDb = localStorage.getItem('selected_tenant_db') || '';

  const { data: rawData = [], isLoading: loading } = useQuery({
    queryKey: ['centros', 'mapa'],
    queryFn: ({ signal }) => getCentros({}, { signal }),
    enabled: Boolean(selectedTenantDb),
  });

  const data = useMemo(() => Array.isArray(rawData) ? rawData : (rawData.items || []), [rawData]);

  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [comunaFilter, setComunaFilter] = useState(searchParams.get('comuna') || '');
  const [providerFilter, setProviderFilter] = useState(searchParams.get('proveedor') || '');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [modalState, setModalState] = useState({ open: false, item: null });

  useEffect(() => {
    setSearchTerm(searchParams.get('q') || '');
    setComunaFilter(searchParams.get('comuna') || '');
    setProviderFilter(searchParams.get('proveedor') || '');
  }, [searchParams]);

  function syncUrl(next = {}) {
    const q = next.q ?? searchTerm;
    const comuna = next.comuna ?? comunaFilter;
    const proveedor = next.proveedor ?? providerFilter;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (comuna) params.set('comuna', comuna);
    if (proveedor) params.set('proveedor', proveedor);
    setSearchParams(params, { replace: true });
  }

  useEffect(() => {
    const openCreate = () => setModalState({ open: true, item: null });
    window.addEventListener('centros:open-create', openCreate);
    return () => window.removeEventListener('centros:open-create', openCreate);
  }, []);

  async function handleDeleteCentro() {
    if (!confirmDelete?._id) return;
    try {
      await deleteCentro(confirmDelete._id);
      addToast({
        title: 'Centro eliminado',
        message: `El centro ${confirmDelete.code || ''} fue eliminado correctamente.`,
        type: 'success',
      });
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ['centros', 'mapa'] });
    } catch (err) {
      addToast({
        title: 'No se pudo eliminar',
        message: err?.data?.error || err?.message || 'No se pudo eliminar el centro.',
        type: 'error',
      });
    }
  }

  async function handleSubmitCentro(event) {
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
      setModalState({ open: false, item: null });
      queryClient.invalidateQueries({ queryKey: ['centros', 'mapa'] });
    } catch (err) {
      addToast({
        title: 'Error',
        message: err?.data?.error || err?.message || 'No se pudo guardar el centro.',
        type: 'error',
      });
    }
  }

  const filteredData = useMemo(() => {
    return data.filter((c) => {
      const matchSearch =
        searchTerm === '' ||
        c.proveedor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchComuna = comunaFilter === '' || c.comuna === comunaFilter;
      const matchProveedor =
        providerFilter === '' ||
        String(c.proveedorKey || '').toLowerCase() === String(providerFilter || '').toLowerCase();
      return matchSearch && matchComuna && matchProveedor;
    });
  }, [data, searchTerm, comunaFilter, providerFilter]);

  const stats = useMemo(() => {
    const totalHect = filteredData.reduce((acc, curr) => acc + (Number(curr.hectareas) || 0), 0);
    const uniqueComunas = new Set(filteredData.map((c) => c.comuna).filter(Boolean)).size;
    const totalTons = filteredData.reduce((acc, curr) => acc + (Number(curr.tonsMax) || 0), 0);
    return {
      count: filteredData.length,
      hectareas: totalHect.toLocaleString('es-CL', { minimumFractionDigits: 2 }),
      comunas: uniqueComunas,
      tonsMax: totalTons.toLocaleString('es-CL'),
    };
  }, [filteredData]);

  const comunas = useMemo(() => {
    return [...new Set(data.map((c) => c.comuna).filter(Boolean))].sort();
  }, [data]);

  const providerSummary = useMemo(() => {
    if (!providerFilter || filteredData.length === 0) return null;
    const first = filteredData[0];
    return {
      nombre: first?.proveedor || 'Proveedor filtrado',
      centros: filteredData.length,
    };
  }, [providerFilter, filteredData]);

  return (
    <div className="centros-table-container">
      {providerSummary ? (
        <div className="mx-table-card" style={{ marginBottom: 12, padding: 14 }}>
          <div style={{ fontWeight: 800, color: 'var(--color-text)' }}>{providerSummary.nombre}</div>
          <div style={{ marginTop: 4, color: 'var(--color-text-subtle)', fontSize: '0.92rem' }}>
            Vista filtrada desde Proveedores · {providerSummary.centros} centro{providerSummary.centros === 1 ? '' : 's'}
          </div>
        </div>
      ) : null}

      <div className="centros-kpis">
        <article className="centros-kpi">
          <header className="centros-kpi-label"><Building2 size={16} /> Centros</header>
          <div className="centros-kpi-value">{stats.count}</div>
        </article>
        <article className="centros-kpi">
          <header className="centros-kpi-label"><Ruler size={16} /> Hectáreas</header>
          <div className="centros-kpi-value">{stats.hectareas} <small>ha</small></div>
        </article>
        <article className="centros-kpi">
          <header className="centros-kpi-label"><MapPin size={16} /> Comunas</header>
          <div className="centros-kpi-value">{stats.comunas}</div>
        </article>
      </div>

      <div className="centros-filters">
        <div className="centros-search-wrap">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por proveedor o código..."
            className="centros-search"
            value={searchTerm}
            onChange={(e) => {
              const value = e.target.value;
              setSearchTerm(value);
              syncUrl({ q: value });
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

        <button
          className="mx-btn mx-btn-outline"
          onClick={() => {
            setSearchTerm('');
            setComunaFilter('');
            setProviderFilter('');
            setSearchParams(new URLSearchParams(), { replace: true });
          }}
        >
          Limpiar
        </button>

        <div style={{ flex: 1 }}></div>

        <button className="mx-btn mx-btn-primary" onClick={() => setModalState({ open: true, item: null })}>
          <Plus size={18} /> Nuevo Centro
        </button>

        <button className="mx-btn mx-btn-flat">
          <Download size={18} /> Exportar
        </button>
      </div>

      <div className="centros-table-card">
        <div className="centros-table-wrap">
          <table className="centros-tbl">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Código Centro</th>
                <th>Área PSMB</th>
                <th>Estado Área</th>
                <th>Hectáreas</th>
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
                    <p>No se encontraron centros que coincidan con la búsqueda.</p>
                  </td>
                </tr>
              ) : (
                filteredData.map((centro) => (
                  <tr key={centro._id}>
                    <td>
                      <div className="centros-cell-main">
                        <span style={{ fontWeight: 600 }}>{centro.proveedor}</span>
                        <span className="centros-cell-sub">{centro.comuna}</span>
                      </div>
                    </td>
                    <td><code>{centro.code}</code></td>
                    <td>{centro.areaPSMB || '—'}</td>
                    <td>
                      <span className={`centros-badge-area ${centro.estadoAreaSernapesca === 'Abierta' ? 'verde' : 'gris'}`}>
                        {centro.estadoAreaSernapesca || 'Desconocido'}
                      </span>
                    </td>
                    <td>{Number(centro.hectareas || 0).toLocaleString('es-CL', { minimumFractionDigits: 2 })}</td>
                    <td>
                      <div className="centros-actions">
                        <button className="mx-btn-icon" title="Ver detalles" onClick={() => setModalState({ open: true, item: centro })}><Eye size={16} /></button>
                        <button className="mx-btn-icon" title="Editar" onClick={() => setModalState({ open: true, item: centro })}><Edit size={16} /></button>
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

      {modalState.open && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '760px' }}>
            <button className="mx-modal-close" onClick={() => setModalState({ open: false, item: null })}>
              <X size={20} />
            </button>
            <form onSubmit={handleSubmitCentro}>
              <div className="mx-modal-head">
                <h3>{modalState.item?._id ? 'Editar Centro' : 'Nuevo Centro'}</h3>
              </div>
              <div className="mx-modal-body" style={{ display: 'grid', gap: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px' }}>
                  <div className="am-form-group">
                    <label>Proveedor</label>
                    <input className="mx-input" name="proveedor" defaultValue={modalState.item?.proveedor || ''} required />
                  </div>
                  <div className="am-form-group">
                    <label>Código Centro</label>
                    <input className="mx-input" name="code" defaultValue={modalState.item?.code || ''} required />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="am-form-group">
                    <label>Comuna</label>
                    <input className="mx-input" name="comuna" defaultValue={modalState.item?.comuna || ''} required />
                  </div>
                  <div className="am-form-group">
                    <label>Región</label>
                    <input className="mx-input" name="region" defaultValue={modalState.item?.region || ''} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="am-form-group">
                    <label>Área PSMB</label>
                    <input className="mx-input" name="areaPSMB" defaultValue={modalState.item?.areaPSMB || ''} />
                  </div>
                  <div className="am-form-group">
                    <label>Estado Área</label>
                    <select className="mx-input" name="estadoAreaSernapesca" defaultValue={modalState.item?.estadoAreaSernapesca || ''}>
                      <option value="">Seleccionar</option>
                      <option value="Abierta">Abierta</option>
                      <option value="Cerrada">Cerrada</option>
                      <option value="Suspendida">Suspendida</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="am-form-group">
                    <label>Hectáreas</label>
                    <input className="mx-input" name="hectareas" type="number" step="0.01" defaultValue={modalState.item?.hectareas ?? ''} />
                  </div>
                  <div className="am-form-group">
                    <label>Tons Máx</label>
                    <input className="mx-input" name="tonsMax" type="number" step="0.01" defaultValue={modalState.item?.tonsMax ?? ''} />
                  </div>
                </div>
              </div>
              <div className="mx-modal-foot">
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setModalState({ open: false, item: null })}>
                  Cancelar
                </button>
                <button type="submit" className="mx-btn mx-btn-primary">
                  {modalState.item?._id ? 'Guardar cambios' : 'Crear centro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



