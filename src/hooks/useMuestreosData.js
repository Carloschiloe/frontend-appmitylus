import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/apiClient';
import { useMuestreos } from '../modules/gestion/hooks/useGestionQueries';

export function useMuestreosData(viewMode) {
  const [page, setPage] = useState(1);
  const lim = viewMode === 'grouped' ? 500 : 50;

  // 1. Muestreos con React Query
  const { 
    data: muestreosRes, 
    isLoading: loadingMue, 
    refetch: refresh 
  } = useMuestreos({ limit: lim, page });

  // 2. Maestros con React Query (específico para muestreos)
  const { data: catsRes } = useQuery({
    queryKey: ['maestros', 'categoria-muestreo'],
    queryFn: () => apiClient.get('/maestros?tipo=categoria-muestreo&soloActivos=true'),
    staleTime: 15 * 60 * 1000,
  });

  const { data: rulesRes } = useQuery({
    queryKey: ['maestros', 'clasificacion_producto'],
    queryFn: () => apiClient.get('/maestros?tipo=clasificacion_producto&soloActivos=true'),
    staleTime: 15 * 60 * 1000,
  });

  const muestreos = useMemo(() => {
    if (!muestreosRes) return [];
    return Array.isArray(muestreosRes) ? muestreosRes : (muestreosRes.items || []);
  }, [muestreosRes]);

  const pagination = useMemo(() => muestreosRes?.pagination || null, [muestreosRes]);

  const maestros = useMemo(() => ({
    cats: catsRes?.items || [],
    rules: rulesRes?.items || [],
  }), [catsRes, rulesRes]);

  const loading = loadingMue;

  return { muestreos, maestros, loading, page, setPage, pagination, refresh };
}
