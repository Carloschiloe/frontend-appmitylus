import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Filter,
  FlaskConical,
  LayoutGrid,
  LayoutList,
  MessageSquare,
  PauseCircle,
  Phone,
  Search,
  User,
  Users,
  XCircle,
  MapPin,
  CalendarDays,
  ChevronRight,
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { useQuery } from '@tanstack/react-query';
import './historial.css';

const EVENT_META = {
  contacto:     { label: 'Contacto',    color: '#6366f1', icon: User },
  visita:       { label: 'Visita',      color: '#f59e0b', icon: MapPin },
  interaccion:  { label: 'Gestión',     color: '#06b6d4', icon: MessageSquare },
  llamada:      { label: 'Llamada',     color: '#2563eb', icon: Phone },
  whatsapp:     { label: 'WhatsApp',    color: '#16a34a', icon: MessageSquare },
  reunion:      { label: 'Reunión',     color: '#d97706', icon: Users },
  muestreo:     { label: 'Muestreo',    color: '#7c3aed', icon: FlaskConical },
  seguimiento:  { label: 'Seguimiento', color: '#0A5CFF', icon: Clock3 },
};

const TEAM_ACTIVITY_META = {
  llamada:     { label: 'Llamada',            color: '#2563eb', icon: Phone },
  whatsapp:    { label: 'WhatsApp',           color: '#16a34a', icon: MessageSquare },
  reunion:     { label: 'Reunión',            color: '#d97706', icon: Users },
  interaccion: { label: 'Gestión',            color: '#0891b2', icon: MessageSquare },
  visita:      { label: 'Visita',             color: '#f59e0b', icon: MapPin },
  muestreo:    { label: 'Muestreo',           color: '#7c3aed', icon: FlaskConical },
  seguimiento: { label: 'Cambio seguimiento', color: '#0A5CFF', icon: Clock3 },
};

const STATUS_META = {
  activo:   { label: 'Activo',           color: '#0A5CFF', bg: 'rgba(10,92,255,0.10)',  icon: Clock3 },
  pausado:  { label: 'Pausado',          color: '#d97706', bg: 'rgba(217,119,6,0.10)',  icon: PauseCircle },
  cerrado:  { label: 'Cerrado',          color: '#dc2626', bg: 'rgba(220,38,38,0.08)',  icon: XCircle },
  acordado: { label: 'Acordado',         color: '#0891b2', bg: 'rgba(8,145,178,0.10)', icon: CheckCircle2 },
  none:     { label: 'Sin seguimiento',  color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: Clock3 },
};

const AVATAR_PALETTE = [
  '#6366f1','#0891b2','#16a34a','#d97706','#7c3aed',
  '#be185d','#0A5CFF','#059669','#b45309','#0e7490',
];

function getAvatarColor(name) {
  let hash = 0;
  const s = String(name || '').toLowerCase();
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function firstNonEmpty(...values) {
  return values.find((v) => String(v || '').trim()) || '';
}

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value) {
  const d = toDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}

function relativeText(value) {
  const d = toDate(value);
  if (!d) return '';
  const msPerDay = 86400000;
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfToday - startOfTarget) / msPerDay);
  if (diffDays < 0)  return `En ${Math.abs(diffDays)} día${Math.abs(diffDays) === 1 ? '' : 's'}`;
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 30) return `Hace ${diffDays} días`;
  return `Hace ${Math.floor(diffDays / 30)} mes${Math.floor(diffDays / 30) === 1 ? '' : 'es'}`;
}

function normalizeTeamActivityType(value) {
  const n = normalizeKey(value);
  if (n.includes('llamad'))  return 'llamada';
  if (n.includes('whatsapp') || n.includes('wasap') || n.includes('wsp')) return 'whatsapp';
  if (n.includes('reuni'))   return 'reunion';
  if (n.includes('visit'))   return 'visita';
  if (n.includes('muestre')) return 'muestreo';
  return n || 'interaccion';
}

// ── Builder helpers ────────────────────────────────────────────────────────────

