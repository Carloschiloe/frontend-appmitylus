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
    <div className="calendario-main-wrapper">
      <div className="calendario-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="calendario-title-text" style={{ margin: 0 }}>Agenda y Calendario</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Gestiona compromisos, visitas y seguimientos.
          </p>
        </div>
        <div className="calendario-actions-bar" style={{ display: 'flex', alignItems: 'center' }}>
          <div className="mx-badge mx-badge-info" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Target size={14} /> <strong>{data?.activeCount || 0}</strong> Seguimientos
          </div>
          <div className="mx-badge mx-badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <PauseCircle size={14} /> <strong>{data?.pausedCount || 0}</strong> Pausados
          </div>
        </div>
      </div>

      <div className="calendario-layout-grid">
        <div className="mx-card calendario-grid-card">
          <div style={{ padding: '20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="calendario-month-nav">
              <button className="calendario-nav-btn" onClick={() => changeMonth(-1)}><ChevronLeft size={20} /></button>
              <div className="calendario-nav-label">
                {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
              </div>
              <button className="calendario-nav-btn" onClick={() => changeMonth(1)}><ChevronRight size={20} /></button>
            </div>
            <button className="mx-btn mx-btn-outline sm" onClick={() => setCurrentDate(new Date())}>Hoy</button>
          </div>

          <div className="calendario-dow-row">
            {DOW.map(d => <div key={d} className="calendario-dow-cell">{d}</div>)}
          </div>
          <div className="calendario-days-grid">
            {calendarGrid.map((day, idx) => {
              const dayEvs = getDayEvents(day.day, day.month, day.year);
              const isToday = new Date().getDate() === day.day && new Date().getMonth() === day.month && new Date().getFullYear() === day.year;
              const isSelected = selectedDay?.day === day.day && selectedDay?.month === day.month && selectedDay?.year === day.year;

              return (
                <div 
                  key={idx} 
                  className="calendario-day-cell"
                  style={{ 
                    background: isSelected ? 'var(--color-primary-50)' : day.isCurrentMonth ? 'var(--color-surface)' : '#f8fafc',
                    boxShadow: isSelected ? 'inset 0 0 0 2px var(--color-primary)' : 'none'
                  }}
                  onClick={() => setSelectedDay(day)}
                >
                  <div className="calendario-day-header">
                    <div className="calendario-day-number" style={{ 
                      background: isToday ? 'var(--color-primary)' : 'transparent',
                      color: isToday ? '#fff' : (day.isCurrentMonth ? 'var(--color-text)' : 'var(--color-text-muted)')
                    }}>
                      {day.day}
                    </div>
                    {dayEvs.length > 0 && <div className="calendario-day-count">{dayEvs.length} act</div>}
                  </div>
                  <div className="calendario-events-wrapper">
                    {dayEvs.slice(0, 3).map((ev, i) => {
                      const cfg = TYPE_CONFIG[ev.kind] || TYPE_CONFIG.default;
                      return (
                        <div key={i} className="calendario-event-badge" style={{ backgroundColor: cfg.color, color: '#fff' }} title={ev.title}>
                          {ev.title}
                        </div>
                      );
                    })}
                    {dayEvs.length > 3 && <div className="calendario-event-more">+{dayEvs.length - 3} más</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mx-card calendario-aside">
          <div className="calendario-aside-header">
            <h3 className="calendario-aside-title">{selectedDay ? `${selectedDay.day} de ${MONTHS[selectedDay.month]}` : 'Agenda del día'}</h3>
            <p className="calendario-aside-subtitle">{selectedDay ? 'Detalles de la fecha' : 'Selecciona un día en el calendario'}</p>
          </div>

          <div className="calendario-aside-list">
            {daySelectedEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-subtle)' }}>
                <Clock size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p style={{ margin: 0 }}>No hay eventos para este día</p>
              </div>
            ) : (
              daySelectedEvents.map((ev, i) => {
                const cfg = TYPE_CONFIG[ev.kind] || TYPE_CONFIG.default;
                const Icon = cfg.icon;
                return (
                  <div key={i} className="calendario-event-card">
                    <div className="calendario-event-card-border" style={{ backgroundColor: cfg.color }} />
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{ color: cfg.color, marginTop: '2px' }}><Icon size={18} /></div>
                      <div>
                        <div className="calendario-event-card-type" style={{ color: cfg.color }}>{cfg.label}</div>
                        <div className="calendario-event-card-title">{ev.title}</div>
                        {ev.proveedorNombre && <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '4px' }}>{ev.proveedorNombre}</div>}
                        {ev.resumen && <div className="calendario-event-card-desc">{ev.resumen}</div>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
