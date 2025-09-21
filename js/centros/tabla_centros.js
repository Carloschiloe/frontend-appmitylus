import { Estado } from '../core/estado.js';
import { getCentrosAll } from '../core/centros_repo.js';
import { registerTablaCentrosEventos } from './eventos_centros.js';
import { tabMapaActiva } from '../core/utilidades_app.js';
import { renderMapaAlways } from '../mapas/control_mapa.js';

/* ===== Utils ===== */
const fmt2 = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc  = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toTitleCase = (str) => (str || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const num = (v) => (v === '' || v == null) ? 0 : Number(v) || 0;
const parseHaStr = (s) => { // "1.234,56" -> 1234.56
  if (s == null) return 0;
  const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ===== Estado de la vista ===== */
let $t;               // instancia jQuery del #centrosTable
let api;              // DataTables API
let $comunaSelect;    // <select id="filtroComuna">
let $buscador;        // <input id="buscarProveedor">

/* ===== KPIs + Footer con filas filtradas ===== */
function updateKpisYFooter() {
  if (!api) return;

  const rows = api.rows({ search: 'applied' }).data();
  let totalHa = 0;
  const comunas = new Set();

  rows.each(row => {
    // row = [ proveedor, comuna, codigo, hect_fmt, ... ]
    totalHa += parseHaStr(row[3]);
    const c = (row[1] || '').toString().trim().toLowerCase();
    if (c) comunas.add(c);
  });

  // KPIs superiores
  const kCent = document.getElementById('kpiCentros');
  const kHa   = document.getElementById('kpiHect');
  const kCom  = document.getElementById('kpiComunas');
  if (kCent) kCent.textContent = String(rows.length);
  if (kHa)   kHa.textContent   = fmt2.format(totalHa);
  if (kCom)  kCom.textContent  = String(comunas.size);

  // Footer tabla
  const totalCentrosEl = document.getElementById('totalCentros');
  const totalHectEl    = document.getElementById('totalHect');
  if (totalCentrosEl) totalCentrosEl.textContent = String(rows.length);
  if (totalHectEl)    totalHectEl.textContent    = fmt2.format(totalHa);
}

/* ===== Poblar <select> comunas y enlazar filtro ===== */
function populateComunasYWireFilter() {
  $comunaSelect = document.getElementById('filtroComuna');
  if (!$comunaSelect) return;

  // Construimos set con todas las comunas del dataset
  const comunas = Array.from(
    new Set((Estado.centros || []).map(c => (c.comuna || '').trim()).filter(Boolean))
  ).sort((a,b) => a.localeCompare(b, 'es'));

  // Rellenamos opciones
  $comunaSelect.innerHTML = `<option value="">Todas las comunas</option>` +
    comunas.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

  // Inicializa Materialize (si está presente), sino queda nativo
  try { window.M && window.M.FormSelect && window.M.FormSelect.init($comunaSelect); } catch {}

  // Filtro por comuna (columna 1)
  $comunaSelect.addEventListener('change', () => {
    const val = ($comunaSelect.value || '').trim();
    if (!api) return;
    if (!val) {
      api.column(1).search('', true, false).draw();
    } else {
      // regex exacta, case-insensitive
      api.column(1).search(`^${escapeRegex(val)}$`, true, false).draw();
    }
  });
}

/* ===== Buscador global externo ===== */
function wireExternalSearch() {
  $buscador = document.getElementById('buscarProveedor'); // ← este es tu input del HTML
  if (!$buscador) return;

  $buscador.addEventListener('input', () => {
    const q = ($buscador.value || '').trim();
    api.search(q).draw(); // busca en todas las columnas visibles
  });
}

/* ===== Inicializa DataTable ===== */
export function initTablaCentros() {
  const jq = window.$;
  $t = jq('#centrosTable');
  if (!$t.length) {
    console.error('No se encontró #centrosTable');
    return;
  }

  Estado.table = $t.DataTable({
    colReorder: true,
    // Quitamos el buscador nativo (no ponemos 'f' en dom)
    dom: 'Brtip',
    buttons: [
      { extend: 'copyHtml5',  footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } },
      { extend: 'csvHtml5',   footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } },
      { extend: 'excelHtml5', footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } },
      { extend: 'pdfHtml5',   footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } }
    ],
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json' },
    columnDefs: [
      { targets: [3], className: 'dt-right' },                 // Hectáreas
      { targets: [4,5], orderable: false, searchable: false }  // Detalle / Acciones
    ]
  });

  api = Estado.table;

  // Recalcular KPIs y footer en cada draw (filtrado/paginado/orden)
  $t.on('draw.dt', updateKpisYFooter);

  registerTablaCentrosEventos();
  wireExternalSearch();

  // Por si algún tema/estilo igual llegara a pintar el filtro nativo:
  window.$('#centrosTable_filter').hide();
}

/**
 * Carga/recarga centros en la tabla (y re-puebla comunas).
 * - Si recibes `data` (array), se usa.
 * - Si no, consulta al API (getCentrosAll()).
 */
export async function loadCentros(data) {
  if (!api) {
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

    api.clear().rows.add(rows).draw(); // draw() dispare updateKpisYFooter

    // Poblamos comunas (después de tener el dataset)
    populateComunasYWireFilter();

    // Botón limpiar filtros
    const btnLimpiar = document.getElementById('btnLimpiarFiltros');
    if (btnLimpiar) {
      btnLimpiar.onclick = () => {
        // Limpia select comuna y buscador
        if ($comunaSelect) {
          $comunaSelect.value = '';
          try { window.M && window.M.FormSelect && window.M.FormSelect.init($comunaSelect); } catch {}
          api.column(1).search('', true, false);
        }
        if ($buscador) $buscador.value = '';
        api.search('').draw();
      };
    }

    // Si el tab MAPA está activo, actualizamos
    if (tabMapaActiva?.()) await renderMapaAlways(true);

  } catch (e) {
    console.error('Error cargando centros:', e);
    window.M?.toast?.({ html: 'Error cargando centros', classes: 'red' });
  }
}
