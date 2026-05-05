import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  Clock,
  Handshake,
  MessageSquare,
  Phone,
  RotateCcw,
  Target,
  TestTube2,
  Users
} from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { useToast } from '../../../context/ToastContext';
import './bandeja.css';

const PIPELINE_ORDER = [
  { key: 'prospecto', label: 'Prospectos', color: '#64748b' },
  { key: 'negociando', label: 'Negociando', color: '#2563eb' },
  { key: 'acordado', label: 'Acordados', color: '#0d9488' },
  { key: 'compra_efectuada', label: 'Compras', color: '#10b981' },
  { key: 'caido', label: 'Caidos', color: '#ef4444' }
];

const EVENT_META = {
  interaccion: { label: 'Interaccion', icon: MessageSquare, tone: 'info' },
  llamada: { label: 'Llamada', icon: Phone, tone: 'info' },
  reunion: { label: 'Reunion', icon: Users, tone: 'warning' },
  visita: { label: 'Visita', icon: Calendar, tone: 'primary' },
  muestreo: { label: 'Muestreo', icon: TestTube2, tone: 'success' }
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
    month: 'short'
  }).format(date);
}

function formatLongDate(value) {
  const date = toDate(value);
  if (!date) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CL', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
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
  if (diffDays === 1) return 'Manana';
  return `En ${diffDays} dias`;
}

function toneClass(tone) {
  return `is-${tone || 'muted'}`;
}

