import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, ChevronUp, ChevronsUpDown, Handshake, HelpCircle, MapPin, MessageCircle, Pencil, Phone, Plus, RotateCcw, Search, Trash2, Users, X } from 'lucide-react';

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
import DisponibilidadSimulador from './DisponibilidadSimulador';
import { maestrosApi } from '../../../api/api-maestros';

const normalizeItems = (response) => Array.isArray(response) ? response : (response?.items || []);
const stateMeta = (value) => DISPONIBILIDAD_ESTADOS.find((option) => option.value === value) || DISPONIBILIDAD_ESTADOS[0];
const MESES_NOMBRES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const formatFechaIngreso = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Santiago' });
};

const sortValueGetters = {
  fechaIngreso: (item) => new Date(item.createdAt || 0).getTime(),
  proveedor: (item) => (item.proveedorNombreNorm || item.proveedorNombre || item.empresaNombre || '').toLowerCase(),
  centro: (item) => (item.centroOrigenCodigo || item.centroCodigo || 'Sin centro').toLowerCase(),
  mes: (item) => item.mesKey || '',
  toneladas: (item) => Number(item.tons || item.tonsDisponible || 0),
  producto: (item) => optionLabel(DISPONIBILIDAD_PRODUCTOS, item.producto || 'sin_definir').toLowerCase(),
};

const SortableTh = ({ label, sortKey, sortConfig, onSort }) => {
  const isActive = sortConfig.key === sortKey;
  const Icon = isActive ? (sortConfig.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <th>
      <button type="button" className={`disp-th-sort${isActive ? ' disp-th-sort--active' : ''}`} onClick={() => onSort(sortKey)}>
        {label} <Icon size={13} />
      </button>
    </th>
  );
};

const filterDisponibilidades = (sourceItems, filters) => {
  const providerQuery = filters.proveedor.trim().toLowerCase();
  return sourceItems.filter((item) => {
    const identity = `${item.proveedorNombreNorm || item.proveedorNombre || item.empresaNombre || ''} ${item.contactoNombre || ''} ${item.contactoTelefono || ''}`.toLowerCase();
    const itemYear = (item.mesKey || '').slice(0, 4);
    const itemMonth = (item.mesKey || '').slice(5, 7);
    return (!providerQuery || identity.includes(providerQuery))
      && (!filters.producto || (item.producto || 'sin_definir') === filters.producto)
      && (!filters.estado || (item.estado || 'disponible') === filters.estado)
      && (!filters.anio || itemYear === String(filters.anio))
      && (!filters.mesNum || itemMonth === String(filters.mesNum).padStart(2, '0'))
      && (!filters.responsable || (item.responsable || '') === filters.responsable);
  });
};

