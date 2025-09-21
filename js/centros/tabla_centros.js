// js/centros/tabla_centros.js
import { Estado } from '../core/estado.js';
import { getCentrosAll } from '../core/centros_repo.js';
import { calcularTotalesTabla } from './helpers_centros.js';
import { registerTablaCentrosEventos } from './eventos_centros.js';

/* ===== Utiles ===== */
const fmt2 = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc  = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toTitleCase(str){ return (str || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); }

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
    footerCallback: calcularTotalesTabla, // setea #totalHect
    columnDefs: [
      // Hectáreas a la derecha
      { targets: [3], className: 'dt-right' },
      // Detalle y Acciones: sin orden/búsqueda
      { targets: [4,5], orderable: false, searchable: false }
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
      const proveedor = toTitleCase(c.proveedor) || '-';
      const comuna    = toTitleCase(c.comuna)    || '-';
      const codigo    = c.code || c.codigo_centro || '-';
      const hect      = (c.hectareas ?? '') === '' ? '' : fmt2.format(Number(c.hectareas) || 0);

      // Ícono “Detalle” (abre modal)
      const coordsCell = `
        <i class="material-icons btn-coords"
           data-idx="${i}"
           style="cursor:pointer"
           title="Ver detalles"
           aria-label="Ver detalles"
           role="button"
           tabindex="0">visibility</i>`;

      // Acciones: Ver en mapa / Editar / Eliminar
      const accionesCell = `
        <i class="material-icons btn-ver-mapa"
           data-idx="${i}"
           style="cursor:pointer"
           title="Ver en mapa"
           aria-label="Ver en mapa"
           role="button"
           tabindex="0">map</i>
        <i class="material-icons editar-centro"
           data-idx="${i}"
           style="cursor:pointer"
           title="Editar centro"
           aria-label="Editar centro"
           role="button"
           tabindex="0">edit</i>
        <i class="material-icons eliminar-centro"
           data-idx="${i}"
           style="cursor:pointer;color:#e53935"
           title="Eliminar centro"
           aria-label="Eliminar centro"
           role="button"
           tabindex="0">delete</i>`;

      return [
        esc(proveedor),
        esc(comuna),
        esc(codigo),
        hect,
        coordsCell,
        accionesCell
      ];
    });

    Estado.table.clear().rows.add(rows).draw();

    // Totales del footer: total de centros (además del totalHect que setea calcularTotalesTabla)
    const elTotalCentros = document.getElementById('totalCentros');
    if (elTotalCentros) elTotalCentros.textContent = String(Estado.centros?.length || 0);

  } catch (e) {
    console.error('Error cargando centros:', e);
    window.M?.toast?.({ html: 'Error cargando centros', classes: 'red' });
  }
}
