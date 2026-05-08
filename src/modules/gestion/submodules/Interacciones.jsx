import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X, RotateCcw, Edit, Trash2 } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { apiClient } from '../../../api/apiClient';
import { 
  useInteracciones, 
  useCentros, 
  useContactos 
} from '../hooks/useGestionQueries';
import ConfirmDeleteModal from '../../../components/ConfirmDeleteModal';

function buildProviderDirectory(centros = [], contactos = []) {
  const firstContactByKey = new Map();
  contactos.forEach((item) => {
    const key = String(item.proveedorKey || '').trim().toLowerCase();
    if (!key || firstContactByKey.has(key)) return;
    firstContactByKey.set(key, item);
  });

  const providers = new Map();
  centros.forEach((centro, index) => {
    const proveedorNombre = String(centro.proveedor || '').trim() || 'Proveedor sin nombre';
    const proveedorKey = String(centro.proveedorKey || proveedorNombre).trim().toLowerCase();
    if (!proveedorKey) return;

    const linkedContact = firstContactByKey.get(proveedorKey);
    const existing = providers.get(proveedorKey);

    if (!existing) {
      providers.set(proveedorKey, {
        id: `prov-${proveedorKey || index}`,
        contactoId: linkedContact?._id || '',
        proveedorKey,
        proveedorNombre,
        contactoNombre: linkedContact?.contactoNombre || '',
        comuna: centro.comuna || '',
      });
      return;
    }

    if (!existing.contactoNombre && linkedContact?.contactoNombre) existing.contactoNombre = linkedContact.contactoNombre;
    if (!existing.comuna && centro.comuna) existing.comuna = centro.comuna;
  });

  return Array.from(providers.values()).sort((a, b) => a.proveedorNombre.localeCompare(b.proveedorNombre));
}

const TIPOS = [
  { val: 'interaccion', label: 'Nota', color: '#64748b' },
  { val: 'llamada', label: 'Llamada', color: '#8b5cf6' },
  { val: 'reunion', label: 'Reunión', color: '#f59e0b' },
  { val: 'muestreo', label: 'Muestreo', color: '#2dd4bf' },
  { val: 'visita', label: 'Visita', color: '#0d9488' },
  { val: 'compromiso', label: 'Compromiso', color: '#10b981' },
];

