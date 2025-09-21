// js/centros/tabla_centros.js (versión simple: solo datos generales)
import { Estado } from '../core/estado.js';
import { getCentrosAll } from '../core/centros_repo.js';
// OJO: ya no usamos helpers antiguos de totales de líneas/tons.
// import { calcularTotalesTabla } from './helpers_centros.js';
import { registerTablaCentrosEventos } from './eventos_centros.js';

/* ===== Utiles ===== */
const fmt2 = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num  = (v) => (v === '' || v === null || v === undefined) ? 0 : Number(v) || 0;
const esc  = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Capitalizar tipo título
function toTitleCase(str) {
  return (str || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

/* ===== FooterCallback simple (centros + hectáreas) ===== */
function footerTotalesSimple() {
  try {
    const totalCentros = (Estado.centros || []).length;
    const totalHect = (Estado.centros || []).reduce((s, c) => s + (num(c.hectareas) || 0), 0);

    const $centros = document.getElementById('totalCentros');
    const $hect = document.getElementById('totalHect');
    if ($centros) $centros.textContent = String(totalCentros);
    if ($hect) $hect.textContent = fmt2.format(totalHect);
  } catch (e) {
    console.warn('footerTotalesSimple() error:', e);
  }
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
    footerCallback: footerTotalesSimple,
    columnDefs: [
      // Hectáreas a la derecha
      { targets: [3], className: 'dt-right' },
      // Detalle y Acciones: sin orden/búsqueda
      { targets: [4, 5], orderable: false, searchable: false }
    ]
  });

  Estado.table.draw();
  registerTablaCentrosEventos?.();
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
      const hect = num(c.hectareas);
      const proveedor = toTitleCase(c.proveedor) || '-';
      const comuna    = toTitleCase(c.comuna)    || '-';

      // Celdas
      const coordsCell = `
        <i class="material-icons btn-coords" data-idx="${i}" style="cursor:pointer"
           title="Ver coordenadas" aria-label="Ver coordenadas">visibility</i>`;

      const accionesCell = `
        <i class="material-icons editar-centro" data-idx="${i}" style="cursor:pointer"
           title="Editar centro" aria-label="Editar centro">edit</i>
        <i class="material-icons eliminar-centro" data-idx="${i}" style="cursor:pointer"
           title="Eliminar centro" aria-label="Eliminar centro">delete</i>`;

      return [
        esc(proveedor),
        esc(comuna),
        esc(c.code || '-'),
        fmt2.format(hect),
        coordsCell,
        accionesCell
      ];
    });

    Estado.table.clear().rows.add(rows).draw();
    // Actualiza el footer
    footerTotalesSimple();
  } catch (e) {
    console.error('Error cargando centros:', e);
    window.M?.toast?.({ html: 'Error cargando centros', classes: 'red' });
  }
}
