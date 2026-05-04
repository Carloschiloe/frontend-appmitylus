import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/apiClient';
import { useToast } from '../context/ToastContext';

export function useMuestreosData(viewMode) {
  const { addToast } = useToast();
  const [muestreos, setMuestreos] = useState([]);
  const [maestros, setMaestros] = useState({ cats: [], rules: [] });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const load = useCallback(async (targetPage = 1, mode = viewMode) => {
    setLoading(true);
    const lim = mode === 'grouped' ? 500 : 50;
    const controller = new AbortController();

    try {
      const [muRes, catsRes, rulesRes] = await Promise.all([
        apiClient.get(`/muestreos?limit=${lim}&page=${targetPage}`, { signal: controller.signal })
          .catch(() => ({ items: [], pagination: null })),
        apiClient.get('/maestros?tipo=categoria-muestreo&soloActivos=true', { signal: controller.signal })
          .catch(() => ({ items: [] })),
        apiClient.get('/maestros?tipo=clasificacion_producto&soloActivos=true', { signal: controller.signal })
          .catch(() => ({ items: [] })),
      ]);
      setMuestreos(Array.isArray(muRes) ? muRes : (muRes.items || []));
      setPagination(muRes.pagination || null);
      setMaestros({ cats: catsRes.items || [], rules: rulesRes.items || [] });
    } catch (err) {
      if (err.name === 'AbortError') return;
      addToast({ title: 'Error', message: 'No se pudieron cargar los datos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addToast, viewMode]);

  useEffect(() => {
    load(page);
  }, [load, page]);

  const refresh = useCallback((targetPage) => {
    load(targetPage ?? page);
  }, [load, page]);

  return { muestreos, maestros, loading, page, setPage, pagination, refresh };
}
