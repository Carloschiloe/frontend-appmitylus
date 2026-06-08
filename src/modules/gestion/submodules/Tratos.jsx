import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Plus, RotateCcw, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { apiClient } from '../../../api/apiClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useContactos, useCentros, useTratos } from '../hooks/useGestionQueries';
import { maestrosApi } from '../../../api/api-maestros';
import ConfirmDeleteModal from '../../../components/ConfirmDeleteModal';
import TratoFormModal from './TratoFormModal';
import TratoShareModal from './TratoShareModal';
import TratosTable from './TratosTable';
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
  getEstadoCierreFromApi,
  normalizeDateOnlyForUiSafe,
  parseNumberOrNull,
  toList,
} from './tratos.helpers';

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
  const [providerSearch, setProviderSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState(null);

  // 1. Carga de datos con React Query
  const { data: tratosRes, isLoading: loadingTratos } = useTratos();
  
  const items = useMemo(() => {
    const raw = toList(tratosRes);
    return raw.map((item) => ({
      ...item,
      fechaCierre: normalizeDateOnlyForUiSafe(item.fechaCierre),
      vigenciaDesde: normalizeDateOnlyForUiSafe(item.vigenciaDesde),
      vigenciaHasta: normalizeDateOnlyForUiSafe(item.vigenciaHasta),
    }));
  }, [tratosRes]);

  const loading = loadingTratos;

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tratos'] });
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
    });
  }, [maestrosCondiciones, currentResponsable]);

  const handleSelectProvider = useCallback((provider) => {
    setSelectedProvider(provider);
    setProviderSearch(provider.proveedorNombre || '');
    setForm((prev) => ({ ...prev, proveedorNombre: provider.proveedorNombre || '' }));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
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
        addToast({ title: 'Actualizado', message: 'Trato actualizado con éxito', type: 'success' });
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
        const newId = created?.item?._id || created?._id;
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
          });

          // 3. Si todas las condiciones quedaron acordadas, el trato pasa a Acordado
          const todasAcordadas =
            form.condiciones.length > 0 &&
            form.condiciones.every((c) => c.estado === 'acordado');
          if (todasAcordadas) {
            await apiClient.patch(`/oportunidades/${newId}/estado`, {
              estado: 'acordado',
              observacion: form.notas || '',
            });
          }
        }
        addToast({ title: 'Creado', message: 'Nuevo trato registrado', type: 'success' });
      }
      closeModal();
      handleRefresh();
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    addToast({ title: 'Copiado', message: 'Enlace listo para abrir en navegador', type: 'success' });
  };

  const availableResponsables = useMemo(() => {
    const set = new Set();
    items.forEach((i) => { if (i.responsableNombre) set.add(i.responsableNombre); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [items]);

  const filteredItems = useMemo(() => items.filter((i) => {
    if (searchTerm && !(i.proveedorNombre || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (!showAllMonths && toMonthKey(i.vigenciaDesde || i.fechaCierre) !== mes) return false;
    if (responsableFilter !== 'all' && i.responsableNombre !== responsableFilter) return false;
    return true;
  }), [items, searchTerm, mes, showAllMonths, responsableFilter]);
  const formFechaTerminoEstimada = useMemo(() => calcularFechaTerminoEstimadaTrato({
    fechaInicioCosecha: form.fechaInicioCosecha,
    tonsAcordadas: form.tonsAcordadas,
    condiciones: form.condiciones,
  }), [form.fechaInicioCosecha, form.tonsAcordadas, form.condiciones]);

  return (
    <div className="mx-page am-p-0">
      <div className="mx-toolbar">
        <div className="mx-search-box tratos-toolbar-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className="mx-btn-icon sm"
            onClick={() => { moveMes(-1); setShowAllMonths(false); }}
            title="Mes anterior"
            disabled={showAllMonths}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontWeight: 'var(--weight-bold)', fontSize: '13px', minWidth: 110, textAlign: 'center', color: showAllMonths ? 'var(--color-text-subtle)' : 'var(--color-text)' }}>
            {showAllMonths ? '—' : mesLabel(mes)}
          </span>
          <button
            className="mx-btn-icon sm"
            onClick={() => { moveMes(1); setShowAllMonths(false); }}
            title="Mes siguiente"
            disabled={showAllMonths}
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => setShowAllMonths((v) => !v)}
            style={{
              padding: '3px 10px',
              borderRadius: 999,
              fontSize: '0.78rem',
              fontWeight: 600,
              border: showAllMonths ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
              background: showAllMonths ? 'rgba(10,92,255,0.08)' : 'transparent',
              color: showAllMonths ? 'var(--color-primary)' : 'var(--color-text-subtle)',
              cursor: 'pointer',
            }}
          >
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
        <button className="mx-btn mx-btn-primary" onClick={openNew}>
          <Plus size={18} /> Nuevo Trato
        </button>
      </div>

      <TratosTable
        items={filteredItems}
        loading={loading}
        onShare={compartirTrato}
        onEdit={openEdit}
        onDelete={setConfirmDeleteTrato}
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
        onClose={closeModal}
        onSubmit={handleSave}
        onFormChange={setForm}
        onProviderSearchChange={setProviderSearch}
        onClearSelectedProvider={() => setSelectedProvider(null)}
        onSelectProvider={handleSelectProvider}
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
     </div>
   );
 }
