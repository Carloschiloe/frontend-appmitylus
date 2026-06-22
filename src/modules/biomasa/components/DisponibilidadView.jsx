import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, HelpCircle, MapPin, MessageCircle, Pencil, Phone, Plus, RotateCcw, Search, Trash2, Users } from 'lucide-react';

const ORIGEN_ICON = {
  llamada:  Phone,
  visita:   MapPin,
  whatsapp: MessageCircle,
  reunion:  Users,
  otro:     HelpCircle,
};
const OrigenIcon = ({ origen, label }) => {
  const Icon = ORIGEN_ICON[origen] || HelpCircle;
  return <span title={label} className="disp-origen-icon"><Icon size={14} /></span>;
};
import { apiClient } from '../../../api/apiClient';
import { borrarDisponibilidad, crearDisponibilidad, editarDisponibilidad, getDisponibilidades } from '../../../api/api-mmpp';
import ConfirmDeleteModal from '../../../components/ConfirmDeleteModal';
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
import DisponibilidadTratoModal from './DisponibilidadTratoModal';
import DisponibilidadProviderCell from './DisponibilidadProviderCell';
import DisponibilidadResumen from './DisponibilidadResumen';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [proveedores, setProveedores] = useState([]);
  const [centros, setCentros] = useState([]);
  const [modalItem, setModalItem] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tratoItem, setTratoItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [activeTab, setActiveTab] = useState('listado');
  const [annualItems, setAnnualItems] = useState([]);
  const [annualLoading, setAnnualLoading] = useState(false);
  const [annualYear, setAnnualYear] = useState(() => String(mes).slice(0, 4));
  const [comparisonYear, setComparisonYear] = useState('');
  const [comparisonItems, setComparisonItems] = useState([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [annualReloadKey, setAnnualReloadKey] = useState(0);
  const [filters, setFilters] = useState({ proveedor: '', producto: '', estado: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [showTotales, setShowTotales] = useState(false);

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
  const annualStateBaseItems = useMemo(
    () => filterDisponibilidades(annualItems, { ...filters, estado: '' }),
    [annualItems, filters]
  );
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

  const totalTons = useMemo(() => kpis.reduce((sum, k) => sum + k.tons, 0), [kpis]);

  const openCreate = () => {
    setModalItem(null);
    setModalOpen(true);
  };

  // Deep-link desde "Acción rápida": abre directo el modal de Registrar disponibilidad,
  // con el proveedor/contacto ya guardado precargado si vino de ahí.
  useEffect(() => {
    if (searchParams.get('nuevaDisponibilidad') !== '1') return;
    let prefill = null;
    try {
      const raw = sessionStorage.getItem('mitynex:nueva-disponibilidad-context');
      if (raw) {
        prefill = JSON.parse(raw);
        sessionStorage.removeItem('mitynex:nueva-disponibilidad-context');
      }
    } catch { /* contexto invalido, abre en blanco */ }
    setModalItem(prefill);
    setModalOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('nuevaDisponibilidad');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const openEdit = (item) => {
    setModalItem(item);
    setModalOpen(true);
  };

  const openCreateTrato = (item) => {
    if ((item.estado || 'disponible') !== 'disponible' || item.tratoId) return;
    setTratoItem(item);
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

  const handleDelete = async () => {
    if (!deleteItem?._id) return;
    try {
      await borrarDisponibilidad(deleteItem._id);
      setDeleteItem(null);
      await reload();
      addToast({ title: 'Eliminado', message: 'Disponibilidad eliminada correctamente.', type: 'success' });
    } catch (error) {
      addToast({ title: 'Error', message: error.message || 'No se pudo eliminar.', type: 'error' });
    }
  };

  return (
    <div className="disponibilidad-view">
      <div className="disp-filter-bar">
        <div className="disp-view-selector">
          <span className="disp-view-selector__label">Vista</span>
          <select className="disp-view-selector__select" value={activeTab} onChange={(e) => setActiveTab(e.target.value)}>
            <option value="listado">Listado</option>
            <option value="resumen">Resumen mensual</option>
            <option value="anual">Proyección anual</option>
            <option value="analisis">Análisis gráfico</option>
          </select>
        </div>
        <div className="disponibilidad-search-input disp-filter-bar__search">
          <Search size={16} />
          <input value={filters.proveedor} onChange={(event) => setFilters((current) => ({ ...current, proveedor: event.target.value }))} placeholder="Buscar proveedor o contacto" />
        </div>
        <button type="button" className={`mx-btn mx-btn-outline disp-filter-bar__toggle${showFilters ? ' is-open' : ''}${(filters.producto || filters.estado) ? ' has-active' : ''}`} onClick={() => setShowFilters((v) => !v)}>
          Filtros {showFilters ? '▲' : '▼'}
        </button>
        <button type="button" className="mx-btn mx-btn-primary disp-filter-bar__cta" onClick={openCreate}>
          <Plus size={17} /> Registrar disponibilidad
        </button>
        {showFilters && (
          <div className="disp-filter-bar__panel">
            {activeTab === 'analisis' ? (
              <>
                <label className="disponibilidad-filter">
                  <span>Año principal</span>
                  <input className="mx-input" type="number" min="2000" max="2100" value={annualYear} onChange={(event) => setAnnualYear(event.target.value)} />
                </label>
                <label className="disponibilidad-filter">
                  <span>Comparar con</span>
                  <select className="mx-select" value={comparisonYear} onChange={(event) => setComparisonYear(event.target.value)}>
                    <option value="">Ninguno</option>
                    {[Number(annualYear) - 2, Number(annualYear) - 1, Number(annualYear) + 1].filter((y) => y > 0).map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setAnnualReloadKey((current) => current + 1)}>
                  <RotateCcw size={15} /> Actualizar
                </button>
              </>
            ) : (
              <>
                <label className="disponibilidad-filter">
                  <span>{activeTab === 'anual' ? 'Año principal' : 'Mes/Año'}</span>
                  {activeTab === 'anual'
                    ? <input className="mx-input" type="number" min="2000" max="2100" value={annualYear} onChange={(event) => setAnnualYear(event.target.value)} />
                    : <input className="mx-input" type="month" value={mes} onChange={(event) => setMes(event.target.value)} />}
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
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => activeTab === 'anual' ? setAnnualReloadKey((current) => current + 1) : reload()}>
                  <RotateCcw size={15} /> Actualizar
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div key={activeTab} className="disp-tab-content">
        {activeTab === 'listado' && (
          <>
            <div className="disp-totales-bar">
              <button type="button" className="disp-totales-toggle" onClick={() => setShowTotales((v) => !v)}>
                <span className="disp-totales-toggle__label">Total</span>
                <strong className="disp-totales-toggle__value">{fmtTons(totalTons)}</strong>
                <span className="disp-totales-toggle__arrow">{showTotales ? '▲' : '▼'}</span>
              </button>
              {showTotales && (
                <div className="disp-totales-chips">
                  {kpis.map((kpi) => (
                    <span key={kpi.value} className={`disp-status-chip disp-status-chip--${kpi.tone}`}>
                      <span className="disp-status-chip__label">{kpi.label}</span>
                      <strong className="disp-status-chip__value">{fmtTons(kpi.tons)}</strong>
                    </span>
                  ))}
                </div>
              )}
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
                          <td><OrigenIcon origen={item.origen || 'otro'} label={optionLabel(DISPONIBILIDAD_ORIGENES, item.origen || 'otro')} /></td>
                          <td className="disponibilidad-observation" title={item.observacion || item.motivo || ''}>{item.observacion || item.motivo || 'Sin observación'}</td>
                          <td>
                            <div className="disponibilidad-row-actions">
                              <button type="button" className="mx-btn-icon sm" onClick={() => openEdit(item)} aria-label="Editar disponibilidad"><Pencil size={15} /></button>
                              <button type="button" className="mx-btn-icon sm" onClick={() => setDeleteItem(item)} aria-label="Eliminar disponibilidad"><Trash2 size={15} /></button>
                              {(item.estado || 'disponible') === 'disponible' && !item.tratoId && (
                                <button type="button" className="mx-btn mx-btn-outline sm disponibilidad-create-trato-button" onClick={() => openCreateTrato(item)} title="Crear trato asociado">
                                  <ArrowRight size={15} /> Crear trato
                                </button>
                              )}
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
          </>
        )}
        {activeTab === 'resumen' && <DisponibilidadResumen items={filteredItems} mes={mes} setMes={setMes} estadoFiltro={filters.estado} onEdit={openEdit} onCreateTrato={openCreateTrato} />}
        {activeTab === 'anual' && (
          <DisponibilidadProyeccionAnual
            items={filteredAnnualItems}
            stateBaseItems={annualStateBaseItems}
            year={annualYear}
            loading={annualLoading}
            estadoFiltro={filters.estado}
            onEstadoFiltroChange={(estado) => setFilters((current) => ({ ...current, estado }))}
            onEdit={openEdit}
            onCreateTrato={openCreateTrato}
          />
        )}
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
      </div>

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
      <DisponibilidadTratoModal
        open={Boolean(tratoItem)}
        item={tratoItem}
        onClose={() => setTratoItem(null)}
        onSuccess={reload}
      />
      <ConfirmDeleteModal
        isOpen={Boolean(deleteItem)}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDelete}
        title="¿Eliminar disponibilidad?"
        itemName={deleteItem?.proveedorNombre || deleteItem?.proveedorNombreNorm || deleteItem?.empresaNombre}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