export default function Interacciones() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    proveedorNombre: '',
    tipo: 'interaccion',
    fecha: new Date().toISOString().slice(0, 10),
    resumen: '',
    notas: '',
    proximaAccion: '',
    fechaProxima: '',
  });

  const [providerSearch, setProviderSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [confirmDeleteInteraccion, setConfirmDeleteInteraccion] = useState(null);

  // 1. Carga de datos con React Query
  const { data: interaccionesRes, isLoading: loadingItems } = useInteracciones({ limit: 200 });
  const { data: centrosRaw, isLoading: loadingCentros } = useCentros({ enabled: isModalOpen });
  const { data: contactosRaw, isLoading: loadingContactos } = useContactos({ conEmpresa: 1 }, { enabled: isModalOpen });

  const items = useMemo(() => {
    if (!interaccionesRes) return [];
    return Array.isArray(interaccionesRes) ? interaccionesRes : (interaccionesRes.items || []);
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

  const filteredProviders = useMemo(() => {
    const query = providerSearch.toLowerCase();
    return providers
      .filter((item) => {
        if (!query) return true;
        const providerText = `${item.proveedorNombre || ''} ${item.comuna || ''}`.toLowerCase();
        return providerText.includes(query);
      })
      .slice(0, 10);
  }, [providers, providerSearch]);

  const filteredItems = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return items.filter((item) =>
      (item.proveedorNombre || '').toLowerCase().includes(query) ||
      (item.resumen || '').toLowerCase().includes(query)
    );
  }, [items, searchTerm]);

  const closeModal = () => {
    setIsModalOpen(false);
    setProviderSearch('');
    setSelectedProvider(null);
    setForm({
      proveedorNombre: '',
      tipo: 'interaccion',
      fecha: new Date().toISOString().slice(0, 10),
      resumen: '',
      notas: '',
      proximaAccion: '',
      fechaProxima: '',
    });
  };

  const handleSelectProvider = useCallback((provider) => {
    setSelectedProvider(provider);
    setProviderSearch(provider.proveedorNombre);
    setForm((prev) => ({ ...prev, proveedorNombre: provider.proveedorNombre }));
  }, []);

   const handleSave = async (e) => {
     e.preventDefault();
     try {
       await apiClient.post('/interacciones', form);
       addToast({ title: 'Éxito', message: 'Interacción registrada', type: 'success' });
       closeModal();
       handleRefresh();
     } catch {
       addToast({ title: 'Error', message: 'No se pudo guardar', type: 'error' });
     }
   };

   const deleteMutation = useMutation({
     mutationFn: (id) => apiClient.delete(`/interacciones/${id}`),
     onSuccess: () => {
       addToast({ title: 'Éxito', message: 'Interacción eliminada correctamente.', type: 'success' });
       setConfirmDeleteInteraccion(null);
       handleRefresh();
     },
     onError: () => {
       addToast({ title: 'Error', message: 'No se pudo eliminar la interacción.', type: 'error' });
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
      <div className="centros-filters am-mt-16">
        <div className="centros-search-wrap" style={{ flex: 1 }}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por proveedor o contenido..."
            className="centros-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="mx-btn mx-btn-outline sm" onClick={handleRefresh}>
          <RotateCcw size={18} />
        </button>
        <button className="mx-btn mx-btn-primary sm" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Nueva Gestión
        </button>
      </div>

      <div className="mx-table-card am-mt-16">
        <div className="mx-table-wrap">
          <table className="mx-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Tipo</th>
                <th>Resumen de Gestión</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '60px' }}><div className="mx-spinner" style={{ margin: '0 auto' }}></div></td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '60px' }}>No hay registros.</td></tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item._id}>
                    <td style={{ fontWeight: 600 }}>{new Date(item.fecha).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 700 }}>{item.proveedorNombre}</td>
                    <td>
                      <span
                        className="mx-badge"
                        style={{
                          background: `${TIPOS.find((t) => t.val === item.tipo)?.color}15`,
                          color: TIPOS.find((t) => t.val === item.tipo)?.color,
                          fontWeight: 700,
                        }}
                      >
                        {TIPOS.find((t) => t.val === item.tipo)?.label || 'Nota'}
                      </span>
                    </td>
                    <td>{item.resumen}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="mx-table-actions-cell" style={{ display: 'inline-flex' }}>
                       <button className="mx-action-btn edit"><Edit size={14} /></button>
                       <button className="mx-action-btn delete" onClick={() => handleDelete(item)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '550px' }}>
            <div className="mx-modal-head">
              <h3 className="mx-modal-title">Registrar Nueva Gestión</h3>
              <button className="mx-btn-icon" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="mx-modal-body">
                <div className="mx-field">
                  <label className="mx-label">Proveedor / Empresa</label>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--color-border)', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                    <Search size={18} style={{ color: 'var(--color-text-subtle)', flexShrink: 0 }} />
                    <input
                      type="text"
                      placeholder="Buscar proveedor..."
                      value={providerSearch}
                      onChange={(e) => {
                        setProviderSearch(e.target.value);
                        if (selectedProvider && e.target.value !== selectedProvider.proveedorNombre) {
                          setSelectedProvider(null);
                        }
                      }}
                      style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '0.96rem', color: 'var(--color-text)' }}
                    />
                  </div>
                  <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                    {loadingProviders ? (
                      <div className="gs-empty-inline">Cargando proveedores...</div>
                    ) : filteredProviders.length === 0 ? (
                      <div className="gs-empty-inline">No encontramos coincidencias.</div>
                    ) : (
                      filteredProviders.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectProvider(item)}
                          style={{
                            textAlign: 'left',
                            width: '100%',
                            border: selectedProvider?.id === item.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                            borderRadius: '14px',
                            padding: '12px 14px',
                            background: selectedProvider?.id === item.id ? 'rgba(13, 148, 136, 0.08)' : 'white',
                          }}
                        >
                          <strong style={{ display: 'block' }}>{item.proveedorNombre}</strong>
                          <span style={{ display: 'block', marginTop: 4, color: 'var(--color-text-subtle)', fontSize: '0.88rem' }}>
                            {item.comuna || 'Sin comuna'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <div className="mx-field-row" style={{ display: 'flex', gap: '16px' }}>
                  <div className="mx-field" style={{ flex: 1 }}>
                    <label className="mx-label">Tipo de Gestión</label>
                    <select className="mx-input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                      {TIPOS.map((t) => <option key={t.val} value={t.val}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="mx-field" style={{ flex: 1 }}>
                    <label className="mx-label">Fecha</label>
                    <input type="date" className="mx-input" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
                  </div>
                </div>
                <div className="mx-field">
                  <label className="mx-label">Resumen Ejecutivo</label>
                  <input className="mx-input" value={form.resumen} onChange={(e) => setForm({ ...form, resumen: e.target.value })} placeholder="Ej: Llamada de seguimiento de precio" required />
                </div>
                <div className="mx-field">
                  <label className="mx-label">Detalle y Compromisos</label>
                  <textarea className="mx-input" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows="4" />
                </div>
              </div>
              <div className="mx-modal-foot">
                <button type="button" className="mx-btn mx-btn-outline" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary">Guardar Gestión</button>
              </div>
            </form>
          </div>
        </div>
       )}

      <ConfirmDeleteModal
        isOpen={Boolean(confirmDeleteInteraccion)}
        onClose={() => setConfirmDeleteInteraccion(null)}
        onConfirm={handleConfirmDelete}
        itemName={confirmDeleteInteraccion?.proveedorNombre}
        title="¿Eliminar interacción?"
      />
     </div>
   );
 }

