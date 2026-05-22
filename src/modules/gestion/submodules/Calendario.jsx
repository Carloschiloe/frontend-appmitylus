import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  ListChecks,
  PauseCircle,
  Search,
  Target,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCalendarioAgenda, useOportunidades } from '../hooks/useGestionQueries';
import './calendario.css';

const DOW = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const VIEW_OPTIONS = [
  { id: 'list', label: 'Lista operativa', icon: ListChecks },
  { id: 'calendar', label: 'Calendario', icon: CalendarDays },
  { id: 'paused', label: 'Pausados', icon: PauseCircle },
];

const RANGE_OPTIONS = [
  { id: 'all', label: 'Todo pendiente' },
  { id: 'today', label: 'Hoy' },
  { id: 'overdue', label: 'Vencidos' },
  { id: '7d', label: 'Proximos 7 dias' },
  { id: '30d', label: 'Proximos 30 dias' },
];

const TYPE_LABELS = {
  muestreo: 'Muestreo',
  visita: 'Visita',
  llamada: 'Llamada',
  reunion: 'Negociacion',
  negociacion: 'Negociacion',
  seguimiento: 'Seguimiento',
  interaccion: 'Seguimiento',
  pausado: 'Pausado',
  tarea: 'Tarea',
  default: 'Actividad',
};

const STATUS_LABELS = {
  active: 'Pendiente',
  overdue: 'Vencido',
  paused: 'Pausado',
};

const PAUSE_REASON_LABELS = {
  esperando_crecimiento: 'Esperando crecimiento',
  esperando_disponibilidad: 'Esperando disponibilidad',
  esperando_respuesta: 'Esperando respuesta',
  esperando_resultado_muestra: 'Esperando resultado de muestra',
  esperando_decision_interna: 'Esperando decision interna',
};