function buildProviderHistory({ contactos = [], visitas = [], interacciones = [], oportunidades = [], muestreos = [] }) {
  const providers = new Map();

  function ensureProvider(key, baseName) {
    if (!providers.has(key)) {
      providers.set(key, {
        key, name: baseName || 'Proveedor sin nombre',
        status: '', estadoComercial: '', proximaAccion: '', fechaProximaAccion: '',
        motivoCierre: '', motivoPausa: '',
        totalContactos: 0, totalEventos: 0,
        contactoPrincipal: '', contactoTelefono: '', contactoEmail: '',
        lastActivity: null, lastInteraction: '', lastResponsable: '', events: [],
      });
    }
    return providers.get(key);
  }

  contactos.forEach((item) => {
    const providerName = firstNonEmpty(item.proveedorNombre, item.proveedor, item.nombre, 'Proveedor sin nombre');
    const key = normalizeKey(item.proveedorKey || providerName);
    if (!key) return;
    const provider = ensureProvider(key, providerName);
    const eventDate = item.createdAt || item.updatedAt || item.fecha;
    provider.totalContactos += 1;
    provider.contactoPrincipal = provider.contactoPrincipal || firstNonEmpty(item.contactoNombre, item.nombre);
    provider.contactoTelefono  = provider.contactoTelefono  || firstNonEmpty(item.contactoTelefono, item.telefono);
    provider.contactoEmail     = provider.contactoEmail     || firstNonEmpty(item.contactoEmail, item.email);
    provider.events.push({
      id: `contacto-${item._id || `${key}-${provider.totalContactos}`}`,
      type: 'contacto', date: toDate(eventDate),
      title: firstNonEmpty(item.contactoNombre, item.nombre, 'Contacto agregado'),
      summary: firstNonEmpty(item.cargo, 'Contacto registrado en el directorio'),
      note: firstNonEmpty(item.notas), actor: '',
      extra: [
        provider.contactoTelefono ? `Teléfono: ${provider.contactoTelefono}` : '',
        provider.contactoEmail    ? `Correo: ${provider.contactoEmail}` : '',
      ].filter(Boolean),
    });
  });

  visitas.forEach((item) => {
    const providerName = firstNonEmpty(item.proveedorNombre, item.proveedor, 'Proveedor sin nombre');
    const key = normalizeKey(item.proveedorKey || providerName);
    if (!key) return;
    const provider = ensureProvider(key, providerName);
    provider.events.push({
      id: `visita-${item._id || `${key}-${provider.events.length}`}`,
      type: 'visita', date: toDate(item.fecha || item.createdAt || item.updatedAt),
      title: firstNonEmpty(item.titulo, item.tipo, 'Visita registrada'),
      summary: firstNonEmpty(item.observaciones, item.resumen, item.descripcion, 'Sin detalle adicional.'),
      note: firstNonEmpty(item.proximoPaso),
      actor: firstNonEmpty(item.responsable, item.responsablePG, item.contactoResponsable),
      extra: [
        item.estado ? `Estado: ${item.estado}` : '',
        item.proximoPasoFecha ? `Revisión: ${formatDate(item.proximoPasoFecha)}` : '',
      ].filter(Boolean),
    });
  });

  interacciones.forEach((item) => {
    const providerName = firstNonEmpty(item.proveedorNombre, item.proveedor, 'Proveedor sin nombre');
    const key = normalizeKey(item.proveedorKey || providerName);
    if (!key) return;
    const provider = ensureProvider(key, providerName);
    const rawType  = normalizeTeamActivityType(item.tipo || item.canal || item.tipoGestion || '');
    const eventType = EVENT_META[rawType] ? rawType : 'interaccion';
    const event = {
      id: `interaccion-${item._id || `${key}-${provider.events.length}`}`,
      type: eventType, date: toDate(item.fecha || item.createdAt || item.updatedAt),
      title: firstNonEmpty(item.resumen, item.tipo, 'Gestión registrada'),
      summary: firstNonEmpty(item.resultado, item.notas, 'Sin resumen adicional.'),
      note: firstNonEmpty(item.proximoPaso),
      actor: firstNonEmpty(item.responsablePG, item.responsable),
      extra: [
        item.estado ? `Resultado: ${item.estado}` : '',
        item.fechaProximo || item.fechaProx ? `Próxima fecha: ${formatDate(item.fechaProximo || item.fechaProx)}` : '',
      ].filter(Boolean),
    };
    provider.events.push(event);
    provider.lastInteraction = provider.lastInteraction || event.title;
    provider.lastResponsable = provider.lastResponsable || event.actor;
  });

  oportunidades.forEach((item) => {
    const providerName = firstNonEmpty(item.proveedorNombre, item.proveedor, 'Proveedor sin nombre');
    const key = normalizeKey(item.proveedorKey || providerName);
    if (!key) return;
    const provider = ensureProvider(key, providerName);
    provider.status              = item.seguimientoEstado  || provider.status;
    provider.estadoComercial     = item.estado             || provider.estadoComercial;
    provider.proximaAccion       = item.proximaAccion      || provider.proximaAccion;
    provider.fechaProximaAccion  = item.fechaProximaAccion || item.fechaRevision || provider.fechaProximaAccion;
    provider.motivoCierre        = item.motivoCierre       || provider.motivoCierre;
    provider.motivoPausa         = item.motivoPausa        || provider.motivoPausa;
    provider.events.push({
      id: `seguimiento-${item._id || `${key}-${provider.events.length}`}`,
      type: 'seguimiento', date: toDate(item.ultimaActividadAt || item.updatedAt || item.createdAt || item.fechaInicio),
      title: `Seguimiento ${(STATUS_META[item.seguimientoEstado || 'none']?.label || 'actualizado').toLowerCase()}`,
      summary: firstNonEmpty(
        item.proximaAccion ? `Próxima acción: ${item.proximaAccion}` : '',
        item.motivoPausa   ? `Motivo de pausa: ${item.motivoPausa}` : '',
        item.motivoCierre  ? `Cierre: ${item.motivoCierre}` : '',
        item.estado        ? `Estado comercial: ${item.estado}` : '',
        'Sin detalle adicional.'
      ),
      note: '', actor: firstNonEmpty(item.responsableNombre),
      extra: [
        item.fechaProximaAccion ? `Fecha objetivo: ${formatDate(item.fechaProximaAccion)}` : '',
        item.fechaRevision      ? `Revisión: ${formatDate(item.fechaRevision)}` : '',
        item.estado             ? `Estado comercial: ${item.estado}` : '',
      ].filter(Boolean),
    });
  });

  const contactNameToProvKey = new Map();
  contactos.forEach((c) => {
    const companyKey = normalizeKey(c.proveedorKey);
    if (!companyKey) return;
    [c.nombre, c.contactoNombre].filter(Boolean).forEach((n) => {
      const nk = normalizeKey(n);
      if (nk) contactNameToProvKey.set(nk, companyKey);
    });
  });

  muestreos.forEach((item) => {
    const keyByProvKey = normalizeKey(item.proveedorKey);
    const keyByName    = normalizeKey(item.proveedorNombre || item.proveedor);
    const provider =
      (keyByProvKey && providers.get(keyByProvKey)) ||
      (keyByName && (
        providers.get(keyByName) ||
        Array.from(providers.values()).find((p) => normalizeKey(p.name) === keyByName) ||
        Array.from(providers.values()).find((p) => p.contactoPrincipal && normalizeKey(p.contactoPrincipal) === keyByName) ||
        providers.get(contactNameToProvKey.get(keyByName))
      ));
    if (!provider) return;

    const lineaLabel   = item.linea ? item.linea.trim().replace(/^l[ií]nea\s+/i, '') : null;
    const calificacion = item.clasificaciones?.[0]?.nombre || 'S/C';
    const rendStr  = item.rendimiento != null ? `Rend: ${Number(item.rendimiento).toFixed(1)}%` : null;
    const uxkgStr  = item.uxkg > 0 ? `U/Kg: ${item.uxkg}` : null;
    const procStr  = item.total > 0 ? `Procesable: ${(item.procesable / item.total * 100).toFixed(1)}%` : null;
    const rechStr  = item.total > 0 ? `Rechazo: ${(item.rechazos / item.total * 100).toFixed(1)}%` : null;
    const summaryParts = [!item.centroCodigo ? 'Sin centro' : null, calificacion, rendStr, uxkgStr, procStr, rechStr].filter(Boolean);
    const fotosCount = Array.isArray(item.fotos) ? item.fotos.length : (item.fotosCount || 0);
    provider.events.push({
      id: `muestreo-${item._id || `${provider.key}-${provider.events.length}`}`,
      type: 'muestreo', date: toDate(item.fecha || item.createdAt || item.updatedAt),
      title: lineaLabel ? `Muestreo Línea ${lineaLabel}` : item.centroCodigo ? `Muestreo centro ${item.centroCodigo}` : 'Muestreo registrado',
      summary: summaryParts.join(' · ') || firstNonEmpty(item.observaciones, item.notas, 'Sin métricas registradas.'),
      note: firstNonEmpty(item.comentarios, item.observaciones),
      actor: firstNonEmpty(item.responsable, item.usuarioNombre),
      extra: fotosCount > 0 ? [`${fotosCount} foto${fotosCount === 1 ? '' : 's'}`] : [],
    });
  });

  return Array.from(providers.values())
    .map((provider) => {
      const sortedEvents = [...provider.events].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
      const lastInteractionEvent = sortedEvents.find((e) => ['interaccion','llamada','whatsapp','reunion'].includes(e.type)) || null;
      return {
        ...provider,
        events: sortedEvents,
        totalEventos: sortedEvents.length,
        lastActivity: sortedEvents[0]?.date || null,
        lastInteraction: provider.lastInteraction || lastInteractionEvent?.title || '',
        lastResponsable: provider.lastResponsable || lastInteractionEvent?.actor || '',
      };
    })
    .sort((a, b) => (b.lastActivity?.getTime() || 0) - (a.lastActivity?.getTime() || 0));
}

