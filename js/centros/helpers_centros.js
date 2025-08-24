// js/centros/helpers_centros.js
import { Estado } from '../core/estado.js';

// Suma y promedios para el footer de la tabla
export function calcularTotalesTabla(row, data, start, end, display) {
  // DataTables pasa this = instancia; si la necesitas:
  // const api = this.api ? this.api() : row;

  let sumH = 0, sumL = 0, sumTons = 0;
  let sumUnKg = 0, sumRechazo = 0, sumRdmto = 0;
  let countUnKg = 0, countRechazo = 0, countRdmto = 0;

  const centros = Array.isArray(Estado.centros) ? Estado.centros : [];

  centros.forEach(c => {
    sumH += parseFloat(c.hectareas) || 0;
    sumL += Array.isArray(c.lines) ? c.lines.length : 0;

    if (Array.isArray(c.lines)) {
      c.lines.forEach(l => {
        sumTons += +l.tons || 0;

        if (l.unKg !== undefined && l.unKg !== null && l.unKg !== '') {
          sumUnKg += parseFloat(l.unKg) || 0;
          countUnKg++;
        }
        if (l.porcRechazo !== undefined && l.porcRechazo !== null && l.porcRechazo !== '') {
          sumRechazo += parseFloat(l.porcRechazo) || 0;
          countRechazo++;
        }
        if (l.rendimiento !== undefined && l.rendimiento !== null && l.rendimiento !== '') {
          sumRdmto += parseFloat(l.rendimiento) || 0;
          countRdmto++;
        }
      });
    }
  });

  const avgUnKg    = countUnKg    ? (sumUnKg    / countUnKg)    : 0;
  const avgRechazo = countRechazo ? (sumRechazo / countRechazo) : 0;
  const avgRdmto   = countRdmto   ? (sumRdmto   / countRdmto)   : 0;

  // Actualiza footer de la tabla
  const h       = document.getElementById('totalHect');
  const l       = document.getElementById('totalLineas');
  const tons    = document.getElementById('totalTons');
  const unKg    = document.getElementById('totalUnKg');
  const rechazo = document.getElementById('totalRechazo');
  const rdmto   = document.getElementById('totalRdmto');

  if (h)       h.textContent       = sumH.toFixed(2);
  if (l)       l.textContent       = sumL;
  if (tons)    tons.textContent    = Number(sumTons).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (unKg)    unKg.textContent    = avgUnKg.toFixed(2);
  if (rechazo) rechazo.textContent = avgRechazo.toFixed(1) + '%';
  if (rdmto)   rdmto.textContent   = avgRdmto.toFixed(1) + '%';
}

// Helper universal para mostrar valores, nunca null/undefined
export function mostrarValor(val) {
  return (val === null || val === undefined) ? '' : val;
}
