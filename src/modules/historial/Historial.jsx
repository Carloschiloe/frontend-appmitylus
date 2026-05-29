import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  Filter,
  FlaskConical,
  MapPin,
  MessageSquare,
  PauseCircle,
  Phone,
  Search,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { useQuery } from '@tanstack/react-query';
import './historial.css';

const EVENT_META = {
  contacto: { label: 'Contacto', color: '#6366f1', icon: User },
  visita: { label: 'Visita', color: '#f59e0b', icon: MapPin },
  interaccion: { label: 'Gestión', color: '#06b6d4', icon: MessageSquare },
  seguimiento: { label: 'Seguimiento', color: '#0A5CFF', icon: Clock3 },
};

const TEAM_ACTIVITY_META = {
  llamada: { label: 'Llamada', color: '#2563eb', icon: Phone },
  whatsapp: { label: 'WhatsApp', color: '#16a34a', icon: MessageSquare },
  reunion: { label: 'Reunión', color: '#d97706', icon: Users },
  interaccion: { label: 'Gestión', color: '#0891b2', icon: MessageSquare },
  visita: { label: 'Visita', color: '#f59e0b', icon: MapPin },
  muestreo: { label: 'Muestreo', color: '#7c3aed', icon: FlaskConical },
  seguimiento: { label: 'Cambio de seguimiento', color: '#0A5CFF', icon: Clock3 },
};

const STATUS_META = {
  activo: { label: 'Activo', color: '#0A5CFF', bg: 'rgba(10, 92, 255, 0.12)', icon: Clock3 },
  pausado: { label: 'Pausado', color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)', icon: PauseCircle },
  cerrado: { label: 'Cerrado', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.10)', icon: XCircle },
  acordado: { label: 'Acordado', color: '#0891b2', bg: 'rgba(8, 145, 178, 0.12)', icon: CheckCircle2 },
  none: { label: 'Sin seguimiento', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', icon: Clock3 },
};

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function firstNonEmpty(...values) {
  return values.find((value) => String(value || '').trim()) || '';
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function relativeText(value) {
  const date = toDate(value);
  if (!date) return '';

  const msPerDay = 1000 * 60 * 60 * 24;
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday - startOfTarget) / msPerDay);

  if (diffDays <= 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 30) return `Hace ${diffDays} días`;
  return `Hace ${Math.floor(diffDays / 30)} meses`;
}

function normalizeTeamActivityType(value) {
  const normalized = normalizeKey(value);
  if (normalized.includes('llamad')) return 'llamada';
  if (normalized.includes('whatsapp') || normalized.includes('wasap') || normalized.includes('wsp')) return 'whatsapp';
  if (normalized.includes('reuni')) return 'reunion';
  if (normalized.includes('visit')) return 'visita';
  if (normalized.includes('muestre')) return 'muestreo';
  return normalized || 'interaccion';
}

