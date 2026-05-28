// Utilidades de fecha en zona horaria Chile (America/Santiago).
// Todas las funciones son puras — sin estado, sin efectos.

export const CHILE_TIME_ZONE = 'America/Santiago';

export const chileDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CHILE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const toChileDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = chileDateFormatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const todayKey = () => toDateKey(new Date());

export const compareDateKeys = (a, b) => String(a || '').localeCompare(String(b || ''));
export const minDateKey = (...keys) => keys.filter(Boolean).sort()[0] || '';
export const maxDateKey = (...keys) => keys.filter(Boolean).sort().at(-1) || '';

export const addDaysToKey = (key, days = 1) => {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const dayOfWeekFromKey = (key) => new Date(`${key}T12:00:00Z`).getUTCDay();

export const getISOWeek = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00Z');
  const thu = new Date(d);
  thu.setUTCDate(d.getUTCDate() + (4 - (d.getUTCDay() || 7)));
  const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1));
  return Math.ceil((((thu - yearStart) / 86400000) + 1) / 7);
};

export const getEasterDate = (year) => {
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

export const getChileHolidayKeys = (year) => {
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

export const isSundayKey = (dateKey) => new Date(`${dateKey}T00:00:00`).getDay() === 0;

export const isChileHolidayKey = (dateKey) => {
  const year = Number(String(dateKey).slice(0, 4));
  return Number.isFinite(year) && getChileHolidayKeys(year).has(dateKey);
};

export const calendarDayToneClass = (dateKey) => (
  isSundayKey(dateKey) || isChileHolidayKey(dateKey) ? 'calendar-red-day' : ''
);

export const mesActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const finMes = (mk) => {
  const [y, m] = String(mk || '').split('-').map(Number);
  if (!y || !m) return '';
  const day = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const mesLabel = (mk = '', largo = false) => {
  if (!mk) return '—';
  const LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const [y, m] = mk.split('-');
  const idx = parseInt(m, 10) - 1;
  return largo ? `${LARGO[idx]} ${y}` : `${LARGO[idx].slice(0, 3)} ${y}`;
};

export const MONTHS_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

export const fmtDateShort = (val) => {
  if (!val) return '-';
  const key = typeof val === 'string' ? val.slice(0, 10) : new Date(val).toISOString().slice(0, 10);
  const [, m, d] = key.split('-');
  return `${d}-${MONTHS_SHORT[parseInt(m, 10) - 1]}`;
};

export const daysUntilKey = (hastaKey) => {
  if (!hastaKey) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(`${hastaKey}T00:00:00`);
  return Math.round((end - now) / (1000 * 60 * 60 * 24));
};

export const countWorkingDaysFE = (fromKey, toKey, diasSemana) => {
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
