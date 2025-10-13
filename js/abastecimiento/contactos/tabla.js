// /js/abastecimiento/contactos/tabla.js
import { state, $ } from './state.js';
import { centroCodigoById, comunaPorCodigo } from './normalizers.js';
import { abrirEdicion, eliminarContacto, abrirDetalleContacto } from './form-contacto.js';
import { abrirModalVisita } from '../visitas/tab.js';

const API_BASE = window.API_URL || '/api';
const fmtCL = (n) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 });

// ===== helpers =====
const esc = (s='') => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

const esCodigoValido = (x) => /^\d{4,7}$/.test(String(x || ''));

// Semana ISO
function getISOWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  return Math.floor(((date - yearStart) / 86400000 + 1)/7);
}

/* =========== ESTILOS: bloquea overflow, fija anchos y oculta filtro nativo =========== */
(function injectStyles () {
  const css = `
    /* Ocultar el buscador nativo de DataTables: queda SOLO el de la barra */
    #tablaContactos_filter{ display:none !important; }

    .mmpp-table-wrap, #tablaContactos_wrapper{ overflow-x: hidden !important; }

    #tablaContactos{
      table-layout: fixed !important;
      width: 100% !important;
      max-width: 100% !important;
      border-collapse: collapse;
    }

    /* padding compacto y ellipsis */
    #tablaContactos th, #tablaContactos td{
      padding: 10px 8px !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      box-sizing: border-box !important;
      vertical-align: middle;
    }

    /* anchos afinados para no forzar scroll */
    #tablaContactos th:nth-child(1), #tablaContactos td:nth-child(1){ width:60px  !important; }  /* Semana  */
    #tablaContactos th:nth-child(2), #tablaContactos td:nth-child(2){ width:108px !important; }  /* Fecha    */
    #tablaContactos th:nth-child(3), #tablaContactos td:nth-child(3){ width:200px !important; }  /* Proveedor*/
    #tablaContactos th:nth-child(4), #tablaContactos td:nth-child(4){ width:90px  !important; }  /* Centro   */
    #tablaContactos th:nth-child(5), #tablaContactos td:nth-child(5){ width:110px !important; }  /* Comuna   */
    #tablaContactos th:nth-child(6), #tablaContactos td:nth-child(6){ width:82px  !important; text-align:center !important; }  /* Tons centrado */
    #tablaContactos th:nth-child(7), #tablaContactos td:nth-child(7){ width:110px !important; }  /* Responsable */
    #tablaContactos th:nth-child(8), #tablaContactos td:nth-child(8){ width:160px !important; }  /* Acciones + holgura */

    /* Proveedor con ellipsis controlada */
    #tablaContactos td .ellipsisProv{ display:inline-block; max-width:22ch; }

    /* Acciones: que no se corten */
    #tablaContactos td:last-child{ overflow: visible !important; }
    #tablaContactos td:last-child .actions { display:flex; gap:6px; align-items:center; justify-content:flex-start; }
    #tablaContactos td:last-child a.icon-action {
      pointer-events:auto; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;
      width:30px; height:30px; border-radius:8px; background:#eef2ff; border:1px solid #c7d2fe;
    }
    #tablaContactos td:last-child a.icon-action i{ font-size:18px; color:#0ea5a8; }

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

/* ==================== acciones de fila ==================== */
async function _clickAccContacto(aEl){
  try{
    const id = aEl?.dataset?.id;
    const action = (aEl?.dataset?.action || '').toLowerCase();
    const c = state.contactosGuardados.find(x => String(x._id) === String(id));
    if (!c) { M.toast?.({ html: 'Contacto no encontrado', classes: 'red' }); return; }
    if (action === 'ver')     return abrirDetalleContacto(c);
    if (action === 'visita')  return abrirModalVisita(c);
    if (action === 'muestreo'){ document.dispatchEvent(new CustomEvent('muestreo:open',{detail:{contacto:c}})); return; }
    if (action === 'editar')  return abrirEdicion(c);
    if (action === 'eliminar'){
      if (aEl.dataset.busy === '1') return;
      aEl.dataset.busy = '1';
      try{
        if (!confirm('¿Seguro que quieres eliminar este contacto?')) return;
        await eliminarContacto(id);
      }catch(e){ console.error(e); M.toast?.({ html:'No se pudo eliminar', classes:'red' }); }
      finally{ delete aEl.dataset.busy; }
    }
  }catch(err){ console.error('[contactos] _clickAccContacto', err); }
}
window._clickAccContacto = _clickAccContacto;

/* ==================== totals cache ==================== */
state.dispTotalCache = state.dispTotalCache || new Map();

async function getDisponibilidades(params){
  const y = new Date().getFullYear();
  const q = new URLSearchParams();
  q.set('from', params?.from || `${y-1}-01`);
  q.set('to',   params?.to   || `${y+1}-12`);
  if (params?.contactoId)   q.set('contactoId', params.contactoId);
  if (params?.proveedorKey) q.set('proveedorKey', params.proveedorKey);
  if (params?.centroId)     q.set('centroId', params.centroId);
  const res = await fetch(`${API_BASE}/disponibilidades?${q.toString()}`);
  if (!res.ok) throw new Error('GET /disponibilidades '+res.status);
  const json = await res.json();
  return Array.isArray(json) ? json : (json.items || []);
}

async function fetchTotalDisponibilidad({ contactoId='', proveedorKey='', centroId='' }){
  const key = `${contactoId||''}|${proveedorKey||''}|${centroId||''}`;
  if (state.dispTotalCache.has(key)) return state.dispTotalCache.get(key);

  const sum = (list, byId) => (Array.isArray(list)?list:[])
    .filter(it => !byId || String(it.contactoId||'')===String(byId))
    .reduce((a,it)=>a+Number(it.tonsDisponible??it.tons??0),0);

  let total = 0;
  try{
    if (contactoId){ total = sum(await getDisponibilidades({ contactoId }), contactoId); }
    if (total===0 && (proveedorKey||centroId)){ total = sum(await getDisponibilidades({ proveedorKey, centroId })); }
    if (total===0 && proveedorKey){ total = sum(await getDisponibilidades({ proveedorKey })); }
  }catch(e){ console.error('[tablaContactos] fetchTotalDisponibilidad', e); }

  state.dispTotalCache.set(key,total);
  return total;
}

/* ==================== footer ==================== */
function ensureFooter(){
  const table = $('#tablaContactos'); if (!table) return;
  if (!table.tFoot) {
    const tfoot = table.createTFoot();
    const tr = tfoot.insertRow(0);
    for (let i=0; i<8; i++){
      const th = document.createElement('th');
      if (i === 5) th.textContent = 'Total página: 0'; // Tons
      tr.appendChild(th);
    }
  }
}
function setFooterTotal(total){
  const table = $('#tablaContactos'); if (!table || !table.tFoot) return;
  const th = table.tFoot.querySelectorAll('th')[5];
  if (th) th.textContent = `Total página: ${fmtCL(total)}`;
}

/* ==================== DataTable ==================== */
export function initTablaContactos() {
  const jq = window.jQuery || window.$;
  const tablaEl = $('#tablaContactos');
  if (!jq || !tablaEl) return;
  if (state.dt) return;

  ensureFooter();

  state.dt = jq('#tablaContactos').DataTable({
    // SIN buscador nativo (lo ocultamos con CSS por seguridad también)
    dom: 'Bltip',
    buttons: [
      { extend: 'excelHtml5', title: 'Contactos_Abastecimiento' },
      { extend: 'pdfHtml5',   title: 'Contactos_Abastecimiento', orientation: 'landscape', pageSize: 'A4' }
    ],
    order: [[1,'desc']],
    paging: true,
    pageLength: 10,
    lengthMenu: [ [10,25,50,-1], [10,25,50,'Todos'] ],
    autoWidth: false,
    responsive: false,               // respetar widths fijos
    scrollX: false,
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
    columnDefs: [
      { targets: 0, width:'60px'  },
      { targets: 1, width:'108px' },
      { targets: 2, width:'200px' },
      { targets: 3, width:'90px'  },
      { targets: 4, width:'110px' },
      { targets: 5, width:'82px',  className:'dt-center' },   // Tons centrado
      { targets: 6, width:'110px' },
      { targets: 7, width:'160px', orderable:false, searchable:false }
    ]
  });

  // Acciones
  jq('#tablaContactos tbody')
    .off('click.contactos')
    .on('click.contactos', 'a.icon-action', function(e){
      e.preventDefault(); e.stopPropagation();
      _clickAccContacto(this);
    });

  // Redibujo => actualizar tons + footer
  jq('#tablaContactos').on('draw.dt', async () => { await actualizarTonsVisiblesYFooter(); });

  // Filtros externos
  const dt = state.dt;
  document.getElementById('searchContactos')?.addEventListener('input', (e)=> {
    dt.search(e.target.value || '').draw();
  });
  const $fltSemana = document.getElementById('fltSemana');
  const $fltComuna = document.getElementById('fltComuna');
  const $fltResp   = document.getElementById('fltResp');
  $fltSemana?.addEventListener('change', ()=> dt.column(0).search($fltSemana.value||'', true, false).draw());
  $fltComuna?.addEventListener('change', ()=> dt.column(4).search($fltComuna.value||'', true, false).draw());
  $fltResp?.addEventListener('change',   ()=> dt.column(6).search($fltResp.value||'', true, false).draw());

  populateFiltrosDesdeDatos();
}

/* ==================== filtros (opciones) ==================== */
function populateFiltrosDesdeDatos(){
  const semanas = new Set();
  const comunas = new Set();
  const base = Array.isArray(state.contactosGuardados) ? state.contactosGuardados : [];
  base.forEach(c => {
    const f = new Date(c.createdAt || c.fecha || Date.now());
    semanas.add(String(getISOWeek(f)));
    const centroCodigo = c.centroCodigo || centroCodigoById(c.centroId) || '';
    comunas.add(c.centroComuna || c.comuna || comunaPorCodigo(centroCodigo) || '');
  });
  const opt = (v)=> v ? `<option value="${esc(v)}">${esc(v)}</option>` : '';
  const $sem = document.getElementById('fltSemana');
  const $com = document.getElementById('fltComuna');
  if ($sem && $sem.children.length<=1) $sem.insertAdjacentHTML('beforeend', [...semanas].sort((a,b)=>a-b).map(opt).join(''));
  if ($com && $com.children.length<=1) $com.insertAdjacentHTML('beforeend', [...comunas].sort().map(opt).join(''));
}

/* ==================== tons visibles + footer ==================== */
async function actualizarTonsVisiblesYFooter(){
  const jq = window.jQuery || window.$;
  if (!state.dt || !jq) return;

  state.dt.rows({ page: 'current', search: 'applied' }).every(function(){
    const cellNode = state.dt.cell(this, 5).node(); // Tons
    if (!cellNode) return;
    const span = cellNode.querySelector('.tons-cell');
    if (!span) return;

    const proveedorKey = span.dataset.provkey || '';
    const centroId     = span.dataset.centroid || '';
    const contactoId   = span.dataset.contactoid || '';

    if (span.dataset.value !== undefined && span.dataset.value !== '') return;

    span.classList.add('loading');
    span.textContent = '…';

    fetchTotalDisponibilidad({ contactoId, proveedorKey, centroId }).then(total => {
      span.dataset.value = String(total);
      span.textContent = fmtCL(total);
      span.classList.remove('loading');
      recalcularFooterDesdeDom();
    });
  });

  recalcularFooterDesdeDom();
}

function recalcularFooterDesdeDom(){
  const table = $('#tablaContactos'); if (!table) return;
  const spans = table.querySelectorAll('tbody .tons-cell');
  let sum = 0;
  spans.forEach(sp => {
    const tr = sp.closest('tr');
    if (tr && tr.offsetParent !== null) sum += Number(sp.dataset.value || 0);
  });
  setFooterTotal(sum);
}

/* ==================== render ==================== */
export function renderTablaContactos() {
  const jq = window.jQuery || window.$;
  const tabla = $('#tablaContactos'); if (!tabla) return;

  const base = Array.isArray(state.contactosGuardados) ? state.contactosGuardados : [];
  if (state.dispTotalCache?.clear) state.dispTotalCache.clear();

  const filas = base
    .slice()
    .sort((a,b)=> (new Date(b.createdAt||b.fecha||0)) - (new Date(a.createdAt||a.fecha||0)) )
    .map(c => {
      const f = new Date(c.createdAt || c.fecha || Date.now());
      const whenKey = f.getTime();
      const whenDisplay = `${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,'0')}-${String(f.getDate()).padStart(2,'0')}`;
      const semana = getISOWeek(f);

      let centroCodigo = c.centroCodigo;
      if (!esCodigoValido(centroCodigo)) centroCodigo = centroCodigoById(c.centroId) || '';
      const comuna = c.centroComuna || c.comuna || comunaPorCodigo(centroCodigo) || '';

      const provName = esc(c.proveedorNombre || '');
      const provCell = provName ? `<span class="ellipsisProv" title="${provName}">${provName}</span>` : '';

      const tonsCell = `<span class="tons-cell" data-contactoid="${esc(c._id || '')}" data-provkey="${esc(c.proveedorKey || '')}" data-centroid="${esc(c.centroId || '')}" data-value=""></span>`;
      const responsable = esc(c.responsablePG || '—');

      const acciones = `
        <div class="actions">
          <a href="#!" class="icon-action" data-action="ver"       title="Ver detalle"        data-id="${c._id}"><i class="material-icons">visibility</i></a>
          <a href="#!" class="icon-action" data-action="visita"    title="Registrar visita"   data-id="${c._id}"><i class="material-icons">event_available</i></a>
          <a href="#!" class="icon-action" data-action="muestreo"  title="Registrar muestreo" data-id="${c._id}"><i class="material-icons">science</i></a>
          <a href="#!" class="icon-action" data-action="editar"    title="Editar"             data-id="${c._id}"><i class="material-icons">edit</i></a>
          <a href="#!" class="icon-action" data-action="eliminar"  title="Eliminar"           data-id="${c._id}"><i class="material-icons">delete</i></a>
        </div>`;

      // columnas: Semana, Fecha, Proveedor, Centro, Comuna, Tons, Responsable, Acciones
      return [
        esc(String(semana)),
        `<span data-order="${whenKey}">${whenDisplay}</span>`,
        provCell,
        esc(centroCodigo),
        esc(comuna),
        tonsCell,
        responsable,
        acciones
      ];
    });

  // Con DataTables
  if (state.dt && jq) {
    state.dt.clear();
    state.dt.rows.add(filas).draw(false);
    populateFiltrosDesdeDatos();
    return;
  }

  // Fallback (sin DT)
  const tbody = $('#tablaContactos tbody'); ensureFooter();
  if (!tbody) return;
  tbody.innerHTML = filas.length
    ? filas.map(row => `<tr>${row.map(td=>`<td>${td}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="8" style="color:#888">No hay contactos registrados aún.</td></tr>`;

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
    let sum = 0;
    tbody.querySelectorAll('.tons-cell').forEach(s => sum += Number(s.dataset.value || 0));
    setFooterTotal(sum);
  })();
}

document.addEventListener('reload-tabla-contactos', () => renderTablaContactos());
