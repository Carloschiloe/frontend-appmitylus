import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  MessageSquare,
  RotateCcw,
  Target,
  PauseCircle,
} from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { useToast } from '../../../context/ToastContext';
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
  { key: 'prospecto', label: 'Prospectos', color: '#64748b' },
  { key: 'negociando', label: 'Negociando', color: '#2563eb' },
  { key: 'acordado', label: 'Acordados', color: '#0d9488' },
  { key: 'compra_efectuada', label: 'Compras', color: '#10b981' },
  { key: 'caido', label: 'Caídos', color: '#ef4444' },
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

function toneClass(tone) {
  return `is-${tone || 'muted'}`;
}

function getPauseReasonLabel(value) {
  return PAUSE_REASON_LABELS[value] || 'En espera';
}

export default function Bandeja() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

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
    <div className="gestion-summary">
      <section className="gs-overview-card">
        <div className="gs-overview-copy">
          <p className="gs-section-kicker">Vista consolidada</p>
          <h2>Resumen operativo de seguimiento</h2>
          <p>
            Priorizamos los proveedores que realmente requieren movimiento,
            distinguimos lo que está pausado y mantenemos el contexto comercial
            a la vista sin mezclarlo con tareas que ya no corresponden.
          </p>
        </div>

        <div className="gs-overview-actions">
          <button className="mx-btn mx-btn-outline sm" onClick={handleRefresh}>
          <RotateCcw size={18} /> Actualizar
        </button>
          <div className="gs-highlight-pills">
            <span className="gs-highlight-pill is-deep">
              {formatTons(summary?.acordadoMes)} este mes
            </span>
            <span className="gs-highlight-pill">
              {formatTons(summary?.acordadoProxMes)} próximo mes
            </span>
          </div>
        </div>
      </section>

      <section className="gs-kpi-grid">
        <article className="gs-kpi-card">
          <div className="gs-kpi-icon is-danger">
            <AlertTriangle size={18} />
          </div>
          <div>
            <div className="gs-kpi-value">{taskBoard.overdue.length}</div>
            <div className="gs-kpi-label">Pendientes vencidos</div>
          </div>
        </article>

        <article className="gs-kpi-card">
          <div className="gs-kpi-icon is-primary">
            <Clock size={18} />
          </div>
          <div>
            <div className="gs-kpi-value">{taskBoard.today.length}</div>
            <div className="gs-kpi-label">Actividades de hoy</div>
          </div>
        </article>

        <article className="gs-kpi-card">
          <div className="gs-kpi-icon is-info">
            <Target size={18} />
          </div>
          <div>
            <div className="gs-kpi-value">{seguimiento.active.length}</div>
            <div className="gs-kpi-label">Seguimiento activo</div>
          </div>
        </article>

        <article className="gs-kpi-card">
          <div className="gs-kpi-icon is-warning">
            <PauseCircle size={18} />
          </div>
          <div>
            <div className="gs-kpi-value">{seguimiento.paused.length}</div>
            <div className="gs-kpi-label">Casos pausados</div>
          </div>
        </article>
      </section>

      <section className="gs-main-grid">
        <article className="mx-table-card gs-panel-card gs-priority-panel">
          <div className="gs-card-head">
            <div>
              <p className="gs-section-kicker">Prioridades</p>
              <h3>Qué debemos mover ahora</h3>
            </div>
            <Link className="gs-card-link" to="/gestion/agenda">
              Abrir agenda <ChevronRight size={15} />
            </Link>
          </div>

          <div className="gs-priority-strip">
            <div className="gs-priority-stat">
              <span className="label">Vencidos</span>
              <strong>{taskBoard.overdue.length}</strong>
            </div>
            <div className="gs-priority-stat">
              <span className="label">Hoy</span>
              <strong>{taskBoard.today.length}</strong>
            </div>
            <div className="gs-priority-stat">
              <span className="label">Semana</span>
              <strong>{taskBoard.next.length}</strong>
            </div>
          </div>

          <div className="gs-priority-list">
            {taskBoard.spotlight.length === 0 ? (
              <div className="gs-empty-inline">No hay compromisos urgentes por ahora.</div>
            ) : (
              taskBoard.spotlight.map((item) => {
                const meta = FOLLOWUP_META[item.source] || FOLLOWUP_META.activo;
                const Icon = meta.icon;

                return (
                  <div key={item.id} className="gs-priority-item">
                    <div className={`gs-priority-badge ${toneClass(meta.tone)}`}>
                      <Icon size={14} />
                    </div>

                    <div className="gs-priority-content">
                      <div className="gs-priority-topline">
                        <strong>{item.provider}</strong>
                        <span className={`gs-chip ${item.bucket === 'overdue' ? 'is-danger' : item.bucket === 'today' ? 'is-warning' : 'is-muted'}`}>
                          {dueText(item.dueAt)}
                        </span>
                      </div>
                      <p>{item.title}</p>
                      <div className="gs-priority-meta">
                        <span>{meta.label}</span>
                        <span>{item.owner}</span>
                        <span>{formatShortDate(item.dueAt)}</span>
                      </div>
                      <div className="gs-priority-meta">
                        <span>{item.subtitle}</span>
                        <span>{item.estadoComercial || 'Sin estado comercial'}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <div className="gs-side-stack">
          <article className="mx-table-card gs-panel-card">
            <div className="gs-card-head">
              <div>
                <p className="gs-section-kicker">Pipeline</p>
                <h3>Estado comercial</h3>
              </div>
              <Link className="gs-card-link" to="/biomasa/status?tab=negociacion&mode=comercial">
                Ir a negociación <ChevronRight size={15} />
              </Link>
            </div>

            <div className="gs-pipeline-list">
              {pipeline.counts.map((item) => (
                <div key={item.key} className="gs-pipeline-row">
                  <div className="gs-pipeline-copy">
                    <span>{item.label}</span>
                    <strong>{item.count}</strong>
                  </div>
                  <div className="gs-pipeline-track">
                    <div
                      className="gs-pipeline-fill"
                      style={{
                        width: `${Math.max((item.count / pipeline.max) * 100, item.count > 0 ? 12 : 0)}%`,
                        backgroundColor: item.color,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="mx-table-card gs-panel-card">
            <div className="gs-card-head">
              <div>
              <p className="gs-section-kicker">Biomasa</p>
                <h3>Próximos hitos comerciales</h3>
              </div>
            </div>

            <div className="gs-mini-list">
              {upcomingDeals.length === 0 ? (
                <div className="gs-empty-inline">No hay hitos comerciales próximos cargados.</div>
              ) : (
                upcomingDeals.map((item) => (
                  <div key={item._id} className="gs-mini-item">
                    <div>
                      <strong>{item.proveedorNombre || 'Proveedor sin nombre'}</strong>
                      <p>{formatShortDate(item.closeDate)} · {formatTons(item.tonsAcordadas)}</p>
                    </div>
                    <span className={`gs-chip ${item.estado === 'acordado' ? 'is-success' : 'is-info'}`}>
                      {item.estado || 'sin estado'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="gs-secondary-grid">
        <article className="mx-table-card gs-panel-card">
          <div className="gs-card-head">
            <div>
              <p className="gs-section-kicker">Agenda</p>
              <h3>Seguimiento próximos 7 días</h3>
            </div>
            <Link className="gs-card-link" to="/gestion/agenda">
              Ver agenda <ChevronRight size={15} />
            </Link>
          </div>

          <div className="gs-agenda-list">
            {agendaByDay.map((day) => (
              <div key={day.key} className="gs-agenda-day">
                <div className="gs-agenda-date">
                  <strong>{formatLongDate(day.date)}</strong>
                  <span>{day.items.length} seguimientos</span>
                </div>
                <div className="gs-agenda-items">
                  {day.items.length === 0 ? (
                    <span className="gs-agenda-empty">Sin actividad</span>
                  ) : (
                    day.items.slice(0, 2).map((item, index) => (
                      <span
                        key={`${day.key}-${index}`}
                        className={`gs-chip ${item.source === 'pausado' ? 'is-warning' : 'is-primary'}`}
                      >
                        {item.proveedorNombre}: {item.title}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="mx-table-card gs-panel-card">
          <div className="gs-card-head">
            <div>
              <p className="gs-section-kicker">Actividad reciente</p>
              <h3>Último movimiento comercial</h3>
            </div>
            <Link className="gs-card-link" to="/historial">
              Ver historial <ChevronRight size={15} />
            </Link>
          </div>

          <div className="gs-activity-list">
            {activityFeed.length === 0 ? (
              <div className="gs-empty-inline">Todavía no hay actividad reciente.</div>
            ) : (
              activityFeed.map((item) => (
                <div key={item.id} className="gs-activity-item">
                  <div className={`gs-priority-badge ${toneClass((EVENT_META[item.kind] || EVENT_META.interaccion).tone)}`}>
                    <MessageSquare size={14} />
                  </div>
                  <div className="gs-activity-copy">
                    <strong>{item.provider}</strong>
                    <p>{item.title}</p>
                    <span>{item.caption} · {formatShortDate(item.date)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="mx-table-card gs-panel-card">
          <div className="gs-card-head">
            <div>
              <p className="gs-section-kicker">Muestreos</p>
              <h3>Últimos resultados</h3>
            </div>
            <Link className="gs-card-link" to="/biomasa/muestreos">
              Ver muestreos <ChevronRight size={15} />
            </Link>
          </div>

          <div className="gs-sample-list">
            {recentSamples.length === 0 ? (
              <div className="gs-empty-inline">No hay muestreos registrados recientemente.</div>
            ) : (
              recentSamples.map((item) => (
                <div key={item._id} className="gs-sample-item">
                  <div className="gs-sample-topline">
                    <strong>{item.proveedorNombre || 'Proveedor sin nombre'}</strong>
                    <span className={`gs-chip ${item.mainClass === 'Sin clasificación' ? 'is-warning' : 'is-success'}`}>
                      {item.mainClass}
                    </span>
                  </div>
                  <p>{item.centroCodigo || 'Centro no informado'}</p>
                  <div className="gs-sample-metrics">
                    <span>Rend: {Number(item.rendimiento || 0).toLocaleString('es-CL', { maximumFractionDigits: 1 })}%</span>
                    <span>UX/Kg: {Number(item.uxkg || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 })}</span>
                    <span>{formatShortDate(item.fecha)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="gs-footer-note">
        <Target size={16} />
        <span>
          Este resumen separa lo que requiere seguimiento, lo que está pausado y lo que ya avanzó comercialmente,
          para ayudarte a decidir más rápido qué sigue con cada proveedor y cuándo debe reactivarse.
        </span>
      </section>
    </div>
  );
}
