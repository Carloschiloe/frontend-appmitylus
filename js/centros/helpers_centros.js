// js/centros/helpers_centros.js
import { Estado } from '../core/estado.js';

/**
 * Calcula totales y promedios (NaN-safe) para la tabla de centros
 * y actualiza el footer. Devuelve además un objeto con los valores.
 *
 * NOTA: se calcula desde Estado.centros (dataset completo),
 * no desde las filas visibles/paginadas.
 */
export function calcularTotalesTabla(row, data, start, end, display) {
  const toNum = (v) => {
    if (v === '' || v === null || v === undefined) return 0;
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const avg = (sum, count) => (count > 0 ? sum / count : 0);
  const fmt0 = (n) =>
    Number(n || 0).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const centros = Array.isArray(Estado.centros) ? Estado.centros : [];

  let sumH = 0;
  let sumL = 0;
  let sumTons = 0;

  let sumUnKg = 0, countUnKg = 0;
  let sumRechazo = 0, countRechazo = 0;
  let sumRdmto = 0, countRdmto = 0;

  for (const c of centros) {
    sumH += toNum(c?.hectareas);
    const lines = Array.isArray(c?.lines) ? c.lines : [];
    sumL += lines.length;

    for (const l of lines) {
      sumTons += toNum(l?.tons);

      if (l?.unKg !== '' && l?.unKg !== null && l?.unKg !== undefined) {
        sumUnKg += toNum(l.unKg);
        countUnKg++;
      }
      if (l?.porcRechazo !== '' && l?.porcRechazo !== null && l?.porcRechazo !== undefined) {
        sumRechazo += toNum(l.porcRechazo);
        countRechazo++;
      }
      if (l?.rendimiento !== '' && l?.rendimiento !== null && l?.rendimiento !== undefined) {
        sumRdmto += toNum(l.rendimiento);
        countRdmto++;
      }
    }
  }

  const avgUnKg    = avg(sumUnKg, countUnKg);
  const avgRechazo = avg(sumRechazo, countRechazo);
  const avgRdmto   = avg(sumRdmto, countRdmto);

  // Actualiza footer si existe
  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  // estos IDs deben existir en el <tfoot> de la tabla
  setText('totalCentros', String(centros.length));
  setText('totalHect',    (Number(sumH).toFixed(2)));
  setText('totalTons',    fmt0(sumTons));
  setText('totalUnKg',    avgUnKg.toFixed(2));
  setText('totalRechazo', avgRechazo.toFixed(1) + '%');
  setText('totalRdmto',   avgRdmto.toFixed(1) + '%');

  return {
    hectareas: sumH,
    lineas: sumL,
    tons: sumTons,
    unKgProm: avgUnKg,
    rechazoProm: avgRechazo,
    rdmtoProm: avgRdmto,
  };
}

// Helper universal para mostrar valores, nunca null/undefined
export function mostrarValor(val) {
  return (val === null || val === undefined) ? '' : val;
}

// Export por defecto (blindaje)
export default { calcularTotalesTabla, mostrarValor };
