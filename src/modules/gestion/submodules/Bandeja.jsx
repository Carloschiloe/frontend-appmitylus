import React, { useCallback, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  MessageSquare,
  RotateCcw,
  Target,
  PauseCircle,
  AlertCircle,
  Clock,
  Activity,
  Phone,
  MapPin,
  Users,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  useGestionSummary, 
  useOportunidades, 
  useInteracciones, 
  useVisitas, 
  useMuestreos 
} from '../hooks/useGestionQueries';
import './bandeja.css';

const PIPELINE_ORDER = [
  { key: 'prospecto', label: 'Prospectos' },
  { key: 'negociando', label: 'Negociando' },
  { key: 'acordado', label: 'Acordados' },
  { key: 'compra_efectuada', label: 'Compras' },
  { key: 'caido', label: 'Caídos' },
];

const FOLLOWUP_META = {
  activo: { label: 'Seguimiento activo', icon: Target, tone: 'primary' },
  pausado: { label: 'Pausado', icon: PauseCircle, tone: 'warning' },
};

const PAUSE_REASON_LABELS = {
  esperando_crecimiento: 'Esperando crecimiento',
  esperando_disponibilidad: 'Esperando disponibilidad',
  esperando_respuesta: 'Esperando respuesta',
  esperando_resultado_muestra: 'Esperando resultado de muestra',
  esperando_decision_interna: 'Esperando decisión interna',
};

const EVENT_META = {
  interaccion: { label: 'Interacción', tone: 'info' },
  llamada: { label: 'Llamada', tone: 'info' },
  reunion: { label: 'Reunión', tone: 'warning' },
  visita: { label: 'Visita', tone: 'primary' },
  muestreo: { label: 'Muestreo', tone: 'success' },
  seguimiento: { label: 'Seguimiento', tone: 'primary' },
};

function toList(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || payload?.data || [];
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date = new Date()) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + 1);
  return next;
}