function buildTeamActivity({ interacciones = [], visitas = [], muestreos = [], oportunidades = [] }) {
  const activities = [];
  interacciones.forEach((item) => {
    activities.push({
      id: `team-int-${item._id || activities.length}`,
      date: toDate(item.fecha || item.createdAt || item.updatedAt),
      user: firstNonEmpty(item.responsablePG, item.responsable, item.usuarioNombre, 'Sin responsable'),
      provider: firstNonEmpty(item.proveedorNombre, item.proveedor, item.contactoNombre, 'Proveedor sin nombre'),
      center: firstNonEmpty(item.centroCodigo, item.centroNombre, item.comuna),
      type: normalizeTeamActivityType(item.tipo),
      summary: firstNonEmpty(item.resumen, item.tipo, 'Gestión registrada'),
      result: firstNonEmpty(item.resultado, item.estado, 'Sin resultado'),
      nextAction: firstNonEmpty(item.proximoPaso),
      nextDate: item.fechaProximo || item.fechaProx || item.proximoPasoFecha || null,
      seguimientoEstado: '',
    });
  });
  visitas.forEach((item) => {
    activities.push({
      id: `team-vis-${item._id || activities.length}`,
      date: toDate(item.fecha || item.createdAt || item.updatedAt),
      user: firstNonEmpty(item.responsablePG, item.responsable, 'Sin responsable'),
      provider: firstNonEmpty(item.proveedorNombre, item.proveedor, item.contacto, 'Proveedor sin nombre'),
      center: firstNonEmpty(item.centroCodigo, item.centroNombre, item.comuna),
      type: 'visita',
      summary: firstNonEmpty(item.titulo, item.tipo, 'Visita registrada'),
      result: firstNonEmpty(item.estado, item.observaciones, 'Sin resultado'),
      nextAction: firstNonEmpty(item.proximoPaso),
      nextDate: item.proximoPasoFecha || null,
      seguimientoEstado: '',
    });
  });
  muestreos.forEach((item) => {
    activities.push({
      id: `team-mue-${item._id || activities.length}`,
      date: toDate(item.fecha || item.createdAt || item.updatedAt),
      user: firstNonEmpty(item.responsablePG, item.usuarioNombre, item.responsable, 'Sin responsable'),
      provider: firstNonEmpty(item.proveedorNombre, item.proveedor, 'Proveedor sin nombre'),
      center: firstNonEmpty(item.centroCodigo, item.centroNombre, item.comuna),
      type: 'muestreo',
      summary: firstNonEmpty(item.observaciones, 'Muestreo registrado'),
      result: firstNonEmpty(item.clasificaciones?.[0]?.nombre, item.estado, 'Sin clasificación'),
      nextAction: '', nextDate: null, seguimientoEstado: '',
    });
  });
  oportunidades.forEach((item) => {
    const activityDate = toDate(item.ultimaActividadAt || item.updatedAt || item.createdAt || item.fechaInicio);
    if (!activityDate) return;
    activities.push({
      id: `team-seg-${item._id || activities.length}`,
      date: activityDate,
      user: firstNonEmpty(item.responsableNombre, 'Sin responsable'),
      provider: firstNonEmpty(item.proveedorNombre, item.proveedor, 'Proveedor sin nombre'),
      center: firstNonEmpty(item.centroCodigo, item.centroNombre, item.centroComuna),
      type: 'seguimiento',
      summary: firstNonEmpty(
        item.proximaAccion ? `Seguimiento: ${item.proximaAccion}` : '',
        item.motivoPausa   ? `Pausa: ${item.motivoPausa}` : '',
        item.motivoCierre  ? `Cierre: ${item.motivoCierre}` : '',
        'Seguimiento actualizado'
      ),
      result: firstNonEmpty(item.estado, item.motivoCierre, item.motivoPausa, 'Sin resultado'),
      nextAction: firstNonEmpty(item.proximaAccion),
      nextDate: item.fechaProximaAccion || item.fechaRevision || null,
      seguimientoEstado: item.seguimientoEstado || '',
    });
  });
  return activities.filter((i) => i.date).sort((a, b) => b.date - a.date);
}

