import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { useToast } from '../../context/ToastContext';
import { useBiomasaData } from '../../hooks/useBiomasaData';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import Muestreos from '../gestion/submodules/Muestreos';

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
  mc: 'MC',
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

const ADJUST_ACTION_LABELS = {
  sumar: 'Sumar camion',
  suspender: 'Suspender camion',
  set_total: 'Cambiar total del dia',
  suspender_dia: 'Suspender dia completo',
};

const ADJUST_MOTIVOS = ['Planta', 'Clima', 'Transporte', 'Proveedor', 'Sanitario', 'Calidad', 'Comercial', 'Otro'];

const formatDailyAdjustmentText = (ajuste) => {
  if (!ajuste) return '';
  const fecha = ajuste.fecha ? new Date(ajuste.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '';
  const action = ADJUST_ACTION_LABELS[ajuste.accion] || 'Ajuste diario';
  const before = Number(ajuste.camionesAntes || 0);
  const after = Number(ajuste.camionesDespues || 0);
  const motivo = ajuste.motivo ? ` por ${ajuste.motivo}` : '';
  const nota = ajuste.nota ? `: ${ajuste.nota}` : '';
  return `${fecha ? `${fecha} - ` : ''}${action}${motivo}. ${before} -> ${after} cam${nota}`;
};

const SANITARIO_ORDER = { rojo: 4, naranja: 3, amarillo: 2, verde: 1, gris: 0 };
const SANITARIO_LABELS = {
  rojo: 'Bloqueada',
  naranja: 'Alerta',
  amarillo: 'Observacion',
  verde: 'OK',
  gris: 'Sin datos',
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
  const { disp, asig, programas, calData, tratosAcordados, tratosBiomasa, perdidasBiomasa, reload: load } = useBiomasaData(mes, {
    isStatusView,
    isProgramView,
    isMuestreosView,
    statusSubTab,
    progSubTab
  });

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    tratoId: '',
    vigenciaDesde: '',
    vigenciaHasta: '',
    camionesDefault: 1,
    tonsEstimadas: '',
    tipoProducto: 'sin_definir',
    tipoCamion: '',
    maxisPorCamion: '',
    condicionContinuidad: '',
    notas: '',
    diasSemana: [1,2,3,4,5],
    diasEspeciales: []
  });

  const [confirmDelete, setConfirmDelete] = useState(null);
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
  
  // Estados para Calendario Avanzado
  const [calView, setCalView] = useState('month'); // 'month' | 'week'
  const [selectedDay, setSelectedDay] = useState(null);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [isCalendarBoard, setIsCalendarBoard] = useState(false);
  const [calendarMetric, setCalendarMetric] = useState('both');
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

  const enrichCalendarItem = useCallback((item) => {
    const programa = programasById.get(String(item?.programaId || ''));
    const tipoProducto = getPreferredTipoProducto(
      programa?.tipoProducto,
      programa?.tipoProductoSugerido,
      item?.tipoProducto,
      item?.tipoProductoSugerido
    );
    const camiones = Number(item?.camiones || 0);
    const tonsDia = camiones * Number(tonsPerTruck || 0);
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

  const weekData = useMemo(() => {
    const data = {};
    programas.filter(p => p.estado === 'activo').forEach(p => {
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
  }, [programas, calData, weekDays, enrichCalendarItem]);

  const weekSummaries = useMemo(() => {
    const daily = {};
    const total = { camiones: 0, tons: 0 };
    weekDays.forEach((dayKeyValue) => {
      const items = (calData[dayKeyValue]?.items || []).map(enrichCalendarItem);
      daily[dayKeyValue] = {
        camiones: items.reduce((sum, item) => sum + Number(item.camiones || 0), 0),
        tons: items.reduce((sum, item) => sum + Number(item.tonsDia || 0), 0),
      };
      total.camiones += daily[dayKeyValue].camiones;
      total.tons += daily[dayKeyValue].tons;
    });

    return { daily, total };
  }, [calData, weekDays, enrichCalendarItem]);

  const programasPeriodo = useMemo(() => {
    const rangeStart = programPeriod === 'week'
      ? new Date(`${weekDays[0]}T00:00:00`)
      : new Date(`${mes}-01T00:00:00`);
    const rangeEnd = programPeriod === 'week'
      ? new Date(`${weekDays[6]}T23:59:59`)
      : new Date(`${finMes(mes)}T23:59:59`);
    const weekSet = new Set(weekDays);

    return programas.filter((programa) => {
      const desde = programa.vigenciaDesde ? new Date(programa.vigenciaDesde) : null;
      const hasta = programa.vigenciaHasta ? new Date(programa.vigenciaHasta) : null;
      const overlapsVigencia = desde && hasta && desde <= rangeEnd && hasta >= rangeStart;
      const hasAdjustmentInPeriod = (programa.diasEspeciales || []).some((item) => {
        const key = item?.fecha ? new Date(item.fecha).toISOString().slice(0, 10) : '';
        return programPeriod === 'week' ? weekSet.has(key) : key.startsWith(mes);
      });
      return overlapsVigencia || hasAdjustmentInPeriod;
    });
  }, [mes, programPeriod, programas, weekDays]);

  const monthSummary = useMemo(() => {
    const providers = new Map();
    const products = {
      entero: { key: 'entero', camiones: 0, tons: 0 },
      carne: { key: 'carne', camiones: 0, tons: 0 },
      mc: { key: 'mc', camiones: 0, tons: 0 },
      sin_definir: { key: 'sin_definir', camiones: 0, tons: 0 },
    };
    const total = { camiones: 0, tons: 0, days: 0 };
    const sanitaryAlerts = new Map();

    Object.entries(calData || {}).forEach(([dateKey, day]) => {
      if (!String(dateKey).startsWith(mes)) return;
      const items = (day?.items || []).map(enrichCalendarItem).filter((item) => Number(item.camiones || 0) > 0);
      if (!items.length) return;
      total.days += 1;

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

        if (isSanitarioRelevant(item.sanitario)) {
          const alertKey = `${item.sanitario?.areaPSMB || item.centroCodigo || providerKey}-${getSanitarioEstado(item.sanitario)}`;
          if (!sanitaryAlerts.has(alertKey)) {
            sanitaryAlerts.set(alertKey, item.sanitario);
          }
        }
      });
    });

    return {
      total,
      providers: [...providers.values()].sort((a, b) => b.camiones - a.camiones),
      products: Object.values(products).filter((item) => item.camiones > 0),
      sanitaryAlerts: [...sanitaryAlerts.values()].sort((a, b) => (
        (SANITARIO_ORDER[getSanitarioEstado(b)] || 0) - (SANITARIO_ORDER[getSanitarioEstado(a)] || 0)
      )),
    };
  }, [calData, enrichCalendarItem, mes]);

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

  // Handlers CRUD
  const handleOpenModal = useCallback((item = null) => {
    if (item) {
      setEditingId(item._id);
      setFormData({
        tratoId: item.tratoId || '',
        vigenciaDesde: item.vigenciaDesde ? item.vigenciaDesde.split('T')[0] : '',
        vigenciaHasta: item.vigenciaHasta ? item.vigenciaHasta.split('T')[0] : '',
        camionesDefault: item.camionesDefault || 1,
        tonsEstimadas: item.tonsEstimadas || '',
        tipoProducto: item.tipoProducto || item.tipoProductoSugerido || 'sin_definir',
        tipoCamion: item.tipoCamion || '',
        maxisPorCamion: item.maxisPorCamion || '',
        condicionContinuidad: item.condicionContinuidad || '',
        notas: item.notas || '',
        diasSemana: item.diasSemana || [1,2,3,4,5],
        diasEspeciales: item.diasEspeciales || []
      });
    } else {
      setEditingId(null);
      setFormData({
        tratoId: tratosAcordados.length > 0 ? tratosAcordados[0]._id : '',
        vigenciaDesde: `${mes}-01`,
        vigenciaHasta: finMes(mes),
        camionesDefault: 1,
        tonsEstimadas: '',
        tipoProducto: tratosAcordados[0]?.tipoProducto || tratosAcordados[0]?.tipoProductoSugerido || 'sin_definir',
        tipoCamion: 'Normal',
        maxisPorCamion: 12,
        condicionContinuidad: 'Sin Condición',
        notas: '',
        diasSemana: [1,2,3,4,5],
        diasEspeciales: []
      });
    }
    setShowModal(true);
  }, [tratosAcordados, mes]);

  const handleSave = useCallback(async (e) => {
    e.preventDefault();
    const selectedTrato = tratosAcordados.find(t => t._id === formData.tratoId);
    const payload = {
      ...formData,
      proveedorNombre: selectedTrato?.proveedorNombre || programas.find(p => p._id === editingId)?.proveedorNombre,
      centroNombre: selectedTrato?.centroNombre || selectedTrato?.centroCodigo || programas.find(p => p._id === editingId)?.centroNombre || ''
    };

    try {
      const endpoint = editingId ? `/programa-cosecha/${editingId}` : '/programa-cosecha';
      const method = editingId ? 'put' : 'post';
      await apiClient[method](endpoint, payload);
      
      addToast({ title: editingId ? 'Programa Actualizado' : 'Programa Creado', message: editingId ? 'Los cambios fueron guardados.' : 'El programa de cosecha fue creado.', type: 'success' });
      setShowModal(false);
      load();
    } catch (e) { 
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [formData, tratosAcordados, programas, editingId, addToast, load]);

  const handleStatusChange = useCallback(async (id, nuevoEstado) => {
    try {
      await apiClient.patch(`/programa-cosecha/${id}/estado`, { estado: nuevoEstado });
      addToast({ title: nuevoEstado === 'activo' ? 'Programa Reanudado' : 'Programa Pausado', message: `El estado fue cambiado a ${nuevoEstado}.`, type: 'success' });
      load();
    } catch (e) { 
      addToast({ title: 'Error', message: e.message, type: 'error' });
    }
  }, [addToast, load]);

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

  const biomasaPendiente = useMemo(
    () => tratosBiomasa.filter((item) => !asText(item?.programaEstado, '').trim()),
    [tratosBiomasa]
  );

  const biomasaVinculada = useMemo(
    () => tratosBiomasa.filter((item) => asText(item?.programaEstado, '').trim()),
    [tratosBiomasa]
  );

  const negociacionKpis = useMemo(() => {
    const sumTons = (items) => items.reduce((acc, item) => acc + (Number(item?.tonsAcordadas || item?.tons || item?.biomasaEstimacion || 0)), 0);
    const enConversacion = biomasaPendiente.filter((item) => getSituacionBiomasaLabel(item) === 'En conversación');
    const acordadas = tratosBiomasa.filter((item) => getSituacionBiomasaLabel(item) === 'Acordada');
    return {
      enConversacionTons: sumTons(enConversacion),
      acordadasTons: sumTons(acordadas),
      perdidasTons: sumTons(perdidasBiomasa),
    };
  }, [biomasaPendiente, perdidasBiomasa, tratosBiomasa]);

  if (!isStatusView && !isProgramView && !isMuestreosView) return <Navigate to="/biomasa/status" replace />;

  return (
    <div className="mx-page">
      <header className="mx-hero">
        <div className="mx-hero-content">
          <p className="mx-eyebrow">Biomasa · {isStatusView ? 'Disponibilidad y negociación' : isProgramView ? 'Programa de cosecha' : 'Muestreos Técnicos'}</p>
          <h1 className="biomasa-title">{isStatusView ? 'Disponibilidad de biomasa' : isProgramView ? 'Programa de Cosecha' : 'Muestreos Técnicos'}</h1>
        </div>
        <div className="mx-hero-actions">
          {isStatusView && (
            false && <div className="mx-search-box" style={{ minWidth: 'auto' }}>
              <CalendarIcon size={18} />
              <input 
                type="month" 
                value={mes} 
                onChange={(e) => setMes(e.target.value)} 
                style={{ paddingLeft: '42px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }} 
              />
            </div>
          )}
          {isStatusView && (
            false && <button className="mx-btn-icon" onClick={load} style={{ color: 'white', background: 'rgba(255,255,255,0.1)' }}>
              <RotateCcw size={20} />
            </button>
          )}
        </div>
      </header>

      <div className="mx-content-frame">
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
                        ? `Semana ${new Date(weekDays[0] + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}`
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
                            ? `Semana ${new Date(weekDays[0] + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}`
                            : mesLabel(mes, true)}
                        </span>
                        <button className="mx-btn-icon sm" onClick={() => moveProgramPeriod(1)} aria-label="Periodo siguiente">
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mx-table-wrap">
                    <table className="mx-table harvest-program-table">
                      <thead>
                        <tr>
                          <th>Proveedor / Centro</th>
                          <th>Vigencia</th>
                          <th>Producto</th>
                          <th style={{ textAlign: 'center' }}>Cam/día</th>
                          <th>Volumen</th>
                          <th>Estado</th>
                          <th>Sanitario</th>
                          <th style={{ textAlign: 'right' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {programasPeriodo.map(p => {
                          const volume = getProgramVolumeProgress(p, tonsPerTruck);
                          const isOverEstimated = volume.estimated > 0 && volume.balance < 0;
                          const hasDailyAdjustments = Array.isArray(p.ajustesDiarios) && p.ajustesDiarios.length > 0;
                          const camionesStatus = getProgramCamionesStatus(p);
                          return (
                          <tr key={p._id}>
                            <td>
                              <div className="biomasa-prov-cell">
                                <div className="biomasa-avatar">
                                  {p.proveedorNombre ? p.proveedorNombre.substring(0, 2).toUpperCase() : 'NA'}
                                </div>
                                <div>
                                  <div className="biomasa-prov-name">{p.proveedorNombre || 'Proveedor Desconocido'}</div>
                                  <div className="biomasa-centro-name">{p.centroNombre || 'Sin Centro Definido'}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="biomasa-date-range">
                                <CalendarIcon size={14} />
                                {p.vigenciaDesde ? new Date(p.vigenciaDesde).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '—'} - {p.vigenciaHasta ? new Date(p.vigenciaHasta).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '—'}
                              </div>
                            </td>
                            <td>
                              <span className="mx-badge mx-badge-muted">
                                {getTipoProductoLabel(p.tipoProducto)}
                              </span>
                              {(p.uxkg || p.rendimiento) && (
                                <div className="harvest-program-quality">
                                  {p.uxkg ? <span>{fmtNumber(p.uxkg, 1)} un/kg</span> : null}
                                  {p.rendimiento ? <span>{fmtNumber(p.rendimiento, 1)}%</span> : null}
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div className="harvest-program-camiones">
                                <div className="biomasa-camiones-badge">
                                  {camionesStatus.base}
                                </div>
                                {camionesStatus.adjusted && (
                                  <span className="harvest-program-camiones-adjusted">
                                    Hoy {camionesStatus.today} cam
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="harvest-program-volume">
                                <div className="harvest-program-volume-head">
                                  <span>Est.</span>
                                  <strong>{volume.estimated ? fmtTonsInt(volume.estimated) : 'S/D'}</strong>
                                </div>
                                <div className="harvest-program-volume-bar" aria-hidden="true">
                                  <span style={{ width: `${volume.progress}%` }} />
                                </div>
                                <div className="harvest-program-volume-foot">
                                  <span>
                                    <b>{fmtTonsInt(volume.consumed)}</b>
                                    cons.
                                  </span>
                                  <span className={isOverEstimated ? 'is-over' : ''}>
                                    <b>{volume.estimated ? fmtTonsInt(Math.abs(volume.balance)) : 'S/D'}</b>
                                    {isOverEstimated ? 'sobre' : 'saldo'}
                                  </span>
                                </div>
                              </div>
                              {hasDailyAdjustments && (
                                <span className="harvest-program-adjusted-badge">
                                  Con ajustes diarios
                                </span>
                              )}
                            </td>
                            <td>
                              <span className={`mx-badge mx-badge-${p.estado === 'activo' ? 'success' : p.estado === 'pausado' ? 'warning' : 'muted'}`}>
                                {(p.estado || 'desconocido').toUpperCase()}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`harvest-sanitary-badge ${getSanitarioEstado(p.sanitario)}`}
                                title={[
                                  p.sanitario?.areaPSMB,
                                  p.sanitario?.codigoArea ? `Area ${p.sanitario.codigoArea}` : '',
                                  p.sanitario?.ultimoAnalisisMrsat,
                                ].filter(Boolean).join(' - ')}
                              >
                                {isSanitarioRelevant(p.sanitario) ? <AlertTriangle size={13} /> : null}
                                {getSanitarioLabel(p.sanitario)}
                              </span>
                              {p.sanitario?.areaPSMB && (
                                <div className="harvest-sanitary-meta">
                                  {p.sanitario.areaPSMB}{p.sanitario.codigoArea ? ` - ${p.sanitario.codigoArea}` : ''}
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div className="biomasa-action-bar">
                                {p.estado === 'activo' ? (
                                  <button className="mx-btn-icon sm pause" onClick={() => handleStatusChange(p._id, 'pausado')}><Pause size={14} /></button>
                                ) : p.estado === 'pausado' ? (
                                  <button className="mx-btn-icon sm play" onClick={() => handleStatusChange(p._id, 'activo')}><Play size={14} /></button>
                                ) : null}
                                <button className="mx-btn-icon sm edit" onClick={() => handleOpenModal(p)}><Edit size={14} /></button>
                                <button className="mx-btn-icon sm delete" onClick={() => setConfirmDelete(p)}><Trash size={14} /></button>
                              </div>
                            </td>
                          </tr>
                          );
                        })}
                        {!programasPeriodo.length && (
                          <tr>
                            <td colSpan="8" className="harvest-program-empty">
                              Sin programas para el periodo seleccionado.
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
                          <span className="harvest-calendar-title">
                            {calView === 'month' ? mesLabel(mes, true) : `Semana ${new Date(weekDays[0] + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}`}
                          </span>
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
                        <div className="harvest-metric-control">
                          <span>Ver</span>
                          <select value={calendarMetric} onChange={e => setCalendarMetric(e.target.value)}>
                            <option value="both">Cam + tons</option>
                            <option value="camiones">Camiones</option>
                            <option value="tons">Tons</option>
                          </select>
                        </div>
                        <label className="harvest-tons-control">
                          <span>t/cam</span>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={tonsPerTruck}
                            onChange={e => setTonsPerTruck(Number(e.target.value) || 0)}
                          />
                        </label>
                        {calView === 'week' && <button className="mx-btn mx-btn-outline sm" onClick={() => setCurrentWeekOffset(0)}>Volver a Hoy</button>}
                        <button
                          className="mx-btn mx-btn-outline sm"
                          onClick={handleCalendarBoardToggle}
                        >
                          {isCalendarBoard ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                          {isCalendarBoard ? 'Salir pantalla' : 'Pantalla completa'}
                        </button>
                      </div>
                    </div>

                    {calView === 'month' ? (
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
                          const dayItems = (dayDataObj.items || []).map(enrichCalendarItem);
                          const daySummary = summarizeHarvestItems(dayItems);
                          const hasAdjustedItems = dayItems.some((item) => item.esDiaEspecial);
                          const hasCanceledItems = dayItems.some((item) => item.cancelado || (item.esDiaEspecial && Number(item.camiones || 0) === 0));
                          const isSelected = selectedDay?.key === dateKey;
                          const metricKpi = getHarvestMetricKpi(daySummary.camiones, daySummary.tons, calendarMetric);

                          return (
                            <div 
                              key={dayNum} 
                              onClick={() => setSelectedDay({ key: dateKey, items: dayItems, total: daySummary.camiones, summary: daySummary })}
                              className={`cal-day-cell ${calendarDayToneClass(dateKey)} ${isSelected ? 'selected' : ''}`}
                            >
                              <div className="cal-day-top">
                                <span className="cal-day-num">{dayNum}</span>
                              </div>
                              {(daySummary.camiones > 0 || hasAdjustedItems) ? (
                                <div className="cal-day-compact-summary">
                                  {daySummary.camiones > 0 ? (
                                    <div className="cal-day-primary-total">
                                      {metricKpi.note && <span>{metricKpi.note}</span>}
                                      <strong>{metricKpi.value}</strong>
                                      <em>{metricKpi.unit}</em>
                                    </div>
                                  ) : (
                                    <div className="cal-day-primary-total is-canceled">0 cam</div>
                                  )}
                                  {isSanitarioRelevant(daySummary.sanitario) && (
                                    <div className={`cal-day-sanitary ${getSanitarioEstado(daySummary.sanitario)}`}>
                                      <AlertTriangle size={12} />
                                      {getSanitarioLabel(daySummary.sanitario)}
                                    </div>
                                  )}
                                  <div className="cal-day-meta-row">
                                    <span className="cal-day-provider-count">
                                      <Users size={11} />
                                      <b>{daySummary.providerCount}</b>
                                      <Package size={11} />
                                      <b>{daySummary.products.length}</b>
                                    </span>
                                    {hasAdjustedItems && (
                                      <span
                                        className={`cal-day-adjust-badge ${hasCanceledItems ? 'is-canceled' : ''}`}
                                        title={hasCanceledItems ? 'Suspendido' : 'Ajustado'}
                                      >
                                        <AlertTriangle size={10} />
                                        {hasCanceledItems ? 'Susp.' : 'Ajuste'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="cal-day-empty">—</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="harvest-week-layout">
                        <div className="mx-table-wrap harvest-week-wrap">
                          <table className="mx-table harvest-week-table">
                            <thead>
                              <tr>
                                <th>PROVEEDOR / CENTRO</th>
                                {weekDays.map((d) => (
                                  <th key={d} className={calendarDayToneClass(d)} style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 'var(--weight-bold)' }}>{new Date(d + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'short' }).toUpperCase()}</div>
                                    <div style={{ fontSize: '18px', color: 'var(--color-text)', fontWeight: 'var(--weight-bold)' }}>{d.split('-')[2]}</div>
                                  </th>
                                ))}
                                <th style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 'var(--weight-bold)' }}>TOTAL</div>
                                  <div style={{ fontSize: '18px', color: 'var(--color-text)', fontWeight: 'var(--weight-bold)' }}>SEM</div>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(weekData).map(([id, data]) => {
                                const rowTotal = data.dias.reduce((acc, cell) => ({
                                  camiones: acc.camiones + Number(cell.camiones || 0),
                                  tons: acc.tons + Number(cell.tonsDia || 0),
                                }), { camiones: 0, tons: 0 });
                                return (
                                  <tr key={id}>
                                    <td>
                                      <div className="harvest-week-provider" title={data.nombre}>{data.nombre}</div>
                                      <div className="harvest-week-center">{data.centro || 'Sin centro definido'}</div>
                                    </td>
                                    {data.dias.map((cell, i) => (
                                      <td key={i} style={{ textAlign: 'center' }}>
                                        {cell.camiones > 0 ? (
                                          <div className={`harvest-week-cell ${getProductClass(cell.tipoProducto)}`}>
                                            <div className="harvest-week-camiones">{formatHarvestMetric(cell.camiones, cell.tonsDia, calendarMetric)}</div>
                                            <div className="harvest-week-product">{getTipoProductoLabel(cell.tipoProducto)}</div>
                                            {cell.esDiaEspecial && (
                                              <div
                                                className="harvest-week-adjusted"
                                                title={cell.ajusteMotivo ? `Ajuste - ${cell.ajusteMotivo}` : 'Ajuste diario'}
                                              >
                                                <AlertTriangle size={10} />
                                                Ajuste
                                              </div>
                                            )}
                                            {isSanitarioRelevant(cell.sanitario) && (
                                              <div className={`harvest-week-sanitary ${getSanitarioEstado(cell.sanitario)}`}>
                                                <AlertTriangle size={11} />
                                                {getSanitarioLabel(cell.sanitario)}
                                              </div>
                                            )}
                                            {(cell.uxkg || cell.rendimiento) && (
                                              <div className="harvest-week-quality">
                                                {cell.uxkg ? <span>{fmtNumber(cell.uxkg, 1)} un/kg</span> : null}
                                                {cell.rendimiento ? <span>{fmtNumber(cell.rendimiento, 1)}%</span> : null}
                                              </div>
                                            )}
                                          </div>
                                        ) : cell.esDiaEspecial ? (
                                          <div className="harvest-week-cell is-canceled">
                                            <div className="harvest-week-camiones">Suspendido</div>
                                            <div
                                              className="harvest-week-product"
                                              title={cell.ajusteMotivo || cell.motivo || 'Ajuste diario'}
                                            >
                                              Ajuste
                                            </div>
                                          </div>
                                        ) : null}
                                      </td>
                                    ))}
                                    <td style={{ textAlign: 'center' }}>
                                      <div className="harvest-week-row-total">{formatHarvestMetric(rowTotal.camiones, rowTotal.tons, calendarMetric)}</div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="harvest-week-total-row">
                                <td>Total diario</td>
                                {weekDays.map((d) => {
                                  const summary = weekSummaries.daily[d] || { camiones: 0, tons: 0 };
                                  return (
                                    <td key={`total-${d}`} className={calendarDayToneClass(d)} style={{ textAlign: 'center' }}>
                                      <div className="harvest-week-day-total">{formatHarvestMetric(summary.camiones, summary.tons, calendarMetric)}</div>
                                    </td>
                                  );
                                })}
                                <td style={{ textAlign: 'center' }}>
                                  <div className="harvest-week-grand-total">{formatHarvestMetric(weekSummaries.total.camiones, weekSummaries.total.tons, calendarMetric)}</div>
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {calView === 'month' && (
                    <aside className="mx-card harvest-day-detail">
                      <header className="mx-card-header harvest-novelty-header">
                        <h4 className="mx-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Truck size={18} /> {selectedDay ? 'DETALLE DEL DIA' : 'RESUMEN DEL MES'}
                        </h4>
                        {selectedDay && (
                          <button className="mx-btn mx-btn-outline sm" onClick={() => setSelectedDay(null)}>
                            Ver mes
                          </button>
                        )}
                      </header>
                      {selectedDay ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ padding: '8px 12px', background: 'var(--color-bg)', borderRadius: '8px', fontSize: '12px', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: '8px' }}>
                            {new Date(selectedDay.key + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
                          </div>
                          {selectedDay.summary?.camiones > 0 && (
                            <div className="harvest-day-summary-card">
                              <div>
                                <span>Total del dia</span>
                                <strong>{formatHarvestMetric(selectedDay.summary.camiones, selectedDay.summary.tons, calendarMetric)}</strong>
                              </div>
                              <span>{selectedDay.summary.providerCount} {selectedDay.summary.providerCount === 1 ? 'proveedor' : 'proveedores'}</span>
                              <div className="harvest-day-summary-products">
                                {selectedDay.summary.products.map((product) => (
                                  <span key={product.key} className={`harvest-product-pill ${getProductClass(product.key)}`}>
                                    {getTipoProductoLabel(product.key)} - {formatHarvestMetric(product.camiones, product.tons, calendarMetric)}
                                  </span>
                                ))}
                              </div>
                              {isSanitarioRelevant(selectedDay.summary.sanitario) && (
                                <div className={`harvest-day-sanitary-alert ${getSanitarioEstado(selectedDay.summary.sanitario)}`}>
                                  <AlertTriangle size={14} />
                                  <span>
                                    {getSanitarioLabel(selectedDay.summary.sanitario)}
                                    {selectedDay.summary.sanitario?.areaPSMB ? ` - ${selectedDay.summary.sanitario.areaPSMB}` : ''}
                                    {selectedDay.summary.sanitario?.ultimoAnalisisMrsat ? ` - ${selectedDay.summary.sanitario.ultimoAnalisisMrsat}` : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                          {selectedDay.items.map((it, idx) => (
                            <div key={idx} className="mx-card" style={{ padding: '16px', boxShadow: 'none', border: '1px solid var(--color-border)' }}>
                              <div style={{ fontWeight: 'var(--weight-bold)', fontSize: '13px', marginBottom: '4px' }}>{it.proveedorNombre}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{it.centroNombre || it.centroCodigo || 'Sin centro definido'}</span>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                  <span style={{ fontSize: '20px', fontWeight: 'var(--weight-bold)', color: 'var(--color-primary)' }}>{it.camiones}</span>
                                  <span style={{ fontSize: '10px', color: 'var(--color-text-subtle)' }}>CAM</span>
                                </div>
                              </div>
                              {it.esDiaEspecial && (
                                <div className="harvest-adjust-note">
                                  {ADJUST_ACTION_LABELS[it.ajusteTipo] || 'Ajuste diario'}
                                  {it.ajusteMotivo ? ` - ${it.ajusteMotivo}` : ''}
                                  {it.motivo ? `: ${it.motivo}` : ''}
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                <span>{getTipoProductoLabel(it.tipoProducto)}</span>
                                <span>{fmtTonsInt(it.tonsDia)}</span>
                                {it.uxkg ? <span>{fmtNumber(it.uxkg, 1)} un/kg</span> : null}
                                {it.rendimiento ? <span>{fmtNumber(it.rendimiento, 1)}% rend.</span> : null}
                                {isSanitarioRelevant(it.sanitario) ? <span>{getSanitarioLabel(it.sanitario)} sanitario</span> : null}
                                {it.tipoCamion ? <span>{it.tipoCamion}</span> : null}
                                {it.maxisPorCamion ? <span>{it.maxisPorCamion} maxis/camion</span> : null}
                                {it.motivo ? <span>{it.motivo}</span> : null}
                              </div>
                              <button
                                type="button"
                                className="mx-btn mx-btn-outline sm harvest-adjust-btn"
                                onClick={() => handleOpenAdjustModal(programasById.get(String(it.programaId)), selectedDay.key, it.camiones)}
                              >
                                Ajustar dia
                              </button>
                            </div>
                          ))}
                          {selectedDay.items.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                              <Activity size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                              <p>Sin despachos programados.</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="harvest-month-summary">
                          <div className="harvest-month-total-card">
                            <span>{mesLabel(mes, true)}</span>
                            <strong>{formatHarvestMetric(monthSummary.total.camiones, monthSummary.total.tons, calendarMetric)}</strong>
                            <small>{monthSummary.total.days} dias con cosecha</small>
                          </div>

                          <section className="harvest-month-section">
                            <h5>Por proveedor</h5>
                            {monthSummary.providers.length ? monthSummary.providers.map((provider) => (
                              <div key={provider.nombre} className="harvest-month-row">
                                <div>
                                  <strong>{provider.nombre}</strong>
                                  <span>{provider.centro}</span>
                                </div>
                                <b>{formatHarvestMetric(provider.camiones, provider.tons, calendarMetric)}</b>
                              </div>
                            )) : (
                              <div className="harvest-month-empty">Sin cosechas programadas en el mes.</div>
                            )}
                          </section>

                          <section className="harvest-month-section">
                            <h5>Por producto</h5>
                            <div className="harvest-month-products">
                              {monthSummary.products.map((product) => (
                                <span key={product.key} className={`harvest-product-pill ${getProductClass(product.key)}`}>
                                  {getTipoProductoLabel(product.key)} - {formatHarvestMetric(product.camiones, product.tons, calendarMetric)}
                                </span>
                              ))}
                              {!monthSummary.products.length && <span className="harvest-month-empty">Sin productos definidos.</span>}
                            </div>
                          </section>

                          {monthSummary.sanitaryAlerts.length > 0 && (
                            <section className="harvest-month-section">
                              <h5>Alertas sanitarias</h5>
                              {monthSummary.sanitaryAlerts.slice(0, 4).map((alert, idx) => (
                                <div key={`${alert?.areaPSMB || idx}-${idx}`} className={`harvest-day-sanitary-alert ${getSanitarioEstado(alert)}`}>
                                  <AlertTriangle size={14} />
                                  <span>
                                    {getSanitarioLabel(alert)}
                                    {alert?.areaPSMB ? ` - ${alert.areaPSMB}` : ''}
                                    {alert?.ultimoAnalisisMrsat ? ` - ${alert.ultimoAnalisisMrsat}` : ''}
                                  </span>
                                </div>
                              ))}
                            </section>
                          )}

                          <div className="harvest-month-hint">
                            Selecciona un dia del calendario para ver el desglose operativo diario.
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
                            ? `Semana ${new Date(weekDays[0] + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}`
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
                            <span>{new Date(ajuste.fecha).toLocaleDateString('es-CL')} - {ADJUST_ACTION_LABELS[ajuste.accion] || 'Ajuste diario'}</span>
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
          {isMuestreosView && <Muestreos />}
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
                  <span>{adjustProgram?.centroNombre || 'Sin centro definido'} - base {adjustProgram?.camionesDefault || 0} cam/dia</span>
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

      {/* MODAL PROGRAMA (Stage 3 Refactor) */}
      {showModal && (
        <div className="mx-modal-overlay">
          <div className="mx-modal" style={{ maxWidth: '600px' }}>
            <div className="mx-modal-header">
              <h2>{editingId ? 'Editar Programa' : 'Nuevo Programa de Cosecha'}</h2>
              <button className="mx-btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="mx-form">
              <div className="mx-modal-body">
                <div className="mx-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="mx-form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="mx-label">Proveedor / Trato Acordado</label>
                    <select 
                      className="mx-select" 
                      value={formData.tratoId} 
                      onChange={(e) => {
                        const t = tratosAcordados.find(x => x._id === e.target.value);
                        setFormData({
                          ...formData,
                          tratoId: e.target.value,
                          vigenciaDesde: t?.vigenciaDesde?.split('T')[0] || formData.vigenciaDesde,
                          vigenciaHasta: t?.vigenciaHasta?.split('T')[0] || formData.vigenciaHasta,
                          camionesDefault: t?.camionesXDia || formData.camionesDefault,
                          tonsEstimadas: t?.tonsAcordadas || formData.tonsEstimadas,
                          tipoProducto: t?.tipoProducto || t?.tipoProductoSugerido || formData.tipoProducto || 'sin_definir'
                        });
                      }}
                      required
                    >
                      <option value="">— Seleccionar trato acordado —</option>
                      {tratosAcordados.map(t => (
                        <option key={t._id} value={t._id}>{t.proveedorNombre} — {t.tonsAcordadas}T ({t.centroCodigo || t.centroNombre || 'Sin centro'})</option>
                      ))}
                    </select>
                  </div>
                  <div className="mx-form-group">
                    <label className="mx-label">Desde</label>
                    <input type="date" className="mx-input" value={formData.vigenciaDesde} onChange={e => setFormData({...formData, vigenciaDesde: e.target.value})} required />
                  </div>
                  <div className="mx-form-group">
                    <label className="mx-label">Hasta</label>
                    <input type="date" className="mx-input" value={formData.vigenciaHasta} onChange={e => setFormData({...formData, vigenciaHasta: e.target.value})} required />
                  </div>
                  <div className="mx-form-group">
                    <label className="mx-label">Camiones / día</label>
                    <input type="number" className="mx-input" value={formData.camionesDefault} onChange={e => setFormData({...formData, camionesDefault: e.target.value})} min="0" required />
                  </div>
                  <div className="mx-form-group">
                    <label className="mx-label">Tons estimadas</label>
                    <input type="number" className="mx-input" value={formData.tonsEstimadas} onChange={e => setFormData({...formData, tonsEstimadas: e.target.value})} />
                  </div>
                  <div className="mx-form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="mx-label">Tipo de producto</label>
                    <select
                      className="mx-select"
                      value={formData.tipoProducto}
                      onChange={e => setFormData({...formData, tipoProducto: e.target.value})}
                    >
                      <option value="sin_definir">Sin definir</option>
                      <option value="entero">Entero</option>
                      <option value="carne">Carne</option>
                      <option value="mc">MC</option>
                    </select>
                  </div>
                  <div className="mx-form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="mx-label">Días de Cosecha</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((d, i) => (
                        <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', background: formData.diasSemana.includes(i) ? 'var(--color-primary-light, #f0fdfa)' : 'white', borderColor: formData.diasSemana.includes(i) ? 'var(--color-primary)' : 'var(--color-border)' }}>
                          <input 
                            type="checkbox" 
                            style={{ display: 'none' }}
                            checked={formData.diasSemana.includes(i)}
                            onChange={() => {
                              const next = formData.diasSemana.includes(i) 
                                ? formData.diasSemana.filter(x => x !== i)
                                : [...formData.diasSemana, i];
                              setFormData({...formData, diasSemana: next});
                            }}
                          />
                          {d}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="mx-form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="mx-label">Notas / Observaciones</label>
                    <textarea className="mx-textarea" value={formData.notas} onChange={e => setFormData({...formData, notas: e.target.value})} rows="2" />
                  </div>
                </div>
              </div>
              <div className="mx-modal-footer">
                <button type="button" className="mx-btn mx-btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="mx-btn mx-btn-primary">
                  <CheckCircle2 size={18} /> {editingId ? 'Guardar Cambios' : 'Crear Programa'}
                </button>
              </div>
            </form>
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
    </div>
  );
}
