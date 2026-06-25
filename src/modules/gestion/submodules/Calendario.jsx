import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Eye,
  Info,
  History,
  ListChecks,
  Mail,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  PauseCircle,
  Pencil,
  Phone,
  RotateCcw,
  Search,
  Target,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import CompletarTareaModal from './CompletarTareaModal';
import ConfirmModal from './ConfirmModal';
import EditarRealizadoModal from './EditarRealizadoModal';
import ReprogramModal from './ReprogramModal';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/apiClient';
import { useToast } from '../../../context/ToastContext';
import { useCalendarioAgenda, useInteracciones } from '../hooks/useGestionQueries';
import './calendario.css';

const DOW = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const VIEW_OPTIONS = [
  { id: 'list', label: 'Lista operativa', icon: ListChecks },
  { id: 'week', label: 'Semana', icon: CalendarRange },
  { id: 'calendar', label: 'Mes', icon: CalendarDays },
];

// Order: vencidos, realizados, pendiente, pausados (as specified)
const STATUS_OPTIONS = [
  { id: 'todos', label: 'Todos los estados' },
  { id: 'vencido', label: 'Vencido' },
  { id: 'realizado', label: 'Gestión' },
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'pausado', label: 'Pausado' },
];

const TYPE_LABELS = {
  muestreo: 'Muestreo',
  visita: 'Visita a centro',
  llamada: 'Llamada',
  whatsapp: 'WhatsApp',
  reunion: 'Reunión',
  seguimiento: 'Seguimiento',
  pausado: 'Pausado',
};

// Solo estos tipos aparecen en el filtro de tipos
const FILTERABLE_TYPES = new Set(['llamada', 'visita', 'whatsapp', 'reunion']);

