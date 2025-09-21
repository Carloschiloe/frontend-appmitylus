// js/centros/helpers_centros.js
import { Estado } from '../core/estado.js';

/**
 * Calcula totales simples para la tabla de centros (dataset completo)
 * y actualiza el footer. Firma compatible con DataTables footerCallback,
 * pero ignora los parámetros.
 */
export function calcularTotalesTabla(/* row, data, start, end, display */) {
  const toNum = (v) => {
    if (v === '' || v === null || v === undefined) return 0;
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  const centros = Array.isArray(Estado.centros) ? Estado.centros : [];

  const totalCentros = centros.length;
  const sumHectareas = centros.reduce((s, c) => s + toNum(c?.hectareas), 0);

  // Actualiza footer si existe
  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setText('totalCentros', String(totalCentros));
  setText('totalHect', sumHectareas.toFixed(2));

  return {
    centros: totalCentros,
    hectareas: sumHectareas,
  };
}

// Helper universal para mostrar valores, nunca null/undefined
export function mostrarValor(val) {
  return (val === null || val === undefined) ? '' : val;
}
