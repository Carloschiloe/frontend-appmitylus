// Hotfix 429 — GET /support/error-reports?status=new&limit=1 se estaba
// disparando en cada refresh de sesión y en cada foco de ventana (ver
// Sidebar.jsx), agotando el límite específico del backend (15 req/15min en
// producción). Estas pruebas cubren el poll acotado que lo reemplaza:
// una sola consulta al montar, una nueva por tick de intervalo, cleanup
// completo al desmontar, sin segundo interval por re-render, sin retry
// inmediato ante 429, y sin loop si el 429 se repite.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../api/apiClient.js', () => ({
  apiClient: { get: vi.fn() },
}));

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

import { apiClient } from '../api/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import Sidebar from '../components/Layout/Sidebar.jsx';

function renderSidebar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Sidebar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const adminUser = { _id: 'u1', rol: 'admin', nombre: 'Carlos' };

function okErrorReports(total = 0) {
  return Promise.resolve({ total });
}

function err429(retryAfterSeconds) {
  const error = new Error('Demasiados reportes. Intenta más tarde.');
  error.name = 'ApiError';
  error.status = 429;
  if (retryAfterSeconds != null) error.retryAfterSeconds = retryAfterSeconds;
  return Promise.reject(error);
}

const ERROR_REPORTS_CALLS = (mockCalls) => mockCalls.filter(([endpoint]) => endpoint.startsWith('/support/error-reports'));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  localStorage.clear();
  useAuth.mockReturnValue({ user: adminUser, logout: vi.fn() });
  apiClient.get.mockImplementation((endpoint) => {
    if (endpoint.startsWith('/support/error-reports')) return okErrorReports(0);
    if (endpoint === '/sanitario/resumen') return Promise.resolve({ rojo: 0, naranja: 0 });
    return Promise.resolve({});
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('caso A: al montar, una sola consulta inicial a error-reports', () => {
  it('no dispara múltiples consultas al montar', async () => {
    renderSidebar();
    await vi.waitFor(() => {
      expect(ERROR_REPORTS_CALLS(apiClient.get.mock.calls)).toHaveLength(1);
    });
  });
});

describe('caso B: el poll dispara una nueva consulta según la frecuencia definida (5 min)', () => {
  it('hace una segunda consulta tras 5 minutos', async () => {
    renderSidebar();
    await vi.waitFor(() => expect(ERROR_REPORTS_CALLS(apiClient.get.mock.calls)).toHaveLength(1));

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(ERROR_REPORTS_CALLS(apiClient.get.mock.calls)).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(ERROR_REPORTS_CALLS(apiClient.get.mock.calls)).toHaveLength(3);
  });

  it('no dispara antes de que se cumpla el intervalo', async () => {
    renderSidebar();
    await vi.waitFor(() => expect(ERROR_REPORTS_CALLS(apiClient.get.mock.calls)).toHaveLength(1));

    await vi.advanceTimersByTimeAsync(60 * 1000); // 1 min, menos que el intervalo de 5 min
    expect(ERROR_REPORTS_CALLS(apiClient.get.mock.calls)).toHaveLength(1);
  });
});

describe('caso C: unmount detiene el polling', () => {
  it('no hace más consultas después de desmontar', async () => {
    const { unmount } = renderSidebar();
    await vi.waitFor(() => expect(ERROR_REPORTS_CALLS(apiClient.get.mock.calls)).toHaveLength(1));

    unmount();
    await vi.advanceTimersByTimeAsync(20 * 60 * 1000);
    expect(ERROR_REPORTS_CALLS(apiClient.get.mock.calls)).toHaveLength(1);
  });
});

describe('caso D: re-render con una nueva referencia de `user` (misma identidad lógica) no crea un segundo interval ni refetch inmediato', () => {
  it('mantener el mismo _id/rol en un objeto `user` distinto no dispara una nueva consulta', async () => {
    const { rerender } = renderSidebar();
    await vi.waitFor(() => expect(ERROR_REPORTS_CALLS(apiClient.get.mock.calls)).toHaveLength(1));

    // Simula lo que hacía AuthContext.refreshSession en cada foco de ventana:
    // un objeto `user` NUEVO (otra referencia) con el mismo _id y rol.
    useAuth.mockReturnValue({ user: { ...adminUser }, logout: vi.fn() });
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Sidebar />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Ni el re-render en sí ni el paso del tiempo por debajo del intervalo
    // deben producir una segunda consulta (antes del fix, la referencia
    // nueva de `user` re-disparaba el efecto de inmediato).
    await vi.advanceTimersByTimeAsync(1000);
    expect(ERROR_REPORTS_CALLS(apiClient.get.mock.calls)).toHaveLength(1);

    // Y el poll sigue su cadencia normal (un solo interval activo, no dos).
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(ERROR_REPORTS_CALLS(apiClient.get.mock.calls)).toHaveLength(2);
  });
});

describe('caso E/F: un 429 no reintenta de inmediato, y si se repite no genera un loop', () => {
  it('un 429 aislado no produce una consulta extra antes del próximo tick', async () => {
    apiClient.get.mockImplementation((endpoint) => {
      if (endpoint.startsWith('/support/error-reports')) return err429();
      return Promise.resolve({ rojo: 0, naranja: 0 });
    });
    renderSidebar();
    await vi.waitFor(() => expect(ERROR_REPORTS_CALLS(apiClient.get.mock.calls)).toHaveLength(1));

    await vi.advanceTimersByTimeAsync(1000);
    expect(ERROR_REPORTS_CALLS(apiClient.get.mock.calls)).toHaveLength(1); // sin retry inmediato

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(ERROR_REPORTS_CALLS(apiClient.get.mock.calls)).toHaveLength(2); // el próximo tick normal sí ocurre
  });

  it('un 429 sostenido en cada tick no acumula llamadas extra (sin loop)', async () => {
    apiClient.get.mockImplementation((endpoint) => {
      if (endpoint.startsWith('/support/error-reports')) return err429();
      return Promise.resolve({ rojo: 0, naranja: 0 });
    });
    renderSidebar();
    await vi.waitFor(() => expect(ERROR_REPORTS_CALLS(apiClient.get.mock.calls)).toHaveLength(1));

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 * 4); // 4 ticks más
    // Exactamente 1 (inicial) + 4 (uno por tick) = 5 — nunca más que eso.
    expect(ERROR_REPORTS_CALLS(apiClient.get.mock.calls)).toHaveLength(5);
  });
});

describe('caso G: si el 429 trae Retry-After, se respeta antes del siguiente intento', () => {
  it('no vuelve a consultar en el tick fijo si todavía no pasó el Retry-After', async () => {
    let callCount = 0;
    apiClient.get.mockImplementation((endpoint) => {
      if (!endpoint.startsWith('/support/error-reports')) return Promise.resolve({ rojo: 0, naranja: 0 });
      callCount += 1;
      // Retry-After de 8 minutos: más largo que el intervalo fijo de 5 min.
      if (callCount === 1) return err429(8 * 60);
      return okErrorReports(0);
    });
    renderSidebar();
    await vi.waitFor(() => expect(ERROR_REPORTS_CALLS(apiClient.get.mock.calls)).toHaveLength(1));

    // Al tick de los 5 min normales, el Retry-After (8 min) todavía no se
    // cumplió — no debe golpear el endpoint de nuevo todavía.
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(ERROR_REPORTS_CALLS(apiClient.get.mock.calls)).toHaveLength(1);

    // Pasados los 8 minutos totales del Retry-After, el siguiente tick (a
    // los 10 min) ya puede volver a intentar.
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(ERROR_REPORTS_CALLS(apiClient.get.mock.calls)).toHaveLength(2);
  });
});

describe('caso J: el propio 429 de error-reports no llega al badge ni rompe el dashboard', () => {
  it('un 429 se absorbe en silencio — sin alerta, sin excepción no controlada', async () => {
    apiClient.get.mockImplementation((endpoint) => {
      if (endpoint.startsWith('/support/error-reports')) return err429();
      return Promise.resolve({ rojo: 0, naranja: 0 });
    });
    expect(() => renderSidebar()).not.toThrow();
    await vi.waitFor(() => expect(ERROR_REPORTS_CALLS(apiClient.get.mock.calls)).toHaveLength(1));
    // El resto del layout se renderiza con normalidad (sin toast/crash).
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
