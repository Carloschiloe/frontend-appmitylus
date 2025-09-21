// js/centros/tabla_centros.js
import { Estado } from '../core/estado.js';
import { getCentrosAll } from '../core/centros_repo.js';
import { calcularTotalesTabla } from './helpers_centros.js';
import { registerTablaCentrosEventos } from './eventos_centros.js';
import { tabMapaActiva } from '../core/utilidades_app.js';
import { renderMapaAlways } from '../mapas/control_mapa.js';

/* ===== Utiles ===== */
const fmt0 = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
const fmt2 = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num  = (v) => (v === '' || v === null || v === undefined) ? 0 : Number(v) || 0;
const esc  = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toTitleCase = (str) => (str || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

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
    // habilitamos búsqueda para poder usar el input externo (y ocultamos el default)
    searching: true,
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json' },
    footerCallback: calcularTotalesTabla,
    columnDefs: [
      { targets: [3], className: 'dt-right' },                 // Hectáreas
      { targets: [4,5], orderable: false, searchable: false }  // Detalle / Acciones
    ]
  });

  // Ocultar el buscador default de DataTables (usaremos el nuestro)
  window.$('#centrosTable_filter').hide();

  Estado.table.draw();
  registerTablaCentrosEventos();

  // Conectar input de búsqueda externo (si existe)
  const extSearch = document.querySelector('#filtroProveedor') ||
                    document.querySelector('input[placeholder^="Buscar proveedor"]');
  if (extSearch) {
    extSearch.addEventListener('input', () => {
      const q = (extSearch.value || '').trim();
      // Buscamos en todas las columnas → incluye Proveedor, Comuna y Código
      Estado.table.search(q).draw();
    });
  }
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
      const hect      = num(c.hectareas);

      const coordsCell = `
        <i class="material-icons btn-coords" data-idx="${i}" style="cursor:pointer" title="Ver detalles" aria-label="Ver detalles">visibility</i>`;
      const accionesCell = `
        <i class="material-icons btn-view-on-map" data-idx="${i}" style="cursor:pointer" title="Ver en mapa" aria-label="Ver en mapa">place</i>
        <i class="material-icons editar-centro"   data-idx="${i}" style="cursor:pointer" title="Editar centro" aria-label="Editar centro">edit</i>
        <i class="material-icons eliminar-centro" data-idx="${i}" style="cursor:pointer" title="Eliminar centro" aria-label="Eliminar centro">delete</i>`;

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

    // KPIs superiores (si existen)
    const kCent = document.querySelector('#kpiCentros');
    const kHa   = document.querySelector('#kpiHa');
    const kCom  = document.querySelector('#kpiComunas');
    if (kCent || kHa || kCom) {
      const totalHa = (Estado.centros || []).reduce((s, c) => s + (Number(c.hectareas) || 0), 0);
      const comunas = new Set((Estado.centros || []).map(c => (c.comuna || '').toLowerCase()).filter(Boolean));
      if (kCent) kCent.textContent = String(Estado.centros.length);
      if (kHa)   kHa.textContent   = fmt2.format(totalHa);
      if (kCom)  kCom.textContent  = String(comunas.size);
    }

    // Si el tab MAPA está activo, dibujamos/actualizamos el mapa
    if (tabMapaActiva?.()) await renderMapaAlways(true);

  } catch (e) {
    console.error('Error cargando centros:', e);
    window.M?.toast?.({ html: 'Error cargando centros', classes: 'red' });
  }
}
