import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { crearDisponibilidad, editarDisponibilidad } from '../../../api/api-mmpp';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { fmtTons } from '../utils/programaCalculos';
import { mesLabel } from '../utils/fechasChile';
import {
  DISPONIBILIDAD_ESTADOS,
  DISPONIBILIDAD_ORIGENES,
  DISPONIBILIDAD_PRODUCTOS,
  optionLabel,
} from '../disponibilidad.constants';
import DisponibilidadModal from './DisponibilidadModal';

const normalizeItems = (response) => Array.isArray(response) ? response : (response?.items || []);
const stateMeta = (value) => DISPONIBILIDAD_ESTADOS.find((option) => option.value === value) || DISPONIBILIDAD_ESTADOS[0];

export default function DisponibilidadView({ items, loading, mes, setMes, reload }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [proveedores, setProveedores] = useState([]);
  const [centros, setCentros] = useState([]);
  const [modalItem, setModalItem] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ proveedor: '', producto: '', estado: '' });

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiClient.get('/contactos?conEmpresa=1', { signal: controller.signal }),
      apiClient.get('/centros', { signal: controller.signal }),
    ]).then(([providersResponse, centersResponse]) => {
      setProveedores(normalizeItems(providersResponse));
      setCentros(normalizeItems(centersResponse));
    }).catch((error) => {
      if (error.name !== 'AbortError') {
        addToast({ title: 'Datos incompletos', message: 'No fue posible cargar proveedores o centros.', type: 'warning' });
      }
    });
    return () => controller.abort();
  }, [addToast]);

  const filteredItems = useMemo(() => {
    const providerQuery = filters.proveedor.trim().toLowerCase();
    return items.filter((item) => {
      const providerName = String(item.proveedorNombreNorm || item.proveedorNombre || item.empresaNombre || '').toLowerCase();
      return (!providerQuery || providerName.includes(providerQuery))
        && (!filters.producto || (item.producto || 'sin_definir') === filters.producto)
        && (!filters.estado || (item.estado || 'disponible') === filters.estado);
    });
  }, [filters, items]);

  const kpis = useMemo(() => DISPONIBILIDAD_ESTADOS.map((state) => ({
    ...state,
    tons: items
      .filter((item) => (item.estado || 'disponible') === state.value)
      .reduce((sum, item) => sum + Number(item.tons || item.tonsDisponible || 0), 0),
  })), [items]);

  const openCreate = () => {
    setModalItem(null);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setModalItem(item);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalItem(null);
  };

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      const responsable = user?.nombre || user?.name || user?.username || user?.email || '';
      const normalizedPayload = { ...payload, responsable };
      if (modalItem?._id) await editarDisponibilidad(modalItem._id, normalizedPayload);
      else await crearDisponibilidad(normalizedPayload);
      closeModal();
      if (payload.mesKey !== mes) setMes(payload.mesKey);
      else await reload();
      addToast({
        title: modalItem ? 'Disponibilidad actualizada' : 'Disponibilidad registrada',
        message: `${payload.proveedorNombre}: ${fmtTons(payload.tonsDisponible)} para ${mesLabel(payload.mesKey)}.`,
        type: 'success',
      });
    } catch (error) {
      addToast({ title: 'No se pudo guardar', message: error.message || 'Revisa los datos e intenta nuevamente.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="disponibilidad-view">
      <div className="disponibilidad-actions-row">
        <div>
          <h2>Disponibilidad futura</h2>
          <p>Biomasa informada por proveedores antes de convertirse en trato.</p>
        </div>
        <button type="button" className="mx-btn mx-btn-primary" onClick={openCreate}>
          <Plus size={17} /> Registrar disponibilidad
        </button>
      </div>

      <div className="disponibilidad-kpi-grid">
        {kpis.map((kpi) => (
          <article key={kpi.value} className={`disponibilidad-kpi disponibilidad-kpi--${kpi.tone}`}>
            <span>{kpi.label}</span>
            <strong>{fmtTons(kpi.tons)}</strong>
          </article>
        ))}
      </div>

      <div className="disponibilidad-filter-card">
        <label className="disponibilidad-filter disponibilidad-filter--month">
          <span>Mes/Año</span>
          <input className="mx-input" type="month" value={mes} onChange={(event) => setMes(event.target.value)} />
        </label>
        <label className="disponibilidad-filter disponibilidad-filter--search">
          <span>Proveedor</span>
          <div className="disponibilidad-search-input"><Search size={16} /><input value={filters.proveedor} onChange={(event) => setFilters((current) => ({ ...current, proveedor: event.target.value }))} placeholder="Buscar proveedor" /></div>
        </label>
        <label className="disponibilidad-filter">
          <span>Producto</span>
          <select className="mx-select" value={filters.producto} onChange={(event) => setFilters((current) => ({ ...current, producto: event.target.value }))}>
            <option value="">Todos</option>
            {DISPONIBILIDAD_PRODUCTOS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="disponibilidad-filter">
          <span>Estado</span>
          <select className="mx-select" value={filters.estado} onChange={(event) => setFilters((current) => ({ ...current, estado: event.target.value }))}>
            <option value="">Todos</option>
            {DISPONIBILIDAD_ESTADOS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button type="button" className="mx-btn mx-btn-outline disponibilidad-refresh" onClick={() => reload()}><RotateCcw size={15} /> Actualizar</button>
      </div>

      <div className="mx-table-card disponibilidad-table-card">
        <div className="disponibilidad-table-scroll">
          <table className="mx-table disponibilidad-table">
            <thead>
              <tr>
                <th>Proveedor</th><th>Centro</th><th>Mes</th><th>Toneladas</th><th>Producto</th>
                <th>Estado</th><th>Responsable</th><th>Origen</th><th>Observación</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const meta = stateMeta(item.estado || 'disponible');
                return (
                  <tr key={item._id}>
                    <td className="disponibilidad-provider">{item.proveedorNombreNorm || item.proveedorNombre || item.empresaNombre || 'Sin proveedor'}</td>
                    <td>{item.centroCodigo || 'Sin centro'}</td>
                    <td>{mesLabel(item.mesKey)}</td>
                    <td className="disponibilidad-tons">{fmtTons(item.tons || item.tonsDisponible || 0)}</td>
                    <td>{optionLabel(DISPONIBILIDAD_PRODUCTOS, item.producto || 'sin_definir')}</td>
                    <td><span className={`disponibilidad-state disponibilidad-state--${meta.tone}`}>{meta.label}</span></td>
                    <td>{item.responsable || 'Sin asignar'}</td>
                    <td>{optionLabel(DISPONIBILIDAD_ORIGENES, item.origen || 'otro')}</td>
                    <td className="disponibilidad-observation" title={item.observacion || item.motivo || ''}>{item.observacion || item.motivo || 'Sin observación'}</td>
                    <td>
                      <div className="disponibilidad-row-actions">
                        <button type="button" className="mx-btn-icon sm" onClick={() => openEdit(item)} aria-label="Editar disponibilidad"><Pencil size={15} /></button>
                        <button type="button" className="mx-btn-icon sm" disabled title="Disponible en próxima fase" aria-label="Convertir en trato, disponible en próxima fase"><ArrowRight size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredItems.length === 0 && (
                <tr><td colSpan={10} className="disponibilidad-empty">No hay disponibilidades para los filtros seleccionados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DisponibilidadModal
        open={modalOpen}
        item={modalItem}
        proveedores={proveedores}
        centros={centros}
        defaultMes={mes}
        saving={saving}
        onClose={closeModal}
        onSave={handleSave}
      />
    </div>
  );
}
