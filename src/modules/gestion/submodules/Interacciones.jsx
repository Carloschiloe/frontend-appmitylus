import { useState, useEffect, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { Search, Plus, RotateCcw } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { apiClient } from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { 
  useInteracciones, 
  useCentros, 
  useContactos 
} from '../hooks/useGestionQueries';
import ConfirmDeleteModal from '../../../components/ConfirmDeleteModal';
import InteraccionFormModal from './InteraccionFormModal';
import InteraccionesTable from './InteraccionesTable';
import './interacciones.css';
import {
  buildProviderDirectory,
  createEmptyInteraccionForm,
  filterInteracciones,
  filterProviders,
  toItems,
} from './interacciones.helpers';

export default function Interacciones() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const { addToast } = useToast();
  const { user } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(() => createEmptyInteraccionForm());

  const [providerSearch, setProviderSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [confirmDeleteInteraccion, setConfirmDeleteInteraccion] = useState(null);

  // 1. Carga de datos con React Query
  const { data: interaccionesRes, isLoading: loadingItems } = useInteracciones({ limit: 200 });
  const { data: centrosRaw, isLoading: loadingCentros } = useCentros({ enabled: isModalOpen });
  const { data: contactosRaw, isLoading: loadingContactos } = useContactos({ conEmpresa: 1 }, { enabled: isModalOpen });

  const items = useMemo(() => {
    return toItems(interaccionesRes);
  }, [interaccionesRes]);

  const providers = useMemo(() => {
    if (!isModalOpen) return [];
    const centros = Array.isArray(centrosRaw) ? centrosRaw : (centrosRaw?.items || []);
    const contactos = Array.isArray(contactosRaw) ? contactosRaw : (contactosRaw?.items || []);
    return buildProviderDirectory(centros, contactos);
  }, [isModalOpen, centrosRaw, contactosRaw]);

  const loading = loadingItems;
  const loadingProviders = loadingCentros || loadingContactos;

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['interacciones'] });
  }, [queryClient]);

  useEffect(() => {
    window.addEventListener('gestion:quick-capture-saved', handleRefresh);
    return () => window.removeEventListener('gestion:quick-capture-saved', handleRefresh);
  }, [handleRefresh]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get('q') || '';
    if (query) setSearchTerm(query);
  }, [location.search]);

  const filteredProviders = useMemo(() => {
    return filterProviders(providers, providerSearch);
  }, [providers, providerSearch]);

  const filteredItems = useMemo(() => {
    return filterInteracciones(items, searchTerm);
  }, [items, searchTerm]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setProviderSearch('');
    setSelectedProvider(null);
    setForm(createEmptyInteraccionForm());
  }, []);

  const handleSelectProvider = useCallback((provider) => {
    setSelectedProvider(provider);
    setProviderSearch(provider.proveedorNombre);
    setForm((prev) => ({
      ...prev,
      proveedorKey: provider.proveedorKey || '',
      proveedorNombre: provider.proveedorNombre || '',
      contactoId: provider.contactoId || '',
      contactoNombre: provider.contactoNombre || '',
    }));
  }, []);

  const handleProviderSearchChange = useCallback((value) => {
    setProviderSearch(value);
    if (selectedProvider && value !== selectedProvider.proveedorNombre) {
      setSelectedProvider(null);
    }
  }, [selectedProvider]);

   const openCreateModal = useCallback(() => {
     setForm(createEmptyInteraccionForm());
     setProviderSearch('');
     setSelectedProvider(null);
     setIsModalOpen(true);
   }, []);

   const openEditModal = useCallback((item) => {
     const itemId = item?._id || item?.id || '';
     const fecha = item?.fecha ? String(item.fecha).slice(0, 10) : createEmptyInteraccionForm().fecha;
     setForm({
       ...createEmptyInteraccionForm(),
       _id: itemId,
       proveedorKey: item?.proveedorKey || '',
       proveedorNombre: item?.proveedorNombre || '',
       contactoId: item?.contactoId || '',
       contactoNombre: item?.contactoNombre || '',
       tipo: item?.tipo || 'interaccion',
       fecha,
       resumen: item?.resumen || '',
       notas: item?.notas || item?.resultado || item?.detalle || '',
       proximaAccion: item?.proximoPaso || item?.proximaAccion || '',
       fechaProxima: item?.fechaProximo ? String(item.fechaProximo).slice(0, 10) : '',
     });
     setProviderSearch(item?.proveedorNombre || '');
     setSelectedProvider(null);
     setIsModalOpen(true);
   }, []);

   const handleSave = useCallback(async (e) => {
     e.preventDefault();
     try {
       const { _id, ...formPayload } = form;
       const responsablePG = user?.nombre || user?.name || user?.email?.split('@')?.[0] || 'Usuario';
       const payload = {
         ...formPayload,
         responsablePG,
         resultado: formPayload.notas || formPayload.resultado || '',
       };
       delete payload.notas;

       if (_id) {
         await apiClient.put(`/interacciones/${_id}`, payload);
       } else {
         await apiClient.post('/interacciones', payload);
       }
       addToast({ title: 'Exito', message: _id ? 'Gestión actualizada' : 'Gestión registrada', type: 'success' });
       closeModal();
       handleRefresh();
     } catch {
       addToast({ title: 'Error', message: 'No se pudo guardar', type: 'error' });
     }
   }, [form, user, addToast, handleRefresh, closeModal]);

   const deleteMutation = useMutation({
     mutationFn: (id) => apiClient.delete(`/interacciones/${id}`),
     onSuccess: () => {
       addToast({ title: 'Exito', message: 'Gestión eliminada correctamente.', type: 'success' });
       setConfirmDeleteInteraccion(null);
       handleRefresh();
     },
     onError: () => {
       addToast({ title: 'Error', message: 'No se pudo eliminar la interaccion.', type: 'error' });
     }
   });

   const handleDelete = (item) => {
     setConfirmDeleteInteraccion(item);
   };

   const handleConfirmDelete = () => {
     if (confirmDeleteInteraccion?._id) {
       deleteMutation.mutate(confirmDeleteInteraccion._id);
     }
   };

  return (
    <div className="interacciones-container">
      <div className="interacciones-filters">
        <div className="interacciones-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por proveedor o contenido..."
            className="mx-input interacciones-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="mx-btn mx-btn-outline sm" onClick={handleRefresh}>
          <RotateCcw size={18} />
        </button>
        <button className="mx-btn mx-btn-primary sm" onClick={openCreateModal}>
          <Plus size={18} />
          Registrar gestion
        </button>

      </div>

      <InteraccionesTable
        items={filteredItems}
        loading={loading}
        onEdit={openEditModal}
        onDelete={handleDelete}
      />

      {isModalOpen && (
        <InteraccionFormModal
          form={form}
          filteredProviders={filteredProviders}
          loadingProviders={loadingProviders}
          providerSearch={providerSearch}
          selectedProvider={selectedProvider}
          onClose={closeModal}
          onFormChange={setForm}
          onProviderSearchChange={handleProviderSearchChange}
          onProviderSelect={handleSelectProvider}
          onSubmit={handleSave}
        />
       )}

      <ConfirmDeleteModal
        isOpen={Boolean(confirmDeleteInteraccion)}
        onClose={() => setConfirmDeleteInteraccion(null)}
        onConfirm={handleConfirmDelete}
        itemName={confirmDeleteInteraccion?.proveedorNombre}
        title="Eliminar gestión?"
      />
     </div>
   );
 }



