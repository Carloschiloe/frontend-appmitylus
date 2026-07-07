import { useMemo, useCallback } from 'react';
import { todayKey, toChileDateKey, finMes } from '../utils/fechasChile';

export function useBiomasaComputed({
  programas,
  calData,
  weekDays,
  mes,
  programPeriod,
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
    getTodayProgramCamiones,
    getProgramCamionesStatus,
  };
}
