import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../gestion.css';
import {
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Target,
  X,
  PauseCircle,
  CheckCircle2,
  Clock3,
  Beaker,
  Users,
  FileText,
  Truck,
  Zap,
  UserPlus,
  Inbox,
} from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { quickCaptureSeguimiento } from '../../../api/api-oportunidades';
import { useToast } from '../../../context/ToastContext';
import {
  todayChile,
  toISOFromDateInput,
  toDateInputValue,
  formatDateChile,
  daysAgoChile,
} from '../../../utils/dateChile';

const ACTION_OPTIONS = [
  { value: 'llame', label: 'Llamada', icon: Phone },
  { value: 'visite', label: 'Visita a centro', icon: MapPin },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'tome_muestra', label: 'Muestreo', icon: Beaker },
  { value: 'negocie', label: 'Reunión', icon: Users },
];

const MODULE_SHORTCUTS = [
  { label: 'Registrar contacto', path: '/gestion/proveedores?nuevoContacto=1', icon: UserPlus },
  { label: 'Registrar disponibilidad', path: '/biomasa/status?nuevaDisponibilidad=1', icon: Inbox },
  { label: 'Tratos', path: '/biomasa/tratos', icon: FileText },
  { label: 'Programa de Cosecha', path: '/biomasa/programa', icon: Truck },
  { label: 'Muestreo técnico', path: '/biomasa/muestreos', icon: Beaker },
];

const RESULT_OPTIONS = [
  { value: 'seguir', label: 'Seguir', icon: Target, tone: '#0A5CFF' },
  { value: 'pausar', label: 'Pausar', icon: PauseCircle, tone: '#d97706' },
  { value: 'cerrar', label: 'Cerrar', icon: X, tone: '#dc2626' },
  { value: 'acordar', label: 'Acordar', icon: CheckCircle2, tone: '#0891b2' },
];

const PAUSE_OPTIONS = [
  { value: 'esperando_crecimiento', label: 'Esperando crecimiento' },
  { value: 'esperando_disponibilidad', label: 'Esperando disponibilidad' },
  { value: 'esperando_respuesta', label: 'Esperando respuesta' },
  { value: 'esperando_resultado_muestra', label: 'Esperando resultado de muestra' },
  { value: 'esperando_decision_interna', label: 'Esperando decisión interna' },
];

const CLOSE_OPTIONS = [
  { value: 'vendido_a_otro', label: 'Vendió a otro' },
  { value: 'sin_biomasa', label: 'Sin biomasa' },
  { value: 'descartado', label: 'Descartado' },
  { value: 'no_califica', label: 'No califica' },
  { value: 'sin_respuesta', label: 'Sin respuesta' },
  { value: 'no_interesa', label: 'No interesa' },
];

const SEGUIMIENTO_META = {
  activo: { label: 'Seguimiento activo', tone: '#0A5CFF', bg: 'rgba(10, 92, 255, 0.12)' },
  pausado: { label: 'Pausado', tone: '#d97706', bg: 'rgba(217, 119, 6, 0.12)' },
  cerrado: { label: 'Cerrado', tone: '#dc2626', bg: 'rgba(220, 38, 38, 0.10)' },
  acordado: { label: 'Acordado', tone: '#0891b2', bg: 'rgba(8, 145, 178, 0.12)' },
};

function getCurrentUserName() {
  try {
    const raw = localStorage.getItem('ammpp_user');
    if (!raw) return '';
    const user = JSON.parse(raw);
    return user?.nombre || user?.name || user?.email?.split('@')?.[0] || '';
  } catch {
    return '';
  }
}

function formatShortDate(value) {
  return formatDateChile(value);
}

function formatDaysAgo(value) {
  const diff = daysAgoChile(value);
  if (diff === null) return '';
  if (diff <= 0) return 'hoy';
  if (diff === 1) return 'hace 1 dia';
  return `hace ${diff} dias`;
}

function initialState() {
  return {
    tipoGestion: 'llame',
    resultadoSeguimiento: 'seguir',
    fechaGestion: todayChile(),
    resumen: '',
    detalle: '',
    proximaAccion: '',
    fechaProximaAccion: '',
    fechaRevision: '',
    motivoPausa: 'esperando_respuesta',
    motivoCierre: 'sin_biomasa',
  };
}

