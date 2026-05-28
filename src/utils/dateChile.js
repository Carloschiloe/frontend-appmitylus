/**
 * dateChile.js — Política central de fechas para Mitynex (frontend)
 *
 * Zona horaria de negocio: America/Santiago (CLT UTC-4 / CLST UTC-3)
 *
 * REGLAS:
 *  1. Fechas operativas viajan como string YYYY-MM-DD o ISO UTC.
 *  2. Para mostrar en UI siempre usar formatDateChile / formatDateShort — incluyen
 *     timeZone explícito. NUNCA usar toLocaleDateString sin timeZone.
 *  3. Para inputs type="date" usar toDateInputValue() — extrae YYYY-MM-DD en zona Chile.
 *  4. Para enviar al backend desde un input, enviar el YYYY-MM-DD directamente
 *     (o toISOFromDateInput() si el backend necesita ISO). NUNCA new Date(input).toISOString().
 *  5. Para construir un Date desde YYYY-MM-DD usar parseLocalDate() — mediodía local.
 *     NUNCA new Date("YYYY-MM-DD") — lo interpreta como UTC midnight y en Chile
 *     los métodos locales devuelven el día anterior.
 */

export const APP_TZ = 'America/Santiago';

// en-CA produce "YYYY-MM-DD" directamente — más fiable que manipular partes.
const _keyFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// ── Claves de fecha (YYYY-MM-DD) ─────────────────────────────────────────────

/** Hoy como "YYYY-MM-DD" en zona America/Santiago. */
export function todayChile() {
  return _keyFmt.format(new Date());
}

/**
 * Cualquier Date o ISO string → "YYYY-MM-DD" en zona America/Santiago.
 * Seguro para fechas UTC midnight que vienen de MongoDB:
 *   "2026-05-25T00:00:00.000Z" → "2026-05-25" (no "2026-05-24").
 */
export function toChileDateKey(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return _keyFmt.format(d);
}

/**
 * Para inputs type="date": Date/ISO → "YYYY-MM-DD" en zona Chile.
 * Reemplaza el patrón buggy: new Date(v).getDate() (usa zona local, no Chile).
 */
export function toDateInputValue(value) {
  return toChileDateKey(value);
}

/**
 * "YYYY-MM-DD" (de un input[type=date]) → ISO en UTC noon.
 * UTC noon = nunca cambia de día por DST en ninguna zona horaria.
 * Reemplaza: new Date(`${value}T09:00:00`).toISOString() (frágil, depende de zona del browser).
 */
export function toISOFromDateInput(value) {
  if (!value || String(value).length < 10) return '';
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toISOString();
}

/**
 * "YYYY-MM-DD" → Date al mediodía LOCAL. Para aritmética JS (cálculo de días, semanas…).
 * Mediodía local evita problemas de DST al usar setDate/getDate.
 * Reemplaza: new Date("YYYY-MM-DD") — UTC midnight que da día anterior con métodos locales.
 */
export function parseLocalDate(str) {
  if (!str) return null;
  const s = String(str).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
}

// ── Formateadores de display ──────────────────────────────────────────────────

const _short = new Intl.DateTimeFormat('es-CL', {
  timeZone: APP_TZ,
  day: '2-digit',
  month: 'short',
});

const _shortYear = new Intl.DateTimeFormat('es-CL', {
  timeZone: APP_TZ,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const _long = new Intl.DateTimeFormat('es-CL', {
  timeZone: APP_TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const _withTime = new Intl.DateTimeFormat('es-CL', {
  timeZone: APP_TZ,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "25 may" — sin año. */
export function formatDateShort(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return _short.format(d);
}

/** "25 may 2026" */
export function formatDateChile(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return _shortYear.format(d);
}

/** "lunes, 25 de mayo de 2026" */
export function formatDateChileLong(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return _long.format(d);
}

/** "25 may 2026, 09:30" */
export function formatDateTimeChile(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return _withTime.format(d);
}

// ── Cálculos de tiempo ────────────────────────────────────────────────────────

/**
 * Días desde value hasta hoy en zona Chile.
 * >0 = pasado, 0 = hoy, <0 = futuro.
 * Reemplaza: new Date(v).getDate() sin zona — devuelve día anterior en Chile.
 */
export function daysAgoChile(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return null;
  const today  = todayChile();
  const target = toChileDateKey(d);
  if (!target) return null;
  const [ty, tm, td] = today.split('-').map(Number);
  const [ky, km, kd] = target.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(ky, km - 1, kd)) / 86400000);
}
