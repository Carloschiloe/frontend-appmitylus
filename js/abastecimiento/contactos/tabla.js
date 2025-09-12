// /js/contactos/tabla.js 
import { state, $ } from './state.js';
import { centroCodigoById, comunaPorCodigo } from './normalizers.js';
import { abrirEdicion, eliminarContacto } from './form-contacto.js';
import { abrirDetalleContacto } from './form-contacto.js';
import { abrirModalVisita } from '../visitas/ui.js';

/* ---------- Config local ---------- */
const API_BASE = window.API_URL || '/api';
const fmtCL = (n) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 });

/* ---------- estilos: columna proveedor angosta + ellipsis + click seguro ---------- */
(function injectStyles () {
  const css = `
    #tablaContactos td .ellipsisCell{
      display:inline-block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; vertical-align:middle;
    }
    #tablaContactos td .ellipsisProv{ max-width:26ch; }

    /* clicks seguros en acciones */
    #tablaContactos td:last-child a.icon-action { 
      pointer-events:auto; cursor:pointer; display:inline-block; margin:0 6px;
    }
    #tablaContactos td:last-child a.icon-action i.material-icons{
      pointer-events:none; font-size:18px; vertical-align:middle;
    }

    /* celda tons mientras carga */
    #tablaContactos .tons-cell.loading{ opacity:.6 }
    #tablaContactos tfoot th{ font-weight:700; background:#f6f6f7 }
  `;
  if (!document.getElementById('tabla-contactos-inline-styles')) {
    const s = document.createElement('style');
    s.id = 'tabla-contactos-inline-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }
})();

/* -------------------- helpers locales (solo UI, no escriben BD) -------------------- */
const esc = (s='') => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

const esCodigoValido = (x) => /^\d{4,7}$/.test(String(x || ''));

/* ===== handler único expuesto para fallback inline ===== */
function _clickAccContacto(aEl){
  try{
    const id = aEl?.dataset?.id;
    const action = (aEl?.dataset?.action || '').toLowerCase();   // ← acción explícita
    const cls = (aEl?.className || '').toLowerCase();            // ← fallback por clase

    const c = state.contactosGuardados.find(x => String(x._id) === String(id));
    if (!c) { M.toast?.({ html: 'Contacto no encontrado', classes: 'red' }); return; }

    // Resolver acción final
    const act = action || (cls.includes('ver') ? 'ver'
                  : cls.includes('visita') ? 'visita'
                  : cls.includes('editar') ? 'editar'
                  : cls.includes('eliminar') ? 'eliminar'
                  : '');

    if (act === 'ver')     return abrirDetalleContacto(c); // modal de detalle de contacto
    if (act === 'visita')  return abrirModalVisita(c);     // modal de REGISTRO de visita
    if (act === 'editar')  return abrirEdicion(c);
    if (act === 'eliminar'){
      if (!confirm('¿Seguro que quieres eliminar este contacto?')) return;
      return eliminarContacto(id).catch(e => {
        console.error(e);
        M.toast?.({ html: 'No se pudo eliminar', classes: 'red' });
      });
    }
  }catch(err){
    console.error('[contactos] error en _clickAccContacto', err);
  }
}
window._clickAccContacto = _clickAccContacto;

/* ---------- Cache de totales de disponibilidad (incluye contactoId) ---------- */
// key: `${contactoId}|${proveedorKey}|${centroId}`
state.dispTotalCache = state.dispTotalCache || new Map();

/* Pequeno helper para GET con rango por defecto (y-1 .. y+1) */
async function getDisponibilidades(params){
  const y = new Date().getFullYear();
  const q = new URLSearchParams();
  // rango amplio por defecto para incluir años futuros
  q.set('from', params?.from || `${y-1}-01`);
  q.set('to',   params?.to   || `${y+1}-12`);

  if (params?.contactoId) q.set('contactoId', params.contactoId);
  if (params?.proveedorKey) q.set('proveedorKey', params.proveedorKey);
  if (params?.centroId) q.set('centroId', params.centroId);

  const url = `${API_BASE}/disponibilidades?${q.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('GET /disponibilidades '+res.status);
  const json = await res.json();
  return Array.isArray(json) ? json : (json.items || []);
}

/* Suma robusta con estrategia de fallbacks:
   1) por contactoId
   2) por proveedorKey + centroId
   3) por proveedorKey */
async function fetchTotalDisponibilidad({ contactoId='', proveedorKey='', centroId='' }){
  const cacheKey = `${contactoId||''}|${proveedorKey||''}|${centroId||''}`;
  if (state.dispTotalCache.has(cacheKey)) return state.dispTotalCache.get(cacheKey);

  function sum(list, filterByContactoId){
    let arr = Array.isArray(list) ? list : [];
    if (filterByContactoId) {
      arr = arr.filter(it => String(it.contactoId || '') === String(filterByContactoId));
    }
    return arr.reduce((acc, it)=> acc + Number(it.tonsDisponible ?? it.tons ?? 0), 0);
  }

  let total = 0;

  try{
    // 1) Intento por contactoId
    if (contactoId) {
      const list1 = await getDisponibilidades({ contactoId });
      // si el backend no filtró, hacemos filtro en cliente:
      total = sum(list1, contactoId);
    }

    // 2) Fallback por proveedorKey+centroId
    if (total === 0 && (proveedorKey || centroId)) {
      const list2 = await getDisponibilidades({ proveedorKey, centroId });
      total = sum(list2);
    }

    // 3) Fallback por solo proveedorKey
    if (total === 0 && proveedorKey) {
      const list3 = await getDisponibilidades({ proveedorKey });
      total = sum(list3);
    }
  }catch(e){
    console.error('[tablaContactos] fetchTotalDisponibilidad error', e);
  }

  state.dispTotalCache.set(cacheKey, total);
  return total;
}

/* ---------- Footer total (solo registros visibles/página actual/filtrados) ---------- */
function ensureFooter(){
  const table = $('#tablaContactos');
  if (!table) return;
  if (!table.tFoot) {
    const tfoot = table.createTFoot();
    const tr = tfoot.insertRow(0);
    for (let i=0; i<7; i++){
      const th = document.createElement('th');
      if (i === 5) th.textContent = 'Total página: 0';
      tr.appendChild(th);
    }
  }
}
function setFooterTotal(total){
  const table = $('#tablaContactos');
  if (!table || !table.tFoot) return;
  const th = table.tFoot.querySelectorAll('th')[5];
  if (th) th.textContent = `Total página: ${fmtCL(total)}`;
}

/* --------------------------------- DataTables --------------------------------- */
export function initTablaContactos() {
  const jq = window.jQuery || window.$;
  const tablaEl = $('#tablaContactos');
  if (!jq || !tablaEl) return;
  if (state.dt) return;

  ensureFooter();

  state.dt = jq('#tablaContactos').DataTable({
    dom: 'Blfrtip',
    buttons: [
      { extend: 'excelHtml5', title: 'Contactos_Abastecimiento' },
      { extend: 'pdfHtml5',   title: 'Contactos_Abastecimiento', orientation: 'landscape', pageSize: 'A4' }
    ],
    order: [[0,'desc']],
    paging: true,
    pageLength: 10,
    lengthMenu: [ [10, 25, 50, -1], [10, 25, 50, 'Todos'] ],
    autoWidth: false,
    responsive: true,
    scrollX: false,
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
    columnDefs: [
      { targets: 0, width: '110px' },   // Fecha (registro)
      { targets: 1, width: '260px' },   // Proveedor
      { targets: -1, orderable: false, searchable: false } // Acciones
    ]
  });

  // Delegación de acciones (bubbling)
  jq('#tablaContactos tbody')
    .off('click.contactos')
    .on('click.contactos', 'a.icon-action', function(e){
      e.preventDefault();
      e.stopPropagation();              // ← evita que abra otro modal por burbujeo
      _clickAccContacto(this);
    });

  // Cada vez que cambia la página / filtro / orden, recalculamos celdas y footer
  jq('#tablaContactos').on('draw.dt', async () => {
    await actualizarTonsVisiblesYFooter();
  });

  console.log('[contactos] DataTable lista. filas=', state.dt.rows().count());
}

/* ---------------------------- Actualizar celdas visibles ---------------------------- */
async function actualizarTonsVisiblesYFooter(){
  const jq = window.jQuery || window.$;
  if (!state.dt || !jq) return;

  // Recorre filas visibles en la página actual
  state.dt.rows({ page: 'current', search: 'applied' }).every(function(){
    const cellNode = state.dt.cell(this, 5).node(); // columna Tons
    if (!cellNode) return;
    const span = cellNode.querySelector('.tons-cell');
    if (!span) return;

    const proveedorKey = span.dataset.provkey || '';
    const centroId     = span.dataset.centroid || '';
    const contactoId   = span.dataset.contactoid || '';

    // Si ya está cargado, sólo recalcular footer
    const cached = span.dataset.value;
    if (cached !== undefined && cached !== null && cached !== '') return;

    // Marcar loading visual
    span.classList.add('loading');
    span.textContent = '…';

    // Fetch + cache + escribir valor
    fetchTotalDisponibilidad({ contactoId, proveedorKey, centroId }).then(total => {
      span.dataset.value = String(total);
      span.textContent = fmtCL(total);
      span.classList.remove('loading');

      // Recalcular total de página (puede llegar de a poco)
      recalcularFooterDesdeDom();
    });
  });

  // Al terminar el barrido inicial, setear total rápido con lo que ya estaba cargado
  recalcularFooterDesdeDom();
}

function recalcularFooterDesdeDom(){
  const table = $('#tablaContactos');
  if (!table) return;
  const spans = table.querySelectorAll('tbody .tons-cell');
  let sum = 0;
  spans.forEach(sp => {
    // solo contar las visibles en el DOM (página actual):
    const tr = sp.closest('tr');
    if (tr && tr.offsetParent !== null) {
      sum += Number(sp.dataset.value || 0);
    }
  });
  setFooterTotal(sum);
}

/* ------------------------------- Render de filas -------------------------------- */
export function renderTablaContactos() {
  const jq = window.jQuery || window.$;
  const tabla = $('#tablaContactos');
  if (!tabla) return;

  const base = Array.isArray(state.contactosGuardados) ? state.contactosGuardados : [];
  console.debug('[tablaContactos] render → items:', base.length, base[0]);

  // limpiar cache de totales para no mostrar datos viejos
  if (state.dispTotalCache && typeof state.dispTotalCache.clear === 'function') {
    state.dispTotalCache.clear();
  }

  const filas = base
    .slice()
    .sort((a,b)=>{
      const da = new Date(a.createdAt || a.fecha || 0).getTime();
      const db = new Date(b.createdAt || b.fecha || 0).getTime();
      return db - da;
    })
    .map(c => {
      // Fecha de registro/creación
      const f = new Date(c.createdAt || c.fecha || Date.now());
      const yyyy = f.getFullYear();
      const mm   = String(f.getMonth() + 1).padStart(2, '0');
      const dd   = String(f.getDate()).padStart(2, '0');
      const whenDisplay = `${yyyy}-${mm}-${dd}`;
      const whenKey     = f.getTime();

      // Centro (código) con fallback por centroId
      let centroCodigo = c.centroCodigo;
      if (!esCodigoValido(centroCodigo)) {
        centroCodigo = centroCodigoById(c.centroId) || '';
      }

      // Comuna
      const comuna = c.centroComuna || c.comuna || comunaPorCodigo(centroCodigo) || '';

      // Proveedor con ellipsis + tooltip
      const provName = esc(c.proveedorNombre || '');
      const provCell = provName
        ? `<span class="ellipsisCell ellipsisProv" title="${provName}">${provName}</span>`
        : '';

      // MMPP (tieneMMPP)
      const mmpp = c.tieneMMPP || '';

      // Tons: span con data para sumar por contactoId → prov+centro → prov
      const tonsCell = `<span class="tons-cell" data-contactoid="${esc(c._id || '')}" data-provkey="${esc(c.proveedorKey || '')}" data-centroid="${esc(c.centroId || '')}" data-value=""></span>`;

      // Acciones (con data-action explícito)
      const acciones = `
        <a href="#!" class="icon-action ver" data-action="ver" title="Ver detalle" data-id="${c._id}"
           onclick="window._clickAccContacto(this)"><i class="material-icons">visibility</i></a>
        <a href="#!" class="icon-action visita" data-action="visita" title="Registrar visita" data-id="${c._id}"
           onclick="window._clickAccContacto(this)"><i class="material-icons">event_available</i></a>
        <a href="#!" class="icon-action editar" data-action="editar" title="Editar" data-id="${c._id}"
           onclick="window._clickAccContacto(this)"><i class="material-icons">edit</i></a>
        <a href="#!" class="icon-action eliminar" data-action="eliminar" title="Eliminar" data-id="${c._id}"
           onclick="window._clickAccContacto(this)"><i class="material-icons">delete</i></a>
      `;

      // ⬇️ 7 columnas exactas para coincidir con el THEAD del HTML
      return [
        `<span data-order="${whenKey}">${whenDisplay}</span>`, // Fecha (registro)
        provCell,                                              // Proveedor
        esc(centroCodigo),                                     // Centro
        esc(comuna),                                           // Comuna
        esc(mmpp),                                             // MMPP
        tonsCell,                                              // Tons (se llena asíncrono)
        acciones                                               // Acciones
      ];
    });

  // Si DataTables ya está, refrescar por su API
  if (state.dt && jq) {
    state.dt.clear();
    state.dt.rows.add(filas).draw(false);
    // después del draw, se dispara actualizarTonsVisiblesYFooter por el evento 'draw.dt'
    console.log('[contactos] filas renderizadas:', filas.length);
    return;
  }

  // Fallback sin DataTables
  const tbody = $('#tablaContactos tbody');
  ensureFooter();
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:#888">No hay contactos registrados aún.</td></tr>`;
    setFooterTotal(0);
    return;
  }
  filas.forEach(arr => {
    const tr = document.createElement('tr');
    tr.innerHTML = arr.map(td => `<td>${td}</td>`).join('');
    tbody.appendChild(tr);
  });

  // Completar celdas + footer en fallback
  (async () => {
    const spans = tbody.querySelectorAll('.tons-cell');
    for (const sp of spans) {
      sp.classList.add('loading'); sp.textContent = '…';
      const total = await fetchTotalDisponibilidad({
        contactoId: sp.dataset.contactoid || '',
        proveedorKey: sp.dataset.provkey || '',
        centroId: sp.dataset.centroid || ''
      });
      sp.dataset.value = String(total);
      sp.textContent = fmtCL(total);
      sp.classList.remove('loading');
    }
    // total visible (todas las filas en fallback)
    let sum = 0;
    tbody.querySelectorAll('.tons-cell').forEach(s => sum += Number(s.dataset.value || 0));
    setFooterTotal(sum);
  })();
}

/* 🔁 refresco en vivo cuando otros módulos disparan reload */
document.addEventListener('reload-tabla-contactos', () => {
  console.debug('[tablaContactos] reload-tabla-contactos recibido');
  renderTablaContactos();
});
