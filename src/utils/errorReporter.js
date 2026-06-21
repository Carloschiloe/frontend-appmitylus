import { readCachedUser } from '../context/authSession.helpers.js';
import { getLastActions } from './actionTrail.js';

const REPORT_ENDPOINT = '/api/support/error-reports';
const recentFingerprints = new Map();

const MODULE_BY_PATH = [
  ['/biomasa', 'biomasa'],
  ['/gestion/bandeja', 'resumen_operativo'],
  ['/gestion/agenda', 'agenda'],
  ['/biomasa/tratos', 'tratos'],
  ['/gestion/proveedores', 'directorio'],
  ['/gestion/soporte/errores', 'soporte'],
  ['/centros', 'centros'],
  ['/historial', 'historial'],
  ['/configuracion', 'configuracion'],
  ['/dashboard', 'dashboard'],
];

function detectModule(pathname = '') {
  const found = MODULE_BY_PATH.find(([prefix]) => pathname.startsWith(prefix));
  return found?.[1] || 'general';
}

function detectBrowser(userAgent = '') {
  if (/edg/i.test(userAgent)) return 'Edge';
  if (/chrome|crios/i.test(userAgent)) return 'Chrome';
  if (/safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent)) return 'Safari';
  if (/firefox/i.test(userAgent)) return 'Firefox';
  return 'Desconocido';
}

function detectDevice(userAgent = '') {
  if (/ipad|tablet/i.test(userAgent)) return 'tablet';
  if (/mobile|iphone|android/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

function sanitizeSnapshot(value, depth = 0) {
  if (value == null) return value;
  if (depth > 4) return '[Max depth]';
  if (typeof value === 'string') return value.length > 2000 ? `${value.slice(0, 2000)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitizeSnapshot(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 50).map(([key, item]) => {
      if (/(password|token|secret|authorization|cookie|api-key|apikey|api_key)/i.test(key)) return [key, '[REDACTED]'];
      return [key, sanitizeSnapshot(item, depth + 1)];
    }));
  }
  return String(value);
}

function errorToText(error) {
  if (!error) return 'Error desconocido';
  if (typeof error === 'string') return error;
  return error.message || error.reason?.message || String(error);
}

function stackFrom(error) {
  return error?.stack || error?.reason?.stack || error?.error?.stack || '';
}

function shouldThrottle(payload) {
  const key = [
    payload.source,
    payload.module,
    payload.route,
    payload.endpoint,
    payload.frontendError,
    payload.httpStatus,
  ].filter(Boolean).join('|');
  const now = Date.now();
  const last = recentFingerprints.get(key) || 0;
  recentFingerprints.set(key, now);
  return now - last < 10000;
}

export function getClientContext(extra = {}) {
  const userAgent = navigator.userAgent || '';
  const route = window.location.pathname;
  const cachedUser = readCachedUser();
  return {
    route,
    url: window.location.href,
    module: detectModule(route),
    userAgent,
    browser: detectBrowser(userAgent),
    device: detectDevice(userAgent),
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    appVersion: import.meta.env?.VITE_APP_VERSION || '',
    userName: cachedUser?.nombre,
    userEmail: cachedUser?.email,
    userId: cachedUser?._id || cachedUser?.id,
    lastActions: getLastActions(),
    ...extra,
  };
}

function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function sendReport(payload) {
  if (shouldThrottle(payload)) return { throttled: true };
  try {
    const csrfToken = getCsrfToken();
    const response = await fetch(REPORT_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      body: JSON.stringify(sanitizeSnapshot(payload)),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.errorCode) {
      try {
        const stored = JSON.parse(localStorage.getItem('mitynex_my_reports') || '[]');
        if (!stored.includes(data.errorCode)) {
          stored.push(data.errorCode);
          localStorage.setItem('mitynex_my_reports', JSON.stringify(stored.slice(-10)));
        }
      } catch { /* localStorage no disponible */ }
    }
    return data;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[Mitynex error reporter] No se pudo enviar reporte', err);
    return { ok: false, error: err.message };
  }
}

export function reportManualError(data = {}) {
  return sendReport({
    ...getClientContext(),
    ...data,
    source: 'manual',
    severity: data.severity || 'medium',
  });
}

export function reportFrontendError(error, context = {}) {
  const payload = {
    ...getClientContext(context),
    source: 'frontend_auto',
    severity: context.severity || 'high',
    title: context.title || errorToText(error),
    frontendError: errorToText(error),
    stack: stackFrom(error),
  };
  return sendReport(payload);
}

export function captureApiError(error, context = {}) {
  if (context.endpoint?.startsWith('/support/error-reports')) return Promise.resolve({ skipped: true });
  const status = error?.status || context.httpStatus;
  const severity = status >= 500 || !status ? 'high' : status >= 400 ? 'medium' : 'low';
  return sendReport({
    ...getClientContext(context),
    source: 'frontend_auto',
    severity,
    title: `Error API ${context.method || 'GET'} ${context.endpoint || ''}`.trim(),
    frontendError: errorToText(error),
    endpoint: context.endpoint,
    method: context.method,
    httpStatus: status,
    payloadSnapshot: context.payloadSnapshot,
    responseSnapshot: error?.data || context.responseSnapshot,
  });
}

export function installGlobalErrorCapture() {
  if (typeof window === 'undefined' || window.__mitynexErrorCaptureInstalled) return;
  window.__mitynexErrorCaptureInstalled = true;

  window.addEventListener('error', (event) => {
    reportFrontendError(event.error || event.message, {
      title: event.message,
      route: window.location.pathname,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportFrontendError(event.reason || 'Promise rejection no controlada', {
      title: 'Promise rejection no controlada',
      route: window.location.pathname,
    });
  });
}
