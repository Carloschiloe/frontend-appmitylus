import React, { useCallback, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  MessageSquare,
  RotateCcw,
  Target,
  PauseCircle,
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
  const { data: summary, isLoading: loadingSummary } = useGestionSummary();
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

  if (loading) {
    return (
      <div className="mx-state-placeholder">
        <div className="mx-spinner"></div>
        <p>Construyendo panel de gestión...</p>
      </div>
    );
  }

  return (
    <div className="mx-page">
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Gestión · Resumen</p>
          <h1>Resumen Operativo</h1>
          <p>Priorización de proveedores, seguimiento de tratos y pipeline comercial consolidado.</p>
        </div>
        <div className="mx-hero-actions">
          <div className="gs-highlight-pills gs-highlight-pills-hero">
            <span className="mx-badge gs-hero-badge">
              {formatTons(summary?.acordadoMes)} este mes
            </span>
            <span className="mx-badge gs-hero-badge">
              {formatTons(summary?.acordadoProxMes)} próx. mes
            </span>
          </div>
          <div className="gs-hero-buttons">
            <button 
              className="mx-btn-icon gs-hero-refresh" 
              onClick={handleRefresh} 
            >
              <RotateCcw size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-content-frame">
        <div className="mx-kpi-grid gs-kpi-strip">
          <div className="mx-kpi-card">
            <div className="mx-kpi-label">Pendientes vencidos</div>
            <div className="mx-kpi-value gs-kpi-value-danger">{taskBoard.overdue.length}</div>
          </div>
          <div className="mx-kpi-card">
            <div className="mx-kpi-label">Actividades de hoy</div>
            <div className="mx-kpi-value gs-kpi-value-info">{taskBoard.today.length}</div>
          </div>
          <div className="mx-kpi-card">
            <div className="mx-kpi-label">Seguimiento activo</div>
            <div className="mx-kpi-value gs-kpi-value-success">{seguimiento.active.length}</div>
          </div>
          <div className="mx-kpi-card">
            <div className="mx-kpi-label">Casos pausados</div>
            <div className="mx-kpi-value gs-kpi-value-warning">{seguimiento.paused.length}</div>
          </div>
        </div>

        <section className="gs-main-grid am-mt-24">
          <article className="mx-card gs-priority-panel">
            <header className="mx-card-header">
              <div>
                <p className="mx-eyebrow">Prioridades</p>
                <h3 className="mx-card-title">Qué debemos mover ahora</h3>
              </div>
              <Link className="mx-btn-icon sm" to="/gestion/agenda">
                <ChevronRight size={18} />
              </Link>
            </header>

            <div className="mx-toolbar am-mt-12 gs-priority-toolbar">
              <div className="mx-toggle-group">
                <span className="mx-badge mx-badge-danger">Vencidos: {taskBoard.overdue.length}</span>
                <span className="mx-badge mx-badge-warning">Hoy: {taskBoard.today.length}</span>
                <span className="mx-badge mx-badge-info">Semana: {taskBoard.next.length}</span>
              </div>
            </div>

            <div className="gs-priority-list am-mt-16">
              {taskBoard.spotlight.length === 0 ? (
                <div className="mx-state-placeholder gs-empty-priority">No hay compromisos urgentes por ahora.</div>
              ) : (
                taskBoard.spotlight.map((item) => {
                  const meta = FOLLOWUP_META[item.source] || FOLLOWUP_META.activo;
                  const Icon = meta.icon;

                  return (
                    <div key={item.id} className="gs-priority-item">
                      <div className={`gs-priority-badge is-${meta.tone}`}>
                        <Icon size={14} />
                      </div>

                      <div className="gs-priority-content">
                        <div className="gs-priority-topline">
                          <strong>{item.provider}</strong>
                          <span className={`mx-badge mx-badge-${item.bucket === 'overdue' ? 'danger' : item.bucket === 'today' ? 'warning' : 'muted'}`}>
                            {dueText(item.dueAt)}
                          </span>
                        </div>
                        <p>{item.title}</p>
                        <div className="gs-priority-meta">
                          <span>{meta.label}</span>
                          <span>{item.owner}</span>
                          <span className="gs-date-strong">{formatShortDate(item.dueAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </article>

        <div className="gs-side-stack">
          <article className="mx-card">
            <header className="mx-card-header">
              <div>
                <p className="mx-eyebrow">Pipeline</p>
                <h3 className="mx-card-title">Estado comercial</h3>
              </div>
              <Link className="mx-btn-icon sm" to="/biomasa/status?tab=negociacion">
                <ChevronRight size={18} />
              </Link>
            </header>

            <div className="gs-pipeline-list am-mt-12">
              {pipeline.counts.map((item) => (
                <div key={item.key} className={`gs-pipeline-row is-${item.key}`}>
                  <div className="gs-pipeline-copy">
                    <span>{item.label}</span>
                    <strong>{item.count}</strong>
                  </div>
                  <progress className="gs-pipeline-progress" value={item.count} max={pipeline.max}></progress>
                </div>
              ))}
            </div>
          </article>

          <article className="mx-card">
            <header className="mx-card-header">
              <div>
                <p className="mx-eyebrow">Biomasa</p>
                <h3 className="mx-card-title">Próximos hitos</h3>
              </div>
            </header>

            <div className="gs-mini-list">
              {upcomingDeals.length === 0 ? (
                <div className="mx-state-placeholder sm">Sin hitos próximos.</div>
              ) : (
                upcomingDeals.map((item) => (
                  <div key={item._id} className="gs-mini-item">
                    <div>
                      <strong>{item.proveedorNombre}</strong>
                      <p>{formatShortDate(item.closeDate)} · {formatTons(item.tonsAcordadas)}</p>
                    </div>
                    <span className={`mx-badge mx-badge-${item.estado === 'acordado' ? 'success' : 'info'}`}>
                      {item.estado || 'sin estado'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="gs-secondary-grid am-mt-24">
        <article className="mx-card">
          <header className="mx-card-header">
            <div>
              <p className="mx-eyebrow">Agenda</p>
              <h3 className="mx-card-title">Seguimiento próximos 7 días</h3>
            </div>
            <Link className="mx-btn-icon sm" to="/gestion/agenda">
              <ChevronRight size={18} />
            </Link>
          </header>

          <div className="gs-agenda-list">
            {agendaByDay.map((day) => (
              <div key={day.key} className="gs-agenda-day">
                <div className="gs-agenda-date">
                  <strong>{formatLongDate(day.date)}</strong>
                  <span>{day.items.length} tareas</span>
                </div>
                <div className="gs-agenda-items">
                  {day.items.length === 0 ? (
                    <span className="gs-agenda-empty">Sin actividad</span>
                  ) : (
                    day.items.slice(0, 2).map((item, index) => (
                      <span
                        key={`${day.key}-${index}`}
                        className={`mx-badge mx-badge-${item.source === 'pausado' ? 'warning' : 'primary'}`}
                      >
                        {item.proveedorNombre}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="mx-card">
          <header className="mx-card-header">
            <div>
              <p className="mx-eyebrow">Actividad</p>
              <h3 className="mx-card-title">Último movimiento</h3>
            </div>
            <Link className="mx-btn-icon sm" to="/historial">
              <ChevronRight size={18} />
            </Link>
          </header>

          <div className="gs-activity-list">
            {activityFeed.length === 0 ? (
              <div className="mx-state-placeholder sm">Sin actividad reciente.</div>
            ) : (
              activityFeed.map((item) => (
                <div key={item.id} className="gs-activity-item">
                  <div className={`mx-btn-icon sm is-${(EVENT_META[item.kind] || EVENT_META.interaccion).tone}`}>
                    <MessageSquare size={14} />
                  </div>
                  <div className="gs-activity-copy">
                    <strong>{item.provider}</strong>
                    <p>{item.title}</p>
                    <span>{formatShortDate(item.date)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="mx-card">
          <header className="mx-card-header">
            <div>
              <p className="mx-eyebrow">Muestreos</p>
              <h3 className="mx-card-title">Últimos resultados</h3>
            </div>
            <Link className="mx-btn-icon sm" to="/biomasa/muestreos">
              <ChevronRight size={18} />
            </Link>
          </header>

          <div className="gs-sample-list">
            {recentSamples.length === 0 ? (
              <div className="mx-state-placeholder sm">Sin muestreos.</div>
            ) : (
              recentSamples.map((item) => (
                <div key={item._id} className="gs-sample-item">
                  <div className="gs-sample-topline">
                    <strong>{item.proveedorNombre}</strong>
                    <span className={`mx-badge mx-badge-${item.mainClass === 'Sin clasificación' ? 'warning' : 'success'}`}>
                      {item.mainClass}
                    </span>
                  </div>
                  <p>{item.centroCodigo}</p>
                  <div className="gs-sample-metrics">
                    <span>Rend: {Number(item.rendimiento || 0).toFixed(1)}%</span>
                    <span>UX/Kg: {Math.round(item.uxkg || 0)}</span>
                    <span className="gs-sample-date">{formatShortDate(item.fecha)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <footer className="mx-state-placeholder sm am-mt-32 gs-footer-summary">
        <Target size={20} className="gs-footer-icon" />
        <p>
          Este resumen separa lo que requiere seguimiento, lo que está pausado y lo que ya avanzó comercialmente,
          para ayudarte a decidir más rápido qué sigue con cada proveedor.
        </p>
      </footer>
    </div>
  </div>
  );
}