function toList(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || payload?.data || [];
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function parseLocalDate(value) {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  const [year, month, day] = text.split('-').map(Number);
  if (year && month && day) return new Date(year, month - 1, day);
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function dateKey(date) {
  if (!date) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatShortDate(date) {
  if (!date) return '-';
  return `${pad2(date.getDate())}-${pad2(date.getMonth() + 1)}-${date.getFullYear()}`;
}

function formatLongDate(date) {
  if (!date) return 'Sin fecha';
  return date.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

function normalizeKind(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('muestra') || text.includes('muestreo')) return 'muestreo';
  if (text.includes('visita')) return 'visita';
  if (text.includes('llamada') || text.includes('telefono')) return 'llamada';
  if (text.includes('negoci') || text.includes('reunion')) return 'negociacion';
  if (text.includes('paus')) return 'pausado';
  if (text.includes('seguim')) return 'seguimiento';
  return text || 'default';
}

function getRawEventDate(item) {
  return parseLocalDate(item.date || item.fechaProximo || item.fechaActividad || item.fechaProximaAccion || item.fechaRevision || item.nextActionAt);
}

function getRawEventTime(item) {
  const raw = item.hora || item.time || item.fechaHora || item.startsAt || item.date;
  if (!raw) return '';
  const match = String(raw).match(/(\d{1,2}):(\d{2})/);
  if (match) return `${pad2(match[1])}:${match[2]}`;
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime()) && (date.getHours() || date.getMinutes())) {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }
  return '';
}

function compareAgendaItems(a, b) {
  return a.date.getTime() - b.date.getTime() || a.provider.localeCompare(b.provider);
}

function buildFollowupEvent(item, kind) {
  const date = parseLocalDate(item.fechaProximaAccion || item.fechaRevision || item.nextActionAt);
  if (!date) return null;

  return {
    id: `opp-${item._id}`,
    source: 'oportunidad',
    sourceId: item._id,
    kind,
    date,
    time: '',
    provider: item.proveedorNombre || 'Proveedor sin nombre',
    title: item.proximaAccion || (kind === 'pausado' ? 'Revisar caso pausado' : 'Definir proximo paso'),
    description: kind === 'pausado'
      ? PAUSE_REASON_LABELS[item.motivoPausa] || 'En espera'
      : (item.notasTrato || item.estado || 'Seguimiento pendiente'),
    responsible: item.responsableNombre || item.responsable || '-',
    status: kind === 'pausado' ? 'paused' : 'active',
  };
}

function buildCalendarEvent(item) {
  const date = getRawEventDate(item);
  if (!date) return null;
  const kind = normalizeKind(item.kind || item.tipo || item.type || item.categoria || item.actividadTipo);
  const rawStatus = String(item.estado || item.status || item.seguimientoEstado || '').toLowerCase();

  return {
    id: item.id || item._id || `${item.proveedorNombre || item.title || 'agenda'}-${dateKey(date)}`,
    source: item.source || 'calendario',
    sourceId: item._id || item.id || '',
    kind,
    date,
    time: getRawEventTime(item),
    provider: item.proveedorNombre || item.contactoNombre || item.clienteNombre || item.empresaNombre || item.proveedor || 'Sin proveedor',
    title: item.title || item.titulo || item.actividad || item.proximaAccion || item.proximoPaso || item.asunto || 'Actividad pendiente',
    description: item.resumen || item.detalle || item.descripcion || item.observacion || item.notas || '',
    responsible: item.responsableNombre || item.responsable || item.usuarioNombre || item.createdByName || '-',
    status: rawStatus === 'pausado' ? 'paused' : 'active',
  };
}

function withDerivedStatus(item, today) {
  if (item.status === 'paused') return item;
  return item.date.getTime() < today.getTime() ? { ...item, status: 'overdue' } : item;
}

function matchesRange(item, range, today) {
  const itemTime = item.date.getTime();
  if (range === 'today') return itemTime >= today.getTime() && itemTime <= endOfDay(today).getTime();
  if (range === 'overdue') return item.status === 'overdue';
  if (range === '7d') return itemTime >= today.getTime() && itemTime <= endOfDay(addDays(today, 7)).getTime();
  if (range === '30d') return itemTime >= today.getTime() && itemTime <= endOfDay(addDays(today, 30)).getTime();
  return true;
}

function AgendaStatus({ status }) {
  return <span className={`agenda-status is-${status}`}>{STATUS_LABELS[status] || 'Pendiente'}</span>;
}

function AgendaType({ kind }) {
  return <span className={`agenda-type is-${kind}`}>{TYPE_LABELS[kind] || TYPE_LABELS.default}</span>;
}

function AgendaActions({ item, onViewCalendar }) {
  return (
    <div className="agenda-row-actions">
      <button type="button" className="cal-icon-action" onClick={() => onViewCalendar(item)} title="Ver en calendario">
        <Eye size={15} />
      </button>
    </div>
  );
}

function AgendaTable({ items, emptyText, onViewCalendar }) {
  return (
    <div className="agenda-table-wrap">
      <table className="agenda-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Estado</th>
            <th>Proveedor</th>
            <th>Accion pendiente</th>
            <th>Origen</th>
            <th>Responsable</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.length ? items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{formatShortDate(item.date)}</strong>
                {item.time ? <span>{item.time}</span> : null}
              </td>
              <td><AgendaStatus status={item.status} /></td>
              <td className="agenda-provider-cell">{item.provider}</td>
              <td>
                <div className="agenda-action-cell">
                  <strong>{item.title}</strong>
                  {item.description ? <span>{item.description}</span> : null}
                </div>
              </td>
              <td><AgendaType kind={item.kind} /></td>
              <td>{item.responsible}</td>
              <td><AgendaActions item={item} onViewCalendar={onViewCalendar} /></td>
            </tr>
          )) : (
            <tr>
              <td colSpan="7">
                <div className="agenda-empty-table">{emptyText}</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function Calendario() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState('list');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [range, setRange] = useState('all');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

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
  const today = useMemo(() => startOfDay(new Date()), []);

  const agendaItems = useMemo(() => {
    if (loading) return [];

    const calendarItems = toList(agendaRes).map(buildCalendarEvent).filter(Boolean);
    const activeItems = toList(activeRes).map((item) => buildFollowupEvent(item, 'seguimiento')).filter(Boolean);
    const pausedItems = toList(pausedRes).map((item) => buildFollowupEvent(item, 'pausado')).filter(Boolean);

    return [...calendarItems, ...activeItems, ...pausedItems]
      .map((item) => withDerivedStatus(item, today))
      .filter((item) => ['active', 'overdue', 'paused'].includes(item.status))
      .sort(compareAgendaItems);
  }, [agendaRes, activeRes, pausedRes, loading, today]);

  const availableTypes = useMemo(() => {
    const map = new Map();
    agendaItems.forEach((item) => map.set(item.kind, TYPE_LABELS[item.kind] || TYPE_LABELS.default));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [agendaItems]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return agendaItems.filter((item) => {
      const haystack = `${item.provider} ${item.title} ${item.description} ${item.responsible}`.toLowerCase();
      if (term && !haystack.includes(term)) return false;
      if (typeFilter !== 'all' && item.kind !== typeFilter) return false;
      if (viewMode === 'paused' && item.status !== 'paused') return false;
      if (viewMode !== 'paused' && item.status === 'paused' && range !== 'all') return matchesRange(item, range, today);
      return matchesRange(item, range, today);
    });
  }, [agendaItems, range, search, today, typeFilter, viewMode]);

  const kpis = useMemo(() => {
    const todayEnd = endOfDay(today).getTime();
    const sevenEnd = endOfDay(addDays(today, 7)).getTime();
    return {
      today: agendaItems.filter((item) => item.date.getTime() >= today.getTime() && item.date.getTime() <= todayEnd && item.status !== 'paused').length,
      overdue: agendaItems.filter((item) => item.status === 'overdue').length,
      next7: agendaItems.filter((item) => item.date.getTime() >= today.getTime() && item.date.getTime() <= sevenEnd && item.status !== 'paused').length,
      paused: agendaItems.filter((item) => item.status === 'paused').length,
      total: agendaItems.length,
    };
  }, [agendaItems, today]);

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const days = [];
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    for (let i = startOffset; i > 0; i -= 1) {
      days.push(new Date(year, month - 1, prevMonthLastDay - i + 1));
    }
    for (let i = 1; i <= lastDay.getDate(); i += 1) {
      days.push(new Date(year, month, i));
    }
    while (days.length < 42) {
      const last = days[days.length - 1];
      days.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
    }
    return days;
  }, [month, year]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    agendaItems.forEach((item) => {
      const key = dateKey(item.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    map.forEach((items) => items.sort(compareAgendaItems));
    return map;
  }, [agendaItems]);

  const selectedDayItems = eventsByDay.get(dateKey(selectedDate)) || [];
  const periodLabel = `${MONTHS[month]} ${year}`;

  function changeMonth(delta) {
    const next = new Date(year, month + delta, 1);
    setCurrentDate(next);
    setSelectedDate(next);
  }

  function viewItemInCalendar(item) {
    setCurrentDate(new Date(item.date.getFullYear(), item.date.getMonth(), 1));
    setSelectedDate(item.date);
    setViewMode('calendar');
  }

  return (
    <div className="calendario-main-wrapper agenda-modern">
      <div className="calendario-header-bar">
        <div>
          <h2 className="calendario-title-text">Agenda Operativa</h2>
          <p>Trabajo pendiente, vencido y programado. El historial de lo realizado queda fuera de esta vista.</p>
        </div>
      </div>

      <div className="agenda-kpis">
        <button type="button" onClick={() => { setViewMode('list'); setRange('today'); }}>
          <Target size={16} /><span>Hoy</span><strong>{kpis.today}</strong>
        </button>
        <button type="button" onClick={() => { setViewMode('list'); setRange('overdue'); }}>
          <AlertTriangle size={16} /><span>Vencidos</span><strong>{kpis.overdue}</strong>
        </button>
        <button type="button" onClick={() => { setViewMode('list'); setRange('7d'); }}>
          <CalendarClock size={16} /><span>Prox. 7 dias</span><strong>{kpis.next7}</strong>
        </button>
        <button type="button" onClick={() => { setViewMode('paused'); setRange('all'); }}>
          <PauseCircle size={16} /><span>Pausados</span><strong>{kpis.paused}</strong>
        </button>
        <div>
          <Clock size={16} /><span>Total pendiente</span><strong>{kpis.total}</strong>
        </div>
      </div>

      <section className="cal-shell">
        <div className="cal-toolbar agenda-toolbar">
          <div className="cal-view-switch" role="tablist" aria-label="Vistas de agenda">
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

          {viewMode === 'calendar' ? (
            <div className="cal-period-nav">
              <button type="button" onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button>
              <strong>{periodLabel}</strong>
              <button type="button" onClick={() => changeMonth(1)}><ChevronRight size={18} /></button>
            </div>
          ) : (
            <div className="agenda-filter-row">
              <div className="cal-search-box">
                <Search size={17} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar proveedor, accion o responsable..." />
              </div>
              <label className="cal-filter-select">
                <CalendarClock size={15} />
                <select value={range} onChange={(e) => setRange(e.target.value)}>
                  {RANGE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
              <label className="cal-filter-select">
                <Filter size={15} />
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="all">Todos los tipos</option>
                  {availableTypes.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
            </div>
          )}
        </div>

        {loading ? (
          <div className="mx-loading-placeholder">
            <div className="mx-spinner" />
            <p>Cargando agenda...</p>
          </div>
        ) : (
          <>
            {viewMode === 'list' && (
              <AgendaTable
                items={filteredItems}
                emptyText="No hay pendientes para los filtros seleccionados."
                onViewCalendar={viewItemInCalendar}
              />
            )}

            {viewMode === 'paused' && (
              <AgendaTable
                items={filteredItems}
                emptyText="No hay casos pausados con fecha de revision."
                onViewCalendar={viewItemInCalendar}
              />
            )}

            {viewMode === 'calendar' && (
              <div className="agenda-calendar-layout">
                <main>
                  <div className="cal-dow-row">
                    {DOW.map((day) => <div key={day} className="cal-dow-cell">{day}</div>)}
                  </div>
                  <div className="cal-days-grid">
                    {calendarGrid.map((day) => {
                      const key = dateKey(day);
                      const dayItems = eventsByDay.get(key) || [];
                      const isCurrentMonth = day.getMonth() === month;
                      const isToday = key === dateKey(new Date());
                      const isSelected = key === dateKey(selectedDate);
                      return (
                        <button
                          type="button"
                          key={key}
                          className={`cal-day-cell ${isCurrentMonth ? '' : 'is-muted'} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => setSelectedDate(day)}
                        >
                          <div className="cal-day-header">
                            <span className="cal-day-number">{day.getDate()}</span>
                            {dayItems.length ? <span className="cal-day-count">{dayItems.length}</span> : null}
                          </div>
                          <div className="cal-events-stack">
                            {dayItems.slice(0, 3).map((item) => (
                              <span key={item.id} className={`cal-event-pill is-compact is-${item.status}`}>
                                {item.provider}
                              </span>
                            ))}
                            {dayItems.length > 3 ? <span className="cal-more-events">+{dayItems.length - 3} mas</span> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </main>
                <aside className="cal-aside-panel">
                  <div className="cal-aside-header">
                    <span>Agenda del dia</span>
                    <h3>{formatLongDate(selectedDate)}</h3>
                    <p>{selectedDayItems.length ? `${selectedDayItems.length} pendientes` : 'Sin pendientes'}</p>
                  </div>
                  <div className="agenda-aside-list">
                    {selectedDayItems.length ? selectedDayItems.map((item) => (
                      <article key={item.id} className={`agenda-mini-card is-${item.status}`}>
                        <AgendaStatus status={item.status} />
                        <strong>{item.title}</strong>
                        <span>{item.provider}</span>
                      </article>
                    )) : (
                      <div className="cal-empty-state">
                        <CalendarDays size={34} />
                        <strong>Dia despejado</strong>
                        <span>No hay pendientes para esta fecha.</span>
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
