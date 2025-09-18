// js/centros/tabla_centros.js
import { Estado } from '../core/estado.js';
import { getCentrosAll } from '../core/centros_repo.js';
import { calcularTotalesTabla } from './helpers_centros.js';
import { registerTablaCentrosEventos } from './eventos_centros.js';

/* ===== Utiles ===== */
const fmt0 = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
const fmt2 = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num  = (v) => (v === '' || v === null || v === undefined) ? 0 : Number(v) || 0;
const pct  = (v, d = 1) => `${(Number(v) || 0).toFixed(d)}%`;
const esc  = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Helper para capitalizar tipo título
function toTitleCase(str) {
  return (str || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

/* ===== Inicializa DataTable ===== */
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
    footerCallback: calcularTotalesTabla,
    columnDefs: [
      // Alinear numéricos a la derecha
      { targets: [3,4,5,6,7,8], className: 'dt-right' },
      // Coords y Acciones: sin orden/búsqueda
      { targets: [9,10], orderable: false, searchable: false }
    ]
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
    Estado.centros = Array.isArray(data) ? data : await getCentrosAll();

    const rows = (Estado.centros || []).map((c, i) => {
      const lines = Array.isArray(c.lines) ? c.lines : [];
      const cantLineas = lines.length;
      const hect = num(c.hectareas);

      // SUMAS
      const tonsDisponibles = lines.reduce((s, l) => s + num(l.tons), 0);

      // PROMEDIOS (solo valores presentes)
      let sumUnKg = 0, nUnKg = 0;
      let sumRech = 0, nRech = 0;
      let sumRdm  = 0, nRdm  = 0;

      for (const l of lines) {
        if (l.unKg !== '' && l.unKg !== null && l.unKg !== undefined) { sumUnKg += num(l.unKg); nUnKg++; }
        if (l.porcRechazo !== '' && l.porcRechazo !== null && l.porcRechazo !== undefined) { sumRech += num(l.porcRechazo); nRech++; }
        if (l.rendimiento !== '' && l.rendimiento !== null && l.rendimiento !== undefined) { sumRdm  += num(l.rendimiento); nRdm++; }
      }

      const avgUnKg    = nUnKg  ? (sumUnKg / nUnKg) : 0;
      const avgRechazo = nRech  ? (sumRech / nRech) : 0;
      const avgRdmto   = nRdm   ? (sumRdm  / nRdm ) : 0;

      const proveedor = toTitleCase(c.proveedor) || '-';
      const comuna    = toTitleCase(c.comuna)    || '-';

      // Celdas con acciones
      const coordsCell = `<i class="material-icons btn-coords" data-idx="${i}" style="cursor:pointer" title="Ver coordenadas" aria-label="Ver coordenadas">visibility</i>`;
      const accionesCell = `
        <i class="material-icons btn-toggle-lineas" data-idx="${i}" style="cursor:pointer" title="Ver líneas" aria-label="Ver líneas">visibility</i>
        <i class="material-icons editar-centro" data-idx="${i}" style="cursor:pointer" title="Editar centro" aria-label="Editar centro">edit</i>
        <i class="material-icons eliminar-centro" data-idx="${i}" style="cursor:pointer" title="Eliminar centro" aria-label="Eliminar centro">delete</i>
      `;

      return [
        esc(proveedor),
        esc(comuna),
        esc(c.code || '-'),
        fmt2.format(hect),
        fmt0.format(cantLineas),
        fmt0.format(tonsDisponibles),
        fmt2.format(avgUnKg),
        pct(avgRechazo, 1),
        pct(avgRdmto, 1),
        coordsCell,
        accionesCell
      ];
    });

    Estado.table.clear().rows.add(rows).draw();

    // Reabrir acordeón si estaba abierto (by data-idx, independiente del orden)
    if (Estado.lineAcordionOpen !== null) {
      const $btn = window.$(`#centrosTable .btn-toggle-lineas[data-idx="${Estado.lineAcordionOpen}"]`);
      if ($btn.length) $btn.first().trigger('click');
    }
  } catch (e) {
    console.error('Error cargando centros:', e);
    window.M?.toast?.({ html: 'Error cargando centros', classes: 'red' });
  }
}
