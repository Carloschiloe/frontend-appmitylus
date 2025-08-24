// js/centros/tabla_centros.js
import { Estado } from '../core/estado.js';
import { getCentrosAll } from '../core/centros_repo.js';
import { calcularTotalesTabla } from './helpers_centros.js';
import { registerTablaCentrosEventos } from './eventos_centros.js';

// Helper para capitalizar tipo título
function toTitleCase(str) {
  return (str || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// Inicializa la tabla y la configura
export function initTablaCentros() {
  const $t = window.$('#centrosTable');
  if (!$t.length) {
    console.error('No se encontró #centrosTable');
    return;
  }

  Estado.table = $t.DataTable({
    colReorder: true,
    dom: 'Bfrtip',
    buttons: [
      { extend: 'copyHtml5',  footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } },
      { extend: 'csvHtml5',   footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } },
      { extend: 'excelHtml5', footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } },
      { extend: 'pdfHtml5',   footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } }
    ],
    searching: false,
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json' },
    footerCallback: calcularTotalesTabla
  });

  Estado.table.draw();
  registerTablaCentrosEventos();
}

/**
 * Recarga los centros en la tabla.
 * - Si recibes `data` (array), la usa.
 * - Si no, consulta al API (getCentrosAll()).
 */
export async function loadCentros(data) {
  if (!Estado.table) {
    console.warn('DataTable no inicializada aún');
    return;
  }

  try {
    if (Array.isArray(data)) {
      Estado.centros = data;
    } else {
      Estado.centros = await getCentrosAll();
    }

    const rows = (Estado.centros || []).map((c, i) => {
      const cantLineas = Array.isArray(c.lines) ? c.lines.length : 0;
      const hect = parseFloat(c.hectareas) || 0;

      // SUMA de toneladas (todas las líneas)
      const tonsDisponibles = Array.isArray(c.lines)
        ? c.lines.reduce((sum, l) => sum + (+l.tons || 0), 0)
        : 0;

      // PROMEDIOS
      let sumUnKg = 0, countUnKg = 0;
      let sumRechazo = 0, countRechazo = 0;
      let sumRdmto = 0, countRdmto = 0;

      if (Array.isArray(c.lines)) {
        c.lines.forEach(l => {
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

      const avgUnKg    = countUnKg    ? (sumUnKg / countUnKg)       : 0;
      const avgRechazo = countRechazo ? (sumRechazo / countRechazo) : 0;
      const avgRdmto   = countRdmto   ? (sumRdmto / countRdmto)     : 0;

      const proveedor = toTitleCase(c.proveedor) || '-';
      const comuna    = toTitleCase(c.comuna)    || '-';

      const coordsCell = `<i class="material-icons btn-coords" data-idx="${i}" style="cursor:pointer">visibility</i>`;
      const accionesCell = `
        <i class="material-icons btn-toggle-lineas" data-idx="${i}" style="cursor:pointer">visibility</i>
        <i class="material-icons editar-centro" data-idx="${i}" style="cursor:pointer">edit</i>
        <i class="material-icons eliminar-centro" data-idx="${i}" style="cursor:pointer">delete</i>
      `;

      return [
        proveedor,
        comuna,
        c.code || '-',
        hect.toFixed(2),
        cantLineas,
        tonsDisponibles.toLocaleString('es-CL', { minimumFractionDigits: 0 }),
        avgUnKg.toFixed(2),
        avgRechazo.toFixed(1) + '%',
        avgRdmto.toFixed(1) + '%',
        coordsCell,
        accionesCell
      ];
    });

    Estado.table.clear().rows.add(rows).draw();

    // Reabrir acordeón si estaba abierto
    if (Estado.lineAcordionOpen !== null && Estado.centros[Estado.lineAcordionOpen]) {
      const tr = window.$('#centrosTable tbody tr').eq(Estado.lineAcordionOpen);
      tr.find('.btn-toggle-lineas').trigger('click');
    }
  } catch (e) {
    console.error('Error cargando centros:', e);
    window.M?.toast?.({ html: 'Error cargando centros', classes: 'red' });
  }
}