export default function DisponibilidadView({ items, loading, mes, setMes, reload }) {
  const navigate = useNavigate();
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
  const [filters, setFilters] = useState(() => {
    const now = new Date();
    return { proveedor: '', producto: '', estado: '', anio: String(now.getFullYear()), mesNum: String(now.getMonth() + 1), responsable: '' };
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showTotales, setShowTotales] = useState(false);
  const [tiposTransporte, setTiposTransporte] = useState([]);

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
    if (activeTab !== 'simulador' || tiposTransporte.length > 0) return;
    maestrosApi.getMaestrosActivos('tipo_transporte').then(setTiposTransporte).catch(() => {});
  }, [activeTab, tiposTransporte.length]);

  useEffect(() => {
    if (!['anual', 'analisis', 'simulador'].includes(activeTab) || !/^\d{4}$/.test(annualYear)) return undefined;
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

  const availableYears = useMemo(() => {
    const years = new Set(items.map((i) => (i.mesKey || '').slice(0, 4)).filter(Boolean));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [items]);

  const availableResponsables = useMemo(() => {
    const names = new Set(items.map((i) => i.responsable || '').filter(Boolean));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const availableProductos = useMemo(() => {
    const vals = new Set(items.map((i) => i.producto || 'sin_definir').filter(Boolean));
    return DISPONIBILIDAD_PRODUCTOS.filter((p) => vals.has(p.value));
  }, [items]);

  const filteredItems = useMemo(() => filterDisponibilidades(items, filters), [filters, items]);
  const [sortConfig, setSortConfig] = useState({ key: null, dir: 'asc' });
  const handleSort = (key) => {
    setSortConfig((current) => current.key === key
      ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' });
  };
  const sortedItems = useMemo(() => {
    if (!sortConfig.key) return filteredItems;
    const getValue = sortValueGetters[sortConfig.key];
    const dirFactor = sortConfig.dir === 'asc' ? 1 : -1;
    return [...filteredItems].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return -1 * dirFactor;
      if (va > vb) return 1 * dirFactor;
      return 0;
    });
  }, [filteredItems, sortConfig]);
  // Para el Resumen mensual: solo los del mes seleccionado (sin filtros de año/mes del listado)
  const filteredItemsByMes = useMemo(
    () => items.filter((item) => item.mesKey === mes
      && (!filters.producto || (item.producto || 'sin_definir') === filters.producto)
      && (!filters.estado || (item.estado || 'disponible') === filters.estado)),
    [items, mes, filters.producto, filters.estado]
  );
  // Para vistas anuales: solo proveedor/producto/estado/responsable — sin anio/mesNum (tienen su propia selección de año)
  const annualFilters = useMemo(
    () => ({ ...filters, anio: '', mesNum: '' }),
    [filters]
  );
  const filteredAnnualItems = useMemo(() => filterDisponibilidades(annualItems, annualFilters), [annualItems, annualFilters]);
  const annualStateBaseItems = useMemo(
    () => filterDisponibilidades(annualItems, { ...annualFilters, estado: '' }),
    [annualItems, annualFilters]
  );
  const filteredComparisonItems = useMemo(() => filterDisponibilidades(comparisonItems, annualFilters), [comparisonItems, annualFilters]);
  const listedTotals = useMemo(() => buildDisponibilidadTotals(filteredItems), [filteredItems]);
  const totalesLabel = useMemo(() => {
    if (filters.anio && filters.mesNum) return `${MESES_NOMBRES[Number(filters.mesNum) - 1]} ${filters.anio}`;
    if (filters.anio) return filters.anio;
    return 'Todos';
  }, [filters.anio, filters.mesNum]);

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

  const handleSave = async (payloads) => {
    setSaving(true);
    try {
      for (let i = 0; i < payloads.length; i++) {
        if (modalItem?._id && i === 0) await editarDisponibilidad(modalItem._id, payloads[i]);
        else await crearDisponibilidad(payloads[i]);
      }
      closeModal();
      setAnnualReloadKey((current) => current + 1);
      const first = payloads[0];
      if (payloads.length === 1 && first.mesKey !== mes) setMes(first.mesKey);
      else await reload();
      addToast({
        title: modalItem
          ? (payloads.length > 1 ? `Actualizado + ${payloads.length - 1} nuevo${payloads.length - 1 !== 1 ? 's' : ''} registrado${payloads.length - 1 !== 1 ? 's' : ''}` : 'Disponibilidad actualizada')
          : (payloads.length > 1 ? `${payloads.length} disponibilidades registradas` : 'Disponibilidad registrada'),
        message: payloads.length === 1
          ? `${first.proveedorNombre || first.contactoNombre}: ${fmtTons(first.tonsDisponible)} para ${mesLabel(first.mesKey)}.`
          : `${first.proveedorNombre || first.contactoNombre}: ${payloads.map((p) => mesLabel(p.mesKey)).join(', ')}.`,
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
            <option value="simulador">Simulador</option>
          </select>
        </div>

        {activeTab === 'listado' && (
          <>
            <div className="disp-view-selector">
              <span className="disp-view-selector__label">Año</span>
              <select className="disp-view-selector__select" value={filters.anio} onChange={(e) => setFilters((f) => ({ ...f, anio: e.target.value }))}>
                <option value="">Todos</option>
                {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="disp-view-selector">
              <span className="disp-view-selector__label">Mes</span>
              <select className="disp-view-selector__select" value={filters.mesNum} onChange={(e) => setFilters((f) => ({ ...f, mesNum: e.target.value }))}>
                <option value="">Todos</option>
                {MESES_NOMBRES.map((nombre, i) => <option key={i + 1} value={i + 1}>{nombre}</option>)}
              </select>
            </div>
            <div className="disp-view-selector">
              <span className="disp-view-selector__label">Responsable</span>
              <select className="disp-view-selector__select" value={filters.responsable} onChange={(e) => setFilters((f) => ({ ...f, responsable: e.target.value }))}>
                <option value="">Todos</option>
                {availableResponsables.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="disp-view-selector">
              <span className="disp-view-selector__label">Producto</span>
              <select className="disp-view-selector__select" value={filters.producto} onChange={(e) => setFilters((f) => ({ ...f, producto: e.target.value }))}>
                <option value="">Todos</option>
                {availableProductos.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </>
        )}

        <div className="disponibilidad-search-input disp-filter-bar__search">
          <Search size={16} />
          <input value={filters.proveedor} onChange={(event) => setFilters((current) => ({ ...current, proveedor: event.target.value }))} placeholder="Buscar proveedor o contacto" />
        </div>
        {(filters.proveedor || filters.producto || filters.estado || filters.anio || filters.mesNum || filters.responsable) && (
          <button type="button" className="disp-clear-filters-btn" title="Limpiar filtros" onClick={() => setFilters({ proveedor: '', producto: '', estado: '', anio: '', mesNum: '', responsable: '' })}>
            <X size={14} /> Limpiar
          </button>
        )}
        {activeTab !== 'listado' && (
          <>
            <button type="button" className={`mx-btn mx-btn-outline disp-filter-bar__toggle${showFilters ? ' is-open' : ''}`} onClick={() => setShowFilters((v) => !v)}>
              Filtros {showFilters ? '▲' : '▼'}
            </button>
            <button type="button" className="mx-btn mx-btn-primary disp-filter-bar__cta" onClick={openCreate} data-nuevo>
              <Plus size={17} /> Registrar disponibilidad
            </button>
          </>
        )}
        {activeTab !== 'listado' && showFilters && (
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
              <div className="disp-totales-bar__row">
                <button type="button" className="disp-totales-toggle" onClick={() => setShowTotales((v) => !v)}>
                  <span className="disp-totales-toggle__label">{totalesLabel}</span>
                  <strong className="disp-totales-toggle__value">{fmtTons(listedTotals.total)}</strong>
                  <span className="disp-totales-toggle__arrow">{showTotales ? '▲' : '▼'}</span>
                </button>
                <button type="button" className="mx-btn mx-btn-primary" onClick={openCreate} data-nuevo>
                  <Plus size={17} /> Registrar disponibilidad
                </button>
              </div>
              {showTotales && (
                <div className="disp-totales-chips">
                  {kpis.map((kpi) => {
                    const isActive = filters.estado === kpi.value;
                    return (
                      <button
                        key={kpi.value}
                        type="button"
                        onClick={() => setFilters((f) => ({ ...f, estado: isActive ? '' : kpi.value }))}
                        className={`disp-status-chip disp-status-chip--${kpi.tone}${isActive ? ' disp-status-chip--active' : ''}`}
                      >
                        <span className="disp-status-chip__label">{kpi.label}</span>
                        <strong className="disp-status-chip__value">{fmtTons(listedTotals.totalsByState?.[kpi.value] || 0)}</strong>
                        {isActive && <X size={11} className="disp-status-chip__x" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="mx-table-card disponibilidad-table-card">
              <div className="disponibilidad-table-scroll">
                <table className="mx-table disponibilidad-table">
                  <thead>
                    <tr>
                      <SortableTh label="Fecha ingreso" sortKey="fechaIngreso" sortConfig={sortConfig} onSort={handleSort} />
                      <SortableTh label="Proveedor" sortKey="proveedor" sortConfig={sortConfig} onSort={handleSort} />
                      <SortableTh label="Centro" sortKey="centro" sortConfig={sortConfig} onSort={handleSort} />
                      <SortableTh label="Mes" sortKey="mes" sortConfig={sortConfig} onSort={handleSort} />
                      <SortableTh label="Toneladas" sortKey="toneladas" sortConfig={sortConfig} onSort={handleSort} />
                      <SortableTh label="Producto" sortKey="producto" sortConfig={sortConfig} onSort={handleSort} />
                      <th>Observación</th><th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map((item) => {
                      const meta = stateMeta(item.estado || 'disponible');
                      const isCerrado = item.tratoId || item.estado === 'cerrado';
                      return (
                        <tr key={item._id} className={isCerrado ? 'disp-row--cerrado' : ''}>
                          <td data-label="Fecha ingreso" className="disponibilidad-fecha-ingreso">{formatFechaIngreso(item.createdAt)}</td>
                          <td className="disponibilidad-provider" data-label="Proveedor"><DisponibilidadProviderCell item={item} /></td>
                          <td data-label="Centro">{item.centroOrigenCodigo || item.centroCodigo || 'Sin centro'}</td>
                          <td data-label="Mes">{mesLabel(item.mesKey)}</td>
                          <td className="disponibilidad-tons" data-label="Toneladas">
                            <div>{fmtTons(item.tons || item.tonsDisponible || 0)}</div>
                            <span className={`disponibilidad-state disponibilidad-state--${meta.tone}`}>{meta.label}</span>
                          </td>
                          <td data-label="Producto">{optionLabel(DISPONIBILIDAD_PRODUCTOS, item.producto || 'sin_definir')}</td>
                          <td className="disponibilidad-observation" title={item.observacion || item.motivo || ''}>{item.observacion || item.motivo || 'Sin observación'}</td>
                          <td data-label="Acciones">
                            <div className="disponibilidad-row-actions">
                              <button type="button" className="mx-btn-icon sm" onClick={() => openEdit(item)} aria-label="Editar disponibilidad" data-edit><Pencil size={15} /></button>
                              <button type="button" className="mx-btn-icon sm" onClick={() => setDeleteItem(item)} aria-label="Eliminar disponibilidad" data-delete><Trash2 size={15} /></button>
                              {item.tratoId ? (
                                <button
                                  type="button"
                                  className="mx-btn sm disponibilidad-ver-trato-button"
                                  onClick={() => navigate('/biomasa/tratos')}
                                  title="Ver trato asociado"
                                >
                                  <Handshake size={14} /> Ver trato
                                </button>
                              ) : (item.estado || 'disponible') === 'disponible' && (
                                <button type="button" className="mx-btn mx-btn-outline sm disponibilidad-create-trato-button" onClick={() => openCreateTrato(item)} title="Crear trato asociado" data-nuevo>
                                  <ArrowRight size={15} /> Crear trato
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!loading && sortedItems.length === 0 && (
                      <tr><td colSpan={8} className="disponibilidad-empty">No hay disponibilidades para los filtros seleccionados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
        {activeTab === 'resumen' && <DisponibilidadResumen items={filteredItemsByMes} mes={mes} setMes={setMes} estadoFiltro={filters.estado} onEdit={openEdit} onCreateTrato={openCreateTrato} />}
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
        {activeTab === 'simulador' && (
          <DisponibilidadSimulador
            items={filteredAnnualItems}
            tiposTransporte={tiposTransporte}
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
            onEdit={openEdit}
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
