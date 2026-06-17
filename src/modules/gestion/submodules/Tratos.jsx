import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Plus, RotateCcw, ChevronLeft, ChevronRight, User, CheckCircle, X, CalendarCheck, FileText, FileDown } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { apiClient } from '../../../api/apiClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useContactos, useCentros, useTratos } from '../hooks/useGestionQueries';
import { downloadXlsx } from '../../../utils/downloadXlsx';
import { maestrosApi } from '../../../api/api-maestros';
import ConfirmDeleteModal from '../../../components/ConfirmDeleteModal';
import TratoFormModal from './TratoFormModal';
import TratoShareModal from './TratoShareModal';
import TratosTable from './TratosTable';
import HelpTourButton from '../../../components/HelpTourButton';
import './tratos.css';
import {
  buildInitialConditions,
  buildProviderDirectory,
  buildTratoShareMessage,
  calcularFechaTerminoEstimadaTrato,
  createEmptyForm,
  deriveCamionesXDia,
  derivePrecioDesdeCondiciones,
  deriveVolumenDesdeCondiciones,
  ESTADOS_TRATO,
  formatInteger,
  getEstadoCierreFromApi,
  getUiEstadoFromApi,
  normalizeDateOnlyForUiSafe,
  parseNumberOrNull,
  toList,
} from './tratos.helpers';

const ESTADO_TONE = {
  pendiente: 'info',
  acordado: 'success',
  rechazado: 'danger',
  cerrado_ok: 'muted',
};

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
function mesLabel(ym) {
  if (!ym) return '';
  const [y, m] = String(ym).split('-');
  return `${(MESES_ES[parseInt(m, 10) - 1] || '').toUpperCase()} ${y}`;
}
function toMonthKey(dateStr) {
  if (!dateStr) return null;
  return String(dateStr).slice(0, 7);
}
function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function getUserDisplayName(user) {
  return user?.nombre || user?.name || user?.username || user?.email || '';
}

