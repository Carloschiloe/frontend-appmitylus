import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Filter, 
  Plus, 
  MoreVertical,
  Clock,
  MapPin,
  MessageSquare,
  Beaker,
  X,
  Phone,
  Users,
  CheckCircle2
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../api/apiClient';
import './calendario.css';

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const TYPE_CONFIG = {
  interaccion: { icon: MessageSquare, color: '#6366f1', label: 'Interacción' },
  llamada:     { icon: Phone,         color: '#6366f1', label: 'Llamada' },
  reunion:     { icon: Users,         color: '#f59e0b', label: 'Reunión' },
  tarea:       { icon: CheckCircle2,  color: '#10b981', label: 'Compromiso' },
  visita:      { icon: MapPin,        color: '#0ea5e9', label: 'Visita' },
  muestreo:    { icon: Beaker,        color: '#f43f5e', label: 'Muestreo' },
  default:     { icon: Clock,         color: '#94a3b8', label: 'Evento' }
};

// Helper para parsear fecha sin desfase de zona horaria
function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return new Date(dateStr);
  return new Date(y, m - 1, d);
}

export default function Calendario() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: events = [], isLoading: loading } = useQuery({
    queryKey: ['calendario-eventos'],
    queryFn: async () => {
      const [intRes, visRes, muRes] = await Promise.all([
        apiClient.get('/interacciones?limit=300'),
        apiClient.get('/visitas?limit=300'),
        apiClient.get('/muestreos?limit=200')
      ]);

      const merged = [
        ...(intRes.items || []).map(i => ({ ...i, kind: i.tipo?.toLowerCase() || 'interaccion', date: i.fechaProx || i.fecha })),
        ...(Array.isArray(visRes) ? visRes : (visRes.items || [])).map(v => ({ ...v, kind: 'visita', date: v.proximoPasoFecha || v.fecha })),
        ...(Array.isArray(muRes) ? muRes : (muRes.items || [])).map(m => ({ ...m, kind: 'muestreo', date: m.fecha }))
      ];

      return merged;
    }
  });

  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let startOffset = (firstDay.getDay() + 6) % 7;

    const days = [];
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    for (let i = startOffset; i > 0; i--) {
      days.push({ day: prevMonthLastDay - i + 1, month: month - 1, year, isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ day: i, month, year, isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, month: month + 1, year, isCurrentMonth: false });
    }
    return days;
  }, [currentDate]);

  const getDayEvents = useCallback((day, month, year) => {
    return events.filter(ev => {
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
    <div className="calendario-container am-p-24 calendario-main-wrapper">
      <div className="mx-table-head calendario-header-bar">
        <div className="mx-table-title">
          <div className="mx-header-icon"><CalendarIcon size={20} /></div>
          <div>
            <h2 className="calendario-title-text">Agenda Comercial</h2>
            <p>Planificación de visitas, compromisos y auditorías en terreno.</p>
          </div>
        </div>
        
        <div className="mx-table-actions calendario-actions-bar">
          <div className="calendario-month-nav">
            <button className="mx-action-btn calendario-nav-btn" onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button>
            <span className="calendario-nav-label">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
            <button className="mx-action-btn calendario-nav-btn" onClick={() => changeMonth(1)}><ChevronRight size={18} /></button>
          </div>
          <button className="mx-btn mx-btn-outline" onClick={() => setCurrentDate(new Date())}>Hoy</button>
          <button className="mx-btn mx-btn-primary"><Plus size={18} /> Nueva Cita</button>
        </div>
      </div>

      <div className="calendario-layout-grid">
        <div className="mx-table-card calendario-grid-card">
          <div className="calendario-dow-row">
            {DOW.map(d => (
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
                    zIndex: isSelected ? 1 : 0
                  }}
                >
                  <div className="calendario-day-header">
                    <span className="calendario-day-number" style={{ 
                      fontWeight: isToday ? 900 : 600,
                      color: d.isCurrentMonth ? (isToday ? 'var(--color-primary)' : '#475569') : '#cbd5e1',
                      background: isToday ? '#ccfbf1' : 'transparent'
                    }}>
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
                        <div key={idx} className="calendario-event-badge" style={{ 
                          background: `${cfg.color}10`, color: cfg.color, borderLeft: `3px solid ${cfg.color}`
                        }} title={ev.proveedorNombre || ev.title}>
                          {ev.proveedorNombre || ev.title || 'Cita'}
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
              {selectedDay ? `${selectedDay.day} de ${MONTHS[selectedDay.month]}` : 'Agenda del Día'}
            </h3>
            <p className="calendario-aside-subtitle">{selectedDayEvents.length} actividades</p>
          </div>

          <div className="calendario-aside-list">
            {selectedDayEvents.map((ev, i) => {
              const cfg = TYPE_CONFIG[ev.kind] || TYPE_CONFIG.default;
              return (
                <div key={i} className="calendario-event-card">
                  <div className="calendario-event-card-border" style={{ background: cfg.color }}></div>
                  <span className="calendario-event-card-type" style={{ color: cfg.color }}>{cfg.label}</span>
                  <div className="calendario-event-card-title">{ev.proveedorNombre || ev.contactoNombre || 'Proveedor'}</div>
                  <div className="calendario-event-card-desc">{ev.resumen || ev.proximoPaso || 'Sin notas.'}</div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
