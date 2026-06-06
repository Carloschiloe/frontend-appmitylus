// Cálculos y formateo de programas de cosecha.
// Importa helpers de fecha y producto; no tiene estado React.

import {
  toChileDateKey,
  compareDateKeys,
  addDaysToKey,
  dayOfWeekFromKey,
  minDateKey,
  maxDateKey,
  countWorkingDaysFE,
} from './fechasChile';
import { getPreferredTipoProducto } from './productoLabels';

// ── Formateo numérico ────────────────────────────────────────────────────────

export const fmtTons = (n) => (Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' t';
export const fmtTonsInt = (n) => (Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 }) + ' t';
export const fmtNumber = (n, digits = 1) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: digits });

// Lee un número desde el primer alias presente; soporta strings con coma decimal.
const pickNum = (obj, aliases) => {
  for (const k of aliases) {
    const raw = obj?.[k];
    if (raw === undefined || raw === null || raw === '') continue;
    const n = typeof raw === 'string' ? Number(raw.replace(',', '.')) : Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
};

// Toneladas por camión de un tipo de transporte (maestro): maxis/unidad * kg/maxi ref / 1000.
// Soporta variantes de nombre de campo. Devuelve null si los datos no permiten calcular
// (nunca cae a un valor por defecto como 11).
export const tonsPorCamionDeTipo = (tipo) => {
  const maxis = pickNum(tipo, ['maxisPorUnidad', 'maxisUnidad', 'maxisUn', 'maxis']);
  const kg = pickNum(tipo, ['kgPorMaxiRef', 'kgMaxiRef', 'kgPorMaxi', 'kgRef']);
  if (!Number.isFinite(maxis) || !Number.isFinite(kg) || maxis <= 0 || kg <= 0) return null;
  return (maxis * kg) / 1000;
};

// Total de referencia en kg de un tipo de transporte (maxis * kg/maxi). null si no calcula.
export const kgRefDeTipo = (tipo) => {
  const t = tonsPorCamionDeTipo(tipo);
  return t == null ? null : t * 1000;
};

// Fecha del último muestreo. mode 'short' -> DD-MM, 'long' -> DD-MM-YYYY. null si no hay.
export const formatMuestreoFecha = (fecha, mode = 'short') => {
  if (!fecha) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha));
  if (!m) return null;
  const [, yyyy, mm, dd] = m;
  return mode === 'long' ? `${dd}-${mm}-${yyyy}` : `${dd}-${mm}`;
};

// Resumen del último muestreo (un/kg · rendimiento). Devuelve null si no hay dato válido.
export const formatMuestreoResumen = (item) => {
  const uxkgNum = Number(item?.uxkg);
  const rendNum = Number(item?.rendimiento);
  const hasUxkg = Number.isFinite(uxkgNum) && uxkgNum > 0;
  const hasRend = Number.isFinite(rendNum) && rendNum > 0;
  if (!hasUxkg && !hasRend) return null;
  const parts = [];
  if (hasUxkg) parts.push(`${Math.round(uxkgNum)} un/kg`);
  if (hasRend) parts.push(`Rend. ${fmtNumber(rendNum, 1)}%`);
  return parts.join(' · ');
};

export const calcTotalToneladasDia = (transportes = []) =>
  (transportes || []).reduce((s, t) => s + (Number(t.cantidadDia) || 0) * (Number(t.toneladasPorCamion) || 0), 0);

export const asText = (value, fallback = '') => {
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

// ── Ajustes diarios ─────────────────────────────────────────────────────────

export const ADJUST_ACTION_LABELS = {
  sumar: 'Sumar camion',
  suspender: 'Suspender camion',
  set_total: 'Cambiar total del dia',
  suspender_dia: 'Suspender dia completo',
};

export const ADJUST_MOTIVOS = ['Planta', 'Clima', 'Transporte', 'Proveedor', 'Sanitario', 'Calidad', 'Comercial', 'Otro'];

export const formatDailyAdjustmentText = (ajuste) => {
  if (!ajuste) return '';
  const fecha = ajuste.fecha
    ? new Date(ajuste.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', timeZone: 'America/Santiago' })
    : '';
  const action = ADJUST_ACTION_LABELS[ajuste.accion] || 'Ajuste diario';
  const before = Number(ajuste.camionesAntes || 0);
  const after = Number(ajuste.camionesDespues || 0);
  const motivo = ajuste.motivo ? ` por ${ajuste.motivo}` : '';
  const nota = ajuste.nota ? `: ${ajuste.nota}` : '';
  return `${fecha ? `${fecha} - ` : ''}${action}${motivo}. ${before} -> ${after} cam${nota}`;
};

// ── Estado sanitario ─────────────────────────────────────────────────────────

export const SANITARIO_ORDER = { rojo: 4, naranja: 3, amarillo: 2, verde: 1, gris: 0 };

export const SANITARIO_LABELS = {
  rojo: 'Bloqueada',
  naranja: 'Alerta',
  amarillo: 'Observacion',
  verde: 'OK',
  gris: 'Sin datos',
};

export const SEGUIMIENTO_LABELS = {
  en_plan:      { label: 'En plan',       cls: 'success' },
  con_retrasos: { label: 'Con retrasos',  cls: 'warning' },
  detenido:     { label: 'Detenido',      cls: 'danger'  },
};

export const getSanitarioEstado = (value) => String(value?.estado || value || 'gris').toLowerCase();
export const getSanitarioLabel = (value) => value?.label || SANITARIO_LABELS[getSanitarioEstado(value)] || 'Sin datos';
export const isSanitarioRelevant = (value) => {
  const estado = getSanitarioEstado(value);
  return Boolean(value) && estado !== 'gris' && (estado !== 'verde' || value?.hasObservaciones);
};

// ── Resumen de cosecha ────────────────────────────────────────────────────────

export const summarizeHarvestItems = (items = []) => {
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

export const formatHarvestMetric = (camiones = 0, tons = 0, metric = 'both') => {
  if (metric === 'camiones') return `${Number(camiones || 0)} cam`;
  if (metric === 'tons') return fmtTonsInt(tons);
  return `${Number(camiones || 0)} cam · ${fmtTonsInt(tons)}`;
};

export const getHarvestMetricKpi = (camiones = 0, tons = 0, metric = 'both') => {
  const tonsValue = Number(tons || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
  const camionesValue = Number(camiones || 0);
  if (metric === 'camiones') return { value: camionesValue, unit: 'cam', note: null };
  if (metric === 'tons') return { value: tonsValue, unit: 't', note: null };
  return { value: tonsValue, unit: 't', note: `${camionesValue} cam` };
};

// ── Progreso de volumen del programa ─────────────────────────────────────────

export const getProgramVolumeProgress = (programa, tonsPerTruck = 0, until = new Date()) => {
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

// ── Término estimado del programa ─────────────────────────────────────────────

export const calcTerminoProgramaISO = (vigenciaDesde, tonsEstimadas, transportes, diasSemana) => {
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
};

export const calcTerminoPrograma = (vigenciaDesde, tonsEstimadas, transportes, diasSemana) => {
  const iso = calcTerminoProgramaISO(vigenciaDesde, tonsEstimadas, transportes, diasSemana);
  if (!iso) return null;
  const [y, mm, dd] = iso.split('-');
  return `${dd}-${mm}-${y}`;
};

// ── Tons por camión efectivo ──────────────────────────────────────────────────

export const getEffectiveTonsPerTruck = (programa, fallback = 11) => {
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
