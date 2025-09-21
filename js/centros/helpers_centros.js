// js/centros/helpers_centros.js
import { Estado } from '../core/estado.js';

/**
 * Footer de totales para la tabla de centros.
 * - Cuenta filas filtradas (no solo página)
 * - Suma hectáreas de las filas filtradas
 * - Tolerante a formatos CL/INT (11.495,73 / 11,08 / 11.08)
 *
 * Se usa como footerCallback de DataTables: (row, data, start, end, display) => calcularTotalesTabla(...)
 */
export function calcularTotalesTabla(row, data, start, end, display) {
  // Normaliza número con , o . como separador decimal
  const toNum = (v) => {
    if (v === '' || v === null || v === undefined) return 0;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;

    let s = String(v).trim();
    // quita espacios y etiquetas si llegan valores renderizados
    s = s.replace(/<[^>]*>/g, '').replace(/\s+/g, '');

    const hasComma = s.includes(',');
    const hasDot   = s.includes('.');

    if (hasComma && hasDot) {
      // típico CL: 11.495,73  -> 11495.73
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
      // 11,08 -> 11.08
      s = s.replace(',', '.');
    }
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  };

  const fmtHa = (n) =>
    Number(n || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Si existe la instancia de DataTables, usamos sus APIs para tomar
  // TODAS las filas filtradas (no solo la página visible).
  let countFiltradas = 0;
  let sumHectFiltradas = 0;

  const dt = Estado.table;
  if (dt && typeof dt.rows === 'function') {
    try {
      countFiltradas = dt.rows({ search: 'applied' }).count();
      const colData = dt.column(3, { search: 'applied' }).data(); // 3 = col "Hectáreas"
      const arr = colData && typeof colData.toArray === 'function' ? colData.toArray() : Array.from(colData || []);
      sumHectFiltradas = arr.reduce((acc, v) => acc + toNum(v), 0);
    } catch {
      // Fallback robusto si algo cambia en DT
      const all = Array.isArray(Estado.centros) ? Estado.centros : [];
      const query = (dt?.search && dt.search()) ? String(dt.search()).toLowerCase() : '';
      const filtradas = query
        ? all.filter(c =>
            String(c.code || '').toLowerCase().includes(query) ||
            String(c.proveedor || c.name || '').toLowerCase().includes(query) ||
            String(c.comuna || '').toLowerCase().includes(query) ||
            String(c.codigoArea || c?.detalles?.codigoArea || '').toLowerCase().includes(query)
          )
        : all;
      countFiltradas = filtradas.length;
      sumHectFiltradas = filtradas.reduce((a, c) => a + toNum(c?.hectareas), 0);
    }
  } else {
    // Fallback sin DataTables (suma dataset completo)
    const centros = Array.isArray(Estado.centros) ? Estado.centros : [];
    countFiltradas = centros.length;
    sumHectFiltradas = centros.reduce((a, c) => a + toNum(c?.hectareas), 0);
  }

  // Actualiza footer si existe (IDs en <tfoot>)
  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setText('totalCentros', String(countFiltradas));
  setText('totalHect', fmtHa(sumHectFiltradas));

  return {
    centrosFiltrados: countFiltradas,
    hectareasFiltradas: sumHectFiltradas
  };
}

// Helper universal para mostrar valores, nunca null/undefined
export function mostrarValor(val) {
  return (val === null || val === undefined) ? '' : val;
}

// Export por defecto (blindaje)
export default { calcularTotalesTabla, mostrarValor };
