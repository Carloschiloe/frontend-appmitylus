import { clearRuntimeLayoutState, clearSessionCache } from '../context/authSession.helpers';
import { captureApiError } from '../utils/errorReporter.js';

const API_BASE_URL = '/api';
const DEFAULT_TIMEOUT_MS = 30000;
// Subidas de archivos (fotos de muestreo) pueden tardar más en conexiones lentas
const UPLOAD_TIMEOUT_MS = 120000;

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
  const isAuthEndpoint = endpoint.startsWith('/auth/');
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  };

  const tenantDb = localStorage.getItem('selected_tenant_db');
  if (tenantDb && !isAuthEndpoint) {
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

      if (!isPublicPath) {
        clearSessionCache({ clearTenant: true });
        clearRuntimeLayoutState();
        window.location.href = '/login';
        throw new ApiError('Sesion expirada', 401);
      }
    }

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const apiError = new ApiError(data?.error || data?.message || 'Error en la peticion', response.status, data);
      apiError.endpoint = endpoint;
      apiError.method = options.method || 'GET';
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
