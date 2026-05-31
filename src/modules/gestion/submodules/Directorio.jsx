import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity,
  Building2,
  User,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Edit,
  History,
  Trash2,
  Clock3,
  CheckCircle2,
  PauseCircle,
  CircleOff,
  X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../../api/apiClient';
import { useToast } from '../../../context/ToastContext';
import { 
  useCentros, 
  useContactos, 
  useOportunidades, 
  useInteracciones,
  useMuestreos
} from '../hooks/useGestionQueries';
import ConfirmDeleteModal from '../../../components/ConfirmDeleteModal';
import './directorio.css';

const STATUS_META = {
  activo: { label: 'Activo', tone: '#0A5CFF', bg: 'rgba(10, 92, 255, 0.12)', icon: Activity },
  pausado: { label: 'Pausado', tone: '#d97706', bg: 'rgba(217, 119, 6, 0.12)', icon: PauseCircle },
  cerrado: { label: 'Cerrado', tone: '#dc2626', bg: 'rgba(220, 38, 38, 0.10)', icon: CircleOff },
  acordado: { label: 'Acordado', tone: '#0891b2', bg: 'rgba(8, 145, 178, 0.12)', icon: CheckCircle2 },
  none: { label: 'Sin seguimiento', tone: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', icon: Clock3 },
};

const ESTADO_COMERCIAL_LABELS = {
  prospecto: 'Prospecto',
  negociando: 'En negociación',
  semi_acordado: 'Parcialmente acordado',
  acordado: 'Acordado',
  compra_efectuada: 'Compra efectuada',
  perdido: 'Perdido',
  descartado: 'Descartado',
  caido: 'Caído',
};

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function formatShortDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDaysAgo(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const msPerDay = 1000 * 60 * 60 * 24;
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday - startOfTarget) / msPerDay);

  if (diffDays <= 0) return 'Hoy';
  if (diffDays === 1) return 'Hace 1 día';
  return `Hace ${diffDays} días`;
}

function contactName(contact) {
  return contact?.contactoNombre || contact?.nombre || '';
}

function contactPhone(contact) {
  return contact?.contactoTelefono || contact?.telefono || '';
}

function contactEmail(contact) {
  return contact?.contactoEmail || contact?.email || '';
}