function buildProviderDirectory(centros = [], contactos = []) {
  // Todos los contactos por proveedor (no solo el primero), para que la busqueda
  // por nombre/telefono/email de CUALQUIER contacto encuentre a su empresa.
  const contactsByKey = new Map();
  contactos.forEach((item) => {
    const key = String(item.proveedorKey || '').trim().toLowerCase();
    if (!key) return;
    if (!contactsByKey.has(key)) contactsByKey.set(key, []);
    contactsByKey.get(key).push(item);
  });

  const providers = new Map();
  centros.forEach((centro, index) => {
    const proveedorNombre = String(centro.proveedor || '').trim() || 'Proveedor sin nombre';
    const proveedorKey = String(centro.proveedorKey || proveedorNombre).trim().toLowerCase();
    if (!proveedorKey) return;

    const providerContacts = contactsByKey.get(proveedorKey) || [];
    const primaryContact = providerContacts[0] || null;
    const contactosSearchText = providerContacts
      .map((c) => `${c.contactoNombre || ''} ${c.contactoTelefono || ''} ${c.contactoEmail || ''}`)
      .join(' ');
    const existing = providers.get(proveedorKey);

    if (!existing) {
      providers.set(proveedorKey, {
        id: `prov-${proveedorKey || index}`,
        contactoId: primaryContact?._id || '',
        proveedorKey,
        proveedorNombre,
        contactoNombre: primaryContact?.contactoNombre || '',
        contactoTelefono: primaryContact?.contactoTelefono || '',
        contactoEmail: primaryContact?.contactoEmail || '',
        contactosSearchText,
        comuna: centro.comuna || '',
        centros: 1,
      });
      return;
    }

    existing.centros += 1;
    if (!existing.contactoNombre && primaryContact?.contactoNombre) existing.contactoNombre = primaryContact.contactoNombre;
    if (!existing.contactoTelefono && primaryContact?.contactoTelefono) existing.contactoTelefono = primaryContact.contactoTelefono;
    if (!existing.contactoEmail && primaryContact?.contactoEmail) existing.contactoEmail = primaryContact.contactoEmail;
    if (!existing.comuna && centro.comuna) existing.comuna = centro.comuna;
  });

  // Contactos sin empresa asociada (o cuya empresa no tiene centros registrados):
  // deben poder buscarse y seleccionarse igual, aunque no haya proveedor detras.
  contactos.forEach((item, index) => {
    const key = String(item.proveedorKey || '').trim().toLowerCase();
    if (key && providers.has(key)) return; // ya cubierto como parte de un proveedor existente
    const soloId = `contacto-${item._id || index}`;
    if (providers.has(soloId)) return;
    providers.set(soloId, {
      id: soloId,
      contactoId: item._id || '',
      proveedorKey: item.proveedorKey || '',
      proveedorNombre: item.proveedorNombre || '',
      contactoNombre: item.contactoNombre || item.nombre || '',
      contactoTelefono: item.contactoTelefono || '',
      contactoEmail: item.contactoEmail || '',
      contactosSearchText: `${item.contactoNombre || item.nombre || ''} ${item.contactoTelefono || ''} ${item.contactoEmail || ''}`,
      comuna: '',
      centros: 0,
    });
  });

  return Array.from(providers.values()).sort((a, b) =>
    (a.proveedorNombre || a.contactoNombre || '').localeCompare(b.proveedorNombre || b.contactoNombre || '')
  );
}

