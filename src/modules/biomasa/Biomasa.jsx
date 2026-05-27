import React, { Suspense, lazy, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, Navigate } from 'react-router-dom';
import './biomasa.css';
import { 
  Plus, 
  RotateCcw, 
  Calendar as CalendarIcon, 
  Inbox, 
  ShoppingCart, 
  Edit, 
  X, 
  Activity, 
  Truck, 
  ChevronLeft, 
  ChevronRight, 
  LayoutGrid, 
  List as ListIcon,
  Pause,
  Play,
  CheckCircle2,
  Trash,
  Maximize2,
  Minimize2,
  AlertTriangle,
  Package,
  Users,
  Info,
  Building2,
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { maestrosApi } from '../../api/api-maestros';
import { useToast } from '../../context/ToastContext';
import { useBiomasaData } from '../../hooks/useBiomasaData';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
const Muestreos = lazy(() => import('../gestion/submodules/Muestreos'));


const mesActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const finMes = (mk) => {
  const [y, m] = String(mk || '').split('-').map(Number);
  if (!y || !m) return '';
  const day = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const mesLabel = (mk = '', largo = false) => {
  if (!mk) return '—';
  const LARGO  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const [y, m] = mk.split('-');
  const idx = parseInt(m, 10) - 1;
  return largo ? `${LARGO[idx]} ${y}` : `${LARGO[idx].slice(0,3)} ${y}`;
};

const fmtTons = (n) => (Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' t';
const fmtTonsInt = (n) => (Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 }) + ' t';
const fmtNumber = (n, digits = 1) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: digits });
const calcTotalToneladasDia = (transportes = []) =>
  (transportes || []).reduce((s, t) => s + (Number(t.cantidadDia) || 0) * (Number(t.toneladasPorCamion) || 0), 0);
const todayKey = () => toDateKey(new Date());
const CHILE_TIME_ZONE = 'America/Santiago';

const chileDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CHILE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const toChileDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = chileDateFormatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const compareDateKeys = (a, b) => String(a || '').localeCompare(String(b || ''));
const minDateKey = (...keys) => keys.filter(Boolean).sort()[0] || '';
const maxDateKey = (...keys) => keys.filter(Boolean).sort().at(-1) || '';
const addDaysToKey = (key, days = 1) => {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const dayOfWeekFromKey = (key) => new Date(`${key}T12:00:00Z`).getUTCDay();

const getEasterDate = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

function calcTerminoProgramaISO(vigenciaDesde, tonsEstimadas, transportes, diasSemana) {
  const tons = Number(tonsEstimadas) || 0;
  const tonsDia = Array.isArray(transportes) && transportes.length
    ? transportes.reduce((s, t) => s + (Number(t.cantidadDia) || 0) * (Number(t.toneladasPorCamion) || 0), 0)
    : 0;
  if (!vigenciaDesde || tons <= 0 || tonsDia <= 0) return null;
  const diasNecesarios = Math.ceil(tons / tonsDia);
  const validDays = new Set(Array.isArray(diasSemana) && diasSemana.length ? diasSemana : [0, 1, 2, 3, 4]);
  const [y, m, d] = vigenciaDesde.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  let counted = 0;
  while (counted < diasNecesarios) {
    if (validDays.has(cur.getUTCDay())) counted++;
    if (counted < diasNecesarios) cur.setUTCDate(cur.getUTCDate() + 1);
  }
  const dd = String(cur.getUTCDate()).padStart(2, '0');
  const mm = String(cur.getUTCMonth() + 1).padStart(2, '0');
  return `${cur.getUTCFullYear()}-${mm}-${dd}`;
}

function calcTerminoPrograma(vigenciaDesde, tonsEstimadas, transportes, diasSemana) {
  const iso = calcTerminoProgramaISO(vigenciaDesde, tonsEstimadas, transportes, diasSemana);
  if (!iso) return null;
  const [y, mm, dd] = iso.split('-');
  return `${dd}-${mm}-${y}`;
}

const getChileHolidayKeys = (year) => {
  const easter = getEasterDate(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  const holySaturday = new Date(easter);
  holySaturday.setDate(easter.getDate() - 1);

  return new Set([
    `${year}-01-01`,
    toDateKey(goodFriday),
    toDateKey(holySaturday),
    `${year}-05-01`,
    `${year}-05-21`,
    `${year}-06-20`,
    `${year}-06-29`,
    `${year}-07-16`,
    `${year}-08-15`,
    `${year}-09-18`,
    `${year}-09-19`,
    `${year}-10-12`,
    `${year}-10-31`,
    `${year}-11-01`,
    `${year}-12-08`,
    `${year}-12-25`,
  ]);
};

const isSundayKey = (dateKey) => new Date(`${dateKey}T00:00:00`).getDay() === 0;
const isChileHolidayKey = (dateKey) => {
  const year = Number(String(dateKey).slice(0, 4));
  return Number.isFinite(year) && getChileHolidayKeys(year).has(dateKey);
};
const calendarDayToneClass = (dateKey) => (
  isSundayKey(dateKey) || isChileHolidayKey(dateKey) ? 'calendar-red-day' : ''
);

const PRODUCT_TYPE_LABELS = {
  entero: 'Entero',
  carne: 'Carne',
  mc: 'Media Concha',
  sin_definir: 'Sin definir',
};

const getTipoProductoLabel = (value) => (
  PRODUCT_TYPE_LABELS[String(value || '').toLowerCase()] || PRODUCT_TYPE_LABELS.sin_definir
);

const getPreferredTipoProducto = (...values) => {
  for (const value of values) {
    const normalized = String(value || '').toLowerCase();
    if (normalized && normalized !== 'sin_definir') return normalized;
  }
  return 'sin_definir';
};

const getProductClass = (value) => `product-${getPreferredTipoProducto(value)}`;

const PRODUCT_CHIP_LABELS = { entero: 'E', carne: 'C', mc: 'MC', sin_definir: 'SD' };
const getProductChipLabel = (key) => PRODUCT_CHIP_LABELS[String(key || '').toLowerCase()] || 'SD';

const PRODUCT_COLORS = { entero: '#3b82f6', carne: '#f87171', mc: '#34d399', sin_definir: '#cbd5e1' };

function DonutChart({ products, totalTons, activeKey = null }) {
  const r = 30;
  const cx = 40;
  const cy = 40;
  const stroke = 16;
  const circ = 2 * Math.PI * r;
  if (!products.length || totalTons === 0) {
    return (
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      </svg>
    );
  }
  let offsetPct = 0;
  const slices = products.map((p) => {
    const pct = p.tons / totalTons;
    const slice = { key: p.key, pct, offset: offsetPct, color: PRODUCT_COLORS[p.key] || '#94a3b8' };
    offsetPct += pct;
    return slice;
  });
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
      {slices.map((s) => (
        <circle
          key={s.key}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={stroke}
          strokeDasharray={`${circ * s.pct} ${circ * (1 - s.pct)}`}
          strokeDashoffset={-circ * s.offset}
          opacity={activeKey && s.key !== activeKey ? 0.2 : 1}
          style={{ transition: 'opacity 0.2s' }}
        />
      ))}
    </svg>
  );
}

const ADJUST_ACTION_LABELS = {
  sumar: 'Sumar camion',
  suspender: 'Suspender camion',
  set_total: 'Cambiar total del dia',
  suspender_dia: 'Suspender dia completo',
};

const ADJUST_MOTIVOS = ['Planta', 'Clima', 'Transporte', 'Proveedor', 'Sanitario', 'Calidad', 'Comercial', 'Otro'];

const formatDailyAdjustmentText = (ajuste) => {
  if (!ajuste) return '';
  const fecha = ajuste.fecha ? new Date(ajuste.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', timeZone: 'America/Santiago' }) : '';
  const action = ADJUST_ACTION_LABELS[ajuste.accion] || 'Ajuste diario';
  const before = Number(ajuste.camionesAntes || 0);
  const after = Number(ajuste.camionesDespues || 0);
  const motivo = ajuste.motivo ? ` por ${ajuste.motivo}` : '';
  const nota = ajuste.nota ? `: ${ajuste.nota}` : '';
  return `${fecha ? `${fecha} - ` : ''}${action}${motivo}. ${before} -> ${after} cam${nota}`;
};

const SANITARIO_ORDER = { rojo: 4, naranja: 3, amarillo: 2, verde: 1, gris: 0 };

const getISOWeek = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00Z');
  const thu = new Date(d);
  thu.setUTCDate(d.getUTCDate() + (4 - (d.getUTCDay() || 7)));
  const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1));
  return Math.ceil((((thu - yearStart) / 86400000) + 1) / 7);
};
const SANITARIO_LABELS = {
  rojo: 'Bloqueada',
  naranja: 'Alerta',
  amarillo: 'Observacion',
  verde: 'OK',
  gris: 'Sin datos',
};

const SEGUIMIENTO_LABELS = {
  en_plan:      { label: 'En plan',       cls: 'success' },
  con_retrasos: { label: 'Con retrasos',  cls: 'warning' },
  detenido:     { label: 'Detenido',      cls: 'danger'  },
};

const getSanitarioEstado = (value) => String(value?.estado || value || 'gris').toLowerCase();
const getSanitarioLabel = (value) => value?.label || SANITARIO_LABELS[getSanitarioEstado(value)] || 'Sin datos';
const isSanitarioRelevant = (value) => {
  const estado = getSanitarioEstado(value);
  return Boolean(value) && estado !== 'gris' && (estado !== 'verde' || value?.hasObservaciones);
};

const summarizeHarvestItems = (items = []) => {
  const summary = {
    camiones: 0,
    tons: 0,
    providers: new Set(),
    sanitario: null,
    products: {
      entero: { key: 'entero', camiones: 0, tons: 0 },
      carne: { key: 'carne', camiones: 0, tons: 0 },
      mc: { key: 'mc', camiones: 0, tons: 0 },
      sin_definir: { key: 'sin_definir', camiones: 0, tons: 0 },
    },
  };

  items.forEach((item) => {
    const camiones = Number(item?.camiones || 0);
    const tons = Number(item?.tonsDia || 0);
    const productKey = getPreferredTipoProducto(item?.tipoProducto);
    summary.camiones += camiones;
    summary.tons += tons;
    if (item?.proveedorNombre) summary.providers.add(item.proveedorNombre);
    summary.products[productKey].camiones += camiones;
    summary.products[productKey].tons += tons;
    if (item?.sanitario) {
      const current = getSanitarioEstado(summary.sanitario);
      const incoming = getSanitarioEstado(item.sanitario);
      if ((SANITARIO_ORDER[incoming] || 0) > (SANITARIO_ORDER[current] || 0)) {
        summary.sanitario = item.sanitario;
      }
    }
  });

  return {
    camiones: summary.camiones,
    tons: summary.tons,
    providerCount: summary.providers.size,
    products: Object.values(summary.products).filter((item) => item.camiones > 0),
    sanitario: summary.sanitario,
  };
};

const formatHarvestMetric = (camiones = 0, tons = 0, metric = 'both') => {
  if (metric === 'camiones') return `${Number(camiones || 0)} cam`;
  if (metric === 'tons') return fmtTonsInt(tons);
  return `${Number(camiones || 0)} cam · ${fmtTonsInt(tons)}`;
};

const getHarvestMetricKpi = (camiones = 0, tons = 0, metric = 'both') => {
  const tonsValue = Number(tons || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
  const camionesValue = Number(camiones || 0);
  if (metric === 'camiones') return { value: camionesValue, unit: 'cam', note: null };
  if (metric === 'tons') return { value: tonsValue, unit: 't', note: null };
  return { value: tonsValue, unit: 't', note: `${camionesValue} cam` };
};

const getProgramVolumeProgress = (programa, tonsPerTruck = 0, until = new Date()) => {
  const estimated = Number(programa?.tonsEstimadas || 0);
  const desdeKey = programa?.vigenciaDesde ? toChileDateKey(programa.vigenciaDesde) : '';
  const hastaKey = programa?.vigenciaHasta ? toChileDateKey(programa.vigenciaHasta) : '';
  const untilKey = toChileDateKey(until);
  if (!desdeKey || !hastaKey || !untilKey) {
    return { estimated, consumed: 0, balance: estimated };
  }

  const endKey = minDateKey(hastaKey, untilKey);

  const diasSemana = Array.isArray(programa?.diasSemana) && programa.diasSemana.length
    ? new Set(programa.diasSemana.map(Number))
    : new Set([0, 1, 2, 3, 4]);
  const especiales = new Map((programa?.diasEspeciales || []).map((item) => {
    const key = item?.fecha ? toChileDateKey(item.fecha) : '';
    return [key, Number(item?.camiones || 0)];
  }).filter(([key]) => key));

  // Safety net: older API payloads may include ajustesDiarios before diasEspeciales is hydrated
  // in the list response. Use the latest daily adjustment as the visible override only when
  // diasEspeciales does not already define that day.
  [...(programa?.ajustesDiarios || [])]
    .sort((a, b) => new Date(b.createdAt || b.fecha) - new Date(a.createdAt || a.fecha))
    .forEach((ajuste) => {
      const key = ajuste?.fecha ? toChileDateKey(ajuste.fecha) : '';
      if (!key || especiales.has(key)) return;
      especiales.set(key, Number(ajuste.camionesDespues ?? ajuste.camiones ?? 0));
    });

  const specialKeysUntil = [...especiales.keys()].filter((key) => compareDateKeys(key, untilKey) <= 0);
  if (compareDateKeys(endKey, desdeKey) < 0 && !specialKeysUntil.length) {
    return { estimated, consumed: 0, balance: estimated };
  }

  let camiones = 0;
  let cursorKey = specialKeysUntil.length ? minDateKey(desdeKey, ...specialKeysUntil) : desdeKey;
  const cursorEndKey = specialKeysUntil.length ? maxDateKey(endKey, ...specialKeysUntil) : endKey;

  while (compareDateKeys(cursorKey, cursorEndKey) <= 0) {
    const key = cursorKey;
    if (especiales.has(key)) {
      camiones += especiales.get(key);
    } else if (
      compareDateKeys(key, desdeKey) >= 0 &&
      compareDateKeys(key, hastaKey) <= 0 &&
      compareDateKeys(key, untilKey) <= 0 &&
      diasSemana.has(dayOfWeekFromKey(key))
    ) {
      camiones += Number(programa?.camionesDefault || 0);
    }
    cursorKey = addDaysToKey(cursorKey, 1);
  }

  const consumed = camiones * Number(tonsPerTruck || 0);
  const progress = estimated > 0 ? Math.min((consumed / estimated) * 100, 100) : 0;
  return {
    estimated,
    consumed,
    balance: estimated ? estimated - consumed : 0,
    progress,
  };
};

const asText = (value, fallback = '') => {
  if (value == null) return fallback;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => asText(item)).filter(Boolean).join(', ') || fallback;
  }
  if (typeof value === 'object') {
    if ('label' in value) return asText(value.label, fallback);
    if ('nombre' in value) return asText(value.nombre, fallback);
    if ('name' in value) return asText(value.name, fallback);
    if ('value' in value) return asText(value.value, fallback);
    return fallback;
  }
  return fallback;
};

const MONTHS_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const fmtDateShort = (val) => {
  if (!val) return '-';
  // Slice ISO string directly in UTC to avoid timezone day-shift
  const key = typeof val === 'string' ? val.slice(0, 10) : new Date(val).toISOString().slice(0, 10);
  const [, m, d] = key.split('-');
  return `${d}-${MONTHS_SHORT[parseInt(m, 10) - 1]}`;
};

const countWorkingDaysFE = (fromKey, toKey, diasSemana) => {
  if (!fromKey || !toKey || compareDateKeys(fromKey, toKey) > 0) return 0;
  const dias = new Set((Array.isArray(diasSemana) && diasSemana.length ? diasSemana : [0, 1, 2, 3, 4]).map(Number));
  let count = 0;
  let cursor = fromKey;
  while (compareDateKeys(cursor, toKey) <= 0) {
    if (dias.has(dayOfWeekFromKey(cursor))) count++;
    cursor = addDaysToKey(cursor, 1);
    if (count > 500) break; // safety
  }
  return count;
};

const getEffectiveTonsPerTruck = (programa, fallback = 11) => {
  const tonsEst = Number(programa?.tonsEstimadas || 0);
  const camiones = Number(programa?.camionesDefault || 0);
  if (!tonsEst || !camiones) return fallback;
  const desdeKey = programa?.vigenciaDesde ? toChileDateKey(programa.vigenciaDesde) : '';
  const hastaKey = programa?.vigenciaHasta ? toChileDateKey(programa.vigenciaHasta) : '';
  if (!desdeKey || !hastaKey) return fallback;
  const days = countWorkingDaysFE(desdeKey, hastaKey, programa?.diasSemana);
  if (!days) return fallback;
  return tonsEst / (days * camiones);
};

const daysUntilKey = (hastaKey) => {
  if (!hastaKey) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(`${hastaKey}T00:00:00`);
  return Math.round((end - now) / (1000 * 60 * 60 * 24));
};

