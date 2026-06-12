import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../context/authSession.helpers', () => ({
  clearRuntimeLayoutState: vi.fn(),
  clearSessionCache: vi.fn(),
}));

vi.mock('../utils/errorReporter.js', () => ({
  captureApiError: vi.fn(),
}));

import { clearSessionCache, clearRuntimeLayoutState } from '../context/authSession.helpers';
import { captureApiError } from '../utils/errorReporter.js';
import { apiClient } from '../api/apiClient';

// ── helpers ───────────────────────────────────────────────────────────────────

const okJson = (body) => ({
  status: 200,
  ok: true,
  headers: { get: () => 'application/json' },
  json: async () => body,
});

const errJson = (status, body = {}) => ({
  status,
  ok: false,
  headers: { get: () => 'application/json' },
  json: async () => body,
});

const okRefresh = () => okJson({ ok: true });

// ── setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.stubGlobal('location', { href: '' });
});

// ── suite ─────────────────────────────────────────────────────────────────────

describe('apiClient — request normal', () => {
  it('devuelve datos en respuesta 200', async () => {
    global.fetch = vi.fn().mockResolvedValue(okJson({ items: [1, 2] }));
    const data = await apiClient.get('/datos');
    expect(data).toEqual({ items: [1, 2] });
  });
});

describe('apiClient — refresh silencioso en 401', () => {
  it('intenta refresh y reintenta el request original si el refresh es exitoso', async () => {
    let initialDone = false;
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/auth/refresh')) return Promise.resolve(okRefresh());
      if (!initialDone) {
        initialDone = true;
        return Promise.resolve(errJson(401, { error: 'Unauthorized' }));
      }
      return Promise.resolve(okJson({ ok: true, items: [] }));
    });

    const data = await apiClient.get('/datos');
    expect(data).toEqual({ ok: true, items: [] });
    const refreshCalls = global.fetch.mock.calls.filter(([u]) => u.includes('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
    expect(clearSessionCache).not.toHaveBeenCalled();
    expect(window.location.href).not.toBe('/login');
  });

  it('redirige a /login cuando el refresh devuelve no-ok', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/auth/refresh')) return Promise.resolve(errJson(401, {}));
      return Promise.resolve(errJson(401, { error: 'Unauthorized' }));
    });

    await expect(apiClient.get('/datos')).rejects.toThrow();
    expect(clearSessionCache).toHaveBeenCalledWith({ clearTenant: true });
    expect(clearRuntimeLayoutState).toHaveBeenCalled();
    expect(window.location.href).toBe('/login');
  });

  it('redirige a /login cuando el refresh lanza error de red', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/auth/refresh')) return Promise.reject(new Error('network error'));
      return Promise.resolve(errJson(401, { error: 'Unauthorized' }));
    });

    await expect(apiClient.get('/datos')).rejects.toThrow();
    expect(window.location.href).toBe('/login');
  });

  it('no genera segundo refresh si el retry también recibe 401', async () => {
    let refreshCount = 0;
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/auth/refresh')) {
        refreshCount++;
        return Promise.resolve(okRefresh());
      }
      // Ambas llamadas a /datos devuelven 401 (incluso el retry)
      return Promise.resolve(errJson(401, { error: 'Unauthorized' }));
    });

    await expect(apiClient.get('/datos')).rejects.toThrow();
    expect(refreshCount).toBe(1);
    expect(window.location.href).toBe('/login');
  });
});

describe('apiClient — múltiples 401 simultáneas', () => {
  it('ejecuta un solo refresh para varios 401 concurrentes y reintenta todos', async () => {
    let refreshed = false;
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/auth/refresh')) {
        refreshed = true;
        return Promise.resolve(okRefresh());
      }
      if (refreshed) return Promise.resolve(okJson({ data: 'ok' }));
      return Promise.resolve(errJson(401, { error: 'Unauthorized' }));
    });

    const results = await Promise.all([
      apiClient.get('/datos'),
      apiClient.get('/datos'),
      apiClient.get('/datos'),
    ]);

    expect(results).toHaveLength(3);
    const refreshCalls = global.fetch.mock.calls.filter(([u]) => u.includes('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
    // 3 iniciales (401) + 1 refresh + 3 reintentos (200) = 7
    expect(global.fetch).toHaveBeenCalledTimes(7);
  });
});

describe('apiClient — rutas /auth/ no disparan refresh', () => {
  it('401 en /auth/refresh no genera refresh adicional ni redirige', async () => {
    global.fetch = vi.fn().mockResolvedValue(errJson(401, { error: 'token invalido' }));

    await expect(apiClient.post('/auth/refresh', {})).rejects.toMatchObject({ status: 401 });
    const refreshCalls = global.fetch.mock.calls.filter(([u]) => u.includes('/auth/refresh'));
    // Solo la llamada original a /auth/refresh, sin intento extra
    expect(refreshCalls).toHaveLength(1);
    expect(window.location.href).not.toBe('/login');
  });

  it('401 en /auth/login no redirige ni intenta refresh', async () => {
    global.fetch = vi.fn().mockResolvedValue(errJson(401, { error: 'Credenciales invalidas' }));

    await expect(apiClient.post('/auth/login', {})).rejects.toMatchObject({ status: 401 });
    expect(window.location.href).not.toBe('/login');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('apiClient — AbortError y errores de red no generan refresh', () => {
  it('AbortError no llama captureApiError ni intenta refresh', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    global.fetch = vi.fn().mockRejectedValue(abortError);

    await expect(apiClient.get('/datos')).rejects.toThrow();
    expect(captureApiError).not.toHaveBeenCalled();
    const refreshCalls = global.fetch.mock.calls.filter(([u]) => u.includes('/auth/refresh'));
    expect(refreshCalls).toHaveLength(0);
  });
});

describe('apiClient — errores HTTP genéricos', () => {
  it('404 lanza ApiError con status 404', async () => {
    global.fetch = vi.fn().mockResolvedValue(errJson(404, { error: 'No encontrado' }));
    await expect(apiClient.get('/inexistente')).rejects.toMatchObject({ status: 404 });
  });

  it('500 lanza ApiError con status 500', async () => {
    global.fetch = vi.fn().mockResolvedValue(errJson(500, { error: 'Server error' }));
    await expect(apiClient.get('/datos')).rejects.toMatchObject({ status: 500 });
  });
});
