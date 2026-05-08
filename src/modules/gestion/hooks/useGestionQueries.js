import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../api/apiClient';

/**
 * Hook para obtener el resumen operativo del dashboard de gestión.
 */
export function useGestionSummary(options = {}) {
  return useQuery({
    queryKey: ['gestion-summary'],
    queryFn: () => apiClient.get('/dashboard/summary'),
    staleTime: 5 * 60 * 1000, // 5 minutos
    ...options,
  });
}

/**
 * Hook para obtener oportunidades con filtros.
 */
export function useOportunidades(filters = {}, options = {}) {
  const queryKey = ['oportunidades', filters];
  
  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.append(key, val);
        }
      });
      const qs = params.toString();
      const res = await apiClient.get(`/oportunidades${qs ? `?${qs}` : ''}`, { signal });
      return Array.isArray(res) ? res : (res.items || []);
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
    ...options,
  });
}

/**
 * Hook para obtener interacciones con filtros.
 */
export function useInteracciones(filters = {}, options = {}) {
  const queryKey = ['interacciones', filters];

  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.append(key, val);
        }
      });
      const qs = params.toString();
      const res = await apiClient.get(`/interacciones${qs ? `?${qs}` : ''}`, { signal });
      return Array.isArray(res) ? res : (res.items || res.data || []);
    },
    staleTime: 2 * 60 * 1000,
    ...options,
  });
}

/**
 * Hook para obtener visitas.
 */
export function useVisitas(filters = {}, options = {}) {
  const queryKey = ['visitas', filters];

  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.append(key, val);
        }
      });
      const qs = params.toString();
      const res = await apiClient.get(`/visitas${qs ? `?${qs}` : ''}`, { signal });
      return Array.isArray(res) ? res : (res.items || []);
    },
    staleTime: 2 * 60 * 1000,
    ...options,
  });
}

/**
 * Hook para obtener muestreos.
 */
export function useMuestreos(filters = {}, options = {}) {
  const queryKey = ['muestreos', filters];

  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.append(key, val);
        }
      });
      const qs = params.toString();
      const res = await apiClient.get(`/muestreos${qs ? `?${qs}` : ''}`, { signal });
      return res; // Retornamos el objeto completo para manejar paginación si es necesario
    },
    staleTime: 2 * 60 * 1000,
    ...options,
  });
}

/**
 * Hook para obtener centros (Directorio).
 */
export function useCentros(options = {}) {
  return useQuery({
    queryKey: ['centros'],
    queryFn: ({ signal }) => apiClient.get('/centros', { signal }),
    staleTime: 10 * 60 * 1000, // Los centros cambian poco
    ...options,
  });
}

/**
 * Hook para obtener contactos (Directorio).
 */
export function useContactos(filters = {}, options = {}) {
  const queryKey = ['contactos', filters];
  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.append(key, val);
        }
      });
      const qs = params.toString();
      return apiClient.get(`/contactos${qs ? `?${qs}` : ''}`, { signal });
    },
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

/**
 * Hook para obtener tratos (negociaciones avanzadas).
 */
export function useTratos(options = {}) {
  return useQuery({
    queryKey: ['tratos'],
    queryFn: async ({ signal }) => {
      const res = await apiClient.get('/oportunidades/tratos', { signal });
      return res;
    },
    staleTime: 2 * 60 * 1000,
    ...options,
  });
}

/**
 * Hook para obtener la agenda del calendario.
 */
export function useCalendarioAgenda(filters = {}, options = {}) {
  const queryKey = ['calendario-agenda', filters];
  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.append(key, val);
        }
      });
      const qs = params.toString();
      return apiClient.get(`/dashboard/calendario${qs ? `?${qs}` : ''}`, { signal });
    },
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}
