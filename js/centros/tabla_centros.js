import { Estado } from '../core/estado.js';
import { getCentrosAll } from '../core/centros_repo.js';
import { registerTablaCentrosEventos } from './eventos_centros.js';
import { tabMapaActiva } from '../core/utilidades_app.js';
import { renderMapaAlways } from '../mapas/control_mapa.js';

/* ===== Utiles ===== */
const fmt2 = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc  = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toTitle = (s) => (s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const parseHa = (v) => {
  if (v === '' || v == null) return 0;
  // acepta "12.345,67" o "12345.67" o número
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* === Rellena <select id="filtroComuna"> con comunas únicas === */
function fillFiltroComuna(centros) {
  const sel = document.getElementById('filtroComuna');
  if (!sel) return;
  const comunas = [...new Set((centros || [])
                  .map(c => (c.comuna || '').trim())
                  .filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  sel.innerHTML = `<option value="">Todas las comunas</option>` +
    comunas.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

/* === Actualiza KPIs superiores y footer según filas filtradas === */
function updateKpisAndFooter(dt) {
  const rows = dt.rows({ search: 'applied' }).data();
  let totalHa = 0;
  const comunasSet = new Set();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // row[1] = Comuna, row[3] = Hectáreas (string formateado)
    comunasSet.add((row[1] || '').toString().toLowerCase());
    totalHa += parseHa(row[3]);
  }

  // KPIs
  const kCent = document.getElementById('kpiCentros');
  const kHa   = document.getElementById('kpiHect');
  const kCom  = document.getElementById('kpiComunas');
  if (kCent) kCent.textContent = String(rows.length);
  if (kHa)   kHa.textContent   = fmt2.format(totalHa);
  if (kCom)  kCom.textContent  = String([...comunasSet].filter(Boolean).length);

  // Footer
  const fCent = document.getElementById('totalCentros');
  const fHa   = document.getElementById('totalHect');
  if (fCent) fCent.textContent = String(rows.length);
  if (fHa)   fHa.textContent   = fmt2.format(totalHa);
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
    // Quitamos 'f' para eliminar el buscador nativo (derecha)
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

  // Por si el tema/plantilla inyecta el filtro, lo forzamos oculto.
  window.$('#centrosTable_filter').hide();

  // Recalcular KPIs + footer al dibujar/filtrar/paginar
  Estado.table.on('draw', () => updateKpisAndFooter(Estado.table));

  registerTablaCentrosEventos();

  // ---- Filtros externos ----
  const inputBuscar = document.getElementById('buscarProveedor'); // proveedor o código
  if (inputBuscar) {
    inputBuscar.addEventListener('input', () => {
      const q = (inputBuscar.value || '').trim();
      Estado.table.search(q).draw();
    });
  }

  const selComuna = document.getElementById('filtroComuna');
  if (selComuna) {
    selComuna.addEventListener('change', () => {
      const v = selComuna.value.trim();
      // Columna 1 = "Comuna". Si hay comuna, filtramos exacto (regex anclado).
      if (v) Estado.table.column(1).search(`^${escapeRegex(v)}$`, true, false).draw();
      else   Estado.table.column(1).search('').draw();
    });
  }

  const btnClear = document.getElementById('btnLimpiarFiltros');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (selComuna) { selComuna.value = ''; Estado.table.column(1).search(''); }
      if (inputBuscar) inputBuscar.value = '';
      Estado.table.search('').draw();
    });
  }
}

/**
 * Carga/recarga los centros en la tabla.
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
      const proveedor = toTitle(c.proveedor) || '-';
      const comuna    = toTitle(c.comuna)    || '-';
      const hect      = parseHa(c.hectareas);

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

    Estado.table.clear().rows.add(rows).draw();    // 'draw' dispara updateKpisAndFooter
    fillFiltroComuna(Estado.centros);              // desplegable de comunas

    // Si el tab MAPA está activo, actualizamos el mapa
    if (tabMapaActiva?.()) await renderMapaAlways(true);

  } catch (e) {
    console.error('Error cargando centros:', e);
    window.M?.toast?.({ html: 'Error cargando centros', classes: 'red' });
  }
}
