import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BarChart3, CalendarRange, ChartNoAxesCombined, List, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { crearDisponibilidad, editarDisponibilidad, getDisponibilidades } from '../../../api/api-mmpp';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { fmtTons } from '../utils/programaCalculos';
import { mesLabel } from '../utils/fechasChile';
import {
  DISPONIBILIDAD_ESTADOS,
  DISPONIBILIDAD_ORIGENES,
  DISPONIBILIDAD_PRODUCTOS,
  buildDisponibilidadContacts,
  buildDisponibilidadProviders,
  buildDisponibilidadTotals,
  optionLabel,
} from '../disponibilidad.constants';
import DisponibilidadModal from './DisponibilidadModal';
import DisponibilidadAnalisisGrafico from './DisponibilidadAnalisisGrafico';
import DisponibilidadProyeccionAnual from './DisponibilidadProyeccionAnual';
import DisponibilidadProviderCell from './DisponibilidadProviderCell';
import DisponibilidadResumen from './DisponibilidadResumen';
import ResumenTotalesDisponibilidad from './ResumenTotalesDisponibilidad';

const normalizeItems = (response) => Array.isArray(response) ? response : (response?.items || []);
const stateMeta = (value) => DISPONIBILIDAD_ESTADOS.find((option) => option.value === value) || DISPONIBILIDAD_ESTADOS[0];
const filterDisponibilidades = (sourceItems, filters) => {
  const providerQuery = filters.proveedor.trim().toLowerCase();
  return sourceItems.filter((item) => {
    const identity = `${item.proveedorNombreNorm || item.proveedorNombre || item.empresaNombre || ''} ${item.contactoNombre || ''} ${item.contactoTelefono || ''}`.toLowerCase();
    return (!providerQuery || identity.includes(providerQuery))
      && (!filters.producto || (item.producto || 'sin_definir') === filters.producto)
      && (!filters.estado || (item.estado || 'disponible') === filters.estado);
  });
};