export default function Bandeja() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [oportunidades, setOportunidades] = useState([]);
  const [interacciones, setInteracciones] = useState([]);
  const [visitas, setVisitas] = useState([]);
  const [muestreos, setMuestreos] = useState([]);
  const [agenda, setAgenda] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    loadPanel(controller.signal);
    return () => controller.abort();
  }, []);

  async function loadPanel(signal) {
    setLoading(true);
    try {
      const today = startOfDay();
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      const requestOptions = signal ? { signal } : {};
      const [
        summaryRes,
        oportunidadesRes,
        interaccionesRes,
        visitasRes,
        muestreosRes,
        agendaRes
      ] = await Promise.all([
        apiClient.get('/dashboard/summary', requestOptions),
        apiClient.get('/oportunidades?limit=200', requestOptions),
        apiClient.get('/interacciones?limit=200', requestOptions),
        apiClient.get('/visitas', requestOptions),
        apiClient.get('/muestreos?limit=50&page=1', requestOptions),
        apiClient.get(
          `/dashboard/calendario?from=${today.toISOString()}&to=${nextWeek.toISOString()}`,
          requestOptions
        )
      ]);

      setSummary(summaryRes || null);
      setOportunidades(toList(oportunidadesRes));
      setInteracciones(toList(interaccionesRes));
      setVisitas(toList(visitasRes));
      setMuestreos(toList(muestreosRes));
      setAgenda(toList(agendaRes));
    } catch (error) {
      if (error.name === 'AbortError') return;
      addToast({
        title: 'Error',
        message: 'No se pudo construir el panel de gestion.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }

  const taskBoard = useMemo(() => {
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const nextWeek = new Date(todayEnd);
    nextWeek.setDate(nextWeek.getDate() + 6);

    const tasks = [
      ...interacciones.map((item) => ({
        id: `int-${item._id}`,
        source: 'interaccion',
        provider: item.proveedorNombre || item.contactoNombre || 'Proveedor sin nombre',
        title: item.resumen || item.proximoPaso || 'Gestion sin resumen',
        subtitle: item.proximoPaso || item.resultado || 'Sin detalle adicional',
        dueAt: item.fechaProximo || item.proximoPasoFecha || item.fecha,
        owner: item.responsablePG || item.responsable || 'Sin responsable'
      })),
      ...visitas.map((item) => ({
        id: `vis-${item._id}`,
        source: 'visita',
        provider: item.proveedorNombre || item.contacto || 'Proveedor sin nombre',
        title: item.estado || 'Visita programada',
        subtitle: item.observaciones || item.centroCodigo || 'Sin observaciones',
        dueAt: item.proximoPasoFecha || item.fecha,
        owner: item.responsablePG || 'Sin responsable'
      }))
    ].map((task) => {
      const dueDate = toDate(task.dueAt);
      let bucket = 'nodate';

      if (dueDate) {
        if (dueDate < todayStart) bucket = 'overdue';
        else if (dueDate >= todayStart && dueDate < todayEnd) bucket = 'today';
        else if (dueDate < nextWeek) bucket = 'next';
        else bucket = 'later';
      }

      return { ...task, dueDate, bucket };
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
      spotlight: [...overdue, ...today, ...next].slice(0, 7)
    };
  }, [interacciones, visitas]);

  const pipeline = useMemo(() => {
    const counts = PIPELINE_ORDER.map((item) => ({
      ...item,
      count: oportunidades.filter((oportunidad) => oportunidad.estado === item.key).length
    }));
    const max = Math.max(...counts.map((item) => item.count), 1);
    return { counts, max };
  }, [oportunidades]);

  const upcomingDeals = useMemo(() => {
    const today = startOfDay();
    return oportunidades
      .map((item) => ({
        ...item,
        closeDate: toDate(item.fechaCierre || item.vigenciaDesde || item.vigenciaHasta)
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
        title: item.resumen || 'Interaccion registrada',
        date: item.updatedAt || item.createdAt || item.fecha,
        caption: item.proximoPaso || item.resultado || item.responsablePG || 'Sin detalle'
      })),
      ...visitas.map((item) => ({
        id: `a-vis-${item._id}`,
        kind: 'visita',
        provider: item.proveedorNombre || item.contacto || 'Proveedor sin nombre',
        title: item.estado || 'Visita registrada',
        date: item.updatedAt || item.createdAt || item.fecha,
        caption: item.observaciones || item.centroCodigo || item.responsablePG || 'Sin detalle'
      }))
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
        items: []
      };
    });

    const buckets = new Map(days.map((day) => [day.key, day]));

    agenda.forEach((item) => {
      const date = toDate(item.date);
      if (!date) return;
      const key = date.toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) return;
      bucket.items.push(item);
    });

    days.forEach((day) => {
      day.items.sort((left, right) => {
        const leftDate = toDate(left.date);
        const rightDate = toDate(right.date);
        if (!leftDate || !rightDate) return 0;
        return leftDate - rightDate;
      });
    });

    return days;
  }, [agenda]);

  const recentSamples = useMemo(() => {
    return [...muestreos]
      .map((item) => ({
        ...item,
        sampleDate: toDate(item.fecha),
        mainClass: item.clasificaciones?.[0]?.nombre || 'Sin clasificacion'
      }))
      .filter((item) => item.sampleDate)
      .sort((left, right) => right.sampleDate - left.sampleDate)
      .slice(0, 5);
  }, [muestreos]);

  const sevenDaySampleCount = useMemo(() => {
    const since = startOfDay();
    since.setDate(since.getDate() - 6);
    return muestreos.filter((item) => {
      const date = toDate(item.fecha);
      return date && date >= since;
    }).length;
  }, [muestreos]);

  if (loading) {
    return (
      <div className="mx-state-placeholder">
        <div className="mx-spinner"></div>
        <p>Construyendo panel de gestion...</p>
      </div>
    );
  }

  return (
    <div className="gestion-summary">
      <section className="gs-overview-card">
        <div className="gs-overview-copy">
          <p className="gs-section-kicker">Vista consolidada</p>
          <h2>Resumen operativo de proveedores</h2>
          <p>
            Reunimos lo mas importante de bandeja, calendario, tratos e inspecciones
            para que el equipo vea prioridades, cierres y actividad reciente sin saltar
            entre pestañas.
          </p>
        </div>

        <div className="gs-overview-actions">
          <button className="mx-btn mx-btn-outline" onClick={() => loadPanel()}>
            <RotateCcw size={18} /> Actualizar
          </button>
          <div className="gs-highlight-pills">
            <span className="gs-highlight-pill is-deep">
              {formatTons(summary?.acordadoMes)} este mes
            </span>
            <span className="gs-highlight-pill">
              {formatTons(summary?.acordadoProxMes)} proximo mes
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
            <Handshake size={18} />
          </div>
          <div>
            <div className="gs-kpi-value">{summary?.enNegociacion ?? 0}</div>
            <div className="gs-kpi-label">Tratos en negociacion</div>
          </div>
        </article>

        <article className="gs-kpi-card">
          <div className="gs-kpi-icon is-success">
            <TestTube2 size={18} />
          </div>
          <div>
            <div className="gs-kpi-value">{sevenDaySampleCount}</div>
            <div className="gs-kpi-label">Muestreos ultimos 7 dias</div>
          </div>
        </article>
      </section>

      <section className="gs-main-grid">
        <article className="mx-table-card gs-panel-card gs-priority-panel">
          <div className="gs-card-head">
            <div>
              <p className="gs-section-kicker">Prioridades</p>
              <h3>Que requiere atencion hoy</h3>
            </div>
            <Link className="gs-card-link" to="/gestion/interacciones">
              Ver gestiones <ChevronRight size={15} />
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
                const meta = EVENT_META[item.source] || EVENT_META.interaccion;
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
              <Link className="gs-card-link" to="/gestion/tratos">
                Abrir tratos <ChevronRight size={15} />
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
                        backgroundColor: item.color
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
                <p className="gs-section-kicker">Cierres</p>
                <h3>Proximos hitos comerciales</h3>
              </div>
            </div>

            <div className="gs-mini-list">
              {upcomingDeals.length === 0 ? (
                <div className="gs-empty-inline">No hay cierres proximos cargados.</div>
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
              <h3>Proximos 7 dias</h3>
            </div>
            <Link className="gs-card-link" to="/gestion/calendario">
              Ver calendario <ChevronRight size={15} />
            </Link>
          </div>

          <div className="gs-agenda-list">
            {agendaByDay.map((day) => (
              <div key={day.key} className="gs-agenda-day">
                <div className="gs-agenda-date">
                  <strong>{formatLongDate(day.date)}</strong>
                  <span>{day.items.length} actividades</span>
                </div>
                <div className="gs-agenda-items">
                  {day.items.length === 0 ? (
                    <span className="gs-agenda-empty">Sin actividad</span>
                  ) : (
                    day.items.slice(0, 2).map((item, index) => {
                      const meta = EVENT_META[item.kind] || EVENT_META.interaccion;
                      return (
                        <span key={`${day.key}-${index}`} className={`gs-chip ${toneClass(meta.tone)}`}>
                          {meta.label}: {item.proveedorNombre || item.title || 'Actividad'}
                        </span>
                      );
                    })
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
              <h3>Ultimo movimiento comercial</h3>
            </div>
            <Link className="gs-card-link" to="/historial">
              Ver historial <ChevronRight size={15} />
            </Link>
          </div>

          <div className="gs-activity-list">
            {activityFeed.length === 0 ? (
              <div className="gs-empty-inline">Todavia no hay actividad reciente.</div>
            ) : (
              activityFeed.map((item) => {
                const meta = EVENT_META[item.kind] || EVENT_META.interaccion;
                const Icon = meta.icon;

                return (
                  <div key={item.id} className="gs-activity-item">
                    <div className={`gs-priority-badge ${toneClass(meta.tone)}`}>
                      <Icon size={14} />
                    </div>
                    <div className="gs-activity-copy">
                      <strong>{item.provider}</strong>
                      <p>{item.title}</p>
                      <span>{item.caption} · {formatShortDate(item.date)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="mx-table-card gs-panel-card">
          <div className="gs-card-head">
            <div>
              <p className="gs-section-kicker">Muestreos</p>
              <h3>Ultimos resultados</h3>
            </div>
            <Link className="gs-card-link" to="/gestion/muestreos">
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
                    <span className={`gs-chip ${item.mainClass === 'Sin clasificacion' ? 'is-warning' : 'is-success'}`}>
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
          Este resumen concentra la informacion relevante de las pestañas internas para
          ayudarte a decidir mas rapido que revisar, con quien hacer seguimiento y donde
          hay riesgo operativo.
        </span>
      </section>
    </div>
  );
}
