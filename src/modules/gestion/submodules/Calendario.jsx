import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  ListChecks,
  MapPin,
  MessageSquare,
  PauseCircle,
  Phone,
  Search,
  CalendarClock,
  Check,
  Pencil,
  RotateCcw,
  XCircle,
  Table2,
  Target,
  Users,
  Beaker,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCalendarioAgenda,
  useOportunidades,
} from '../hooks/useGestionQueries';
import './calendario.css';

const DOW = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const VIEW_OPTIONS = [
  { id: 'calendar', label: 'Calendario', icon: CalendarDays },
  { id: 'week', label: 'Semana', icon: Table2 },
  { id: 'list', label: 'Lista', icon: ListChecks },
  { id: 'agenda', label: 'Agenda', icon: Clock },
];

const TYPE_CONFIG = {
  muestreo: { icon: Beaker, color: '#0A5CFF', bg: '#EAF4FF', border: '#BBD0EA', label: 'Muestreo' },
  visita: { icon: MapPin, color: '#0369a1', bg: '#eff6ff', border: '#bfdbfe', label: 'Visita' },
  seguimiento: { icon: Target, color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', label: 'Seguimiento' },
  llamada: { icon: Phone, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Llamada' },
  reunion: { icon: Users, color: '#b45309', bg: '#fffbeb', border: '#fde68a', label: 'Negociacion' },
  negociacion: { icon: Users, color: '#b45309', bg: '#fffbeb', border: '#fde68a', label: 'Negociacion' },
  tarea: { icon: CheckCircle2, color: '#475569', bg: '#f8fafc', border: '#e2e8f0', label: 'Tarea interna' },
  interaccion: { icon: MessageSquare, color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe', label: 'Seguimiento' },
  pausado: { icon: PauseCircle, color: '#d97706', bg: '#fff7ed', border: '#fed7aa', label: 'Pausado' },
  default: { icon: Clock, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: 'Otro' },
};

const STATUS_CONFIG = {
  completado: { label: 'Completado', className: 'is-done' },
  completed: { label: 'Completado', className: 'is-done' },
  cerrado: { label: 'Cerrado', className: 'is-done' },
  activo: { label: 'Activo', className: 'is-active' },
  pendiente: { label: 'Pendiente', className: 'is-pending' },
  pausado: { label: 'Pausado', className: 'is-paused' },
  cancelado: { label: 'Cancelado', className: 'is-cancelled' },
  cancelada: { label: 'Cancelado', className: 'is-cancelled' },
  cancelled: { label: 'Cancelado', className: 'is-cancelled' },
  vencido: { label: 'Vencido', className: 'is-overdue' },
  default: { label: 'Pendiente', className: 'is-pending' },
};

const AGENDA_RANGE_OPTIONS = [
  { id: 'today', label: 'Hoy' },
  { id: '7d', label: 'Proximos 7 dias' },
  { id: '30d', label: 'Proximos 30 dias' },
  { id: 'pending', label: 'Todas las pendientes' },
];

const LIST_DATE_OPTIONS = [
  { id: 'all', label: 'Todas las fechas' },
  { id: 'month', label: 'Mes visible' },
  { id: 'future', label: 'Programadas' },
  { id: 'past', label: 'Historico' },
];

const PAUSE_REASON_LABELS = {
  esperando_crecimiento: 'Esperando crecimiento',
  esperando_disponibilidad: 'Esperando disponibilidad',
  esperando_respuesta: 'Esperando respuesta',
  esperando_resultado_muestra: 'Esperando resultado de muestra',
  esperando_decision_interna: 'Esperando decision interna',
};

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) {
    const fallback = new Date(dateStr);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  return new Date(y, m - 1, d);
}

function toList(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || payload?.data || [];
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function dateKeyFromDate(date) {
  if (!date) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatShortDate(date) {
  if (!date) return '-';
  return `${pad2(date.getDate())}-${pad2(date.getMonth() + 1)}-${date.getFullYear()}`;
}

function formatDayHeading(date) {
  if (!date) return 'Sin fecha';
  return date.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

function getEventDate(ev) {
  return parseLocalDate(ev.date || ev.fecha || ev.fechaActividad || ev.fechaProximaAccion || ev.createdAt);
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getEventTime(ev) {
  const raw = ev.hora || ev.time || ev.fechaHora || ev.startsAt || ev.date;
  if (!raw) return '';
  const text = String(raw);
  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (match) return `${pad2(match[1])}:${match[2]}`;
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime()) && (date.getHours() || date.getMinutes())) {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }
  return '';
}

function compareEventsNewestFirst(a, b) {
  const ad = getEventDate(a)?.getTime() || 0;
  const bd = getEventDate(b)?.getTime() || 0;
  return bd - ad || getEventTime(b).localeCompare(getEventTime(a));
}

function compareEventsOldestFirst(a, b) {
  const ad = getEventDate(a)?.getTime() || 0;
  const bd = getEventDate(b)?.getTime() || 0;
  return ad - bd || getEventTime(a).localeCompare(getEventTime(b));
}

function normalizeKind(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('muestra') || text.includes('muestreo')) return 'muestreo';
  if (text.includes('visita')) return 'visita';
  if (text.includes('llamada') || text.includes('telefono')) return 'llamada';
  if (text.includes('negoci') || text.includes('reunion')) return 'negociacion';
  if (text.includes('tarea')) return 'tarea';
  if (text.includes('paus')) return 'pausado';
  if (text.includes('seguim')) return 'seguimiento';
  return value || 'default';
}

function getPauseReasonLabel(value) {
  return PAUSE_REASON_LABELS[value] || 'En espera';
}

function buildFollowupEvent(item, kind) {
  const date = item.fechaProximaAccion || item.fechaRevision || item.nextActionAt || null;
  return {
    id: `opp-${item._id}`,
    kind,
    date,
    proveedorNombre: item.proveedorNombre || 'Proveedor sin nombre',
    contactoNombre: item.proveedorNombre || 'Proveedor sin nombre',
    title: item.proximaAccion || (kind === 'pausado' ? 'Revisar caso pausado' : 'Definir proximo paso'),
    resumen: kind === 'pausado'
      ? getPauseReasonLabel(item.motivoPausa)
      : (item.notasTrato || item.estado || 'Seguimiento pendiente'),
    proximoPaso: item.proximaAccion || '',
    estado: kind === 'pausado' ? 'pausado' : 'activo',
    responsable: item.responsableNombre || item.responsable || '',
  };
}

function getEventType(ev) {
  return normalizeKind(ev.kind || ev.tipo || ev.type || ev.categoria || ev.actividadTipo);
}

function getTypeConfig(ev) {
  return TYPE_CONFIG[getEventType(ev)] || TYPE_CONFIG.default;
}

function getStatusConfig(ev) {
  const status = String(ev.estado || ev.status || ev.seguimientoEstado || '').toLowerCase();
  return STATUS_CONFIG[status] || STATUS_CONFIG.default;
}

function getEventStatusKey(ev) {
  return getStatusConfig(ev).className;
}

function isPlanningEvent(ev) {
  const status = getEventStatusKey(ev);
  return status === 'is-pending' || status === 'is-active' || status === 'is-paused' || status === 'is-overdue';
}

function isFutureOrToday(ev) {
  const date = getEventDate(ev);
  if (!date) return false;
  return date.getTime() >= startOfDay(new Date()).getTime();
}

function getEventTitle(ev) {
  return ev.title || ev.titulo || ev.actividad || ev.proximaAccion || ev.asunto || 'Actividad';
}

function getEventProvider(ev) {
  return ev.proveedorNombre || ev.contactoNombre || ev.clienteNombre || ev.empresaNombre || ev.proveedor || 'Sin proveedor';
}

function getEventResponsible(ev) {
  return ev.responsableNombre || ev.responsable || ev.usuarioNombre || ev.createdByName || '-';
}

function getEventDescription(ev) {
  return ev.resumen || ev.detalle || ev.descripcion || ev.observacion || ev.notas || '';
}

function getWeekStart(date) {
  const base = new Date(date);
  const offset = (base.getDay() + 6) % 7;
  base.setDate(base.getDate() - offset);
  base.setHours(0, 0, 0, 0);
  return base;
}

function getWeekDays(currentDate) {
  const start = getWeekStart(currentDate);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function EventPill({ event, compact = false }) {
  const cfg = getTypeConfig(event);
  const Icon = cfg.icon;
  return (
    <div
      className={`cal-event-pill ${compact ? 'is-compact' : ''}`}
      style={{ '--event-color': cfg.color, '--event-bg': cfg.bg, '--event-border': cfg.border }}
      title={`${getEventTitle(event)} - ${getEventProvider(event)}`}
    >
      <Icon size={compact ? 12 : 14} />
      <span>{compact ? getEventProvider(event) : getEventTitle(event)}</span>
    </div>
  );
}

function EventCard({ event, onSelect }) {
  const cfg = getTypeConfig(event);
  const status = getStatusConfig(event);
  const Icon = cfg.icon;
  const time = getEventTime(event);

  return (
    <article className="cal-event-card-modern" style={{ '--event-color': cfg.color, '--event-bg': cfg.bg, '--event-border': cfg.border }}>
      <div className="cal-event-card-icon"><Icon size={16} /></div>
      <div className="cal-event-card-body">
        <div className="cal-event-card-topline">
          <span>{time || 'Sin hora'}</span>
          <span className={`cal-status-chip ${status.className}`}>{status.label}</span>
        </div>
        <h4>{getEventTitle(event)}</h4>
        <p>{getEventProvider(event)}</p>
        {getEventDescription(event) ? <span className="cal-event-card-note">{getEventDescription(event)}</span> : null}
      </div>
      {onSelect ? (
        <button type="button" className="cal-icon-action" onClick={() => onSelect(event)} title="Ver actividad">
          <Eye size={15} />
        </button>
      ) : null}
    </article>
  );
}

function AgendaTimelineItem({ event, onSelect }) {
  const cfg = getTypeConfig(event);
  const status = getStatusConfig(event);
  const Icon = cfg.icon;
  const time = getEventTime(event);

  return (
    <article className="cal-timeline-item" style={{ '--event-color': cfg.color, '--event-bg': cfg.bg, '--event-border': cfg.border }}>
      <div className="cal-timeline-time">{time || '--:--'}</div>
      <div className="cal-timeline-dot"><Icon size={15} /></div>
      <div className="cal-timeline-content">
        <div className="cal-timeline-main">
          <div>
            <div className="cal-timeline-title">
              <span>{cfg.label}</span>
              <strong>{getEventTitle(event)}</strong>
            </div>
            <p>{getEventProvider(event)}</p>
            {getEventDescription(event) ? <small>{getEventDescription(event)}</small> : null}
          </div>
          <span className={`cal-status-chip ${status.className}`}>{status.label}</span>
        </div>
        <div className="cal-timeline-actions" aria-label="Acciones de agenda">
          <button type="button" onClick={() => onSelect(event)} title="Ver en calendario"><Eye size={14} /> Ver</button>
          <button type="button" onClick={() => onSelect(event)} title="Editar actividad"><Pencil size={14} /> Editar</button>
          <button type="button" disabled title="Completar requiere flujo de actualizacion"><Check size={14} /> Completar</button>
          <button type="button" disabled title="Reprogramar requiere flujo de actualizacion"><RotateCcw size={14} /> Reprogramar</button>
          <button type="button" disabled title="Cancelar requiere flujo de actualizacion"><XCircle size={14} /> Cancelar</button>
        </div>
      </div>
    </article>
  );
}

export default function Calendario() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState({
    day: new Date().getDate(),
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
  });
  const [viewMode, setViewMode] = useState('calendar');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agendaRange, setAgendaRange] = useState('7d');
  const [listDateFilter, setListDateFilter] = useState('all');

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['calendario-agenda'] });
    queryClient.invalidateQueries({ queryKey: ['oportunidades'] });
  }, [queryClient]);

  useEffect(() => {
    window.addEventListener('gestion:quick-capture-saved', handleRefresh);
    return () => window.removeEventListener('gestion:quick-capture-saved', handleRefresh);
  }, [handleRefresh]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const from = new Date(year - 1, month, 1).toISOString();
  const to = new Date(year + 1, month + 1, 0).toISOString();

  const { data: agendaRes, isLoading: loadingAgenda } = useCalendarioAgenda({ from, to });
  const { data: activeRes, isLoading: loadingActive } = useOportunidades({ seguimientoEstado: 'activo', limit: 200 });
  const { data: pausedRes, isLoading: loadingPaused } = useOportunidades({ seguimientoEstado: 'pausado', limit: 200 });

  const loading = loadingAgenda || loadingActive || loadingPaused;

  const data = useMemo(() => {
    if (loading) return { events: [], activeCount: 0, pausedCount: 0 };

    const agenda = toList(agendaRes);
    const active = toList(activeRes);
    const paused = toList(pausedRes);

    return {
      events: [
        ...agenda,
        ...active.map((item) => buildFollowupEvent(item, 'seguimiento')),
        ...paused.map((item) => buildFollowupEvent(item, 'pausado')),
      ],
      activeCount: active.length,
      pausedCount: paused.length,
    };
  }, [agendaRes, activeRes, pausedRes, loading]);

  const events = useMemo(() => {
    return (data?.events || [])
      .filter((ev) => getEventDate(ev))
      .sort(compareEventsOldestFirst);
  }, [data]);

  const availableTypes = useMemo(() => {
    const set = new Map();
    events.forEach((ev) => {
      const key = getEventType(ev);
      const cfg = TYPE_CONFIG[key] || TYPE_CONFIG.default;
      set.set(key, cfg.label);
    });
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [events]);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((ev) => {
      const type = getEventType(ev);
      const status = getStatusConfig(ev);
      const haystack = [
        getEventTitle(ev),
        getEventProvider(ev),
        getEventResponsible(ev),
        getEventDescription(ev),
        type,
      ].join(' ').toLowerCase();

      if (term && !haystack.includes(term)) return false;
      if (typeFilter !== 'all' && type !== typeFilter) return false;
      if (statusFilter !== 'all' && status.className !== statusFilter) return false;
      return true;
    });
  }, [events, search, typeFilter, statusFilter]);

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const days = [];
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    for (let i = startOffset; i > 0; i -= 1) {
      days.push({ day: prevMonthLastDay - i + 1, month: month - 1, year, isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i += 1) {
      days.push({ day: i, month, year, isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i += 1) {
      days.push({ day: i, month: month + 1, year, isCurrentMonth: false });
    }
    return days;
  }, [month, year]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    filteredEvents.forEach((ev) => {
      const date = getEventDate(ev);
      const key = dateKeyFromDate(date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    });
    map.forEach((items) => items.sort(compareEventsOldestFirst));
    return map;
  }, [filteredEvents]);

  const getDayEvents = useCallback((day, monthValue, yearValue) => {
    const date = new Date(yearValue, monthValue, day);
    return eventsByDay.get(dateKeyFromDate(date)) || [];
  }, [eventsByDay]);

  const selectedDate = selectedDay ? new Date(selectedDay.year, selectedDay.month, selectedDay.day) : null;
  const daySelectedEvents = selectedDate ? eventsByDay.get(dateKeyFromDate(selectedDate)) || [] : [];
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const timelineEvents = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const sevenDaysEnd = endOfDay(new Date());
    sevenDaysEnd.setDate(todayEnd.getDate() + 7);
    const thirtyDaysEnd = endOfDay(new Date());
    thirtyDaysEnd.setDate(todayEnd.getDate() + 30);

    return filteredEvents
      .filter((ev) => isPlanningEvent(ev) && isFutureOrToday(ev))
      .filter((ev) => {
        const date = getEventDate(ev);
        if (!date) return false;
        if (agendaRange === 'today') return date >= todayStart && date <= todayEnd;
        if (agendaRange === '7d') return date >= todayStart && date <= sevenDaysEnd;
        if (agendaRange === '30d') return date >= todayStart && date <= thirtyDaysEnd;
        return true;
      })
      .sort(compareEventsOldestFirst);
  }, [filteredEvents, agendaRange]);

  const agendaGroups = useMemo(() => {
    const groups = new Map();
    timelineEvents.forEach((ev) => {
      const date = getEventDate(ev);
      const key = dateKeyFromDate(date);
      if (!groups.has(key)) groups.set(key, { date, items: [] });
      groups.get(key).items.push(ev);
    });
    return Array.from(groups.values())
      .map((group) => ({ ...group, items: [...group.items].sort(compareEventsOldestFirst) }))
      .sort((a, b) => a.date - b.date);
  }, [timelineEvents]);

  const visibleListEvents = useMemo(() => {
    const monthStart = new Date(year, month, 1).getTime();
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59).getTime();
    return filteredEvents.filter((ev) => {
      const date = getEventDate(ev)?.getTime();
      if (listDateFilter === 'month') return date >= monthStart && date <= monthEnd;
      if (listDateFilter === 'future') return isFutureOrToday(ev);
      if (listDateFilter === 'past') return date < startOfDay(new Date()).getTime();
      return true;
    }).sort(compareEventsNewestFirst);
  }, [filteredEvents, listDateFilter, month, year]);

  const changeMonth = (delta) => {
    const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1);
    setCurrentDate(next);
    setSelectedDay({ day: 1, month: next.getMonth(), year: next.getFullYear() });
  };

  const changeWeek = (delta) => {
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + (delta * 7));
    setCurrentDate(next);
    setSelectedDay({ day: next.getDate(), month: next.getMonth(), year: next.getFullYear() });
  };

  const changePeriod = (delta) => {
    if (viewMode === 'week') changeWeek(delta);
    else changeMonth(delta);
  };

  const selectEventDay = (event) => {
    const date = getEventDate(event);
    if (!date) return;
    setSelectedDay({ day: date.getDate(), month: date.getMonth(), year: date.getFullYear() });
    setCurrentDate(date);
    setViewMode('calendar');
  };

  const periodLabel = viewMode === 'week'
    ? `Semana ${pad2(weekDays[0].getDate())}-${MONTHS[weekDays[0].getMonth()].slice(0, 3)}`
    : `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  return (
    <div className="calendario-main-wrapper">
      <div className="calendario-header-bar">
        <div>
          <h2 className="calendario-title-text">Calendario de Actividades</h2>
          <p>Gestion operativa de compromisos, visitas, muestreos y seguimientos.</p>
        </div>
        <div className="calendario-actions-bar">
          <div className="cal-kpi-soft"><Target size={15} /><strong>{data?.activeCount || 0}</strong><span>Seguimientos</span></div>
          <div className="cal-kpi-soft warning"><PauseCircle size={15} /><strong>{data?.pausedCount || 0}</strong><span>Pausados</span></div>
        </div>
      </div>

      <section className="cal-shell">
        <div className="cal-toolbar">
          <div className="cal-view-switch" role="tablist" aria-label="Vista calendario">
            {VIEW_OPTIONS.map((view) => {
              const Icon = view.icon;
              return (
                <button
                  key={view.id}
                  type="button"
                  className={viewMode === view.id ? 'active' : ''}
                  onClick={() => setViewMode(view.id)}
                >
                  <Icon size={15} />
                  {view.label}
                </button>
              );
            })}
          </div>

          <div className="cal-period-nav">
            <button type="button" onClick={() => changePeriod(-1)}><ChevronLeft size={18} /></button>
            <strong>{periodLabel}</strong>
            <button type="button" onClick={() => changePeriod(1)}><ChevronRight size={18} /></button>
          </div>

          <button
            type="button"
            className="mx-btn mx-btn-outline sm cal-today-btn"
            onClick={() => {
              const today = new Date();
              setCurrentDate(today);
              setSelectedDay({ day: today.getDate(), month: today.getMonth(), year: today.getFullYear() });
            }}
          >
            Hoy
          </button>
        </div>

        {(viewMode === 'list' || viewMode === 'agenda') && (
          <div className={`cal-filters ${viewMode === 'agenda' ? 'is-agenda' : ''}`}>
            <div className="cal-search-box">
              <Search size={17} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar actividad, proveedor o responsable..." />
            </div>
            {viewMode === 'list' ? (
              <label className="cal-filter-select">
                <CalendarClock size={15} />
                <select value={listDateFilter} onChange={(e) => setListDateFilter(e.target.value)}>
                  {LIST_DATE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            ) : (
              <label className="cal-filter-select">
                <CalendarClock size={15} />
                <select value={agendaRange} onChange={(e) => setAgendaRange(e.target.value)}>
                  {AGENDA_RANGE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            )}
            <label className="cal-filter-select">
              <Filter size={15} />
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">Todos los tipos</option>
                {availableTypes.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            {viewMode === 'list' && (
              <label className="cal-filter-select">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">Todos los estados</option>
                  <option value="is-pending">Pendiente</option>
                  <option value="is-active">Activo</option>
                  <option value="is-done">Completado</option>
                  <option value="is-paused">Pausado</option>
                  <option value="is-cancelled">Cancelado</option>
                  <option value="is-overdue">Vencido</option>
                </select>
              </label>
            )}
          </div>
        )}

        {loading ? (
          <div className="mx-loading-placeholder">
            <div className="mx-spinner" />
            <p>Cargando agenda...</p>
          </div>
        ) : (
          <div className={`cal-content-grid ${viewMode !== 'calendar' ? 'is-wide' : ''}`}>
            <main className="cal-main-panel">
              {viewMode === 'calendar' && (
                <>
                  <div className="cal-dow-row">
                    {DOW.map((day) => <div key={day} className="cal-dow-cell">{day}</div>)}
                  </div>
                  <div className="cal-days-grid">
                    {calendarGrid.map((day, idx) => {
                      const dayEvs = getDayEvents(day.day, day.month, day.year);
                      const cellDate = new Date(day.year, day.month, day.day);
                      const isToday = dateKeyFromDate(new Date()) === dateKeyFromDate(cellDate);
                      const isSelected = selectedDay?.day === day.day && selectedDay?.month === day.month && selectedDay?.year === day.year;

                      return (
                        <button
                          type="button"
                          key={`${day.year}-${day.month}-${day.day}-${idx}`}
                          className={`cal-day-cell ${day.isCurrentMonth ? '' : 'is-muted'} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => setSelectedDay(day)}
                        >
                          <div className="cal-day-header">
                            <span className="cal-day-number">{day.day}</span>
                            {dayEvs.length > 0 ? <span className="cal-day-count">{dayEvs.length}</span> : null}
                          </div>
                          <div className="cal-events-stack">
                            {dayEvs.slice(0, 3).map((ev) => <EventPill key={ev.id || `${getEventTitle(ev)}-${getEventTime(ev)}`} event={ev} compact />)}
                            {dayEvs.length > 3 ? <span className="cal-more-events">+{dayEvs.length - 3} mas</span> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {viewMode === 'week' && (
                <div className="cal-week-board">
                  {weekDays.map((day) => {
                    const dayEvents = eventsByDay.get(dateKeyFromDate(day)) || [];
                    const isToday = dateKeyFromDate(day) === dateKeyFromDate(new Date());
                    return (
                      <section key={dateKeyFromDate(day)} className={`cal-week-column ${isToday ? 'is-today' : ''}`}>
                        <header>
                          <span>{DOW[(day.getDay() + 6) % 7]}</span>
                          <strong>{day.getDate()}</strong>
                        </header>
                        <div className="cal-week-events">
                          {dayEvents.length ? dayEvents.map((ev) => <EventCard key={ev.id || `${getEventTitle(ev)}-${getEventTime(ev)}`} event={ev} onSelect={selectEventDay} />) : <span className="cal-empty-dash">-</span>}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}

              {viewMode === 'list' && (
                <div className="cal-table-wrap">
                  <div className="cal-view-context">
                    <span>Gestion / historial</span>
                    <strong>{visibleListEvents.length} actividades registradas</strong>
                    <p>Incluye actividades ejecutadas, pendientes, activas, pausadas y canceladas disponibles en el periodo cargado.</p>
                  </div>
                  <table className="cal-activity-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Hora</th>
                        <th>Tipo</th>
                        <th>Proveedor / Cliente</th>
                        <th>Actividad</th>
                        <th>Estado</th>
                        <th>Responsable</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleListEvents.length ? visibleListEvents.map((ev) => {
                        const cfg = getTypeConfig(ev);
                        const Icon = cfg.icon;
                        const status = getStatusConfig(ev);
                        return (
                          <tr key={ev.id || `${getEventTitle(ev)}-${getEventDate(ev)?.toISOString()}`}>
                            <td>{formatShortDate(getEventDate(ev))}</td>
                            <td>{getEventTime(ev) || '-'}</td>
                            <td><span className="cal-type-chip" style={{ '--event-color': cfg.color, '--event-bg': cfg.bg, '--event-border': cfg.border }}><Icon size={13} />{cfg.label}</span></td>
                            <td><strong>{getEventProvider(ev)}</strong></td>
                            <td>{getEventTitle(ev)}</td>
                            <td><span className={`cal-status-chip ${status.className}`}>{status.label}</span></td>
                            <td>{getEventResponsible(ev)}</td>
                            <td>
                              <button type="button" className="cal-icon-action" onClick={() => selectEventDay(ev)} title="Ver en calendario">
                                <Eye size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr><td colSpan="8"><div className="cal-empty-table">Sin actividades para los filtros seleccionados.</div></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {viewMode === 'agenda' && (
                <div className="cal-agenda-list">
                  <div className="cal-view-context is-planning">
                    <span>Planificacion / agenda</span>
                    <strong>{timelineEvents.length} actividades futuras</strong>
                    <p>Solo muestra compromisos programados hacia adelante que estan pendientes, activos o pausados.</p>
                  </div>
                  {agendaGroups.length ? agendaGroups.map((group) => (
                    <section key={dateKeyFromDate(group.date)} className="cal-agenda-day">
                      <div className="cal-agenda-date">
                        <strong>{formatDayHeading(group.date)}</strong>
                        <span>{formatShortDate(group.date)}</span>
                      </div>
                      <div className="cal-timeline-items">
                        {group.items.map((ev) => <AgendaTimelineItem key={ev.id || `${getEventTitle(ev)}-${getEventTime(ev)}`} event={ev} onSelect={selectEventDay} />)}
                      </div>
                    </section>
                  )) : (
                    <div className="cal-empty-table">
                      Sin actividades futuras para el filtro seleccionado.
                    </div>
                  )}
                </div>
              )}
            </main>

            {viewMode === 'calendar' && (
              <aside className="cal-aside-panel">
                <div className="cal-aside-header">
                  <span>Agenda del dia</span>
                  <h3>{selectedDate ? formatDayHeading(selectedDate) : 'Selecciona un dia'}</h3>
                  <p>{daySelectedEvents.length ? `${daySelectedEvents.length} actividades programadas` : 'Sin actividades programadas'}</p>
                </div>
                <div className="cal-aside-list">
                  {daySelectedEvents.length ? daySelectedEvents.map((ev) => (
                    <EventCard key={ev.id || `${getEventTitle(ev)}-${getEventTime(ev)}`} event={ev} />
                  )) : (
                    <div className="cal-empty-state">
                      <CalendarDays size={34} />
                      <strong>Dia despejado</strong>
                      <span>No hay compromisos registrados para esta fecha.</span>
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