function formatShortDate(value) {
  const date = toDate(value);
  if (!date) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function formatLongDate(value) {
  const date = toDate(value);
  if (!date) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CL', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function formatTons(value) {
  return `${Number(value || 0).toLocaleString('es-CL', { maximumFractionDigits: 1 })} t`;
}

function formatDayOfWeek(date) {
  return new Intl.DateTimeFormat('es-CL', { weekday: 'short' }).format(date);
}

const ACTIVITY_ICONS = {
  llamada: Phone,
  visita: MapPin,
  reunion: Users,
  muestreo: Target,
  interaccion: MessageSquare,
  seguimiento: Target,
};

function dueText(value) {
  const date = toDate(value);
  if (!date) return 'Sin fecha';

  const today = startOfDay();
  const due = startOfDay(date);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return `Vencido hace ${Math.abs(diffDays)} d`;
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Mañana';
  return `En ${diffDays} días`;
}

function getPauseReasonLabel(value) {
  return PAUSE_REASON_LABELS[value] || 'En espera';
}

export default function Bandeja() {
  const queryClient = useQueryClient();

  // 1. Carga de datos con React Query
  // El uso de hooks permite que cada recurso se gestione de forma independiente
  const { isLoading: loadingSummary } = useGestionSummary();
  const { data: oportunidadesData, isLoading: loadingOpp } = useOportunidades({ limit: 200 });
  const { data: interaccionesData, isLoading: loadingInt } = useInteracciones({ limit: 200 });
  const { data: visitasData, isLoading: loadingVis } = useVisitas();
  const { data: muestreosRes, isLoading: loadingMue } = useMuestreos({ limit: 50, page: 1 });

  // Estabilización de datos para los memos
  const oportunidades = useMemo(() => toList(oportunidadesData), [oportunidadesData]);
  const interacciones = useMemo(() => toList(interaccionesData), [interaccionesData]);
  const visitas = useMemo(() => toList(visitasData), [visitasData]);
  const muestreos = useMemo(() => toList(muestreosRes), [muestreosRes]);

  const loading = loadingSummary || loadingOpp || loadingInt || loadingVis || loadingMue;

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['gestion-summary'] });
    queryClient.invalidateQueries({ queryKey: ['oportunidades'] });
    queryClient.invalidateQueries({ queryKey: ['interacciones'] });
    queryClient.invalidateQueries({ queryKey: ['visitas'] });
    queryClient.invalidateQueries({ queryKey: ['muestreos'] });
  }, [queryClient]);

  useEffect(() => {
    window.addEventListener('gestion:quick-capture-saved', handleRefresh);
    return () => window.removeEventListener('gestion:quick-capture-saved', handleRefresh);
  }, [handleRefresh]);

  const seguimiento = useMemo(() => {
    const active = [];
    const paused = [];
    const closed = [];
    const agreed = [];

    oportunidades.forEach((item) => {
      const estado = item.seguimientoEstado || 'activo';
      if (estado === 'activo') active.push(item);
      else if (estado === 'pausado') paused.push(item);
      else if (estado === 'cerrado') closed.push(item);
      else if (estado === 'acordado') agreed.push(item);
    });

    return { active, paused, closed, agreed };
  }, [oportunidades]);

  const taskBoard = useMemo(() => {
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const nextWeek = new Date(todayEnd);
    nextWeek.setDate(nextWeek.getDate() + 6);

    const tasks = oportunidades
      .filter((item) => item.seguimientoEstado === 'activo' || item.seguimientoEstado === 'pausado')
      .map((item) => {
        const source = item.seguimientoEstado === 'pausado' ? 'pausado' : 'activo';
        const dueAt = item.fechaProximaAccion || item.fechaRevision || item.nextActionAt || null;
        const dueDate = toDate(dueAt);
        let bucket = 'nodate';

        if (dueDate) {
          if (dueDate < todayStart) bucket = 'overdue';
          else if (dueDate >= todayStart && dueDate < todayEnd) bucket = 'today';
          else if (dueDate < nextWeek) bucket = 'next';
          else bucket = 'later';
        }

        return {
          id: `opp-${item._id}`,
          source,
          provider: item.proveedorNombre || 'Proveedor sin nombre',
          title: item.proximaAccion || (source === 'pausado' ? 'Revisar caso pausado' : 'Definir próximo paso'),
          subtitle: source === 'pausado'
            ? getPauseReasonLabel(item.motivoPausa)
            : (item.notasTrato || 'Seguimiento pendiente'),
          dueAt,
          dueDate,
          bucket,
          owner: item.responsableNombre || 'Sin responsable',
          estadoComercial: item.estado || '',
        };
      });

    const sortByDueDate = (left, right) => {
      if (!left.dueDate && !right.dueDate) return left.provider.localeCompare(right.provider);
      if (!left.dueDate) return 1;
      if (!right.dueDate) return -1;
      return left.dueDate - right.dueDate;
    };

    const overdue = tasks.filter((task) => task.bucket === 'overdue').sort(sortByDueDate);
    const today = tasks.filter((task) => task.bucket === 'today').sort(sortByDueDate);
    const next = tasks.filter((task) => task.bucket === 'next').sort(sortByDueDate);
    const later = tasks.filter((task) => task.bucket === 'later').sort(sortByDueDate);

    return {
      all: tasks,
      overdue,
      today,
      next,
      later,
      spotlight: [...overdue, ...today, ...next].slice(0, 7),
    };
  }, [oportunidades]);

  const pipeline = useMemo(() => {
    const counts = PIPELINE_ORDER.map((item) => ({
      ...item,
      count: oportunidades.filter((oportunidad) => oportunidad.estado === item.key).length,
    }));
    const max = Math.max(...counts.map((item) => item.count), 1);
    return { counts, max };
  }, [oportunidades]);

  const upcomingDeals = useMemo(() => {
    const today = startOfDay();
    return oportunidades
      .map((item) => ({
        ...item,
        closeDate: toDate(item.vigenciaDesde || item.vigenciaHasta || item.fechaCierre),
      }))
      .filter((item) => item.closeDate && item.closeDate >= today)
      .sort((left, right) => left.closeDate - right.closeDate)
      .slice(0, 5);
  }, [oportunidades]);

  const activityFeed = useMemo(() => {
    return [
      ...interacciones.map((item) => ({
        id: `a-int-${item._id}`,
        kind: item.tipo || 'interaccion',
        provider: item.proveedorNombre || item.contactoNombre || 'Proveedor sin nombre',
        title: item.resumen || 'Interacción registrada',
        date: item.updatedAt || item.createdAt || item.fecha,
        caption: item.proximoPaso || item.resultado || item.responsablePG || 'Sin detalle',
      })),
      ...visitas.map((item) => ({
        id: `a-vis-${item._id}`,
        kind: 'visita',
        provider: item.proveedorNombre || item.contacto || 'Proveedor sin nombre',
        title: item.estado || 'Visita registrada',
        date: item.updatedAt || item.createdAt || item.fecha,
        caption: item.observaciones || item.centroCodigo || item.responsablePG || 'Sin detalle',
      })),
    ]
      .map((item) => ({ ...item, parsedDate: toDate(item.date) }))
      .filter((item) => item.parsedDate)
      .sort((left, right) => right.parsedDate - left.parsedDate)
      .slice(0, 6);
  }, [interacciones, visitas]);

  const agendaByDay = useMemo(() => {
    const today = startOfDay();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      return {
        key: date.toISOString().slice(0, 10),
        date,
        items: [],
      };
    });

    const buckets = new Map(days.map((day) => [day.key, day]));

    taskBoard.all.forEach((item) => {
      const date = toDate(item.dueAt);
      if (!date) return;
      const key = date.toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) return;
      bucket.items.push({
        kind: 'seguimiento',
        proveedorNombre: item.provider,
        title: item.title,
        source: item.source,
        date,
      });
    });

    days.forEach((day) => {
      day.items.sort((left, right) => new Date(left.date) - new Date(right.date));
    });

    return days;
  }, [taskBoard]);

  const recentSamples = useMemo(() => {
    return [...muestreos]
      .map((item) => ({
        ...item,
        sampleDate: toDate(item.fecha),
        mainClass: item.clasificaciones?.[0]?.nombre || 'Sin clasificación',
      }))
      .filter((item) => item.sampleDate)
      .sort((left, right) => right.sampleDate - left.sampleDate)
      .slice(0, 5);
  }, [muestreos]);

  const priorityItems = taskBoard.spotlight.slice(0, 5);
  const compactActivityFeed = activityFeed.slice(0, 3);
  const compactDeals = upcomingDeals.slice(0, 3);

  if (loading) {
    return (
      <div className="mx-state-placeholder">
        <div className="mx-spinner"></div>
        <p>Construyendo panel de gestión...</p>
      </div>
    );
  }

  return (
    <div className="gs-summary-dashboard">

      {/* â”€â”€ Zone 1: Status strip â”€â”€ */}
      <div className="gs-status-strip">
        {[
          { label: 'Vencidos', value: taskBoard.overdue.length, Icon: AlertCircle, tone: 'danger' },
          { label: 'Para hoy', value: taskBoard.today.length, Icon: Clock, tone: 'info' },
          { label: 'En seguimiento', value: seguimiento.active.length, Icon: Activity, tone: 'success' },
          { label: 'Pausados', value: seguimiento.paused.length, Icon: PauseCircle, tone: 'warning' },
        ].map(({ label, value, Icon, tone }) => (
          <div key={label} className={`gs-status-item is-${tone}`}>
            <Icon size={16} className="gs-status-icon" />
            <span className="gs-status-num">{value}</span>
            <span className="gs-status-label">{label}</span>
          </div>
        ))}
        <button className="gs-status-refresh mx-btn-icon" onClick={handleRefresh} title="Actualizar">
          <RotateCcw size={15} />
        </button>
      </div>

      {/* â”€â”€ Zone 2+3: Main grid â”€â”€ */}
      <div className="gs-main-grid">

        {/* â”€â”€ LEFT: Atención requerida â”€â”€ */}
        <section className="gs-attention-panel">
          <div className="gs-panel-header">
            <div>
              <span className="mx-eyebrow">Operaciones</span>
              <h3 className="gs-panel-title">Atención requerida</h3>
            </div>
            <div className="gs-panel-header-right">
              {taskBoard.overdue.length > 0 && <span className="mx-badge mx-badge-danger">{taskBoard.overdue.length} vencido{taskBoard.overdue.length !== 1 ? 's' : ''}</span>}
              {taskBoard.today.length > 0 && <span className="mx-badge mx-badge-warning">{taskBoard.today.length} hoy</span>}
              {taskBoard.next.length > 0 && <span className="mx-badge mx-badge-muted">{taskBoard.next.length} semana</span>}
              <Link className="mx-btn-icon sm" to="/gestion/agenda"><ChevronRight size={16} /></Link>
            </div>
          </div>

          <div className="gs-action-feed">
            {priorityItems.length === 0 ? (
              <div className="gs-feed-empty">
                <Activity size={20} />
                <span>Sin tareas urgentes ni compromisos esta semana</span>
              </div>
            ) : (
              priorityItems.map((item) => {
                const meta = FOLLOWUP_META[item.source] || FOLLOWUP_META.activo;
                const Icon = meta.icon;
                return (
                  <div key={item.id} className={`gs-feed-item is-${item.bucket}`}>
                    <div className="gs-feed-stripe" />
                    <div className={`gs-feed-icon is-${meta.tone}`}><Icon size={13} /></div>
                    <div className="gs-feed-body">
                      <div className="gs-feed-topline">
                        <strong>{item.provider}</strong>
                        <span className={`gs-feed-due is-${item.bucket === 'overdue' ? 'danger' : item.bucket === 'today' ? 'warning' : 'info'}`}>{dueText(item.dueAt)}</span>
                      </div>
                      <p className="gs-feed-task">{item.title}</p>
                      <div className="gs-feed-meta">
                        <span>{meta.label}</span>
                        <span className="gs-feed-dot">Â·</span>
                        <span>{item.owner}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="gs-panel-section-label">Esta semana</div>
          <div className="gs-week-mini">
            {agendaByDay.map((day) => {
              const todayKey = new Date().toISOString().slice(0, 10);
              const isToday = day.key === todayKey;
              return (
                <div key={day.key} className={`gs-week-col${day.items.length > 0 ? ' has-tasks' : ''}${isToday ? ' is-today' : ''}`}>
                  <span className="gs-week-dow">{formatDayOfWeek(day.date)}</span>
                  <div className="gs-week-dot">{day.items.length > 0 ? day.items.length : ''}</div>
                  <span className="gs-week-num">{day.date.getDate()}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* â”€â”€ RIGHT: Estado / Análisis â”€â”€ */}
        <div className="gs-estado-zone">

          {/* Pipeline */}
          <section className="gs-estado-panel">
            <div className="gs-panel-header">
              <div>
                <span className="mx-eyebrow">Comercial</span>
                <h3 className="gs-panel-title">Pipeline de negociación</h3>
              </div>
              <Link className="mx-btn-icon sm" to="/biomasa/tratos"><ChevronRight size={16} /></Link>
            </div>
            <div className="gs-pipeline-steps">
              {pipeline.counts.map((item, index) => (
                <div key={item.key} className={`gs-step${item.count > 0 ? ' is-active' : ''} is-${item.key}`}>
                  <div className="gs-step-badge">{item.count}</div>
                  <div className="gs-step-label">{item.label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Muestreos */}
          <section className="gs-estado-panel">
            <div className="gs-panel-header">
              <div>
                <span className="mx-eyebrow">Técnico</span>
                <h3 className="gs-panel-title">Últimos muestreos</h3>
              </div>
              <Link className="mx-btn-icon sm" to="/biomasa/muestreos"><ChevronRight size={16} /></Link>
            </div>
            {recentSamples.length === 0 ? (
              <div className="mx-state-placeholder sm" style={{ padding: '20px 16px' }}>No hay muestreos recientes.</div>
            ) : (
              <div className="gs-samples-table">
                {recentSamples.slice(0, 4).map((item) => {
                  const rend = item.rendimiento || 0;
                  const isGood = rend >= 20;
                  return (
                  <div key={item._id} className="gs-sample-row">
                    <div className="gs-sample-name">{item.proveedorNombre}</div>
                    <div className="gs-rend-bar-wrap">
                      <div className="gs-rend-bar-fill" style={{
                        width: `${Math.min(rend, 40) / 40 * 100}%`,
                        background: isGood ? 'var(--color-success)' : 'var(--color-warning)',
                      }} />
                    </div>
                    <span className="gs-sample-pct" style={{ color: isGood ? 'var(--color-success)' : 'var(--color-warning)' }}>
                      {Number(rend).toFixed(1)}%
                    </span>
                    <span className="gs-sample-uk">
                      {Math.round(item.uxkg || 0)}<em>uk</em>
                    </span>
                    <span className="gs-sample-date">{formatShortDate(item.fecha)}</span>
                  </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Activity */}
          <section className="gs-estado-panel">
            <div className="gs-panel-header">
              <div>
                <span className="mx-eyebrow">Historial</span>
                <h3 className="gs-panel-title">Actividad reciente</h3>
              </div>
              <Link className="mx-btn-icon sm" to="/historial"><ChevronRight size={16} /></Link>
            </div>
            <div className="gs-activity-compact">
              {compactActivityFeed.length === 0 ? (
                <div className="mx-state-placeholder sm" style={{ padding: '20px 16px' }}>Sin gestiones recientes.</div>
              ) : (
                compactActivityFeed.map((item) => {
                  const ActivityIcon = ACTIVITY_ICONS[item.kind] || MessageSquare;
                  const meta = EVENT_META[item.kind] || EVENT_META.interaccion;
                  return (
                    <div key={item.id} className="gs-activity-row">
                      <div className={`gs-activity-icon-dot is-${meta.tone}`}><ActivityIcon size={11} /></div>
                      <div className="gs-activity-info">
                        <strong>{item.provider}</strong>
                        <span>{item.title}</span>
                      </div>
                      <time className="gs-activity-time">{formatShortDate(item.date)}</time>
                    </div>
                  );
                })
              )}
            </div>
          </section>

        </div>
      </div>

    </div>
  );
}
