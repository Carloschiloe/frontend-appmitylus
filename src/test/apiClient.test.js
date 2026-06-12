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

const mockJsonResponse = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: () => 'application/json' },
  json: async () => body,
  text: async () => JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.stubGlobal('location', { href: '' });
});

describe('apiClient — manejo de 401', () => {
  it('llama clearSessionCache y clearRuntimeLayoutState ante 401', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockJsonResponse(401, { error: 'Unauthorized' }));

    await expect(apiClient.get('/datos')).rejects.toThrow();

    expect(clearSessionCache).toHaveBeenCalledWith({ clearTenant: true });
    expect(clearRuntimeLayoutState).toHaveBeenCalled();
  });

  it('redirige a /login ante 401 en ruta no pública', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockJsonResponse(401, { error: 'Unauthorized' }));

    await expect(apiClient.get('/datos')).rejects.toThrow();

    expect(window.location.href).toBe('/login');
  });

  it('no redirige en rutas /auth/', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockJsonResponse(401, { error: 'Unauthorized' }));

    await expect(apiClient.get('/auth/refresh')).rejects.toThrow();

    expect(window.location.href).not.toBe('/login');
    expect(clearSessionCache).not.toHaveBeenCalled();
  });
});

describe('apiClient — manejo de AbortError', () => {
  it('no reporta AbortError a captureApiError', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    global.fetch = vi.fn().mockRejectedValue(abortError);

    await expect(apiClient.get('/datos')).rejects.toThrow();

    expect(captureApiError).not.toHaveBeenCalled();
  });
});

describe('apiClient — errores HTTP genéricos', () => {
  it('lanza ApiError con status en respuesta 404', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockJsonResponse(404, { error: 'No encontrado' }));

    await expect(apiClient.get('/inexistente')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('lanza ApiError con status en respuesta 500', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockJsonResponse(500, { error: 'Server error' }));

    await expect(apiClient.get('/datos')).rejects.toMatchObject({
      status: 500,
    });
  });
});
