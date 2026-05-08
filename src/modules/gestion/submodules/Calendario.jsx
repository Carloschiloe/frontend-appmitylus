import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  MessageSquare,
  Beaker,
  Phone,
  Users,
  CheckCircle2,
  PauseCircle,
  Target,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/apiClient';
import { 
  useCalendarioAgenda, 
  useOportunidades 
} from '../hooks/useGestionQueries';
import './calendario.css';

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const TYPE_CONFIG = {
  interaccion: { icon: MessageSquare, color: '#6366f1', label: 'Interacción' },
  llamada: { icon: Phone, color: '#6366f1', label: 'Llamada' },
  reunion: { icon: Users, color: '#f59e0b', label: 'Reunión' },
  tarea: { icon: CheckCircle2, color: '#10b981', label: 'Compromiso' },
  visita: { icon: MapPin, color: '#0ea5e9', label: 'Visita' },
  muestreo: { icon: Beaker, color: '#f43f5e', label: 'Muestreo' },
  seguimiento: { icon: Target, color: '#0f766e', label: 'Seguimiento activo' },
  pausado: { icon: PauseCircle, color: '#f59e0b', label: 'Pausado' },
  default: { icon: Clock, color: '#94a3b8', label: 'Evento' },
};

const PAUSE_REASON_LABELS = {
  esperando_crecimiento: 'Esperando crecimiento',
  esperando_disponibilidad: 'Esperando disponibilidad',
  esperando_respuesta: 'Esperando respuesta',
  esperando_resultado_muestra: 'Esperando resultado de muestra',
  esperando_decision_interna: 'Esperando decisión interna',
};

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return new Date(dateStr);
  return new Date(y, m - 1, d);
}

function toList(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || payload?.data || [];
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
    title: item.proximaAccion || (kind === 'pausado' ? 'Revisar caso pausado' : 'Definir próximo paso'),
    resumen: kind === 'pausado'
      ? getPauseReasonLabel(item.motivoPausa)
      : (item.notasTrato || item.estado || 'Seguimiento pendiente'),
    proximoPaso: item.proximaAccion || '',
  };
}

export default function Calendario() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

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
  const from = new Date(year, month - 1, 1).toISOString();
  const to = new Date(year, month + 2, 0).toISOString();

  // 1. Carga de datos con React Query
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

  const events = useMemo(() => data?.events || [], [data]);

  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
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
  }, [currentDate]);

  const getDayEvents = useCallback((day, month, year) => {
    return events.filter((ev) => {
      const d = parseLocalDate(ev.date);
      if (!d) return false;
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  }, [events]);

  const changeMonth = (delta) => {
    const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1);
    setCurrentDate(next);
    setSelectedDay(null);
  };

  const daySelectedEvents = useMemo(() => {
    if (!selectedDay) return [];
    return getDayEvents(selectedDay.day, selectedDay.month, selectedDay.year);
  }, [selectedDay, getDayEvents]);

  return (
    <div className="mx-calendario-wrap">
      <div className="mx-calendario-main">
        <div className="mx-calendario-header">
          <div className="mx-cal-nav">
            <h2 className="mx-cal-title">
              {MONTHS[currentDate.getMonth()]} <span>{currentDate.getFullYear()}</span>
            </h2>
            <div className="mx-cal-arrows">
              <button className="mx-btn-icon" onClick={() => changeMonth(-1)}><ChevronLeft size={20} /></button>
              <button className="mx-btn-icon" onClick={() => changeMonth(1)}><ChevronRight size={20} /></button>
              <button className="mx-btn mx-btn-outline sm" style={{ marginLeft: 8 }} onClick={() => setCurrentDate(new Date())}>Hoy</button>
            </div>
          </div>

          <div className="mx-cal-stats">
            <div className="mx-cal-stat is-active">
              <Target size={14} /> <strong>{data?.activeCount || 0}</strong> Seguimientos
            </div>
            <div className="mx-cal-stat is-paused">
              <PauseCircle size={14} /> <strong>{data?.pausedCount || 0}</strong> Pausados
            </div>
          </div>
        </div>

        <div className="mx-cal-grid">
          {DOW.map(d => <div key={d} className="mx-cal-dow">{d}</div>)}
          {calendarGrid.map((day, idx) => {
            const dayEvs = getDayEvents(day.day, day.month, day.year);
            const isToday = new Date().getDate() === day.day && new Date().getMonth() === day.month && new Date().getFullYear() === day.year;
            const isSelected = selectedDay?.day === day.day && selectedDay?.month === day.month && selectedDay?.year === day.year;

            return (
              <div 
                key={idx} 
                className={`mx-cal-day ${day.isCurrentMonth ? '' : 'is-prev'} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
                onClick={() => setSelectedDay(day)}
              >
                <span className="mx-cal-day-num">{day.day}</span>
                <div className="mx-cal-day-events">
                  {dayEvs.slice(0, 3).map((ev, i) => {
                    const cfg = TYPE_CONFIG[ev.kind] || TYPE_CONFIG.default;
                    return (
                      <div key={i} className="mx-cal-event-dot" style={{ backgroundColor: cfg.color }} title={ev.title} />
                    );
                  })}
                  {dayEvs.length > 3 && <span className="mx-cal-more">+{dayEvs.length - 3}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mx-calendario-side">
        <div className="mx-cal-side-head">
          <h3>{selectedDay ? `${selectedDay.day} de ${MONTHS[selectedDay.month]}` : 'Agenda del día'}</h3>
          {!selectedDay && <p>Selecciona un día para ver detalles</p>}
        </div>

        <div className="mx-cal-side-list">
          {daySelectedEvents.length === 0 ? (
            <div className="mx-cal-empty">
              <Clock size={32} />
              <p>No hay eventos para este día</p>
            </div>
          ) : (
            daySelectedEvents.map((ev, i) => {
              const cfg = TYPE_CONFIG[ev.kind] || TYPE_CONFIG.default;
              const Icon = cfg.icon;
              return (
                <div key={i} className="mx-cal-item">
                  <div className="mx-cal-item-icon" style={{ backgroundColor: cfg.color }}>
                    <Icon size={16} />
                  </div>
                  <div className="mx-cal-item-info">
                    <div className="mx-cal-item-meta">
                      <span style={{ color: cfg.color }}>{cfg.label}</span>
                      {ev.proveedorNombre && <strong>{ev.proveedorNombre}</strong>}
                    </div>
                    <div className="mx-cal-item-title">{ev.title}</div>
                    {ev.resumen && <div className="mx-cal-item-desc">{ev.resumen}</div>}
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
