import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  XCircle,
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { useToast } from '../../context/ToastContext';

const EVENT_META = {
  contacto: { label: 'Contacto', color: '#6366f1', icon: User },
  visita: { label: 'Visita', color: '#f59e0b', icon: MapPin },
  interaccion: { label: 'Interacción', color: '#06b6d4', icon: MessageSquare },
  seguimiento: { label: 'Seguimiento', color: '#0f766e', icon: Clock3 },
};

const TEAM_ACTIVITY_META = {
  llamada: { label: 'Llamada', color: '#2563eb', icon: Phone },
  whatsapp: { label: 'WhatsApp', color: '#16a34a', icon: MessageSquare },
  interaccion: { label: 'Interacción', color: '#0891b2', icon: MessageSquare },
  visita: { label: 'Visita', color: '#f59e0b', icon: MapPin },
  muestreo: { label: 'Muestreo', color: '#7c3aed', icon: FlaskConical },
  seguimiento: { label: 'Cambio de seguimiento', color: '#0f766e', icon: Clock3 },
};

const STATUS_META = {
  activo: { label: 'Activo', color: '#0f766e', bg: 'rgba(13, 148, 136, 0.12)', icon: Clock3 },
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
      title: firstNonEmpty(item.resumen, item.tipo, 'Interacción registrada'),
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
      summary: firstNonEmpty(item.resumen, item.tipo, 'Interacción registrada'),
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
        {[
          { label: 'Llamadas', value: kpis.llamadas },
          { label: 'Visitas', value: kpis.visitas },
          { label: 'Muestreos', value: kpis.muestreos },
          { label: 'Gestiones del día', value: kpis.gestionesHoy },
          { label: 'Usuarios activos', value: kpis.usuariosActivos },
        ].map((stat) => (
          <div key={stat.label} className="mx-table-card" style={{ padding: 16 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-subtle)', textTransform: 'uppercase' }}>
              {stat.label}
            </div>
            <div style={{ marginTop: 10, fontSize: '1.7rem', fontWeight: 800 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="centros-filters" style={{ marginTop: 18 }}>
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
          style={{ maxWidth: 260, marginLeft: 'auto' }}
        >
          <option value="todos">Todos los usuarios</option>
          {teamUsers.map((user) => (
            <option key={user} value={user}>{user}</option>
          ))}
        </select>
      </div>

      <div className="am-mt-24">
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
                <div key={item.id} className="mx-table-card" style={{ padding: 18, display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: `${meta.color}15`, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{item.user}</div>
                        <div style={{ color: '#64748b', fontSize: '0.86rem' }}>
                          {meta.label} · {formatDateTime(item.date)}
                        </div>
                      </div>
                    </div>
                    <span className="mx-badge" style={{ background: `${meta.color}15`, color: meta.color, border: 'none' }}>
                      {meta.label}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>{item.provider}</div>
                    <div style={{ color: '#475569' }}>{item.summary}</div>
                    <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                      Resultado: {item.result || 'Sin resultado'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', color: '#64748b', fontSize: '0.86rem' }}>
                    <span>{item.center || 'Sin centro asociado'}</span>
                    {item.nextAction ? <span>Próxima acción: {item.nextAction}</span> : null}
                    {item.nextDate ? <span>Fecha próxima: {formatDate(item.nextDate)}</span> : null}
                    {item.seguimientoEstado ? (
                      <span style={{ color: seguimiento.color, fontWeight: 700 }}>
                        Seguimiento: {seguimiento.label}
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

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
        {[
          { label: 'Proveedores con historial', value: providers.length },
          { label: 'Eventos registrados', value: providers.reduce((sum, item) => sum + item.totalEventos, 0) },
          { label: 'Contactos en directorio', value: providers.reduce((sum, item) => sum + item.totalContactos, 0) },
          { label: 'Últimas 24h', value: providers.filter((item) => item.lastActivity && (Date.now() - item.lastActivity.getTime()) <= 24 * 60 * 60 * 1000).length },
        ].map((stat) => (
          <div key={stat.label} className="mx-table-card" style={{ padding: 16 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-subtle)', textTransform: 'uppercase' }}>
              {stat.label}
            </div>
            <div style={{ marginTop: 10, fontSize: '1.7rem', fontWeight: 800 }}>{stat.value}</div>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
            {filteredProviders.map((provider) => {
              const status = STATUS_META[provider.status || 'none'] || STATUS_META.none;
              const StatusIcon = status.icon;
              return (
                <button
                  key={provider.key}
                  type="button"
                  className="mx-table-card"
                  onClick={() => onSelectProvider(provider.key)}
                  style={{ textAlign: 'left', padding: 20, border: '1px solid var(--color-border)', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: 'rgba(8, 145, 178, 0.10)',
                        color: '#0f766e',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Building2 size={20} />
                    </div>

                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 800, color: status.color, background: status.bg }}>
                      <StatusIcon size={14} />
                      {status.label}
                    </span>
                  </div>

                  <h3 style={{ margin: '16px 0 6px', fontSize: '1.08rem' }}>{provider.name}</h3>
                  <p style={{ margin: 0, color: 'var(--color-text-subtle)', fontSize: '0.86rem' }}>
                    {provider.totalEventos} eventos · {provider.totalContactos} contacto{provider.totalContactos === 1 ? '' : 's'}
                  </p>

                  <div style={{ marginTop: 14, display: 'grid', gap: 8, color: 'var(--color-text-muted)', fontSize: '0.86rem' }}>
                    <span>{provider.lastInteraction || 'Sin interacciones registradas'}</span>
                    <span>{provider.lastActivity ? `${formatDate(provider.lastActivity)} · ${relativeText(provider.lastActivity)}` : 'Sin actividad reciente'}</span>
                    <span>{provider.proximaAccion ? `Última acción pendiente: ${provider.proximaAccion}` : 'Sin acción pendiente en seguimiento'}</span>
                  </div>

                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #eef2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--color-text-subtle)', fontSize: '0.84rem' }}>
                    <span>{provider.contactoPrincipal || 'Sin contacto principal'}</span>
                    <span>Ver expediente</span>
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
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ contactos: [], visitas: [], interacciones: [], oportunidades: [], muestreos: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProviderKey, setSelectedProviderKey] = useState('');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [historyView, setHistoryView] = useState(() => (
    String(searchParams.get('view') || '').toLowerCase() === 'equipo' ? 'equipo' : 'expediente'
  ));
  const [teamTypeFilter, setTeamTypeFilter] = useState('todos');
  const [teamUserFilter, setTeamUserFilter] = useState('todos');

  const loadAllData = useCallback(async (signal) => {
    setLoading(true);
    try {
      const [contactosRes, visitasRes, interaccionesRes, oportunidadesRes, muestreosRes] = await Promise.all([
        apiClient.get('/contactos', { signal }),
        apiClient.get('/visitas', { signal }),
        apiClient.get('/interacciones?limit=500', { signal }),
        apiClient.get('/oportunidades', { signal }),
        apiClient.get('/muestreos?limit=200&page=1', { signal }),
      ]);

      setData({
        contactos: Array.isArray(contactosRes) ? contactosRes : (contactosRes.items || []),
        visitas: Array.isArray(visitasRes) ? visitasRes : (visitasRes.items || []),
        interacciones: Array.isArray(interaccionesRes) ? interaccionesRes : (interaccionesRes.items || []),
        oportunidades: Array.isArray(oportunidadesRes) ? oportunidadesRes : (oportunidadesRes.items || []),
        muestreos: Array.isArray(muestreosRes) ? muestreosRes : (muestreosRes.items || []),
      });
    } catch (err) {
      if (err.name === 'AbortError') return;
      addToast({ title: 'Error', message: 'No se pudo cargar el historial.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    const controller = new AbortController();
    loadAllData(controller.signal);
    return () => controller.abort();
  }, [loadAllData]);

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
            <p className="mx-eyebrow">Historial · Expediente</p>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
            <div className="mx-table-card" style={{ padding: 16 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-subtle)', textTransform: 'uppercase' }}>
                Seguimiento actual
              </div>
              <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, color: status.color, background: status.bg, fontWeight: 800 }}>
                <StatusIcon size={14} />
                {status.label}
              </div>
            </div>

            <div className="mx-table-card" style={{ padding: 16 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-subtle)', textTransform: 'uppercase' }}>
                Última actividad
              </div>
              <div style={{ marginTop: 10, fontSize: '1rem', fontWeight: 700 }}>{formatDate(selectedProvider.lastActivity)}</div>
              <div style={{ marginTop: 4, color: 'var(--color-text-subtle)', fontSize: '0.85rem' }}>{relativeText(selectedProvider.lastActivity)}</div>
            </div>

            <div className="mx-table-card" style={{ padding: 16 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-subtle)', textTransform: 'uppercase' }}>
                Próxima acción conocida
              </div>
              <div style={{ marginTop: 10, fontSize: '1rem', fontWeight: 700 }}>{selectedProvider.proximaAccion || 'Sin acción pendiente'}</div>
              <div style={{ marginTop: 4, color: 'var(--color-text-subtle)', fontSize: '0.85rem' }}>
                {selectedProvider.fechaProximaAccion ? formatDate(selectedProvider.fechaProximaAccion) : 'Sin fecha programada'}
              </div>
            </div>

            <div className="mx-table-card" style={{ padding: 16 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-subtle)', textTransform: 'uppercase' }}>
                Contacto principal
              </div>
              <div style={{ marginTop: 10, fontSize: '1rem', fontWeight: 700 }}>{selectedProvider.contactoPrincipal || 'Sin contacto principal'}</div>
              <div style={{ marginTop: 4, color: 'var(--color-text-subtle)', fontSize: '0.85rem' }}>
                {selectedProvider.contactoTelefono || selectedProvider.contactoEmail || 'Sin datos de contacto'}
              </div>
            </div>
          </div>

          <div className="centros-filters" style={{ marginTop: 24 }}>
            <div className="mx-toggle-group">
              {[
                { value: 'todos', label: 'Todos' },
                { value: 'interaccion', label: 'Interacciones' },
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
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Gestión · Historial</p>
          <h1>Historial operativo</h1>
          <p>
            Aquí revisamos lo que ya pasó. La operación pendiente vive en Resumen, Agenda y Proveedores.
          </p>
        </div>
      </header>

      <div className="mx-content-frame">
        <div style={{ marginTop: 24, display: 'flex' }}>
          <div
            className="mx-input-group"
            style={{
              flex: 1,
              maxWidth: 560,
              background: '#ffffff',
              border: '1px solid #d7e3f1',
              borderRadius: 16,
              padding: '0 14px',
              boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
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
                paddingLeft: 8,
                color: '#0f172a',
              }}
            />
          </div>
        </div>

        <div className="centros-filters" style={{ marginTop: 18 }}>
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
              marginTop: 16,
              padding: 16,
              border: '1px solid #d7e3f1',
              background: 'linear-gradient(135deg, rgba(37,99,235,0.05), rgba(15,118,110,0.04))',
            }}
          >
            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.96rem' }}>Vista de supervisión del equipo</div>
            <p style={{ margin: '6px 0 0', color: '#64748b', lineHeight: 1.5, fontSize: '0.88rem' }}>
              Aquí la jefatura revisa llamadas, visitas, muestreos, responsables y próximas acciones del equipo de
              abastecimiento. <strong style={{ color: '#0f172a' }}>Interacciones</strong> sigue existiendo como herramienta de
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
