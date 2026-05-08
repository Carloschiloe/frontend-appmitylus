import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2,
  User,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Edit,
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
  useInteracciones 
} from '../hooks/useGestionQueries';
import ConfirmDeleteModal from '../../../components/ConfirmDeleteModal';
import './directorio.css';

const STATUS_META = {
  activo: { label: 'Activo', tone: '#0f766e', bg: 'rgba(13, 148, 136, 0.12)', icon: Clock3 },
  pausado: { label: 'Pausado', tone: '#d97706', bg: 'rgba(217, 119, 6, 0.12)', icon: PauseCircle },
  cerrado: { label: 'Cerrado', tone: '#dc2626', bg: 'rgba(220, 38, 38, 0.10)', icon: CircleOff },
  acordado: { label: 'Acordado', tone: '#0891b2', bg: 'rgba(8, 145, 178, 0.12)', icon: CheckCircle2 },
  none: { label: 'Sin seguimiento', tone: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', icon: Clock3 },
};

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function formatShortDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
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

function buildProviderRows(centros = [], contactos = [], oportunidades = [], interacciones = []) {
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
        comuna: centro.comuna || '—',
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
    if ((!item.comuna || item.comuna === '—') && centro.comuna) item.comuna = centro.comuna;
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
        comuna: '—',
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

  providers.forEach((provider, key) => {
    const providerContacts = contactsByProvider.get(key) || [];
    const firstContact = providerContacts[0] || null;
    const latestOpportunity = latestOpportunityByProvider.get(key) || null;
    const latestInteraction = latestInteractionByProvider.get(key) || null;

    provider.totalContactos = providerContacts.length;
    provider.contactoPrincipal = contactName(firstContact) || 'Primer contacto pendiente';
    provider.contactoTelefono = contactPhone(firstContact);
    provider.contactoEmail = contactEmail(firstContact);
    provider.seguimientoEstado = latestOpportunity?.seguimientoEstado || '';
    provider.estadoComercial = latestOpportunity?.estado || '';
    provider.proximaAccion = latestOpportunity?.proximaAccion || '';
    provider.fechaProximaAccion = latestOpportunity?.fechaProximaAccion || latestOpportunity?.fechaRevision || '';
    provider.ultimaInteraccionResumen = latestInteraction?.resumen || '';
    provider.ultimaInteraccionFecha = latestInteraction?.fecha || '';
    provider.ultimoResponsable = latestInteraction?.responsablePG || latestInteraction?.responsable || '';
  });

  return Array.from(providers.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
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
  const [contactCompanyQuery, setContactCompanyQuery] = useState('');
  const [contactCenterValue, setContactCenterValue] = useState('');
  const [contactSelectedProviderKey, setContactSelectedProviderKey] = useState('');

  // 1. Carga de datos con React Query
  const { data: centrosRaw, isLoading: loadingCentros, refetch: refetchCentros } = useCentros();
  const { data: contactosRaw, isLoading: loadingContactos, refetch: refetchContactos } = useContactos({ conEmpresa: 1 });
  const { data: oportunidadesRaw, isLoading: loadingOpp, refetch: refetchOpp } = useOportunidades();
  const { data: interaccionesRaw, isLoading: loadingInt, refetch: refetchInt } = useInteracciones({ limit: 500 });

  const loading = loadingCentros || loadingContactos || loadingOpp || loadingInt;

  const loadData = useCallback(async () => {
    await Promise.all([
      refetchCentros(),
      refetchContactos(),
      refetchOpp(),
      refetchInt(),
    ]);
  }, [refetchCentros, refetchContactos, refetchOpp, refetchInt]);

  // 2. Procesamiento de datos
  const data = useMemo(() => {
    const centros = Array.isArray(centrosRaw) ? centrosRaw : (centrosRaw?.items || []);
    const contactos = Array.isArray(contactosRaw) ? contactosRaw : (contactosRaw?.items || []);
    const oportunidades = Array.isArray(oportunidadesRaw) ? oportunidadesRaw : (oportunidadesRaw?.items || []);
    const interacciones = Array.isArray(interaccionesRaw) ? interaccionesRaw : (interaccionesRaw?.items || []);

    return {
      proveedores: buildProviderRows(centros, contactos, oportunidades, interacciones),
      contactos,
      centros,
    };
  }, [centrosRaw, contactosRaw, oportunidadesRaw, interaccionesRaw]);

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

  const providerOptions = useMemo(
    () => (data.proveedores || []).map((provider) => {
      const providerKey = provider.key || provider.providerKey;
      const centers = (data.centros || []).filter(
        (centro) => normalizeKey(centro.proveedorKey || centro.proveedor) === normalizeKey(providerKey || provider.nombre)
      );
      return {
        ...provider,
        value: providerKey,
        label: provider.nombre,
        centerCodes: centers.map((centro) => centro.code).filter(Boolean),
        centerComunas: centers.map((centro) => centro.comuna).filter(Boolean),
      };
    }),
    [data.proveedores, data.centros]
  );

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
    if (!query) return providerOptions.slice(0, 5);
    return providerOptions
      .filter((provider) =>
        [
          provider.label,
          provider.value,
          ...(provider.centerCodes || []),
          ...(provider.centerComunas || []),
        ].some((value) => normalizeKey(value).includes(query))
      )
      .slice(0, 5);
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
        label: [centro.code, centro.comuna].filter(Boolean).join(' · ') || centro.code || centro.comuna || 'Centro sin referencia',
      }));
  }, [data.centros, selectedProvider]);

  const selectedCenter = useMemo(
    () => associatedCenters.find((centro) => centro.id === contactCenterValue || centro.code === contactCenterValue) || null,
    [associatedCenters, contactCenterValue]
  );

  const openCreateModal = () => {
    setModalState({ open: true, mode: 'create', item: null });
    setContactCompanyQuery('');
    setContactCenterValue('');
    setContactSelectedProviderKey('');
  };

  const openEditModal = (item) => {
    setModalState({ open: true, mode: 'edit', item });
    setContactCompanyQuery(item?.proveedorNombre || item?.nombre || '');
    setContactCenterValue(item?.centroId || item?.centroCodigo || '');
    setContactSelectedProviderKey(item?.proveedorKey || '');
  };

  const closeModal = () => {
    setModalState({ open: false, mode: 'create', item: null });
    setContactCompanyQuery('');
    setContactCenterValue('');
    setContactSelectedProviderKey('');
  };

  const openProviderCenters = (provider) => {
    const params = new URLSearchParams();
    const providerKey = provider?.key || provider?.providerKey || '';
    if (providerKey) {
      params.set('proveedor', providerKey);
    }
    if (provider?.nombre) {
      params.set('q', provider.nombre);
    }
    navigate(`/centros/directorio?${params.toString()}`);
  };

  const handleDeleteContact = async () => {
    if (!confirmDeleteContact?._id) return;
    const contactNameValue = confirmDeleteContact?.nombre || confirmDeleteContact?.contactoNombre || 'este contacto';
    try {
      await apiClient.delete(`/contactos/${confirmDeleteContact._id}`);
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
    <div className="directorio-container">
      <div className="centros-filters am-mt-16">
        <div className="mx-toggle-group">
          <button className={`mx-toggle-btn ${tab === 'proveedores' ? 'active' : ''}`} onClick={() => setTab('proveedores')}>
            <Building2 size={14} /> Proveedores
          </button>
          <button className={`mx-toggle-btn ${tab === 'contactos' ? 'active' : ''}`} onClick={() => setTab('contactos')}>
            <User size={14} /> Contactos
          </button>
        </div>

        <div className="gs-directory-search" style={{ flex: 1 }}>
          <Search size={18} />
          <input
            type="text"
            placeholder={tab === 'proveedores' ? 'Buscar proveedor, accion o comuna...' : 'Buscar contacto, empresa o correo...'}
            className="gs-directory-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button className="mx-btn mx-btn-primary sm" onClick={openCreateModal}>
          <Plus size={18} /> {tab === 'proveedores' ? 'Empresa' : 'Contacto'}
        </button>
      </div>

      {tab === 'proveedores' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
          {[
            { label: 'Activos', value: providerStats.activos, tone: '#0f766e', bg: 'rgba(13, 148, 136, 0.10)' },
            { label: 'Pausados', value: providerStats.pausados, tone: '#d97706', bg: 'rgba(217, 119, 6, 0.10)' },
            { label: 'Acordados', value: providerStats.acordados, tone: '#0891b2', bg: 'rgba(8, 145, 178, 0.10)' },
            { label: 'Sin seguimiento', value: providerStats.sinSeguimiento, tone: '#64748b', bg: 'rgba(100, 116, 139, 0.10)' },
          ].map((stat) => (
            <div key={stat.label} className="mx-table-card" style={{ padding: 16, background: stat.bg, borderColor: 'rgba(15, 23, 42, 0.06)' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: stat.tone, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {stat.label}
              </div>
              <div style={{ marginTop: 8, fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-text)' }}>
                {stat.value}
              </div>
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
                  <th>Proveedor</th>
                  <th>Contacto principal</th>
                  <th>Seguimiento</th>
                  <th>Ultima interaccion</th>
                  <th>Proxima accion</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              ) : (
                <tr>
                  <th>Nombre contacto</th>
                  <th>Empresa</th>
                  <th>Correo / telefono</th>
                  <th>Cargo / rol</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              )}
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={tab === 'proveedores' ? 6 : 5} style={{ textAlign: 'center', padding: '60px' }}>
                    <div className="mx-spinner" style={{ margin: '0 auto' }}></div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={tab === 'proveedores' ? 6 : 5} style={{ textAlign: 'center', padding: '60px' }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              background: 'rgba(8, 145, 178, 0.10)',
                              color: '#0f766e',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Building2 size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700 }}>{provider.nombre}</div>
                            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-subtle)', fontSize: '0.82rem' }}>
                              <code style={{ fontSize: '11px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{provider.key || 'sin-key'}</code>
                              <span><MapPin size={12} style={{ marginRight: 4 }} />{provider.comuna}</span>
                              <span>{provider.centros} centro{provider.centros === 1 ? '' : 's'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600 }}>{provider.contactoPrincipal}</div>
                        <div style={{ marginTop: 4, display: 'grid', gap: 2, color: 'var(--color-text-subtle)', fontSize: '0.82rem' }}>
                          <span>{provider.totalContactos} contacto{provider.totalContactos === 1 ? '' : 's'} en directorio</span>
                          {provider.contactoTelefono ? <span><Phone size={12} style={{ marginRight: 4 }} />{provider.contactoTelefono}</span> : null}
                          {provider.contactoEmail ? <span><Mail size={12} style={{ marginRight: 4 }} />{provider.contactoEmail}</span> : null}
                        </div>
                      </td>

                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 12px',
                            borderRadius: 999,
                            fontSize: '0.82rem',
                            fontWeight: 800,
                            color: status.tone,
                            background: status.bg,
                          }}
                        >
                          <StatusIcon size={14} />
                          {status.label}
                        </span>
                        {provider.estadoComercial ? (
                          <div style={{ marginTop: 8, color: 'var(--color-text-subtle)', fontSize: '0.82rem' }}>
                            Estado comercial: {provider.estadoComercial}
                          </div>
                        ) : null}
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                          {provider.ultimaInteraccionResumen || 'Sin interaccion registrada'}
                        </div>
                        <div style={{ marginTop: 4, color: 'var(--color-text-subtle)', fontSize: '0.82rem' }}>
                          {provider.ultimaInteraccionFecha ? `${formatShortDate(provider.ultimaInteraccionFecha)} · ${formatDaysAgo(provider.ultimaInteraccionFecha)}` : 'Aún sin actividad'}
                        </div>
                        {provider.ultimoResponsable ? (
                          <div style={{ marginTop: 4, color: 'var(--color-text-subtle)', fontSize: '0.82rem' }}>
                            Responsable: {provider.ultimoResponsable}
                          </div>
                        ) : null}
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                          {provider.proximaAccion || 'Sin accion definida'}
                        </div>
                        <div style={{ marginTop: 4, color: 'var(--color-text-subtle)', fontSize: '0.82rem' }}>
                          {provider.fechaProximaAccion ? formatShortDate(provider.fechaProximaAccion) : 'Sin fecha programada'}
                        </div>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="mx-table-actions-cell" style={{ display: 'inline-flex' }}>
                          <button className="mx-action-btn edit" title="Editar" onClick={() => openEditModal(provider)}>
                            <Edit size={14} />
                          </button>
                          <button className="mx-action-btn" title="Ver centros" onClick={() => openProviderCenters(provider)}>
                            <ExternalLink size={14} />
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
                      <div style={{ fontWeight: 600 }}>{contact.nombre || contact.contactoNombre}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-subtle)' }}>ID: {contact._id?.slice(-6) || '—'}</div>
                    </td>
                    <td>{contact.proveedorNombre || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: '12px' }}><Mail size={10} /> {contact.email || contact.contactoEmail || '—'}</span>
                        <span style={{ fontSize: '12px' }}><Phone size={10} /> {contact.telefono || contact.contactoTelefono || '—'}</span>
                      </div>
                    </td>
                    <td><span className="mx-badge mx-badge-muted">{contact.cargo || 'Contacto'}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="mx-table-actions-cell" style={{ display: 'inline-flex' }}>
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
            <div className="mx-modal" style={{ maxWidth: '500px' }}>
            <div className="mx-modal-head">
              <h3 className="mx-modal-title">
                {tab === 'proveedores'
                  ? (modalState.mode === 'edit' ? 'Editar Empresa' : 'Nueva Empresa')
                  : (modalState.mode === 'edit' ? 'Editar Contacto' : 'Nuevo Contacto')}
              </h3>
              <button className="mx-btn-icon" onClick={closeModal}><X size={20} /></button>
            </div>

            <form onSubmit={submitModal}>
              <div className="mx-modal-body" style={{ maxHeight: '66vh', overflowY: 'auto' }}>
                {tab === 'proveedores' ? (
                  <>
                    <div className="mx-field">
                      <label className="mx-label">Razon social / nombre empresa</label>
                      <input
                        name="nombre"
                        className="mx-input"
                        required
                        placeholder="Ej: Pesquera Los Lagos S.A."
                        defaultValue={modalState.item?.nombre || ''}
                      />
                    </div>
                    <div className="mx-field">
                      <label className="mx-label">Codigo interno (Key)</label>
                      <input
                        name="proveedorKey"
                        className="mx-input"
                        required
                        placeholder="Ej: LOSLAGOS"
                        defaultValue={modalState.item?.key || ''}
                        readOnly={modalState.mode === 'edit'}
                      />
                    </div>
                    <div className="mx-field">
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
                    <div className="mx-field">
                      <label className="mx-label">Nombre completo</label>
                      <input
                        name="nombre"
                        className="mx-input"
                        required
                        placeholder="Ej: Juan Perez"
                        defaultValue={modalState.item?.nombre || modalState.item?.contactoNombre || ''}
                      />
                    </div>
                    <div className="mx-field gs-contact-provider-field">
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
                                  {(provider.centerCodes || []).slice(0, 3).join(' · ') || 'Sin centros referenciados'}
                                  {provider.comuna ? ` · ${provider.comuna}` : ''}
                                </span>
                              </button>
                            );
                          })
                        )}
                        </div>
                      )}
                    </div>

                    <div className="mx-field">
                      <label className="mx-label">Centro asociado</label>
                      {!selectedProvider ? (
                        <div className="gs-contact-provider-empty">Selecciona primero la empresa para cargar sus centros.</div>
                      ) : associatedCenters.length === 0 ? (
                        <div className="gs-contact-provider-empty">Esta empresa no tiene centros registrados.</div>
                      ) : (
                        <select
                          className="mx-input"
                          value={contactCenterValue}
                          onChange={(e) => setContactCenterValue(e.target.value)}
                        >
                          <option value="">-- Sin centro específico --</option>
                          {associatedCenters.map((centro) => (
                            <option key={centro.id} value={centro.id || centro.code}>
                              {centro.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="mx-field-row" style={{ display: 'flex', gap: '16px' }}>
                      <div className="mx-field" style={{ flex: 1 }}>
                        <label className="mx-label">Correo electrónico</label>
                        <input
                          name="email"
                          type="email"
                          className="mx-input"
                          placeholder="ejemplo@correo.com"
                          defaultValue={modalState.item?.email || modalState.item?.contactoEmail || ''}
                        />
                      </div>
                      <div className="mx-field" style={{ flex: 1 }}>
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

              <div className="mx-modal-foot" style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid #e2e8f0' }}>
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

       <ConfirmDeleteModal
         isOpen={Boolean(confirmDeleteContact)}
         onClose={() => setConfirmDeleteContact(null)}
         onConfirm={handleDeleteContact}
         itemName={confirmDeleteContact?.nombre || confirmDeleteContact?.contactoNombre || 'este contacto'}
       />

     </div>
   );
 }
