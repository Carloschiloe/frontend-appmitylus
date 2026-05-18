import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, Plus, Edit, Trash2, X, RotateCcw, Send, CheckCircle2, Copy
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { apiClient } from '../../../api/apiClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useContactos, useCentros, useTratos } from '../hooks/useGestionQueries';
import { maestrosApi } from '../../../api/api-maestros';
import ConfirmDeleteModal from '../../../components/ConfirmDeleteModal';
import './tratos.css';

const ESTADOS_TRATO = [
  { val: 'pendiente',     label: 'Pendiente' },
  { val: 'acordado',      label: 'Acordado' },
  { val: 'rechazado',     label: 'Rechazado' },
  { val: 'cerrado_ok',    label: 'Cerrado OK' }
];

const UI_TO_API_ESTADO = {
  pendiente: 'negociando',
  acordado: 'acordado',
  rechazado: 'caido',
  cerrado_ok: 'compra_efectuada',
};

const API_TO_UI_ESTADO = {
  prospecto: 'pendiente',
  negociando: 'pendiente',
  semi_acordado: 'pendiente',
  acordado: 'acordado',
  compra_efectuada: 'cerrado_ok',
  cerrado: 'cerrado_ok',
  caido: 'rechazado',
  perdido: 'rechazado',
  descartado: 'rechazado',
};

function toList(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || payload?.data || [];
}

function getUiEstadoFromApi(estado) {
  return API_TO_UI_ESTADO[String(estado || '').toLowerCase()] || 'pendiente';
}

function getApiEstadoFromUi(estado) {
  return UI_TO_API_ESTADO[String(estado || '').toLowerCase()] || 'negociando';
}

function parseNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return '-';
  return number.toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return '-';
  return `$${number.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`;
}

function createEmptyForm(condiciones = []) {
  return {
    proveedorNombre: '',
    tonsAcordadas: '',
    precioBase: '',
    fechaInicioCosecha: '',
    estado: 'pendiente',
    notas: '',
    condiciones,
  };
}

function buildInitialConditions(maestros = []) {
  return maestros.map((m) => ({
    condicionId: m._id,
    nombre: m.nombre,
    tipoValor: m.tipoValor,
    estado: 'pendiente',
    valor: null,
  }));
}

function buildProviderDirectory(centros = [], contactos = []) {
  const firstContactByKey = new Map();
  contactos.forEach((item) => {
    const key = String(item.proveedorKey || item.proveedorNombre || '').trim().toLowerCase();
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
        contactoTelefono: linkedContact?.contactoTelefono || '',
        contactoEmail: linkedContact?.contactoEmail || '',
        comuna: centro.comuna || '',
        centros: 1,
      });
      return;
    }

    existing.centros += 1;
    if (!existing.contactoId && linkedContact?._id) existing.contactoId = linkedContact._id;
    if (!existing.contactoNombre && linkedContact?.contactoNombre) existing.contactoNombre = linkedContact.contactoNombre;
    if (!existing.contactoTelefono && linkedContact?.contactoTelefono) existing.contactoTelefono = linkedContact.contactoTelefono;
    if (!existing.contactoEmail && linkedContact?.contactoEmail) existing.contactoEmail = linkedContact.contactoEmail;
    if (!existing.comuna && centro.comuna) existing.comuna = centro.comuna;
  });

  contactos.forEach((contacto, index) => {
    const proveedorNombre = String(contacto.proveedorNombre || '').trim() || 'Proveedor sin nombre';
    const proveedorKey = String(contacto.proveedorKey || proveedorNombre).trim().toLowerCase();
    if (!proveedorKey || providers.has(proveedorKey)) return;

    providers.set(proveedorKey, {
      id: `contact-${contacto._id || proveedorKey || index}`,
      contactoId: contacto._id || '',
      proveedorKey,
      proveedorNombre,
      contactoNombre: contacto.contactoNombre || '',
      contactoTelefono: contacto.contactoTelefono || '',
      contactoEmail: contacto.contactoEmail || '',
      comuna: contacto.centroComuna || contacto.comuna || '',
      centros: 0,
    });
  });

  return Array.from(providers.values()).sort((a, b) => a.proveedorNombre.localeCompare(b.proveedorNombre));
}

function getDateOnlyParts(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      };
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function formatDateOnlySafe(value) {
  const parts = getDateOnlyParts(value);
  if (!parts) return '—';
  const day = String(parts.day).padStart(2, '0');
  const month = String(parts.month).padStart(2, '0');
  return `${day}-${month}-${parts.year}`;
}

