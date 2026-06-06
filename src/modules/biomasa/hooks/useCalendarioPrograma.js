import { useMemo, useCallback } from 'react';
import { getPreferredTipoProducto } from '../utils/productoLabels';
import {
  SANITARIO_ORDER,
  getSanitarioEstado,
  isSanitarioRelevant,
} from '../utils/programaCalculos';

export function useCalendarioPrograma({
  mes,
  currentWeekOffset,
  programas,
  calData,
  filterProducto,
  filterProveedor,
  tonsPerTruck,
}) {
  // ── Días del mes ──────────────────────────────────────────────────────────────
  const monthData = useMemo(() => {
    if (!mes) return { days: [], padding: 0 };
    const [y, m] = mes.split('-');
    const year = parseInt(y, 10);
    const month = parseInt(m, 10) - 1;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const dayOfWeek = firstDay.getDay();
    const padding = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return {
      days: Array.from({ length: lastDay.getDate() }, (_, i) => i + 1),
      padding,
    };
  }, [mes]);

  // ── Días de la semana activa ──────────────────────────────────────────────────
  const weekDays = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - start.getDay() + 1 + currentWeekOffset * 7);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  }, [currentWeekOffset]);

  // ── Índice de programas ───────────────────────────────────────────────────────
  const programasById = useMemo(() => {
    const map = new Map();
    programas.forEach((programa) => map.set(String(programa._id), programa));
    return map;
  }, [programas]);

  const programasFiltrados = useMemo(
    () => (filterProveedor ? programas.filter((p) => p.proveedorNombre === filterProveedor) : programas),
    [programas, filterProveedor],
  );

  const filteredProgramIds = useMemo(
    () => new Set(programasFiltrados.map((p) => String(p._id))),
    [programasFiltrados],
  );

  // ── Enriquecimiento de ítem de calendario ─────────────────────────────────────
  const enrichCalendarItem = useCallback(
    (item) => {
      const programa = programasById.get(String(item?.programaId || ''));
      const tipoProducto = getPreferredTipoProducto(
        programa?.tipoProducto,
        programa?.tipoProductoSugerido,
        item?.tipoProducto,
        item?.tipoProductoSugerido,
      );
      const camiones = Number(item?.camiones || 0);

      let effectiveTpt;
      if (Array.isArray(programa?.transportes) && programa.transportes.length > 0) {
        const totalCam = programa.transportes.reduce((s, t) => s + (Number(t.cantidadDia) || 0), 0);
        const totalTons = programa.transportes.reduce(
          (s, t) => s + (Number(t.cantidadDia) || 0) * (Number(t.toneladasPorCamion) || 0),
          0,
        );
        effectiveTpt = totalCam > 0 ? totalTons / totalCam : 0;
      } else if (programa?.toneladasPorCamion) {
        effectiveTpt = Number(programa.toneladasPorCamion);
      } else {
        effectiveTpt = Number(tonsPerTruck || 0);
      }

      const tonsDia = camiones * effectiveTpt;
      return {
        ...item,
        camiones,
        tipoProducto,
        tonsEstimadas: item?.tonsEstimadas ?? programa?.tonsEstimadas ?? null,
        tonsDia,
        uxkg: item?.uxkg ?? programa?.uxkg ?? null,
        rendimiento: item?.rendimiento ?? programa?.rendimiento ?? null,
        centroNombre: item?.centroNombre || programa?.centroNombre || '',
        centroCodigo: item?.centroCodigo || programa?.centroCodigo || '',
        sanitario: item?.sanitario || programa?.sanitario || null,
        ajusteTipo: item?.ajusteTipo || '',
        ajusteMotivo: item?.ajusteMotivo || '',
        esDiaEspecial: Boolean(item?.esDiaEspecial),
        cancelado: Boolean(item?.cancelado),
      };
    },
    [programasById, tonsPerTruck],
  );

  // ── Proveedores del mes ───────────────────────────────────────────────────────
  const allMonthProviders = useMemo(() => {
    const allIds = new Set(programas.map((p) => String(p._id)));
    const map = new Map();
    Object.entries(calData || {}).forEach(([dateKey, day]) => {
      if (!String(dateKey).startsWith(mes)) return;
      (day?.items || []).forEach((item) => {
        if (!allIds.has(String(item.programaId))) return;
        const enriched = enrichCalendarItem(item);
        if (filterProducto && enriched.tipoProducto !== filterProducto) return;
        const camiones = Number(enriched.camiones || 0);
        if (camiones <= 0) return;
        const prog = programasById.get(String(item.programaId));
        const nombre = item.proveedorNombre || prog?.proveedorNombre || 'Sin proveedor';
        const tons = enriched.tonsDia;
        if (!map.has(nombre)) map.set(nombre, { nombre, camiones: 0, tons: 0 });
        const entry = map.get(nombre);
        entry.camiones += camiones;
        entry.tons += tons;
      });
    });
    return [...map.values()].sort((a, b) => b.tons - a.tons);
  }, [calData, mes, programas, programasById, enrichCalendarItem, filterProducto]);

  // ── Proveedores de la semana ──────────────────────────────────────────────────
  const allWeekProviders = useMemo(() => {
    const allIds = new Set(programas.map((p) => String(p._id)));
    const weekSet = new Set(weekDays);
    const map = new Map();
    Object.entries(calData || {}).forEach(([dateKey, day]) => {
      if (!weekSet.has(dateKey)) return;
      (day?.items || []).forEach((item) => {
        if (!allIds.has(String(item.programaId))) return;
        const enriched = enrichCalendarItem(item);
        if (filterProducto && enriched.tipoProducto !== filterProducto) return;
        const camiones = Number(enriched.camiones || 0);
        if (camiones <= 0) return;
        const prog = programasById.get(String(item.programaId));
        const nombre = item.proveedorNombre || prog?.proveedorNombre || 'Sin proveedor';
        const tons = enriched.tonsDia;
        if (!map.has(nombre)) map.set(nombre, { nombre, camiones: 0, tons: 0 });
        const entry = map.get(nombre);
        entry.camiones += camiones;
        entry.tons += tons;
      });
    });
    return [...map.values()].sort((a, b) => b.tons - a.tons);
  }, [calData, weekDays, programas, programasById, enrichCalendarItem, filterProducto]);

  // ── Productos del mes (sin filtro de producto — para donut/leyenda completa) ──
  const allMonthProducts = useMemo(() => {
    const programIds = new Set(programas.map((p) => String(p._id)));
    const products = {
      entero: { key: 'entero', tons: 0, camiones: 0 },
      carne: { key: 'carne', tons: 0, camiones: 0 },
      mc: { key: 'mc', tons: 0, camiones: 0 },
      sin_definir: { key: 'sin_definir', tons: 0, camiones: 0 },
    };
    Object.entries(calData || {}).forEach(([dateKey, day]) => {
      if (!String(dateKey).startsWith(mes)) return;
      (day?.items || [])
        .filter((item) => programIds.has(String(item.programaId)))
        .map(enrichCalendarItem)
        .filter((item) => Number(item.camiones || 0) > 0)
        .forEach((item) => {
          const pk = getPreferredTipoProducto(item.tipoProducto);
          if (products[pk]) {
            products[pk].camiones += Number(item.camiones || 0);
            products[pk].tons += Number(item.tonsDia || 0);
          }
        });
    });
    const total = Object.values(products).reduce((s, p) => s + p.tons, 0);
    return { products: Object.values(products).filter((p) => p.camiones > 0), total };
  }, [calData, mes, programas, enrichCalendarItem]);

  // ── Productos de la semana ────────────────────────────────────────────────────
  const allWeekProducts = useMemo(() => {
    const programIds = new Set(programas.map((p) => String(p._id)));
    const weekSet = new Set(weekDays);
    const products = {
      entero: { key: 'entero', tons: 0, camiones: 0 },
      carne: { key: 'carne', tons: 0, camiones: 0 },
      mc: { key: 'mc', tons: 0, camiones: 0 },
      sin_definir: { key: 'sin_definir', tons: 0, camiones: 0 },
    };
    Object.entries(calData || {}).forEach(([dateKey, day]) => {
      if (!weekSet.has(dateKey)) return;
      (day?.items || [])
        .filter((item) => programIds.has(String(item.programaId)))
        .map(enrichCalendarItem)
        .filter((item) => Number(item.camiones || 0) > 0)
        .forEach((item) => {
          const pk = getPreferredTipoProducto(item.tipoProducto);
          if (products[pk]) {
            products[pk].camiones += Number(item.camiones || 0);
            products[pk].tons += Number(item.tonsDia || 0);
          }
        });
    });
    const total = Object.values(products).reduce((s, p) => s + p.tons, 0);
    return { products: Object.values(products).filter((p) => p.camiones > 0), total };
  }, [calData, weekDays, programas, enrichCalendarItem]);

  // ── Datos de semana por programa ──────────────────────────────────────────────
  const weekData = useMemo(() => {
    const data = {};
    programasFiltrados
      .filter((p) => ['activo', 'pausado', 'finalizado'].includes(p.estado))
      .forEach((p) => {
        data[p._id] = {
          nombre: p.proveedorNombre,
          centro: p.centroNombre,
          tipoProducto: p.tipoProducto || p.tipoProductoSugerido || 'sin_definir',
          uxkg: p.uxkg ?? null,
          rendimiento: p.rendimiento ?? null,
          dias: weekDays.map((d) => {
            const item = calData[d]?.items?.find((x) => x.programaId === p._id);
            const enriched = item ? enrichCalendarItem(item) : null;
            return {
              camiones: enriched?.camiones || 0,
              tipoProducto: enriched?.tipoProducto || p.tipoProducto || p.tipoProductoSugerido || 'sin_definir',
              uxkg: enriched?.uxkg ?? p.uxkg ?? null,
              rendimiento: enriched?.rendimiento ?? p.rendimiento ?? null,
              tonsEstimadas: enriched?.tonsEstimadas ?? p.tonsEstimadas ?? null,
              tonsDia: enriched?.tonsDia || 0,
              sanitario: enriched?.sanitario || p.sanitario || null,
              tipoCamion: enriched?.tipoCamion || p.tipoCamion || '',
              maxisPorCamion: enriched?.maxisPorCamion ?? p.maxisPorCamion ?? null,
              motivo: enriched?.motivo || '',
              ajusteTipo: enriched?.ajusteTipo || '',
              ajusteMotivo: enriched?.ajusteMotivo || '',
              esDiaEspecial: Boolean(enriched?.esDiaEspecial),
              cancelado: Boolean(enriched?.cancelado),
            };
          }),
        };
      });
    return data;
  }, [programasFiltrados, calData, weekDays, enrichCalendarItem]);

  // ── Resúmenes diarios de semana ───────────────────────────────────────────────
  const weekSummaries = useMemo(() => {
    const programIds = new Set(programasFiltrados.map((p) => String(p._id)));
    const daily = {};
    const total = { camiones: 0, tons: 0 };
    weekDays.forEach((dayKeyValue) => {
      const items = (calData[dayKeyValue]?.items || [])
        .filter((item) => programIds.has(String(item.programaId)))
        .map(enrichCalendarItem)
        .filter((item) => !filterProducto || item.tipoProducto === filterProducto);
      daily[dayKeyValue] = {
        camiones: items.reduce((sum, item) => sum + Number(item.camiones || 0), 0),
        tons: items.reduce((sum, item) => sum + Number(item.tonsDia || 0), 0),
      };
      total.camiones += daily[dayKeyValue].camiones;
      total.tons += daily[dayKeyValue].tons;
    });
    return { daily, total };
  }, [calData, weekDays, enrichCalendarItem, programasFiltrados, filterProducto]);

  // ── Resumen completo de semana ────────────────────────────────────────────────
  const weekSummaryFull = useMemo(() => {
    const programIds = new Set(programasFiltrados.map((p) => String(p._id)));
    const providers = new Map();
    const products = {
      entero: { key: 'entero', camiones: 0, tons: 0 },
      carne: { key: 'carne', camiones: 0, tons: 0 },
      mc: { key: 'mc', camiones: 0, tons: 0 },
      sin_definir: { key: 'sin_definir', camiones: 0, tons: 0 },
    };
    const total = { camiones: 0, tons: 0, days: 0 };
    const sanitaryAlerts = new Map();
    const sanitaryOk = new Map();
    let maximoDia = 0;
    let maximoDiaKey = '';

    weekDays.forEach((dateKey) => {
      const day = calData[dateKey] || { items: [] };
      const items = (day.items || [])
        .filter((item) => programIds.has(String(item.programaId)))
        .map(enrichCalendarItem)
        .filter((item) => !filterProducto || item.tipoProducto === filterProducto)
        .filter((item) => Number(item.camiones || 0) > 0);
      if (!items.length) return;
      total.days += 1;
      const dayTons = items.reduce((s, i) => s + Number(i.tonsDia || 0), 0);
      if (dayTons > maximoDia) {
        maximoDia = dayTons;
        maximoDiaKey = dateKey;
      }
      items.forEach((item) => {
        const camiones = Number(item.camiones || 0);
        const tons = Number(item.tonsDia || 0);
        const providerKey = item.proveedorNombre || 'Sin proveedor';
        const productKey = getPreferredTipoProducto(item.tipoProducto);
        total.camiones += camiones;
        total.tons += tons;
        products[productKey].camiones += camiones;
        products[productKey].tons += tons;
        if (!providers.has(providerKey)) providers.set(providerKey, { nombre: providerKey, camiones: 0, tons: 0 });
        const prov = providers.get(providerKey);
        prov.camiones += camiones;
        prov.tons += tons;
        const sanitario = item.sanitario;
        if (sanitario) {
          const estado = getSanitarioEstado(sanitario);
          const centro = item.centroCodigo || providerKey;
          if (estado === 'verde') {
            if (!sanitaryOk.has(centro)) sanitaryOk.set(centro, sanitario);
          } else if (['amarillo', 'naranja', 'rojo'].includes(estado)) {
            const prio = SANITARIO_ORDER[estado] || 0;
            if (!sanitaryAlerts.has(centro) || prio > (SANITARIO_ORDER[getSanitarioEstado(sanitaryAlerts.get(centro))] || 0)) {
              sanitaryAlerts.set(centro, sanitario);
            }
          }
        }
      });
    });

    return {
      total,
      providers: [...providers.values()].sort((a, b) => b.tons - a.tons),
      products: Object.values(products).filter((p) => p.camiones > 0),
      sanitaryAlerts: [...sanitaryAlerts.values()].sort(
        (a, b) => (SANITARIO_ORDER[getSanitarioEstado(b)] || 0) - (SANITARIO_ORDER[getSanitarioEstado(a)] || 0),
      ),
      sanitaryOk: [...sanitaryOk.values()],
      promedioDiario: total.days > 0 ? total.tons / total.days : 0,
      maximoDia,
      maximoDiaKey,
    };
  }, [calData, weekDays, programasFiltrados, enrichCalendarItem, filterProducto]);

  // ── Resumen mensual ───────────────────────────────────────────────────────────
  const monthSummary = useMemo(() => {
    const programIds = new Set(programasFiltrados.map((p) => String(p._id)));
    const providers = new Map();
    const products = {
      entero: { key: 'entero', camiones: 0, tons: 0 },
      carne: { key: 'carne', camiones: 0, tons: 0 },
      mc: { key: 'mc', camiones: 0, tons: 0 },
      sin_definir: { key: 'sin_definir', camiones: 0, tons: 0 },
    };
    const total = { camiones: 0, tons: 0, days: 0 };
    const sanitaryAlerts = new Map();
    const sanitaryOk = new Map();
    let maximoDia = 0;

    Object.entries(calData || {}).forEach(([dateKey, day]) => {
      if (!String(dateKey).startsWith(mes)) return;
      const items = (day?.items || [])
        .filter((item) => programIds.has(String(item.programaId)))
        .map(enrichCalendarItem)
        .filter((item) => !filterProducto || item.tipoProducto === filterProducto)
        .filter((item) => Number(item.camiones || 0) > 0);
      if (!items.length) return;
      total.days += 1;
      const dayTons = items.reduce((s, i) => s + Number(i.tonsDia || 0), 0);
      if (dayTons > maximoDia) maximoDia = dayTons;

      items.forEach((item) => {
        const camiones = Number(item.camiones || 0);
        const tons = Number(item.tonsDia || 0);
        const providerKey = item.proveedorNombre || 'Sin proveedor';
        const productKey = getPreferredTipoProducto(item.tipoProducto);

        total.camiones += camiones;
        total.tons += tons;
        products[productKey].camiones += camiones;
        products[productKey].tons += tons;

        if (!providers.has(providerKey)) {
          providers.set(providerKey, {
            nombre: providerKey,
            centro: item.centroNombre || item.centroCodigo || 'Sin centro definido',
            camiones: 0,
            tons: 0,
          });
        }
        const provider = providers.get(providerKey);
        provider.camiones += camiones;
        provider.tons += tons;

        if (item.sanitario) {
          const estado = getSanitarioEstado(item.sanitario);
          const areaKey = `${item.sanitario?.areaPSMB || item.centroCodigo || providerKey}`;
          if (estado === 'verde') {
            if (!sanitaryOk.has(areaKey)) sanitaryOk.set(areaKey, item.sanitario);
          } else if (isSanitarioRelevant(item.sanitario)) {
            const alertKey = `${areaKey}-${estado}`;
            if (!sanitaryAlerts.has(alertKey)) sanitaryAlerts.set(alertKey, item.sanitario);
          }
        }
      });
    });

    return {
      total,
      providers: [...providers.values()].sort((a, b) => b.tons - a.tons),
      products: Object.values(products).filter((item) => item.camiones > 0),
      sanitaryAlerts: [...sanitaryAlerts.values()].sort(
        (a, b) => (SANITARIO_ORDER[getSanitarioEstado(b)] || 0) - (SANITARIO_ORDER[getSanitarioEstado(a)] || 0),
      ),
      sanitaryOk: [...sanitaryOk.values()],
      promedioDiario: total.days > 0 ? total.tons / total.days : 0,
      maximoDia,
    };
  }, [calData, enrichCalendarItem, mes, programasFiltrados, filterProducto]);

  return {
    monthData,
    weekDays,
    programasById,
    programasFiltrados,
    filteredProgramIds,
    enrichCalendarItem,
    allMonthProviders,
    allWeekProviders,
    allMonthProducts,
    allWeekProducts,
    weekData,
    weekSummaries,
    weekSummaryFull,
    monthSummary,
  };
}
