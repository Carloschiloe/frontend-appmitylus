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

function endOfMonthKey(mesKey) {
  const [year, month] = String(mesKey || '').split('-').map(Number);
  if (!year || !month) return `${mesKey}-31`;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

export function useBiomasaData(mes, viewContext = {}) {
  const {
    isStatusView = false,
    isTratosView = false,
    isProgramView = false,
    isMuestreosView = false,
    statusSubTab = '',
    progSubTab = ''
  } = viewContext;
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [disp, setDisp] = useState([]);
  const [asig, setAsig] = useState([]);
  const [programas, setProgramas] = useState([]);
  const [calData, setCalData] = useState({});
  const [notasDia, setNotasDia] = useState({});
  const [tratosAcordados, setTratosAcordados] = useState([]);
  const [tratosBiomasa, setTratosBiomasa] = useState([]);
  const [perdidasBiomasa, setPerdidasBiomasa] = useState([]);

  const load = useCallback(async (signal) => {
    if (isMuestreosView) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const promises = [];
      const keys = [];

      if (isStatusView && statusSubTab === 'disponibilidad') {
        // Listado muestra TODOS los registros (no solo el mes activo).
        // El "Resumen mensual" filtra client-side por mes sobre este mismo array.
        promises.push(getDisponibilidades({ from: '2020-01', to: '2035-12' }));
        keys.push('disp');
        promises.push(getAsignaciones({ mesKey: mes }));
        keys.push('asig');
      }

      if (isStatusView && statusSubTab === 'negociacion') {
        promises.push(apiClient.get(`/oportunidades/biomasa-situacion?from=${mes}-01&to=${endOfMonthKey(mes)}`, { signal }).catch(() => ({ items: [] })));
        keys.push('tratosBiomasaRes');
        promises.push(apiClient.get('/oportunidades?seguimientoEstado=cerrado', { signal }).catch(() => ({ items: [] })));
        keys.push('oportunidadesCerradasRes');
      }

      if (isTratosView) {
        promises.push(apiClient.get('/programa-cosecha/tratos-acordados', { signal }).catch(() => ({ items: [] })));
        keys.push('tratosRes');
      }

      if (isProgramView && (progSubTab === 'programa' || progSubTab === 'seguimiento')) {
        promises.push(apiClient.get('/programa-cosecha', { signal }).catch(() => ({ items: [] })));
        keys.push('progRes');
        if (progSubTab === 'programa') {
          promises.push(apiClient.get('/programa-cosecha/tratos-acordados', { signal }).catch(() => ({ items: [] })));
          keys.push('tratosRes');
        }
      }

      if (isProgramView && progSubTab === 'calendario') {
        promises.push(apiClient.get('/programa-cosecha', { signal }).catch(() => ({ items: [] })));
        keys.push('progRes');
        promises.push(apiClient.get(`/programa-cosecha/calendario?from=${mes}-01&to=${endOfMonthKey(mes)}`, { signal }).catch(() => ({ calendario: {} })));
        keys.push('calRes');
        promises.push(apiClient.get(`/notas-dia?from=${mes}-01&to=${endOfMonthKey(mes)}`, { signal }).catch(() => ({ notas: {} })));
        keys.push('notasRes');
        // Calibre registrado por proveedor (disponibilidad), para mostrar cuando el
        // programa aún no tiene muestreo propio.
        promises.push(getDisponibilidades({ from: '2020-01', to: '2035-12' }).catch(() => []));
        keys.push('disp');
      }

      const results = await Promise.all(promises);
      const resMap = {};
      keys.forEach((k, i) => { resMap[k] = results[i]; });

      if (resMap.disp) setDisp(resMap.disp || []);
      if (resMap.asig) setAsig(resMap.asig || []);
      if (resMap.progRes) setProgramas(resMap.progRes.items || []);
      if (resMap.calRes) setCalData(resMap.calRes.calendario || {});
      if (resMap.notasRes) setNotasDia(resMap.notasRes.notas || {});
      if (resMap.tratosRes) setTratosAcordados(resMap.tratosRes.items || []);

      if (resMap.tratosBiomasaRes) {
        const tratosItems = (resMap.tratosBiomasaRes.items || []).filter((item) =>
          ['en_conversacion', 'reservada', 'acordada'].includes(String(item?.situacionBiomasa || '').toLowerCase())
        );
        setTratosBiomasa(tratosItems);
      }
      
      if (resMap.oportunidadesCerradasRes) {
        const perdidasItems = (resMap.oportunidadesCerradasRes.items || []).filter((item) => {
          const motivo = String(item?.motivoCierre || '').toLowerCase();
          if (!['vendido_a_otro', 'sin_biomasa', 'descartado', 'no_califica'].includes(motivo)) return false;
          return isSameMonth(item?.fechaCierre || item?.updatedAt || item?.ultimaActividadAt, mes);
        });
        setPerdidasBiomasa(perdidasItems);
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      addToast({ title: 'Error', message: 'No se pudo cargar el módulo de biomasa.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [mes, addToast, isStatusView, isTratosView, isProgramView, isMuestreosView, statusSubTab, progSubTab]);

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
    notasDia,
    tratosAcordados,
    tratosBiomasa,
    perdidasBiomasa,
    reload: load,
  };
}

