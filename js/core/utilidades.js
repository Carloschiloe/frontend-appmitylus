export function parseOneDMS(str) {
  const re = /^\s*([NSOWE])\s*(\d+)[°º]\s*(\d+)[''´]\s*(\d+(?:\.\d+)?)\s*$/i;
  const m = str.match(re);
  if (!m) return NaN;
  let hemi = m[1].toUpperCase(), deg = +m[2], min = +m[3], sec = +m[4];
  let dec = deg + min/60 + sec/3600;
  if (hemi === 'S' || hemi === 'W' || hemi === 'O') dec = -dec;
  return dec;
}

typeof window !== 'undefined' && (window.parseOneDMS = parseOneDMS);

// Helpers compartidos

/** Convierte un nombre/clave a slug lowercase-con-guiones sin acentos. */
export function slug(s = '') {
  return String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

/** Rellena con cero a la izquierda hasta 2 digitos. */
export const pad2 = (n) => String(Number(n) || 0).padStart(2, '0');

// Helpers de fechas/claves

/** Calcula semana ISO {year, week} de una fecha. */
export function isoWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const y = d.getFullYear();
  const start = new Date(y, 0, 4);
  start.setDate(start.getDate() + 4 - (start.getDay() || 7));
  const week = 1 + Math.round((d - start) / 604800000);
  return { year: y, week };
}

/** Devuelve 'YYYY-W##' para una fecha dada. */
export function weekKeyFromDate(dt) {
  if (!dt) return '';
  const { year, week } = isoWeek(dt);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Devuelve 'YYYY-MM' para una fecha dada. */
export function monthKeyFromDate(dt) {
  if (!dt) return '';
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}`;
}

/** Devuelve la clave de semana ISO actual ('YYYY-W##'). */
export function getCurrentWeekKey() {
  return weekKeyFromDate(new Date());
}

/** Devuelve la clave de mes actual ('YYYY-MM'). */
export function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}
