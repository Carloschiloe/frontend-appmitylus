// js/centros/tabla_centros.js
import { Estado } from '../core/estado.js';
import { getCentrosAll } from '../core/centros_repo.js';
import { calcularTotalesTabla } from './helpers_centros.js';
import { registerTablaCentrosEventos } from './eventos_centros.js';
import { tabMapaActiva } from '../core/utilidades_app.js';
import { renderMapaAlways } from '../mapas/control_mapa.js';

/* ===== Utils ===== */
const fmt2 = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc  = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toTitleCase = (str) => (str || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const $ = (sel, ctx=document) => ctx.querySelector(sel);

function parseHa(v){
  if (v === '' || v == null) return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return 0;
  // soporta "1.234,56" y "1234.56"
  return Number(s.replace(/\./g,'').replace(',','.')) || 0;
}
const fmtHa = n => fmt2.format(Number(n||0));

function uniqComunas(rows){
  const set = new Set();
  (rows||[]).forEach(c=>{
    const v = (c.comuna || c?.detalles?.comuna || '').trim();
    if (v) set.add(toTitleCase(v));
  });
  return [...set].sort((a,b)=>a.localeCompare(b,'es'));
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

  // Conectar input de búsqueda externo (si existe)
  const extSearch = document.querySelector('#filtroProveedor') ||
                    document.querySelector('input[placeholder^="Buscar proveedor"]');
  if (extSearch) {
    extSearch.addEventListener('input', () => {
      const q = (extSearch.value || '').trim();
      // Busca en TODAS las columnas (proveedor, comuna y código incluidos)
      Estado.table.search(q).draw();
    });
  }

  // Al redibujar (paginación/filtro) recalculamos KPIs filtrados
  Estado.table.on('draw', () => updateKpisFiltrados());
  registerTablaCentrosEventos();
}

/* ===== KPIs + Filtro Comuna ===== */
function renderKpisGlobales(rows){
  const kCent = $('#kpiCentros');
  const kHa   = $('#kpiHectareas');
  const kCom  = $('#kpiComunas');

  const totalHa = rows.reduce((s,c)=> s + parseHa(c.hectareas ?? c?.detalles?.hectareas ?? c?.detalles?.ha), 0);
  const comunas = uniqComunas(rows);

  if (kCent) kCent.textContent = rows.length.toLocaleString('es-CL');
  if (kHa)   kHa.textContent   = fmtHa(totalHa);
  if (kCom)  kCom.textContent  = comunas.length.toLocaleString('es-CL');

  // poblar select de comunas
  const sel = $('#filtroComunas');
  if (sel){
    const cur = sel.value || '';
    sel.innerHTML = `<option value="">Todas las comunas</option>` + comunas.map(c=>`<option value="${c}">${c}</option>`).join('');
    sel.value = cur;
    if (window.M?.FormSelect) window.M.FormSelect.init(sel);
  }
}

function wireFiltroComunas(){
  const sel = $('#filtroComunas');
  if (!sel || !Estado.table) return;

  const escapeRx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  sel.addEventListener('change', () => {
    const v = sel.value || '';
    if (!v){
      Estado.table.column(1).search('').draw();
    } else {
      // match exacto de la comuna en la columna 1
      Estado.table.column(1).search('^' + escapeRx(v) + '$', true, false).draw();
    }
  }, { passive:true });
}

// Suma hectáreas y cuenta centros de las filas visibles
function updateKpisFiltrados(){
  const kCent = $('#kpiCentros');
  const kHa   = $('#kpiHectareas');
  if (!Estado.table || (!kCent && !kHa)) return;

  const data = Estado.table.rows({ filter: 'applied' }).data(); // arrays con strings formateados
  let sumHa = 0;
  for (let i=0; i<data.length; i++){
    const row = data[i];          // [Proveedor, Comuna, Código, Hectáreas, ...]
    sumHa += parseHa(row[3]);     // columna hectáreas formateada "42,67"
  }
  if (kCent) kCent.textContent = data.length.toLocaleString('es-CL');
  if (kHa)   kHa.textContent   = fmtHa(sumHa);
}

/**
 * Carga/recarga los centros en la tabla y actualiza KPIs + filtro.
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
        fmtHa(hect),
        coordsCell,
        accionesCell
      ];
    });

    Estado.table.clear().rows.add(rows).draw();

    // KPIs globales + filtro comunas
    renderKpisGlobales(Estado.centros);
    wireFiltroComunas();
    // y también los KPIs de lo filtrado (por si había búsqueda global activa)
    updateKpisFiltrados();

    // Si el tab MAPA está activo, actualizamos el mapa
    if (tabMapaActiva?.()) await renderMapaAlways(true);

  } catch (e) {
    console.error('Error cargando centros:', e);
    window.M?.toast?.({ html: 'Error cargando centros', classes: 'red' });
  }
}
