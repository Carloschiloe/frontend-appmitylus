import { useMemo, useCallback } from 'react';
import { finMes, todayKey, toChileDateKey } from '../utils/fechasChile';
import { formatDailyAdjustmentText } from '../utils/programaCalculos';

export function useBiomasaComputed({
  programas,
  calData,
  weekDays,
  mes,
  programPeriod,
  followupPeriod,
  enrichCalendarItem,
}) {
  const programasPeriodo = useMemo(() => {
    if (programPeriod === 'all') return programas;
    const rangeStart = programPeriod === 'week'
      ? new Date(`${weekDays[0]}T00:00:00`)
      : new Date(`${mes}-01T00:00:00`);
    const rangeEnd = programPeriod === 'week'
      ? new Date(`${weekDays[6]}T23:59:59`)
      : new Date(`${finMes(mes)}T23:59:59`);
    return programas.filter((p) => {
      const desde = p.vigenciaDesde ? new Date(p.vigenciaDesde) : null;
      const hasta = p.vigenciaHasta ? new Date(p.vigenciaHasta) : null;
      return desde && hasta && desde <= rangeEnd && hasta >= rangeStart;
    });
  }, [mes, programPeriod, programas, weekDays]);

  const recentDailyAdjustments = useMemo(() => {
    const weekSet = new Set(weekDays);
    return programas
      .flatMap((p) => (p.ajustesDiarios || []).map((ajuste) => ({
        ...ajuste,
        programaId: p._id,
        proveedorNombre: p.proveedorNombre,
        centroNombre: p.centroNombre,
      })))
      .filter((ajuste) => {
        const dateKey = ajuste.fecha ? new Date(ajuste.fecha).toISOString().slice(0, 10) : '';
        return followupPeriod === 'week' ? weekSet.has(dateKey) : dateKey.startsWith(mes);
      })
      .sort((a, b) => new Date(b.createdAt || b.fecha) - new Date(a.createdAt || a.fecha))
      .slice(0, followupPeriod === 'week' ? 12 : 20);
  }, [followupPeriod, mes, programas, weekDays]);

  const followupPrograms = useMemo(() => {
    const rangeStart = followupPeriod === 'week'
      ? new Date(`${weekDays[0]}T00:00:00`)
      : new Date(`${mes}-01T00:00:00`);
    const rangeEnd = followupPeriod === 'week'
      ? new Date(`${weekDays[6]}T23:59:59`)
      : new Date(`${finMes(mes)}T23:59:59`);
    const weekSet = new Set(weekDays);
    return programas.filter((p) => {
      if (p.estado !== 'activo') return false;
      const desde = p.vigenciaDesde ? new Date(p.vigenciaDesde) : null;
      const hasta = p.vigenciaHasta ? new Date(p.vigenciaHasta) : null;
      const overlapsVigencia = desde && hasta && desde <= rangeEnd && hasta >= rangeStart;
      const hasAdjustmentInPeriod = (p.diasEspeciales || []).some((item) => {
        const key = item?.fecha ? new Date(item.fecha).toISOString().slice(0, 10) : '';
        return followupPeriod === 'week' ? weekSet.has(key) : key.startsWith(mes);
      });
      return overlapsVigencia || hasAdjustmentInPeriod;
    });
  }, [followupPeriod, mes, programas, weekDays]);

  const followupSummary = useMemo(() => {
    const netDelta = recentDailyAdjustments.reduce((sum, a) => sum + Number(a.camionesDelta || 0), 0);
    const todayItems = (calData[todayKey()]?.items || []).map(enrichCalendarItem);
    return {
      activePrograms: followupPrograms.length,
      adjustments: recentDailyAdjustments.length,
      netDelta,
      todayCamiones: todayItems.reduce((sum, item) => sum + Number(item.camiones || 0), 0),
    };
  }, [calData, enrichCalendarItem, followupPrograms.length, recentDailyAdjustments]);

  const getLatestProgramNovelty = useCallback((programa) => {
    const weekSet = new Set(weekDays);
    const latest = [...(programa?.ajustesDiarios || [])]
      .filter((ajuste) => {
        const dateKey = ajuste.fecha ? new Date(ajuste.fecha).toISOString().slice(0, 10) : '';
        return followupPeriod === 'week' ? weekSet.has(dateKey) : dateKey.startsWith(mes);
      })
      .sort((a, b) => new Date(b.createdAt || b.fecha) - new Date(a.createdAt || a.fecha))[0];
    if (latest) return formatDailyAdjustmentText(latest);
    return programa?.seguimientos?.[0]?.nota || 'Sin novedades registradas recientemente.';
  }, [followupPeriod, mes, weekDays]);

  const getProgramDayCamiones = useCallback((programa, dateKey = todayKey()) => {
    const base = Number(programa?.camionesDefault || 0);
    const calItem = (calData[dateKey]?.items || []).find((d) => String(d.programaId) === String(programa?._id));
    if (calItem) return Number(calItem.camiones ?? base);
    const specialDay = (programa?.diasEspeciales || []).find((item) => toChileDateKey(item?.fecha) === dateKey);
    if (specialDay) return Number(specialDay.camiones ?? base);
    const latestAdj = [...(programa?.ajustesDiarios || [])]
      .filter((a) => toChileDateKey(a?.fecha) === dateKey)
      .sort((a, b) => new Date(b.createdAt || b.fecha) - new Date(a.createdAt || a.fecha))[0];
    if (latestAdj) return Number(latestAdj.camionesDespues ?? base);
    return base;
  }, [calData]);

  const getTodayProgramCamiones = useCallback(
    (programa) => getProgramDayCamiones(programa, todayKey()),
    [getProgramDayCamiones],
  );

  const getProgramCamionesStatus = useCallback((programa) => {
    const base = Number(programa?.camionesDefault || 0);
    const today = getTodayProgramCamiones(programa);
    return { base, today, adjusted: today !== base };
  }, [getTodayProgramCamiones]);

  return {
    programasPeriodo,
    recentDailyAdjustments,
    followupPrograms,
    followupSummary,
    getLatestProgramNovelty,
    getTodayProgramCamiones,
    getProgramCamionesStatus,
  };
}
