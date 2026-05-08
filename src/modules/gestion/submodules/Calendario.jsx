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
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../api/apiClient';
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const handleRefresh = () => setRefreshTick((prev) => prev + 1);
    window.addEventListener('gestion:quick-capture-saved', handleRefresh);
    return () => window.removeEventListener('gestion:quick-capture-saved', handleRefresh);
  }, []);

  const { data, isLoading: loading } = useQuery({
    queryKey: ['gestion-agenda', currentDate.getMonth(), currentDate.getFullYear(), refreshTick],
    queryFn: async () => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const from = new Date(year, month - 1, 1).toISOString();
      const to = new Date(year, month + 2, 0).toISOString();

      const [calendarRes, activeRes, pausedRes] = await Promise.all([
        apiClient.get(`/dashboard/calendario?from=${from}&to=${to}`),
        apiClient.get('/oportunidades?seguimientoEstado=activo&limit=200'),
        apiClient.get('/oportunidades?seguimientoEstado=pausado&limit=200'),
      ]);

      return {
        events: [
          ...toList(calendarRes),
          ...toList(activeRes).map((item) => buildFollowupEvent(item, 'seguimiento')),
          ...toList(pausedRes).map((item) => buildFollowupEvent(item, 'pausado')),
        ],
        activeCount: toList(activeRes).length,
        pausedCount: toList(pausedRes).length,
      };
    },
  });

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
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1));
  };

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    return getDayEvents(selectedDay.day, selectedDay.month, selectedDay.year);
  }, [selectedDay, getDayEvents]);

  return (
    <div className="calendario-container calendario-main-wrapper">
      <div className="mx-table-actions calendario-actions-bar am-mb-16">
        <div className="calendario-month-nav">
          <button className="mx-action-btn calendario-nav-btn" onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button>
          <span className="calendario-nav-label">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <button className="mx-action-btn calendario-nav-btn" onClick={() => changeMonth(1)}><ChevronRight size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto', flexWrap: 'wrap' }}>
          <span className="mx-badge mx-badge-info">{data?.activeCount || 0} activos</span>
          <span className="mx-badge mx-badge-warning">{data?.pausedCount || 0} pausados</span>
          <button className="mx-btn mx-btn-outline sm" onClick={() => setCurrentDate(new Date())}>Hoy</button>
        </div>
      </div>

      <div className="calendario-layout-grid">
        <div className="mx-table-card calendario-grid-card">
          <div className="calendario-dow-row">
            {DOW.map((d) => (
              <div key={d} className="calendario-dow-cell">{d}</div>
            ))}
          </div>
          <div className="calendario-days-grid">
            {calendarGrid.map((d, i) => {
              const dayEvents = getDayEvents(d.day, d.month, d.year);
              const isToday = new Date().toDateString() === new Date(d.year, d.month, d.day).toDateString();
              const isSelected = selectedDay && selectedDay.day === d.day && selectedDay.month === d.month;

              return (
                <div
                  key={i}
                  onClick={() => setSelectedDay(d)}
                  className="calendario-day-cell"
                  style={{
                    background: d.isCurrentMonth ? 'white' : '#fcfdfe',
                    boxShadow: isSelected ? 'inset 0 0 0 2px var(--color-primary)' : 'none',
                    zIndex: isSelected ? 1 : 0,
                  }}
                >
                  <div className="calendario-day-header">
                    <span
                      className="calendario-day-number"
                      style={{
                        fontWeight: isToday ? 900 : 600,
                        color: d.isCurrentMonth ? (isToday ? 'var(--color-primary)' : '#475569') : '#cbd5e1',
                        background: isToday ? '#ccfbf1' : 'transparent',
                      }}
                    >
                      {d.day}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="calendario-day-count">{dayEvents.length}</span>
                    )}
                  </div>

                  <div className="calendario-events-wrapper">
                    {dayEvents.slice(0, 3).map((ev, idx) => {
                      const cfg = TYPE_CONFIG[ev.kind] || TYPE_CONFIG.default;
                      return (
                        <div
                          key={idx}
                          className="calendario-event-badge"
                          style={{
                            background: `${cfg.color}10`,
                            color: cfg.color,
                            borderLeft: `3px solid ${cfg.color}`,
                          }}
                          title={ev.proveedorNombre || ev.title}
                        >
                          {ev.proveedorNombre || ev.title || 'Actividad'}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="calendario-event-more">+ {dayEvents.length - 3} más</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="mx-table-card calendario-aside">
          <div className="calendario-aside-header">
            <h3 className="calendario-aside-title">
              {selectedDay ? `${selectedDay.day} de ${MONTHS[selectedDay.month]}` : 'Agenda del día'}
            </h3>
            <p className="calendario-aside-subtitle">{selectedDayEvents.length} actividades</p>
          </div>

          <div className="calendario-aside-list">
            {loading ? (
              <div className="mx-state-placeholder" style={{ minHeight: 180 }}>
                <div className="mx-spinner"></div>
                <p>Construyendo agenda...</p>
              </div>
            ) : selectedDayEvents.length === 0 ? (
              <div className="mx-state-placeholder" style={{ minHeight: 180 }}>
                <Clock size={32} />
                <p>No hay actividad para este día.</p>
              </div>
            ) : (
              selectedDayEvents.map((ev, i) => {
                const cfg = TYPE_CONFIG[ev.kind] || TYPE_CONFIG.default;
                const Icon = cfg.icon;
                return (
                  <div key={i} className="calendario-event-card">
                    <div className="calendario-event-card-border" style={{ background: cfg.color }}></div>
                    <span className="calendario-event-card-type" style={{ color: cfg.color }}>
                      <Icon size={12} style={{ marginRight: 6 }} />
                      {cfg.label}
                    </span>
                    <div className="calendario-event-card-title">
                      {ev.proveedorNombre || ev.contactoNombre || 'Proveedor'}
                    </div>
                    <div className="calendario-event-card-desc">
                      {ev.title || ev.resumen || ev.proximoPaso || 'Sin notas.'}
                    </div>
                    {(ev.resumen || ev.proximoPaso) && (
                      <div className="calendario-event-card-desc" style={{ marginTop: 8, color: 'var(--color-text-subtle)' }}>
                        {ev.resumen || ev.proximoPaso}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
