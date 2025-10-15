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
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x - yearStart) / 86400000 + 1) / 7);
}

/* =========== ESTILOS =========== */
(function injectStyles () {
  const css = `
    #tablaContactos_filter{ display:none !important; }
    .mmpp-table-wrap, #tablaContactos_wrapper{ overflow-x:hidden !important; }
    #tablaContactos{ table-layout:fixed !important; width:100%!important; max-width:100%!important; }
    #tablaContactos th, #tablaContactos td{
      padding:10px 8px!important; white-space:nowrap!important; overflow:hidden!important;
      text-overflow:ellipsis!important; box-sizing:border-box!important; vertical-align:middle;
    }
    /* anchos */
    #tablaContactos th:nth-child(1), #tablaContactos td:nth-child(1){ width:60px  !important; }  /* Semana  */
    #tablaContactos th:nth-child(2), #tablaContactos td:nth-child(2){ width:108px !important; }  /* Fecha    */
    #tablaContactos th:nth-child(3), #tablaContactos td:nth-child(3){ width:200px !important; }  /* Proveedor*/
    #tablaContactos th:nth-child(4), #tablaContactos td:nth-child(4){ width:160px !important; }  /* Centro+Comuna  */
    #tablaContactos th:nth-child(5), #tablaContactos td:nth-child(5){ width:82px  !important; text-align:center !important; }  /* Tons */
    #tablaContactos th:nth-child(6), #tablaContactos td:nth-child(6){ width:110px !important; }  /* Responsable */
    #tablaContactos th:nth-child(7), #tablaContactos td:nth-child(7){ width:160px !important; }  /* Acciones */
    /* celdas multi-línea */
    #tablaContactos td:nth-child(3){ white-space:normal!important; }
    .prov-cell, .centro-cell{ display:block; min-width:0; }
    .prov-top,.prov-sub,.centro-top,.centro-sub{ display:block; overflow:hidden; text-overflow:ellipsis; line-height:1.2; }
    .prov-sub,.centro-sub{ font-size:12px; color:#6b7280; }
    /* acciones */
    .actions{ display:flex; gap:8px; align-items:center; justify-content:flex-start; }
    .actions .icon-action{
      display:inline-flex; align-items:center; justify-content:center;
      width:32px; height:32px; border-radius:8px; border:1px solid #e5e7eb; background:#fff;
      box-shadow:0 2px 8px rgba(2,6,23,.05); cursor:pointer;
    }
    .actions .icon-action i{ font-size:18px; line-height:18px; }
    .tons-cell.loading{ opacity:.6; }
  `;
  if (!document.getElementById('tablaContactos-inline-css')){
    const s = document.createElement('style');
    s.id = 'tablaContactos-inline-css';
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

/* ==================== cache/servicios ==================== */
state.dispTotalCache = state.dispTotalCache || new Map();
const Cache = {
  get(key){ return state.dispTotalCache.get(key); },
  set(key,v){ state.dispTotalCache.set(key,v); }
};

async function getDisponibilidades(params = {}){
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/asignaciones/disponibilidades?${qs}`);
  const json = await res.json().catch(()=>[]);
  return Array.isArray(json) ? json : (json.items || []);
}

async function fetchTotalDisponibilidad({ contactoId='', proveedorKey='', centroId='' }){
  const key = `${contactoId||''}|${proveedorKey||''}|${centroId||''}`;
  if (Cache.get(key) != null) return Cache.get(key);

  const sum = (list, byId) => (Array.isArray(list)?list:[])
    .filter(it => !byId || String(it.contactoId||'')===String(byId))
    .reduce((a,it)=>a+Number(it.tonsDisponible??it.tons??0),0);

  let total = 0;
  try{
    if (contactoId){ total = sum(await getDisponibilidades({ contactoId }), contactoId); }
    if (total===0 && (proveedorKey||centroId)){
      total = sum(await getDisponibilidades({ proveedorKey, centroId }), contactoId);
    }
  }catch(e){ console.warn('[contactos] fetchTotalDisponibilidad', e); }

  Cache.set(key,total);
  return total;
}

/* ==================== footer ==================== */
function ensureFooter(){
  const table = $('#tablaContactos'); if (!table) return;
  if (!table.tFoot) {
    const tfoot = table.createTFoot();
    const tr = tfoot.insertRow(0);
    for (let i=0; i<7; i++){
      const th = document.createElement('th');
      if (i === 4) th.textContent = 'Total página: 0'; // Tons
      tr.appendChild(th);
    }
  }
}
function setFooterTotal(total){
  const table = $('#tablaContactos'); if (!table || !table.tFoot) return;
  const th = table.tFoot.querySelectorAll('th')[4];
  if (th) th.textContent = `Total página: ${fmtCL(total)}`;
}

/* ==================== DataTable ==================== */
export function initTablaContactos() {
  const jq = window.jQuery || window.$;
  const tablaEl = $('#tablaContactos');
  if (!jq || !tablaEl) return;

  ensureFooter();

  // Instancia
  const dt = jq('#tablaContactos').DataTable({
    dom: 'Blfrtip',
    buttons: [
      { extend: 'excelHtml5', title: 'Contactos_Abastecimiento' },
      { extend: 'pdfHtml5',   title: 'Contactos_Abastecimiento', orientation: 'landscape', pageSize: 'A4' }
    ],
    order: [[1,'desc']],
    paging: true,
    pageLength: 10,
    lengthMenu: [ [10,25,50,-1], [10,25,50,'Todos'] ],
    autoWidth: false,
    responsive: false,
    scrollX: false,
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
    columnDefs: [
      { targets: 0, width:'60px'  },
      { targets: 1, width:'108px' },
      { targets: 2, width:'200px' },
      { targets: 3, width:'160px' }, /* Centro (con comuna abajo) */
      { targets: 4, width:'82px',  className:'dt-center' },   /* Tons centrado */
      { targets: 5, width:'110px' },                          /* Responsable */
      { targets: 6, width:'160px', orderable:false, searchable:false } /* Acciones */
    ],
    drawCallback: function(){
      // asegurar cálculo de tons + footer en cada draw
      setTimeout(actualizarTonsVisiblesYFooter, 0);
    }
  });

  state.dt = dt;

  // Acciones
  jq('#tablaContactos tbody')
    .off('click.contactos')
    .on('click.contactos', 'a.icon-action', function(e){
      e.preventDefault(); e.stopPropagation();
      _clickAccContacto(this);
    });

  // Filtros externos
  const $global = document.querySelector('#buscarTablaContactos');
  $global?.addEventListener('input', (e) => {
    dt.search(e.target.value || '').draw();
  });
  const $fltSemana = document.getElementById('fltSemana');
  const $fltComuna = document.getElementById('fltComuna');
  const $fltResp   = document.getElementById('fltResp');
  $fltSemana?.addEventListener('change', ()=> dt.column(0).search($fltSemana.value||'', true, false).draw());
  // comuna está en la columna 3 (centro + comuna)
  $fltComuna?.addEventListener('change', ()=> dt.column(3).search($fltComuna.value||'', false, true).draw());
  $fltResp?.addEventListener('change',   ()=> dt.column(5).search($fltResp.value||'', true, false).draw());

  populateFiltrosDesdeDatos();
}

/* ==================== filtros (opciones) ==================== */
function populateFiltrosDesdeDatos(){
  const semanas = new Set();
  const comunas = new Set();
  const base = Array.isArray(state.contactosGuardados) ? state.contactosGuardados : [];
  base.forEach(c => {
    const f = new Date(c.createdAt || c.fecha || Date.now());
    if (!Number.isNaN(f.getTime())) semanas.add(String(getISOWeek(f)));
    const centroCodigo = c.centroCodigo || centroCodigoById(c.centroId) || '';
    const comuna = c.centroComuna || c.comuna || comunaPorCodigo(centroCodigo) || '';
    if (comuna) comunas.add(comuna);
  });
  const opt = (v)=> v ? `<option value="${esc(v)}">${esc(v)}</option>` : '';
  const $sem = document.getElementById('fltSemana');
  const $com = document.getElementById('fltComuna');
  if ($sem && $sem.children.length<=1) $sem.insertAdjacentHTML('beforeend', [...semanas].map(Number).filter(Number.isFinite).sort((a,b)=>a-b).map(String).map(opt).join(''));
  if ($com && $com.children.length<=1) $com.insertAdjacentHTML('beforeend', [...comunas].sort((a,b)=>a.localeCompare(b,'es')).map(opt).join(''));
}

/* ==================== tons visibles + footer ==================== */
function actualizarTonsVisiblesYFooter(){
  const jq = window.jQuery || window.$;
  if (!state.dt || !jq) return;

  try{
    state.dt.rows({ page: 'current', search: 'applied' }).every(function(){
      const cellNode = state.dt.cell(this, 4).node(); // Tons
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
      }).catch(()=>{ span.classList.remove('loading'); });
    });
  }catch(e){ console.warn('[contactos] actualizarTonsVisiblesYFooter()', e); }
}

function recalcularFooterDesdeDom(){
  const tbody = document.querySelector('#tablaContactos tbody');
  if (!tbody) return;
  let sum = 0;
  tbody.querySelectorAll('.tons-cell').forEach(s => sum += Number(s.dataset.value || 0));
  setFooterTotal(sum);
}

/* ==================== render tabla ==================== */
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

      // Proveedor + contacto
      const provName   = esc(c.proveedorNombre || '');
      const contactoNm = esc(c.contactoNombre || c.contacto || '');
      const provCell = provName
        ? `<span class="prov-cell" title="${provName}${contactoNm ? ' – ' + contactoNm : ''}">
             <span class="prov-top ellipsisProv">${provName}</span>
             ${contactoNm ? `<span class="prov-sub ellipsisProv">${contactoNm}</span>` : ``}
           </span>`
        : '';

      // Centro + Comuna (comuna en sublínea)
      const centroHTML = `
        <span class="centro-cell" title="${esc(centroCodigo)}${comuna? ' – '+esc(comuna):''}">
          <span class="centro-top">${esc(centroCodigo)||'—'}</span>
          ${comuna ? `<span class="centro-sub">${esc(comuna)}</span>` : ``}
        </span>`.trim();

      const tonsCell = `<span class="tons-cell" data-contactoid="${esc(c._id||'')}" data-provkey="${esc(c.proveedorKey||'')}" data-centroid="${esc(c.centroId || '')}" data-value=""></span>`;
      const responsable = esc(c.responsablePG || '—');

      const acciones = `
        <div class="actions">
          <a href="#!" class="icon-action" data-action="ver"      title="Ver contacto" data-id="${c._id}"><i class="material-icons">visibility</i></a>
          <a href="#!" class="icon-action" data-action="visita"   title="Registrar visita" data-id="${c._id}"><i class="material-icons">event_available</i></a>
          <a href="#!" class="icon-action" data-action="muestreo" title="Abrir muestreo" data-id="${c._id}"><i class="material-icons">science</i></a>
          <a href="#!" class="icon-action" data-action="editar"   title="Editar" data-id="${c._id}"><i class="material-icons">edit</i></a>
          <a href="#!" class="icon-action" data-action="eliminar" title="Eliminar" data-id="${c._id}"><i class="material-icons">delete</i></a>
        </div>`;

      return [
        esc(String(semana)),
        `<span data-order="${whenKey}">${whenDisplay}</span>`,
        provCell,
        centroHTML,
        tonsCell,
        responsable,
        acciones
      ];
    });

  if (state.dt && jq) {
    state.dt.clear();
    state.dt.rows.add(filas);
    state.dt.columns.adjust();
    state.dt.draw(false);
    // calcula tons luego del draw (sin await)
    setTimeout(actualizarTonsVisiblesYFooter, 0);
    return;
  }

  // Fallback (sin DT)
  const tbody = $('#tablaContactos tbody'); ensureFooter();
  if (!tbody) return;
  tbody.innerHTML = filas.length
    ? filas.map(row => `<tr>${row.map(td=>`<td>${td}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="7" style="color:#888">No hay contactos registrados aún.</td></tr>`;

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