export default function DisponibilidadView({ items, loading, mes, setMes, reload }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [proveedores, setProveedores] = useState([]);
  const [centros, setCentros] = useState([]);
  const [modalItem, setModalItem] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('listado');
  const [annualItems, setAnnualItems] = useState([]);
  const [annualLoading, setAnnualLoading] = useState(false);
  const [annualYear, setAnnualYear] = useState(() => String(mes).slice(0, 4));
  const [comparisonYear, setComparisonYear] = useState('');
  const [comparisonItems, setComparisonItems] = useState([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [annualReloadKey, setAnnualReloadKey] = useState(0);
  const [filters, setFilters] = useState({ proveedor: '', producto: '', estado: '' });

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiClient.get('/contactos', { signal: controller.signal }),
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

  useEffect(() => {
    if (!['anual', 'analisis'].includes(activeTab) || !/^\d{4}$/.test(annualYear)) return undefined;
    let active = true;
    setAnnualLoading(true);
    getDisponibilidades({ from: `${annualYear}-01`, to: `${annualYear}-12` })
      .then((response) => {
        if (active) setAnnualItems(response);
      })
      .catch((error) => {
        if (active) addToast({ title: 'No se pudo cargar la proyección', message: error.message || 'Intenta nuevamente.', type: 'warning' });
      })
      .finally(() => {
        if (active) setAnnualLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTab, addToast, annualReloadKey, annualYear]);

  useEffect(() => {
    if (activeTab !== 'analisis' || !/^\d{4}$/.test(comparisonYear) || comparisonYear === annualYear) {
      setComparisonItems([]);
      setComparisonLoading(false);
      return undefined;
    }
    let active = true;
    setComparisonLoading(true);
    getDisponibilidades({ from: `${comparisonYear}-01`, to: `${comparisonYear}-12` })
      .then((response) => {
        if (active) setComparisonItems(response);
      })
      .catch((error) => {
        if (active) addToast({ title: 'No se pudo cargar la comparación', message: error.message || 'Intenta nuevamente.', type: 'warning' });
      })
      .finally(() => {
        if (active) setComparisonLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTab, addToast, annualReloadKey, annualYear, comparisonYear]);

  const filteredItems = useMemo(() => filterDisponibilidades(items, filters), [filters, items]);
  const filteredAnnualItems = useMemo(() => filterDisponibilidades(annualItems, filters), [annualItems, filters]);
  const filteredComparisonItems = useMemo(() => filterDisponibilidades(comparisonItems, filters), [comparisonItems, filters]);
  const listedTotals = useMemo(() => buildDisponibilidadTotals(filteredItems), [filteredItems]);

  const providerDirectory = useMemo(
    () => buildDisponibilidadProviders(proveedores, centros),
    [centros, proveedores]
  );
  const contactDirectory = useMemo(() => buildDisponibilidadContacts(proveedores), [proveedores]);

  const responsableNombre = user?.nombre || user?.name || user?.username || user?.email || '';

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
      const normalizedPayload = modalItem ? payload : { ...payload, responsable: responsableNombre };
      if (modalItem?._id) await editarDisponibilidad(modalItem._id, normalizedPayload);
      else await crearDisponibilidad(normalizedPayload);
      closeModal();
      setAnnualReloadKey((current) => current + 1);
      if (payload.mesKey !== mes) setMes(payload.mesKey);
      else await reload();
      addToast({
        title: modalItem ? 'Disponibilidad actualizada' : 'Disponibilidad registrada',
        message: `${payload.proveedorNombre || payload.contactoNombre}: ${fmtTons(payload.tonsDisponible)} para ${mesLabel(payload.mesKey)}.`,
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
          <p>Registra biomasa futura informada por proveedores antes de crear un trato asociado o programa de cosecha.</p>
        </div>
        <button type="button" className="mx-btn mx-btn-primary" onClick={openCreate}>
          <Plus size={17} /> Registrar disponibilidad
        </button>
      </div>

      <div className="disponibilidad-flow-note">
        <span>Disponibilidad</span><ArrowRight size={15} /><span>Trato</span><ArrowRight size={15} /><span>Programa de Cosecha</span>
        <small>Crear trato asociado: disponible en próxima fase.</small>
      </div>

      <div className="mx-toggle-group disponibilidad-tabs" role="tablist" aria-label="Vistas de disponibilidad">
        <button type="button" className={`mx-toggle-btn ${activeTab === 'listado' ? 'active' : ''}`} onClick={() => setActiveTab('listado')}><List size={15} /> Listado</button>
        <button type="button" className={`mx-toggle-btn ${activeTab === 'resumen' ? 'active' : ''}`} onClick={() => setActiveTab('resumen')}><BarChart3 size={15} /> Resumen mensual</button>
        <button type="button" className={`mx-toggle-btn ${activeTab === 'anual' ? 'active' : ''}`} onClick={() => setActiveTab('anual')}><CalendarRange size={15} /> Proyección anual</button>
        <button type="button" className={`mx-toggle-btn ${activeTab === 'analisis' ? 'active' : ''}`} onClick={() => setActiveTab('analisis')}><ChartNoAxesCombined size={15} /> Análisis gráfico</button>
      </div>

      {activeTab !== 'analisis' && <div className="disponibilidad-filter-card">
        <label className="disponibilidad-filter disponibilidad-filter--month">
          <span>{['anual', 'analisis'].includes(activeTab) ? 'Año principal' : 'Mes/Año'}</span>
          {['anual', 'analisis'].includes(activeTab)
            ? <input className="mx-input" type="number" min="2000" max="2100" value={annualYear} onChange={(event) => setAnnualYear(event.target.value)} />
            : <input className="mx-input" type="month" value={mes} onChange={(event) => setMes(event.target.value)} />}
        </label>
        <label className="disponibilidad-filter disponibilidad-filter--search">
          <span>Proveedor / contacto</span>
          <div className="disponibilidad-search-input"><Search size={16} /><input value={filters.proveedor} onChange={(event) => setFilters((current) => ({ ...current, proveedor: event.target.value }))} placeholder="Buscar proveedor o contacto" /></div>
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
        <button type="button" className="mx-btn mx-btn-outline disponibilidad-refresh" onClick={() => ['anual', 'analisis'].includes(activeTab) ? setAnnualReloadKey((current) => current + 1) : reload()}><RotateCcw size={15} /> Actualizar</button>
      </div>}

      {activeTab === 'listado' && (
      <>
      <div className="disponibilidad-kpi-grid">
        {kpis.map((kpi) => (
          <article key={kpi.value} className={`disponibilidad-kpi disponibilidad-kpi--${kpi.tone}`}>
            <span>{kpi.label}</span>
            <strong>{fmtTons(kpi.tons)}</strong>
          </article>
        ))}
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
                    <td className="disponibilidad-provider"><DisponibilidadProviderCell item={item} /></td>
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
                        <button type="button" className="mx-btn-icon sm" disabled title="Crear trato asociado: disponible en próxima fase" aria-label="Crear trato asociado, disponible en próxima fase"><ArrowRight size={15} /></button>
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
      <ResumenTotalesDisponibilidad label="Total listado" {...listedTotals} />
      </>
      )}

      {activeTab === 'resumen' && <DisponibilidadResumen items={filteredItems} mes={mes} estadoFiltro={filters.estado} onEdit={openEdit} />}
      {activeTab === 'anual' && <DisponibilidadProyeccionAnual items={filteredAnnualItems} year={annualYear} loading={annualLoading} onEdit={openEdit} />}
      {activeTab === 'analisis' && (
        <DisponibilidadAnalisisGrafico
          items={filteredAnnualItems}
          comparisonItems={filteredComparisonItems}
          year={annualYear}
          onYearChange={setAnnualYear}
          comparisonYear={comparisonYear}
          onComparisonYearChange={setComparisonYear}
          providers={providerDirectory}
          contacts={contactDirectory}
          providerFilter={filters.proveedor}
          onProviderFilterChange={(proveedor) => setFilters((current) => ({ ...current, proveedor }))}
          productFilter={filters.producto}
          onProductFilterChange={(producto) => setFilters((current) => ({ ...current, producto }))}
          stateFilter={filters.estado}
          onStateFilterChange={(estado) => setFilters((current) => ({ ...current, estado }))}
          onRefresh={() => setAnnualReloadKey((current) => current + 1)}
          loading={annualLoading}
          comparisonLoading={comparisonLoading}
        />
      )}

      <DisponibilidadModal
        open={modalOpen}
        item={modalItem}
        proveedores={providerDirectory}
        contactos={contactDirectory}
        defaultMes={mes}
        responsableNombre={responsableNombre}
        saving={saving}
        onClose={closeModal}
        onSave={handleSave}
      />
    </div>
  );
}