// ── TeamActivityView ───────────────────────────────────────────────────────────

function TeamActivityView({ loading, activities, searchTerm, teamTypeFilter, setTeamTypeFilter, teamUserFilter, setTeamUserFilter, teamUsers, muestreosTruncated }) {
  const filteredActivities = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return activities.filter((item) => {
      if (teamTypeFilter !== 'todos' && item.type !== teamTypeFilter) return false;
      if (teamUserFilter !== 'todos' && item.user !== teamUserFilter) return false;
      if (!q) return true;
      return [item.user, item.provider, item.center, item.summary, item.result, item.nextAction]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [activities, searchTerm, teamTypeFilter, teamUserFilter]);

  const kpis = useMemo(() => {
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return {
      llamadas:       filteredActivities.filter((i) => i.type === 'llamada').length,
      visitas:        filteredActivities.filter((i) => i.type === 'visita').length,
      muestreos:      filteredActivities.filter((i) => i.type === 'muestreo').length,
      gestionesHoy:   filteredActivities.filter((i) => i.date >= startToday).length,
      usuariosActivos: new Set(filteredActivities.map((i) => i.user).filter(Boolean)).size,
    };
  }, [filteredActivities]);

  const KPI_ITEMS = [
    { label: 'Llamadas',        value: kpis.llamadas,        color: '#2563eb' },
    { label: 'Visitas',         value: kpis.visitas,         color: '#f59e0b' },
    { label: 'Muestreos',       value: kpis.muestreos,       color: '#7c3aed' },
    { label: 'Gestiones del día', value: kpis.gestionesHoy,  color: '#16a34a' },
    { label: 'Usuarios activos', value: kpis.usuariosActivos, color: '#0891b2' },
  ];

  return (
    <>
      <div className="historial-kpi-row">
        {KPI_ITEMS.map(({ label, value, color }) => (
          <div key={label} className="hkpi-card">
            <div className="hkpi-value" style={{ color }}>{value}</div>
            <div className="hkpi-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="historial-filter-bar">
        <div className="mx-toggle-group">
          {[
            { value: 'todos',       label: 'Todos' },
            { value: 'llamada',     label: 'Llamadas' },
            { value: 'whatsapp',    label: 'WhatsApp' },
            { value: 'reunion',     label: 'Reuniones' },
            { value: 'visita',      label: 'Visitas' },
            { value: 'muestreo',    label: 'Muestreos' },
            { value: 'seguimiento', label: 'Seguimiento' },
          ].map((opt) => (
            <button key={opt.value} type="button"
              className={`mx-toggle-btn ${teamTypeFilter === opt.value ? 'active' : ''}`}
              onClick={() => setTeamTypeFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <select className="mx-input" value={teamUserFilter} onChange={(e) => setTeamUserFilter(e.target.value)} style={{ maxWidth: '220px' }}>
          <option value="todos">Todos los usuarios</option>
          {teamUsers.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <span className="historial-result-count">{filteredActivities.length} actividades</span>
      </div>

      {muestreosTruncated && (
        <div className="historial-truncated-note">
          Mostrando los últimos 200 muestreos. El historial completo puede tener más registros.
        </div>
      )}

      <div className="historial-card-section">
        {loading ? (
          <div className="mx-state-placeholder"><div className="mx-spinner" /><p>Sincronizando actividad del equipo...</p></div>
        ) : filteredActivities.length === 0 ? (
          <div className="mx-state-placeholder">
            <AlertCircle size={44} />
            <h3>Sin actividad para este filtro</h3>
            <p>No encontramos registros con ese criterio.</p>
          </div>
        ) : (
          <div className="historial-team-list">
            {filteredActivities.map((item) => {
              const meta     = TEAM_ACTIVITY_META[item.type] || TEAM_ACTIVITY_META.interaccion;
              const Icon     = meta.icon;
              const seguimiento = STATUS_META[item.seguimientoEstado || 'none'] || STATUS_META.none;
              return (
                <div key={item.id} className="hteam-card">
                  <div className="hteam-card-left">
                    <div className="hteam-icon" style={{ background: `${meta.color}18`, color: meta.color }}>
                      <Icon size={17} />
                    </div>
                    <div className="hteam-who">
                      <span className="hteam-user">{item.user}</span>
                      <span className="hteam-when">{meta.label} · {formatDateTime(item.date)}</span>
                    </div>
                  </div>
                  <span className="hteam-type-badge" style={{ background: `${meta.color}15`, color: meta.color }}>
                    {meta.label}
                  </span>

                  <div className="hteam-body">
                    <div className="hteam-provider">{item.provider}</div>
                    <div className="hteam-summary">{item.summary}</div>
                    <div className="hteam-result">Resultado: {item.result || 'Sin resultado'}</div>
                  </div>

                  <div className="hteam-footer">
                    <span>{item.center || 'Sin centro'}</span>
                    {item.nextAction ? <span>Próxima: {item.nextAction}</span> : null}
                    {item.nextDate   ? <span>{formatDate(item.nextDate)}</span> : null}
                    {item.seguimientoEstado ? (
                      <span style={{ color: seguimiento.color, fontWeight: 600 }}>{seguimiento.label}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ── ProviderCardsView ─────────────────────────────────────────────────────────

const DATE_FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: '7d',    label: 'Últimos 7 días' },
  { value: '30d',   label: 'Últimos 30 días' },
  { value: '90d',   label: 'Últimos 90 días' },
];

const STATUS_FILTER_OPTS = [
  { value: '',        label: 'Todos' },
  { value: 'activo',  label: 'Activo' },
  { value: 'acordado',label: 'Acordado' },
  { value: 'pausado', label: 'Pausado' },
  { value: 'cerrado', label: 'Cerrado' },
  { value: 'none',    label: 'Sin seguimiento' },
];

function ProviderCardsView({ loading, providers, searchTerm, onSelectProvider }) {
  const [viewMode,         setViewMode]         = useState('lista');
  const [dateFilter,       setDateFilter]       = useState('todos');
  const [statusFilter,     setStatusFilter]     = useState('');
  const [responsableFilter,setResponsableFilter] = useState('todos');

  const responsableOptions = useMemo(() => {
    const seen = new Map();
    providers.forEach((p) => {
      const nombre = String(p.lastResponsable || '').trim();
      if (!nombre) return;
      const key = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (!seen.has(key)) seen.set(key, nombre);
    });
    return [...seen.values()].sort((a, b) => a.localeCompare(b, 'es'));
  }, [providers]);

  const statusCounts = useMemo(() => {
    const c = {};
    providers.forEach((p) => {
      const s = p.status || 'none';
      c[s] = (c[s] || 0) + 1;
    });
    return c;
  }, [providers]);

  const filteredProviders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const now = Date.now();
    const cutoffs = { '7d': 7, '30d': 30, '90d': 90 };
    const cutoffMs = cutoffs[dateFilter] ? now - cutoffs[dateFilter] * 86400000 : null;

    return providers.filter((p) => {
      if (cutoffMs && (!p.lastActivity || p.lastActivity.getTime() < cutoffMs)) return false;
      if (responsableFilter !== 'todos' && p.lastResponsable !== responsableFilter) return false;
      if (statusFilter) {
        const provStatus = p.status || 'none';
        if (provStatus !== statusFilter) return false;
      }
      if (!q) return true;
      return [p.name, p.contactoPrincipal, p.proximaAccion, p.lastInteraction, p.lastResponsable]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [providers, searchTerm, dateFilter, responsableFilter, statusFilter]);

  const kpiStats = useMemo(() => {
    const MS_24H = 86400000;
    const now = Date.now();
    return {
      totalEventos:   providers.reduce((s, p) => s + p.totalEventos, 0),
      totalContactos: providers.reduce((s, p) => s + p.totalContactos, 0),
      ultimas24h:     providers.filter((p) => p.lastActivity && (now - p.lastActivity.getTime()) <= MS_24H).length,
    };
  }, [providers]);

  const KPI_ITEMS = [
    { label: 'Proveedores con historial', value: providers.length,        icon: Building2,    color: '#0A5CFF' },
    { label: 'Eventos registrados',       value: kpiStats.totalEventos,   icon: CalendarDays, color: '#7c3aed' },
    { label: 'Contactos en directorio',   value: kpiStats.totalContactos, icon: Users,        color: '#0891b2' },
    { label: 'Activos últimas 24h',       value: kpiStats.ultimas24h,     icon: Clock3,       color: '#16a34a' },
  ];

  return (
    <>
      {/* KPIs */}
      <div className="historial-kpi-row">
        {KPI_ITEMS.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="hkpi-card">
            <div className="hkpi-icon" style={{ background: `${color}12`, color }}><Icon size={18} /></div>
            <div>
              <div className="hkpi-value" style={{ color }}>{value}</div>
              <div className="hkpi-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Barra filtros: fecha + responsable + vista */}
      <div className="historial-filter-bar">
        <div className="mx-toggle-group">
          {DATE_FILTERS.map((opt) => (
            <button key={opt.value} type="button"
              className={`mx-toggle-btn ${dateFilter === opt.value ? 'active' : ''}`}
              onClick={() => setDateFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {responsableOptions.length > 0 && (
          <select className="mx-input" style={{ width: 'auto' }} value={responsableFilter} onChange={(e) => setResponsableFilter(e.target.value)}>
            <option value="todos">Todos los responsables</option>
            {responsableOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}

        <div style={{ flex: 1 }} />

        <span className="historial-result-count">
          {filteredProviders.length} de {providers.length} proveedores
        </span>

        <div className="historial-view-toggle">
          <button type="button" className={`mx-btn-icon ${viewMode === 'cards' ? 'historial-view-active' : ''}`} title="Vista tarjetas" onClick={() => setViewMode('cards')}>
            <LayoutGrid size={16} />
          </button>
          <button type="button" className={`mx-btn-icon ${viewMode === 'lista' ? 'historial-view-active' : ''}`} title="Vista lista" onClick={() => setViewMode('lista')}>
            <LayoutList size={16} />
          </button>
        </div>
      </div>

      {/* Chips de estado de seguimiento */}
      <div className="historial-status-chips">
        {STATUS_FILTER_OPTS.map(({ value, label }) => {
          const count = value ? (statusCounts[value] || 0) : providers.length;
          const meta  = value ? STATUS_META[value] : null;
          const isActive = statusFilter === value;
          return (
            <button key={value} type="button"
              className={`historial-status-chip ${isActive ? 'is-active' : ''}`}
              style={isActive && meta ? { borderColor: meta.color, color: meta.color, background: meta.bg } : {}}
              onClick={() => setStatusFilter(isActive ? '' : value)}
            >
              {meta && <span className="hsc-dot" style={{ background: meta.color }} />}
              {label}
              <span className="hsc-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Contenido */}
      <div className="historial-cards-body">
        {loading ? (
          <div className="mx-state-placeholder"><div className="mx-spinner" /><p>Sincronizando historial...</p></div>
        ) : filteredProviders.length === 0 ? (
          <div className="mx-state-placeholder">
            <AlertCircle size={44} />
            <h3>No hay resultados</h3>
            <p>Prueba con otro filtro o ajusta la búsqueda.</p>
          </div>
        ) : viewMode === 'lista' ? (
          /* ── Vista Lista ── */
          <div className="mx-table-card">
            <div className="mx-table-wrap">
              <table className="mx-table">
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th>Estado</th>
                    <th>Última actividad</th>
                    <th>Última gestión</th>
                    <th>Responsable</th>
                    <th style={{ textAlign: 'center' }}>Eventos</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredProviders.map((provider) => {
                    const status     = STATUS_META[provider.status || 'none'] || STATUS_META.none;
                    const StatusIcon = status.icon;
                    return (
                      <tr key={provider.key} className="historial-list-row" style={{ borderLeft: `3px solid ${status.color}` }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="hpc-avatar-sm" style={{ background: getAvatarColor(provider.name) }}>
                              {getInitials(provider.name)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{provider.name}</div>
                              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-subtle)', marginTop: 2 }}>
                                {provider.totalContactos} contacto{provider.totalContactos !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="mx-badge" style={{ color: status.color, background: status.bg }}>
                            <StatusIcon size={12} /> {status.label}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            {provider.lastActivity ? formatDate(provider.lastActivity) : '—'}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--color-text-subtle)' }}>
                            {relativeText(provider.lastActivity)}
                          </div>
                        </td>
                        <td>
                          <div className="am-line-clamp-2" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', maxWidth: 260 }}>
                            {provider.lastInteraction || '—'}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                          {provider.lastResponsable || '—'}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                          {provider.totalEventos}
                        </td>
                        <td>
                          <button type="button" className="hpc-cta-btn" onClick={() => onSelectProvider(provider.key)}>
                            Expediente <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ── Vista Cards ── */
          <div className="historial-provider-grid">
            {filteredProviders.map((provider) => {
              const status      = STATUS_META[provider.status || 'none'] || STATUS_META.none;
              const StatusIcon  = status.icon;
              const avatarColor = getAvatarColor(provider.name);
              const initials    = getInitials(provider.name);

              return (
                <button
                  key={provider.key}
                  type="button"
                  className="historial-provider-card"
                  style={{ borderLeft: `4px solid ${status.color}` }}
                  onClick={() => onSelectProvider(provider.key)}
                >
                  {/* Header */}
                  <div className="hpc-header">
                    <div className="hpc-avatar" style={{ background: avatarColor }}>
                      {initials}
                    </div>
                    <div className="hpc-name-block">
                      <h3 className="hpc-name">{provider.name}</h3>
                      <p className="hpc-meta">
                        {provider.totalEventos} eventos · {provider.totalContactos} contacto{provider.totalContactos !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="hpc-status-badge" style={{ color: status.color, background: status.bg }}>
                      <StatusIcon size={12} />
                      {status.label}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="hpc-body">
                    <p className="hpc-last-interaction am-line-clamp-2">
                      {provider.lastInteraction || 'Sin gestiones registradas'}
                    </p>
                    {provider.proximaAccion && (
                      <div className="hpc-next-action">
                        <Clock3 size={12} />
                        <span className="am-line-clamp-1">{provider.proximaAccion}</span>
                        {provider.fechaProximaAccion && (
                          <span className="hpc-next-date">{formatDate(provider.fechaProximaAccion)}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="hpc-footer">
                    <div className="hpc-footer-left">
                      <span className="hpc-contact am-line-clamp-1">
                        {provider.contactoPrincipal || 'Sin contacto'}
                      </span>
                      <span className="hpc-date">
                        {provider.lastActivity
                          ? `${formatDate(provider.lastActivity)} · ${relativeText(provider.lastActivity)}`
                          : 'Sin actividad'}
                      </span>
                    </div>
                    <span className="hpc-cta-btn">
                      Expediente <ChevronRight size={13} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function Historial() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [searchTerm,         setSearchTerm]         = useState('');
  const [selectedProviderKey,setSelectedProviderKey] = useState(() => String(searchParams.get('proveedor') || '').trim().toLowerCase());
  const [typeFilter,         setTypeFilter]         = useState('todos');
  const [historyView,        setHistoryView]        = useState(() =>
    String(searchParams.get('view') || '').toLowerCase() === 'equipo' ? 'equipo' : 'expediente'
  );
  const [teamTypeFilter, setTeamTypeFilter] = useState('todos');
  const [teamUserFilter, setTeamUserFilter] = useState('todos');

  const isExpediente = historyView === 'expediente';
  const isEquipo     = historyView === 'equipo';

  const { data: contactosRes,    isLoading: loadingContactos }    = useQuery({ queryKey: ['historial','contactos'], queryFn: () => apiClient.get('/contactos'), enabled: isExpediente, staleTime: 5*60*1000 });
  const { data: interaccionesRes,isLoading: loadingInteracciones } = useQuery({ queryKey: ['historial','interacciones',selectedProviderKey,historyView], queryFn: () => apiClient.get(selectedProviderKey && isExpediente ? `/interacciones?proveedorKey=${encodeURIComponent(selectedProviderKey)}&limit=500` : '/interacciones?limit=500'), enabled: isEquipo || isExpediente, staleTime: 3*60*1000 });
  const { data: visitasRes,      isLoading: loadingVisitas }      = useQuery({ queryKey: ['historial','visitas',selectedProviderKey,historyView], queryFn: () => apiClient.get(selectedProviderKey && isExpediente ? `/visitas?proveedorKey=${encodeURIComponent(selectedProviderKey)}` : '/visitas'), enabled: isEquipo || isExpediente, staleTime: 3*60*1000 });
  const { data: oportunidadesRes,isLoading: loadingOportunidades } = useQuery({ queryKey: ['historial','oportunidades',selectedProviderKey,historyView], queryFn: () => apiClient.get(selectedProviderKey && isExpediente ? `/oportunidades?proveedorKey=${encodeURIComponent(selectedProviderKey)}` : '/oportunidades'), enabled: isEquipo || isExpediente, staleTime: 3*60*1000 });
  const { data: muestreosRes,    isLoading: loadingMuestreos }    = useQuery({ queryKey: ['historial','muestreos',isEquipo ? 'equipo' : selectedProviderKey], queryFn: () => apiClient.get('/muestreos?limit=200&page=1'), enabled: isEquipo || (isExpediente && !!selectedProviderKey), staleTime: 5*60*1000 });

  const data = useMemo(() => {
    const extract = (res) => (Array.isArray(res) ? res : res?.items || []);
    return {
      contactos:     extract(contactosRes),
      visitas:       extract(visitasRes),
      interacciones: extract(interaccionesRes),
      oportunidades: extract(oportunidadesRes),
      muestreos:     extract(muestreosRes),
    };
  }, [contactosRes, visitasRes, interaccionesRes, oportunidadesRes, muestreosRes]);

  const loading          = loadingContactos || loadingVisitas || loadingInteracciones || loadingOportunidades || loadingMuestreos;
  const muestreosTruncated = data.muestreos.length >= 200;

  useEffect(() => {
    const requestedView = String(searchParams.get('view') || '').toLowerCase();
    setHistoryView(requestedView === 'equipo' ? 'equipo' : 'expediente');
  }, [searchParams]);

  const providers     = useMemo(() => buildProviderHistory(data), [data]);
  const teamActivity  = useMemo(() => buildTeamActivity(data), [data]);
  const teamUsers     = useMemo(() =>
    Array.from(new Set(teamActivity.map((i) => i.user).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [teamActivity]
  );

  const selectedProvider = useMemo(
    () => providers.find((p) => p.key === selectedProviderKey) || null,
    [providers, selectedProviderKey]
  );

  const INTERACTION_FAMILY = new Set(['interaccion','llamada','whatsapp','reunion']);
  const visibleEvents = useMemo(() => {
    if (!selectedProvider) return [];
    return selectedProvider.events.filter((e) => {
      if (typeFilter === 'todos') return true;
      if (typeFilter === 'interaccion') return INTERACTION_FAMILY.has(e.type);
      return e.type === typeFilter;
    });
  }, [selectedProvider, typeFilter]);

  const setHistoryViewWithUrl = (nextView) => {
    setHistoryView(nextView);
    const p = new URLSearchParams(searchParams);
    if (nextView === 'equipo') p.set('view', 'equipo'); else p.delete('view');
    setSearchParams(p, { replace: true });
  };

  const selectProvider = (key) => {
    setSelectedProviderKey(key);
    setTypeFilter('todos');
    const p = new URLSearchParams(searchParams);
    if (key) p.set('proveedor', key); else p.delete('proveedor');
    setSearchParams(p);
  };

  // ── Vista Expediente individual ────────────────────────────────────────────
  if (selectedProvider) {
    const status     = STATUS_META[selectedProvider.status || 'none'] || STATUS_META.none;
    const StatusIcon = status.icon;

    return (
      <div className="mx-page">
        <header className="mx-hero mx-hero--with-desc">
          <div className="mx-hero-content">
            <p className="mx-eyebrow">Trazabilidad · Historial</p>
            <h1>{selectedProvider.name}</h1>
          </div>
        </header>

        <div className="mx-content-frame historial-content-frame">
          <div className="historial-action-bar">
            <button type="button" className="mx-btn mx-btn-outline historial-ab-btn historial-ab-btn--back"
              onClick={() => { setSelectedProviderKey(''); setTypeFilter('todos'); const p = new URLSearchParams(searchParams); p.delete('proveedor'); setSearchParams(p, { replace: true }); }}
            >
              <ArrowLeft size={15} /> Volver
            </button>
            <div className="historial-ab-sep" />
            <button type="button" className="mx-btn mx-btn-outline historial-ab-btn"
              onClick={() => window.dispatchEvent(new CustomEvent('mitynex:quick-capture-open', { detail: { proveedorKey: selectedProvider.key, proveedorNombre: selectedProvider.name, contactoNombre: selectedProvider.contactoPrincipal || '', contactoTelefono: selectedProvider.contactoTelefono || '', contactoEmail: selectedProvider.contactoEmail || '', comuna: '', centros: 0, contactoId: '' } }))}
            >
              <MessageSquare size={14} /> Registrar gestión
            </button>
            {selectedProvider.key && (
              <button type="button" className="mx-btn mx-btn-outline historial-ab-btn"
                onClick={() => { sessionStorage.setItem('mitynex:new-trato-context', JSON.stringify({ proveedorKey: selectedProvider.key, proveedorNombre: selectedProvider.name, contactoNombre: selectedProvider.contactoPrincipal || '', contactoTelefono: selectedProvider.contactoTelefono || '', contactoEmail: selectedProvider.contactoEmail || '', comuna: '', centros: 0 })); navigate(`/biomasa/tratos?new=1&proveedor=${encodeURIComponent(selectedProvider.key)}`); }}
              >
                <FileText size={14} /> Nueva negociación
              </button>
            )}
            <button type="button" className="mx-btn mx-btn-outline historial-ab-btn"
              onClick={() => { const q = selectedProvider.name || selectedProvider.key; navigate(q ? `/gestion/proveedores?q=${encodeURIComponent(q)}` : '/gestion/proveedores'); }}
            >
              <Building2 size={14} /> Ver en Directorio
            </button>
          </div>
          <div className="mx-kpi-grid" style={{ marginTop: '16px' }}>
            <div className="mx-kpi-card">
              <div className="mx-kpi-label">Seguimiento actual</div>
              <div style={{ marginTop: '10px' }}>
                <span className="mx-badge" style={{ color: status.color, background: status.bg }}>
                  <StatusIcon size={14} /> {status.label}
                </span>
              </div>
            </div>
            <div className="mx-kpi-card">
              <div className="mx-kpi-label">Última actividad</div>
              <div className="mx-kpi-value" style={{ fontSize: '1.2rem' }}>{formatDate(selectedProvider.lastActivity)}</div>
              <div style={{ marginTop: '4px', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{relativeText(selectedProvider.lastActivity)}</div>
            </div>
            <div className="mx-kpi-card">
              <div className="mx-kpi-label">Próxima acción conocida</div>
              <div className="mx-kpi-value" style={{ fontSize: '1.2rem' }}>{selectedProvider.proximaAccion || 'Sin acción'}</div>
              <div style={{ marginTop: '4px', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                {selectedProvider.fechaProximaAccion ? formatDate(selectedProvider.fechaProximaAccion) : 'Sin fecha'}
              </div>
            </div>
            <div className="mx-kpi-card">
              <div className="mx-kpi-label">Contacto principal</div>
              <div className="mx-kpi-value" style={{ fontSize: '1.2rem' }}>{selectedProvider.contactoPrincipal || 'Sin contacto'}</div>
              <div style={{ marginTop: '4px', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                {selectedProvider.contactoTelefono || selectedProvider.contactoEmail || '—'}
              </div>
            </div>
          </div>

          <div className="mx-toolbar" style={{ marginTop: '24px' }}>
            <div className="mx-toggle-group">
              {[
                { value: 'todos',       label: 'Todos' },
                { value: 'interaccion', label: 'Gestiones' },
                { value: 'visita',      label: 'Visitas' },
                { value: 'muestreo',    label: 'Muestreos' },
                { value: 'seguimiento', label: 'Seguimiento' },
                { value: 'contacto',    label: 'Contactos' },
              ].map((opt) => (
                <button key={opt.value} type="button"
                  className={`mx-toggle-btn ${typeFilter === opt.value ? 'active' : ''}`}
                  onClick={() => setTypeFilter(opt.value)}
                >
                  <Filter size={14} /> {opt.label}
                </button>
              ))}
            </div>
          </div>

          {muestreosTruncated && (
            <div className="historial-truncated-note" style={{ marginTop: 12 }}>
              Mostrando los últimos 200 muestreos. El historial completo puede tener más registros.
            </div>
          )}

          <div style={{ maxWidth: 980, margin: '24px auto 0' }}>
            {visibleEvents.length === 0 ? (
              <div className="mx-state-placeholder">
                <AlertCircle size={42} />
                <h3>Sin eventos para este filtro</h3>
                <p>No encontramos registros pasados con ese tipo de evento.</p>
              </div>
            ) : (
              visibleEvents.map((event, index) => {
                const meta = EVENT_META[event.type] || EVENT_META.interaccion;
                const Icon = meta.icon;
                return (
                  <div key={event.id || index} style={{ display: 'flex', gap: 18, position: 'relative', marginBottom: 28 }}>
                    {index < visibleEvents.length - 1 && (
                      <div style={{ position: 'absolute', left: 18, top: 40, bottom: -28, width: 2, background: '#e2e8f0' }} />
                    )}
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: meta.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                      <Icon size={18} />
                    </div>
                    <div className="mx-table-card" style={{ flex: 1, margin: 0, padding: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ color: meta.color, fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {meta.label}
                        </span>
                        <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.84rem' }}>
                          {formatDateTime(event.date)}{event.date ? ` · ${relativeText(event.date)}` : ''}
                        </span>
                      </div>
                      <h3 style={{ margin: '10px 0 8px', fontSize: '1.05rem' }}>{event.title || 'Evento registrado'}</h3>
                      <p style={{ margin: 0, color: 'var(--color-text-muted)', lineHeight: 1.55 }}>{event.summary || 'Sin detalle adicional.'}</p>
                      {event.note && (
                        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(15,23,42,0.04)', color: 'var(--color-text)' }}>
                          {event.note}
                        </div>
                      )}
                      {(event.actor || event.extra?.length) && (
                        <div style={{ marginTop: 12, display: 'grid', gap: 4, color: 'var(--color-text-subtle)', fontSize: '0.84rem' }}>
                          {event.actor && <span>Responsable: {event.actor}</span>}
                          {event.extra?.map((line, i) => <span key={`${event.id}-x-${i}`}>{line}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Vista principal (lista de proveedores / equipo) ────────────────────────
  return (
    <div className="mx-page">
      <header className="mx-hero mx-hero--with-desc historial-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">{isEquipo ? 'Trazabilidad · Actividad del equipo' : 'Trazabilidad · Historial'}</p>
          <h1>{isEquipo ? 'Actividad del equipo' : 'Historial operativo'}</h1>
          <p>{isEquipo ? 'Trazabilidad operativa de acciones, responsables y registros recientes.' : 'Aquí revisamos lo que ya pasó. La operación pendiente vive en Resumen, Agenda y Proveedores.'}</p>
        </div>
      </header>

      <div className="mx-content-frame historial-content-frame">

        {/* Barra superior: búsqueda + tabs de vista */}
        <div className="historial-top-bar">
          <div className="historial-search-box">
            <Search size={17} color="#64748b" />
            <input
              type="text"
              placeholder={isEquipo ? 'Buscar por usuario, proveedor, centro o resultado...' : 'Buscar por proveedor, contacto o última acción...'}
              className="mx-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="mx-toggle-group">
            <button type="button" className={`mx-toggle-btn ${historyView === 'expediente' ? 'active' : ''}`} onClick={() => setHistoryViewWithUrl('expediente')}>
              <FileText size={14} /> Expediente
            </button>
            <button type="button" className={`mx-toggle-btn ${historyView === 'equipo' ? 'active' : ''}`} onClick={() => setHistoryViewWithUrl('equipo')}>
              <Users size={14} /> Actividad del equipo
            </button>
          </div>
        </div>

        {isEquipo && (
          <div className="historial-equipo-banner">
            <strong>Vista de supervisión del equipo</strong>
            <p>La jefatura revisa llamadas, visitas, muestreos, responsables y próximas acciones. <strong>Gestiones</strong> sigue existiendo como herramienta de registro; esta vista consolida el trabajo del equipo.</p>
          </div>
        )}

        {isExpediente && selectedProviderKey && !loading && !selectedProvider && (
          <div className="historial-not-found">
            <AlertCircle size={18} />
            <div>
              <p>No encontramos el proveedor solicitado.</p>
              <p>
                <button type="button" onClick={() => navigate('/gestion/proveedores')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                  Volver al Directorio
                </button>
              </p>
            </div>
          </div>
        )}

        {isExpediente ? (
          <ProviderCardsView loading={loading} providers={providers} searchTerm={searchTerm} onSelectProvider={selectProvider} />
        ) : (
          <TeamActivityView loading={loading} activities={teamActivity} searchTerm={searchTerm} teamTypeFilter={teamTypeFilter} setTeamTypeFilter={setTeamTypeFilter} teamUserFilter={teamUserFilter} setTeamUserFilter={setTeamUserFilter} teamUsers={teamUsers} muestreosTruncated={muestreosTruncated} />
        )}
      </div>
    </div>
  );
}