export default function QuickCaptureModal() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [providerContext, setProviderContext] = useState(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [suggestionApplied, setSuggestionApplied] = useState(false);
  const [form, setForm] = useState(initialState);
  const [savedInfo, setSavedInfo] = useState(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => searchInputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    function handleOpenWithContext(event) {
      const detail = event.detail || {};
      if (!detail.proveedorKey) return;
      const preselected = {
        id: `prov-${detail.proveedorKey}`,
        contactoId: detail.contactoId || '',
        proveedorKey: detail.proveedorKey,
        proveedorNombre: detail.proveedorNombre || '',
        contactoNombre: detail.contactoNombre || '',
        contactoTelefono: detail.contactoTelefono || '',
        contactoEmail: detail.contactoEmail || '',
        comuna: detail.comuna || '',
        centros: detail.centros || 0,
      };
      setSelected(preselected);
      setSearch(preselected.proveedorNombre);
      setOpen(true);
    }
    window.addEventListener('mitynex:quick-capture-open', handleOpenWithContext);
    return () => window.removeEventListener('mitynex:quick-capture-open', handleOpenWithContext);
  }, []);

  useEffect(() => {
    if (!open || providers.length > 0) return;

    let cancelled = false;
    const controller = new AbortController();

    async function loadProviders() {
      setLoadingProviders(true);
      try {
        const [centrosRes, contactosRes] = await Promise.all([
          apiClient.get('/centros', { signal: controller.signal }),
          apiClient.get('/contactos', { signal: controller.signal }),
        ]);

        if (!cancelled) {
          const centros = Array.isArray(centrosRes) ? centrosRes : (centrosRes.items || []);
          const contactos = Array.isArray(contactosRes) ? contactosRes : (contactosRes.items || []);
          setProviders(buildProviderDirectory(centros, contactos));
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        addToast({ title: 'Error', message: 'No se pudo cargar el directorio general de proveedores.', type: 'error' });
      } finally {
        if (!cancelled) setLoadingProviders(false);
      }
    }

    loadProviders();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, providers.length, addToast]);

  const filteredProviders = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return providers.filter((item) => {
      const providerText = `${item.proveedorNombre || ''} ${item.proveedorKey || ''} ${item.comuna || ''}`.toLowerCase();
      const contactText = (item.contactosSearchText || '').toLowerCase();
      return providerText.includes(q) || contactText.includes(q);
    }).slice(0, 10);
  }, [providers, search]);

  const selectedAction = ACTION_OPTIONS.find((item) => item.value === form.tipoGestion) || ACTION_OPTIONS[0];

  function closeModal() {
    setOpen(false);
    setSearch('');
    setSelected(null);
    setProviderContext(null);
    setSuggestionApplied(false);
    setForm(initialState());
    setSavedInfo(null);
  }

  function handleGoTo(path) {
    closeModal();
    navigate(path);
  }

  function handleSelectProvider(provider) {
    setSelected(provider);
    setSearch(provider.proveedorNombre || provider.contactoNombre || '');
    setSuggestionApplied(false);
  }

  useEffect(() => {
    if (!open || !selected?.proveedorKey) {
      setProviderContext(null);
      setLoadingContext(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function loadProviderContext() {
      setLoadingContext(true);
      try {
        const contactoQuery = selected.contactoId ? `contactoId=${encodeURIComponent(selected.contactoId)}&` : '';
        const [oportunidadesRes, interaccionesRes] = await Promise.all([
          apiClient.get(`/oportunidades?proveedorKey=${encodeURIComponent(selected.proveedorKey)}`, { signal: controller.signal }),
          apiClient.get(`/interacciones?${contactoQuery}proveedorKey=${encodeURIComponent(selected.proveedorKey)}&limit=1`, { signal: controller.signal }),
        ]);

        if (cancelled) return;

        const oportunidades = Array.isArray(oportunidadesRes) ? oportunidadesRes : (oportunidadesRes.items || []);
        const interacciones = Array.isArray(interaccionesRes) ? interaccionesRes : (interaccionesRes.items || []);
        const latestOpportunity = oportunidades[0] || null;
        const latestInteraction = interacciones[0] || null;

        setProviderContext({
          seguimientoEstado: latestOpportunity?.seguimientoEstado || '',
          proximaAccion: latestOpportunity?.proximaAccion || '',
          fechaProximaAccion: latestOpportunity?.fechaProximaAccion || latestOpportunity?.fechaRevision || '',
          estadoComercial: latestOpportunity?.estado || '',
          ultimaInteraccionFecha: latestInteraction?.fecha || '',
          ultimaInteraccionResumen: latestInteraction?.resumen || '',
          ultimaInteraccionResultado: latestInteraction?.resultado || '',
          ultimoResponsable: latestInteraction?.responsablePG || latestInteraction?.responsable || '',
        });
      } catch (error) {
        if (error.name === 'AbortError') return;
        if (!cancelled) setProviderContext(null);
      } finally {
        if (!cancelled) setLoadingContext(false);
      }
    }

    loadProviderContext();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, selected]);

  useEffect(() => {
    if (!selected?.id || !providerContext || suggestionApplied) return;
    if (providerContext.seguimientoEstado !== 'pausado') return;

    const suggestedDate = toDateInputValue(providerContext.fechaProximaAccion);
    if (!providerContext.proximaAccion && !suggestedDate) return;

    setForm((prev) => ({
      ...prev,
      resultadoSeguimiento: prev.resultadoSeguimiento === 'seguir' ? 'pausar' : prev.resultadoSeguimiento,
      proximaAccion: prev.proximaAccion || providerContext.proximaAccion || '',
      fechaRevision: prev.fechaRevision || suggestedDate,
    }));
    setSuggestionApplied(true);
  }, [providerContext, selected, suggestionApplied]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selected?.id) {
      addToast({ title: 'Falta proveedor', message: 'Selecciona un proveedor antes de guardar.', type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        contactoId: selected.contactoId || '',
        proveedorKey: selected.proveedorKey || '',
        proveedorNombre: selected.proveedorNombre || '',
        contactoNombre: selected.contactoNombre || '',
        responsablePG: getCurrentUserName(),
        tipoGestion: form.tipoGestion,
        resultadoSeguimiento: form.resultadoSeguimiento,
        fecha: toISOFromDateInput(form.fechaGestion) || new Date().toISOString(),
        resumen: form.resumen || `${selectedAction.label} a ${selected.proveedorNombre || 'proveedor'}`,
        detalle: form.detalle || '',
        proximaAccion: form.proximaAccion || '',
        fechaProximaAccion: toISOFromDateInput(form.fechaProximaAccion),
        fechaRevision: toISOFromDateInput(form.fechaRevision),
        motivoPausa: form.resultadoSeguimiento === 'pausar' ? form.motivoPausa : undefined,
        motivoCierre: form.resultadoSeguimiento === 'cerrar' ? form.motivoCierre : undefined,
        observacion: form.detalle || form.resumen || '',
      };

      await quickCaptureSeguimiento(payload);
      window.dispatchEvent(new CustomEvent('gestion:quick-capture-saved'));
      addToast({ title: 'Gestión registrada', message: 'Se actualizó el seguimiento del proveedor.', type: 'success' });
      setSavedInfo({ nombre: selected.proveedorNombre || selected.contactoNombre || 'el proveedor' });
    } catch (error) {
      addToast({ title: 'Error', message: error?.message || 'No se pudo guardar la gestión rápida.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-btn mx-btn-primary"
        title="Acción rápida — registrar gestión con proveedor"
        aria-label="Acción rápida"
        style={{
          position: 'fixed',
          right: '24px',
          bottom: '24px',
          zIndex: 60,
          borderRadius: '999px',
          padding: '12px 20px',
          boxShadow: '0 18px 40px rgba(15, 23, 42, 0.24)',
          gap: '8px',
        }}
      >
        <Zap size={17} /> <span className="qc-fab-label">Acción rápida</span>
      </button>

      {open && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '620px', width: 'min(100%, 620px)' }}>
            <div className="mx-modal-header">
              <div>
                <h3 className="mx-modal-title">{savedInfo ? 'Gestión registrada' : 'Registrar acción rápida'}</h3>
                <p style={{ margin: '6px 0 0', color: 'var(--color-text-subtle)', fontSize: '0.92rem' }}>
                  {savedInfo
                    ? `Se guardó correctamente con ${savedInfo.nombre}.`
                    : 'Registra una llamada, WhatsApp, visita a centro, reunión o muestreo rápido.'}
                </p>
              </div>
              <button type="button" className="mx-btn-icon" onClick={closeModal}><X size={20} /></button>
            </div>

            {savedInfo ? (
              <div className="mx-modal-body" style={{ display: 'grid', gap: '8px' }}>
                <CheckCircle2 size={36} style={{ color: '#10b981', margin: '0 auto 8px' }} />
                <p style={{ margin: '0 0 6px', textAlign: 'center', color: 'var(--color-text-subtle)', fontSize: '0.88rem' }}>
                  ¿Qué quieres hacer ahora?
                </p>
                {MODULE_SHORTCUTS.map(({ label, path, icon: Icon }) => (
                  <button
                    key={path}
                    type="button"
                    className="qc-module-option"
                    onClick={() => {
                      if (path.includes('nuevaDisponibilidad') && selected) {
                        sessionStorage.setItem('mitynex:nueva-disponibilidad-context', JSON.stringify({
                          proveedorKey: selected.proveedorKey || '',
                          proveedorNombre: selected.proveedorNombre || '',
                          contactoId: selected.contactoId || '',
                          contactoNombre: selected.contactoNombre || '',
                          contactoTelefono: selected.contactoTelefono || '',
                          contactoEmail: selected.contactoEmail || '',
                        }));
                      }
                      handleGoTo(path);
                    }}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </button>
                ))}
                <button type="button" className="mx-btn mx-btn-outline" style={{ marginTop: '6px' }} onClick={closeModal}>
                  Cerrar
                </button>
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="mx-form">
              <div className="mx-modal-body" style={{ display: 'grid', gap: '18px' }}>

                <p style={{ margin: 0, padding: '8px 12px', borderRadius: '10px', background: 'rgba(10, 92, 255, 0.06)', color: 'var(--color-text-subtle)', fontSize: '0.82rem' }}>
                  Podrás registrar disponibilidad, un contacto u otra gestión apenas guardes este registro.
                </p>

                <section className="mx-form-group">
                  <div className="quick-capture-provider-row">
                    <div>
                      <label className="mx-label">1. Proveedor</label>
                      <div className="quick-capture-provider-search">
                        <Search size={18} style={{ color: 'var(--color-text-subtle)', flexShrink: 0 }} />
                        <input
                          ref={searchInputRef}
                          type="text"
                          placeholder="Buscar empresa, comuna o contacto..."
                          value={search}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            setSearch(nextValue);
                            if (selected && nextValue.trim() !== (selected.proveedorNombre || selected.contactoNombre || '').trim()) {
                              setSelected(null);
                            }
                          }}
                          style={{
                            width: '100%',
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            fontSize: '0.96rem',
                            color: 'var(--color-text)',
                          }}
                        />
                      </div>
                    </div>
                    <div className="mx-form-group">
                      <label className="mx-label">Fecha acción</label>
                      <input
                        type="date"
                        className="mx-input"
                        value={form.fechaGestion}
                        onChange={(e) => setForm((prev) => ({ ...prev, fechaGestion: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                    {loadingProviders ? (
                      <div className="gs-empty-inline">Cargando proveedores...</div>
                    ) : !search.trim() ? (
                      <div className="gs-empty-inline">Escribe para buscar por proveedor o por contacto.</div>
                    ) : filteredProviders.length === 0 ? (
                      <div className="gs-empty-inline">No encontramos coincidencias en el directorio.</div>
                    ) : (
                      filteredProviders.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectProvider(item)}
                          style={{
                            textAlign: 'left',
                            width: '100%',
                            border: selected?.id === item.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                            borderRadius: '14px',
                            padding: '12px 14px',
                            background: selected?.id === item.id ? 'rgba(10, 92, 255, 0.08)' : 'white',
                          }}
                        >
                          <strong style={{ display: 'block' }}>{item.proveedorNombre || item.contactoNombre || 'Proveedor'}</strong>
                          <span style={{ display: 'block', marginTop: 4, color: 'var(--color-text-subtle)', fontSize: '0.88rem' }}>
                            {item.proveedorNombre
                              ? `${item.contactoNombre || 'Primer contacto'}${item.contactoTelefono ? ` · ${item.contactoTelefono}` : ''}${item.comuna ? ` · ${item.comuna}` : ''}`
                              : `Sin empresa asociada${item.contactoTelefono ? ` · ${item.contactoTelefono}` : ''}`}
                          </span>
                        </button>
                      ))
                    )}
                  </div>

                  {selected && (
                    <div
                      style={{
                        marginTop: 12,
                        border: '1px solid rgba(15, 23, 42, 0.08)',
                        borderRadius: 16,
                        padding: '14px 16px',
                        background: 'linear-gradient(180deg, rgba(248, 250, 252, 0.95), rgba(241, 245, 249, 0.95))',
                        display: 'grid',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <strong style={{ display: 'block' }}>{selected.proveedorNombre || selected.contactoNombre || 'Proveedor'}</strong>
                          <span style={{ display: 'block', marginTop: 4, color: 'var(--color-text-subtle)', fontSize: '0.88rem' }}>
                            {selected.proveedorNombre
                              ? `${selected.comuna || 'Comuna no informada'}${selected.centros ? ` · ${selected.centros} centro${selected.centros > 1 ? 's' : ''}` : ''}`
                              : 'Sin empresa asociada'}
                          </span>
                        </div>

                        {providerContext?.seguimientoEstado && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 12px',
                              borderRadius: 999,
                              fontSize: '0.82rem',
                              fontWeight: 800,
                              color: SEGUIMIENTO_META[providerContext.seguimientoEstado]?.tone || 'var(--color-text)',
                              background: SEGUIMIENTO_META[providerContext.seguimientoEstado]?.bg || 'rgba(15, 23, 42, 0.08)',
                            }}
                          >
                            {SEGUIMIENTO_META[providerContext.seguimientoEstado]?.label || providerContext.seguimientoEstado}
                          </span>
                        )}
                      </div>

                      {loadingContext ? (
                        <span style={{ fontSize: '0.9rem', color: 'var(--color-text-subtle)' }}>
                          Cargando ultimo contexto conocido...
                        </span>
                      ) : providerContext ? (
                        <div style={{ display: 'grid', gap: 10 }}>
                          <div style={{ display: 'grid', gap: 4 }}>
                            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Ultima interaccion
                            </span>
                            <span style={{ fontSize: '0.92rem', color: 'var(--color-text)' }}>
                              {providerContext.ultimaInteraccionResumen || 'Sin interacciones registradas aun.'}
                            </span>
                            {(providerContext.ultimaInteraccionFecha || providerContext.ultimaInteraccionResultado) && (
                              <span style={{ fontSize: '0.84rem', color: 'var(--color-text-subtle)' }}>
                                {providerContext.ultimaInteraccionFecha ? `${formatShortDate(providerContext.ultimaInteraccionFecha)}` : ''}
                                {providerContext.ultimaInteraccionFecha && providerContext.ultimaInteraccionResultado ? ' · ' : ''}
                                {providerContext.ultimaInteraccionResultado || ''}
                              </span>
                            )}
                            {(providerContext.ultimoResponsable || providerContext.ultimaInteraccionFecha) && (
                              <span style={{ fontSize: '0.84rem', color: 'var(--color-text-subtle)' }}>
                                {providerContext.ultimoResponsable ? `Responsable: ${providerContext.ultimoResponsable}` : ''}
                                {providerContext.ultimoResponsable && providerContext.ultimaInteraccionFecha ? ' · ' : ''}
                                {providerContext.ultimaInteraccionFecha ? formatDaysAgo(providerContext.ultimaInteraccionFecha) : ''}
                              </span>
                            )}
                          </div>

                          {(providerContext.proximaAccion || providerContext.estadoComercial) && (
                            <div style={{ display: 'grid', gap: 4 }}>
                              <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Estado conocido
                              </span>
                              {providerContext.proximaAccion ? (
                                <span style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>
                                  Proxima accion: <strong>{providerContext.proximaAccion}</strong>
                                  {providerContext.fechaProximaAccion ? ` · ${formatShortDate(providerContext.fechaProximaAccion)}` : ''}
                                </span>
                              ) : null}
                              {providerContext.estadoComercial ? (
                                <span style={{ fontSize: '0.84rem', color: 'var(--color-text-subtle)' }}>
                                  Estado comercial actual: {providerContext.estadoComercial}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.9rem', color: 'var(--color-text-subtle)' }}>
                          Este proveedor aun no tiene contexto previo guardado. Este registro sera el primero.
                        </span>
                      )}
                    </div>
                  )}
                </section>

                <section className="mx-form-group">
                  <label className="mx-label">2. Qué pasó</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginTop: 8 }}>
                    {ACTION_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const active = form.tipoGestion === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, tipoGestion: option.value }))}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            justifyContent: 'center',
                            borderRadius: '14px',
                            border: active ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                            background: active ? 'rgba(10, 92, 255, 0.08)' : 'white',
                            minHeight: '52px',
                            fontWeight: 700,
                          }}
                        >
                          <Icon size={16} />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="mx-form-group">
                  <label className="mx-label">3. Cómo quedó</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', marginTop: 8 }}>
                    {RESULT_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const active = form.resultadoSeguimiento === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, resultadoSeguimiento: option.value }))}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            justifyContent: 'center',
                            borderRadius: '14px',
                            border: active ? `2px solid ${option.tone}` : '1px solid var(--color-border)',
                            background: active ? `${option.tone}12` : 'white',
                            color: active ? option.tone : 'var(--color-text)',
                            minHeight: '52px',
                            fontWeight: 700,
                          }}
                        >
                          <Icon size={16} />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {(form.resultadoSeguimiento === 'seguir' || form.resultadoSeguimiento === 'pausar') && (
                  <section className="mx-field-row" style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 180px' }}>
                    {providerContext?.seguimientoEstado === 'pausado' && suggestionApplied && (
                      <div
                        style={{
                          gridColumn: '1 / -1',
                          padding: '10px 12px',
                          borderRadius: 12,
                          background: 'rgba(217, 119, 6, 0.10)',
                          color: '#9a6700',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                        }}
                      >
                        Cargamos como sugerencia la ultima proxima accion del estado pausado. Puedes editarla antes de guardar.
                      </div>
                    )}
                    <div className="mx-form-group">
                      <label className="mx-label">Próxima acción</label>
                      <input
                        className="mx-input"
                        value={form.proximaAccion}
                        onChange={(e) => setForm((prev) => ({ ...prev, proximaAccion: e.target.value }))}
                        placeholder={form.resultadoSeguimiento === 'pausar' ? 'Ej: Recontactar cuando toque revisión' : 'Ej: Llamar para confirmar disponibilidad'}
                        required
                      />
                    </div>
                    <div className="mx-form-group">
                      <label className="mx-label">{form.resultadoSeguimiento === 'pausar' ? 'Fecha revisión' : 'Fecha próxima'}</label>
                      <input
                        type="date"
                        className="mx-input"
                        value={form.resultadoSeguimiento === 'pausar' ? form.fechaRevision : form.fechaProximaAccion}
                        onChange={(e) => setForm((prev) => (
                          form.resultadoSeguimiento === 'pausar'
                            ? { ...prev, fechaRevision: e.target.value }
                            : { ...prev, fechaProximaAccion: e.target.value }
                        ))}
                        required
                      />
                    </div>
                  </section>
                )}

                {form.resultadoSeguimiento === 'pausar' && (
                  <section className="mx-form-group">
                    <label className="mx-label">Motivo de pausa</label>
                    <select
                      className="mx-select"
                      value={form.motivoPausa}
                      onChange={(e) => setForm((prev) => ({ ...prev, motivoPausa: e.target.value }))}
                    >
                      {PAUSE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </section>
                )}

                {form.resultadoSeguimiento === 'cerrar' && (
                  <section className="mx-form-group">
                    <label className="mx-label">Motivo de cierre</label>
                    <select
                      className="mx-select"
                      value={form.motivoCierre}
                      onChange={(e) => setForm((prev) => ({ ...prev, motivoCierre: e.target.value }))}
                    >
                      {CLOSE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </section>
                )}

                <section className="mx-form-group">
                  <label className="mx-label">Resumen corto</label>
                  <input
                    className="mx-input"
                    value={form.resumen}
                    onChange={(e) => setForm((prev) => ({ ...prev, resumen: e.target.value }))}
                    placeholder={`${selectedAction.label} ${selected ? `a ${selected.proveedorNombre || 'proveedor'}` : ''}`}
                  />
                </section>

                <section className="mx-form-group">
                  <label className="mx-label">Nota opcional</label>
                  <textarea
                    className="mx-textarea"
                    rows="3"
                    value={form.detalle}
                    onChange={(e) => setForm((prev) => ({ ...prev, detalle: e.target.value }))}
                    placeholder="Detalle breve, acuerdo, contexto o compromiso..."
                  />
                </section>

                {selected && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'rgba(15, 23, 42, 0.04)' }}>
                    <Clock3 size={16} />
                    <span style={{ fontSize: '0.92rem', color: 'var(--color-text-subtle)' }}>
                      Guardaremos esta gestión para <strong style={{ color: 'var(--color-text)' }}>{selected.proveedorNombre || 'proveedor'}</strong>
                      {' '}y actualizaremos su seguimiento en el mismo paso.
                    </span>
                  </div>
                )}
              </div>

              <div className="mx-modal-footer">
                <button type="button" className="mx-btn mx-btn-outline" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary" disabled={saving || !selected}>
                  {saving ? 'Guardando...' : 'Guardar gestión'}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
