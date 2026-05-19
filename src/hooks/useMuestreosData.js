import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { maestrosApi } from '../api/api-maestros';
import { useMuestreos } from '../modules/gestion/hooks/useGestionQueries';

export function useMuestreosData(viewMode, { mes, weekRange } = {}) {
  const [page, setPage] = useState(1);
  const lim = viewMode === 'grouped' ? 500 : 50;

  const activeTenant = localStorage.getItem('selected_tenant_db');
  const reporteId = new URLSearchParams(window.location.search).get('reporteId');
  const isEnabled = !!activeTenant || !!reporteId;

  // Calcular rango de fechas según el filtro activo
  const dateFilter = useMemo(() => {
    if (weekRange && weekRange.length >= 2) {
      return { from: weekRange[0], to: weekRange[weekRange.length - 1] + 'T23:59:59.999Z' };
    }
    if (mes) {
      const [y, m] = mes.split('-');
      const from = `${mes}-01`;
      const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
      const to = `${mes}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;
      return { from, to };
    }
    return {};
  }, [mes, weekRange]);

  // 1. Muestreos con React Query
  const { 
    data: muestreosRes, 
    isLoading: loadingMue, 
    refetch: refresh 
  } = useMuestreos({ limit: lim, page, ...dateFilter }, { enabled: isEnabled });

  // 2. Maestros con React Query (específico para muestreos)
  const { data: cats = [] } = useQuery({
    queryKey: ['maestros', 'categoria-muestreo', 'activos'],
    queryFn: () => maestrosApi.getMaestrosActivos('categoria-muestreo'),
    staleTime: 15 * 60 * 1000,
    enabled: isEnabled,
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['maestros', 'regla_calidad', 'activos'],
    queryFn: () => maestrosApi.getMaestrosActivos('regla_calidad'),
    staleTime: 15 * 60 * 1000,
    enabled: isEnabled,
  });

  const muestreos = useMemo(() => {
    if (!muestreosRes) return [];
    return Array.isArray(muestreosRes) ? muestreosRes : (muestreosRes.items || []);
  }, [muestreosRes]);

  const pagination = useMemo(() => muestreosRes?.pagination || null, [muestreosRes]);

  const maestros = useMemo(() => ({
    cats: Array.isArray(cats) ? cats : [],
    rules: Array.isArray(rules) ? rules : [],
  }), [cats, rules]);

  const loading = loadingMue;

  return { muestreos, maestros, loading, page, setPage, pagination, refresh };
}