export default function Biomasa() {
  const { addToast } = useToast();
  const location = useLocation();
  const isStatusView = location.pathname.includes('/status');
  const isProgramView = location.pathname.includes('/programa');
  const isMuestreosView = location.pathname.includes('/muestreos');

  const [statusSubTab, setStatusSubTab] = useState('disponibilidad');
  const [progSubTab, setProgSubTab] = useState('programa');
  
  const [mes, setMes] = useState(mesActual);
  const [statusPeriod, setStatusPeriod] = useState('month'); // 'month' | 'week'
  const { disp, asig, programas, calData, notasDia, tratosAcordados, tratosBiomasa, perdidasBiomasa, reload: load } = useBiomasaData(mes, {
    isStatusView,
    isProgramView,
    isMuestreosView,
    statusSubTab,
    progSubTab
  });

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    // S1 — Trato + Desde
    tratoId: '',
    vigenciaDesde: '',
    vigenciaHasta: '',   // legacy compat for edit; computed at save
    // S2 — Producto + Días
    tipoProducto: 'sin_definir',
    diasSemana: [0, 1, 2, 3, 4],
    // S3 — Programar (modo simple)
    modoProgramacion: 'camiones',
    camionesTotales: '',       // modo camiones: total camiones del programa
    tonsAProgramar: '',        // modo toneladas: total tons
    tipoTransporteId: '',
    tipoTransporteNombre: '',
    toneladasPorCamion: '',
    // S4 — Ritmo diario (modo simple)
    camionesPorDia: '',
    // S5 — Tipos de camión (siempre tabla, 1 fila por defecto)
    modoAvanzado: true,
    transportesAvanzados: [{ tipoTransporteId: '', tipoTransporteNombre: '', camionesTotales: '', cantidadDia: '', toneladasPorCamion: '' }],
    // Misc
    notas: '',
    diasEspeciales: [],
    condicionContinuidad: '',
    camionesDefault: 1,        // legacy: computed at save from camionesPorDia
  });

  const [suspendPopover, setSuspendPopover] = useState(null); // { programa, fecha, x, y, motivo, nota }
  const [notaPopover, setNotaPopover] = useState(null); // { fechaKey, nota, x, y }
  const [pauseModal, setPauseModal] = useState(null); // { id, proveedorNombre }
  const [pauseForm, setPauseForm] = useState({ pausadoDesde: todayKey(), motivoPausa: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizingProgram, setFinalizingProgram] = useState(null);
  const [finalizeForm, setFinalizeForm] = useState({ motivoCierre: '', nota: '', fechaCierre: todayKey() });
  const [showContinuityModal, setShowContinuityModal] = useState(false);
  const [continuitySource, setContinuitySource] = useState(null);
  const [showSegModal, setShowSegModal] = useState(false);
  const [segProg, setSegProg] = useState(null);
  const [segNota, setSegNota] = useState('');
  const [segEstado, setSegEstado] = useState('');
  const [programPeriod, setProgramPeriod] = useState('month');
  const [followupPeriod, setFollowupPeriod] = useState('week');
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustProgram, setAdjustProgram] = useState(null);
  const [adjustForm, setAdjustForm] = useState({
    fecha: todayKey(),
    accion: 'set_total',
    camiones: 0,
    motivo: 'Planta',
    nota: '',
  });
  const [tratoLimites, setTratoLimites] = useState({ vigenciaDesde: '', vigenciaHasta: '', maxCamionesDia: null });
  const [tratoSaldo, setTratoSaldo] = useState(null);
  const [tiposTransporte, setTiposTransporte] = useState([]);
  
  // Estados para Calendario Avanzado
  const [calView, setCalView] = useState('month'); // 'month' | 'week'
  const [selectedDay, setSelectedDay] = useState(null);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [isCalendarBoard, setIsCalendarBoard] = useState(false);
  const [calendarMetric, setCalendarMetric] = useState('both');
  const [showAllProviders, setShowAllProviders] = useState(false);
  const [filterProveedor, setFilterProveedor] = useState(null);
  const [filterProducto, setFilterProducto] = useState(null);
  const [tonsPerTruck, setTonsPerTruck] = useState(11);
  const calendarBoardRef = useRef(null);

  const moveProgramPeriod = useCallback((direction) => {
    if (programPeriod === 'week') {
      setCurrentWeekOffset(offset => offset + direction);
      return;
    }

    setMes(prev => {
      const [y, m] = prev.split('-');
      const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1 + direction, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  }, [programPeriod]);

  const moveFollowupPeriod = useCallback((direction) => {
    if (followupPeriod === 'week') {
      setCurrentWeekOffset(offset => offset + direction);
      return;
    }

    setMes(prev => {
      const [y, m] = prev.split('-');
      const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1 + direction, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  }, [followupPeriod]);

  const moveStatusPeriod = useCallback((direction) => {
    if (statusPeriod === 'week') {
      setCurrentWeekOffset(offset => offset + direction);
      return;
    }

    setMes(prev => {
      const [y, m] = prev.split('-');
      const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1 + direction, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  }, [statusPeriod]);



  // Lógica Matemática de Mes
  const monthData = useMemo(() => {
    if (!mes) return { days: [], padding: 0 };
    const [y, m] = mes.split('-');
    const year = parseInt(y, 10);
    const month = parseInt(m, 10) - 1; // 0-indexed
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0); // último día
    
    // Ajustar Lunes = 0, Domingo = 6
    const dayOfWeek = firstDay.getDay();
    const padding = dayOfWeek === 0 ? 6 : dayOfWeek - 1; 

    return {
      days: Array.from({ length: lastDay.getDate() }, (_, i) => i + 1),
      padding
    };
  }, [mes]);

  // Lógica de Semanas
  const weekDays = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - start.getDay() + 1 + (currentWeekOffset * 7)); // Lunes
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  }, [currentWeekOffset]);

  // Sincronizar el mes cargado cuando cambia la semana seleccionada
  useEffect(() => {
    maestrosApi.getMaestrosActivos('tipo_transporte').then(setTiposTransporte).catch(() => {});
  }, []);

  useEffect(() => {
    const isWeekMode = (isStatusView && statusPeriod === 'week') ||
                       (isProgramView && (programPeriod === 'week' || (progSubTab === 'calendario' && calView === 'week')));
    if (isWeekMode && weekDays && weekDays[0]) {
      const weekMonth = weekDays[0].slice(0, 7);
      if (weekMonth !== mes) {
        setMes(weekMonth);
      }
    }
  }, [isStatusView, statusPeriod, isProgramView, programPeriod, progSubTab, calView, currentWeekOffset, weekDays, mes]);

  const programasById = useMemo(() => {
    const map = new Map();
    programas.forEach((programa) => map.set(String(programa._id), programa));
    return map;
  }, [programas]);

  const programasFiltrados = useMemo(() =>
    filterProveedor ? programas.filter(p => p.proveedorNombre === filterProveedor) : programas,
    [programas, filterProveedor]
  );
  const filteredProgramIds = useMemo(() =>
    new Set(programasFiltrados.map(p => String(p._id))),
    [programasFiltrados]
  );

  const enrichCalendarItem = useCallback((item) => {
    const programa = programasById.get(String(item?.programaId || ''));
    const tipoProducto = getPreferredTipoProducto(
      programa?.tipoProducto,
      programa?.tipoProductoSugerido,
      item?.tipoProducto,
      item?.tipoProductoSugerido
    );
    const camiones = Number(item?.camiones || 0);

    // Effective t/truck: prefer program's transportes[], then scalar toneladasPorCamion, then global setting
    let effectiveTpt;
    if (Array.isArray(programa?.transportes) && programa.transportes.length > 0) {
      const totalCam  = programa.transportes.reduce((s, t) => s + (Number(t.cantidadDia) || 0), 0);
      const totalTons = programa.transportes.reduce((s, t) => s + (Number(t.cantidadDia) || 0) * (Number(t.toneladasPorCamion) || 0), 0);
      effectiveTpt = totalCam > 0 ? totalTons / totalCam : 0;
    } else if (programa?.toneladasPorCamion) {
      effectiveTpt = Number(programa.toneladasPorCamion);
    } else {
      effectiveTpt = Number(tonsPerTruck || 0);
    }

    const tonsDia = camiones * effectiveTpt;
    return {
      ...item,
      camiones,
      tipoProducto,
      tonsEstimadas: item?.tonsEstimadas ?? programa?.tonsEstimadas ?? null,
      tonsDia,
      uxkg: item?.uxkg ?? programa?.uxkg ?? null,
      rendimiento: item?.rendimiento ?? programa?.rendimiento ?? null,
      centroNombre: item?.centroNombre || programa?.centroNombre || '',
      centroCodigo: item?.centroCodigo || programa?.centroCodigo || '',
      sanitario: item?.sanitario || programa?.sanitario || null,
      ajusteTipo: item?.ajusteTipo || '',
      ajusteMotivo: item?.ajusteMotivo || '',
      esDiaEspecial: Boolean(item?.esDiaEspecial),
      cancelado: Boolean(item?.cancelado),
    };
  }, [programasById, tonsPerTruck]);

  const allMonthProviders = useMemo(() => {
    const allIds = new Set(programas.map(p => String(p._id)));
    const map = new Map();
    Object.entries(calData || {}).forEach(([dateKey, day]) => {
      if (!String(dateKey).startsWith(mes)) return;
      (day?.items || []).forEach(item => {
        if (!allIds.has(String(item.programaId))) return;
        const enriched = enrichCalendarItem(item);
        if (filterProducto && enriched.tipoProducto !== filterProducto) return;
        const camiones = Number(enriched.camiones || 0);
        if (camiones <= 0) return;
        const prog = programasById.get(String(item.programaId));
        const nombre = item.proveedorNombre || prog?.proveedorNombre || 'Sin proveedor';
        const tons = enriched.tonsDia;
        if (!map.has(nombre)) map.set(nombre, { nombre, camiones: 0, tons: 0 });
        const entry = map.get(nombre);
        entry.camiones += camiones;
        entry.tons += tons;
      });
    });
    return [...map.values()].sort((a, b) => b.tons - a.tons);
  }, [calData, mes, programas, programasById, enrichCalendarItem, filterProducto]);

  const allWeekProviders = useMemo(() => {
    const allIds = new Set(programas.map(p => String(p._id)));
    const weekSet = new Set(weekDays);
    const map = new Map();
    Object.entries(calData || {}).forEach(([dateKey, day]) => {
      if (!weekSet.has(dateKey)) return;
      (day?.items || []).forEach(item => {
        if (!allIds.has(String(item.programaId))) return;
        const enriched = enrichCalendarItem(item);
        if (filterProducto && enriched.tipoProducto !== filterProducto) return;
        const camiones = Number(enriched.camiones || 0);
        if (camiones <= 0) return;
        const prog = programasById.get(String(item.programaId));
        const nombre = item.proveedorNombre || prog?.proveedorNombre || 'Sin proveedor';
        const tons = enriched.tonsDia;
        if (!map.has(nombre)) map.set(nombre, { nombre, camiones: 0, tons: 0 });
        const entry = map.get(nombre);
        entry.camiones += camiones;
        entry.tons += tons;
      });
    });
    return [...map.values()].sort((a, b) => b.tons - a.tons);
  }, [calData, weekDays, programas, programasById, enrichCalendarItem, filterProducto]);

  // Mezcla de productos SIN filtro de producto (siempre completa, para donut/leyenda)
  const allMonthProducts = useMemo(() => {
    const programIds = new Set(programas.map(p => String(p._id)));
    const products = {
      entero:      { key: 'entero',      tons: 0, camiones: 0 },
      carne:       { key: 'carne',       tons: 0, camiones: 0 },
      mc:          { key: 'mc',          tons: 0, camiones: 0 },
      sin_definir: { key: 'sin_definir', tons: 0, camiones: 0 },
    };
    Object.entries(calData || {}).forEach(([dateKey, day]) => {
      if (!String(dateKey).startsWith(mes)) return;
      (day?.items || [])
        .filter(item => programIds.has(String(item.programaId)))
        .map(enrichCalendarItem)
        .filter(item => Number(item.camiones || 0) > 0)
        .forEach(item => {
          const pk = getPreferredTipoProducto(item.tipoProducto);
          if (products[pk]) {
            products[pk].camiones += Number(item.camiones || 0);
            products[pk].tons += Number(item.tonsDia || 0);
          }
        });
    });
    const total = Object.values(products).reduce((s, p) => s + p.tons, 0);
    return { products: Object.values(products).filter(p => p.camiones > 0), total };
  }, [calData, mes, programas, enrichCalendarItem]);

  const allWeekProducts = useMemo(() => {
    const programIds = new Set(programas.map(p => String(p._id)));
    const weekSet = new Set(weekDays);
    const products = {
      entero:      { key: 'entero',      tons: 0, camiones: 0 },
      carne:       { key: 'carne',       tons: 0, camiones: 0 },
      mc:          { key: 'mc',          tons: 0, camiones: 0 },
      sin_definir: { key: 'sin_definir', tons: 0, camiones: 0 },
    };
    Object.entries(calData || {}).forEach(([dateKey, day]) => {
      if (!weekSet.has(dateKey)) return;
      (day?.items || [])
        .filter(item => programIds.has(String(item.programaId)))
        .map(enrichCalendarItem)
        .filter(item => Number(item.camiones || 0) > 0)
        .forEach(item => {
          const pk = getPreferredTipoProducto(item.tipoProducto);
          if (products[pk]) {
            products[pk].camiones += Number(item.camiones || 0);
            products[pk].tons += Number(item.tonsDia || 0);
          }
        });
    });
    const total = Object.values(products).reduce((s, p) => s + p.tons, 0);
    return { products: Object.values(products).filter(p => p.camiones > 0), total };
  }, [calData, weekDays, programas, enrichCalendarItem]);

  const weekData = useMemo(() => {
    const data = {};
    programasFiltrados.filter(p => ['activo', 'pausado', 'finalizado'].includes(p.estado)).forEach(p => {
      data[p._id] = { 
        nombre: p.proveedorNombre, 
        centro: p.centroNombre,
        tipoProducto: p.tipoProducto || p.tipoProductoSugerido || 'sin_definir',
        dias: weekDays.map((d) => {
          const item = calData[d]?.items?.find(x => x.programaId === p._id);
          const enriched = item ? enrichCalendarItem(item) : null;
          return {
            camiones: enriched?.camiones || 0,
            tipoProducto: enriched?.tipoProducto || p.tipoProducto || p.tipoProductoSugerido || 'sin_definir',
            uxkg: enriched?.uxkg ?? p.uxkg ?? null,
            rendimiento: enriched?.rendimiento ?? p.rendimiento ?? null,
            tonsEstimadas: enriched?.tonsEstimadas ?? p.tonsEstimadas ?? null,
            tonsDia: enriched?.tonsDia || 0,
            sanitario: enriched?.sanitario || p.sanitario || null,
            tipoCamion: enriched?.tipoCamion || p.tipoCamion || '',
            maxisPorCamion: enriched?.maxisPorCamion ?? p.maxisPorCamion ?? null,
            motivo: enriched?.motivo || '',
            ajusteTipo: enriched?.ajusteTipo || '',
            ajusteMotivo: enriched?.ajusteMotivo || '',
            esDiaEspecial: Boolean(enriched?.esDiaEspecial),
            cancelado: Boolean(enriched?.cancelado),
          };
        })
      };
    });
    return data;
  }, [programasFiltrados, calData, weekDays, enrichCalendarItem]);

  const weekSummaries = useMemo(() => {
    const programIds = new Set(programasFiltrados.map(p => String(p._id)));
    const daily = {};
    const total = { camiones: 0, tons: 0 };
    weekDays.forEach((dayKeyValue) => {
      const items = (calData[dayKeyValue]?.items || [])
        .filter(item => programIds.has(String(item.programaId)))
        .map(enrichCalendarItem)
        .filter(item => !filterProducto || item.tipoProducto === filterProducto);
      daily[dayKeyValue] = {
        camiones: items.reduce((sum, item) => sum + Number(item.camiones || 0), 0),
        tons: items.reduce((sum, item) => sum + Number(item.tonsDia || 0), 0),
      };
      total.camiones += daily[dayKeyValue].camiones;
      total.tons += daily[dayKeyValue].tons;
    });

    return { daily, total };
  }, [calData, weekDays, enrichCalendarItem, programasFiltrados, filterProducto]);

  const weekSummaryFull = useMemo(() => {
    const programIds = new Set(programasFiltrados.map(p => String(p._id)));
    const providers = new Map();
    const products = {
      entero: { key: 'entero', camiones: 0, tons: 0 },
      carne: { key: 'carne', camiones: 0, tons: 0 },
      mc: { key: 'mc', camiones: 0, tons: 0 },
      sin_definir: { key: 'sin_definir', camiones: 0, tons: 0 },
    };
    const total = { camiones: 0, tons: 0, days: 0 };
    const sanitaryAlerts = new Map();
    const sanitaryOk = new Map();
    let maximoDia = 0;
    let maximoDiaKey = '';

    weekDays.forEach(dateKey => {
      const day = calData[dateKey] || { items: [] };
      const items = (day.items || [])
        .filter(item => programIds.has(String(item.programaId)))
        .map(enrichCalendarItem)
        .filter(item => !filterProducto || item.tipoProducto === filterProducto)
        .filter(item => Number(item.camiones || 0) > 0);
      if (!items.length) return;
      total.days += 1;
      const dayTons = items.reduce((s, i) => s + Number(i.tonsDia || 0), 0);
      if (dayTons > maximoDia) { maximoDia = dayTons; maximoDiaKey = dateKey; }
      items.forEach(item => {
        const camiones = Number(item.camiones || 0);
        const tons = Number(item.tonsDia || 0);
        const providerKey = item.proveedorNombre || 'Sin proveedor';
        const productKey = getPreferredTipoProducto(item.tipoProducto);
        total.camiones += camiones;
        total.tons += tons;
        products[productKey].camiones += camiones;
        products[productKey].tons += tons;
        if (!providers.has(providerKey)) providers.set(providerKey, { nombre: providerKey, camiones: 0, tons: 0 });
        const prov = providers.get(providerKey);
        prov.camiones += camiones;
        prov.tons += tons;
        const sanitario = item.sanitario;
        if (sanitario) {
          const estado = getSanitarioEstado(sanitario);
          const centro = item.centroCodigo || providerKey;
          if (estado === 'verde') {
            if (!sanitaryOk.has(centro)) sanitaryOk.set(centro, sanitario);
          } else if (['amarillo', 'naranja', 'rojo'].includes(estado)) {
            const prio = SANITARIO_ORDER[estado] || 0;
            if (!sanitaryAlerts.has(centro) || prio > (SANITARIO_ORDER[getSanitarioEstado(sanitaryAlerts.get(centro))] || 0)) {
              sanitaryAlerts.set(centro, sanitario);
            }
          }
        }
      });
    });

    return {
      total,
      providers: [...providers.values()].sort((a, b) => b.tons - a.tons),
      products: Object.values(products).filter(p => p.camiones > 0),
      sanitaryAlerts: [...sanitaryAlerts.values()].sort((a, b) =>
        (SANITARIO_ORDER[getSanitarioEstado(b)] || 0) - (SANITARIO_ORDER[getSanitarioEstado(a)] || 0)
      ),
      sanitaryOk: [...sanitaryOk.values()],
      promedioDiario: total.days > 0 ? total.tons / total.days : 0,
      maximoDia,
      maximoDiaKey,
    };
  }, [calData, weekDays, programasFiltrados, enrichCalendarItem, filterProducto]);

  const programasPeriodo = useMemo(() => {
    const rangeStart = programPeriod === 'week'
      ? new Date(`${weekDays[0]}T00:00:00`)
      : new Date(`${mes}-01T00:00:00`);
    const rangeEnd = programPeriod === 'week'
      ? new Date(`${weekDays[6]}T23:59:59`)
      : new Date(`${finMes(mes)}T23:59:59`);

    return programas.filter((programa) => {
      const desde = programa.vigenciaDesde ? new Date(programa.vigenciaDesde) : null;
      const hasta = programa.vigenciaHasta ? new Date(programa.vigenciaHasta) : null;
      return desde && hasta && desde <= rangeEnd && hasta >= rangeStart;
    });
  }, [mes, programPeriod, programas, weekDays]);

  const monthSummary = useMemo(() => {
    const programIds = new Set(programasFiltrados.map(p => String(p._id)));
    const providers = new Map();
    const products = {
      entero: { key: 'entero', camiones: 0, tons: 0 },
      carne: { key: 'carne', camiones: 0, tons: 0 },
      mc: { key: 'mc', camiones: 0, tons: 0 },
      sin_definir: { key: 'sin_definir', camiones: 0, tons: 0 },
    };
    const total = { camiones: 0, tons: 0, days: 0 };
    const sanitaryAlerts = new Map();
    const sanitaryOk = new Map();
    let maximoDia = 0;

    Object.entries(calData || {}).forEach(([dateKey, day]) => {
      if (!String(dateKey).startsWith(mes)) return;
      const items = (day?.items || [])
        .filter(item => programIds.has(String(item.programaId)))
        .map(enrichCalendarItem)
        .filter(item => !filterProducto || item.tipoProducto === filterProducto)
        .filter((item) => Number(item.camiones || 0) > 0);
      if (!items.length) return;
      total.days += 1;
      const dayTons = items.reduce((s, i) => s + Number(i.tonsDia || 0), 0);
      if (dayTons > maximoDia) maximoDia = dayTons;

      items.forEach((item) => {
        const camiones = Number(item.camiones || 0);
        const tons = Number(item.tonsDia || 0);
        const providerKey = item.proveedorNombre || 'Sin proveedor';
        const productKey = getPreferredTipoProducto(item.tipoProducto);

        total.camiones += camiones;
        total.tons += tons;
        products[productKey].camiones += camiones;
        products[productKey].tons += tons;

        if (!providers.has(providerKey)) {
          providers.set(providerKey, {
            nombre: providerKey,
            centro: item.centroNombre || item.centroCodigo || 'Sin centro definido',
            camiones: 0,
            tons: 0,
          });
        }
        const provider = providers.get(providerKey);
        provider.camiones += camiones;
        provider.tons += tons;

        if (item.sanitario) {
          const estado = getSanitarioEstado(item.sanitario);
          const areaKey = `${item.sanitario?.areaPSMB || item.centroCodigo || providerKey}`;
          if (estado === 'verde') {
            if (!sanitaryOk.has(areaKey)) sanitaryOk.set(areaKey, item.sanitario);
          } else if (isSanitarioRelevant(item.sanitario)) {
            const alertKey = `${areaKey}-${estado}`;
            if (!sanitaryAlerts.has(alertKey)) sanitaryAlerts.set(alertKey, item.sanitario);
          }
        }
      });
    });

    return {
      total,
      providers: [...providers.values()].sort((a, b) => b.tons - a.tons),
      products: Object.values(products).filter((item) => item.camiones > 0),
      sanitaryAlerts: [...sanitaryAlerts.values()].sort((a, b) => (
        (SANITARIO_ORDER[getSanitarioEstado(b)] || 0) - (SANITARIO_ORDER[getSanitarioEstado(a)] || 0)
      )),
      sanitaryOk: [...sanitaryOk.values()],
      promedioDiario: total.days > 0 ? total.tons / total.days : 0,
      maximoDia,
    };
  }, [calData, enrichCalendarItem, mes, programasFiltrados, filterProducto]);

  useEffect(() => {
    document.body.classList.toggle('biomasa-calendar-board-open', isCalendarBoard);
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsCalendarBoard(false);
    };
    if (isCalendarBoard) window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('biomasa-calendar-board-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCalendarBoard]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsCalendarBoard(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleCalendarBoardToggle = useCallback(async () => {
    if (isCalendarBoard) {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      setIsCalendarBoard(false);
      return;
    }

    setIsCalendarBoard(true);
    const target = calendarBoardRef.current;
    if (target?.requestFullscreen) {
      try {
        await target.requestFullscreen();
      } catch {
        addToast({
          title: 'Pantalla completa no disponible',
          message: 'El navegador bloqueó el modo pantalla completa. Puedes usar F11 como alternativa.',
          type: 'warning'
        });
      }
    }
  }, [addToast, isCalendarBoard]);

  useEffect(() => {
    if (selectedDay && !String(selectedDay.key || '').startsWith(mes)) {
      setSelectedDay(null);
    }
  }, [mes, selectedDay]);

  // El usuario ingresa explícitamente la cantidad — no precargar saldo automáticamente

  // Handlers CRUD
  const fetchTratoSaldo = useCallback(async (tratoId, excludeId = null) => {
    if (!tratoId) { setTratoSaldo(null); return; }
    try {
      const params = excludeId ? `?excludeId=${excludeId}` : '';
      const data = await apiClient.get(`/programa-cosecha/saldo-trato/${tratoId}${params}`);
      setTratoSaldo({ tonsAcordadas: data.tonsAcordadas, tonsYaProgramadas: data.tonsYaProgramadas, tonsDisponibles: data.tonsDisponibles });
    } catch {
      setTratoSaldo(null);
    }
  }, []);

  const computeTratoLimites = useCallback((trato) => {
    if (!trato) return { vigenciaDesde: '', vigenciaHasta: '', maxCamionesDia: null };
    const maxCamionesDia = Array.isArray(trato.transportes) && trato.transportes.length > 0
      ? trato.transportes.reduce((s, tr) => s + (Number(tr.cantidadDiaria) || 0), 0)
      : (Number(trato.camionesXDia) || null);
    return {
      vigenciaDesde: trato.vigenciaDesde?.split('T')[0] || '',
      vigenciaHasta: (trato.fechaTerminoCosecha || trato.vigenciaHasta)?.split('T')[0] || '',
      maxCamionesDia,
    };
  }, []);

  const handleOpenModal = useCallback((item = null) => {
    if (item) {
      // Editing existing program
      const trato = tratosAcordados.find(x => String(x._id) === String(item.tratoId));
      setTratoLimites(computeTratoLimites(trato));
      setEditingId(item._id);
      fetchTratoSaldo(item.tratoId, item._id);

      // Convertir todos los transportes a filas (compatibilidad con programas legacy)
      const transportRows = Array.isArray(item.transportes) && item.transportes.length > 0
        ? item.transportes.map(t => {
            const tTpc = Number(t.toneladasPorCamion) || 0;
            const tCam = t.camionesTotales != null
              ? t.camionesTotales
              : (tTpc > 0 && item.tonsEstimadas ? Math.round(item.tonsEstimadas / tTpc) : '');
            return {
              tipoTransporteId: t.tipoTransporteId ? String(t.tipoTransporteId) : '',
              tipoTransporteNombre: t.tipoTransporteNombre || '',
              camionesTotales: tCam,
              cantidadDia: t.cantidadDia ?? item.camionesDefault ?? '',
              toneladasPorCamion: t.toneladasPorCamion ?? '',
            };
          })
        : [{ tipoTransporteId: '', tipoTransporteNombre: '', camionesTotales: '', cantidadDia: '', toneladasPorCamion: '' }];

      setFormData({
        tratoId: item.tratoId || '',
        vigenciaDesde: item.vigenciaDesde ? item.vigenciaDesde.split('T')[0] : '',
        vigenciaHasta: item.vigenciaHasta ? item.vigenciaHasta.split('T')[0] : '',
        tipoProducto: item.tipoProducto || item.tipoProductoSugerido || 'sin_definir',
        diasSemana: item.diasSemana || [0, 1, 2, 3, 4],
        modoProgramacion: 'camiones',
        camionesTotales: '',
        tonsAProgramar: '',
        tipoTransporteId: '',
        tipoTransporteNombre: '',
        toneladasPorCamion: '',
        camionesPorDia: '',
        modoAvanzado: true,
        transportesAvanzados: transportRows,
        notas: item.notas || '',
        diasEspeciales: item.diasEspeciales || [],
        condicionContinuidad: item.condicionContinuidad || '',
        camionesDefault: item.camionesDefault || 1,
      });
    } else {
      // New program
      const t = tratosAcordados.length > 0 ? tratosAcordados[0] : null;
      const limites = computeTratoLimites(t);
      setTratoLimites(limites);
      setEditingId(null);
      setFormData({
        tratoId: t?._id || '',
        vigenciaDesde: limites.vigenciaDesde || `${mes}-01`,
        vigenciaHasta: limites.vigenciaHasta || finMes(mes),
        tipoProducto: t?.tipoProducto || t?.tipoProductoSugerido || 'sin_definir',
        diasSemana: [0, 1, 2, 3, 4],
        modoProgramacion: 'camiones',
        camionesTotales: '',
        tonsAProgramar: '',
        tipoTransporteId: '',
        tipoTransporteNombre: '',
        toneladasPorCamion: '',
        camionesPorDia: '',
        modoAvanzado: true,
        transportesAvanzados: [{ tipoTransporteId: '', tipoTransporteNombre: '', camionesTotales: '', cantidadDia: '', toneladasPorCamion: '' }],
        notas: '',
        diasEspeciales: [],
        condicionContinuidad: '',
        camionesDefault: 1,
      });
      fetchTratoSaldo(t?._id);
    }
    setSubmitAttempted(false);
    setShowModal(true);
  }, [tratosAcordados, mes, computeTratoLimites, fetchTratoSaldo]);

  const handleSave = useCallback(async (e) => {
    e?.preventDefault?.();
    const selectedTrato = tratosAcordados.find(t => t._id === formData.tratoId);

    // Build transport payload and derive tonsEstimadas
    let tonsEstimadas, transportesPayload, totalToneladasDia;
    const tpc = Number(formData.toneladasPorCamion) || 0;
    const cpd = Number(formData.camionesPorDia) || 0;

    if (formData.modoAvanzado) {
      transportesPayload = formData.transportesAvanzados.map(t => ({
        tipoTransporteId: t.tipoTransporteId || null,
        tipoTransporteNombre: t.tipoTransporteNombre || '',
        camionesTotales: Number(t.camionesTotales) || 0,
        cantidadDia: Number(t.cantidadDia) || 1,
        toneladasPorCamion: t.toneladasPorCamion !== '' && t.toneladasPorCamion != null ? Number(t.toneladasPorCamion) : null,
        costoFlete: null,
      }));
      tonsEstimadas = transportesPayload.reduce((s, t) => s + (t.camionesTotales || 0) * (t.toneladasPorCamion || 0), 0);
      totalToneladasDia = transportesPayload.reduce((s, t) => s + (t.cantidadDia || 0) * (t.toneladasPorCamion || 0), 0);
    } else if (formData.modoProgramacion === 'toneladas') {
      tonsEstimadas = Number(formData.tonsAProgramar) || 0;
      totalToneladasDia = cpd * tpc;
      transportesPayload = [{
        tipoTransporteId: formData.tipoTransporteId || null,
        tipoTransporteNombre: formData.tipoTransporteNombre || '',
        camionesTotales: tpc > 0 ? Math.ceil(tonsEstimadas / tpc) : null,
        cantidadDia: cpd,
        toneladasPorCamion: tpc || null,
        costoFlete: null,
      }];
    } else {
      // modo camiones (default)
      const camionesTotales = Number(formData.camionesTotales) || 0;
      tonsEstimadas = camionesTotales * tpc;
      totalToneladasDia = cpd * tpc;
      transportesPayload = [{
        tipoTransporteId: formData.tipoTransporteId || null,
        tipoTransporteNombre: formData.tipoTransporteNombre || '',
        camionesTotales,
        cantidadDia: cpd,
        toneladasPorCamion: tpc || null,
        costoFlete: null,
      }];
    }

    // Validar: total programa vs disponible del trato
    const disponible = tratoSaldo?.tonsDisponibles;
    if (disponible != null && tonsEstimadas > disponible) {
      addToast({
        title: 'Saldo insuficiente',
        message: `No puedes programar ${fmtNumber(tonsEstimadas, 0)} t. Disponible del trato: ${fmtNumber(disponible, 0)} t.`,
        type: 'error',
      });
      return;
    }

    // Validar: ritmo diario no puede superar total del programa
    if (totalToneladasDia > 0 && tonsEstimadas > 0 && totalToneladasDia > tonsEstimadas) {
      const diasRes = Math.ceil(tonsEstimadas / totalToneladasDia);
      addToast({
        title: 'Ritmo excesivo',
        message: `El ritmo diario (${fmtNumber(totalToneladasDia, 0)} t/día) supera el total del programa (${fmtNumber(tonsEstimadas, 0)} t). Solo ${diasRes} día efectivo. Reduce los camiones por día.`,
        type: 'error',
      });
      return;
    }

    const syntheticTpts = transportesPayload.map(t => ({ cantidadDia: t.cantidadDia, toneladasPorCamion: t.toneladasPorCamion }));
    const terminoISO = calcTerminoProgramaISO(formData.vigenciaDesde, tonsEstimadas, syntheticTpts, formData.diasSemana);
    const camionesDefault = transportesPayload.reduce((s, t) => s + (Number(t.cantidadDia) || 0), 0) || 1;

    const payload = {
      tratoId: formData.tratoId,
      vigenciaDesde: formData.vigenciaDesde,
      vigenciaHasta: terminoISO || formData.vigenciaHasta || undefined,
      camionesDefault,
      tipoProducto: formData.tipoProducto,
      diasSemana: formData.diasSemana,
      modoProgramacion: formData.modoAvanzado ? 'camiones' : formData.modoProgramacion,
      tonsEstimadas: tonsEstimadas || null,
      transportes: transportesPayload,
      notas: formData.notas,
      diasEspeciales: formData.diasEspeciales || [],
      condicionContinuidad: formData.condicionContinuidad || '',
      proveedorNombre: selectedTrato?.proveedorNombre || programas.find(p => p._id === editingId)?.proveedorNombre || '',
      centroNombre: selectedTrato?.centroNombre || selectedTrato?.centroCodigo || programas.find(p => p._id === editingId)?.centroNombre || '',
    };

    console.log('[PROGRAMA CONFIRM SAVE]', payload);
    try {
      const endpoint = editingId ? `/programa-cosecha/${editingId}` : '/programa-cosecha';
      const method = editingId ? 'put' : 'post';
      await apiClient[method](endpoint, payload);
      addToast({ title: editingId ? 'Programa Actualizado' : 'Programa Creado', message: editingId ? 'Los cambios fueron guardados.' : 'El programa de cosecha fue creado.', type: 'success' });
      setShowModal(false);
      setShowConfirm(false);
      load();
    } catch (err) {
      if (err?.data?.code === 'TONS_EXCEED_TRATO') {
        const d = err.data?.details || {};
        addToast({ title: 'Saldo insuficiente', message: `No puedes programar ${d.tonsSolicitadas} t. El trato tiene solo ${d.tonsDisponibles} t disponibles.`, type: 'error' });
      } else if (err?.data?.code === 'ERR_CAPACITY_EXCEEDS_OBJETIVO') {
        const d = err.data?.details || {};
        addToast({ title: 'Ritmo excesivo', message: `Ritmo: ${fmtNumber(d.totalTDia || 0, 0)} t/día vs total ${fmtNumber(d.tonsEstimadas || 0, 0)} t (${d.diasResultantes ?? 1} día). Reduce camiones/día.`, type: 'error' });
      } else {
        addToast({ title: 'Error', message: err.message, type: 'error' });
      }
    }
  }, [formData, tratoSaldo, tratosAcordados, programas, editingId, addToast, load]);

  const handleStatusChange = useCallback(async (id, nuevoEstado) => {
    try {
      await apiClient.patch(`/programa-cosecha/${id}/estado`, { estado: nuevoEstado });
      addToast({ title: nuevoEstado === 'activo' ? 'Programa Reanudado' : 'Programa Pausado', message: `El estado fue cambiado a ${nuevoEstado}.`, type: 'success' });
      load();
    } catch (e) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [addToast, load]);

  const handlePauseConfirm = useCallback(async () => {
    if (!pauseModal) return;
    try {
      await apiClient.patch(`/programa-cosecha/${pauseModal.id}/estado`, {
        estado: 'pausado',
        pausadoDesde: pauseForm.pausadoDesde,
        motivoPausa: pauseForm.motivoPausa,
      });
      addToast({ title: 'Programa Pausado', message: `${pauseModal.proveedorNombre} pausado desde ${pauseForm.pausadoDesde}.`, type: 'success' });
      setPauseModal(null);
      load();
    } catch (e) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [pauseModal, pauseForm, addToast, load]);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) return;
    const nombre = confirmDelete.proveedorNombre;
    try {
      await apiClient.delete(`/programa-cosecha/${confirmDelete._id}`);
      addToast({ title: 'Programa Eliminado', message: `El programa de ${nombre} fue eliminado.`, type: 'success' });
      setConfirmDelete(null);
      load();
    } catch (e) { 
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [confirmDelete, addToast, load]);

  const handleSegSave = useCallback(async (e) => {
    e.preventDefault();
    if (!segNota.trim() || !segEstado) return;
    try {
      await apiClient.post(`/programa-cosecha/${segProg._id}/seguimiento`, { estado: segEstado, nota: segNota });
      addToast({ title: 'Éxito', message: 'Novedad registrada con éxito', type: 'success' });
      setShowSegModal(false);
      setSegNota('');
      setSegEstado('');
      load();
    } catch (e) { 
      addToast({ title: 'Error', message: e.message, type: 'error' }); 
    }
  }, [segNota, segEstado, segProg, addToast, load]);

  const handleOpenFinalizeModal = useCallback((programa) => {
    setFinalizingProgram(programa);
    setFinalizeForm({ motivoCierre: '', nota: '', fechaCierre: todayKey() });
    setShowFinalizeModal(true);
  }, []);

  const handleFinalizarConfirm = useCallback(async (e) => {
    e.preventDefault();
    if (!finalizingProgram || !finalizeForm.motivoCierre) return;
    try {
      await apiClient.post(`/programa-cosecha/${finalizingProgram._id}/cerrar`, {
        motivoCierre: finalizeForm.motivoCierre,
        nota: finalizeForm.nota,
        fechaCierre: finalizeForm.fechaCierre,
      });
      addToast({ title: 'Programa finalizado', message: `El programa de ${finalizingProgram.proveedorNombre} fue cerrado.`, type: 'success' });
      setShowFinalizeModal(false);
      setContinuitySource(finalizingProgram);
      setShowContinuityModal(true);
      setFinalizingProgram(null);
      load();
    } catch (err) {
      addToast({ title: 'Error', message: err.message, type: 'error' });
    }
  }, [finalizingProgram, finalizeForm, addToast, load]);

  const handleCrearContinuidad = useCallback(() => {
    if (!continuitySource) return;
    setShowContinuityModal(false);
    setEditingId(null);
    const firstT = continuitySource.transportes?.[0] || {};
    const modo = continuitySource.modoProgramacion || (firstT.camionesTotales != null ? 'camiones' : 'toneladas');
    const isAvanzado = Array.isArray(continuitySource.transportes) && continuitySource.transportes.length > 1;
    setFormData({
      tratoId: continuitySource.tratoId || '',
      vigenciaDesde: '',
      vigenciaHasta: '',
      tipoProducto: continuitySource.tipoProducto || 'sin_definir',
      diasSemana: continuitySource.diasSemana || [0, 1, 2, 3, 4],
      modoProgramacion: modo,
      camionesTotales: '',   // nuevo programa: cantidad a programar vacía
      tonsAProgramar: '',
      tipoTransporteId: firstT.tipoTransporteId ? String(firstT.tipoTransporteId) : '',
      tipoTransporteNombre: firstT.tipoTransporteNombre || '',
      toneladasPorCamion: firstT.toneladasPorCamion ?? '',
      camionesPorDia: firstT.cantidadDia ?? continuitySource.camionesDefault ?? '',
      modoAvanzado: isAvanzado,
      transportesAvanzados: isAvanzado
        ? continuitySource.transportes.map(t => ({
            tipoTransporteId: t.tipoTransporteId ? String(t.tipoTransporteId) : '',
            tipoTransporteNombre: t.tipoTransporteNombre || '',
            camionesTotales: '',
            cantidadDia: t.cantidadDia ?? 1,
            toneladasPorCamion: t.toneladasPorCamion ?? '',
          }))
        : [],
      notas: '',
      diasEspeciales: [],
      condicionContinuidad: 'Sin Condición',
      camionesDefault: continuitySource.camionesDefault || 1,
    });
    setTratoLimites({ vigenciaDesde: '', vigenciaHasta: '', maxCamionesDia: null });
    fetchTratoSaldo(continuitySource.tratoId);
    setSubmitAttempted(false);
    setShowModal(true);
  }, [continuitySource, fetchTratoSaldo]);

  const handleQuickAdjust = useCallback(async (programa, fecha, delta, currentCamiones) => {
    if (!programa?._id) return;
    const base = currentCamiones != null ? Number(currentCamiones) : Number(programa.camionesDefault || 0);
    const nuevo = Math.max(0, base + delta);
    try {
      await apiClient.post(`/programa-cosecha/${programa._id}/ajuste-diario`, {
        fecha,
        // "+" usa 'sumar' para acumular en el estado del servidor (evita conflictos con stale UI)
        // "-" usa set_total con el valor calculado; suspender_dia si llega a 0
        accion: nuevo === 0 ? 'suspender_dia' : delta > 0 ? 'sumar' : 'set_total',
        camiones: delta > 0 ? 1 : nuevo,
        motivo: '',
        nota: '',
      });
      load();
    } catch (e) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [addToast, load]);

  const handleSuspendDay = useCallback(async (programa, fecha, motivo, nota = '') => {
    if (!programa?._id) return;
    try {
      await apiClient.post(`/programa-cosecha/${programa._id}/ajuste-diario`, {
        fecha, accion: 'suspender_dia', camiones: 0, motivo, nota,
      });
      setSuspendPopover(null);
      load();
    } catch (e) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [addToast, load]);

  const handleReactivateDay = useCallback(async (programa, fecha) => {
    if (!programa?._id) return;
    try {
      await apiClient.post(`/programa-cosecha/${programa._id}/ajuste-diario`, {
        fecha, accion: 'set_total', camiones: programa.camionesDefault || 1, motivo: '', nota: '',
      });
      load();
    } catch (e) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [addToast, load]);

  const handleUpsertNotaDia = useCallback(async (fechaKey, nota) => {
    if (!fechaKey || !String(nota || '').trim()) return;
    try {
      await apiClient.post('/notas-dia', { fechaKey, nota });
      setNotaPopover(null);
      load();
    } catch (e) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [addToast, load]);

  const handleDeleteNotaDia = useCallback(async (fechaKey) => {
    try {
      await apiClient.delete(`/notas-dia/${fechaKey}`);
      setNotaPopover(null);
      load();
    } catch (e) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [addToast, load]);

  const handleOpenAdjustModal = useCallback((programa, fecha = todayKey(), currentCamiones = null) => {
    if (!programa) return;
    const current = currentCamiones != null ? Number(currentCamiones || 0) : Number(programa.camionesDefault || 0);
    setAdjustProgram(programa);
    setAdjustForm({
      fecha,
      accion: 'set_total',
      camiones: current,
      motivo: 'Planta',
      nota: '',
    });
    setShowAdjustModal(true);
  }, []);

  const handleAdjustSave = useCallback(async (e) => {
    e.preventDefault();
    if (!adjustProgram?._id || !adjustForm.fecha) return;
    try {
      await apiClient.post(`/programa-cosecha/${adjustProgram._id}/ajuste-diario`, {
        ...adjustForm,
        camiones: Number(adjustForm.camiones || 0),
      });
      addToast({
        title: 'Ajuste diario registrado',
        message: 'El calendario y el seguimiento fueron actualizados.',
        type: 'success',
      });
      setShowAdjustModal(false);
      setAdjustProgram(null);
      setSelectedDay(null);
      load();
    } catch (e) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [adjustForm, adjustProgram, addToast, load]);

  const recentDailyAdjustments = useMemo(() => {
    const weekSet = new Set(weekDays);
    return programas
      .flatMap((programa) => (programa.ajustesDiarios || []).map((ajuste) => ({
        ...ajuste,
        programaId: programa._id,
        proveedorNombre: programa.proveedorNombre,
        centroNombre: programa.centroNombre,
      })))
      .filter((ajuste) => {
        const dateKey = ajuste.fecha ? new Date(ajuste.fecha).toISOString().slice(0, 10) : '';
        return followupPeriod === 'week' ? weekSet.has(dateKey) : dateKey.startsWith(mes);
      })
      .sort((a, b) => new Date(b.createdAt || b.fecha) - new Date(a.createdAt || a.fecha))
      .slice(0, followupPeriod === 'week' ? 12 : 20);
  }, [followupPeriod, mes, programas, weekDays]);

  const followupPrograms = useMemo(() => {
    const rangeStart = followupPeriod === 'week'
      ? new Date(`${weekDays[0]}T00:00:00`)
      : new Date(`${mes}-01T00:00:00`);
    const rangeEnd = followupPeriod === 'week'
      ? new Date(`${weekDays[6]}T23:59:59`)
      : new Date(`${finMes(mes)}T23:59:59`);
    const weekSet = new Set(weekDays);

    return programas
      .filter((programa) => {
        if (programa.estado !== 'activo') return false;
        const desde = programa.vigenciaDesde ? new Date(programa.vigenciaDesde) : null;
        const hasta = programa.vigenciaHasta ? new Date(programa.vigenciaHasta) : null;
        const overlapsVigencia = desde && hasta && desde <= rangeEnd && hasta >= rangeStart;
        const hasAdjustmentInPeriod = (programa.diasEspeciales || []).some((item) => {
          const key = item?.fecha ? new Date(item.fecha).toISOString().slice(0, 10) : '';
          return followupPeriod === 'week' ? weekSet.has(key) : key.startsWith(mes);
        });
        return overlapsVigencia || hasAdjustmentInPeriod;
      });
  }, [followupPeriod, mes, programas, weekDays]);

  const followupSummary = useMemo(() => {
    const netDelta = recentDailyAdjustments.reduce((sum, ajuste) => sum + Number(ajuste.camionesDelta || 0), 0);
    const todayItems = (calData[todayKey()]?.items || []).map(enrichCalendarItem);
    return {
      activePrograms: followupPrograms.length,
      adjustments: recentDailyAdjustments.length,
      netDelta,
      todayCamiones: todayItems.reduce((sum, item) => sum + Number(item.camiones || 0), 0),
    };
  }, [calData, enrichCalendarItem, followupPrograms.length, recentDailyAdjustments]);

  const adjustMaxCamiones = useMemo(() => {
    if (!adjustProgram?.tratoId) return null;
    const t = tratosAcordados.find(x => String(x._id) === String(adjustProgram.tratoId));
    if (!t) return null;
    return Array.isArray(t.transportes) && t.transportes.length > 0
      ? t.transportes.reduce((s, tr) => s + (Number(tr.cantidadDiaria) || 0), 0)
      : (Number(t.camionesXDia) || null);
  }, [adjustProgram, tratosAcordados]);

  const getLatestProgramNovelty = useCallback((programa) => {
    const weekSet = new Set(weekDays);
    const latestAdjustment = [...(programa?.ajustesDiarios || [])]
      .filter((ajuste) => {
        const dateKey = ajuste.fecha ? new Date(ajuste.fecha).toISOString().slice(0, 10) : '';
        return followupPeriod === 'week' ? weekSet.has(dateKey) : dateKey.startsWith(mes);
      })
      .sort((a, b) => new Date(b.createdAt || b.fecha) - new Date(a.createdAt || a.fecha))[0];
    if (latestAdjustment) return formatDailyAdjustmentText(latestAdjustment);
    return programa?.seguimientos?.[0]?.nota || 'Sin novedades registradas recientemente.';
  }, [followupPeriod, mes, weekDays]);

  const getProgramDayCamiones = useCallback((programa, dateKey = todayKey()) => {
    const base = Number(programa?.camionesDefault || 0);
    const calendarItem = (calData[dateKey]?.items || []).find(dayItem => String(dayItem.programaId) === String(programa?._id));
    if (calendarItem) return Number(calendarItem.camiones ?? base);

    const specialDay = (programa?.diasEspeciales || []).find((item) => toChileDateKey(item?.fecha) === dateKey);
    if (specialDay) return Number(specialDay.camiones ?? base);

    const latestAdjustment = [...(programa?.ajustesDiarios || [])]
      .filter((ajuste) => toChileDateKey(ajuste?.fecha) === dateKey)
      .sort((a, b) => new Date(b.createdAt || b.fecha) - new Date(a.createdAt || a.fecha))[0];
    if (latestAdjustment) return Number(latestAdjustment.camionesDespues ?? base);

    return base;
  }, [calData]);

  const getTodayProgramCamiones = useCallback((programa) => (
    getProgramDayCamiones(programa, todayKey())
  ), [getProgramDayCamiones]);

  const getProgramCamionesStatus = useCallback((programa) => {
    const base = Number(programa?.camionesDefault || 0);
    const today = getTodayProgramCamiones(programa);
    return {
      base,
      today,
      adjusted: today !== base,
    };
  }, [getTodayProgramCamiones]);

  const kpis = useMemo(() => {
    const disponible = disp.reduce((s, i) => s + (i.tons || 0), 0);
    const totalAsignado = asig.reduce((s, i) => s + Number(i.tons || 0), 0);
    const pct = disponible > 0 ? (totalAsignado / disponible) * 100 : 0;
    return { disponible, totalAsignado, saldo: disponible - totalAsignado, pct };
  }, [disp, asig]);

  const getSituacionBiomasaLabel = (item) => {
    const raw = asText(item?.situacionBiomasa || item?.estado, '').toLowerCase();
    if (raw === 'en_conversacion' || raw === 'negociando') return 'En conversación';
    if (raw === 'reservada' || raw === 'semi_acordado' || raw === 'semi_cerrado') return 'Reservada';
    if (raw === 'acordada' || raw === 'acordado' || raw === 'cerrado' || raw === 'compra_efectuada') return 'Acordada';
    return asText(item?.situacionBiomasa || item?.estado, 'Sin definir');
  };

  const getProgramaLabel = (item) => {
    const raw = asText(item?.programaEstado, '').toLowerCase();
    if (raw === 'activo') return 'Programada';
    if (raw === 'pausado') return 'Programada pausada';
    if (raw === 'finalizado') return 'Ejecutada';
    return 'Sin programa';
  };

  const isDateInActiveWeek = useCallback((dateValue) => {
    if (!dateValue) return false;
    const dateStr = new Date(dateValue).toISOString().slice(0, 10);
    return weekDays.includes(dateStr);
  }, [weekDays]);

  const visibleTratosBiomasa = useMemo(() => {
    if (statusPeriod === 'month') return tratosBiomasa;
    return tratosBiomasa.filter(item => {
      const date = item?.fechaCierre || item?.updatedAt || item?.ultimaActividadAt || item?.fecha;
      return isDateInActiveWeek(date);
    });
  }, [statusPeriod, tratosBiomasa, isDateInActiveWeek]);

  const visiblePerdidasBiomasa = useMemo(() => {
    if (statusPeriod === 'month') return perdidasBiomasa;
    return perdidasBiomasa.filter(item => {
      const date = item?.fechaCierre || item?.updatedAt || item?.ultimaActividadAt || item?.fecha;
      return isDateInActiveWeek(date);
    });
  }, [statusPeriod, perdidasBiomasa, isDateInActiveWeek]);

  const visibleBiomasaPendiente = useMemo(
    () => visibleTratosBiomasa.filter((item) => !asText(item?.programaEstado, '').trim()),
    [visibleTratosBiomasa]
  );

  const visibleBiomasaVinculada = useMemo(
    () => visibleTratosBiomasa.filter((item) => asText(item?.programaEstado, '').trim()),
    [visibleTratosBiomasa]
  );

  const visibleNegociacionKpis = useMemo(() => {
    const sumTons = (items) => items.reduce((acc, item) => acc + (Number(item?.tonsAcordadas || item?.tons || item?.biomasaEstimacion || 0)), 0);
    const enConversacion = visibleBiomasaPendiente.filter((item) => getSituacionBiomasaLabel(item) === 'En conversación');
    const acordadas = visibleTratosBiomasa.filter((item) => getSituacionBiomasaLabel(item) === 'Acordada');
    return {
      enConversacionTons: sumTons(enConversacion),
      acordadasTons: sumTons(acordadas),
      perdidasTons: sumTons(visiblePerdidasBiomasa),
    };
  }, [visibleBiomasaPendiente, visiblePerdidasBiomasa, visibleTratosBiomasa]);

  if (!isStatusView && !isProgramView && !isMuestreosView) return <Navigate to="/biomasa/status" replace />;

  return (
    <div className="mx-page">
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">
            {isStatusView ? 'Operacion · Disponibilidad' : isProgramView ? 'Operacion · Programa de cosecha' : 'Operacion · Muestreos tecnicos'}
          </p>
          <h1 className="biomasa-title">{isStatusView ? 'Disponibilidad de biomasa' : isProgramView ? 'Programa de Cosecha' : 'Muestreos Tecnicos'}</h1>
        </div>
      </header>

      <div className={`mx-content-frame biomasa-content-frame ${isMuestreosView ? 'biomasa-content-frame--muestreos' : ''}`}>
        {!isMuestreosView && (
        <div className="mx-toolbar">
          <div className="mx-toggle-group">
            {isStatusView ? (
              <>
                <button className={`mx-toggle-btn ${statusSubTab === 'disponibilidad' ? 'active' : ''}`} onClick={() => setStatusSubTab('disponibilidad')}><Inbox size={14} /> Disponibilidad</button>
                <button className={`mx-toggle-btn ${statusSubTab === 'negociacion' ? 'active' : ''}`} onClick={() => setStatusSubTab('negociacion')}><ShoppingCart size={14} /> Negociación</button>
              </>
            ) : isProgramView ? (
              <>
                <button className={`mx-toggle-btn ${progSubTab === 'programa' ? 'active' : ''}`} onClick={() => setProgSubTab('programa')}><ListIcon size={14} /> Programa</button>
                <button className={`mx-toggle-btn ${progSubTab === 'calendario' ? 'active' : ''}`} onClick={() => setProgSubTab('calendario')}><LayoutGrid size={14} /> Calendario cosechas</button>
                <button className={`mx-toggle-btn ${progSubTab === 'seguimiento' ? 'active' : ''}`} onClick={() => setProgSubTab('seguimiento')}><Activity size={14} /> Seguimiento</button>
              </>
            ) : null}
          </div>
          {(isProgramView && progSubTab === 'programa') && (
            <button className="mx-btn mx-btn-primary" onClick={() => handleOpenModal()}>
              <Plus size={18} /> Crear Programa
            </button>
          )}
        </div>
        )}

        <div className="tab-content-area">
          {isStatusView && (
            <div className="status-view">
              
              {/* Selector de periodo y actualizar para Status */}
              <div className="mx-toolbar status-period-toolbar am-mb-16" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div className="mx-toggle-group">
                    <button 
                      type="button" 
                      className={`mx-toggle-btn ${statusPeriod === 'month' ? 'active' : ''}`} 
                      onClick={() => setStatusPeriod('month')}
                    >
                      Vista Mes
                    </button>
                    <button 
                      type="button" 
                      className={`mx-toggle-btn ${statusPeriod === 'week' ? 'active' : ''}`} 
                      onClick={() => setStatusPeriod('week')}
                    >
                      Vista Semana
                    </button>
                  </div>
                  
                  <div className="harvest-calendar-period" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="mx-btn-icon sm" 
                      onClick={() => moveStatusPeriod(-1)}
                      aria-label="Periodo anterior"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontWeight: 'var(--weight-bold)', fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-text)' }}>
                      {statusPeriod === 'week'
                        ? `Semana ${new Date(weekDays[0] + 'T12:00:00Z').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', timeZone: 'America/Santiago' })}`
                        : mesLabel(mes, true)}
                    </span>
                    <button 
                      type="button" 
                      className="mx-btn-icon sm" 
                      onClick={() => moveStatusPeriod(1)}
                      aria-label="Periodo siguiente"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                <button 
                  type="button" 
                  className="mx-btn mx-btn-outline sm" 
                  onClick={load}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RotateCcw size={14} /> Actualizar
                </button>
              </div>
              {statusSubTab === 'disponibilidad' ? (
                <div className="mx-kpi-grid">
                  <div className="mx-kpi-card">
                    <div className="mx-kpi-label">Disponible</div>
                    <div className="mx-kpi-value" style={{ color: 'var(--color-info)' }}>{fmtTons(kpis.disponible)}</div>
                  </div>
                  <div className="mx-kpi-card">
                    <div className="mx-kpi-label">Asignado</div>
                    <div className="mx-kpi-value" style={{ color: 'var(--color-success)' }}>{fmtTons(kpis.totalAsignado)}</div>
                  </div>
                  <div className="mx-kpi-card">
                    <div className="mx-kpi-label">Saldo Mensual</div>
                    <div className="mx-kpi-value" style={{ color: kpis.saldo >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>{fmtTons(kpis.saldo)}</div>
                    <div className="mx-progress am-mt-12">
                      <div className="mx-progress-fill" style={{ width: `${Math.min(kpis.pct, 100)}%` }}></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mx-kpi-grid">
                  <div className="mx-kpi-card">
                    <div className="mx-kpi-label">En conversación</div>
                    <div className="mx-kpi-value" style={{ color: 'var(--color-info)' }}>{fmtTons(visibleNegociacionKpis.enConversacionTons)}</div>
                  </div>
                  <div className="mx-kpi-card">
                    <div className="mx-kpi-label">Acordadas</div>
                    <div className="mx-kpi-value" style={{ color: 'var(--color-success)' }}>{fmtTons(visibleNegociacionKpis.acordadasTons)}</div>
                  </div>
                  <div className="mx-kpi-card">
                    <div className="mx-kpi-label">{statusPeriod === 'week' ? 'Pérdidas de la semana' : 'Pérdidas del mes'}</div>
                    <div className="mx-kpi-value" style={{ color: 'var(--color-error)' }}>{fmtTons(visibleNegociacionKpis.perdidasTons)}</div>
                  </div>
                </div>
              )}
              <div className="mx-table-card">
                <table className="mx-table">
                  <thead>
                    <tr>
                      <th>Proveedor</th>
                      <th>{statusSubTab === 'disponibilidad' ? 'Mes' : 'Situación biomasa'}</th>
                      <th style={{ textAlign: 'center' }}>Tons</th>
                      {statusSubTab === 'disponibilidad' ? <th>Centro</th> : <th>Programa</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(statusSubTab === 'disponibilidad' ? disp : [...visibleBiomasaPendiente, ...visibleBiomasaVinculada]).map(item => (
                      <tr key={item._id}>
                        <td style={{ fontWeight: 'var(--weight-bold)' }}>{item.proveedorNombre}</td>
                        <td>{statusSubTab === 'disponibilidad' ? mesLabel(item.mesKey) : getSituacionBiomasaLabel(item)}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'var(--weight-bold)' }}>{fmtTons(statusSubTab === 'disponibilidad' ? item.tons : (item.tonsAcordadas || item.tons || item.biomasaEstimacion || 0))}</td>
                        {statusSubTab === 'disponibilidad' ? <td>{item.centroCodigo || '—'}</td> : <td>{getProgramaLabel(item)}</td>}
                      </tr>
                    ))}
                    {statusSubTab !== 'disponibilidad' && visiblePerdidasBiomasa.map((item) => (
                      <tr key={`perdida-${item._id}`}>
                        <td style={{ fontWeight: 'var(--weight-bold)' }}>{item.proveedorNombre}</td>
                        <td>{item.motivoCierre || 'Pérdida'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'var(--weight-bold)', color: 'var(--color-error)' }}>
                          {fmtTons(item.tonsAcordadas || item.tons || item.biomasaEstimacion || 0)}
                        </td>
                        <td>Pérdida real</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isProgramView && (
            <div className="program-view">
              {progSubTab === 'programa' && (
                <div className="mx-table-card harvest-program-table-card">
                  <div className="harvest-program-toolbar">
                    <div className="harvest-program-controls">
                      <div className="mx-toggle-group">
                        <button className={`mx-toggle-btn ${programPeriod === 'month' ? 'active' : ''}`} onClick={() => setProgramPeriod('month')}>Vista Mes</button>
                        <button className={`mx-toggle-btn ${programPeriod === 'week' ? 'active' : ''}`} onClick={() => setProgramPeriod('week')}>Vista Semana</button>
                      </div>
                      <div className="harvest-program-period">
                        <button className="mx-btn-icon sm" onClick={() => moveProgramPeriod(-1)} aria-label="Periodo anterior">
                          <ChevronLeft size={16} />
                        </button>
                        <span>
                          {programPeriod === 'week'
                            ? `Semana ${new Date(weekDays[0] + 'T12:00:00Z').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', timeZone: 'America/Santiago' })}`
                            : mesLabel(mes, true)}
                        </span>
                        <button className="mx-btn-icon sm" onClick={() => moveProgramPeriod(1)} aria-label="Periodo siguiente">
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mx-table-wrap">
                    <table className="mx-table harvest-prog-table">
                      <thead>
                        <tr>
                          <th className="harvest-prog-col-provider">Proveedor / Centro</th>
                          <th className="harvest-prog-col-volume">Volumen</th>
                          <th className="harvest-prog-col-period">Período</th>
                          <th className="harvest-prog-col-product">Producto</th>
                          <th className="harvest-prog-col-status">Estado</th>
                          <th className="harvest-prog-col-actions">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {programasPeriodo.map(p => {
                          const effectiveTpt = getEffectiveTonsPerTruck(p, tonsPerTruck);
                          const volume = getProgramVolumeProgress(p, effectiveTpt);
                          const isOverEstimated = volume.estimated > 0 && volume.balance < 0;
                          const hasDailyAdjustments = Array.isArray(p.ajustesDiarios) && p.ajustesDiarios.length > 0;
                          const camionesStatus = getProgramCamionesStatus(p);
                          const hastaKey = p.vigenciaHasta ? toChileDateKey(p.vigenciaHasta) : '';
                          const daysLeft = p.estado === 'activo' ? daysUntilKey(hastaKey) : null;
                          const totalTDia = calcTotalToneladasDia(p.transportes);
                          const showDaysAlert = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
                          return (
                            <tr key={p._id} className={`harvest-prog-row${p.estado === 'finalizado' ? ' is-finalizado' : ''}`}>
                              <td>
                                <div className="harvest-prog-name">{p.proveedorNombre || 'Proveedor Desconocido'}</div>
                                {(p.centroNombre || p.centroCodigo) && (
                                  <div className="harvest-prog-centro">{p.centroNombre || p.centroCodigo}</div>
                                )}
                                {(() => {
                                  const trato = tratosAcordados.find(t => String(t._id) === String(p.tratoId));
                                  const contacto = trato?.contactoNombre;
                                  return contacto ? <div className="harvest-prog-contact">{contacto}</div> : null;
                                })()}
                              </td>

                              <td className="harvest-prog-vol-cell">
                                <div className="harvest-prog-vol-main">{volume.estimated ? fmtTonsInt(volume.estimated) : '—'}</div>
                                <div className="harvest-prog-vol-sub">
                                  <span>{fmtTonsInt(volume.consumed)} plan.</span>
                                  <span className={isOverEstimated ? 'is-over' : ''}>{volume.estimated ? fmtTonsInt(Math.abs(volume.balance)) : '—'} {isOverEstimated ? 'sobre' : 'saldo'}</span>
                                </div>
                                {volume.estimated > 0 && (
                                  <div className="harvest-prog-vol-bar"><span style={{ width: `${volume.progress}%` }} /></div>
                                )}
                                {hasDailyAdjustments && <span className="harvest-prog-adj-chip">Ajustes</span>}
                              </td>

                              <td className="harvest-prog-period-cell">
                                <div className="harvest-prog-date-main">{fmtDateShort(p.vigenciaDesde)}</div>
                                {p.vigenciaHasta && (
                                  <div className="harvest-prog-date-sub">→ {fmtDateShort(p.vigenciaHasta)}</div>
                                )}
                                <div className="harvest-prog-date-label">Inicio · Término</div>
                                {showDaysAlert && (
                                  <div className="harvest-prog-days-alert">
                                    <AlertTriangle size={10} />
                                    {daysLeft === 0 ? 'Hoy' : `${daysLeft}d`}
                                  </div>
                                )}
                              </td>

                              <td className="harvest-prog-product-cell">
                                <span className={`prog-product-chip ${getProductClass(p.tipoProducto)}`}>
                                  {getProductChipLabel(p.tipoProducto)} <em>{getTipoProductoLabel(p.tipoProducto)}</em>
                                </span>
                                <div className="harvest-prog-ops">
                                  <span className="harvest-prog-cam">{camionesStatus.base} cam/día</span>
                                  {totalTDia > 0 && <span className="harvest-prog-cam" style={{ color: 'var(--color-text-subtle)' }}>{fmtNumber(totalTDia, 0)} t/día</span>}
                                  {camionesStatus.adjusted && (
                                    <span className="harvest-prog-cam-today">hoy {camionesStatus.today}</span>
                                  )}
                                </div>
                              </td>

                              <td>
                                <div className="harvest-prog-status-stack">
                                  <span className={`mx-badge mx-badge-${p.estado === 'activo' ? 'success' : p.estado === 'pausado' ? 'warning' : 'muted'}`}>
                                    {(p.estado || '—').toUpperCase()}
                                  </span>
                                  {p.estado === 'pausado' && p.pausadoDesde && (
                                    <span className="harvest-prog-status-note">desde {fmtDateShort(p.pausadoDesde)}</span>
                                  )}
                                  {p.seguimientos?.[0] && (() => {
                                    const seg = SEGUIMIENTO_LABELS[p.seguimientos[0].estado];
                                    if (!seg) return null;
                                    return <span className={`mx-badge mx-badge-${seg.cls}`} style={{ fontSize: '0.7rem' }}>{seg.label}</span>;
                                  })()}
                                  <span
                                    className={`harvest-prog-san-chip ${getSanitarioEstado(p.sanitario)}`}
                                    title={[p.sanitario?.areaPSMB, p.sanitario?.codigoArea ? `Area ${p.sanitario.codigoArea}` : ''].filter(Boolean).join(' - ')}
                                  >
                                    {isSanitarioRelevant(p.sanitario) && <AlertTriangle size={10} />}
                                    {getSanitarioLabel(p.sanitario)}
                                  </span>
                                </div>
                              </td>

                              <td className="harvest-prog-actions-cell">
                                <div className="biomasa-action-bar">
                                  {p.estado === 'activo' && (
                                    <button className="mx-action-btn pause" title="Pausar" onClick={() => { setPauseForm({ pausadoDesde: todayKey(), motivoPausa: '' }); setPauseModal({ id: p._id, proveedorNombre: p.proveedorNombre }); }}><Pause size={14} /></button>
                                  )}
                                  {p.estado === 'pausado' && (
                                    <button className="mx-action-btn play" title="Reanudar" onClick={() => handleStatusChange(p._id, 'activo')}><Play size={14} /></button>
                                  )}
                                  {p.estado === 'finalizado' && (
                                    <button className="mx-action-btn play" title="Reabrir programa" onClick={() => handleStatusChange(p._id, 'activo')}><RotateCcw size={14} /></button>
                                  )}
                                  {(p.estado === 'activo' || p.estado === 'pausado') && (
                                    <button className="mx-action-btn" title="Finalizar programa" style={{ color: 'var(--color-success)' }} onClick={() => handleOpenFinalizeModal(p)}><CheckCircle2 size={14} /></button>
                                  )}
                                  {p.estado !== 'finalizado' && (
                                    <button className="mx-action-btn edit" title="Editar" onClick={() => handleOpenModal(p)}><Edit size={14} /></button>
                                  )}
                                  <button className="mx-action-btn delete" title="Eliminar" onClick={() => setConfirmDelete(p)}><Trash size={14} /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {!programasPeriodo.length && (
                          <tr>
                            <td colSpan="6">
                              <div className="mx-state-placeholder">Sin programas para el periodo seleccionado.</div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {progSubTab === 'calendario' && (
                <div ref={calendarBoardRef} className={`harvest-calendar-shell ${calView === 'week' ? 'week-mode' : 'month-mode'} ${isCalendarBoard ? 'board-mode' : ''}`}>
                  <div className="mx-card harvest-calendar-main">
                    <div className="harvest-calendar-toolbar">
                      <div className="harvest-calendar-controls">
                        <div className="mx-toggle-group">
                          <button className={`mx-toggle-btn ${calView === 'month' ? 'active' : ''}`} onClick={() => setCalView('month')}>Vista Mes</button>
                          <button className={`mx-toggle-btn ${calView === 'week' ? 'active' : ''}`} onClick={() => setCalView('week')}>Vista Semana</button>
                        </div>
                        <div className="harvest-calendar-period">
                          <button className="mx-btn-icon sm" onClick={() => {
                            if (calView === 'month') {
                              setMes(prev => {
                                const [y, m] = prev.split('-');
                                const d = new Date(parseInt(y, 10), parseInt(m, 10) - 2, 1);
                                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                              });
                            } else {
                              setCurrentWeekOffset(o => o-1);
                            }
                          }}><ChevronLeft size={16} /></button>
                          {calView === 'week' && weekDays.length ? (
                            <div className="harvest-week-title-wrap">
                              <CalendarIcon size={14} className="harvest-week-title-icon" />
                              <div>
                                <div className="harvest-calendar-title">
                                  SEMANA {getISOWeek(weekDays[0])} · {new Date(weekDays[0] + 'T12:00:00Z').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase())}
                                </div>
                                <div className="harvest-week-subtitle">
                                  {new Date(weekDays[0] + 'T12:00:00Z').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })} — {new Date(weekDays[6] + 'T12:00:00Z').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="harvest-calendar-title">{mesLabel(mes, true)}</span>
                          )}
                          <button className="mx-btn-icon sm" onClick={() => {
                            if (calView === 'month') {
                              setMes(prev => {
                                const [y, m] = prev.split('-');
                                const d = new Date(parseInt(y, 10), parseInt(m, 10), 1);
                                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                              });
                            } else {
                              setCurrentWeekOffset(o => o+1);
                            }
                          }}><ChevronRight size={16} /></button>
                        </div>
                      </div>
                      <div className="harvest-calendar-actions">
                        <select className="mx-select sm" value={calendarMetric} onChange={e => setCalendarMetric(e.target.value)} style={{ fontSize: '13px', padding: '4px 8px' }}>
                          <option value="camiones">Camiones</option>
                          <option value="tons">Tons</option>
                          <option value="both">Cam + Tons</option>
                        </select>
                        {calView === 'week' && <button className="mx-btn mx-btn-outline sm" onClick={() => setCurrentWeekOffset(0)}>Hoy</button>}
                        <button className="mx-btn-icon sm" onClick={handleCalendarBoardToggle} title={isCalendarBoard ? 'Salir pantalla completa' : 'Pantalla completa'}>
                          {isCalendarBoard ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                      </div>
                    </div>

                    {calView === 'month' ? (
                      <>
                      <div className="cal-month-grid">
                        {['LUN','MAR','MIE','JUE','VIE','SAB','DOM'].map(d => (
                          <div key={d} className={`cal-header-day ${d === 'DOM' ? 'calendar-red-day' : ''}`}>{d}</div>
                        ))}
                        {Array.from({ length: monthData.padding }).map((_, i) => (
                          <div key={`pad-${i}`} className="cal-pad-day" />
                        ))}
                        {monthData.days.map((dayNum) => {
                          const dateKey = `${mes}-${String(dayNum).padStart(2, '0')}`;
                          const dayDataObj = calData[dateKey] || { total: 0, items: [] };
                          const dayItems = (dayDataObj.items || []).filter(it => filteredProgramIds.has(String(it.programaId))).map(enrichCalendarItem).filter(it => !filterProducto || it.tipoProducto === filterProducto);
                          const daySummary = summarizeHarvestItems(dayItems);
                          const isSelected = selectedDay?.key === dateKey;
                          const isToday = dateKey === todayKey();
                          const totalCam = daySummary.camiones;
                          const totalTons = daySummary.tons;
                          const hasSuspended = dayItems.some(it => it.cancelado || (it.esDiaEspecial && it.camiones === 0));
                          const primaryProduct = daySummary.products[0]?.key || 'sin_definir';

                          return (
                            <div
                              key={dayNum}
                              onClick={() => setSelectedDay(prev => prev?.key === dateKey ? null : { key: dateKey, items: dayItems, total: totalCam, summary: daySummary })}
                              className={`cal-day-cell ${calendarDayToneClass(dateKey)} ${isSelected ? 'selected' : ''} ${isToday ? 'is-today' : ''} ${totalCam > 0 ? `has-data ${getProductClass(primaryProduct)}` : ''}`}
                            >
                              <div className="cal-month-cell-top">
                                <span className="cal-day-num">{dayNum}</span>
                              </div>
                              {totalCam > 0 ? (
                                <div className="cal-month-body">
                                  <div className="cal-month-camrow">
                                    <strong className="cal-month-main">
                                      {calendarMetric === 'tons' ? fmtTonsInt(totalTons) : totalCam}
                                    </strong>
                                    {calendarMetric !== 'tons' && <span className="cal-month-label">cam</span>}
                                  </div>
                                  {calendarMetric === 'both' && totalTons > 0 && (
                                    <div className="cal-month-tons">{fmtTonsInt(totalTons)}</div>
                                  )}
                                  <div className="cal-month-products-list">
                                    {(daySummary.products.some(p => p.key !== 'sin_definir')
                                      ? daySummary.products.filter(p => p.key !== 'sin_definir')
                                      : daySummary.products
                                    ).map(prod => (
                                      <span key={prod.key} className={`cal-chip ${getProductClass(prod.key)}`}>
                                        {getProductChipLabel(prod.key)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : hasSuspended ? (
                                <div className="cal-month-susp">Susp.</div>
                              ) : (
                                <div className="cal-day-empty">—</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="cal-month-legend">
                        <span className="cal-legend-item"><span className="cal-chip product-entero">E</span> Entero</span>
                        <span className="cal-legend-item"><span className="cal-chip product-carne">C</span> Carne</span>
                        <span className="cal-legend-item"><span className="cal-chip product-mc">MC</span> Media Concha</span>
                        <span className="cal-legend-item"><span className="cal-chip product-sin_definir">SD</span> Sin definir</span>
                        <span className="cal-legend-item cal-legend-dash">— Sin actividad</span>
                      </div>
                      </>
                    ) : (
                      <div className="harvest-week-v2">
                        <div className="harvest-week-v2-head">
                          <div className="harvest-week-v2-label" />
                          {weekDays.map(d => {
                            const isToday = d === todayKey();
                            return (
                              <div key={d} className={`harvest-week-v2-daycol ${calendarDayToneClass(d)} ${isToday ? 'is-today' : ''}`}>
                                <div className="harvest-week-v2-dayname">{new Date(d + 'T12:00:00Z').toLocaleDateString('es-CL', { weekday: 'short' }).toUpperCase()}</div>
                                <div className="harvest-week-v2-daynum">{d.split('-')[2]}</div>
                              </div>
                            );
                          })}
                          <div className="harvest-week-v2-daycol harvest-week-v2-semcol">
                            <div className="harvest-week-v2-dayname">SEM</div>
                            <div className="harvest-week-v2-daynum">Σ</div>
                          </div>
                        </div>

                        {Object.entries(weekData).filter(([, data]) => !filterProducto || data.tipoProducto === filterProducto).map(([id, data]) => {
                          const programa = programasById.get(id);
                          const rowTotal = data.dias.reduce((s, c) => ({ camiones: s.camiones + Number(c.camiones || 0), tons: s.tons + Number(c.tonsDia || 0) }), { camiones: 0, tons: 0 });
                          return (
                            <div key={id} className="harvest-week-v2-row">
                              <div className={`harvest-week-v2-prov ${getProductClass(data.tipoProducto)} ${programa?.estado === 'pausado' ? 'is-pausado' : ''}`}>
                                <div className="harvest-week-v2-prov-name">{data.nombre}</div>
                                <span className="wk-prov-tooltip">{data.nombre}</span>
                                <div className="harvest-week-v2-prov-centro">{data.centro || '—'}</div>
                                {programa?.estado === 'pausado' ? (
                                  <div className="wk-prov-pausa-info">
                                    <span className="wk-prov-pausa-badge">PAUSADO</span>
                                    {programa.pausadoDesde && <span className="wk-prov-pausa-desde">desde {new Date(programa.pausadoDesde).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', timeZone: 'America/Santiago' })}</span>}
                                    <button className="wk-btn wk-btn-react" onClick={() => handleStatusChange(programa._id, 'activo')}>↺ Reactivar</button>
                                  </div>
                                ) : programa?.estado === 'finalizado' ? (
                                  <div className="wk-prov-pausa-info">
                                    <span className="wk-prov-pausa-badge" style={{ background: 'var(--color-muted-bg, #f0f0f0)', color: 'var(--color-text-muted)' }}>FINALIZADO</span>
                                    {programa.vigenciaHasta && <span className="wk-prov-pausa-desde">hasta {new Date(programa.vigenciaHasta).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', timeZone: 'America/Santiago' })}</span>}
                                  </div>
                                ) : (
                                  <span className={`wk-product-chip ${getProductClass(data.tipoProducto)}`}>{getTipoProductoLabel(data.tipoProducto)}</span>
                                )}
                              </div>
                              {data.dias.map((cell, i) => {
                                const dia = weekDays[i];
                                const pausaKey = programa?.estado === 'pausado' && programa?.pausadoDesde ? programa.pausadoDesde.slice(0, 10) : null;
                                const vigHastaKey = programa?.estado === 'finalizado' && programa?.vigenciaHasta ? programa.vigenciaHasta.slice(0, 10) : null;
                                const isPausedFuture = pausaKey !== null && dia >= pausaKey;
                                const isFinishedFuture = vigHastaKey !== null && dia > vigHastaKey;
                                const isReadOnly = programa?.estado === 'finalizado' || programa?.estado === 'pausado';
                                const isSusp = cell.esDiaEspecial && cell.camiones === 0;
                                const isToday = dia === todayKey();
                                return (
                                  <div key={i} className={`harvest-week-v2-cell ${isToday ? 'is-today' : ''} ${isSusp ? 'is-susp' : ''} ${isPausedFuture || isFinishedFuture ? 'is-prog-pausado' : ''}`}>
                                    {isPausedFuture ? (
                                      <span className="wk-estado-label pausado">Pausado</span>
                                    ) : isFinishedFuture ? (
                                      <span className="wk-estado-label finalizado">Finalizado</span>
                                    ) : isSusp ? (
                                      <>
                                        <div className="harvest-week-v2-susp">{cell.ajusteMotivo || 'Suspendido'}</div>
                                        {programa && (
                                          <button className="wk-btn wk-btn-react" onClick={() => handleReactivateDay(programa, dia)}>↺ Reactivar</button>
                                        )}
                                      </>
                                    ) : cell.camiones > 0 || programa ? (
                                      <>
                                        {cell.camiones > 0 ? (
                                          <div className="harvest-week-v2-count">
                                            {calendarMetric === 'tons' ? (
                                              <strong>{fmtTonsInt(cell.tonsDia)}</strong>
                                            ) : calendarMetric === 'both' ? (
                                              <><strong>{cell.camiones}</strong><span>CAM</span>{cell.tonsDia > 0 && <span className="wk-tons-sub">{fmtTonsInt(cell.tonsDia)}</span>}</>
                                            ) : (
                                              <strong>{cell.camiones}</strong>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="harvest-week-v2-empty">—</span>
                                        )}
                                        {cell.esDiaEspecial && cell.camiones > 0 && <div className="harvest-week-v2-adj">★ {cell.ajusteMotivo || 'Ajuste'}</div>}
                                        {programa && !isReadOnly && (
                                          <div className="harvest-week-v2-actions">
                                            <button className="wk-btn" onClick={() => handleQuickAdjust(programa, dia, -1, cell.camiones)}>
                                              <span>−</span>
                                              <span className="wk-btn-tip">Quitar 1 camión</span>
                                            </button>
                                            <button className="wk-btn wk-btn-add" onClick={() => handleQuickAdjust(programa, dia, +1, cell.camiones)}>
                                              <span>+</span>
                                              <span className="wk-btn-tip">Sumar 1 camión</span>
                                            </button>
                                            <button className="wk-btn wk-btn-susp" onClick={e => {
                                              const r = e.currentTarget.getBoundingClientRect();
                                              setSuspendPopover({ programa, fecha: dia, x: r.left, y: r.bottom + 6, motivo: 'Clima', nota: '' });
                                            }}>
                                              <span>⊘</span>
                                              <span className="wk-btn-tip">Suspender este día</span>
                                            </button>
                                          </div>
                                        )}
                                      </>
                                    ) : <span className="harvest-week-v2-empty">—</span>}
                                  </div>
                                );
                              })}
                              <div className="harvest-week-v2-cell harvest-week-v2-total">
                                {calendarMetric === 'tons' ? fmtTonsInt(rowTotal.tons) : calendarMetric === 'both' ? <>{rowTotal.camiones} <span style={{fontSize:'0.75em'}}>cam</span>{rowTotal.tons > 0 && <span className="wk-tons-sub">{fmtTonsInt(rowTotal.tons)}</span>}</> : rowTotal.camiones}
                              </div>
                            </div>
                          );
                        })}

                        <div className="harvest-week-v2-row harvest-week-v2-footer">
                          <div className="harvest-week-v2-label">Total día</div>
                          {weekDays.map(d => {
                            const s = weekSummaries.daily[d] || { camiones: 0, tons: 0 };
                            return (
                              <div key={d} className={`harvest-week-v2-cell ${calendarDayToneClass(d)}`}>
                                <strong>{calendarMetric === 'tons' ? fmtTonsInt(s.tons) : calendarMetric === 'both' ? <>{s.camiones} cam{s.tons > 0 && <span className="wk-tons-sub">{fmtTonsInt(s.tons)}</span>}</> : s.camiones}</strong>
                              </div>
                            );
                          })}
                          <div className="harvest-week-v2-cell harvest-week-v2-total">
                            <strong>{calendarMetric === 'tons' ? fmtTonsInt(weekSummaries.total.tons) : calendarMetric === 'both' ? <>{weekSummaries.total.camiones} cam{weekSummaries.total.tons > 0 && <span className="wk-tons-sub">{fmtTonsInt(weekSummaries.total.tons)}</span>}</> : weekSummaries.total.camiones}</strong>
                          </div>
                        </div>

                        <div className="harvest-week-v2-row harvest-week-v2-notas">
                          <div className="harvest-week-v2-label wk-nota-label">Nota del día</div>
                          {weekDays.map(d => {
                            const nota = notasDia?.[d];
                            return (
                              <div key={d} className={`harvest-week-v2-cell wk-nota-cell ${calendarDayToneClass(d)}`}>
                                {nota ? (
                                  <div className="wk-nota-content">
                                    <span className="wk-nota-text" title={nota.nota}>{nota.nota}</span>
                                    <button className="wk-nota-btn" title="Editar nota" onClick={e => {
                                      const r = e.currentTarget.getBoundingClientRect();
                                      setNotaPopover({ fechaKey: d, nota: nota.nota, x: Math.min(r.left, window.innerWidth - 290), y: r.bottom + 6 });
                                    }}>✏</button>
                                  </div>
                                ) : (
                                  <button className="wk-nota-add" title="Agregar nota del día" onClick={e => {
                                    const r = e.currentTarget.getBoundingClientRect();
                                    setNotaPopover({ fechaKey: d, nota: '', x: Math.min(r.left, window.innerWidth - 290), y: r.bottom + 6 });
                                  }}>＋</button>
                                )}
                              </div>
                            );
                          })}
                          <div className="harvest-week-v2-cell" />
                        </div>
                      </div>
                    )}
                  </div>

                  {(calView === 'month' || calView === 'week') && (
                    <aside className="hds-panel">
                      {selectedDay ? (
                        <>
                          <div className="hds-detail-header">
                            <div>
                              <div className="hds-detail-date">
                                {new Date(selectedDay.key + 'T12:00:00Z').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
                              </div>
                            </div>
                            <button className="hds-back-btn" onClick={() => setSelectedDay(null)}>
                              <ChevronLeft size={14} /> Mes
                            </button>
                          </div>
                          <div className="cal-detail-wrap">
                            {selectedDay.items.length === 0 ? (
                              <div className="cal-detail-empty">
                                <Activity size={28} style={{ opacity: 0.25 }} />
                                <p>Sin cosechas este día</p>
                              </div>
                            ) : (
                              selectedDay.items.map((it, idx) => (
                                <div key={idx} className={`cal-detail-card ${getProductClass(it.tipoProducto)}${it.estado === 'finalizado' ? ' is-finalizado' : ''}`}>
                                  <div className="cal-detail-card-top">
                                    <div className="cal-detail-card-info">
                                      <div className="cal-detail-card-name">{it.proveedorNombre}</div>
                                      <div className="cal-detail-card-center">{it.centroNombre || it.centroCodigo || 'Sin centro'}</div>
                                    </div>
                                    <div className="cal-detail-card-count">
                                      <strong>{it.camiones}</strong>
                                      <span>cam</span>
                                    </div>
                                  </div>
                                  <div className="cal-detail-card-badges">
                                    <span className={`mx-badge ${getProductClass(it.tipoProducto)}`}>{getTipoProductoLabel(it.tipoProducto)}</span>
                                    {it.estado === 'finalizado' && <span className="mx-badge mx-badge-muted">Finalizado</span>}
                                    {isSanitarioRelevant(it.sanitario) && (
                                      <span className={`mx-badge harvest-sanitary-badge ${getSanitarioEstado(it.sanitario)}`}>
                                        <AlertTriangle size={10} /> {getSanitarioLabel(it.sanitario)}
                                      </span>
                                    )}
                                  </div>
                                  {it.esDiaEspecial && (
                                    <div className="cal-detail-card-note">
                                      ✱ {it.ajusteMotivo || 'Ajuste diario'}{it.motivo ? `: ${it.motivo}` : ''}
                                    </div>
                                  )}
                                  {it.estado !== 'finalizado' && (
                                    <button
                                      type="button"
                                      className="mx-btn mx-btn-outline sm"
                                      style={{ marginTop: 10, width: '100%' }}
                                      onClick={() => handleOpenAdjustModal(programasById.get(String(it.programaId)), selectedDay.key, it.camiones)}
                                    >
                                      Ajustar día
                                    </button>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      ) : calView === 'week' ? (
                        <div className="hds-body">
                          <div className="hds-header">
                            <div className="hds-header-icon"><Activity size={16} /></div>
                            <span className="hds-header-title">RESUMEN DE LA SEMANA</span>
                          </div>
                          <div className="hds-kpi-hero">
                            <span className="hds-kpi-big">{fmtNumber(weekSummaryFull.total.tons, 0)}</span>
                            <span className="hds-kpi-unit">t</span>
                            <span className="hds-kpi-sub">{weekSummaryFull.total.camiones} camiones · {weekSummaryFull.providers.length} proveedores</span>
                          </div>
                          <div className="hds-kpi-row">
                            <div className="hds-kpi-card"><strong>{fmtNumber(weekSummaryFull.promedioDiario, 0)} t</strong><span>Promedio diario</span></div>
                            <div className="hds-kpi-card"><strong>{weekSummaryFull.total.camiones}</strong><span>Camiones totales</span></div>
                            <div className="hds-kpi-card">
                              <strong>{fmtNumber(weekSummaryFull.maximoDia, 0)} t</strong>
                              <span>Máximo día{weekSummaryFull.maximoDiaKey ? ` (${new Date(weekSummaryFull.maximoDiaKey + 'T12:00:00Z').toLocaleDateString('es-CL', { weekday: 'short' }).toUpperCase()})` : ''}</span>
                            </div>
                          </div>
                          <section className="hds-section">
                            <div className="hds-section-head">
                              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                DISTRIBUCIÓN POR PROVEEDOR
                                <Info size={12} style={{ opacity: 0.45, flexShrink: 0, cursor: 'default' }} title="Participación del proveedor sobre el total planificado del período. No corresponde a consumo real ni avance del programa." />
                              </span>
                              {filterProveedor && (
                                <button className="hds-link-btn hds-filter-clear" onClick={() => setFilterProveedor(null)}>× Limpiar</button>
                              )}
                            </div>
                            {allWeekProviders.length === 0 ? (
                              <p className="hds-empty">Sin cosechas esta semana.</p>
                            ) : (
                              allWeekProviders.map(provider => {
                                const totalT = allWeekProviders.reduce((s, p) => s + p.tons, 0);
                                const pct = totalT > 0 ? Math.round(provider.tons / totalT * 100) : 0;
                                const isActive = filterProveedor === provider.nombre;
                                return (
                                  <div
                                    key={provider.nombre}
                                    className={`hds-provider-row hds-provider-clickable ${isActive ? 'is-filter-active' : ''}`}
                                    onClick={() => setFilterProveedor(v => v === provider.nombre ? null : provider.nombre)}
                                    title={isActive ? 'Click para mostrar todos' : 'Click para filtrar por este proveedor'}
                                  >
                                    <div className="hds-provider-top">
                                      <span className="hds-provider-name">{provider.nombre}</span>
                                      <strong className="hds-provider-val">{fmtNumber(provider.tons, 0)} t · {pct}%</strong>
                                    </div>
                                    <div className="hds-provider-bar">
                                      <div className="hds-provider-bar-fill" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </section>
                          <section className="hds-section">
                            <div className="hds-section-head">
                              <span>MIX DE PRODUCTOS</span>
                              {filterProducto && (
                                <button className="hds-link-btn hds-filter-clear" onClick={() => setFilterProducto(null)}>× Limpiar</button>
                              )}
                            </div>
                            {allWeekProducts.products.length === 0 ? (
                              <p className="hds-empty">Sin productos definidos.</p>
                            ) : (
                              <div className="hds-donut-area">
                                <DonutChart products={allWeekProducts.products} totalTons={allWeekProducts.total} activeKey={filterProducto} />
                                <div className="hds-donut-legend">
                                  {allWeekProducts.products.map(p => {
                                    const pct = allWeekProducts.total > 0 ? Math.round(p.tons / allWeekProducts.total * 100) : 0;
                                    const isActive = filterProducto === p.key;
                                    const isDimmed = filterProducto && !isActive;
                                    return (
                                      <div
                                        key={p.key}
                                        role="button"
                                        tabIndex={0}
                                        aria-pressed={isActive}
                                        className={`hds-legend-row hds-legend-row--filter ${isActive ? 'is-active' : ''} ${isDimmed ? 'is-dimmed' : ''}`}
                                        onClick={() => setFilterProducto(v => v === p.key ? null : p.key)}
                                        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setFilterProducto(v => v === p.key ? null : p.key)}
                                        title={isActive ? `Quitar filtro ${getTipoProductoLabel(p.key)}` : `Filtrar calendario por ${getTipoProductoLabel(p.key)}`}
                                      >
                                        <span className={`hds-legend-dot ${getProductClass(p.key)}`} />
                                        <span className="hds-legend-label">{getTipoProductoLabel(p.key)}</span>
                                        <span className="hds-legend-pct">{pct}% <em>({fmtNumber(p.tons, 0)} t)</em></span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </section>
                          <section className="hds-section">
                            <div className="hds-section-head"><span>ALERTAS</span></div>
                            {weekSummaryFull.sanitaryOk.map((alert, i) => (
                              <div key={`ok-${i}`} className="hds-alert-chip verde">
                                <span className="hds-alert-dot" /> OK{alert?.areaPSMB ? ` - ${alert.areaPSMB}` : ''}{alert?.codigoArea ? ` - ${alert.codigoArea}` : ''}
                              </div>
                            ))}
                            {weekSummaryFull.sanitaryAlerts.map((alert, i) => (
                              <div key={`a-${i}`} className={`hds-alert-chip ${getSanitarioEstado(alert)}`}>
                                <AlertTriangle size={12} /> {getSanitarioLabel(alert)}{alert?.areaPSMB ? ` - ${alert.areaPSMB}` : ''}
                              </div>
                            ))}
                            {weekSummaryFull.sanitaryAlerts.length === 0 && weekSummaryFull.sanitaryOk.length === 0 && (
                              <div className="hds-alert-chip gris"><span className="hds-alert-dot gris" /> Sin información sanitaria</div>
                            )}
                            {weekSummaryFull.sanitaryAlerts.length === 0 && weekSummaryFull.sanitaryOk.length > 0 && (
                              <div className="hds-alert-info">Sin alertas críticas</div>
                            )}
                          </section>
                        </div>
                      ) : (
                        <div className="hds-body">

                          {/* Header */}
                          <div className="hds-header">
                            <div className="hds-header-icon">
                              <Activity size={16} />
                            </div>
                            <span className="hds-header-title">RESUMEN DEL MES</span>
                          </div>

                          {/* KPI Hero */}
                          <div className="hds-kpi-hero">
                            <div className="hds-kpi-hero-main">
                              <span className="hds-kpi-big">
                                {calendarMetric === 'camiones'
                                  ? monthSummary.total.camiones
                                  : fmtNumber(monthSummary.total.tons, 0)}
                              </span>
                              <span className="hds-kpi-unit">
                                {calendarMetric === 'camiones' ? 'cam' : 't'}
                              </span>
                            </div>
                            <span className="hds-kpi-sub">{monthSummary.total.days} días con cosecha</span>
                          </div>

                          {/* Sub KPIs */}
                          <div className="hds-kpi-row">
                            <div className="hds-kpi-card">
                              <strong>{fmtNumber(monthSummary.promedioDiario, 0)} t</strong>
                              <span>Promedio diario</span>
                            </div>
                            <div className="hds-kpi-card">
                              <strong>{monthSummary.total.days}</strong>
                              <span>Días activos</span>
                            </div>
                            <div className="hds-kpi-card">
                              <strong>{fmtNumber(monthSummary.maximoDia, 0)} t</strong>
                              <span>Máximo día</span>
                            </div>
                          </div>

                          {/* Providers */}
                          <section className="hds-section">
                            <div className="hds-section-head">
                              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                DISTRIBUCIÓN POR PROVEEDOR
                                <Info size={12} style={{ opacity: 0.45, flexShrink: 0, cursor: 'default' }} title="Participación del proveedor sobre el total planificado del período. No corresponde a consumo real ni avance del programa." />
                              </span>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                {filterProveedor && (
                                  <button className="hds-link-btn hds-filter-clear" onClick={() => setFilterProveedor(null)}>× Limpiar</button>
                                )}
                                {!filterProveedor && allMonthProviders.length > 2 && (
                                  <button className="hds-link-btn" onClick={() => setShowAllProviders(v => !v)}>
                                    {showAllProviders ? 'Ver menos' : 'Ver todos'}
                                  </button>
                                )}
                              </div>
                            </div>
                            {allMonthProviders.length === 0 ? (
                              <p className="hds-empty">Sin cosechas en el mes.</p>
                            ) : (
                              (showAllProviders || filterProveedor ? allMonthProviders : allMonthProviders.slice(0, 2)).map((provider) => {
                                const totalAllTons = allMonthProviders.reduce((s, p) => s + p.tons, 0);
                                const pct = totalAllTons > 0 ? Math.round(provider.tons / totalAllTons * 100) : 0;
                                const isActive = filterProveedor === provider.nombre;
                                return (
                                  <div
                                    key={provider.nombre}
                                    className={`hds-provider-row hds-provider-clickable ${isActive ? 'is-filter-active' : ''}`}
                                    onClick={() => setFilterProveedor(v => v === provider.nombre ? null : provider.nombre)}
                                    title={isActive ? 'Click para mostrar todos' : 'Click para filtrar por este proveedor'}
                                  >
                                    <div className="hds-provider-top">
                                      <span className="hds-provider-name">{provider.nombre}</span>
                                      <strong className="hds-provider-val">
                                        {calendarMetric === 'camiones'
                                          ? `${provider.camiones} cam · ${pct}%`
                                          : `${fmtNumber(provider.tons, 0)} t · ${pct}%`}
                                      </strong>
                                    </div>
                                    <div className="hds-provider-bar">
                                      <div className="hds-provider-bar-fill" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </section>

                          {/* Product Mix */}
                          <section className="hds-section">
                            <div className="hds-section-head">
                              <span>MIX DE PRODUCTOS</span>
                              {filterProducto && (
                                <button className="hds-link-btn hds-filter-clear" onClick={() => setFilterProducto(null)}>× Limpiar</button>
                              )}
                            </div>
                            {allMonthProducts.products.length === 0 ? (
                              <p className="hds-empty">Sin productos definidos.</p>
                            ) : (
                              <div className="hds-donut-area">
                                <DonutChart products={allMonthProducts.products} totalTons={allMonthProducts.total} activeKey={filterProducto} />
                                <div className="hds-donut-legend">
                                  {allMonthProducts.products.map((p) => {
                                    const pct = allMonthProducts.total > 0
                                      ? Math.round(p.tons / allMonthProducts.total * 100)
                                      : 0;
                                    const isActive = filterProducto === p.key;
                                    const isDimmed = filterProducto && !isActive;
                                    return (
                                      <div
                                        key={p.key}
                                        role="button"
                                        tabIndex={0}
                                        aria-pressed={isActive}
                                        className={`hds-legend-row hds-legend-row--filter ${isActive ? 'is-active' : ''} ${isDimmed ? 'is-dimmed' : ''}`}
                                        onClick={() => setFilterProducto(v => v === p.key ? null : p.key)}
                                        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setFilterProducto(v => v === p.key ? null : p.key)}
                                        title={isActive ? `Quitar filtro ${getTipoProductoLabel(p.key)}` : `Filtrar calendario por ${getTipoProductoLabel(p.key)}`}
                                      >
                                        <span className={`hds-legend-dot ${getProductClass(p.key)}`} />
                                        <span className="hds-legend-label">{getTipoProductoLabel(p.key)}</span>
                                        <span className="hds-legend-pct">
                                          {pct}% <em>({fmtNumber(p.tons, 0)} t)</em>
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </section>

                          {/* Sanitario */}
                          <section className="hds-section">
                            <div className="hds-section-head"><span>ALERTAS SANITARIAS</span></div>
                            {monthSummary.sanitaryOk.map((alert, i) => (
                              <div key={`ok-${i}`} className="hds-alert-chip verde">
                                <span className="hds-alert-dot" />
                                OK{alert?.areaPSMB ? ` - ${alert.areaPSMB}` : ''}
                                {alert?.codigoArea ? ` - ${alert.codigoArea}` : ''}
                                {alert?.ultimoAnalisisMrsat ? ` - ${alert.ultimoAnalisisMrsat}` : ''}
                              </div>
                            ))}
                            {monthSummary.sanitaryAlerts.map((alert, i) => (
                              <div key={`alert-${i}`} className={`hds-alert-chip ${getSanitarioEstado(alert)}`}>
                                <AlertTriangle size={12} />
                                {getSanitarioLabel(alert)}
                                {alert?.areaPSMB ? ` - ${alert.areaPSMB}` : ''}
                                {alert?.codigoArea ? ` - ${alert.codigoArea}` : ''}
                              </div>
                            ))}
                            {monthSummary.sanitaryAlerts.length === 0 && monthSummary.sanitaryOk.length === 0 && (
                              <div className="hds-alert-chip gris">
                                <span className="hds-alert-dot gris" /> Sin información sanitaria
                              </div>
                            )}
                            {monthSummary.sanitaryAlerts.length === 0 && monthSummary.sanitaryOk.length > 0 && (
                              <div className="hds-alert-info">
                                Sin alertas críticas
                              </div>
                            )}
                          </section>

                          <div className="hds-hint">
                            Selecciona un día del calendario para ver el desglose operativo diario.
                          </div>
                        </div>
                      )}
                    </aside>
                  )}
                </div>
              )}

              {progSubTab === 'seguimiento' && (
                <div className="harvest-followup-layout">
                  <div className="harvest-followup-toolbar">
                    <div className="harvest-followup-controls">
                      <div className="mx-toggle-group">
                        <button className={`mx-toggle-btn ${followupPeriod === 'month' ? 'active' : ''}`} onClick={() => setFollowupPeriod('month')}>Vista Mes</button>
                        <button className={`mx-toggle-btn ${followupPeriod === 'week' ? 'active' : ''}`} onClick={() => setFollowupPeriod('week')}>Vista Semana</button>
                      </div>
                      <div className="harvest-followup-period">
                        <button className="mx-btn-icon sm" onClick={() => moveFollowupPeriod(-1)} aria-label="Periodo anterior">
                          <ChevronLeft size={16} />
                        </button>
                        <span>
                          {followupPeriod === 'week'
                            ? `Semana ${new Date(weekDays[0] + 'T12:00:00Z').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', timeZone: 'America/Santiago' })}`
                            : mesLabel(mes, true)}
                        </span>
                        <button className="mx-btn-icon sm" onClick={() => moveFollowupPeriod(1)} aria-label="Periodo siguiente">
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <section className="harvest-followup-kpis">
                    <div>
                      <span>Programas activos</span>
                      <strong>{followupSummary.activePrograms}</strong>
                    </div>
                    <div>
                      <span>Ajustes periodo</span>
                      <strong>{followupSummary.adjustments}</strong>
                    </div>
                    <div>
                      <span>Delta camiones</span>
                      <strong className={followupSummary.netDelta < 0 ? 'negative' : followupSummary.netDelta > 0 ? 'positive' : ''}>
                        {followupSummary.netDelta > 0 ? '+' : ''}{followupSummary.netDelta}
                      </strong>
                    </div>
                    <div>
                      <span>Camiones hoy</span>
                      <strong>{followupSummary.todayCamiones}</strong>
                    </div>
                  </section>
                  <section className="mx-card harvest-followup-panel">
                    <header className="mx-card-header">
                      <div>
                        <h4 className="mx-card-title">Mesa de ajustes diarios</h4>
                        <p className="mx-card-description">Cambia solo el dia operativo sin modificar todo el programa.</p>
                      </div>
                    </header>
                    <div className="mx-table-wrap harvest-followup-table-wrap">
                      <table className="mx-table harvest-followup-table">
                        <thead>
                          <tr>
                            <th>Proveedor / Centro</th>
                            <th>Producto</th>
                            <th style={{ textAlign: 'center' }}>Base</th>
                            <th style={{ textAlign: 'center' }}>Hoy</th>
                            <th>Ultima novedad</th>
                            <th style={{ textAlign: 'right' }}>Accion</th>
                          </tr>
                        </thead>
                        <tbody>
                          {followupPrograms.map(p => (
                            <tr key={`adj-${p._id}`}>
                              <td>
                                <div className="biomasa-prov-cell">
                                  <div className="biomasa-avatar">
                                    {p.proveedorNombre.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="biomasa-prov-name">{p.proveedorNombre}</div>
                                    <div className="biomasa-centro-name">{p.centroNombre || 'Sin centro definido'}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className={`harvest-product-pill ${getProductClass(p.tipoProducto)}`}>
                                  {getTipoProductoLabel(p.tipoProducto)}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="harvest-followup-number">{p.camionesDefault || 0} cam</span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="harvest-followup-number today">{getTodayProgramCamiones(p)} cam</span>
                              </td>
                              <td>
                                <div className="harvest-followup-novelty">
                                  {getLatestProgramNovelty(p)}
                                </div>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div className="harvest-followup-actions">
                                  <button className="mx-btn mx-btn-primary sm" onClick={() => handleOpenAdjustModal(p)}>
                                    <Plus size={14} /> Ajustar
                                  </button>
                                  <button className="mx-btn mx-btn-outline sm" onClick={() => { setSegProg(p); setShowSegModal(true); }}>
                                    Nota
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {!followupPrograms.length && (
                            <tr>
                              <td colSpan="6" className="harvest-program-empty">
                                Sin programas activos para el periodo seleccionado.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="mx-card harvest-followup-panel">
                    <header className="mx-card-header">
                      <div>
                        <h4 className="mx-card-title">Bitacora reciente</h4>
                        <p className="mx-card-description">Ultimos cambios diarios registrados.</p>
                      </div>
                    </header>
                    <div className="harvest-adjustment-history">
                      {recentDailyAdjustments.length ? recentDailyAdjustments.map((ajuste) => (
                        <div key={ajuste._id || `${ajuste.programaId}-${ajuste.fecha}`} className="harvest-adjustment-item">
                          <div>
                            <strong>{ajuste.proveedorNombre}</strong>
                            <span>{new Date(ajuste.fecha).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })} - {ADJUST_ACTION_LABELS[ajuste.accion] || 'Ajuste diario'}</span>
                            <small>{ajuste.motivo || 'Sin motivo'}{ajuste.nota ? ` - ${ajuste.nota}` : ''}</small>
                          </div>
                          <b className={Number(ajuste.camionesDelta || 0) < 0 ? 'negative' : Number(ajuste.camionesDelta || 0) > 0 ? 'positive' : ''}>
                            {ajuste.camionesAntes} -&gt; {ajuste.camionesDespues} cam
                          </b>
                        </div>
                      )) : (
                        <div className="harvest-month-empty">Sin ajustes diarios registrados.</div>
                      )}
                    </div>
                  </section>

                </div>
              )}
            </div>
          )}
          {isMuestreosView && (
            <Suspense
              fallback={
                <div className="mx-loading-placeholder">
                  <div className="mx-spinner"></div>
                  <p>Cargando muestreos...</p>
                </div>
              }
            >
              <Muestreos />
            </Suspense>
          )}
        </div>
      </div>

      {showAdjustModal && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '560px' }}>
            <div className="mx-modal-header">
              <h2>Ajuste diario de cosecha</h2>
              <button className="mx-btn-icon" onClick={() => setShowAdjustModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAdjustSave} className="mx-form">
              <div className="mx-modal-body">
                <div className="harvest-adjust-context">
                  <strong>{adjustProgram?.proveedorNombre}</strong>
                  <span>
                    {adjustProgram?.centroNombre || 'Sin centro definido'} — base {adjustProgram?.camionesDefault || 0} cam/día
                    {adjustMaxCamiones != null && ` · acordado: ${adjustMaxCamiones} cam/día`}
                  </span>
                </div>
                <div className="mx-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="mx-form-group">
                    <label className="mx-label">Fecha</label>
                    <input
                      type="date"
                      className="mx-input"
                      value={adjustForm.fecha}
                      onChange={e => setAdjustForm({ ...adjustForm, fecha: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mx-form-group">
                    <label className="mx-label">Accion</label>
                    <select
                      className="mx-select"
                      value={adjustForm.accion}
                      onChange={e => setAdjustForm({ ...adjustForm, accion: e.target.value })}
                    >
                      <option value="set_total">Cambiar total del dia</option>
                      <option value="sumar">Sumar camion</option>
                      <option value="suspender">Suspender camion</option>
                      <option value="suspender_dia">Suspender dia completo</option>
                    </select>
                  </div>
                  {adjustForm.accion !== 'suspender_dia' && (
                    <div className="mx-form-group">
                      <label className="mx-label">{adjustForm.accion === 'set_total' ? 'Total camiones del dia' : 'Camiones'}</label>
                      <input
                        type="number"
                        className="mx-input"
                        min="0"
                        value={adjustForm.camiones}
                        onChange={e => setAdjustForm({ ...adjustForm, camiones: e.target.value })}
                        required
                      />
                    </div>
                  )}
                  <div className="mx-form-group">
                    <label className="mx-label">Motivo</label>
                    <select
                      className="mx-select"
                      value={adjustForm.motivo}
                      onChange={e => setAdjustForm({ ...adjustForm, motivo: e.target.value })}
                    >
                      {ADJUST_MOTIVOS.map((motivo) => (
                        <option key={motivo} value={motivo}>{motivo}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mx-form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="mx-label">Nota operacional</label>
                    <textarea
                      className="mx-textarea"
                      value={adjustForm.nota}
                      onChange={e => setAdjustForm({ ...adjustForm, nota: e.target.value })}
                      placeholder="Ej: Se suspendio un camion por falta de ventana en planta."
                      rows="3"
                    />
                  </div>
                </div>
              </div>
              <div className="mx-modal-footer">
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setShowAdjustModal(false)}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary">
                  <CheckCircle2 size={18} /> Guardar ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SEGUIMIENTO / NOVEDAD (Stage 3 Refactor) */}
      {showSegModal && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '500px' }}>
            <div className="mx-modal-header">
              <h2>Registrar Novedad</h2>
              <button className="mx-btn-icon" onClick={() => setShowSegModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSegSave} className="mx-form">
              <div className="mx-modal-body">
                <div className="mx-form-group">
                  <label className="mx-label">Estado de Cosecha</label>
                  <select 
                    className="mx-select" 
                    value={segEstado} 
                    onChange={e => setSegEstado(e.target.value)} 
                    required
                  >
                    <option value="">Seleccionar</option>
                    <option value="en_plan">En plan</option>
                    <option value="con_retrasos">Con retrasos</option>
                    <option value="detenido">Detenido</option>
                  </select>
                </div>
                <div className="mx-form-group">
                  <label className="mx-label">Nota / Observación de Cosecha</label>
                  <textarea 
                    className="mx-textarea" 
                    value={segNota} 
                    onChange={e => setSegNota(e.target.value)} 
                    placeholder="Describe lo ocurrido (ej: retraso por clima, cambio de logística...)"
                    required
                  />
                </div>
              </div>
              <div className="mx-modal-footer">
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setShowSegModal(false)}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary">
                  <CheckCircle2 size={18} /> Registrar Novedad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PROGRAMA */}
      {showModal && (() => {
        const totalPrograma    = formData.transportesAvanzados.reduce((s, t) => s + (Number(t.camionesTotales)||0) * (Number(t.toneladasPorCamion)||0), 0);
        const totalToneladasDia= formData.transportesAvanzados.reduce((s, t) => s + (Number(t.cantidadDia)||0)    * (Number(t.toneladasPorCamion)||0), 0);
        const saldoRestante    = tratoSaldo?.tonsDisponibles != null ? tratoSaldo.tonsDisponibles - totalPrograma : null;
        const programaExcedido = tratoSaldo?.tonsDisponibles != null && totalPrograma > 0 && totalPrograma > tratoSaldo.tonsDisponibles;
        const ritmoExcesivo    = totalToneladasDia > 0 && totalPrograma > 0 && totalToneladasDia > totalPrograma;
        const syntheticTpts    = formData.transportesAvanzados.map(t => ({ cantidadDia: t.cantidadDia, toneladasPorCamion: t.toneladasPorCamion }));
        const terminoEstimado  = calcTerminoPrograma(formData.vigenciaDesde, totalPrograma, syntheticTpts, formData.diasSemana);
        const diasEfectivos    = totalToneladasDia > 0 && totalPrograma > 0 ? Math.ceil(totalPrograma / totalToneladasDia) : null;
        const rowsValid = formData.transportesAvanzados.every(t =>
          t.tipoTransporteId && Number(t.camionesTotales) > 0 && Number(t.cantidadDia) > 0 && Number(t.toneladasPorCamion) > 0
        );
        const canSubmit = !!formData.tratoId && !!formData.vigenciaDesde
          && formData.tipoProducto !== 'sin_definir'
          && rowsValid && totalPrograma > 0
          && !programaExcedido && !ritmoExcesivo
          && formData.diasSemana.length > 0 && totalToneladasDia > 0;
        const transportErrors = formData.transportesAvanzados.map(t => ({
          tipo:               submitAttempted && !t.tipoTransporteId                  ? 'Tipo requerido' : null,
          camionesTotales:    submitAttempted && !(Number(t.camionesTotales) > 0)     ? 'Requerido' : null,
          cantidadDia:        submitAttempted && !(Number(t.cantidadDia) > 0)         ? 'Requerido' : null,
          toneladasPorCamion: submitAttempted && !(Number(t.toneladasPorCamion) > 0) ? 'Requerido' : null,
        }));
        const errProducto   = submitAttempted && formData.tipoProducto === 'sin_definir';
        const errFecha      = submitAttempted && !formData.vigenciaDesde;
        const errDiasSemana = submitAttempted && formData.diasSemana.length === 0;
        const hasAnyError   = submitAttempted && !canSubmit;
        const NC = ({ n }) => (
          <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{n}</div>
        );
        return (
          <div className="mx-modal-overlay">
            <div className="mx-modal" style={{ maxWidth: '560px' }}>
              <div className="mx-modal-header">
                <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>{editingId ? 'Editar Programa' : 'Nuevo Programa de Cosecha'}</h2>
                <button className="mx-btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
              </div>
              <form onSubmit={handleSave} className="mx-form">
                <div className="mx-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                  {hasAnyError && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <AlertTriangle size={14} style={{ color: '#DC2626', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>Revisa los campos marcados antes de continuar.</span>
                    </div>
                  )}

                  {/* ══ BLOQUE 1 — Cabecera del trato ══ */}
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 16px', background: '#fff' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 148px', gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Proveedor / Trato acordado</label>
                        <select className="mx-select" value={formData.tratoId} required
                          onChange={e => {
                            const t = tratosAcordados.find(x => x._id === e.target.value);
                            const limites = computeTratoLimites(t);
                            setTratoLimites(limites);
                            setFormData({ ...formData, tratoId: e.target.value, vigenciaDesde: limites.vigenciaDesde || formData.vigenciaDesde, vigenciaHasta: limites.vigenciaHasta || formData.vigenciaHasta, tipoProducto: t?.tipoProducto || t?.tipoProductoSugerido || formData.tipoProducto || 'sin_definir' });
                            fetchTratoSaldo(e.target.value, editingId);
                          }}>
                          <option value="">— Seleccionar trato —</option>
                          {tratosAcordados.map(t => (
                            <option key={t._id} value={t._id}>{t.proveedorNombre} — {t.tonsAcordadas} t{t.centroCodigo ? ` (${t.centroCodigo})` : ''}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: errFecha ? '#EF4444' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Desde</label>
                        <input type="date" className="mx-input" value={formData.vigenciaDesde} required
                          min={tratoLimites.vigenciaDesde || undefined}
                          style={errFecha ? { borderColor: '#EF4444', background: '#FEF2F2' } : {}}
                          onChange={e => setFormData({ ...formData, vigenciaDesde: e.target.value })} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #F1F5F9', paddingTop: 10, gap: 8 }}>
                      {[
                        { label: 'Acordado', value: tratoSaldo ? `${fmtNumber(tratoSaldo.tonsAcordadas, 0)} t` : '—', color: '#1e293b' },
                        { label: 'Programado', value: tratoSaldo ? `${fmtNumber(tratoSaldo.tonsYaProgramadas, 0)} t` : '—', color: '#64748b' },
                        { label: 'Disponible', value: tratoSaldo ? `${fmtNumber(tratoSaldo.tonsDisponibles, 0)} t` : '—', color: tratoSaldo?.tonsDisponibles > 0 ? '#10B981' : '#DC2626' },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginTop: 3, letterSpacing: '0.04em' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ══ BLOQUE 2 — ¿Qué vamos a programar? ══ */}
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 16px', background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <NC n={1} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>¿Qué vamos a programar?</span>
                    </div>

                    {/* Producto — siempre arriba, independiente de los tipos de camión */}
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>Producto</label>
                      <select className="mx-select" style={{ maxWidth: 200, ...(errProducto ? { borderColor: '#EF4444', background: '#FEF2F2' } : {}) }}
                        value={formData.tipoProducto}
                        onChange={e => setFormData({ ...formData, tipoProducto: e.target.value })}>
                        <option value="sin_definir">— Selecciona un producto —</option>
                        <option value="entero">Entero</option>
                        <option value="carne">Carne</option>
                        <option value="mc">Media Concha</option>
                      </select>
                      {errProducto && <div style={{ marginTop: 4, fontSize: 12, color: '#EF4444', fontWeight: 500 }}>Selecciona un producto.</div>}
                    </div>
                    {/* Separador */}
                    <div style={{ margin: '10px 0 12px', height: 1, background: '#F1F5F9' }} />

                    {/* Tabla de tipos de camión — siempre visible */}
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Tipos de camión</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr>
                            {['Tipo camión', 'Cam. totales', 'Cam/día', 'T/camión', 'Total'].map((h, i) => (
                              <th key={i} style={{ padding: '4px 6px', textAlign: i === 0 ? 'left' : 'center', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                            <th style={{ width: 28, borderBottom: '2px solid #E2E8F0' }} />
                          </tr>
                        </thead>
                        <tbody>
                          {formData.transportesAvanzados.map((t, idx) => {
                            const tTotales = (Number(t.camionesTotales)||0) * (Number(t.toneladasPorCamion)||0);
                            return (
                              <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '5px 4px 5px 0' }}>
                                  <select style={{ width: '100%', height: 30, padding: '2px 6px', fontSize: 12, border: `1px solid ${transportErrors[idx]?.tipo ? '#EF4444' : '#E2E8F0'}`, borderRadius: 7, background: transportErrors[idx]?.tipo ? '#FEF2F2' : '#fff', color: t.tipoTransporteId ? '#0F172A' : '#94a3b8' }}
                                    value={t.tipoTransporteId}
                                    onChange={e => {
                                      const tipo = tiposTransporte.find(x => x._id === e.target.value);
                                      const tonsAuto = tipo?.maxisPorUnidad && tipo?.kgPorMaxiRef ? Math.round((tipo.maxisPorUnidad * tipo.kgPorMaxiRef) / 100) / 10 : null;
                                      const next = [...formData.transportesAvanzados]; next[idx] = { ...t, tipoTransporteId: e.target.value, tipoTransporteNombre: tipo?.nombre || '', toneladasPorCamion: tonsAuto ?? t.toneladasPorCamion };
                                      setFormData({ ...formData, transportesAvanzados: next });
                                    }}>
                                    <option value="">Sin tipo</option>
                                    {tiposTransporte.map(x => <option key={x._id} value={x._id}>{x.nombre}</option>)}
                                  </select>
                                </td>
                                {[['camionesTotales','total'],['cantidadDia','p/día'],['toneladasPorCamion','t/cam']].map(([field, ph]) => {
                                  const hasErr = !!transportErrors[idx]?.[field];
                                  return (
                                    <td key={field} style={{ padding: '5px 4px', textAlign: 'center' }}>
                                      <input type="number" min="0" step={field === 'toneladasPorCamion' ? '0.1' : '1'}
                                        style={{ width: 58, height: 30, padding: '2px 4px', textAlign: 'center', fontSize: 12,
                                                 border: `1px solid ${hasErr ? '#EF4444' : '#E2E8F0'}`, borderRadius: 7,
                                                 background: hasErr ? '#FEF2F2' : '#fff', color: '#0F172A' }}
                                        placeholder={ph} value={t[field]}
                                        onChange={e => {
                                          const next = [...formData.transportesAvanzados]; next[idx] = { ...t, [field]: e.target.value };
                                          setFormData({ ...formData, transportesAvanzados: next });
                                        }} />
                                    </td>
                                  );
                                })}
                                <td style={{ padding: '5px 4px', textAlign: 'center', fontWeight: 700, color: tTotales > 0 ? 'var(--color-primary)' : '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>
                                  {tTotales > 0 ? `${fmtNumber(tTotales, 0)} t` : '—'}
                                </td>
                                <td style={{ padding: '5px 0 5px 4px', textAlign: 'center' }}>
                                  {formData.transportesAvanzados.length > 1 && (
                                    <button type="button" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, border: 'none', background: '#FEE2E2', borderRadius: 7, color: '#DC2626', cursor: 'pointer' }}
                                      onClick={() => setFormData({ ...formData, transportesAvanzados: formData.transportesAvanzados.filter((_, i) => i !== idx) })}>
                                      <Trash size={12} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <button type="button" className="mx-btn mx-btn-outline" style={{ fontSize: 12, height: 30, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        onClick={() => setFormData({ ...formData, transportesAvanzados: [...formData.transportesAvanzados, { tipoTransporteId: '', tipoTransporteNombre: '', camionesTotales: '', cantidadDia: '', toneladasPorCamion: '' }] })}>
                        <Plus size={12} /> Agregar tipo de camión
                      </button>
                    </div>
                    {totalPrograma > 0 && (
                      <div style={{ marginTop: 10, background: programaExcedido ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${programaExcedido ? '#FECACA' : '#BBF7D0'}`, borderRadius: 10, padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>Total a programar</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: programaExcedido ? '#DC2626' : '#10B981', lineHeight: 1 }}>{fmtNumber(totalPrograma, 0)} t</div>
                          </div>
                          {saldoRestante != null && (
                            <div>
                              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>Saldo restante</div>
                              <div style={{ fontSize: 20, fontWeight: 800, color: saldoRestante >= 0 ? '#10B981' : '#DC2626', lineHeight: 1 }}>{fmtNumber(Math.max(0, saldoRestante), 0)} t</div>
                            </div>
                          )}
                        </div>
                        {programaExcedido && tratoSaldo && (
                          <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center', color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
                            <AlertTriangle size={13} />
                            No puedes programar {fmtNumber(totalPrograma, 0)} t. Disponible del trato: {fmtNumber(tratoSaldo.tonsDisponibles, 0)} t.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ══ BLOQUE 3 — ¿Cómo lo vamos a sacar? ══ */}
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 16px', background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <NC n={2} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>¿Cómo lo vamos a sacar?</span>
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Días de cosecha</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d, i) => {
                          const activo = formData.diasSemana.includes(i);
                          return (
                            <label key={i} style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: activo ? 700 : 400, cursor: 'pointer', background: activo ? 'var(--color-primary)' : '#fff', border: `1px solid ${activo ? 'var(--color-primary)' : (errDiasSemana ? '#EF4444' : '#E2E8F0')}`, color: activo ? '#fff' : '#64748b', transition: 'all 0.12s ease', userSelect: 'none' }}>
                              <input type="checkbox" style={{ display: 'none' }} checked={activo}
                                onChange={() => setFormData({ ...formData, diasSemana: activo ? formData.diasSemana.filter(x => x !== i) : [...formData.diasSemana, i] })} />
                              {d}
                            </label>
                          );
                        })}
                      </div>
                      {errDiasSemana && (
                        <div style={{ marginTop: 6, fontSize: 12, color: '#EF4444', fontWeight: 500, display: 'flex', gap: 5, alignItems: 'center' }}>
                          <AlertTriangle size={12} /> Selecciona al menos un día de cosecha.
                        </div>
                      )}
                    </div>

                    {(totalToneladasDia > 0 || diasEfectivos != null || terminoEstimado) ? (
                      <div style={{ background: ritmoExcesivo ? '#FEF2F2' : '#F8FAFC', border: `1px solid ${ritmoExcesivo ? '#FECACA' : '#E2E8F0'}`, borderRadius: 10, padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                          {[
                            { label: 'Total diario', value: totalToneladasDia > 0 ? `${fmtNumber(totalToneladasDia, 0)} t/día` : '—' },
                            { label: 'Días efectivos', value: diasEfectivos != null ? String(diasEfectivos) : '—' },
                            { label: 'Término estimado', value: terminoEstimado || 'Pendiente' },
                          ].map(({ label, value }) => (
                            <div key={label}>
                              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: 2, letterSpacing: '0.04em' }}>{label}</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{value}</div>
                            </div>
                          ))}
                        </div>
                        {ritmoExcesivo && (
                          <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center', color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
                            <AlertTriangle size={12} />
                            El ritmo ({fmtNumber(totalToneladasDia, 0)} t/día) supera el total. Reduce los camiones por día.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Completa los datos para ver el resumen.</div>
                    )}
                  </div>

                  {/* ══ BLOQUE 4 — Notas ══ */}
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 16px', background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <NC n={3} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                        Notas / Observaciones <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8' }}>(opcional)</span>
                      </span>
                    </div>
                    <textarea className="mx-textarea" value={formData.notas} rows="2" placeholder="Escribe aquí..."
                      onChange={e => setFormData({ ...formData, notas: e.target.value })}
                      style={{ resize: 'vertical', minHeight: 60 }} />
                  </div>

                </div>
                <div className="mx-modal-footer">
                  <button type="button" className="mx-btn mx-btn-outline" onClick={() => { setShowModal(false); setSubmitAttempted(false); }}>Cancelar</button>
                  <button
                    type="button"
                    className="mx-btn mx-btn-primary"
                    onClick={() => {
                      setSubmitAttempted(true);
                      if (canSubmit) setShowConfirm(true);
                    }}
                  >
                    <CheckCircle2 size={18} /> {editingId ? 'Guardar Cambios' : 'Crear Programa'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {showConfirm && (() => {
        const tProg  = formData.transportesAvanzados.reduce((s, t) => s + (Number(t.camionesTotales)||0) * (Number(t.toneladasPorCamion)||0), 0);
        const tDia   = formData.transportesAvanzados.reduce((s, t) => s + (Number(t.cantidadDia)||0)    * (Number(t.toneladasPorCamion)||0), 0);
        const saldo  = tratoSaldo?.tonsDisponibles != null ? tratoSaldo.tonsDisponibles - tProg : null;
        const dias   = tDia > 0 && tProg > 0 ? Math.ceil(tProg / tDia) : null;
        const synth  = formData.transportesAvanzados.map(t => ({ cantidadDia: t.cantidadDia, toneladasPorCamion: t.toneladasPorCamion }));
        const term   = calcTerminoPrograma(formData.vigenciaDesde, tProg, synth, formData.diasSemana);
        const prodLabel = { entero: 'Entero', carne: 'Carne', mc: 'Media Concha', sin_definir: 'Sin definir' }[formData.tipoProducto] || formData.tipoProducto;
        const selTrato   = tratosAcordados.find(t => String(t._id) === String(formData.tratoId));
        const provNombre = selTrato?.proveedorNombre || '';
        const centroStr  = [selTrato?.centroCodigo, selTrato?.centroNombre].filter(Boolean).join(' · ') || '';
        // Formato DD-MM-YYYY para mostrar
        const fmtDate = (iso) => {
          if (!iso) return '—';
          const [y, m, d] = iso.split('-');
          return `${d}-${m}-${y}`;
        };

        // Estilos reutilizables — idénticos al patrón Muestreo
        const S = {
          card:      { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 16 },
          label:     { fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 6, display: 'block' },
          valLg:     { fontSize: 22, fontWeight: 900, lineHeight: 1.1, color: '#0F172A' },
          valMd:     { fontSize: 16, fontWeight: 800, color: '#0F172A' },
          iconCircle:(bg) => ({ width: 42, height: 42, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }),
          sectionTitle: { fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 8, marginTop: 4 },
        };

        return createPortal(
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={() => setShowConfirm(false)}
          >
            <div
              style={{ background: '#F8FAFC', borderRadius: 24, boxShadow: '0 25px 60px -10px rgba(15,23,42,0.22)', width: '100%', maxWidth: 520, maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}
            >
              {/* ── Header ── */}
              <div style={{ background: '#fff', padding: '20px 24px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>{editingId ? 'Confirmar cambios' : 'Confirmar programa'}</h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>Revisa el resumen antes de {editingId ? 'guardar.' : 'crear el programa.'}</p>
                </div>
                <button type="button" onClick={() => setShowConfirm(false)}
                  style={{ border: 'none', background: '#F1F5F9', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', flexShrink: 0, marginLeft: 16 }}>
                  <X size={16} />
                </button>
              </div>

              {/* ── Body ── */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* BLOQUE 1 — Proveedor */}
                <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={S.iconCircle('#EFF6FF')}>
                    <Building2 size={20} color="#2563EB" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ ...S.label, marginBottom: 3 }}>Proveedor</span>
                    <div style={{ ...S.valMd, fontSize: 17 }}>{provNombre || '—'}</div>
                    {centroStr && <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{centroStr}</div>}
                  </div>
                </div>

                {/* BLOQUE 2 — KPIs 3x2 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {/* Fila 1 */}
                  <div style={{ ...S.card, textAlign: 'center' }}>
                    <span style={S.label}>Total programado</span>
                    <div style={{ ...S.valLg, color: '#2563EB' }}>{tProg > 0 ? `${fmtNumber(tProg, 0)} t` : '—'}</div>
                  </div>
                  <div style={{ ...S.card, textAlign: 'center' }}>
                    <span style={S.label}>Saldo del trato</span>
                    <div style={{ ...S.valLg, color: saldo != null && saldo < 0 ? '#EF4444' : '#10B981' }}>
                      {saldo != null ? `${fmtNumber(Math.max(0, saldo), 0)} t` : '—'}
                    </div>
                  </div>
                  <div style={{ ...S.card, textAlign: 'center' }}>
                    <span style={S.label}>Producto</span>
                    <div style={{ ...S.valMd }}>{prodLabel}</div>
                  </div>
                  {/* Fila 2 */}
                  <div style={{ ...S.card, textAlign: 'center' }}>
                    <span style={S.label}>Inicio</span>
                    <div style={{ ...S.valMd }}>{fmtDate(formData.vigenciaDesde)}</div>
                  </div>
                  <div style={{ ...S.card, textAlign: 'center' }}>
                    <span style={S.label}>Total diario</span>
                    <div style={{ ...S.valMd }}>{tDia > 0 ? `${fmtNumber(tDia, 0)} t/día` : '—'}</div>
                  </div>
                  <div style={{ ...S.card, textAlign: 'center' }}>
                    <span style={S.label}>Días efectivos</span>
                    <div style={{ ...S.valMd }}>{dias != null ? `${dias} días` : '—'}</div>
                  </div>
                </div>

                {/* BLOQUE 3 — Término estimado destacado */}
                {term && (
                  <div style={{ ...S.card, background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={S.iconCircle('#DBEAFE')}>
                      <CalendarIcon size={20} color="#2563EB" />
                    </div>
                    <div>
                      <span style={{ ...S.label, color: '#3B82F6', marginBottom: 3 }}>Término estimado</span>
                      <div style={{ ...S.valMd, fontSize: 18, color: '#1D4ED8' }}>{term}</div>
                    </div>
                  </div>
                )}

                {/* BLOQUE 4 — Desglose de transporte */}
                <div>
                  <div style={S.sectionTitle}>Desglose de transporte</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {formData.transportesAvanzados.map((t, i) => {
                      const tt = (Number(t.camionesTotales)||0) * (Number(t.toneladasPorCamion)||0);
                      return (
                        <div key={i} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={S.iconCircle('#F1F5F9')}>
                            <Truck size={18} color="#475569" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{t.tipoTransporteNombre || 'Sin tipo'}</div>
                            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                              {t.camionesTotales} camiones totales &middot; {t.cantidadDia} por día &middot; {t.toneladasPorCamion} t/camión
                            </div>
                          </div>
                          {tt > 0 && (
                            <div style={{ fontSize: 18, fontWeight: 900, color: '#2563EB', flexShrink: 0 }}>
                              {fmtNumber(tt, 0)} t
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* BLOQUE 5 — Días de cosecha */}
                <div>
                  <div style={S.sectionTitle}>Días de cosecha</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((d, i) => (
                      formData.diasSemana.includes(i) && (
                        <span key={i} style={{ padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: '#2563EB', color: '#fff', letterSpacing: '0.01em' }}>{d}</span>
                      )
                    ))}
                  </div>
                </div>

                {/* Notas (opcional) */}
                {formData.notas?.trim() && (
                  <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14, padding: '12px 16px' }}>
                    <span style={{ ...S.label, color: '#92400E' }}>Notas</span>
                    <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.6 }}>{formData.notas}</div>
                  </div>
                )}

                {/* BLOQUE 6 — Alerta informativa */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '11px 14px' }}>
                  <AlertTriangle size={16} style={{ color: '#F59E0B', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: '#78350F', lineHeight: 1.5 }}>
                    Este programa se {editingId ? 'actualizará' : 'creará'} para <strong>{provNombre}</strong>{centroStr ? ` · ${centroStr}` : ''}.
                  </span>
                </div>

              </div>

              {/* ── Footer ── */}
              <div style={{ background: '#fff', padding: '14px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setShowConfirm(false)}>
                  ← Volver a editar
                </button>
                <button type="button" className="mx-btn mx-btn-primary" onClick={handleSave}>
                  <CheckCircle2 size={16} /> {editingId ? 'Confirmar y guardar' : 'Confirmar y crear'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {pauseModal && (
        <div className="mx-modal-overlay" onClick={() => setPauseModal(null)}>
          <div className="mx-modal pause-modal" onClick={e => e.stopPropagation()}>
            <div className="mx-modal-header">
              <h2>Pausar programa</h2>
              <button className="mx-modal-close" onClick={() => setPauseModal(null)}>✕</button>
            </div>
            <div className="mx-modal-body">
              <p className="pause-modal-desc">
                <strong>{pauseModal.proveedorNombre}</strong> — los días desde la fecha de pausa no se proyectarán en el calendario. Los datos históricos se conservan.
              </p>
              <div className="mx-form-group">
                <label className="mx-label">Pausado desde</label>
                <input
                  type="date"
                  className="mx-input"
                  value={pauseForm.pausadoDesde}
                  onChange={e => setPauseForm(f => ({ ...f, pausadoDesde: e.target.value }))}
                />
              </div>
              <div className="mx-form-group">
                <label className="mx-label">Motivo (opcional)</label>
                <textarea
                  className="mx-input"
                  rows={3}
                  placeholder="Ej: problema sanitario, falta de biomasa..."
                  value={pauseForm.motivoPausa}
                  onChange={e => setPauseForm(f => ({ ...f, motivoPausa: e.target.value }))}
                />
              </div>
            </div>
            <div className="mx-modal-footer">
              <button className="mx-btn mx-btn-outline" onClick={() => setPauseModal(null)}>Cancelar</button>
              <button className="mx-btn mx-btn-warning" onClick={handlePauseConfirm}>
                <Pause size={14} /> Pausar programa
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="¿Eliminar programa?"
        description={confirmDelete ? `Estás a punto de borrar el programa de cosecha de "${confirmDelete.proveedorNombre}". Esta acción es irreversible.` : ''}
      />

      {showFinalizeModal && finalizingProgram && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: 500 }}>
            <div className="mx-modal-header">
              <h2>Finalizar programa</h2>
              <button className="mx-btn-icon" onClick={() => setShowFinalizeModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleFinalizarConfirm} className="mx-form">
              <div className="mx-modal-body">
                <p style={{ margin: '0 0 16px', color: 'var(--color-text-subtle)', fontSize: '0.9rem' }}>
                  {finalizingProgram.proveedorNombre}{finalizingProgram.centroNombre ? ` · ${finalizingProgram.centroNombre}` : ''}
                </p>
                <div className="mx-form-group">
                  <label className="mx-label">Fecha real de cierre *</label>
                  <input
                    type="date"
                    className="mx-input"
                    value={finalizeForm.fechaCierre}
                    onChange={e => setFinalizeForm(f => ({ ...f, fechaCierre: e.target.value }))}
                    required
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-subtle)', marginTop: 4, display: 'block' }}>
                    Esta fecha queda registrada como el último día real de cosecha.
                  </span>
                </div>
                <div className="mx-form-group">
                  <label className="mx-label">Motivo de cierre *</label>
                  <select
                    className="mx-select"
                    value={finalizeForm.motivoCierre}
                    onChange={e => setFinalizeForm(f => ({ ...f, motivoCierre: e.target.value }))}
                    required
                  >
                    <option value="">Selecciona motivo...</option>
                    <option value="cumplido">Cumplido — cosecha completada</option>
                    <option value="cambio_condiciones">Cambio de condiciones — nuevo precio u acuerdo</option>
                    <option value="pausa_operacional">Pausa operacional — retoma con nuevo programa</option>
                    <option value="sin_biomasa">Sin biomasa — stock agotado</option>
                    <option value="reemplazado_por_nuevo">Reemplazado por nuevo programa</option>
                  </select>
                </div>
                <div className="mx-form-group">
                  <label className="mx-label">Nota (opcional)</label>
                  <textarea
                    className="mx-textarea"
                    rows={3}
                    value={finalizeForm.nota}
                    onChange={e => setFinalizeForm(f => ({ ...f, nota: e.target.value }))}
                    placeholder="Observaciones sobre el cierre..."
                  />
                </div>
              </div>
              <div className="mx-modal-footer">
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setShowFinalizeModal(false)}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary" disabled={!finalizeForm.motivoCierre || !finalizeForm.fechaCierre}>
                  Finalizar programa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showContinuityModal && continuitySource && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: 440 }}>
            <div className="mx-modal-header">
              <h2>Programa finalizado</h2>
              <button className="mx-btn-icon" onClick={() => setShowContinuityModal(false)}><X size={20} /></button>
            </div>
            <div className="mx-modal-body" style={{ textAlign: 'center', padding: '24px' }}>
              <CheckCircle2 size={40} style={{ color: 'var(--color-success)', marginBottom: 16 }} />
              <p style={{ color: 'var(--color-text-subtle)', fontSize: '0.9rem' }}>
                ¿Crear un programa de continuidad para <strong>{continuitySource.proveedorNombre}</strong>? Se abre el formulario pre-llenado con los datos del programa anterior.
              </p>
            </div>
            <div className="mx-modal-footer">
              <button className="mx-btn mx-btn-outline" onClick={() => setShowContinuityModal(false)}>No, gracias</button>
              <button className="mx-btn mx-btn-primary" onClick={handleCrearContinuidad}>Sí, crear continuidad</button>
            </div>
          </div>
        </div>
      )}

      {notaPopover && (
        <>
          <div className="suspend-popover-backdrop" onClick={() => setNotaPopover(null)} />
          <div className="suspend-popover nota-popover" style={{ left: notaPopover.x, top: notaPopover.y }}>
            <div className="suspend-popover-title">Nota del día · {notaPopover.fechaKey}</div>
            <textarea
              className="mx-textarea"
              rows={3}
              placeholder="Ej: Se compensó camión de Algemarín con García por clima..."
              value={notaPopover.nota}
              autoFocus
              onChange={e => setNotaPopover(p => ({ ...p, nota: e.target.value }))}
            />
            <div className="suspend-popover-footer">
              {notasDia?.[notaPopover.fechaKey] && (
                <button className="mx-btn mx-btn-danger sm" onClick={() => handleDeleteNotaDia(notaPopover.fechaKey)}>Eliminar</button>
              )}
              <button className="mx-btn mx-btn-outline sm" onClick={() => setNotaPopover(null)}>Cancelar</button>
              <button
                className="mx-btn mx-btn-primary sm"
                disabled={!notaPopover.nota?.trim()}
                onClick={() => handleUpsertNotaDia(notaPopover.fechaKey, notaPopover.nota)}
              >Guardar</button>
            </div>
          </div>
        </>
      )}

      {suspendPopover && (
        <>
          <div className="suspend-popover-backdrop" onClick={() => setSuspendPopover(null)} />
          <div
            className="suspend-popover"
            style={{ left: suspendPopover.x, top: suspendPopover.y }}
          >
            <div className="suspend-popover-title">Suspender día</div>
            <select
              className="mx-select"
              value={suspendPopover.motivo}
              onChange={e => setSuspendPopover(p => ({ ...p, motivo: e.target.value }))}
            >
              {ADJUST_MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input
              className="mx-input"
              placeholder="Nota (opcional)"
              value={suspendPopover.nota}
              onChange={e => setSuspendPopover(p => ({ ...p, nota: e.target.value }))}
            />
            <div className="suspend-popover-footer">
              <button className="mx-btn mx-btn-outline sm" onClick={() => setSuspendPopover(null)}>Cancelar</button>
              <button
                className="mx-btn mx-btn-danger sm"
                onClick={() => handleSuspendDay(suspendPopover.programa, suspendPopover.fecha, suspendPopover.motivo, suspendPopover.nota)}
              >
                Suspender
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