export default function Tratos() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchTerm, setSearchTerm] = useState('');
  const [mes, setMes] = useState(mesActual);
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [responsableFilter, setResponsableFilter] = useState('all');
  const [estadoFilter, setEstadoFilter] = useState('');

  const moveMes = useCallback((dir) => {
    setMes((prev) => {
      const [y, m] = prev.split('-').map(Number);
      const d = new Date(y, m - 1 + dir, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingEstadoApi, setEditingEstadoApi] = useState('');
  const [confirmDeleteTrato, setConfirmDeleteTrato] = useState(null);
  const [shareModal, setShareModal] = useState({ open: false, url: '', item: null });
  const [savedModal, setSavedModal] = useState(null); // { isNew, trato, wasAcordado }
  const [providerSearch, setProviderSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState(null);

  // 1. Carga de datos con React Query
  const { data: tratosRes, isLoading: loadingTratos } = useTratos();
  const { data: tiposTransporte = [], isLoading: loadingTransportes } = useQuery({
    queryKey: ['maestros', 'tipo_transporte'],
    queryFn: () => maestrosApi.getMaestrosActivos('tipo_transporte'),
    staleTime: 10 * 60 * 1000,
  });
  
  const items = useMemo(() => {
    const raw = toList(tratosRes);
    return raw.map((item) => ({
      ...item,
      fechaCierre: normalizeDateOnlyForUiSafe(item.fechaCierre),
      vigenciaDesde: normalizeDateOnlyForUiSafe(item.vigenciaDesde),
      vigenciaHasta: normalizeDateOnlyForUiSafe(item.vigenciaHasta),
    }));
  }, [tratosRes]);

  const loading = loadingTratos || loadingTransportes;

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['tratos'] }),
      queryClient.refetchQueries({ queryKey: ['oportunidades'] })
    ]);
  }, [queryClient]);

  useEffect(() => {
    window.addEventListener('gestion:quick-capture-saved', handleRefresh);
    return () => window.removeEventListener('gestion:quick-capture-saved', handleRefresh);
  }, [handleRefresh]);

  useEffect(() => {
    const isNew = searchParams.get('new') === '1';
    const proveedorParam = String(searchParams.get('proveedor') || '').trim();
    if (!isNew && !proveedorParam) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('new');
    nextParams.delete('proveedor');
    setSearchParams(nextParams, { replace: true });

    if (isNew) {
      try {
        const raw = sessionStorage.getItem('mitynex:new-trato-context');
        if (!raw) return;
        const ctx = JSON.parse(raw);
        sessionStorage.removeItem('mitynex:new-trato-context');
        const preselected = {
          id: `prov-${ctx.proveedorKey || ''}`,
          contactoId: '',
          proveedorKey: ctx.proveedorKey || '',
          proveedorNombre: ctx.proveedorNombre || '',
          contactoNombre: ctx.contactoNombre || '',
          contactoTelefono: ctx.contactoTelefono || '',
          contactoEmail: ctx.contactoEmail || '',
          comuna: ctx.comuna || '',
          centros: ctx.centros || 0,
        };
        setEditingId(null);
        setEditingEstadoApi('');
        setProviderSearch(preselected.proveedorNombre);
        setSelectedProvider(preselected);
        setForm(createEmptyForm(buildInitialConditions(maestrosCondiciones)));
        setIsModalOpen(true);
      } catch {
        // contexto inválido o ausente, no hacer nada
      }
    } else if (proveedorParam) {
      setSearchTerm(proveedorParam);
      setShowAllMonths(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: maestrosCondiciones = [] } = useQuery({
    queryKey: ['maestros', 'condicion_negociacion', 'activos'],
    queryFn: () => maestrosApi.getMaestrosActivos('condicion_negociacion'),
    staleTime: 10 * 60 * 1000,
  });

  const isCreatingTrato = isModalOpen && !editingId;
  const { data: centrosRaw, isLoading: loadingCentros } = useCentros({ enabled: isCreatingTrato });
  const { data: contactosRaw, isLoading: loadingContactos } = useContactos({ conEmpresa: 1 }, { enabled: isCreatingTrato });

  const providers = useMemo(() => {
    if (!isCreatingTrato) return [];
    const centros = Array.isArray(centrosRaw) ? centrosRaw : (centrosRaw?.items || []);
    const contactos = Array.isArray(contactosRaw) ? contactosRaw : (contactosRaw?.items || []);
    return buildProviderDirectory(centros, contactos);
  }, [isCreatingTrato, centrosRaw, contactosRaw]);

  const loadingProviders = loadingCentros || loadingContactos;

  const filteredProviders = useMemo(() => {
    const query = providerSearch.trim().toLowerCase();
    return providers
      .filter((item) => {
        if (!query) return true;
        const providerText = `${item.proveedorNombre || ''} ${item.proveedorKey || ''} ${item.comuna || ''}`.toLowerCase();
        const contactText = `${item.contactoNombre || ''} ${item.contactoTelefono || ''} ${item.contactoEmail || ''}`.toLowerCase();
        return providerText.includes(query) || contactText.includes(query);
      })
      .slice(0, 10);
  }, [providers, providerSearch]);

  const [form, setForm] = useState(() => createEmptyForm());
  const currentResponsable = getUserDisplayName(user);

  useEffect(() => {
    if (isModalOpen && !editingId && maestrosCondiciones.length > 0) {
      const initialCond = buildInitialConditions(maestrosCondiciones);
      setForm(prev => ({
        ...prev,
        responsableNombre: prev.responsableNombre || currentResponsable,
        condiciones: initialCond,
      }));
    }
  }, [isModalOpen, editingId, maestrosCondiciones, currentResponsable]);

  const openNew = useCallback(() => {
    setEditingId(null);
    setEditingEstadoApi('');
    setProviderSearch('');
    setSelectedProvider(null);
    setForm({
      ...createEmptyForm(buildInitialConditions(maestrosCondiciones)),
      responsableNombre: currentResponsable,
    });
    setIsModalOpen(true);
  }, [maestrosCondiciones, currentResponsable]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingId(null);
    setEditingEstadoApi('');
    setProviderSearch('');
    setSelectedProvider(null);
    setForm({
      ...createEmptyForm(buildInitialConditions(maestrosCondiciones)),
      responsableNombre: currentResponsable,
      transporteTrato: null,
    });
  }, [maestrosCondiciones, currentResponsable]);

  const handleSelectProvider = useCallback((provider) => {
    setSelectedProvider(provider);
    setProviderSearch(provider.proveedorNombre || '');
    setForm((prev) => ({ ...prev, proveedorNombre: provider.proveedorNombre || '' }));
  }, []);

  const handleTransporteChange = useCallback((transporteUpdate) => {
    setForm(prev => ({ ...prev, transporteTrato: transporteUpdate }));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      let newId = null;
      if (editingId) {
        const volumenDesdeCondiciones = deriveVolumenDesdeCondiciones(form.condiciones);
        const tonsGuardadas = parseNumberOrNull(form.tonsAcordadas) ?? volumenDesdeCondiciones;
        const tratoPayload = {
          tonsAcordadas: tonsGuardadas,
          precioAcordado: derivePrecioDesdeCondiciones(form.condiciones),
          notasTrato: form.notas || '',
          camionesXDia: deriveCamionesXDia(form.condiciones),
          vigenciaDesde: form.fechaInicioCosecha || null,
          condiciones: (form.condiciones || []).map((c) => ({
            ...c,
            valor: c.valor === '' ? null : c.valor,
          })),
          transportes: form.transporteTrato ? [form.transporteTrato] : [],
        };

        await apiClient.patch(`/oportunidades/${editingId}/trato`, tratoPayload);

        // Estado automático según condiciones
        const todasAcordadas =
          form.condiciones.length > 0 &&
          form.condiciones.every(c => c.estado === 'acordado');
        const estadoCierreExplicito = form.estadoCierre; // perdido / descartado / cerrado_ok

        let nextEstadoCierre = estadoCierreExplicito;
        if (!nextEstadoCierre) {
          if (todasAcordadas) {
            nextEstadoCierre = 'acordado';
          } else if (editingEstadoApi === 'acordado') {
            // Si estaba acordado pero hay condiciones pendientes, vuelve a semi_acordado (pendiente)
            nextEstadoCierre = 'semi_acordado';
          }
        }

        if (nextEstadoCierre) {
          const apiEstado = nextEstadoCierre === 'cerrado_ok' ? 'compra_efectuada' : nextEstadoCierre;
          if (apiEstado !== editingEstadoApi) {
            if ((nextEstadoCierre === 'perdido' || nextEstadoCierre === 'descartado') && !form.motivoCierre?.trim()) {
              addToast({ title: 'Falta motivo', message: 'Indica el motivo del cierre antes de guardar.', type: 'warning' });
              return;
            }
            await apiClient.patch(`/oportunidades/${editingId}/estado`, {
              estado: apiEstado,
              observacion: form.motivoCierre || form.notas || '',
            });
          }
        }
      } else {
        if (!selectedProvider?.proveedorKey || !selectedProvider?.proveedorNombre) {
          addToast({ title: 'Falta proveedor', message: 'Selecciona un proveedor del listado antes de guardar.', type: 'warning' });
          return;
        }

        const volumenDesdeCondiciones = deriveVolumenDesdeCondiciones(form.condiciones);

        // 1. Crear la oportunidad base (solo campos que acepta el POST estricto)
        const created = await apiClient.post('/oportunidades', {
          proveedorId: selectedProvider.contactoId || '',
          proveedorKey: selectedProvider.proveedorKey,
          proveedorNombre: selectedProvider.proveedorNombre,
          estado: 'negociando',
          origen: 'manual',
          meta: {
            contactoNombre: selectedProvider.contactoNombre || '',
            contactoTelefono: selectedProvider.contactoTelefono || '',
            contactoEmail: selectedProvider.contactoEmail || '',
            comuna: selectedProvider.comuna || '',
          },
        });

        // 2. Completar datos de trato/condiciones vía el endpoint de trato
        newId = created?.item?._id || created?._id;
        if (newId) {
          await apiClient.patch(`/oportunidades/${newId}/trato`, {
            tonsAcordadas: parseNumberOrNull(form.tonsAcordadas) ?? volumenDesdeCondiciones,
            precioAcordado: derivePrecioDesdeCondiciones(form.condiciones),
            notasTrato: form.notas || '',
            camionesXDia: deriveCamionesXDia(form.condiciones),
            vigenciaDesde: form.fechaInicioCosecha || null,
            condiciones: (form.condiciones || []).map((condicion) => ({
              ...condicion,
              valor: condicion.valor === '' ? null : condicion.valor,
            })),
            transportes: form.transporteTrato ? [form.transporteTrato] : [],
          });

          // 3. Si todas las condiciones quedaron acordadas, el trato pasa a Acordado
          const todasAcordadasNew =
            form.condiciones.length > 0 &&
            form.condiciones.every((c) => c.estado === 'acordado');
          if (todasAcordadasNew) {
            await apiClient.patch(`/oportunidades/${newId}/estado`, {
              estado: 'acordado',
              observacion: form.notas || '',
            });
          }
        }
      }

      // HACER REFETCH INMEDIATO Y ESPERAR QUE TERMINE
      await handleRefresh();

      // Tomar como fuente principal el trato retornado por backend / cache
      const savedId = editingId || newId;
      const cacheData = queryClient.getQueryData(['tratos']);
      const cacheTratos = toList(cacheData);
      const updatedTrato = cacheTratos.find(t => String(t._id) === String(savedId));

      const isAcordado = updatedTrato 
        ? (updatedTrato.estado === 'acordado' || updatedTrato.estado === 'compra_efectuada') 
        : false;

      const hasPrograma = updatedTrato 
        ? !!(updatedTrato.programaEstado && updatedTrato.programaEstado !== 'finalizado') 
        : false;

      const trTermino = calcularFechaTerminoEstimadaTrato({
        fechaInicioCosecha: updatedTrato ? updatedTrato.vigenciaDesde : form.fechaInicioCosecha,
        tonsAcordadas: updatedTrato ? updatedTrato.tonsAcordadas : form.tonsAcordadas,
        condiciones: updatedTrato ? updatedTrato.condiciones : form.condiciones,
        transporte: updatedTrato && updatedTrato.transportes?.length ? updatedTrato.transportes[0] : form.transporteTrato,
      });

      setSavedModal({
        isNew: !editingId,
        wasAcordado: isAcordado,
        hasProgramaActivo: hasPrograma,
        tratoId: savedId,
        trato: {
          proveedorNombre: updatedTrato?.proveedorNombre || form.proveedorNombre || selectedProvider?.proveedorNombre,
          tonsAcordadas: updatedTrato?.tonsAcordadas || form.tonsAcordadas,
          precioAcordado: updatedTrato?.precioAcordado || derivePrecioDesdeCondiciones(form.condiciones),
          fechaInicio: updatedTrato?.vigenciaDesde?.slice(0, 10) || form.fechaInicioCosecha,
          fechaTermino: trTermino,
          responsableNombre: updatedTrato?.responsableNombre || form.responsableNombre || currentResponsable,
        },
      });

      closeModal();
    } catch (error) {
      const detalle =
        error?.data?.details?.[0]?.message ||
        error?.data?.error ||
        error?.message;
      addToast({
        title: 'Error',
        message: detalle ? `No se pudo guardar el trato: ${detalle}` : 'No se pudo guardar el trato',
        type: 'error',
      });
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteTrato?._id) return;
    try {
      await apiClient.delete(`/oportunidades/${confirmDeleteTrato._id}`);
      addToast({ title: 'Eliminado', message: 'Trato eliminado', type: 'success' });
      setConfirmDeleteTrato(null);
      handleRefresh();
    } catch {
      addToast({ title: 'Error', message: 'No se pudo eliminar', type: 'error' });
    }
  };

  const openEdit = (item) => {
    setEditingId(item._id);
    setEditingEstadoApi(item.estado || '');
    setSelectedProvider(item.proveedorNombre ? {
      id: item.proveedorKey || item._id,
      contactoId: item.proveedorId || '',
      proveedorKey: item.proveedorKey || '',
      proveedorNombre: item.proveedorNombre || '',
      contactoNombre: item.meta?.contactoNombre || '',
      contactoTelefono: item.meta?.contactoTelefono || '',
      contactoEmail: item.meta?.contactoEmail || '',
      comuna: item.meta?.comuna || '',
      centros: item.centroCodigo ? 1 : 0,
    } : null);
    setProviderSearch(item.proveedorNombre || '');
    setForm({
      proveedorNombre: item.proveedorNombre || '',
      responsableNombre: item.responsableNombre || currentResponsable,
      tonsAcordadas: item.tonsAcordadas || '',
      fechaInicioCosecha: item.vigenciaDesde
        ? item.vigenciaDesde.slice(0, 10)
        : (item.fechaCierre ? item.fechaCierre.slice(0, 10) : ''),
      estadoCierre: getEstadoCierreFromApi(item.estado),
      motivoCierre: item.motivoPerdida || item.motivoCierre || '',
      notas: item.notasTrato || item.notas || '',
      condiciones: buildInitialConditions(maestrosCondiciones, item.condiciones || []),
      transporteTrato: item.transportes?.[0] || null,
    });
    setIsModalOpen(true);
  };

  const toggleCondicionStatus = (idx, status) => {
    const nextCond = [...form.condiciones];
    nextCond[idx].estado = status;
    setForm({ ...form, condiciones: nextCond });
  };

  const handleConditionModeChange = useCallback((idx, modoCondicion) => {
    const nextCond = [...form.condiciones];
    nextCond[idx].modoCondicion = modoCondicion;
    if (modoCondicion === 'normal') nextCond[idx].valor = '';
    setForm({ ...form, condiciones: nextCond });
  }, [form]);

  const handleConditionValueChange = useCallback((idx, valor) => {
    const nextCond = [...form.condiciones];
    nextCond[idx].valor = valor;
    setForm({ ...form, condiciones: nextCond });
  }, [form]);

  const compartirTrato = async (item) => {
    try {
      const res = await apiClient.post(`/oportunidades/${item._id}/share`);
      setShareModal({ open: true, url: res.url, item, message: buildTratoShareMessage(item, res.url) });
    } catch {
      addToast({ title: 'Error', message: 'No se pudo generar el link para compartir', type: 'error' });
    }
  };

  const handleViewReport = async (item) => {
    try {
      const res = await apiClient.post(`/oportunidades/${item._id}/share`);
      if (res.url) {
        // Extraer el path relativo del informe (/r/trato/:shareId)
        const urlObj = new URL(res.url);
        window.open(urlObj.pathname + urlObj.search, '_blank', 'noopener');
      }
    } catch {
      addToast({ title: 'Error', message: 'No se pudo abrir el informe', type: 'error' });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    addToast({ title: 'Copiado', message: 'Enlace listo para abrir en navegador', type: 'success' });
  };

  const availableResponsables = useMemo(() => {
    const set = new Set();
    items.forEach((i) => { if (i.responsableNombre) set.add(i.responsableNombre); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [items]);

  const [exportando, setExportando] = useState(false);

  const handleExportarExcel = useCallback(async () => {
    setExportando(true);
    try {
      const params = {};
      if (!showAllMonths && mes) {
        const [y, m] = mes.split('-');
        const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
        params.from = `${mes}-01`;
        params.to   = `${mes}-${String(lastDay).padStart(2, '0')}`;
      }
      if (responsableFilter !== 'all') params.responsable = responsableFilter;
      const suffix = params.from ? `_${params.from.slice(0, 7)}` : '';
      await downloadXlsx('/exportar/tratos', `tratos${suffix}.xlsx`, params);
    } catch {
      addToast({ title: 'Error', message: 'No se pudo exportar', type: 'error' });
    } finally {
      setExportando(false);
    }
  }, [showAllMonths, mes, responsableFilter, addToast]);

  const baseFilteredItems = useMemo(() => items.filter((i) => {
    if (searchTerm && !(i.proveedorNombre || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (!showAllMonths && (i.vigenciaDesde || i.fechaCierre) && toMonthKey(i.vigenciaDesde || i.fechaCierre) !== mes) return false;
    if (responsableFilter !== 'all' && i.responsableNombre !== responsableFilter) return false;
    return true;
  }), [items, searchTerm, mes, showAllMonths, responsableFilter]);

  const filteredItems = useMemo(() => {
    if (!estadoFilter) return baseFilteredItems;
    return baseFilteredItems.filter((i) => getUiEstadoFromApi(i.estado) === estadoFilter);
  }, [baseFilteredItems, estadoFilter]);

  const kpiCounts = useMemo(() => {
    const getTons = (i) => Number(i.tonsAcordadas || deriveVolumenDesdeCondiciones(i.condiciones) || 0);
    const counts = {
      total: baseFilteredItems.length,
      totalTons: baseFilteredItems.reduce((s, i) => s + getTons(i), 0),
    };
    for (const e of ESTADOS_TRATO) {
      const stateItems = baseFilteredItems.filter((i) => getUiEstadoFromApi(i.estado) === e.val);
      counts[e.val] = stateItems.length;
      counts[`${e.val}Tons`] = stateItems.reduce((s, i) => s + getTons(i), 0);
    }
    return counts;
  }, [baseFilteredItems]);

  const formFechaTerminoEstimada = useMemo(() => calcularFechaTerminoEstimadaTrato({
    fechaInicioCosecha: form.fechaInicioCosecha,
    tonsAcordadas: form.tonsAcordadas,
    condiciones: form.condiciones,
    transporte: form.transporteTrato,
  }), [form.fechaInicioCosecha, form.tonsAcordadas, form.condiciones, form.transporteTrato]);

  return (
    <div className="mx-page am-p-0">
      <div className="mx-toolbar" data-tour="tratos-filtros">
        <div className="mx-search-box tratos-toolbar-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="tratos-month-nav">
          <button className="mx-btn-icon sm" onClick={() => { moveMes(-1); setShowAllMonths(false); }} title="Mes anterior" disabled={showAllMonths}>
            <ChevronLeft size={16} />
          </button>
          <span className={`tratos-month-label${showAllMonths ? ' is-all' : ''}`}>
            {showAllMonths ? '—' : mesLabel(mes)}
          </span>
          <button className="mx-btn-icon sm" onClick={() => { moveMes(1); setShowAllMonths(false); }} title="Mes siguiente" disabled={showAllMonths}>
            <ChevronRight size={16} />
          </button>
          <button type="button" className={`tratos-todos-btn${showAllMonths ? ' is-active' : ''}`} onClick={() => setShowAllMonths((v) => !v)}>
            Todos
          </button>
        </div>
        {availableResponsables.length > 1 && (
          <label className="cal-filter-select">
            <User size={15} />
            <select value={responsableFilter} onChange={(e) => setResponsableFilter(e.target.value)}>
              <option value="all">Todos los responsables</option>
              {availableResponsables.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
        )}
        <button className="mx-btn-icon sm" onClick={handleRefresh} title="Actualizar"><RotateCcw size={18} /></button>
        <button className="mx-btn-icon sm" onClick={handleExportarExcel} disabled={exportando} title="Exportar a Excel"><FileDown size={16} /></button>
        <HelpTourButton tourId="tratos" />
        <button className="mx-btn mx-btn-primary" onClick={openNew} data-tour="tratos-registrar">
          <Plus size={18} /> Nuevo Trato
        </button>
      </div>

      <div className="disponibilidad-kpi-grid tratos-kpi-grid">
        <button type="button" className={`disponibilidad-kpi disponibilidad-kpi-button disponibilidad-kpi--total${!estadoFilter ? ' is-active' : ''}`} aria-pressed={!estadoFilter} onClick={() => setEstadoFilter('')}>
          <span>Total tratos</span>
          <strong>{kpiCounts.total}</strong>
          {kpiCounts.totalTons > 0 && <small className="tratos-kpi-tons">{formatInteger(kpiCounts.totalTons)} t</small>}
        </button>
        {ESTADOS_TRATO.map((e) => (
          <button key={e.val} type="button" className={`disponibilidad-kpi disponibilidad-kpi-button disponibilidad-kpi--${ESTADO_TONE[e.val]}${estadoFilter === e.val ? ' is-active' : ''}`} aria-pressed={estadoFilter === e.val} onClick={() => setEstadoFilter(estadoFilter === e.val ? '' : e.val)}>
            <span>{e.label}</span>
            <strong>{kpiCounts[e.val] ?? 0}</strong>
            {kpiCounts[`${e.val}Tons`] > 0 && <small className="tratos-kpi-tons">{formatInteger(kpiCounts[`${e.val}Tons`])} t</small>}
          </button>
        ))}
      </div>

      <TratosTable
        items={filteredItems}
        loading={loading}
        onShare={compartirTrato}
        onEdit={openEdit}
        onDelete={setConfirmDeleteTrato}
        onViewReport={handleViewReport}
      />

      <TratoFormModal
        isOpen={isModalOpen}
        editingId={editingId}
        form={form}
        fechaTerminoEstimada={formFechaTerminoEstimada}
        selectedProvider={selectedProvider}
        providerSearch={providerSearch}
        loadingProviders={loadingProviders}
        filteredProviders={filteredProviders}
        tiposTransporte={tiposTransporte}
        onClose={closeModal}
        onSubmit={handleSave}
        onFormChange={setForm}
        onProviderSearchChange={setProviderSearch}
        onClearSelectedProvider={() => setSelectedProvider(null)}
        onSelectProvider={handleSelectProvider}
        onTransporteChange={handleTransporteChange}
        onConditionModeChange={handleConditionModeChange}
        onConditionValueChange={handleConditionValueChange}
        onConditionStatusChange={toggleCondicionStatus}
      />
      <ConfirmDeleteModal
        isOpen={Boolean(confirmDeleteTrato)}
        onClose={() => setConfirmDeleteTrato(null)}
        onConfirm={handleDelete}
        title="Eliminar trato?"
        itemName={confirmDeleteTrato?.proveedorNombre}
      />

      <TratoShareModal
        isOpen={shareModal.open}
        url={shareModal.url}
        message={shareModal.message}
        onCopy={copyToClipboard}
        onClose={() => setShareModal({ open: false, url: '', item: null, message: '' })}
      />

      {/* Modal post-guardar */}
      {savedModal && (
        <div className="tratos-saved-overlay" onClick={() => setSavedModal(null)}>
          <div className="tratos-saved-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tratos-saved-header">
              <div className="tratos-saved-icon">
                <CheckCircle size={22} />
              </div>
              <div className="tratos-saved-title">
                {savedModal.isNew ? 'Trato comercial creado' : 'Trato comercial actualizado'}
              </div>
              <button className="tratos-saved-close" onClick={() => setSavedModal(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="tratos-saved-body">
              <div className="tratos-saved-summary">
                <div className="tratos-saved-row" style={{ gridColumn: '1 / -1' }}>
                  <span className="tratos-saved-row-label">Proveedor</span>
                  <span className="tratos-saved-row-value">{savedModal.trato.proveedorNombre || '—'}</span>
                </div>
                <div className="tratos-saved-row">
                  <span className="tratos-saved-row-label">Toneladas</span>
                  <span className="tratos-saved-row-value">{savedModal.trato.tonsAcordadas || '—'} t</span>
                </div>
                <div className="tratos-saved-row">
                  <span className="tratos-saved-row-label">Precio</span>
                  <span className="tratos-saved-row-value">
                    {savedModal.trato.precioAcordado ? `$${Number(savedModal.trato.precioAcordado).toLocaleString('es-CL')} /kg` : '—'}
                  </span>
                </div>
                <div className="tratos-saved-row">
                  <span className="tratos-saved-row-label">Inicio probable</span>
                  <span className="tratos-saved-row-value">
                    {savedModal.trato.fechaInicio
                      ? new Date(savedModal.trato.fechaInicio + 'T12:00:00Z').toLocaleDateString('es-CL')
                      : '—'}
                  </span>
                </div>
                <div className="tratos-saved-row">
                  <span className="tratos-saved-row-label">Término estimado</span>
                  <span className="tratos-saved-row-value">
                    {savedModal.trato.fechaTermino
                      ? new Date(savedModal.trato.fechaTermino).toLocaleDateString('es-CL')
                      : 'Pendiente'}
                  </span>
                </div>
                <div className="tratos-saved-row" style={{ gridColumn: '1 / -1' }}>
                  <span className="tratos-saved-row-label">Responsable</span>
                  <span className="tratos-saved-row-value">{savedModal.trato.responsableNombre || '—'}</span>
                </div>
              </div>
              {savedModal.wasAcordado && !savedModal.hasProgramaActivo && (
                <div className="tratos-saved-hint">
                  ✅ Ahora puedes crear el programa de cosecha para este proveedor y trato.
                </div>
              )}
            </div>
            <div className="tratos-saved-footer">
              {(savedModal.wasAcordado || savedModal.hasProgramaActivo) && (
                <Link to={`/biomasa/programa?tratoId=${savedModal.tratoId}`} className="mx-btn mx-btn-primary" onClick={() => setSavedModal(null)}>
                  <CalendarCheck size={16} /> {savedModal.hasProgramaActivo ? 'Ver programa de cosecha' : 'Crear programa de cosecha'}
                </Link>
              )}
              <button
                className="mx-btn mx-btn-outline"
                onClick={() => {
                  setSavedModal(null);
                  const match = items.find(i => String(i._id) === String(savedModal.tratoId));
                  if (match) handleViewReport(match);
                }}
              >
                <FileText size={16} /> Ver informe
              </button>
              <button className="mx-btn mx-btn-ghost" onClick={() => setSavedModal(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
     </div>
   );
 }