function buildProviderHistory({ contactos = [], visitas = [], interacciones = [], oportunidades = [] }) {
  const providers = new Map();

  function ensureProvider(key, baseName) {
    if (!providers.has(key)) {
      providers.set(key, {
        key,
        name: baseName || 'Proveedor sin nombre',
        status: '',
        estadoComercial: '',
        proximaAccion: '',
        fechaProximaAccion: '',
        motivoCierre: '',
        motivoPausa: '',
        totalContactos: 0,
        totalEventos: 0,
        contactoPrincipal: '',
        contactoTelefono: '',
        contactoEmail: '',
        lastActivity: null,
        lastInteraction: '',
        lastResponsable: '',
        events: [],
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
    provider.contactoTelefono = provider.contactoTelefono || firstNonEmpty(item.contactoTelefono, item.telefono);
    provider.contactoEmail = provider.contactoEmail || firstNonEmpty(item.contactoEmail, item.email);

    provider.events.push({
      id: `contacto-${item._id || `${key}-${provider.totalContactos}`}`,
      type: 'contacto',
      date: toDate(eventDate),
      title: firstNonEmpty(item.contactoNombre, item.nombre, 'Contacto agregado'),
      summary: firstNonEmpty(item.cargo, 'Contacto incorporado al directorio'),
      note: firstNonEmpty(item.notas),
      actor: '',
      extra: [
        provider.contactoTelefono ? `Teléfono: ${provider.contactoTelefono}` : '',
        provider.contactoEmail ? `Correo: ${provider.contactoEmail}` : '',
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
      type: 'visita',
      date: toDate(item.fecha || item.createdAt || item.updatedAt),
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
    const event = {
      id: `interaccion-${item._id || `${key}-${provider.events.length}`}`,
      type: 'interaccion',
      date: toDate(item.fecha || item.createdAt || item.updatedAt),
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
    provider.status = item.seguimientoEstado || provider.status;
    provider.estadoComercial = item.estado || provider.estadoComercial;
    provider.proximaAccion = item.proximaAccion || provider.proximaAccion;
    provider.fechaProximaAccion = item.fechaProximaAccion || item.fechaRevision || provider.fechaProximaAccion;
    provider.motivoCierre = item.motivoCierre || provider.motivoCierre;
    provider.motivoPausa = item.motivoPausa || provider.motivoPausa;

    provider.events.push({
      id: `seguimiento-${item._id || `${key}-${provider.events.length}`}`,
      type: 'seguimiento',
      date: toDate(item.ultimaActividadAt || item.updatedAt || item.createdAt || item.fechaInicio),
      title: `Seguimiento ${(STATUS_META[item.seguimientoEstado || 'none']?.label || 'actualizado').toLowerCase()}`,
      summary: firstNonEmpty(
        item.proximaAccion ? `Próxima acción: ${item.proximaAccion}` : '',
        item.motivoPausa ? `Motivo de pausa: ${item.motivoPausa}` : '',
        item.motivoCierre ? `Cierre: ${item.motivoCierre}` : '',
        item.estado ? `Estado comercial: ${item.estado}` : '',
        'Sin detalle adicional.'
      ),
      note: '',
      actor: firstNonEmpty(item.responsableNombre),
      extra: [
        item.fechaProximaAccion ? `Fecha objetivo: ${formatDate(item.fechaProximaAccion)}` : '',
        item.fechaRevision ? `Revisión: ${formatDate(item.fechaRevision)}` : '',
        item.estado ? `Estado comercial: ${item.estado}` : '',
      ].filter(Boolean),
    });
  });

  return Array.from(providers.values())
    .map((provider) => {
      const sortedEvents = [...provider.events].sort((a, b) => {
        const dateA = a.date ? a.date.getTime() : 0;
        const dateB = b.date ? b.date.getTime() : 0;
        return dateB - dateA;
      });
      const lastActivity = sortedEvents[0]?.date || null;
      const lastInteractionEvent = sortedEvents.find((event) => event.type === 'interaccion') || null;

      return {
        ...provider,
        events: sortedEvents,
        totalEventos: sortedEvents.length,
        lastActivity,
        lastInteraction: provider.lastInteraction || lastInteractionEvent?.title || '',
        lastResponsable: provider.lastResponsable || lastInteractionEvent?.actor || '',
      };
    })
    .sort((a, b) => {
      const dateA = a.lastActivity ? a.lastActivity.getTime() : 0;
      const dateB = b.lastActivity ? b.lastActivity.getTime() : 0;
      return dateB - dateA;
    });
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
      nextAction: '',
      nextDate: null,
      seguimientoEstado: '',
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
        item.motivoPausa ? `Pausa: ${item.motivoPausa}` : '',
        item.motivoCierre ? `Cierre: ${item.motivoCierre}` : '',
        'Seguimiento actualizado'
      ),
      result: firstNonEmpty(item.estado, item.motivoCierre, item.motivoPausa, 'Sin resultado'),
      nextAction: firstNonEmpty(item.proximaAccion),
      nextDate: item.fechaProximaAccion || item.fechaRevision || null,
      seguimientoEstado: item.seguimientoEstado || '',
    });
  });

  return activities
    .filter((item) => item.date)
    .sort((a, b) => b.date - a.date);
}

function TeamActivityView({ loading, activities, searchTerm, teamTypeFilter, setTeamTypeFilter, teamUserFilter, setTeamUserFilter, teamUsers }) {
  const filteredActivities = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return activities.filter((item) => {
      if (teamTypeFilter !== 'todos' && item.type !== teamTypeFilter) return false;
      if (teamUserFilter !== 'todos' && item.user !== teamUserFilter) return false;
      if (!q) return true;
      return [
        item.user,
        item.provider,
        item.center,
        item.summary,
        item.result,
        item.nextAction,
      ].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [activities, searchTerm, teamTypeFilter, teamUserFilter]);

  const kpis = useMemo(() => {
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return {
      llamadas: filteredActivities.filter((item) => item.type === 'llamada').length,
      visitas: filteredActivities.filter((item) => item.type === 'visita').length,
      muestreos: filteredActivities.filter((item) => item.type === 'muestreo').length,
      gestionesHoy: filteredActivities.filter((item) => item.date >= startToday).length,
      usuariosActivos: new Set(filteredActivities.map((item) => item.user).filter(Boolean)).size,
    };
  }, [filteredActivities]);

  return (
    <>
      <div className="mx-kpi-grid historial-kpi-grid">
        {[
          { label: 'Llamadas', value: kpis.llamadas },
          { label: 'Visitas', value: kpis.visitas },
          { label: 'Muestreos', value: kpis.muestreos },
          { label: 'Gestiones del día', value: kpis.gestionesHoy },
          { label: 'Usuarios activos', value: kpis.usuariosActivos },
        ].map((stat) => (
          <div key={stat.label} className="mx-kpi-card">
            <div className="mx-kpi-label">{stat.label}</div>
            <div className="mx-kpi-value">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="mx-toolbar" style={{ marginTop: '18px' }}>
        <div className="mx-toggle-group">
          {[
            { value: 'todos', label: 'Todos' },
            { value: 'llamada', label: 'Llamadas' },
            { value: 'visita', label: 'Visitas' },
            { value: 'muestreo', label: 'Muestreos' },
            { value: 'seguimiento', label: 'Seguimiento' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              className={`mx-toggle-btn ${teamTypeFilter === option.value ? 'active' : ''}`}
              onClick={() => setTeamTypeFilter(option.value)}
            >
              <Filter size={14} /> {option.label}
            </button>
          ))}
        </div>

        <select
          className="mx-input"
          value={teamUserFilter}
          onChange={(e) => setTeamUserFilter(e.target.value)}
          style={{ maxWidth: '260px' }}
        >
          <option value="todos">Todos los usuarios</option>
          {teamUsers.map((user) => (
            <option key={user} value={user}>{user}</option>
          ))}
        </select>
      </div>

      <div className="historial-card-section">
        {loading ? (
          <div className="mx-state-placeholder">
            <div className="mx-spinner"></div>
            <p>Sincronizando actividad del equipo...</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="mx-state-placeholder">
            <AlertCircle size={44} />
            <h3>Sin actividad para este filtro</h3>
            <p>No encontramos llamadas, visitas, muestreos o cambios de seguimiento con ese criterio.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {filteredActivities.map((item) => {
              const meta = TEAM_ACTIVITY_META[item.type] || TEAM_ACTIVITY_META.interaccion;
              const Icon = meta.icon;
              const seguimiento = STATUS_META[item.seguimientoEstado || 'none'] || STATUS_META.none;
              return (
                <div key={item.id} className="mx-card" style={{ padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div className="mx-btn-icon sm" style={{ background: `${meta.color}15`, color: meta.color }}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 'var(--weight-bold)' }}>{item.user}</div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.86rem' }}>
                          {meta.label} · {formatDateTime(item.date)}
                        </div>
                      </div>
                    </div>
                    <span className="mx-badge" style={{ background: `${meta.color}15`, color: meta.color, border: 'none' }}>
                      {meta.label}
                    </span>
                  </div>

                  <div style={{ marginTop: '12px', display: 'grid', gap: '4px' }}>
                    <div style={{ fontWeight: 'var(--weight-bold)', fontSize: '1rem' }}>{item.provider}</div>
                    <div style={{ color: 'var(--color-text)' }}>{item.summary}</div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                      Resultado: {item.result || 'Sin resultado'}
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap', color: 'var(--color-text-subtle)', fontSize: '0.86rem', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
                    <span>{item.center || 'Sin centro'}</span>
                    {item.nextAction ? <span>Próxima: {item.nextAction}</span> : null}
                    {item.nextDate ? <span>{formatDate(item.nextDate)}</span> : null}
                    {item.seguimientoEstado ? (
                      <span style={{ color: seguimiento.color, fontWeight: 'var(--weight-bold)' }}>
                        {seguimiento.label}
                      </span>
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

function ProviderCardsView({ loading, providers, searchTerm, onSelectProvider }) {
  const filteredProviders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return providers.filter((provider) => {
      if (!q) return true;
      return [
        provider.name,
        provider.contactoPrincipal,
        provider.proximaAccion,
        provider.lastInteraction,
        provider.lastResponsable,
      ].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [providers, searchTerm]);

  const kpiStats = useMemo(() => {
    const MS_24H = 24 * 60 * 60 * 1000;
    const now = Date.now();
    return {
      totalEventos: providers.reduce((sum, item) => sum + item.totalEventos, 0),
      totalContactos: providers.reduce((sum, item) => sum + item.totalContactos, 0),
      ultimas24h: providers.filter((item) => item.lastActivity && (now - item.lastActivity.getTime()) <= MS_24H).length,
    };
  }, [providers]);

  return (
    <>
      <div className="mx-kpi-grid historial-kpi-grid">
        {[
          { label: 'Proveedores con historial', value: providers.length },
          { label: 'Eventos registrados',       value: kpiStats.totalEventos },
          { label: 'Contactos en directorio',   value: kpiStats.totalContactos },
          { label: 'Últimas 24h',               value: kpiStats.ultimas24h },
        ].map((stat) => (
          <div key={stat.label} className="mx-kpi-card">
            <div className="mx-kpi-label">{stat.label}</div>
            <div className="mx-kpi-value">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="am-mt-24">
        {loading ? (
          <div className="mx-state-placeholder">
            <div className="mx-spinner"></div>
            <p>Sincronizando historial...</p>
          </div>
        ) : filteredProviders.length === 0 ? (
          <div className="mx-state-placeholder">
            <AlertCircle size={44} />
            <h3>No hay resultados</h3>
            <p>Prueba con otro proveedor o ajusta la búsqueda.</p>
          </div>
        ) : (
          <div className="historial-provider-grid">
            {filteredProviders.map((provider) => {
              const status = STATUS_META[provider.status || 'none'] || STATUS_META.none;
              const StatusIcon = status.icon;
              return (
                <button
                  key={provider.key}
                  type="button"
                  className="mx-card historial-provider-card"
                  onClick={() => onSelectProvider(provider.key)}
                  style={{ textAlign: 'left', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div className="mx-btn-icon" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                      <Building2 size={20} />
                    </div>
                    <span className="mx-badge" style={{ color: status.color, background: status.bg }}>
                      <StatusIcon size={14} />
                      {status.label}
                    </span>
                  </div>

                  <h3 style={{ margin: '12px 0 5px', fontSize: '1.03rem' }}>{provider.name}</h3>
                  <p style={{ margin: 0, color: 'var(--color-text-subtle)', fontSize: '0.86rem' }}>
                    {provider.totalEventos} eventos · {provider.totalContactos} contacto{provider.totalContactos === 1 ? '' : 's'}
                  </p>

                  <div style={{ marginTop: '10px', display: 'grid', gap: '6px', color: 'var(--color-text-muted)', fontSize: '0.86rem' }}>
                    <span className="am-line-clamp-1">{provider.lastInteraction || 'Sin interacciones'}</span>
                    <span>{provider.lastActivity ? `${formatDate(provider.lastActivity)} · ${relativeText(provider.lastActivity)}` : 'Sin actividad'}</span>
                  </div>

                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--color-text-subtle)', fontSize: '0.84rem' }}>
                    <span className="am-line-clamp-1">{provider.contactoPrincipal || 'Sin contacto'}</span>
                    <span style={{ color: 'var(--color-primary)', fontWeight: 'var(--weight-bold)' }}>Expediente</span>
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

export default function Historial() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Filtros de UI
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProviderKey, setSelectedProviderKey] = useState('');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [historyView, setHistoryView] = useState(() => (
    String(searchParams.get('view') || '').toLowerCase() === 'equipo' ? 'equipo' : 'expediente'
  ));
  const [teamTypeFilter, setTeamTypeFilter] = useState('todos');
  const [teamUserFilter, setTeamUserFilter] = useState('todos');

  // React Query: Carga Granular e Independiente
  const isExpediente = historyView === 'expediente';
  const isEquipo = historyView === 'equipo';

  // 1. Contactos (Base para Expediente)
  const { data: contactosRes, isLoading: loadingContactos } = useQuery({
    queryKey: ['historial', 'contactos'],
    queryFn: () => apiClient.get('/contactos'),
    enabled: isExpediente,
    staleTime: 5 * 60 * 1000,
  });

  // 2. Interacciones
  const { data: interaccionesRes, isLoading: loadingInteracciones } = useQuery({
    queryKey: ['historial', 'interacciones', selectedProviderKey, historyView],
    queryFn: () => {
      let url = '/interacciones?limit=500';
      if (selectedProviderKey && isExpediente) {
        url = `/interacciones?proveedorKey=${encodeURIComponent(selectedProviderKey)}&limit=500`;
      }
      return apiClient.get(url);
    },
    enabled: isEquipo || isExpediente,
    staleTime: 3 * 60 * 1000,
  });

  // 3. Visitas
  const { data: visitasRes, isLoading: loadingVisitas } = useQuery({
    queryKey: ['historial', 'visitas', selectedProviderKey, historyView],
    queryFn: () => {
      let url = '/visitas';
      if (selectedProviderKey && isExpediente) {
        url = `/visitas?proveedorKey=${encodeURIComponent(selectedProviderKey)}`;
      }
      return apiClient.get(url);
    },
    enabled: isEquipo || isExpediente,
    staleTime: 3 * 60 * 1000,
  });

  // 4. Oportunidades
  const { data: oportunidadesRes, isLoading: loadingOportunidades } = useQuery({
    queryKey: ['historial', 'oportunidades', selectedProviderKey, historyView],
    queryFn: () => {
      let url = '/oportunidades';
      if (selectedProviderKey && isExpediente) {
        url = `/oportunidades?proveedorKey=${encodeURIComponent(selectedProviderKey)}`;
      }
      return apiClient.get(url);
    },
    enabled: isEquipo || isExpediente,
    staleTime: 3 * 60 * 1000,
  });

  // 5. Muestreos (Solo para vista de equipo)
  const { data: muestreosRes, isLoading: loadingMuestreos } = useQuery({
    queryKey: ['historial', 'muestreos'],
    queryFn: () => apiClient.get('/muestreos?limit=200&page=1'),
    enabled: isEquipo,
    staleTime: 5 * 60 * 1000,
  });

  // Normalización de datos para los procesos de construcción
  const data = useMemo(() => {
    const extractItems = (res) => (Array.isArray(res) ? res : res?.items || []);
    return {
      contactos: extractItems(contactosRes),
      visitas: extractItems(visitasRes),
      interacciones: extractItems(interaccionesRes),
      oportunidades: extractItems(oportunidadesRes),
      muestreos: extractItems(muestreosRes),
    };
  }, [contactosRes, visitasRes, interaccionesRes, oportunidadesRes, muestreosRes]);

  const loading = loadingContactos || loadingVisitas || loadingInteracciones || loadingOportunidades || loadingMuestreos;

  useEffect(() => {
    const requestedView = String(searchParams.get('view') || '').toLowerCase();
    setHistoryView(requestedView === 'equipo' ? 'equipo' : 'expediente');
  }, [searchParams]);

  const providers = useMemo(() => buildProviderHistory(data), [data]);
  const teamActivity = useMemo(() => buildTeamActivity(data), [data]);
  const teamUsers = useMemo(
    () => Array.from(new Set(teamActivity.map((item) => item.user).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [teamActivity]
  );

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.key === selectedProviderKey) || null,
    [providers, selectedProviderKey]
  );

  const visibleEvents = useMemo(() => {
    if (!selectedProvider) return [];
    return selectedProvider.events.filter((event) => typeFilter === 'todos' || event.type === typeFilter);
  }, [selectedProvider, typeFilter]);

  const setHistoryViewWithUrl = (nextView) => {
    setHistoryView(nextView);
    const nextParams = new URLSearchParams(searchParams);
    if (nextView === 'equipo') nextParams.set('view', 'equipo');
    else nextParams.delete('view');
    setSearchParams(nextParams, { replace: true });
  };

  if (selectedProvider) {
    const status = STATUS_META[selectedProvider.status || 'none'] || STATUS_META.none;
    const StatusIcon = status.icon;

    return (
      <div className="mx-page">
        <header className="mx-hero">
          <div className="mx-hero-content">
            <p className="mx-eyebrow">Inteligencia - Historial</p>
            <h1>{selectedProvider.name}</h1>
            <p>
              Aquí vive solo lo que ya pasó: interacciones, visitas, contactos y cambios de seguimiento.
            </p>
          </div>
          <button
            type="button"
            className="mx-btn mx-btn-outline"
            style={{
              color: '#ffffff',
              background: 'rgba(255,255,255,0.14)',
              borderColor: 'rgba(255,255,255,0.28)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 800,
              boxShadow: 'none',
            }}
            onClick={() => {
              setSelectedProviderKey('');
              setTypeFilter('todos');
            }}
          >
            <ArrowLeft size={18} /> Volver
          </button>
        </header>

        <div className="mx-content-frame">
          <div className="mx-kpi-grid" style={{ marginTop: '16px' }}>
            <div className="mx-kpi-card">
              <div className="mx-kpi-label">Seguimiento actual</div>
              <div style={{ marginTop: '10px' }}>
                <span className="mx-badge" style={{ color: status.color, background: status.bg }}>
                  <StatusIcon size={14} />
                  {status.label}
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
                { value: 'todos', label: 'Todos' },
                { value: 'interaccion', label: 'Gestiones' },
                { value: 'visita', label: 'Visitas' },
                { value: 'seguimiento', label: 'Seguimiento' },
                { value: 'contacto', label: 'Contactos' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`mx-toggle-btn ${typeFilter === option.value ? 'active' : ''}`}
                  onClick={() => setTypeFilter(option.value)}
                >
                  <Filter size={14} /> {option.label}
                </button>
              ))}
            </div>
          </div>

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
                    {index < visibleEvents.length - 1 ? (
                      <div style={{ position: 'absolute', left: 18, top: 40, bottom: -28, width: 2, background: '#e2e8f0' }} />
                    ) : null}

                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        background: meta.color,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        zIndex: 1,
                      }}
                    >
                      <Icon size={18} />
                    </div>

                    <div className="mx-table-card" style={{ flex: 1, margin: 0, padding: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ color: meta.color, fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {meta.label}
                        </span>
                        <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.84rem' }}>
                          {formatDateTime(event.date)} {event.date ? `· ${relativeText(event.date)}` : ''}
                        </span>
                      </div>

                      <h3 style={{ margin: '10px 0 8px', fontSize: '1.05rem' }}>{event.title || 'Evento registrado'}</h3>
                      <p style={{ margin: 0, color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                        {event.summary || 'Sin detalle adicional.'}
                      </p>

                      {event.note ? (
                        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(15, 23, 42, 0.04)', color: 'var(--color-text)' }}>
                          {event.note}
                        </div>
                      ) : null}

                      {(event.actor || event.extra?.length) ? (
                        <div style={{ marginTop: 12, display: 'grid', gap: 4, color: 'var(--color-text-subtle)', fontSize: '0.84rem' }}>
                          {event.actor ? <span>Responsable: {event.actor}</span> : null}
                          {event.extra?.map((line, lineIndex) => (
                            <span key={`${event.id}-extra-${lineIndex}`}>{line}</span>
                          ))}
                        </div>
                      ) : null}
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

  return (
    <div className="mx-page">
      <header className="mx-hero historial-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">{historyView === 'equipo' ? 'Inteligencia - Actividad del equipo' : 'Inteligencia - Historial'}</p>
          <h1>{historyView === 'equipo' ? 'Actividad del equipo' : 'Historial operativo'}</h1>
          <p>{historyView === 'equipo' ? 'Trazabilidad operativa de acciones, responsables y registros recientes.' : 'Aqui revisamos lo que ya paso. La operacion pendiente vive en Resumen, Agenda y Proveedores.'}</p>
        </div>
      </header>

      <div className="mx-content-frame historial-content-frame">
        <div className="historial-search-row">
          <div
            className="mx-input-group"
            style={{
              flex: 1,
              width: '100%',
              background: '#ffffff',
              border: '1px solid #d7e3f1',
              borderRadius: 12,
              padding: '0 12px',
              boxShadow: '0 6px 14px rgba(15, 23, 42, 0.05)',
            }}
          >
            <Search size={18} color="#64748b" />
            <input
              type="text"
              placeholder={historyView === 'equipo' ? 'Buscar por usuario, proveedor, centro o resultado...' : 'Buscar por proveedor, contacto o última acción...'}
              className="mx-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                boxShadow: 'none',
                padding: 0,
                color: '#0f172a',
              }}
            />
          </div>
        </div>

        <div className="centros-filters historial-view-switch">
          <div className="mx-toggle-group">
            <button
              type="button"
              className={`mx-toggle-btn ${historyView === 'expediente' ? 'active' : ''}`}
              onClick={() => setHistoryViewWithUrl('expediente')}
            >
              <Building2 size={14} /> Expediente
            </button>
            <button
              type="button"
              className={`mx-toggle-btn ${historyView === 'equipo' ? 'active' : ''}`}
              onClick={() => setHistoryViewWithUrl('equipo')}
            >
              <User size={14} /> Actividad del equipo
            </button>
          </div>
        </div>

        {historyView === 'equipo' ? (
          <div
            className="mx-table-card"
            style={{
              marginTop: 8,
              padding: 12,
              border: '1px solid #d7e3f1',
              background: 'linear-gradient(135deg, rgba(37,99,235,0.05), rgba(15,118,110,0.04))',
            }}
          >
            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.96rem' }}>Vista de supervisión del equipo</div>
            <p style={{ margin: '6px 0 0', color: '#64748b', lineHeight: 1.5, fontSize: '0.88rem' }}>
              Aquí la jefatura revisa llamadas, visitas, muestreos, responsables y próximas acciones del equipo de
              abastecimiento. <strong style={{ color: '#0f172a' }}>Gestiones</strong> sigue existiendo como herramienta de
              registro operativo, pero la lectura consolidada del trabajo del equipo vive en esta vista.
            </p>
          </div>
        ) : null}

        {historyView === 'expediente' ? (
          <ProviderCardsView
            loading={loading}
            providers={providers}
            searchTerm={searchTerm}
            onSelectProvider={setSelectedProviderKey}
          />
        ) : (
          <TeamActivityView
            loading={loading}
            activities={teamActivity}
            searchTerm={searchTerm}
            teamTypeFilter={teamTypeFilter}
            setTeamTypeFilter={setTeamTypeFilter}
            teamUserFilter={teamUserFilter}
            setTeamUserFilter={setTeamUserFilter}
            teamUsers={teamUsers}
          />
        )}
      </div>
    </div>
  );
}
