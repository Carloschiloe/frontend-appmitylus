import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Plus, RotateCcw
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
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
  createEmptyForm,
  deriveCamionesXDia,
  derivePrecioDesdeCondiciones,
  deriveVolumenDesdeCondiciones,
  getApiEstadoFromUi,
  getUiEstadoFromApi,
  isEquivalentEstado,
  normalizeDateOnlyForUiSafe,
  parseNumberOrNull,
  toList,
} from './tratos.helpers';

export default function Tratos() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
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

  useEffect(() => {
    if (isModalOpen && !editingId && maestrosCondiciones.length > 0) {
      const initialCond = buildInitialConditions(maestrosCondiciones);
      setForm(prev => ({ ...prev, condiciones: initialCond }));
    }
  }, [isModalOpen, editingId, maestrosCondiciones]);

  const openNew = useCallback(() => {
    setEditingId(null);
    setEditingEstadoApi('');
    setProviderSearch('');
    setSelectedProvider(null);
    setForm(createEmptyForm(buildInitialConditions(maestrosCondiciones)));
    setIsModalOpen(true);
  }, [maestrosCondiciones]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingId(null);
    setEditingEstadoApi('');
    setProviderSearch('');
    setSelectedProvider(null);
    setForm(createEmptyForm(buildInitialConditions(maestrosCondiciones)));
  }, [maestrosCondiciones]);

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
        const tratoPayload = {
          tonsAcordadas: parseNumberOrNull(form.tonsAcordadas) ?? volumenDesdeCondiciones,
          precioAcordado: derivePrecioDesdeCondiciones(form.condiciones),
          notasTrato: form.notas || '',
          camionesXDia: deriveCamionesXDia(form.condiciones),
          vigenciaDesde: form.fechaInicioCosecha || null,
        };

        await apiClient.patch(`/oportunidades/${editingId}/trato`, tratoPayload);

        await Promise.all(
          (form.condiciones || []).map((condicion) =>
            apiClient.post(`/oportunidades/${editingId}/condiciones`, {
              ...condicion,
              valor: condicion.valor === '' ? null : condicion.valor,
            })
          )
        );

        if (!isEquivalentEstado(editingEstadoApi, form.estado)) {
          await apiClient.patch(`/oportunidades/${editingId}/estado`, {
            estado: getApiEstadoFromUi(form.estado),
            observacion: form.notas || '',
          });
        }
        addToast({ title: 'Actualizado', message: 'Trato actualizado con exito', type: 'success' });
      } else {
        if (!selectedProvider?.proveedorKey || !selectedProvider?.proveedorNombre) {
          addToast({ title: 'Falta proveedor', message: 'Selecciona un proveedor del listado antes de guardar.', type: 'warning' });
          return;
        }

        const volumenDesdeCondiciones = deriveVolumenDesdeCondiciones(form.condiciones);
        await apiClient.post('/oportunidades', {
          proveedorId: selectedProvider.contactoId,
          proveedorKey: selectedProvider.proveedorKey,
          proveedorNombre: selectedProvider.proveedorNombre,
          estado: getApiEstadoFromUi(form.estado),
          origen: 'manual',
          tonsAcordadas: parseNumberOrNull(form.tonsAcordadas) ?? volumenDesdeCondiciones,
          precioAcordado: derivePrecioDesdeCondiciones(form.condiciones),
          notasTrato: form.notas || '',
          camionesXDia: deriveCamionesXDia(form.condiciones),
          vigenciaDesde: form.fechaInicioCosecha || null,
          condiciones: (form.condiciones || []).map((condicion) => ({
            ...condicion,
            valor: condicion.valor === '' ? null : condicion.valor,
          })),
          meta: {
            contactoNombre: selectedProvider.contactoNombre || '',
            contactoTelefono: selectedProvider.contactoTelefono || '',
            contactoEmail: selectedProvider.contactoEmail || '',
            comuna: selectedProvider.comuna || '',
          },
        });
        addToast({ title: 'Creado', message: 'Nuevo trato registrado', type: 'success' });
      }
      closeModal();
      handleRefresh();
    } catch {
      addToast({ title: 'Error', message: 'No se pudo guardar el trato', type: 'error' });
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
      tonsAcordadas: item.tonsAcordadas || '',
      precioBase: '',
      fechaInicioCosecha: item.vigenciaDesde
        ? item.vigenciaDesde.slice(0, 10)
        : (item.fechaCierre ? item.fechaCierre.slice(0, 10) : ''),
      estado: getUiEstadoFromApi(item.estado),
      notas: item.notasTrato || item.notas || '',
      condiciones: item.condiciones || []
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

  const filteredItems = items.filter(i => 
    (i.proveedorNombre || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mx-page am-p-0">
      <div className="mx-toolbar am-mt-16">
        <div className="mx-search-box tratos-toolbar-search">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Buscar por proveedor..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="mx-btn-icon sm" onClick={handleRefresh} title="Actualizar"><RotateCcw size={18} /></button>
        <button className="mx-btn mx-btn-primary" onClick={openNew}>
          <Plus size={18} /> Nueva Negociacion
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
        onCopy={copyToClipboard}
        onClose={() => setShareModal({ open: false, url: '', item: null, message: '' })}
      />
     </div>
   );
 }



