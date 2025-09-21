// js/centros/tabla_centros.js
import { Estado } from '../core/estado.js';
import { getCentrosAll } from '../core/centros_repo.js';
import { refreshKpisFrom } from './helpers_centros.js';

// ===== Utiles =====
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toTitle = (str) => (str || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const fmt2 = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ===== Filtros in-memory =====
const Filtros = {
  comuna: '',
  proveedor: '',
};
function setFiltro(key, val){
  Filtros[key] = val || '';
  aplicarFiltrosYRender();
}
function filtrar(centros){
  let arr = Array.isArray(centros) ? centros.slice() : [];
  if (Filtros.comuna) {
    const c = Filtros.comuna.toLowerCase();
    arr = arr.filter(x => (x.comuna||'').toLowerCase() === c);
  }
  if (Filtros.proveedor) {
    const q = Filtros.proveedor.toLowerCase();
    arr = arr.filter(x => (x.proveedor||'').toLowerCase().includes(q));
  }
  return arr;
}

// ===== DataTable =====
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
      { extend: 'copyHtml5', footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } },
      { extend: 'csvHtml5',  footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } },
      { extend: 'excelHtml5',footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } },
      { extend: 'pdfHtml5',  footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } }
    ],
    searching: false,
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json' },
    columnDefs: [
      // numéricos derecha
      { targets: [3], className: 'dt-right' },
      // Detalle/Acciones sin orden/búsqueda
      { targets: [4,5], orderable: false, searchable: false }
    ]
  });

  Estado.table.draw();
  wireFiltrosUI();
}

/** Pinta filas desde una lista */
function renderRows(lista){
  const rows = (lista || []).map((c, i) => {
    const proveedor = toTitle(c.proveedor) || '-';
    const comuna    = toTitle(c.comuna)    || '-';
    const code      = c.code || '-';
    const hectStr   = c.hectareas!=null ? fmt2.format(Number(c.hectareas)||0) : '';

    const coordsCell = `<i class="material-icons btn-coords" data-idx="${i}" title="Ver coordenadas" aria-label="Ver coordenadas" style="cursor:pointer">visibility</i>`;
    const accionesCell = `
      <i class="material-icons ver-en-mapa" data-idx="${i}" title="Ver en mapa" aria-label="Ver en mapa" style="cursor:pointer;color:#1e40af;margin-right:8px">map</i>
      <i class="material-icons editar-centro" data-idx="${i}" title="Editar centro" aria-label="Editar centro" style="cursor:pointer;color:#ef6c00;margin-right:8px">edit</i>
      <i class="material-icons eliminar-centro" data-idx="${i}" title="Eliminar centro" aria-label="Eliminar centro" style="cursor:pointer;color:#e53935">delete</i>
    `;

    return [esc(proveedor), esc(comuna), esc(code), hectStr, coordsCell, accionesCell];
  });

  Estado.table.clear().rows.add(rows).draw();
}

/** Recarga (con o sin data) y repuebla filtros + KPIs */
export async function loadCentros(data) {
  if (!Estado.table) {
    console.warn('DataTable no inicializada aún');
    return;
  }

  try {
    Estado.centros = Array.isArray(data) ? data : await getCentrosAll();

    // Opciones de comuna
    const comunas = [...new Set((Estado.centros||[]).map(c => (c.comuna||'').toLowerCase()).filter(Boolean))]
      .sort()
      .map(s => toTitle(s));
    const $sel = $('#filtroComuna');
    if ($sel) {
      $sel.innerHTML = `<option value="">Todas las comunas</option>` +
        comunas.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
      window.M?.FormSelect?.init($sel);
    }

    aplicarFiltrosYRender();
  } catch (e) {
    console.error('Error cargando centros:', e);
    window.M?.toast?.({ html: 'Error cargando centros', classes: 'red' });
  }
}

function aplicarFiltrosYRender(){
  const lista = filtrar(Estado.centros);
  Estado.centrosFiltrados = lista;
  renderRows(lista);
  refreshKpisFrom(lista);
}

function wireFiltrosUI(){
  const $comuna = $('#filtroComuna');
  const $prov   = $('#buscarProveedor');
  const $clear  = $('#btnLimpiarFiltros');

  $comuna && $comuna.addEventListener('change', (e) => setFiltro('comuna', e.target.value));
  $prov && $prov.addEventListener('input', (e) => setFiltro('proveedor', e.target.value));
  $clear && $clear.addEventListener('click', () => {
    if ($comuna) $comuna.value = '';
    if ($prov)   $prov.value = '';
    setFiltro('comuna', ''); setFiltro('proveedor', '');
    window.M?.FormSelect?.init($comuna);
  });
}

