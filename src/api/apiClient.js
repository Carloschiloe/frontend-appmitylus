/**
 * Mitynex API Client
 * Capa de abstracción sobre fetch para manejar peticiones HTTP, 
 * errores, interceptores y configuración de manera centralizada.
 */

const API_BASE_URL = '/api'; // Base centralizada para todas las peticiones

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
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = localStorage.getItem('ammpp_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Soporte Multi-tenant para SuperAdmin: Inyectar DB seleccionada si existe
  const tenantDb = localStorage.getItem('selected_tenant_db');
  if (tenantDb) {
    headers['x-tenant-db'] = tenantDb;
  }

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, config);

    // Interceptar 401: sesión expirada → redirigir a login
    if (response.status === 401) {
      // Evitar loop: solo redirigir si NO estamos ya en /login o /auth
      if (!endpoint.startsWith('/auth/')) {
        localStorage.removeItem('ammpp_token');
        localStorage.removeItem('ammpp_user');
        window.location.href = '/login';
        throw new ApiError('Sesión expirada', 401);
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
      throw new ApiError(data?.error || data?.message || 'Error en la petición', response.status, data);
    }

    return data;
  } catch (error) {
    // AbortError es normal (cleanup de useEffect en React StrictMode)
    if (error.name !== 'AbortError') {
      console.error(`[API Client Error] ${options.method || 'GET'} ${url}`, error);
    }
    throw error;
  }
}

export const apiClient = {
  get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PUT', body }),
  patch: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PATCH', body }),
  delete: (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' }),
};
