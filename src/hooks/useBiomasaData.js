import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/apiClient';
import { getDisponibilidades, getAsignaciones } from '../api/api-mmpp.js';
import { useToast } from '../context/ToastContext';

export function useBiomasaData(mes) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [disp, setDisp] = useState([]);
  const [asig, setAsig] = useState([]);
  const [programas, setProgramas] = useState([]);
  const [calData, setCalData] = useState({});
  const [tratosAcordados, setTratosAcordados] = useState([]);

  const load = useCallback(async (signal) => {
    setLoading(true);
    try {
      const [d, a, progRes, calRes, tratosRes] = await Promise.all([
        getDisponibilidades({ mesKey: mes }),
        getAsignaciones({ mesKey: mes }),
        apiClient.get('/programa-cosecha', { signal }).catch(() => ({ items: [] })),
        apiClient.get(`/programa-cosecha/calendario?from=${mes}-01&to=${mes}-31`, { signal }).catch(() => ({ calendario: {} })),
        apiClient.get('/programa-cosecha/tratos-acordados', { signal }).catch(() => ({ items: [] })),
      ]);
      setDisp(d || []);
      setAsig(a || []);
      setProgramas(progRes.items || []);
      setCalData(calRes.calendario || {});
      setTratosAcordados(tratosRes.items || []);
    } catch (e) {
      if (e.name === 'AbortError') return;
      addToast({ title: 'Error', message: 'No se pudo cargar el módulo de biomasa.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [mes, addToast]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return { loading, disp, asig, programas, calData, tratosAcordados, reload: load };
}
