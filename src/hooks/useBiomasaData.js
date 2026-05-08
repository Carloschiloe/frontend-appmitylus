import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/apiClient';
import { getDisponibilidades, getAsignaciones } from '../api/api-mmpp.js';
import { useToast } from '../context/ToastContext';

function isSameMonth(value, mesKey) {
  if (!value || !mesKey) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const [year, month] = String(mesKey).split('-').map(Number);
  return date.getFullYear() === year && date.getMonth() + 1 === month;
}

export function useBiomasaData(mes) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [disp, setDisp] = useState([]);
  const [asig, setAsig] = useState([]);
  const [programas, setProgramas] = useState([]);
  const [calData, setCalData] = useState({});
  const [tratosAcordados, setTratosAcordados] = useState([]);
  const [tratosBiomasa, setTratosBiomasa] = useState([]);
  const [perdidasBiomasa, setPerdidasBiomasa] = useState([]);

  const load = useCallback(async (signal) => {
    setLoading(true);
    try {
      const [d, a, progRes, calRes, tratosRes, tratosBiomasaRes, oportunidadesCerradasRes] = await Promise.all([
        getDisponibilidades({ mesKey: mes }),
        getAsignaciones({ mesKey: mes }),
        apiClient.get('/programa-cosecha', { signal }).catch(() => ({ items: [] })),
        apiClient.get(`/programa-cosecha/calendario?from=${mes}-01&to=${mes}-31`, { signal }).catch(() => ({ calendario: {} })),
        apiClient.get('/programa-cosecha/tratos-acordados', { signal }).catch(() => ({ items: [] })),
        apiClient.get(`/oportunidades/biomasa-situacion?from=${mes}-01&to=${mes}-31`, { signal }).catch(() => ({ items: [] })),
        apiClient.get('/oportunidades?seguimientoEstado=cerrado', { signal }).catch(() => ({ items: [] })),
      ]);
      const tratosItems = (tratosBiomasaRes.items || []).filter((item) =>
        ['en_conversacion', 'reservada', 'acordada'].includes(String(item?.situacionBiomasa || '').toLowerCase())
      );
      const perdidasItems = (oportunidadesCerradasRes.items || []).filter((item) => {
        const motivo = String(item?.motivoCierre || '').toLowerCase();
        if (!['vendido_a_otro', 'sin_biomasa', 'descartado', 'no_califica'].includes(motivo)) return false;
        return isSameMonth(item?.fechaCierre || item?.updatedAt || item?.ultimaActividadAt, mes);
      });
      setDisp(d || []);
      setAsig(a || []);
      setProgramas(progRes.items || []);
      setCalData(calRes.calendario || {});
      setTratosAcordados(tratosRes.items || []);
      setTratosBiomasa(tratosItems);
      setPerdidasBiomasa(perdidasItems);
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

  return {
    loading,
    disp,
    asig,
    programas,
    calData,
    tratosAcordados,
    tratosBiomasa,
    perdidasBiomasa,
    reload: load,
  };
}