function buildProviderRows(centros = [], contactos = [], oportunidades = [], interacciones = [], muestreos = []) {
  const providers = new Map();

  centros.forEach((centro, index) => {
    const nombre = String(centro.proveedor || '').trim() || 'Proveedor sin nombre';
    const key = normalizeKey(centro.proveedorKey || nombre || `prov-${index}`);
    if (!providers.has(key)) {
      providers.set(key, {
        nombre,
        key: centro.proveedorKey || '',
        providerKey: key,
        primaryCenterId: centro._id || '',
        primaryCenterCode: centro.code || '',
        centros: 0,
        comuna: centro.comuna || '-',
        totalContactos: 0,
        contactoPrincipal: '',
        contactoTelefono: '',
        contactoEmail: '',
        seguimientoEstado: '',
        estadoComercial: '',
        proximaAccion: '',
        fechaProximaAccion: '',
        ultimaInteraccionResumen: '',
        ultimaInteraccionFecha: '',
        ultimoResponsable: '',
      });
    }

    const item = providers.get(key);
    item.centros += 1;
    if ((!item.comuna || item.comuna === '-') && centro.comuna) item.comuna = centro.comuna;
  });

  const contactsByProvider = new Map();
  contactos.forEach((contacto) => {
    const key = normalizeKey(contacto.proveedorKey || contacto.proveedorNombre);
    if (!key) return;
    if (!contactsByProvider.has(key)) contactsByProvider.set(key, []);
    contactsByProvider.get(key).push(contacto);

    if (!providers.has(key)) {
      providers.set(key, {
        nombre: contacto.proveedorNombre || 'Proveedor sin nombre',
        key: contacto.proveedorKey || '',
        providerKey: key,
        primaryCenterId: '',
        primaryCenterCode: '',
        centros: 0,
        comuna: '-',
        totalContactos: 0,
        contactoPrincipal: '',
        contactoTelefono: '',
        contactoEmail: '',
        seguimientoEstado: '',
        estadoComercial: '',
        proximaAccion: '',
        fechaProximaAccion: '',
        ultimaInteraccionResumen: '',
        ultimaInteraccionFecha: '',
        ultimoResponsable: '',
      });
    }
  });

  const latestOpportunityByProvider = new Map();
  oportunidades.forEach((item) => {
    const key = normalizeKey(item.proveedorKey || item.proveedorNombre);
    if (!key || latestOpportunityByProvider.has(key)) return;
    latestOpportunityByProvider.set(key, item);
  });

  const latestInteractionByProvider = new Map();
  interacciones.forEach((item) => {
    const key = normalizeKey(item.proveedorKey || item.proveedorNombre);
    if (!key || latestInteractionByProvider.has(key)) return;
    latestInteractionByProvider.set(key, item);
  });

  // Encontrar el ultimo muestreo por proveedor
  const latestMuestreoByProvider = new Map();
  muestreos.forEach((item) => {
    const key = normalizeKey(item.proveedorKey || item.proveedorNombre);
    if (!key) return;
    const existing = latestMuestreoByProvider.get(key);
    if (!existing || new Date(item.fecha) > new Date(existing.fecha)) {
      latestMuestreoByProvider.set(key, item);
    }
  });

  providers.forEach((provider, key) => {
    const providerContacts = contactsByProvider.get(key) || [];
    const firstContact = providerContacts[0] || null;
    const latestOpportunity = latestOpportunityByProvider.get(key) || null;
    const latestInteraction = latestInteractionByProvider.get(key) || null;
    const latestMuestreo = latestMuestreoByProvider.get(key) || null;

    provider.totalContactos = providerContacts.length;
    provider.contactoPrincipal = contactName(firstContact) || 'Primer contacto pendiente';
    provider.contactoTelefono = contactPhone(firstContact);
    provider.contactoEmail = contactEmail(firstContact);
    provider.seguimientoEstado = latestOpportunity?.seguimientoEstado || '';
    provider.estadoComercial = latestOpportunity?.estado || '';
    provider.proximaAccion = latestOpportunity?.proximaAccion || '';
    provider.fechaProximaAccion = latestOpportunity?.fechaProximaAccion || latestOpportunity?.fechaRevision || '';

    // Comparar fecha de ultima interaccion comercial con ultima fecha de muestreo tecnico
    const interactionDate = latestInteraction?.fecha ? new Date(latestInteraction.fecha) : null;
    const muestreoDate = latestMuestreo?.fecha ? new Date(latestMuestreo.fecha) : null;

    if (muestreoDate && (!interactionDate || muestreoDate > interactionDate)) {
      const rendText = latestMuestreo.rendimiento ? `Rend: ${latestMuestreo.rendimiento.toFixed(1)}%` : 'Realizado';
      const centroText = latestMuestreo.centroCodigo ? ` - Centro: ${latestMuestreo.centroCodigo}` : '';
      provider.ultimaInteraccionResumen = `Muestreo técnico: ${rendText}${centroText}`;
      provider.ultimaInteraccionFecha = latestMuestreo.fecha || '';
      provider.ultimoResponsable = latestMuestreo.responsable || '';
    } else if (latestInteraction) {
      provider.ultimaInteraccionResumen = latestInteraction.resumen || '';
      provider.ultimaInteraccionFecha = latestInteraction.fecha || '';
      provider.ultimoResponsable = latestInteraction.responsablePG || latestInteraction.responsable || '';
    }
  });

  // 4. Filtrar para mostrar solo los que tienen alguna actividad (contactos, oportunidades, interacciones o muestreos)
  // Esto evita mostrar el "directorio global" de 1000+ empresas sin relacion.
  return Array.from(providers.values())
    .filter(p => p.totalContactos > 0 || p.seguimientoEstado || p.ultimaInteraccionFecha)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export default function Directorio() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryFromUrl = searchParams.get('q') || '';

  const [tab, setTab] = useState('proveedores');
  const [searchTerm, setSearchTerm] = useState(queryFromUrl);
  const [modalState, setModalState] = useState({ open: false, mode: 'create', item: null });
  const [confirmDeleteContact, setConfirmDeleteContact] = useState(null);
  const [confirmDeleteProvider, setConfirmDeleteProvider] = useState(null);
  const [contactCompanyQuery, setContactCompanyQuery] = useState('');
  const [contactCenterValue, setContactCenterValue] = useState('');
  const [contactSelectedProviderKey, setContactSelectedProviderKey] = useState('');
  
  // Optimistic UI updates
  const [deletedProviders, setDeletedProviders] = useState(new Set());
  const [deletedContacts, setDeletedContacts] = useState(new Set());

  // 1. Carga de datos con React Query
  const { data: centrosRaw, isLoading: loadingCentros, refetch: refetchCentros } = useCentros();
  const { data: contactosRaw, isLoading: loadingContactos, refetch: refetchContactos } = useContactos({ conEmpresa: 1 });
  const { data: oportunidadesRaw, isLoading: loadingOpp, refetch: refetchOpp } = useOportunidades();
  const { data: interaccionesRaw, isLoading: loadingInt, refetch: refetchInt } = useInteracciones({ limit: 500 });
  const { data: muestreosRaw, isLoading: loadingMuestreos, refetch: refetchMuestreos } = useMuestreos();

  const loading = loadingCentros || loadingContactos || loadingOpp || loadingInt || loadingMuestreos;

  const loadData = useCallback(async () => {
    // Usamos queryClient para invalidar cache si estuviera disponible, pero refetch funciona
    await Promise.all([
      refetchCentros(),
      refetchContactos(),
      refetchOpp(),
      refetchInt(),
      refetchMuestreos(),
    ]);
  }, [refetchCentros, refetchContactos, refetchOpp, refetchInt, refetchMuestreos]);

  // 2. Procesamiento de datos
  const data = useMemo(() => {
    const centros = Array.isArray(centrosRaw) ? centrosRaw : (centrosRaw?.items || []);
    const contactos = Array.isArray(contactosRaw) ? contactosRaw : (contactosRaw?.items || []);
    const oportunidades = Array.isArray(oportunidadesRaw) ? oportunidadesRaw : (oportunidadesRaw?.items || []);
    const interacciones = Array.isArray(interaccionesRaw) ? interaccionesRaw : (interaccionesRaw?.items || []);
    const muestreos = Array.isArray(muestreosRaw) ? muestreosRaw : (muestreosRaw?.items || []);

    const allProviders = buildProviderRows(centros, contactos, oportunidades, interacciones, muestreos);
    
    return {
      proveedores: allProviders.filter(p => !deletedProviders.has(p.providerKey) && !deletedProviders.has(p.key)),
      contactos: contactos.filter(c => !deletedContacts.has(c._id)),
      centros,
    };
  }, [centrosRaw, contactosRaw, oportunidadesRaw, interaccionesRaw, muestreosRaw, deletedProviders, deletedContacts]);

  const [detailModal, setDetailModal] = useState({ open: false, provider: null });

  useEffect(() => {
    if (!queryFromUrl) return;
    setSearchTerm((prev) => prev || queryFromUrl);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('q');
    setSearchParams(nextParams, { replace: true });
  }, [queryFromUrl, searchParams, setSearchParams]);

  const providerStats = useMemo(() => {
    const list = data.proveedores || [];
    return {
      activos: list.filter((item) => item.seguimientoEstado === 'activo').length,
      pausados: list.filter((item) => item.seguimientoEstado === 'pausado').length,
      acordados: list.filter((item) => item.seguimientoEstado === 'acordado').length,
      sinSeguimiento: list.filter((item) => !item.seguimientoEstado).length,
    };
  }, [data.proveedores]);

  const filteredItems = useMemo(() => {
    const list = tab === 'proveedores' ? data.proveedores : data.contactos;
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter((item) => {
      if (tab === 'proveedores') {
        return [
          item.nombre,
          item.key,
          item.comuna,
          item.contactoPrincipal,
          item.proximaAccion,
          item.ultimaInteraccionResumen,
        ].some((value) => String(value || '').toLowerCase().includes(q));
      }

      return [
        item.nombre,
        item.contactoNombre,
        item.proveedorNombre,
        item.email,
        item.contactoEmail,
        item.telefono,
        item.contactoTelefono,
        item.proveedorKey,
      ].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [tab, data, searchTerm]);

  const providerOptions = useMemo(() => {
    const providersMap = new Map();

    // 1. Construir a partir de todos los centros (incluye importados de Sernapesca)
    (data.centros || []).forEach((centro) => {
      const nombre = String(centro.proveedor || '').trim() || 'Proveedor sin nombre';
      const key = centro.proveedorKey || '';
      const normKey = normalizeKey(key || nombre);

      if (!providersMap.has(normKey)) {
        providersMap.set(normKey, {
          nombre,
          key,
          providerKey: normKey,
          comuna: centro.comuna || '',
          centerCodesSet: new Set(),
          centerComunasSet: new Set(),
        });
      }

      const item = providersMap.get(normKey);
      if (centro.code) item.centerCodesSet.add(centro.code);
      if (centro.comuna) item.centerComunasSet.add(centro.comuna);
      if ((!item.comuna || item.comuna === '-') && centro.comuna) item.comuna = centro.comuna;
    });

    // 2. Suplementar con proveedores con actividad por seguridad
    (data.proveedores || []).forEach((prov) => {
      const normKey = normalizeKey(prov.key || prov.providerKey || prov.nombre);
      if (!providersMap.has(normKey)) {
        providersMap.set(normKey, {
          nombre: prov.nombre,
          key: prov.key,
          providerKey: normKey,
          comuna: prov.comuna || '',
          centerCodesSet: new Set(),
          centerComunasSet: new Set(),
        });
      }
    });

    // 3. Mapear al formato de opciones del selector
    return Array.from(providersMap.values()).map((provider) => ({
      ...provider,
      value: provider.key || provider.providerKey,
      label: provider.nombre,
      centerCodes: Array.from(provider.centerCodesSet),
      centerComunas: Array.from(provider.centerComunasSet),
    }));
  }, [data.proveedores, data.centros]);

  const selectedProvider = useMemo(() => {
    if (contactSelectedProviderKey) {
      const matched = providerOptions.find((provider) => normalizeKey(provider.value) === normalizeKey(contactSelectedProviderKey));
      if (matched) return matched;
      if (modalState.mode === 'edit' && modalState.item?.proveedorNombre) {
        return {
          key: modalState.item.proveedorKey || '',
          providerKey: normalizeKey(modalState.item.proveedorKey || modalState.item.proveedorNombre),
          value: modalState.item.proveedorKey || normalizeKey(modalState.item.proveedorNombre),
          label: modalState.item.proveedorNombre,
          nombre: modalState.item.proveedorNombre,
          comuna: modalState.item.centroComuna || '',
          centerCodes: modalState.item.centroCodigo ? [modalState.item.centroCodigo] : [],
          centerComunas: modalState.item.centroComuna ? [modalState.item.centroComuna] : [],
        };
      }
      return null;
    }
    if (modalState.mode !== 'edit') return null;
    const normalizedQuery = normalizeKey(contactCompanyQuery);
    if (!normalizedQuery) return null;
    const matched = providerOptions.find((provider) =>
      normalizeKey(provider.label) === normalizedQuery || normalizeKey(provider.value) === normalizedQuery
    );
    if (matched) return matched;
    if (
      modalState.item?.proveedorNombre &&
      (normalizeKey(modalState.item.proveedorNombre) === normalizedQuery ||
       normalizeKey(modalState.item.proveedorKey) === normalizedQuery)
    ) {
      return {
        key: modalState.item.proveedorKey || '',
        providerKey: normalizeKey(modalState.item.proveedorKey || modalState.item.proveedorNombre),
        value: modalState.item.proveedorKey || normalizeKey(modalState.item.proveedorNombre),
        label: modalState.item.proveedorNombre,
        nombre: modalState.item.proveedorNombre,
        comuna: modalState.item.centroComuna || '',
        centerCodes: modalState.item.centroCodigo ? [modalState.item.centroCodigo] : [],
        centerComunas: modalState.item.centroComuna ? [modalState.item.centroComuna] : [],
      };
    }
    return null;
  }, [
    providerOptions,
    contactCompanyQuery,
    contactSelectedProviderKey,
    modalState.mode,
    modalState.item?.centroCodigo,
    modalState.item?.centroComuna,
    modalState.item?.proveedorKey,
    modalState.item?.proveedorNombre,
  ]);

  const filteredProviderOptions = useMemo(() => {
    const query = normalizeKey(contactCompanyQuery);
    if (!query) return providerOptions.slice(0, 10);
    return providerOptions
      .filter((provider) =>
        [
          provider.label,
          provider.value,
          ...(provider.centerCodes || []),
          ...(provider.centerComunas || []),
        ].some((value) => normalizeKey(value).includes(query))
      )
      .slice(0, 10);
  }, [providerOptions, contactCompanyQuery]);

  const associatedCenters = useMemo(() => {
    if (!selectedProvider) return [];
    const providerKey = normalizeKey(selectedProvider.key || selectedProvider.providerKey || selectedProvider.nombre);
    return (data.centros || [])
      .filter((centro) => normalizeKey(centro.proveedorKey || centro.proveedor) === providerKey)
      .map((centro) => ({
        id: centro._id || '',
        code: centro.code || '',
        comuna: centro.comuna || '',
        hectareas: centro.hectareas ?? null,
        label: [centro.code, centro.comuna].filter(Boolean).join(' - ') || centro.code || centro.comuna || 'Centro sin referencia',
      }));
  }, [data.centros, selectedProvider]);

  const openCreateModal = useCallback(() => {
    setModalState({ open: true, mode: 'create', item: null });
    setContactCompanyQuery('');
    setContactCenterValue('');
    setContactSelectedProviderKey('');
  }, []);

  const openEditModal = useCallback((item) => {
    setModalState({ open: true, mode: 'edit', item });
    setContactCompanyQuery(item?.proveedorNombre || item?.nombre || '');
    setContactCenterValue(item?.centroId || item?.centroCodigo || '');
    setContactSelectedProviderKey(item?.proveedorKey || '');
  }, []);

  const closeModal = useCallback(() => {
    setModalState({ open: false, mode: 'create', item: null });
    setContactCompanyQuery('');
    setContactCenterValue('');
    setContactSelectedProviderKey('');
  }, []);

  const openProviderCenters = useCallback((provider) => {
    const params = new URLSearchParams();
    const providerKey = provider?.key || provider?.providerKey || '';
    if (providerKey) params.set('proveedor', providerKey);
    if (provider?.nombre) params.set('q', provider.nombre);
    navigate(`/centros/directorio?${params.toString()}`);
  }, [navigate]);

  const handleDeleteProvider = async () => {
    if (!confirmDeleteProvider) return;
    try {
      if (confirmDeleteProvider.totalContactos > 0) {
        throw new Error('Esta empresa tiene contactos asociados. Elimina los contactos primero para poder borrar la empresa.');
      }
      if (confirmDeleteProvider.centros > 1) {
        throw new Error('Esta empresa tiene multiples centros asociados. No se puede eliminar directamente. Gestiona sus centros individualmente.');
      }
      if (confirmDeleteProvider.primaryCenterId) {
        await apiClient.delete(`/centros/${confirmDeleteProvider.primaryCenterId}`);
      } else {
        throw new Error('Esta empresa no tiene un centro base directo y no puede ser eliminada desde aqui. Elimina los contactos asociados primero.');
      }
      
      // Optimistic delete: ocultarlo de la UI inmediatamente
      setDeletedProviders(prev => new Set([...prev, confirmDeleteProvider.providerKey, confirmDeleteProvider.key]));
      
      await loadData();
      setConfirmDeleteProvider(null);
      addToast({
        title: 'Empresa eliminada',
        message: `${confirmDeleteProvider.nombre} fue eliminada correctamente.`,
        type: 'success',
      });
    } catch (error) {
      addToast({
        title: 'Error al eliminar',
        message: error?.data?.error || error?.message || 'No se pudo eliminar la empresa.',
        type: 'error',
      });
    }
  };

  const handleDeleteContact = async () => {
    if (!confirmDeleteContact?._id) return;
    const contactNameValue = confirmDeleteContact?.nombre || confirmDeleteContact?.contactoNombre || 'este contacto';
    try {
      await apiClient.delete(`/contactos/${confirmDeleteContact._id}`);
      // Optimistic delete: ocultarlo de la UI inmediatamente
      setDeletedContacts(prev => new Set([...prev, confirmDeleteContact._id]));
      await loadData();
      setConfirmDeleteContact(null);
      addToast({
        title: 'Contacto eliminado',
        message: `${contactNameValue} fue eliminado correctamente.`,
        type: 'success',
      });
    } catch (error) {
      addToast({
        title: 'Error',
        message: error?.data?.error || error?.message || 'No se pudo eliminar el contacto.',
        type: 'error',
      });
    }
  };

  const submitModal = async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      if (tab === 'proveedores') {
        const centroPayload = {
          code: modalState.mode === 'edit' ? (modalState.item?.primaryCenterCode || payload.proveedorKey) : payload.proveedorKey,
          proveedor: payload.nombre,
          comuna: payload.comuna || '',
        };

        if (modalState.mode === 'edit') {
          if (!modalState.item?.primaryCenterId) {
            throw new Error('No encontramos un centro base para editar este proveedor.');
          }
          await apiClient.patch(`/centros/${modalState.item.primaryCenterId}`, centroPayload);
        } else {
          await apiClient.post('/centros', centroPayload);
        }
      } else {
        const fallbackProvider = modalState.mode === 'edit' && modalState.item?.proveedorNombre
          ? {
              key: modalState.item.proveedorKey || '',
              providerKey: normalizeKey(modalState.item.proveedorKey || modalState.item.proveedorNombre),
              nombre: modalState.item.proveedorNombre,
            }
          : null;
        const resolvedProvider = selectedProvider || fallbackProvider;

        if (contactCompanyQuery && !resolvedProvider) {
          throw new Error('Selecciona una empresa valida desde las sugerencias.');
        }

        const selectedCenter = associatedCenters.find(
          (centro) => centro.id === contactCenterValue || centro.code === contactCenterValue
        ) || null;

        const contactoPayload = {
          nombre: payload.nombre,
          entidad: resolvedProvider?.nombre || 'Proveedor',
          contactoNombre: payload.nombre,
          contactoEmail: payload.email || '',
          contactoTelefono: payload.telefono || '',
          proveedorKey: resolvedProvider?.key || resolvedProvider?.providerKey || '',
          proveedorNombre: resolvedProvider?.nombre || '',
          centroId: selectedCenter?.id || '',
          centroCodigo: selectedCenter?.code || '',
          centroComuna: selectedCenter?.comuna || '',
          centroHectareas: selectedCenter?.hectareas ?? '',
        };

        if (modalState.mode === 'edit' && modalState.item?._id) {
          await apiClient.patch(`/contactos/${modalState.item._id}`, contactoPayload);
        } else {
          await apiClient.post('/contactos', contactoPayload);
        }
      }

      closeModal();
      await loadData();
      addToast({
        title: modalState.mode === 'edit' ? 'Registro actualizado' : 'Registro creado',
        message: tab === 'proveedores' ? 'Los datos del proveedor fueron guardados.' : 'Los datos del contacto fueron guardados.',
        type: 'success',
      });
    } catch (error) {
      addToast({
        title: 'Error',
        message: error?.data?.error || error?.message || 'No se pudo guardar. Intenta de nuevo.',
        type: 'error',
      });
    }
  };

  return (
    <div className="mx-page am-p-0">
      <div className="mx-toolbar am-mt-16">
        <div className="mx-toggle-group">
          <button className={`mx-toggle-btn ${tab === 'proveedores' ? 'active' : ''}`} onClick={() => setTab('proveedores')}>
            <Building2 size={14} /> Proveedores
          </button>
          <button className={`mx-toggle-btn ${tab === 'contactos' ? 'active' : ''}`} onClick={() => setTab('contactos')}>
            <User size={14} /> Contactos
          </button>
        </div>

        <div className="mx-search-box dir-toolbar-search">
          <Search size={18} />
          <input
            type="text"
            placeholder={tab === 'proveedores' ? 'Buscar proveedor, accion o comuna...' : 'Buscar contacto, empresa o correo...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button className="mx-btn mx-btn-primary" onClick={openCreateModal}>
          <Plus size={18} /> {tab === 'proveedores' ? 'Nuevo proveedor' : 'Contacto'}
        </button>
      </div>

      {tab === 'proveedores' && (
        <div className="mx-kpi-grid am-mt-16">
          {[
            { label: 'Activos', value: providerStats.activos, tone: 'success' },
            { label: 'Pausados', value: providerStats.pausados, tone: 'warning' },
            { label: 'Acordados', value: providerStats.acordados, tone: 'primary' },
            { label: 'Sin seguimiento', value: providerStats.sinSeguimiento, tone: 'muted' },
          ].map((stat) => (
            <div key={stat.label} className="mx-kpi-card">
              <p className="mx-eyebrow">{stat.label}</p>
              <h2 className={`mx-kpi-value dir-kpi-value is-${stat.tone}`}>{stat.value}</h2>
            </div>
          ))}
        </div>
      )}

      <div className="mx-table-card am-mt-16">
        <div className="mx-table-wrap">
          <table className="mx-table">
            <thead>
              {tab === 'proveedores' ? (
                <tr>
                  <th className="dir-col-provider">Proveedor</th>
                  <th className="dir-col-main-contact">Contacto principal</th>
                  <th className="dir-col-followup">Estado comercial</th>
                  <th className="dir-col-last">Última gestión</th>
                  <th className="dir-col-next">Próxima acción</th>
                  <th className="dir-col-actions">Acciones</th>
                </tr>
              ) : (
                <tr>
                  <th className="dir-col-contact">Nombre contacto</th>
                  <th className="dir-col-company">Empresa</th>
                  <th className="dir-col-channel">Correo / telefono</th>
                  <th className="dir-col-role">Cargo / rol</th>
                  <th className="dir-col-actions">Acciones</th>
                </tr>
              )}
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={tab === 'proveedores' ? 6 : 5} className="dir-table-state">
                    <div className="mx-spinner dir-spinner"></div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={tab === 'proveedores' ? 6 : 5} className="dir-table-state">
                    No se encontraron resultados.
                  </td>
                </tr>
              ) : tab === 'proveedores' ? (
                filteredItems.map((provider) => {
                  const status = STATUS_META[provider.seguimientoEstado || 'none'] || STATUS_META.none;
                  const StatusIcon = status.icon;

                  return (
                    <tr key={provider.providerKey}>
                      <td>
                        <div className="dir-provider-cell">
                          <div className="mx-btn-icon sm dir-provider-icon">
                            <Building2 size={16} />
                          </div>
                          <div>
                            <div className="dir-primary-text">{provider.nombre}</div>
                            <div className="dir-provider-meta">
                              <span className="mx-badge dir-key-badge">{provider.key || 'sin-key'}</span>
                              <span><MapPin size={10} /> {provider.comuna}</span>
                              <span>{provider.centros} centro{provider.centros === 1 ? '' : 's'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="dir-primary-text">{provider.contactoPrincipal}</div>
                        <div className="dir-contact-meta">
                          <span>{provider.totalContactos} contacto{provider.totalContactos === 1 ? '' : 's'}</span>
                          {provider.contactoTelefono ? <span><Phone size={10} />{provider.contactoTelefono}</span> : null}
                          {provider.contactoEmail ? <span><Mail size={10} />{provider.contactoEmail}</span> : null}
                        </div>
                      </td>

                      <td>
                        <span className={`mx-badge mx-badge-${provider.seguimientoEstado === 'activo' ? 'success' : provider.seguimientoEstado === 'pausado' ? 'warning' : provider.seguimientoEstado === 'acordado' ? 'primary' : 'muted'}`}>
                          <StatusIcon size={12} />
                          {status.label}
                        </span>
                        {provider.estadoComercial ? (
                          <div className="dir-muted-note">
                            {ESTADO_COMERCIAL_LABELS[provider.estadoComercial] || provider.estadoComercial}
                          </div>
                        ) : null}
                      </td>

                      <td>
                        <div className="dir-clamped-text" title={provider.ultimaInteraccionResumen}>
                          {provider.ultimaInteraccionResumen || 'Sin interacción registrada'}
                        </div>
                        <div className="dir-subtle-note">
                          {provider.ultimaInteraccionFecha ? `${formatShortDate(provider.ultimaInteraccionFecha)} - ${formatDaysAgo(provider.ultimaInteraccionFecha)}` : 'Aún sin actividad'}
                        </div>
                      </td>

                      <td>
                        <div className="dir-clamped-text" title={provider.proximaAccion}>
                          {provider.proximaAccion || 'Sin acción definida'}
                        </div>
                        <div className="dir-subtle-note">
                          {provider.fechaProximaAccion ? formatShortDate(provider.fechaProximaAccion) : 'Sin fecha programada'}
                        </div>
                      </td>

                      <td className="dir-actions-cell">
                        <div className="mx-table-actions-cell dir-actions">
                          <button
                            className="mx-action-btn dir-action-primary"
                            title="Ver resumen"
                            onClick={() => setDetailModal({ open: true, provider })}
                          >
                            <ExternalLink size={14} />
                          </button>
                          <button
                            className="mx-action-btn"
                            title="Ver historial del proveedor"
                            onClick={() => {
                              const key = provider.key || provider.providerKey;
                              navigate(`/historial?proveedor=${encodeURIComponent(key)}`);
                            }}
                          >
                            <History size={14} />
                          </button>
                          <button className="mx-action-btn edit" title="Editar" onClick={() => openEditModal(provider)}>
                            <Edit size={14} />
                          </button>
                          <button
                            className="mx-action-btn delete"
                            title="Eliminar Empresa"
                            onClick={() => setConfirmDeleteProvider(provider)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                filteredItems.map((contact, index) => (
                  <tr key={contact._id || index}>
                    <td>
                      <div className="dir-contact-name">{contact.nombre || contact.contactoNombre}</div>
                      <div className="dir-contact-id">ID: {contact._id?.slice(-6) || '-'}</div>
                    </td>
                    <td>{contact.proveedorNombre || '-'}</td>
                    <td>
                      <div className="dir-contact-channel">
                        <span><Mail size={10} /> {contact.email || contact.contactoEmail || '-'}</span>
                        <span><Phone size={10} /> {contact.telefono || contact.contactoTelefono || '-'}</span>
                      </div>
                    </td>
                    <td><span className="mx-badge mx-badge-muted">{contact.cargo || 'Contacto'}</span></td>
                    <td className="dir-actions-cell">
                      <div className="mx-table-actions-cell dir-actions">
                        <button className="mx-action-btn edit" title="Editar" onClick={() => openEditModal(contact)}>
                          <Edit size={14} />
                        </button>
                        <button
                          className="mx-action-btn delete"
                          title="Eliminar"
                          onClick={() => setConfirmDeleteContact(contact)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalState.open && (
        <div className="mx-modal-overlay">
            <div className="mx-modal dir-form-modal">
            <div className="mx-modal-header">
              <h2>
                {tab === 'proveedores'
                  ? (modalState.mode === 'edit' ? 'Editar Empresa' : 'Nueva Empresa')
                  : (modalState.mode === 'edit' ? 'Editar Contacto' : 'Nuevo Contacto')}
              </h2>
              <button type="button" className="mx-btn-icon" onClick={closeModal}><X size={20} /></button>
            </div>

            <form onSubmit={submitModal} className="mx-form">
              <div className="mx-modal-body">
                {tab === 'proveedores' ? (
                  <>
                    <div className="mx-form-group">
                      <label className="mx-label">Razón social / nombre empresa</label>
                      <input
                        name="nombre"
                        className="mx-input"
                        required
                        placeholder="Ej: Pesquera Los Lagos S.A."
                        defaultValue={modalState.item?.nombre || ''}
                      />
                    </div>
                    <div className="mx-form-group">
                      <label className="mx-label">Código interno (Key)</label>
                      <input
                        name="proveedorKey"
                        className="mx-input"
                        required
                        placeholder="Ej: LOSLAGOS"
                        defaultValue={modalState.item?.key || ''}
                        readOnly={modalState.mode === 'edit'}
                      />
                    </div>
                    <div className="mx-form-group">
                      <label className="mx-label">Comuna / ubicacion principal</label>
                      <input
                        name="comuna"
                        className="mx-input"
                        placeholder="Ej: Puerto Montt"
                        defaultValue={modalState.item?.comuna || ''}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mx-form-group">
                      <label className="mx-label">Nombre completo</label>
                      <input
                        name="nombre"
                        className="mx-input"
                        required
                        placeholder="Ej: Juan Perez"
                        defaultValue={modalState.item?.nombre || modalState.item?.contactoNombre || ''}
                      />
                    </div>
                    <div className="mx-form-group gs-contact-provider-field">
                      <label className="mx-label">Empresa asociada</label>
                      <div className="gs-contact-provider-search">
                        <Search size={18} />
                        <input
                          type="text"
                          className="gs-contact-provider-search-input"
                          placeholder="Buscar proveedor o codigo de centro..."
                          value={contactCompanyQuery}
                          onChange={(e) => {
                            setContactCompanyQuery(e.target.value);
                            setContactSelectedProviderKey('');
                            setContactCenterValue('');
                          }}
                        />
                      </div>

                      {selectedProvider ? (
                        <div className="gs-contact-provider-selected">
                          <div>
                            <strong>{selectedProvider.label}</strong>
                            <span>
                              {associatedCenters.length > 0
                                ? `${associatedCenters.length} centro${associatedCenters.length === 1 ? '' : 's'} disponible${associatedCenters.length === 1 ? '' : 's'}`
                                : 'Sin centros asociados registrados'}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="gs-contact-provider-clear"
                            onClick={() => {
                              setContactCompanyQuery('');
                              setContactSelectedProviderKey('');
                              setContactCenterValue('');
                            }}
                          >
                            Cambiar
                          </button>
                        </div>
                      ) : (
                        <div className="gs-contact-provider-results">
                        {filteredProviderOptions.length === 0 ? (
                          <div className="gs-contact-provider-empty">No encontramos empresas con ese nombre o codigo de centro.</div>
                        ) : (
                          filteredProviderOptions.map((provider) => {
                            const isSelected = normalizeKey(contactSelectedProviderKey || selectedProvider?.value) === normalizeKey(provider.value);
                            return (
                              <button
                                key={provider.value || provider.providerKey}
                                type="button"
                                className={`gs-contact-provider-option ${isSelected ? 'selected' : ''}`}
                                onClick={() => {
                                  setContactCompanyQuery(provider.label);
                                  setContactSelectedProviderKey(provider.value || provider.providerKey || '');
                                  setContactCenterValue('');
                                }}
                              >
                                <strong>{provider.label}</strong>
                                <span>
                                  {(provider.centerCodes || []).slice(0, 3).join(' - ') || 'Sin centros referenciados'}
                                  {provider.comuna ? ` - ${provider.comuna}` : ''}
                                </span>
                              </button>
                            );
                          })
                        )}
                        </div>
                      )}
                    </div>

                    <div className="mx-form-group">
                      <label className="mx-label">Centro asociado</label>
                      {!selectedProvider ? (
                        <div className="gs-contact-provider-empty">Selecciona primero la empresa para cargar sus centros.</div>
                      ) : associatedCenters.length === 0 ? (
                        <div className="gs-contact-provider-empty">Esta empresa no tiene centros registrados.</div>
                      ) : (
                        <select
                          className="mx-select"
                          value={contactCenterValue}
                          onChange={(e) => setContactCenterValue(e.target.value)}
                        >
                          <option value="">-- Sin centro especifico --</option>
                          {associatedCenters.map((centro) => (
                            <option key={centro.id} value={centro.id || centro.code}>
                              {centro.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="mx-form-row dir-form-row">
                      <div className="mx-form-group dir-form-row-item">
                        <label className="mx-label">Correo electronico</label>
                        <input
                          name="email"
                          type="email"
                          className="mx-input"
                          placeholder="ejemplo@correo.com"
                          defaultValue={modalState.item?.email || modalState.item?.contactoEmail || ''}
                        />
                      </div>
                      <div className="mx-form-group dir-form-row-item">
                        <label className="mx-label">Telefono</label>
                        <input
                          name="telefono"
                          className="mx-input"
                          placeholder="+56 9..."
                          defaultValue={modalState.item?.telefono || modalState.item?.contactoTelefono || ''}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="mx-modal-footer">
                <button type="button" className="mx-btn mx-btn-outline" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary">
                  {modalState.mode === 'edit'
                    ? 'Guardar cambios'
                    : `Guardar ${tab === 'proveedores' ? 'Empresa' : 'Contacto'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
       )}

      {/* Modal de Detalle Moderno */}
      {detailModal.open && detailModal.provider && (
        <div className="mx-modal-overlay dir-detail-overlay">
          <div className="mx-modal dir-detail-modal">
            <div className="mx-modal-header dir-detail-header">
              <div className="dir-detail-title-wrap">
                <div className="dir-detail-icon">
                  <Building2 size={24} />
                </div>
                <div>
                  <h2 className="dir-detail-title">{detailModal.provider.nombre}</h2>
                  <div className="dir-detail-subtitle">{detailModal.provider.comuna} - {detailModal.provider.centros} centros</div>
                </div>
              </div>
              <button type="button" className="mx-btn-icon" onClick={() => setDetailModal({ open: false, provider: null })}><X size={20} /></button>
            </div>

            <div className="mx-modal-body dir-detail-body">
              <div className="dir-detail-summary-grid">
                <div className="dir-detail-summary-card">
                  <div className="mx-eyebrow dir-detail-eyebrow">Estado Comercial</div>
                  <div className="dir-detail-strong">{detailModal.provider.seguimientoEstado?.toUpperCase() || 'SIN SEGUIMIENTO'}</div>
                  {detailModal.provider.estadoComercial && <div className="dir-detail-muted">{ESTADO_COMERCIAL_LABELS[detailModal.provider.estadoComercial] || detailModal.provider.estadoComercial}</div>}
                </div>
                <div className="dir-detail-summary-card">
                  <div className="mx-eyebrow dir-detail-eyebrow">Contacto Principal</div>
                  <div className="dir-detail-strong">{detailModal.provider.contactoPrincipal}</div>
                  <div className="dir-detail-muted">{detailModal.provider.contactoTelefono || 'Sin telefono'}</div>
                </div>
              </div>

              <div className="dir-detail-activity">
                <h3 className="dir-detail-section-title">
                  <Clock3 size={16} /> Última Actividad Registrada
                </h3>
                
                <div className="dir-detail-timeline">
                  <div className="dir-detail-timeline-dot is-primary"></div>
                  <div className="dir-detail-date">{detailModal.provider.ultimaInteraccionFecha ? formatShortDate(detailModal.provider.ultimaInteraccionFecha) : 'Sin fecha'}</div>
                  <div className="dir-detail-note-card">
                    <p>
                      {detailModal.provider.ultimaInteraccionResumen || 'No hay notas registradas para este proveedor.'}
                    </p>
                  </div>
                </div>

                {detailModal.provider.proximaAccion && (
                  <div className="dir-detail-timeline dir-detail-timeline-next">
                    <div className="dir-detail-timeline-dot is-muted"></div>
                    <div className="mx-eyebrow dir-detail-next-label">Próxima Acción Programada</div>
                    <div className="dir-detail-next-text">{detailModal.provider.proximaAccion}</div>
                    <div className="dir-detail-next-date">{formatShortDate(detailModal.provider.fechaProximaAccion)}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="mx-modal-footer dir-detail-footer">
              {(detailModal.provider.key || detailModal.provider.providerKey) && (
                <button
                  type="button"
                  className="mx-btn mx-btn-outline dir-detail-footer-btn"
                  onClick={() => {
                    const key = detailModal.provider.key || detailModal.provider.providerKey;
                    setDetailModal({ open: false, provider: null });
                    navigate(`/historial?proveedor=${encodeURIComponent(key)}`);
                  }}
                >
                  <History size={16} /> Ver historial
                </button>
              )}
              <button type="button" className="mx-btn mx-btn-outline dir-detail-footer-btn" onClick={() => openProviderCenters(detailModal.provider)}>
                <ExternalLink size={16} /> Ver Centros
              </button>
              <button type="button" className="mx-btn mx-btn-primary dir-detail-footer-btn" onClick={() => { setDetailModal({ open: false, provider: null }); openEditModal(detailModal.provider); }}>
                <Edit size={16} /> Editar Proveedor
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(confirmDeleteContact)}
        onClose={() => setConfirmDeleteContact(null)}
        onConfirm={handleDeleteContact}
        itemName={confirmDeleteContact?.nombre || confirmDeleteContact?.contactoNombre || 'este contacto'}
        description={
          confirmDeleteContact && ['con biomasa', 'con', 'con_biomasa'].includes(String(confirmDeleteContact.biomasa || '').trim().toLowerCase())
            ? `Estas a punto de borrar a "${confirmDeleteContact?.nombre || confirmDeleteContact?.contactoNombre || 'este contacto'}". ATENCION: Este contacto tiene registrado "Con Biomasa". Al eliminarlo, tambien se borrara su registro de seguimiento automatico. Esta accion es irreversible.`
            : undefined
        }
      />

      <ConfirmDeleteModal
        isOpen={Boolean(confirmDeleteProvider)}
        onClose={() => setConfirmDeleteProvider(null)}
        onConfirm={handleDeleteProvider}
        itemName={`la empresa ${confirmDeleteProvider?.nombre || 'seleccionada'}`}
      />

     </div>
   );
 }