function normalizeDateOnlyForUiSafe(value) {
  const parts = getDateOnlyParts(value);
  if (!parts) return value;
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}T12:00:00.000Z`;
}

function deriveCamionesXDia(condiciones = []) {
  const match = (condiciones || []).find((item) => /camiones?\s*dia/.test(normalizeText(item?.nombre)));
  return parseNumberOrNull(match?.valor);
}

function derivePrecioDesdeCondiciones(condiciones = []) {
  const match = (condiciones || []).find((item) => /precio/.test(normalizeText(item?.nombre)));
  return parseNumberOrNull(match?.valor);
}

function deriveVolumenDesdeCondiciones(condiciones = []) {
  const match = (condiciones || []).find((item) => /volumen|total/.test(normalizeText(item?.nombre)));
  return parseNumberOrNull(match?.valor);
}

function derivePlazoDesdeCondiciones(condiciones = []) {
  const match = (condiciones || []).find((item) => /plazo|pago/.test(normalizeText(item?.nombre)));
  return match?.valor || '';
}

function isEquivalentEstado(actualApi, nextUi) {
  const current = String(actualApi || '').toLowerCase();
  if (nextUi === 'cerrado_ok') return ['compra_efectuada', 'cerrado'].includes(current);
  if (nextUi === 'acordado') return current === 'acordado';
  if (nextUi === 'rechazado') return ['caido', 'perdido', 'descartado'].includes(current);
  if (nextUi === 'pendiente') return ['prospecto', 'negociando', 'semi_acordado'].includes(current);
  return false;
}

function buildTratoShareMessage(item, url) {
  const proveedor = item?.proveedorNombre || 'Proveedor';
  const tons = item?.tonsAcordadas || deriveVolumenDesdeCondiciones(item?.condiciones) || 0;
  const precio = item?.precioAcordado ?? derivePrecioDesdeCondiciones(item?.condiciones);
  const camiones = item?.camionesXDia || deriveCamionesXDia(item?.condiciones);
  const inicio = item?.vigenciaDesde || item?.fechaCierre;
  const centro = item?.centroCodigo || item?.centroNombre || item?.meta?.centroNombre || '';
  const estado = ESTADOS_TRATO.find(e => e.val === getUiEstadoFromApi(item?.estado))?.label || item?.estado || 'Trato';

  return [
    '*Mitynex | Confirmacion publica de trato*',
    `Proveedor: ${proveedor}`,
    centro ? `Centro: ${centro}` : null,
    tons ? `Volumen acordado: ${formatInteger(tons)} t` : null,
    precio ? `Precio: ${formatMoney(precio)} / kg` : null,
    camiones ? `Carga: ${formatInteger(camiones)} cam/dia` : null,
    inicio ? `Inicio probable cosecha: ${formatDateOnlySafe(inicio)}` : null,
    `Estado: ${estado}`,
    '',
    `Ver confirmacion:`,
    url,
  ].filter((line) => line !== null).join('\n');
}

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
        addToast({ title: 'Actualizado', message: 'Trato actualizado con éxito', type: 'success' });
      } else {
        if (!selectedProvider?.proveedorKey || !selectedProvider?.proveedorNombre) {
          addToast({ title: 'Falta proveedor', message: 'Selecciona un proveedor del listado antes de guardar.', type: 'warning' });
          return;
        }

        if (!selectedProvider.contactoId) {
          addToast({
            title: 'Proveedor sin contacto',
            message: 'Este proveedor no tiene un contacto asociado. Crea o asocia un contacto antes de registrar el trato.',
            type: 'warning',
          });
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
    addToast({ title: 'Copiado', message: 'Mensaje copiado al portapapeles', type: 'success' });
  };

  const filteredItems = items.filter(i => 
    (i.proveedorNombre || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mx-page am-p-0">
      <div className="mx-toolbar am-mt-16">
        <div className="mx-search-box" style={{ flex: 1 }}>
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
          <Plus size={18} /> Nueva Negociación
        </button>
      </div>

      <div className="mx-table-card am-mt-16">
        <div className="mx-table-wrap">
          <table className="mx-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Proveedor</th>
                <th style={{ textAlign: 'center', width: '100px' }}>Tons</th>
                <th style={{ textAlign: 'center', width: '120px' }}>Precio Est.</th>
                <th>Inicio Cosecha</th>
                <th style={{ width: '140px' }}>Estado</th>
                <th style={{ textAlign: 'right', width: '100px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6">
                    <div className="mx-state-placeholder">
                      <div className="mx-spinner"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="mx-state-placeholder">No hay negociaciones activas.</div>
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const uiEstado = getUiEstadoFromApi(item.estado);
                  const displayPrecio = item.precioAcordado ?? derivePrecioDesdeCondiciones(item.condiciones) ?? 0;
                  const displayTons = item.tonsAcordadas || deriveVolumenDesdeCondiciones(item.condiciones) || 0;
                  const displayPlazo = derivePlazoDesdeCondiciones(item.condiciones);
                  const displayCamiones = item.camionesXDia || deriveCamionesXDia(item.condiciones);
                  const displayInicioCosecha = item.vigenciaDesde || item.fechaCierre;

                  return (
                    <tr key={item._id} className="tratos-row">
                      <td>
                        <div className="tratos-provider-name">{item.proveedorNombre}</div>
                        <div className="tratos-chip-row">
                          <span className="tratos-chip">Precio {formatMoney(displayPrecio)}</span>
                          {displayPlazo && (
                            <span className="tratos-chip">Pago {formatInteger(displayPlazo)} dias</span>
                          )}
                          {displayCamiones && (
                            <span className="tratos-chip">Carga {formatInteger(displayCamiones)} cam/dia</span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="tratos-metric-primary">{formatInteger(displayTons)} t</div>
                        <div className="tratos-metric-label">Volumen</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="tratos-metric-strong">{formatMoney(displayPrecio)}</div>
                        <div className="tratos-metric-label">x kg</div>
                      </td>
                      <td style={{ color: 'var(--color-text-subtle)', fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: 600 }}>{formatDateOnlySafe(displayInicioCosecha)}</div>
                        <div style={{ fontSize: '10px' }}>Probable</div>
                      </td>
                      <td>
                        <span className={`mx-badge mx-badge-${uiEstado === 'acordado' || uiEstado === 'cerrado_ok' ? 'success' : uiEstado === 'rechazado' ? 'danger' : 'info'}`}>
                          {ESTADOS_TRATO.find(e => e.val === uiEstado)?.label || item.estado}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="mx-table-actions-cell tratos-actions">
                           <button 
                             className="mx-action-btn" 
                             style={{ color: 'var(--color-primary)' }} 
                             title="Compartir Trato" 
                             onClick={() => compartirTrato(item)}
                           >
                             <Send size={14} />
                           </button>
                           <button className="mx-action-btn edit" title="Editar Negociación" onClick={() => openEdit(item)}><Edit size={14} /></button>
                           <button className="mx-action-btn delete" title="Eliminar" onClick={() => setConfirmDeleteTrato(item)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '600px' }}>
            <div className="mx-modal-header">
              <h2>{editingId ? 'Editar Trato' : 'Nuevo Trato'}</h2>
              <button type="button" className="mx-btn-icon" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="mx-form">
              <div className="mx-modal-body">
                <div className="mx-form-group">
                  <label className="mx-label">Proveedor</label>
                  {editingId ? (
                    <div className="tratos-provider-readonly">
                      <strong>{form.proveedorNombre || 'Proveedor sin nombre'}</strong>
                      <span>
                        {selectedProvider?.contactoNombre || 'Proveedor ya asociado'}
                        {selectedProvider?.comuna ? ` - ${selectedProvider.comuna}` : ''}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="tratos-provider-search">
                        <Search size={18} className="tratos-search-icon" />
                        <input
                          type="text"
                          placeholder="Buscar empresa, comuna o contacto..."
                          value={providerSearch}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            setProviderSearch(nextValue);
                            setForm({ ...form, proveedorNombre: nextValue });
                            if (selectedProvider && nextValue.trim() !== (selectedProvider.proveedorNombre || '').trim()) {
                              setSelectedProvider(null);
                            }
                          }}
                        />
                      </div>
                      <div className="tratos-provider-results">
                        {loadingProviders ? (
                          <div className="gs-empty-inline">Cargando proveedores...</div>
                        ) : filteredProviders.length === 0 ? (
                          <div className="gs-empty-inline">No encontramos coincidencias en el directorio.</div>
                        ) : (
                          filteredProviders.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className={`tratos-provider-option ${selectedProvider?.id === item.id ? 'is-selected' : ''}`}
                              onClick={() => handleSelectProvider(item)}
                            >
                              <strong>{item.proveedorNombre || 'Proveedor'}</strong>
                              <span>
                                {item.contactoNombre || 'Primer contacto'}
                                {item.contactoTelefono ? ` - ${item.contactoTelefono}` : ''}
                                {item.comuna ? ` - ${item.comuna}` : ''}
                                {item.centros ? ` - ${item.centros} centro${item.centros > 1 ? 's' : ''}` : ''}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="mx-form-group">
                  <label className="mx-label">Tons Acordadas</label>
                  <input type="number" step="1" className="mx-input" value={form.tonsAcordadas} onChange={e => setForm({...form, tonsAcordadas: e.target.value})} />
                </div>
                
                <div className="am-mt-16">
                  <label className="mx-label am-mb-8" style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                    Condiciones de Negociación (Maestros)
                  </label>
                  <div className="mx-conditions-checklist" style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                    {form.condiciones.length === 0 ? (
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '10px' }}>No hay condiciones configuradas en maestros.</p>
                    ) : (
                      form.condiciones.map((c, idx) => (
                        <div key={idx} className="tratos-condition-row">
                          <span className="tratos-condition-name">{c.nombre}</span>
                          
                          {c.tipoValor === 'porcentaje' && (
                            <select 
                              className="mx-input" 
                              style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', height: '28px' }}
                              value={c.modoCondicion || 'normal'}
                              onChange={(e) => {
                                const nextCond = [...form.condiciones];
                                nextCond[idx].modoCondicion = e.target.value;
                                if (e.target.value === 'normal') nextCond[idx].valor = '';
                                setForm({ ...form, condiciones: nextCond });
                              }}
                            >
                              <option value="normal">Normal</option>
                              <option value="fijo">Fijo</option>
                            </select>
                          )}

                          {!(c.tipoValor === 'porcentaje' && (!c.modoCondicion || c.modoCondicion === 'normal')) && (
                            <input 
                              type={['numero', 'moneda', 'porcentaje', 'dias'].includes(c.tipoValor) ? 'number' : 'text'}
                              className="mx-input"
                              style={{ width: '100px', padding: '4px 8px', fontSize: '12px', height: '28px' }}
                              placeholder={c.tipoValor === 'moneda' ? '$ Valor' : c.tipoValor === 'porcentaje' ? '% Valor' : 'Valor'}
                              value={c.valor || ''}
                              onChange={(e) => {
                                const nextCond = [...form.condiciones];
                                nextCond[idx].valor = e.target.value;
                                setForm({ ...form, condiciones: nextCond });
                              }}
                            />
                          )}

                          <select 
                            className="mx-input" 
                            style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', height: '28px' }}
                            value={c.estado}
                            onChange={(e) => toggleCondicionStatus(idx, e.target.value)}
                          >
                            <option value="pendiente">Pendiente</option>
                            <option value="acordado">Acordado</option>
                            <option value="rechazado">Rechazado</option>
                          </select>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mx-form-row am-mt-16" style={{ display: 'flex', gap: '16px' }}>
                  <div className="mx-form-group" style={{ flex: 1 }}>
                    <label className="mx-label">Fecha probable inicio cosecha</label>
                    <input type="date" className="mx-input" value={form.fechaInicioCosecha} onChange={e => setForm({...form, fechaInicioCosecha: e.target.value})} />
                  </div>
                  <div className="mx-form-group" style={{ flex: 1 }}>
                    <label className="mx-label">Estado General</label>
                    <select className="mx-select" value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                      {ESTADOS_TRATO.map(e => <option key={e.val} value={e.val}>{e.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mx-form-group">
                  <label className="mx-label">Notas</label>
                  <textarea className="mx-textarea" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} rows="3" />
                </div>
              </div>
              <div className="mx-modal-footer">
                <button type="button" className="mx-btn mx-btn-outline" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary">Guardar Negociación</button>
              </div>
            </form>
          </div>
         </div>
      )}
      <ConfirmDeleteModal
        isOpen={Boolean(confirmDeleteTrato)}
        onClose={() => setConfirmDeleteTrato(null)}
        onConfirm={handleDelete}
        title="¿Eliminar trato?"
        itemName={confirmDeleteTrato?.proveedorNombre}
      />

      {/* Modal de Compartir Trato (Minimalista) */}
      {shareModal.open && (
        <div className="mx-modal-overlay" style={{ zIndex: 1100, backdropFilter: 'blur(4px)' }}>
          <div className="mx-modal" style={{ maxWidth: '380px', borderRadius: '24px', padding: '32px', textAlign: 'center' }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ width: '64px', height: '64px', background: '#f0fdf4', color: '#166534', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle2 size={32} />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px' }}>Trato Listo</h2>
              <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>Envía el comprobante oficial al proveedor.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
              <a 
                href={`https://wa.me/?text=${encodeURIComponent(shareModal.message || buildTratoShareMessage(shareModal.item, shareModal.url))}`}
                target="_blank"
                rel="noreferrer"
                className="mx-btn mx-btn-primary"
                style={{ background: '#25D366', borderColor: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', height: '48px', borderRadius: '14px' }}
              >
                <Send size={18} /> WhatsApp Directo
              </a>
              
              <button 
                className="mx-btn mx-btn-outline"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', height: '48px', borderRadius: '14px' }}
                onClick={() => copyToClipboard(shareModal.message || shareModal.url)}
              >
                <Copy size={18} /> Copiar mensaje
              </button>

              <button 
                className="mx-btn"
                style={{ border: 'none', background: 'transparent', color: '#94a3b8', fontSize: '0.85rem', marginTop: '8px' }}
                onClick={() => setShareModal({ open: false, url: '', item: null, message: '' })}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
     </div>
   );
 }