const STATUS_LABELS = {
  active: 'Pendiente',
  overdue: 'Vencido',
  paused: 'Pausado',
  realizado: 'Gestión',
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

function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
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

function normalizeAccents(str) {
  return String(str).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function normalizeKind(value) {
  const text = String(value || '').toLowerCase().trim();
  if (text === 'llame' || text.includes('llamada') || text.includes('telefono')) return 'llamada';
  if (text === 'visite' || text.includes('visita')) return 'visita';
  if (text === 'whatsapp') return 'whatsapp';
  if (text === 'tome_muestra' || text.includes('muestra') || text.includes('muestreo')) return 'muestreo';
  if (text === 'negocie' || text.includes('reunion')) return 'reunion';
  if (text.includes('paus')) return 'pausado';
  if (text.includes('seguim')) return 'seguimiento';
  return 'otro';
}

function normalizeNextStep(value) {
  const step = String(value || '').trim();
  if (!step) return '';
  return normalizeKind(step) === 'muestreo' ? 'Muestreo' : step;
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

function compareAgendaItems(a, b, today = startOfDay(new Date())) {
  const aDistance = Math.abs(a.date.getTime() - today.getTime());
  const bDistance = Math.abs(b.date.getTime() - today.getTime());
  return aDistance - bDistance || a.date.getTime() - b.date.getTime() || a.provider.localeCompare(b.provider);
}

function compareCalendarItems(a, b) {
  return a.date.getTime() - b.date.getTime() || a.provider.localeCompare(b.provider);
}


function buildCalendarEvent(item) {
  const date = getRawEventDate(item);
  if (!date) return null;
  const kind = normalizeKind(item.kind || item.tipo || item.type || item.categoria || item.actividadTipo);
  const nextStep = normalizeNextStep(item.proximoPaso || item.proximaAccion || item.actividad || item.asunto || item.resumen || item.titulo || item.title || '');
  const rawStatus = String(item.estado || item.status || item.seguimientoEstado || '').toLowerCase();

  return {
    id: item.id || item._id || `${item.proveedorNombre || item.title || 'agenda'}-${dateKey(date)}`,
    source: item.source || 'calendario',
    sourceId: item.sourceId || item._id || item.id || '',
    kind,
    date,
    time: getRawEventTime(item),
    provider: item.proveedorNombre || item.contactoNombre || item.title || item.clienteNombre || item.empresaNombre || item.proveedor || 'Sin proveedor',
    proveedorKey: item.proveedorKey || '',
    contactoNombre: item.contactoNombre || '',
    telefono: item.telefono || item.contactoSnapshot?.telefono || '',
    email: item.email || item.contactoSnapshot?.email || '',
    centroCodigo: item.centroCodigo || '',
    title: nextStep || 'Compromiso pendiente',
    nextStep,
    description: item.resumen || item.resultado || item.detalle || item.descripcion || item.observacion || item.notas || '',
    responsible: item.responsablePG || item.responsableNombre || item.responsable || item.usuarioNombre || item.createdByName || '-',
    status: rawStatus === 'pausado' ? 'paused' : 'active',
  };
}

function buildRealizadoItems(payload) {
  return toList(payload)
    .map((item) => {
      const date = parseLocalDate(item.fecha);
      if (!date) return null;
      return {
        id: item._id,
        source: 'interaccion',
        sourceId: item._id,
        kind: normalizeKind(item.tipo),
        date,
        time: '',
        provider: item.proveedorNombre || item.contactoNombre || 'Sin proveedor',
        proveedorKey: item.proveedorKey || '',
        contactoNombre: item.contactoNombre || '',
        telefono: item.contactoSnapshot?.telefono || '',
        email: item.contactoSnapshot?.email || '',
        centroCodigo: item.centroCodigo || '',
        title: item.resumen || item.resultado || 'Gestión registrada',
        description: item.resultado || item.resumen || '',
        nextStep: normalizeNextStep(item.proximoPaso || item.proximaAccion || ''),
        nextStepDate: parseLocalDate(item.fechaProximo || item.proximoPasoFecha || item.fechaProximaAccion || item.fechaRevision || item.nextActionAt),
        responsible: item.responsablePG || '-',
        status: 'realizado',
        canReprogram: false,
        canDelete: true,
      };
    })
    .filter((item) => item && item.kind !== 'muestreo')
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

function withDerivedStatus(item, today) {
  if (item.status === 'paused') return item;
  return item.date.getTime() < today.getTime() ? { ...item, status: 'overdue' } : item;
}

function matchesRange(item, range, today) {
  const itemTime = item.date.getTime();
  if (range === 'month') return true;
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
  return <span className={`agenda-type is-${kind}`}>{TYPE_LABELS[kind] || 'Otro'}</span>;
}

function AgendaKindIcon({ kind, size = 14 }) {
  const icons = {
    llamada: Phone,
    visita: MapPin,
    whatsapp: MessageSquare,
    reunion: Users,
    muestreo: ClipboardCheck,
  };
  const Icon = icons[kind] || Target;
  return (
    <span className={`agenda-kind-icon is-${kind}`} title={TYPE_LABELS[kind] || 'Tipo de contacto'}>
      <Icon size={size} />
    </span>
  );
}

function ListPeriodPicker({ listPeriod, label, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, [open]);

  return (
    <div ref={ref} className="agenda-list-period-picker">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <CalendarRange size={15} />
        <span>{label}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="agenda-list-filter-menu agenda-list-period-menu">
          <button type="button" className={listPeriod === 'month' ? 'is-active' : ''} onClick={() => { onSelect('month'); setOpen(false); }}>
            Mes completo
          </button>
          <button type="button" className={listPeriod === 'week' ? 'is-active' : ''} onClick={() => { onSelect('week'); setOpen(false); }}>
            Semana actual
          </button>
        </div>
      )}
    </div>
  );
}

function ListFilterChip({ label, value, allLabel, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, [open]);

  return (
    <div ref={ref} className="agenda-list-filter-chip">
      <button type="button" className={`agenda-list-filter-chip-trigger${value !== 'all' ? ' is-active' : ''}`} onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <span>{value === 'all' ? label : options.find((option) => option.value === value)?.label || label}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="agenda-list-filter-menu agenda-list-filter-chip-menu">
          <button type="button" className={value === 'all' ? 'is-active' : ''} onClick={() => { onChange('all'); setOpen(false); }}>
            {allLabel}
          </button>
          {options.map((option) => (
            <button key={option.value} type="button" className={value === option.value ? 'is-active' : ''} onClick={() => { onChange(option.value); setOpen(false); }}>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function useFloatingMenu() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({});
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e) {
      if (btnRef.current?.contains(e.target)) return;
      if (!menuRef.current?.contains(e.target)) setOpen(false);
    }
    function onScroll() { setOpen(false); }
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  function toggle(estimatedHeight = 200) {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const right = window.innerWidth - rect.right;
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < estimatedHeight) {
        setPos({ bottom: window.innerHeight - rect.top + 6, right, top: 'auto' });
      } else {
        setPos({ top: rect.bottom + 6, right, bottom: 'auto' });
      }
    }
    setOpen((v) => !v);
  }

  return { open, pos, btnRef, menuRef, toggle, close: () => setOpen(false) };
}

function InfoPopover({ item }) {
  const { open, pos, btnRef, menuRef, toggle } = useFloatingMenu();
  const hasInfo = item.contactoNombre || item.telefono || item.email || item.centroCodigo;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`mx-action-btn${open ? ' is-info-active' : ''}`}
        onClick={() => toggle(140)}
        title="Ver contacto"
      >
        <Info size={14} />
      </button>
      {open && createPortal(
        <div ref={menuRef} className="agenda-info-popover" style={{ position: 'fixed', left: 'auto', ...pos }}>
          {hasInfo ? (
            <>
              {item.contactoNombre && <div className="aip-name">{item.contactoNombre}</div>}
              {item.telefono && (
                <a href={`tel:${item.telefono}`} className="aip-row"><Phone size={12} /> {item.telefono}</a>
              )}
              {item.email && (
                <a href={`mailto:${item.email}`} className="aip-row"><Mail size={12} /> {item.email}</a>
              )}
              {item.centroCodigo && <div className="aip-row aip-meta">Centro: {item.centroCodigo}</div>}
            </>
          ) : (
            <div className="aip-empty">Sin datos de contacto registrados</div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

function AgendaActions({ item, onViewCalendar, onEdit, onReprogram, onDelete, onComplete }) {
  const navigate = useNavigate();
  const { open, pos, btnRef, menuRef, toggle, close } = useFloatingMenu();
  const actionCount = 3 + (item.canReprogram ? 1 : 0) + (item.canDelete ? 1 : 0);
  const providerHistoryKey = item.proveedorKey || item.provider || item.contactoNombre;

  const handleViewHistory = () => {
    close();
    navigate(`/historial?proveedor=${encodeURIComponent(providerHistoryKey)}`);
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <InfoPopover item={item} />
      {item.status === 'realizado' && (
        <button type="button" className="mx-action-btn" onClick={() => onEdit(item)} title="Ver / Editar gestión">
          <Pencil size={14} />
        </button>
      )}
      <button
        ref={btnRef}
        type="button"
        className={`mx-action-btn${open ? ' is-open' : ''}`}
        onClick={() => toggle(actionCount * 44 + 16)}
        title="Opciones"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && createPortal(
        <div ref={menuRef} className="agenda-options-menu" style={{ position: 'fixed', left: 'auto', ...pos }}>
          {item.status !== 'realizado' && (
            <button type="button" className="agenda-option-item is-success" onClick={() => { close(); onComplete(item); }}>
              <CheckCircle2 size={14} /> Marcar como hecho
            </button>
          )}
          {item.status === 'realizado' ? (
            <button type="button" className="agenda-option-item" onClick={() => { close(); onEdit(item); }}>
              <Pencil size={14} /> Ver / Editar gestión
            </button>
          ) : (
            <button type="button" className="agenda-option-item" onClick={() => { close(); onViewCalendar(item); }}>
              <Eye size={14} /> Ver en calendario
            </button>
          )}
          <button type="button" className="agenda-option-item" onClick={handleViewHistory}>
            <History size={14} /> Ver historial
          </button>
          {(item.canReprogram || item.canDelete) && <div className="agenda-option-sep" />}
          {item.canReprogram && (
            <button type="button" className="agenda-option-item" onClick={() => { close(); onReprogram(item); }}>
              <RotateCcw size={14} /> Reprogramar
            </button>
          )}
          {item.canDelete && (
            <button type="button" className="agenda-option-item is-danger" onClick={() => { close(); onDelete(item); }}>
              <Trash2 size={14} /> Eliminar
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

function AgendaTable({ items, emptyText, completedView, onViewCalendar, onEdit, onReprogram, onDelete, onComplete }) {
  return (
    <div className="agenda-table-wrap">
      <table className="agenda-table">
        <thead>
          <tr>
            <th>Proveedor</th>
            {completedView ? (
              <>
                <th>Tipo de contacto</th>
                <th>Fecha gestión</th>
                <th>Notas / resumen</th>
                <th>Próximo paso</th>
                <th>Fecha próximo paso</th>
              </>
            ) : (
              <>
                <th>Próxima acción</th>
                <th>Estado</th>
                <th>Fecha programada</th>
              </>
            )}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.length ? items.map((item) => (
            <tr key={item.id}>
              <td className="agenda-provider-cell">
                {item.provider}
                {item.contactoNombre && item.contactoNombre !== item.provider && (
                  <span className="agenda-provider-contacto">{item.contactoNombre}</span>
                )}
              </td>
              {completedView ? (
                <>
                  <td><AgendaType kind={item.kind} /></td>
                  <td className="agenda-cell-date">{formatShortDate(item.date)}</td>
                  <td>
                    <div className="agenda-action-cell">
                      <span className="agenda-action-title">{item.title}</span>
                      {item.description && item.description !== item.title
                        ? <span className="agenda-action-desc">{item.description}</span>
                        : null}
                    </div>
                  </td>
                  <td>{item.nextStep || '—'}</td>
                  <td className="agenda-cell-date">{formatShortDate(item.nextStepDate)}</td>
                </>
              ) : (
                <>
                  <td>
                    <div className="agenda-action-cell">
                      <span className="agenda-action-title">{item.title}</span>
                    </div>
                  </td>
                  <td><AgendaStatus status={item.status} /></td>
                  <td className="agenda-cell-date">{formatShortDate(item.date)}</td>
                </>
              )}
              <td>
                <AgendaActions
                  item={item}
                  onViewCalendar={onViewCalendar}
                  onEdit={onEdit}
                  onReprogram={onReprogram}
                  onDelete={onDelete}
                  onComplete={onComplete}
                />
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={completedView ? 7 : 5}>
                <div className="mx-empty-state">
                  <CalendarDays size={36} />
                  <p className="mx-empty-state__title">{completedView ? 'Sin gestiones realizadas' : 'Sin actividades programadas'}</p>
                  <p className="mx-empty-state__text">{emptyText}</p>
                </div>
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
  const { addToast } = useToast();
  const [viewMode, setViewMode] = useState('list');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [range, setRange] = useState('month');
  const [listPeriod, setListPeriod] = useState('month');
  const [monthDetailsOpen, setMonthDetailsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [nextStepFilter, setNextStepFilter] = useState('all');
  const [responsibleFilter, setResponsibleFilter] = useState('all');
  const [showRealizados, setShowRealizados] = useState(false);
  const [completingItem, setCompletingItem] = useState(null);
  const [editingRealizadoItem, setEditingRealizadoItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [reprogrammingItem, setReprogrammingItem] = useState(null);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['calendario-agenda'] });
    queryClient.invalidateQueries({ queryKey: ['oportunidades'] });
    queryClient.invalidateQueries({ queryKey: ['interacciones'] });
  }, [queryClient]);

  useEffect(() => {
    window.addEventListener('gestion:quick-capture-saved', handleRefresh);
    return () => window.removeEventListener('gestion:quick-capture-saved', handleRefresh);
  }, [handleRefresh]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const from = addDays(startOfDay(currentDate), -60).toISOString();
  const to = new Date(year + 1, month + 1, 0).toISOString();

  const { data: agendaRes, isLoading: loadingAgenda } = useCalendarioAgenda({ from, to });

  // Always load realizados for the visible month (powers the KPI count and the filter)
  const realizadoFrom = new Date(year, month, 1).toISOString();
  const realizadoTo = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
  const { data: realizadosRes, isLoading: loadingRealizados } = useInteracciones(
    { from: realizadoFrom, to: realizadoTo, limit: 200 },
  );

  const listWeekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);
  const listWeekEnd = useMemo(() => endOfDay(addDays(listWeekStart, 6)), [listWeekStart]);
  const { data: weeklyRealizadosRes, isLoading: loadingWeeklyRealizados } = useInteracciones(
    { from: listWeekStart.toISOString(), to: listWeekEnd.toISOString(), limit: 200 },
  );

  const realizadoItems = useMemo(() => buildRealizadoItems(realizadosRes), [realizadosRes]);
  const weeklyRealizadoItems = useMemo(() => buildRealizadoItems(weeklyRealizadosRes), [weeklyRealizadosRes]);
  const listRealizadoItems = listPeriod === 'week' ? weeklyRealizadoItems : realizadoItems;

  const loading = loadingAgenda || (
    (statusFilter === 'realizado' && (viewMode === 'list' && listPeriod === 'week' ? loadingWeeklyRealizados : loadingRealizados))
    || (viewMode !== 'list' && showRealizados && loadingRealizados)
  );
  const today = useMemo(() => startOfDay(new Date()), []);

  const agendaItems = useMemo(() => {
    if (loadingAgenda) return [];

    return toList(agendaRes)
      .map(buildCalendarEvent)
      .filter(Boolean)
      .map((item) => withDerivedStatus(item, today))
      .map((item) => ({
        ...item,
        canReprogram: ['interaccion', 'visita'].includes(item.source),
        canDelete: ['interaccion', 'visita'].includes(item.source),
      }))
      .filter((item) => ['active', 'overdue', 'paused'].includes(item.status))
      .sort((a, b) => compareAgendaItems(a, b, today));
  }, [agendaRes, loadingAgenda, today]);

  const listAgendaItems = useMemo(() => {
    const start = listPeriod === 'week' ? listWeekStart.getTime() : new Date(year, month, 1).getTime();
    const end = listPeriod === 'week'
      ? listWeekEnd.getTime()
      : new Date(year, month + 1, 0, 23, 59, 59).getTime();
    return agendaItems.filter((item) => item.date.getTime() >= start && item.date.getTime() <= end);
  }, [agendaItems, listPeriod, listWeekEnd, listWeekStart, month, year]);

  const tableFilterCandidates = useMemo(() => {
    if (statusFilter === 'realizado') return listRealizadoItems;
    return listAgendaItems.filter((item) => {
      if (statusFilter === 'vencido') return item.status === 'overdue';
      if (statusFilter === 'pendiente') return item.status === 'active' && matchesRange(item, range, today);
      if (statusFilter === 'pausado') return item.status === 'paused';
      return matchesRange(item, range, today);
    });
  }, [listAgendaItems, listRealizadoItems, range, statusFilter, today]);

  const availableTypes = useMemo(() => {
    const map = new Map();
    tableFilterCandidates.forEach((item) => {
      if (FILTERABLE_TYPES.has(item.kind)) {
        map.set(item.kind, TYPE_LABELS[item.kind]);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [tableFilterCandidates]);

  const availableNextSteps = useMemo(() => {
    const steps = new Map();
    tableFilterCandidates.forEach((item) => {
      const step = String(item.nextStep || '').trim();
      if (step) steps.set(step.toLocaleLowerCase('es'), step);
    });
    return Array.from(steps.values())
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map((step) => ({ value: step, label: step }));
  }, [tableFilterCandidates]);

  const availableResponsibles = useMemo(() => {
    // Deduplica por nombre sin acentos; prefiere la versión con acento correcto
    const canonical = new Map(); // normalizado -> nombre canónico
    [...agendaItems, ...realizadoItems].forEach((item) => {
      if (!item.responsible || item.responsible === '-') return;
      const key = normalizeAccents(item.responsible);
      const existing = canonical.get(key);
      // Preferir la versión con tilde (distinta del normalizado)
      if (!existing || normalizeAccents(item.responsible) !== item.responsible) {
        canonical.set(key, item.responsible);
      }
    });
    return Array.from(canonical.values()).sort((a, b) => a.localeCompare(b, 'es'));
  }, [agendaItems, realizadoItems]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    const applyFilters = (item) => {
      const haystack = `${item.provider} ${item.contactoNombre} ${item.centroCodigo} ${item.title} ${item.description} ${item.responsible}`.toLowerCase();
      if (term && !haystack.includes(term)) return false;
      if (typeFilter !== 'all' && item.kind !== typeFilter) return false;
      if (nextStepFilter !== 'all' && item.nextStep !== nextStepFilter) return false;
      return true;
    };

    if (statusFilter === 'realizado') {
      return listRealizadoItems.filter(applyFilters);
    }

    if (statusFilter === 'todos') {
      return listAgendaItems.filter((item) => {
        if (!applyFilters(item)) return false;
        return matchesRange(item, range, today);
      }).sort((a, b) => compareAgendaItems(a, b, today));
    }

    return listAgendaItems.filter((item) => {
      if (!applyFilters(item)) return false;
      if (statusFilter === 'vencido') return item.status === 'overdue';
      if (statusFilter === 'pendiente') return item.status === 'active' && matchesRange(item, range, today);
      if (statusFilter === 'pausado') return item.status === 'paused';
      return true;
    }).sort((a, b) => compareAgendaItems(a, b, today));
  }, [listAgendaItems, listRealizadoItems, nextStepFilter, range, search, statusFilter, today, typeFilter]);

  const kpis = useMemo(() => {
    const todayEnd = endOfDay(today).getTime();
    const sevenEnd = endOfDay(addDays(today, 7)).getTime();
    return {
      today: agendaItems.filter((item) => item.date.getTime() >= today.getTime() && item.date.getTime() <= todayEnd && item.status !== 'paused').length,
      overdue: agendaItems.filter((item) => item.status === 'overdue').length,
      next7: agendaItems.filter((item) => item.date.getTime() >= today.getTime() && item.date.getTime() <= sevenEnd && item.status !== 'paused').length,
      paused: agendaItems.filter((item) => item.status === 'paused').length,
      pendiente: agendaItems.filter((item) => item.status === 'active').length,
      realizado: realizadoItems.length,
      total: agendaItems.length + realizadoItems.length,
    };
  }, [agendaItems, realizadoItems, today]);

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
    const pool = showRealizados
      ? [...agendaItems.filter((item) => item.status === 'overdue'), ...realizadoItems]
      : agendaItems;
    const source = responsibleFilter === 'all'
      ? pool
      : pool.filter((item) => normalizeAccents(item.responsible) === normalizeAccents(responsibleFilter));
    const map = new Map();
    source.forEach((item) => {
      const key = dateKey(item.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    map.forEach((items) => items.sort(compareCalendarItems));
    return map;
  }, [agendaItems, realizadoItems, responsibleFilter, showRealizados]);

  const selectedDayItems = eventsByDay.get(dateKey(selectedDate)) || [];
  const periodLabel = `${MONTHS[month]} ${year}`;
  function clearListFilters() {
    setSearch('');
    setTypeFilter('all');
    setNextStepFilter('all');
  }

  const ResponsableSelect = availableResponsibles.length > 1 ? (
    <label className="cal-filter-select">
      <User size={15} />
      <select value={responsibleFilter} onChange={(e) => setResponsibleFilter(e.target.value)}>
        <option value="all">Todos los responsables</option>
        {availableResponsibles.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
    </label>
  ) : null;

  const weekDays = useMemo(() => {
    const start = getWeekStart(currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const weekPeriodLabel = useMemo(() => {
    if (weekDays.length < 7) return '';
    const s = weekDays[0];
    const e = weekDays[6];
    if (s.getMonth() === e.getMonth()) {
      return `${s.getDate()} - ${e.getDate()} ${MONTHS[s.getMonth()]} ${s.getFullYear()}`;
    }
    return `${s.getDate()} ${MONTHS[s.getMonth()]} - ${e.getDate()} ${MONTHS[e.getMonth()]}`;
  }, [weekDays]);

  function changeMonth(delta) {
    const next = new Date(year, month + delta, 1);
    setCurrentDate(next);
    setSelectedDate(next);
    setMonthDetailsOpen(false);
  }

  function changeWeek(delta) {
    setCurrentDate((prev) => addDays(prev, delta * 7));
  }

  function changeListPeriod(delta) {
    if (listPeriod === 'week') {
      changeWeek(delta);
      return;
    }
    changeMonth(delta);
  }

  function viewItemInCalendar(item) {
    setCurrentDate(new Date(item.date.getFullYear(), item.date.getMonth(), 1));
    setSelectedDate(item.date);
    setMonthDetailsOpen(true);
    setViewMode('calendar');
  }

  async function confirmReprogram(nextDate) {
    const item = reprogrammingItem;
    setReprogrammingItem(null);
    const iso = new Date(`${nextDate}T09:00:00`).toISOString();
    try {
      if (item.source === 'interaccion') {
        await apiClient.put(`/interacciones/${item.sourceId}`, { fechaProximo: iso, tipo: item.kind, fecha: item.date.toISOString(), responsablePG: item.responsible || 'Usuario' });
      } else if (item.source === 'visita') {
        await apiClient.patch(`/visitas/${item.sourceId}`, { proximoPasoFecha: iso });
      }
      addToast({ title: 'Agenda actualizada', message: 'La actividad fue reprogramada.', type: 'success' });
      handleRefresh();
    } catch (error) {
      addToast({ title: 'Error', message: error?.message || 'No se pudo reprogramar.', type: 'error' });
    }
  }

  async function confirmDelete() {
    const item = deletingItem;
    setDeletingItem(null);
    try {
      if (item.source === 'interaccion') {
        await apiClient.delete(`/interacciones/${item.sourceId}`);
      } else if (item.source === 'visita') {
        await apiClient.delete(`/visitas/${item.sourceId}`);
      } else {
        addToast({ title: 'No eliminado', message: 'Este origen no permite eliminación desde Agenda.', type: 'warning' });
        return;
      }
      addToast({ title: 'Eliminado', message: 'La actividad fue eliminada de la agenda.', type: 'success' });
      handleRefresh();
    } catch (error) {
      addToast({ title: 'Error', message: error?.message || 'No se pudo eliminar.', type: 'error' });
    }
  }

  const subtitleText = statusFilter === 'realizado'
    ? listPeriod === 'week'
      ? `Gestiones realizadas durante la semana del ${weekPeriodLabel}.`
      : `Gestiones realizadas en ${MONTHS[month]} ${year}.`
    : 'Compromisos programados, vencidos y pendientes de gestión.';

  function isKpiActive(filter, rangeValue) {
    if (viewMode !== 'list' || statusFilter !== filter) return false;
    if (rangeValue !== undefined && range !== rangeValue) return false;
    return true;
  }

  function toggleKpi(filter, rangeValue) {
    if (isKpiActive(filter, rangeValue)) {
      setStatusFilter('todos');
      setRange('month');
      return;
    }
    setViewMode('list');
    setStatusFilter(filter);
    if (rangeValue !== undefined) setRange(rangeValue);
  }

  return (
    <div className="calendario-main-wrapper agenda-modern">
      <div className="calendario-header-bar">
        <div>
          <h2 className="calendario-title-text">Agenda Operativa</h2>
          <p>{subtitleText}</p>
        </div>
      </div>

      <div className="agenda-kpis">
        <button type="button" className={isKpiActive('pendiente', 'today') ? 'is-active' : ''} onClick={() => toggleKpi('pendiente', 'today')}>
          <Target size={16} /><span>Hoy</span><strong>{kpis.today}</strong>
        </button>
        <button type="button" className={isKpiActive('pendiente', 'month') ? 'is-active' : ''} onClick={() => toggleKpi('pendiente', 'month')}>
          <Clock size={16} /><span>Pendientes</span><strong>{kpis.pendiente}</strong>
        </button>
        <button type="button" className={isKpiActive('vencido', 'all') ? 'is-active' : ''} onClick={() => toggleKpi('vencido', 'all')}>
          <AlertTriangle size={16} /><span>Vencidos</span><strong>{kpis.overdue}</strong>
        </button>
        <button type="button" className={isKpiActive('realizado') ? 'is-active' : ''} onClick={() => toggleKpi('realizado')}>
          <ClipboardCheck size={16} /><span>Gestiones</span><strong>{kpis.realizado}</strong>
        </button>
        <button type="button" className={isKpiActive('todos', '7d') ? 'is-active' : ''} onClick={() => toggleKpi('todos', '7d')}>
          <CalendarClock size={16} /><span>Próx. 7 días</span><strong>{kpis.next7}</strong>
        </button>
        <button type="button" className={isKpiActive('pausado', 'all') ? 'is-active' : ''} onClick={() => toggleKpi('pausado', 'all')}>
          <PauseCircle size={16} /><span>Pausados</span><strong>{kpis.paused}</strong>
        </button>
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

          {viewMode === 'calendar' && (
            <div className="cal-toolbar-right">
              <div className="cal-period-nav">
                <button type="button" onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button>
                <strong>{periodLabel}</strong>
                <button type="button" onClick={() => changeMonth(1)}><ChevronRight size={18} /></button>
              </div>
              {ResponsableSelect}
              <button
                type="button"
                className={`agenda-toggle-realizados${showRealizados ? ' is-active' : ''}`}
                onClick={() => setShowRealizados((v) => !v)}
              >
                <ClipboardCheck size={15} /> Mostrar gestiones
              </button>
            </div>
          )}

          {viewMode === 'week' && (
            <div className="cal-toolbar-right">
              <div className="cal-period-nav">
                <button type="button" onClick={() => changeWeek(-1)}><ChevronLeft size={18} /></button>
                <strong>{weekPeriodLabel}</strong>
                <button type="button" onClick={() => changeWeek(1)}><ChevronRight size={18} /></button>
              </div>
              {ResponsableSelect}
              <button
                type="button"
                className={`agenda-toggle-realizados${showRealizados ? ' is-active' : ''}`}
                onClick={() => setShowRealizados((v) => !v)}
              >
                <ClipboardCheck size={15} /> Mostrar gestiones
              </button>
            </div>
          )}

          {viewMode === 'list' && (
            <div className="agenda-filter-row">
              <div className="agenda-month-nav agenda-list-period-nav">
                <button type="button" onClick={() => changeListPeriod(-1)}><ChevronLeft size={16} /></button>
                <ListPeriodPicker
                  listPeriod={listPeriod}
                  label={listPeriod === 'week' ? `Semana ${weekPeriodLabel}` : `Mes ${periodLabel}`}
                  onSelect={setListPeriod}
                />
                <button type="button" onClick={() => changeListPeriod(1)}><ChevronRight size={16} /></button>
              </div>
              <div className="cal-search-box">
                <Search size={17} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar proveedor, acción o responsable..." />
              </div>
              <button
                type="button"
                className={`agenda-toggle-realizados${statusFilter === 'realizado' ? ' is-active' : ''}`}
                onClick={() => setStatusFilter((prev) => (prev === 'realizado' ? 'todos' : 'realizado'))}
              >
                <ClipboardCheck size={15} /> {statusFilter === 'realizado' ? 'Volver a agenda' : 'Mostrar gestiones'}
              </button>
            </div>
          )}
        </div>

        {viewMode === 'list' && (
          <div className="agenda-list-filter-chips">
            <ListFilterChip
              label="Tipo de contacto"
              value={typeFilter}
              allLabel="Todos los tipos de contacto"
              options={availableTypes.map(([value, label]) => ({ value, label }))}
              onChange={setTypeFilter}
            />
            <ListFilterChip
              label="Próximo paso"
              value={nextStepFilter}
              allLabel="Todos los próximos pasos"
              options={availableNextSteps}
              onChange={setNextStepFilter}
            />
            <button
              type="button"
              className="agenda-list-clear-filters"
              onClick={clearListFilters}
              disabled={!search && typeFilter === 'all' && nextStepFilter === 'all'}
            >
              Limpiar filtros
            </button>
          </div>
        )}

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
                completedView={statusFilter === 'realizado'}
                emptyText={
                  statusFilter === 'realizado'
                    ? `Sin gestiones registradas en ${MONTHS[month]} ${year}.`
                    : 'No hay compromisos para los filtros seleccionados.'
                }
                onViewCalendar={viewItemInCalendar}
                onEdit={setEditingRealizadoItem}
                onReprogram={setReprogrammingItem}
                onDelete={setDeletingItem}
                onComplete={setCompletingItem}
              />
            )}

            {viewMode === 'week' && (
              <>
                <div className="cal-week-grid">
                {weekDays.map((day) => {
                  const key = dateKey(day);
                  const dayItems = eventsByDay.get(key) || [];
                  const isToday = key === dateKey(new Date());
                  return (
                    <div key={key} className={`cal-week-col${isToday ? ' is-today' : ''}`}>
                      <div className={`cal-week-col-header${isToday ? ' is-today' : ''}`}>
                        <div>
                          <div className="col-dow">{DOW[(day.getDay() + 6) % 7]}</div>
                          <div className="col-date">{day.getDate()}</div>
                        </div>
                        <span className={`cal-week-count${dayItems.length ? ' has-items' : ''}`}>
                          {dayItems.length}
                        </span>
                      </div>
                      <div className="cal-week-col-events">
                        {dayItems.map((item) => (
                          <div
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            className={`cal-week-event is-${item.status}`}
                            onClick={() => {
                              setSelectedDate(item.date);
                              setMonthDetailsOpen(true);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                setSelectedDate(item.date);
                                setMonthDetailsOpen(true);
                              }
                            }}
                          >
                            <div className="cal-week-event-top">
                              <div className="cal-week-event-heading">
                                <AgendaKindIcon kind={item.kind} />
                                <div className="cal-week-event-copy">
                                  <span className="cal-week-event-kind">{TYPE_LABELS[item.kind] || 'Contacto'}</span>
                                  <div className="cal-week-event-title">{item.title}</div>
                                </div>
                              </div>
                              <AgendaStatus status={item.status} />
                            </div>
                            <div className="cal-week-event-provider">{item.provider}</div>
                            {item.contactoNombre && item.contactoNombre !== item.provider && (
                              <div className="cal-week-event-contact">{item.contactoNombre}</div>
                            )}
                            {item.description && (
                              <div className="cal-week-event-summary">{item.description}</div>
                            )}
                            {item.responsible && item.responsible !== '-' && (
                              <div className="cal-week-event-responsible">{item.responsible}</div>
                            )}
                            <div className="cal-week-event-actions" onClick={(event) => event.stopPropagation()}>
                              {item.status !== 'realizado' && (
                                <button type="button" className="cal-icon-action success" onClick={(event) => { event.stopPropagation(); setCompletingItem(item); }} title="Marcar como hecho">
                                  <CheckCircle2 size={13} />
                                </button>
                              )}
                              {item.status === 'realizado' && (
                                <button type="button" className="cal-icon-action" onClick={() => setEditingRealizadoItem(item)} title="Ver / Editar gestión">
                                  <Pencil size={13} />
                                </button>
                              )}
                              {item.canReprogram && (
                                <button type="button" className="cal-icon-action" onClick={(event) => { event.stopPropagation(); setReprogrammingItem(item); }} title="Reprogramar">
                                  <RotateCcw size={13} />
                                </button>
                              )}
                              {item.canDelete && (
                                <button type="button" className="cal-icon-action danger" onClick={(event) => { event.stopPropagation(); setDeletingItem(item); }} title="Eliminar">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        {dayItems.length === 0 && (
                          <div className="cal-week-empty">Libre</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {monthDetailsOpen && (
                <>
                  <button
                    type="button"
                    className="cal-aside-backdrop"
                    aria-label="Cerrar detalle"
                    onClick={() => setMonthDetailsOpen(false)}
                  />
                  <aside className="cal-aside-panel is-drawer">
                    <div className="cal-aside-header">
                      <span>Agenda del dia</span>
                      <h3>{formatLongDate(selectedDate)}</h3>
                      <p>{selectedDayItems.length ? `${selectedDayItems.length} compromisos` : 'Sin compromisos'}</p>
                      <button type="button" className="cal-aside-close" onClick={() => setMonthDetailsOpen(false)} title="Cerrar">
                        <X size={20} />
                      </button>
                    </div>
                    <div className="agenda-aside-list">
                      {selectedDayItems.length ? selectedDayItems.map((item) => (
                        <article key={item.id} className={`agenda-mini-card is-${item.status}`}>
                          <AgendaStatus status={item.status} />
                          <strong className="agenda-mini-title"><AgendaKindIcon kind={item.kind} /> {item.title}</strong>
                          <span>{item.provider}</span>
                          {item.contactoNombre && item.contactoNombre !== item.provider && (
                            <span>{item.contactoNombre}</span>
                          )}
                          {item.description && (
                            <p className="agenda-mini-summary">{item.description}</p>
                          )}
                          {item.responsible && item.responsible !== '-' && (
                            <span className="agenda-mini-responsible">{item.responsible}</span>
                          )}
                          <div className="agenda-mini-actions">
                            {item.status !== 'realizado' && (
                              <button type="button" className="cal-icon-action success" onClick={() => setCompletingItem(item)} title="Marcar como hecho">
                                <CheckCircle2 size={14} />
                              </button>
                            )}
                            {item.status === 'realizado' && (
                              <button type="button" className="cal-icon-action" onClick={() => setEditingRealizadoItem(item)} title="Ver / Editar gestiÃ³n">
                                <Pencil size={14} />
                              </button>
                            )}
                            {item.canReprogram && (
                              <button type="button" className="cal-icon-action" onClick={() => setReprogrammingItem(item)} title="Reprogramar">
                                <RotateCcw size={14} />
                              </button>
                            )}
                            {item.canDelete && (
                              <button type="button" className="cal-icon-action danger" onClick={() => setDeletingItem(item)} title="Eliminar">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </article>
                      )) : (
                        <div className="cal-empty-state">
                          <CalendarDays size={34} />
                          <strong>Dia despejado</strong>
                          <span>No hay compromisos para esta fecha.</span>
                        </div>
                      )}
                    </div>
                  </aside>
                </>
              )}
              </>
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
                          onClick={() => {
                            setSelectedDate(day);
                            setMonthDetailsOpen(true);
                          }}
                        >
                          <div className="cal-day-header">
                            <span className="cal-day-number">{day.getDate()}</span>
                            {dayItems.length ? <span className="cal-day-count">{dayItems.length}</span> : null}
                          </div>
                          <div className="cal-events-stack">
                            {dayItems.slice(0, 3).map((item) => (
                              <span key={item.id} className={`cal-event-pill is-compact is-${item.status}`}>
                                <strong><AgendaKindIcon kind={item.kind} size={12} /> {item.title}</strong>
                                <em>{item.provider}</em>
                              </span>
                            ))}
                            {dayItems.length > 3 ? <span className="cal-more-events">+{dayItems.length - 3} mas</span> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </main>
                {monthDetailsOpen && (
                  <>
                    <button
                      type="button"
                      className="cal-aside-backdrop"
                      aria-label="Cerrar detalle"
                      onClick={() => setMonthDetailsOpen(false)}
                    />
                    <aside className="cal-aside-panel is-drawer">
                  <div className="cal-aside-header">
                    <span>Agenda del día</span>
                    <h3>{formatLongDate(selectedDate)}</h3>
                    <p>{selectedDayItems.length ? `${selectedDayItems.length} compromisos` : 'Sin compromisos'}</p>
                    <button type="button" className="cal-aside-close" onClick={() => setMonthDetailsOpen(false)} title="Cerrar">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="agenda-aside-list">
                    {selectedDayItems.length ? selectedDayItems.map((item) => (
                      <article key={item.id} className={`agenda-mini-card is-${item.status}`}>
                        <AgendaStatus status={item.status} />
                        <strong className="agenda-mini-title"><AgendaKindIcon kind={item.kind} /> {item.title}</strong>
                        <span>{item.provider}</span>
                        {item.contactoNombre && item.contactoNombre !== item.provider && (
                          <span>{item.contactoNombre}</span>
                        )}
                        {item.description && (
                          <p className="agenda-mini-summary">{item.description}</p>
                        )}
                        {item.responsible && item.responsible !== '-' && (
                          <span className="agenda-mini-responsible">{item.responsible}</span>
                        )}
                        <div className="agenda-mini-actions">
                          {item.status !== 'realizado' && (
                            <button type="button" className="cal-icon-action success" onClick={() => setCompletingItem(item)} title="Marcar como hecho">
                              <CheckCircle2 size={14} />
                            </button>
                          )}
                          {item.status === 'realizado' && (
                            <button type="button" className="cal-icon-action" onClick={() => setEditingRealizadoItem(item)} title="Ver / Editar gestión">
                              <Pencil size={14} />
                            </button>
                          )}
                          {item.canReprogram && (
                            <button type="button" className="cal-icon-action" onClick={() => setReprogrammingItem(item)} title="Reprogramar">
                              <RotateCcw size={14} />
                            </button>
                          )}
                          {item.canDelete && (
                            <button type="button" className="cal-icon-action danger" onClick={() => setDeletingItem(item)} title="Eliminar">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </article>
                    )) : (
                      <div className="cal-empty-state">
                        <CalendarDays size={34} />
                        <strong>Día despejado</strong>
                        <span>No hay compromisos para esta fecha.</span>
                      </div>
                    )}
                  </div>
                    </aside>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {editingRealizadoItem && (
        <EditarRealizadoModal
          item={editingRealizadoItem}
          onClose={() => setEditingRealizadoItem(null)}
          onSaved={handleRefresh}
        />
      )}

      {completingItem && (
        <CompletarTareaModal
          item={completingItem}
          onClose={() => setCompletingItem(null)}
          onSaved={handleRefresh}
        />
      )}

      {deletingItem && (
        <ConfirmModal
          title="Eliminar actividad"
          message={`¿Eliminar la actividad de ${deletingItem.provider}? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onConfirm={confirmDelete}
          onClose={() => setDeletingItem(null)}
        />
      )}

      {reprogrammingItem && (
        <ReprogramModal
          item={reprogrammingItem}
          onConfirm={confirmReprogram}
          onClose={() => setReprogrammingItem(null)}
        />
      )}
    </div>
  );
}
