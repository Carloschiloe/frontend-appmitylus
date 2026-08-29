import { clearRuntimeLayoutState, clearSessionCache } from '../context/authSession.helpers';
import { captureApiError } from '../utils/errorReporter.js';

const API_BASE_URL = '/api';
const DEFAULT_TIMEOUT_MS = 30000;

const CSRF_MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// Rutas que establecen la sesión — no tienen cookie CSRF todavía
const CSRF_SKIP_PATHS = new Set(['/auth/login', '/auth/refresh', '/auth/activar-cuenta', '/auth/2fa/verify']);

export function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
// Subidas de archivos (fotos de muestreo) pueden tardar más en conexiones lentas
const UPLOAD_TIMEOUT_MS = 120000;

// Serializa múltiples 401 simultáneos: solo un refresh se ejecuta a la vez.
// Las demás peticiones esperan la misma promesa y luego reintentan.
let _refreshPromise = null;

async function attemptRefresh() {
  if (_refreshPromise) return _refreshPromise;
  const doFetch = async () => {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 10000);
    try {
      const r = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
        signal: ctrl.signal,
      });
      return r.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(tid);
    }
  };
  _refreshPromise = doFetch().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const isFormData = options.body instanceof FormData;

  const method = (options.method || 'GET').toUpperCase();

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  };

  if (CSRF_MUTATION_METHODS.has(method) && !CSRF_SKIP_PATHS.has(endpoint)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  }

  const tenantDb = localStorage.getItem('selected_tenant_db');
  if (tenantDb && !CSRF_SKIP_PATHS.has(endpoint)) {
    headers['x-tenant-db'] = tenantDb;
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? (isFormData ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const config = {
    ...options,
    headers,
    credentials: 'include',
    signal: controller.signal,
  };

  if (config.body && typeof config.body === 'object' && !isFormData) {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, config);

    if (response.status === 401) {
      const isPublicPath = endpoint.startsWith('/auth/') || endpoint.startsWith('/public/');
      // /auth/me es la excepcion dentro de "rutas de auth": a diferencia de
      // login/refresh/activar-cuenta (que nunca requieren sesion previa), SI
      // es una ruta protegida — se llama al bootear la app para saber quien
      // es el usuario. Sin este caso especial quedaba categorizada como
      // "publica" y nunca se beneficiaba del refresh-y-reintento: un
      // accessToken vencido en ese instante (algo normal, se renueva solo)
      // hacia que AuthContext deslogueara al usuario en el cliente (setUser
      // null) en vez de renovar el token en silencio, como si pasa con
      // cualquier otra llamada protegida.
      const isSelfCheck = endpoint === '/auth/me';

      if (!isPublicPath || isSelfCheck) {
        if (!options._retry) {
          const refreshed = await attemptRefresh();
          if (refreshed) {
            return request(endpoint, { ...options, _retry: true });
          }
        }
        // /auth/me sin sesion real (visitante anonimo, o refresh token
        // tambien vencido) NO debe forzar un redirect duro: AuthProvider
        // envuelve tambien /login y /activar-cuenta, asi que esto se
        // ejecuta ahi tambien — un redirect aca recargaria /login de forma
        // innecesaria para cualquier visitante sin sesion. Se deja caer al
        // manejo normal de abajo (throw ApiError 401), que AuthContext ya
        // captura para simplemente marcar user:null sin navegar.
        if (!isSelfCheck) {
          clearSessionCache({ clearTenant: true });
          clearRuntimeLayoutState();
          window.location.href = '/login';
          throw new ApiError('Sesion expirada', 401);
        }
      }
    }

    let data;
    const contentType = response.headers.get('content-type');
    if (options.responseType === 'blob') {
      data = await response.blob();
    } else if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const apiError = new ApiError(data?.error || data?.message || 'Error en la peticion', response.status, data);
      apiError.endpoint = endpoint;
      apiError.method = options.method || 'GET';
      if (response.status === 429) {
        // Segundos hasta que el rate-limiter libere la ventana (express-rate-limit
        // ya lo entrega con standardHeaders:true) — permite a un poller esperar
        // el tiempo real en vez de reintentar a ciegas en su próximo tick fijo.
        const retryAfterHeader = response.headers.get('Retry-After');
        const parsed = Number(retryAfterHeader);
        if (Number.isFinite(parsed) && parsed > 0) apiError.retryAfterSeconds = parsed;
      }
      throw apiError;
    }

    return data;
  } catch (error) {
    const isExpectedBootstrapAuthFailure =
      (endpoint === '/auth/me' && (error?.status === 401 || error?.status === 500)) ||
      // refresh devuelve 401 cuando no hay sesión válida (no logueado / token expirado): es esperado
      (endpoint === '/auth/refresh' && error?.status === 401);

    if (error.name !== 'AbortError' && !isExpectedBootstrapAuthFailure) {
      // eslint-disable-next-line no-console
      console.error(`[API Client Error] ${options.method || 'GET'} ${url}`, error);
      if (!endpoint.startsWith('/support/error-reports')) {
        captureApiError(error, {
          endpoint,
          method: options.method || 'GET',
          httpStatus: error.status,
          payloadSnapshot: isFormData ? '[FormData]' : options.body,
          responseSnapshot: error.data,
        });
      }
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const apiClient = {
  get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PUT', body }),
  patch: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PATCH', body }),
  delete: (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' }),
};
