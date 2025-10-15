// /js/abastecimiento/visitas/ui.js
import { state, $, setVal, slug } from '../contactos/state.js';
import { centroCodigoById } from './normalizers.js';
import { getAll, create, update } from './api.js';

import {
  mountFotosUIOnce,
  resetFotosModal,
  handleFotosAfterSave,
  renderGallery,
} from './fotos/ui.js';

import { wireActionsGlobalsOnce, manejarAccionVisitaEl } from './actions.js';

console.log('[visitas/ui] cargado');

/* ================= estilos mínimos ================= */
(function injectStyles(){
  const css = `
    .mmpp-table-wrap{ overflow-x:visible!important; }

    #tablaVisitas{ width:100%!important; }
    #tablaVisitas th, #tablaVisitas td{
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      padding:10px 8px!important; box-sizing:border-box;
      vertical-align: middle;
    }

    .v-prov, .v-centro{ display:block; min-width:0; }
    .v-top{ display:block; font-weight:600; }
    .v-sub{ display:block; font-size:12px; color:#6b7280; line-height:1.2; }

    #tablaVisitas td:last-child{ overflow:visible!important; text-align:center; }
    #tablaVisitas td .acts{ display:flex; gap:8px; align-items:center; justify-content:center; }
    #tablaVisitas td .acts a{
      display:inline-flex; align-items:center; justify-content:center;
      width:32px; height:32px; border-radius:8px; border:1px solid #e5e7eb; background:#fff;
      box-shadow:0 2px 8px rgba(2,6,23,.05); cursor:pointer;
    }
    #tablaVisitas td .acts a i{ font-size:18px; line-height:18px; }

    #tablaVisitas td .acts a.mu-red  { border-color:#fecaca; background:#fff1f2; }
    #tablaVisitas td .acts a.mu-red  i{ color:#dc2626; }
    #tablaVisitas td .acts a.mu-green{ border-color:#bbf7d0; background:#ecfdf5; }
    #tablaVisitas td .acts a.mu-green i{ color:#059669; }

    /* Filtros externos */
    .visitas-filtros{
      display:flex; gap:12px; align-items:center; flex-wrap:wrap;
      margin:10px 0 6px;
    }
    .visitas-filtros .fld{
      display:flex; align-items:center; gap:6px;
    }
    .visitas-filtros select{
      min-width:140px; padding:6px 8px;
      border:1px solid #e5e7eb; border-radius:8px; background:#fff;
    }
  `;
  if (!document.getElementById('visitas-inline-styles')){
    const s = document.createElement('style');
    s.id = 'visitas-inline-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }
})();

/* ============ parche seguro para toasts que se quedan pegados ============ */
(function patchToastOnce(){
  if (!window.M || window.__toast_patched) return;
  window.__toast_patched = true;
  const orig = M.toast;
  M.toast = (opts={})=>{
    try{ M.Toast.dismissAll(); }catch{}
    const o = (typeof opts==='string') ? { html:opts } : { ...opts };
    if (o.displayLength == null) o.displayLength = 1600;
    if (o.inDuration == null)    o.inDuration    = 120;
    if (o.outDuration == null)   o.outDuration   = 140;
    return orig(o);
  };
})();

/* ================= utils ================= */
const esc = (s='') => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

const fmtISO = (d) => {
  const x = (d instanceof Date) ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth()+1).padStart(2,'0');
  const dd = String(x.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
};
const trunc = (s='', max=42) => (String(s).length>max ? String(s).slice(0,max-1)+'…' : String(s));

function getISOWeek(date){
  const d = (date instanceof Date) ? new Date(date) : new Date(date);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 3 - ((d.getDay()+6)%7));
  const week1 = new Date(d.getFullYear(),0,4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay()+6)%7)) / 7);
}
function proveedorDeVisita(v){
  const id = v?.contactoId ? String(v.contactoId) : null;
  if (!id) return { empresa:'', contacto:'' };
  const c = (state.contactosGuardados || []).find(x => String(x._id) === id);
  return { empresa: c?.proveedorNombre || '', contacto: c?.contactoNombre || c?.contacto || '' };
}
function codigoDeVisita(v){
  return v.centroCodigo || (v.centroId ? centroCodigoById(v.centroId) : '') || '';
}
function comunaDeVisita(v){
  if (v.centroComuna) return v.centroComuna;
  const code = codigoDeVisita(v);
  const id   = v.centroId;
  const lista = state.listaCentros || [];
  const m = lista.find(c => (id && (String(c._id||c.id)===String(id))) || (code && (String(c.code||c.codigo)===String(code))));
  return m?.comuna || '';
}
const normalizeEstado = (s='') => {
  const x = String(s||'').trim();
  return (x === 'Tomar/entregar muestras') ? 'Tomar muestras' : x;
};

/* ================= DataTable helpers ================= */
let dtV = null;

function safeAdjust(){
  if (!dtV) return;
  try { dtV.columns.adjust().draw(false); } catch {}
}
const rafThrottle = (fn) => { let t=0; return (...a)=>{ if(t) return; t=requestAnimationFrame(()=>{t=0; fn(...a);}); }; };
const adjustNow = rafThrottle(safeAdjust);
export function forceAdjustVisitas(){ adjustNow(); }

/* ================= render tabla (8 columnas) ================= */
export async function renderTablaVisitas(){
  const jq = window.jQuery || window.$;
  let visitas = [];
  try{
    visitas = await getAll();
    state.visitasGuardadas = visitas.slice();
  }catch(e){
    console.error('[visitas/ui] getAll error:', e?.message || e);
    visitas = [];
  }

  const filas = visitas
    .slice()
    .sort((a,b)=> new Date(b.fecha||0) - new Date(a.fecha||0))
    .map((v)=>{
      const f      = new Date(v.fecha || Date.now());
      const semana = getISOWeek(f);
      const fecha  = fmtISO(f);

      const { empresa, contacto } = proveedorDeVisita(v);
      const provHTML = `
        <span class="v-prov" title="${esc(empresa)}${contacto? ' – '+esc(contacto):''}">
          <span class="v-top">${esc(trunc(empresa,48))||'—'}</span>
          ${contacto ? `<span class="v-sub">${esc(trunc(contacto,46))}</span>` : ``}
        </span>`.trim();

      const centro = codigoDeVisita(v);
      const comuna = comunaDeVisita(v);
      const centroHTML = `
        <span class="v-centro" title="${esc(centro)}${comuna? ' – '+esc(comuna):''}">
          <span class="v-top">${esc(centro)||'—'}</span>
          ${comuna ? `<span class="v-sub">${esc(comuna)}</span>` : ``}
        </span>`.trim();

      const proximoPaso = normalizeEstado(v.estado || '');
      const tons        = (v.tonsComprometidas ?? '') + '';

      const fpp = v.proximoPasoFecha ? new Date(v.proximoPasoFecha) : null;
      const fppISO = fpp && !Number.isNaN(fpp.getTime()) ? fmtISO(fpp) : '';
      const fppHTML = fppISO
        ? `<span data-order="${fpp.getTime()}">${fppISO}</span>`
        : `<span data-order="-1"></span>`;

      const vid = esc(v._id || '');
      const tieneMuestreo = String(v.enAgua || '').toLowerCase().startsWith('s');
      const muClase = tieneMuestreo ? 'mu-green' : 'mu-red';
      const muTitle = tieneMuestreo ? 'Ver muestreo' : 'Sin muestreo';

      const acciones = `
        <div class="acts">
          <a href="#!" class="${muClase}" data-action="muestreo" title="${muTitle}" data-id="${vid}"
             onpointerdown="window.__visAction && window.__visAction(this,event)" ontouchstart="window.__visAction && window.__visAction(this,event)" onclick="return false;">
            <i class="material-icons">science</i>
          </a>
          <a href="#!" data-action="ver" title="Ver visita" data-id="${vid}"
             onpointerdown="window.__visAction && window.__visAction(this,event)" ontouchstart="window.__visAction && window.__visAction(this,event)" onclick="return false;">
            <i class="material-icons">visibility</i>
          </a>
          <a href="#!" data-action="editar" title="Editar visita" data-id="${vid}"
             onpointerdown="window.__visAction && window.__visAction(this,event)" ontouchstart="window.__visAction && window.__visAction(this,event)" onclick="return false;">
            <i class="material-icons">edit</i>
          </a>
          <a href="#!" data-action="eliminar" title="Eliminar visita" data-id="${vid}"
             onpointerdown="window.__visAction && window.__visAction(this,event)" ontouchstart="window.__visAction && window.__visAction(this,event)" onclick="return false;">
            <i class="material-icons">delete</i>
          </a>
        </div>`;

      return [
        esc(String(semana)),                          // 0 Sem.
        `<span data-order="${f.getTime()}">${fecha}</span>`, // 1 Fecha
        provHTML,                                     // 2 Proveedor
        centroHTML,                                   // 3 Centro
        esc(proximoPaso),                             // 4 Próximo paso
        fppHTML,                                      // 5 Fecha prox.
        esc(tons),                                    // 6 Tons
        acciones                                      // 7 Acciones
      ];
    });

  const jqOk = jq?.fn?.DataTable;
  if (dtV && jqOk){
    dtV.clear();
    dtV.rows.add(filas).draw(false);
    return;
  }

  // Fallback sin DataTables
  const tbody = $('#tablaVisitas tbody');
  if (!tbody) return;
  tbody.innerHTML = filas.length
    ? filas.map(arr => `<tr>${arr.map(td=>`<td>${td}</td>`).join('')}</tr>`).join('')
    : '<tr><td colspan="8" style="color:#888">No hay visitas registradas.</td></tr>';
}

/* ================= helpers: fecha “próximo paso” ================= */
function toggleProximoPasoFecha(){
  const sel = $('#visita_estado');
  const fecha = $('#visita_proximoPasoFecha');
  if (!sel || !fecha) return;
  const disabled = !sel.value || sel.value === 'Sin acción';
  fecha.disabled = disabled;
  if (disabled) fecha.value = '';
}

/* ================= Modal NUEVA VISITA desde Contactos ================= */
export function abrirModalVisita(contacto){
  const form = $('#formVisita'); if (!form) return;

  form.dataset.editId = '';
  ensureFotosBlock();
  setVisitaModalMode(false);

  setVal(['visita_proveedorId'], contacto._id);
  const proveedorKey = contacto.proveedorKey || slug(contacto.proveedorNombre || '');

  const selectVisita = $('#visita_centroId');
  if (selectVisita){
    const centros = (state.listaCentros || []).filter(
      (c) => (c.proveedorKey?.length ? c.proveedorKey : slug(c.proveedor || '')) === proveedorKey
    );
    let options = `<option value="">Centro visitado (opcional)</option>`;
    options += centros.map((c)=>`
      <option value="${c._id || c.id}" data-code="${c.code || c.codigo || ''}">
        ${(c.code || c.codigo || '')} – ${(c.comuna || 's/comuna')}
      </option>`).join('');
    selectVisita.innerHTML = options;
    selectVisita.value = '';
  }

  const hoy = new Date();
  const fechaEl = $('#visita_fecha'); if (fechaEl) fechaEl.value = fmtISO(hoy);

  $('#visita_contacto').value = '';
  $('#visita_enAgua').value = '';
  $('#visita_tonsComprometidas').value = '';
  $('#visita_estado').value = 'Programar nueva visita';
  $('#visita_observaciones').value = '';
  const fpp = $('#visita_proximoPasoFecha'); if (fpp) fpp.value = '';

  M.updateTextFields();
  resetFotosModal();
  toggleProximoPasoFecha();
  $('#visita_estado')?.addEventListener('change', toggleProximoPasoFecha, { once:true });

  (M.Modal.getInstance(document.getElementById('modalVisita')) || M.Modal.init(document.getElementById('modalVisita'))).open();
}

/* ================= Editar / Ver existente ================= */
async function abrirEditarVisita(v, readOnly=false){
  const form = $('#formVisita'); if (!form) return;
  form.dataset.editId = String(v._id || '');

  ensureFotosBlock();

  setVal(['visita_proveedorId'], v.contactoId || '');
  $('#visita_fecha').value = fmtISO(v.fecha);
  $('#visita_contacto').value = v.contacto || '';
  $('#visita_enAgua').value = v.enAgua || '';
  $('#visita_tonsComprometidas').value = v.tonsComprometidas ?? '';
  $('#visita_estado').value = normalizeEstado(v.estado || 'Programar nueva visita');
  $('#visita_observaciones').value = v.observaciones || '';
  const fpp = $('#visita_proximoPasoFecha');
  if (fpp) fpp.value = v.proximoPasoFecha ? fmtISO(v.proximoPasoFecha) : '';

  const contacto = (state.contactosGuardados || []).find(x => String(x._id) === String(v.contactoId));
  if (contacto){
    const proveedorKey = contacto.proveedorKey || slug(contacto.proveedorNombre || '');
    const selectVisita = $('#visita_centroId');
    if (selectVisita){
      const centros = (state.listaCentros || []).filter(
        (c) => (c.proveedorKey?.length ? c.proveedorKey : slug(c.proveedor || '')) === proveedorKey
      );
      let options = `<option value="">Centro visitado (opcional)</option>`;
      options += centros.map((c)=>`
        <option value="${c._id || c.id}" data-code="${c.code || c.codigo || ''}">
          ${(c.code || c.codigo || '')} – ${(c.comuna || 's/comuna')}
        </option>`).join('');
      selectVisita.innerHTML = options;
      selectVisita.value = v.centroId || '';
    }
  }

  M.updateTextFields();
  resetFotosModal();
  await renderGallery(v._id);

  toggleProximoPasoFecha();
  $('#visita_estado')?.addEventListener('change', toggleProximoPasoFecha, { once:true });

  const modal = M.Modal.getInstance(document.getElementById('modalVisita')) || M.Modal.init(document.getElementById('modalVisita'));
  modal.open();

  setVisitaModalMode(!!readOnly);
}

/* ================= Submit ================= */
export function setupFormularioVisita(){
  const form = $('#formVisita'); if (!form) return;

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const contactoId = $('#visita_proveedorId').value;

    const selCentro = $('#visita_centroId');
    const centroId = selCentro?.value || null;
    const centroCodigo =
      selCentro?.selectedOptions?.[0]?.dataset?.code || (centroId ? centroCodigoById(centroId) : null);

    const payload = {
      contactoId,
      fecha: $('#visita_fecha').value,
      centroId,
      centroCodigo,
      contacto: $('#visita_contacto').value || null,
      enAgua: $('#visita_enAgua').value || null,
      tonsComprometidas: $('#visita_tonsComprometidas').value ? Number($('#visita_tonsComprometidas').value) : null,
      estado: normalizeEstado($('#visita_estado').value || 'Programar nueva visita'),
      proximoPasoFecha: $('#visita_proximoPasoFecha')?.value || null,
      observaciones: $('#visita_observaciones').value || null
    };

    try{
      const editId = (form.dataset.editId || '').trim();
      if (editId){
        await update(editId, payload);
        await renderTablaVisitas(); forceAdjustVisitas();
        window.dispatchEvent(new CustomEvent('visita:updated', { detail:{ id: editId } }));
        M.toast?.({ html:'Visita actualizada', classes:'teal' });
        await handleFotosAfterSave(editId);
      }else{
        const nueva = await create(payload);
        await renderTablaVisitas(); forceAdjustVisitas();
        window.dispatchEvent(new CustomEvent('visita:created', { detail:{ visita: nueva, contactoId } }));
        M.toast?.({ html:'Visita guardada', classes:'teal' });
        const visitId = (nueva && (nueva._id || nueva.id)) ? (nueva._id || nueva.id) : null;
        await handleFotosAfterSave(visitId);
      }

      (M.Modal.getInstance(document.getElementById('modalVisita')))?.close();
      form.reset();
      form.dataset.editId = '';
      setVisitaModalMode(false);
      resetFotosModal();
      forceAdjustVisitas();
    }catch(err){
      console.warn('[visitas/ui] create/update error:', err?.message || err);
      M.toast?.({ html:'No se pudo guardar la visita', classes:'red', displayLength:2200 });
    }
  });
}

/* ================= Modo del modal ================= */
function setVisitaModalMode(readOnly){
  const form = $('#formVisita'); if (!form) return;

  const inputs = form.querySelectorAll('input, select, textarea, label input');
  const btnSave = form.querySelector('button[type="submit"]');
  const fotosActions = document.querySelector('#visita_fotos .fotos-actions');
  const closeBtn = form.closest('.modal-content')?.parentElement?.querySelector('.modal-close');
  const titleEl = document.querySelector('#modalVisita h5');

  if (readOnly){
    inputs.forEach(el => { if (el.type !== 'button') el.setAttribute('disabled','disabled'); });
    if (btnSave) btnSave.style.display = 'none';
    if (fotosActions) fotosActions.style.display = 'none';
    if (closeBtn) closeBtn.textContent = 'Cerrar';
    if (titleEl) titleEl.textContent = 'Detalle de visita';
  }else{
    inputs.forEach(el => el.removeAttribute('disabled'));
    if (btnSave) btnSave.style.display = '';
    if (fotosActions) fotosActions.style.display = '';
    if (closeBtn) closeBtn.textContent = 'Cancelar';
    if (titleEl) titleEl.textContent = 'Registrar visita';
  }
}

/* ================= Bloque FOTOS ================= */
function ensureFotosBlock(){
  if (document.getElementById('visita_fotos')) return;

  const form = $('#formVisita'); if (!form) return;

  const wrapper = document.createElement('div');
  wrapper.id = 'visita_fotos';
  wrapper.className = 'mb-3';
  wrapper.innerHTML = `
    <div class="fotos-actions">
      <span class="filepick-wrap">
        <button type="button" id="btnPickFotos" class="btn-small teal white-text">
          <i class="material-icons left">photo_camera</i>Agregar fotos
        </button>
        <input id="visita_fotos_input" class="filepick-input" type="file" accept="image/*" multiple>
      </span>
    </div>
    <div id="visita_fotos_preview" class="fotos-grid" style="margin-top:10px"></div>
    <div id="visita_fotos_gallery" class="fotos-grid" style="margin-top:10px"></div>
  `;

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn?.parentElement){
    submitBtn.parentElement.insertBefore(wrapper, submitBtn);
  }else{
    form.appendChild(wrapper);
  }

  const btn = wrapper.querySelector('#btnPickFotos');
  const input = wrapper.querySelector('#visita_fotos_input');
  if (btn && input){
    btn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); input.click(); });
  }

  try{ mountFotosUIOnce(); }catch{}
}

/* ================= UI wiring (una sola vez) ================= */
function wireUIEventsOnce(){
  if (window.__visitas_ui_wired) return;
  window.__visitas_ui_wired = true;

  document.addEventListener('visita:open-readonly', (e)=>{
    const id = e.detail?.id;
    const v = (state.visitasGuardadas || []).find(x => String(x._id) === String(id));
    if (!v) return M.toast?.({ html:'Visita no encontrada', classes:'red' });
    abrirEditarVisita(v, true);
  });
  document.addEventListener('visita:open-edit', (e)=>{
    const id = e.detail?.id;
    const v = (state.visitasGuardadas || []).find(x => String(x._id) === String(id));
    if (!v) return M.toast?.({ html:'Visita no encontrada', classes:'red' });
    abrirEditarVisita(v, false);
  });

  document.addEventListener('contacto:visita', (e)=>{
    const c = e.detail?.contacto;
    if (c) abrirModalVisita(c);
  });
}

/* ====== Filtros externos (Semana y Comuna) ====== */
function buildOrUpdateFiltros(){
  const tableEl = document.getElementById('tablaVisitas');
  const wrap = tableEl?.closest('.card, .mmpp-table-wrap, .container') || document.body;
  if (!wrap) return;

  // crea barra si no existe
  let bar = document.getElementById('visitas-filtros-bar');
  if (!bar){
    bar = document.createElement('div');
    bar.id = 'visitas-filtros-bar';
    bar.className = 'visitas-filtros';
    bar.innerHTML = `
      <div class="fld"><label>Semana</label>
        <select id="fltVisSem"><option value="">Todas</option></select>
      </div>
      <div class="fld"><label>Comuna</label>
        <select id="fltVisComuna"><option value="">Todas</option></select>
      </div>`;
    if (tableEl?.parentElement){
      tableEl.parentElement.insertBefore(bar, tableEl);
    } else {
      wrap.prepend(bar);
    }
  }

  // util: repoblar select sin duplicados
  const repoblar = (sel, values, etiquetaVacia) => {
    if (!sel) return;
    const base = document.createElement('option');
    base.value = '';
    base.textContent = etiquetaVacia;
    sel.innerHTML = '';
    sel.appendChild(base);
    values.forEach(v=>{
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      sel.appendChild(o);
    });
  };

  // armar listas desde visitas guardadas
  const semanasSet = new Set();
  const comunasSet = new Set();
  (state.visitasGuardadas||[]).forEach(v=>{
    const f = new Date(v.fecha||Date.now());
    if (!Number.isNaN(f.getTime())) semanasSet.add(String(getISOWeek(f)));
    const comuna = (v.centroComuna || comunaDeVisita(v) || '').trim();
    if (comuna) comunasSet.add(comuna);
  });

  const semanas = Array.from(semanasSet).map(n=>Number(n)).filter(Number.isFinite).sort((a,b)=>a-b).map(String);
  const comunas = Array.from(comunasSet).sort((a,b)=>a.localeCompare(b,'es'));

  const selSem    = bar.querySelector('#fltVisSem');
  const selComuna = bar.querySelector('#fltVisComuna');

  repoblar(selSem, semanas, 'Todas');
  repoblar(selComuna, comunas, 'Todas');

  // handlers
  if (selSem && !selSem.__wired){
    selSem.__wired = true;
    selSem.addEventListener('change', ()=>{
      if (!dtV) return;
      const val = selSem.value ? `^${selSem.value}$` : '';
      dtV.column(0).search(val, true, false).draw();
    });
  }
  if (selComuna && !selComuna.__wired){
    selComuna.__wired = true;
    selComuna.addEventListener('change', ()=>{
      if (!dtV) return;
      // la comuna está renderizada como texto dentro de la columna 3
      const val = selComuna.value || '';
      dtV.column(3).search(val, false, true).draw();
    });
  }
}

/* ================= Init principal ======================= */
export async function initVisitasTab(forceReload = false) {
  const jq    = window.jQuery || window.$;
  const tabla = $('#tablaVisitas');
  if (!tabla) { console.warn('[visitas/ui] #tablaVisitas no está en el DOM'); return; }

  const HEADERS = ['Sem.', 'Fecha', 'Proveedor', 'Centro', 'Próximo paso', 'Fecha prox.', 'Tons', 'Acciones'];
  const thead   = tabla.querySelector('thead') || (() => { const t=document.createElement('thead'); tabla.prepend(t); return t; })();
  const trHead  = thead.querySelector('tr');
  const thCount = trHead ? trHead.children.length : 0;

  if (thCount !== HEADERS.length) {
    thead.innerHTML = `<tr>${HEADERS.map(h => `<th>${h}</th>`).join('')}</tr>`;
  }

  wireActionsGlobalsOnce();
  wireUIEventsOnce();
  mountFotosUIOnce();

  if (jq?.fn?.DataTable && jq.fn.DataTable.isDataTable('#tablaVisitas')) {
    try { jq('#tablaVisitas').DataTable().destroy(true); } catch {}
    dtV = null;
  }

  if (jq && !dtV) {
    const defs = [
      { targets: 0, width: 60  },
      { targets: 1, width: 108 },
      { targets: 2, width: 280 },
      { targets: 3, width: 160 },
      { targets: 4, width: 180 },
      { targets: 5, width: 128 },
      { targets: 6, width: 90  },
      { targets: 7, width: 180, orderable: false, searchable: false },
    ];

    dtV = jq('#tablaVisitas').DataTable({
      dom: 'Blfrtip',
      buttons: [
        { extend: 'excelHtml5', title: 'Visitas_Abastecimiento' },
        { extend: 'pdfHtml5',   title: 'Visitas_Abastecimiento', orientation: 'landscape', pageSize: 'A4' },
      ],
      order: [[1, 'desc']],
      paging: true,
      pageLength: 10,
      lengthMenu: [[10,25,50,-1],[10,25,50,'Todos']],
      autoWidth: true,
      responsive: false,
      scrollX: false,
      language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
      columnDefs: defs,
      initComplete: () => { buildOrUpdateFiltros(); forceAdjustVisitas(); },
      drawCallback:  () => forceAdjustVisitas(),
    });

    // Delegación: acciones por fila
    document.addEventListener('click', (e) => {
      const a = e.target.closest?.('[data-action]');
      if (!a || !a.closest?.('#tablaVisitas')) return;
      e.preventDefault();
      manejarAccionVisitaEl(a);
    }, true);

    window.addEventListener('resize', forceAdjustVisitas);
  }

  await renderTablaVisitas();
  buildOrUpdateFiltros();
  forceAdjustVisitas();

  window.addEventListener('visita:created', async () => { await renderTablaVisitas(); buildOrUpdateFiltros(); forceAdjustVisitas(); });
  window.addEventListener('visita:updated', async () => { await renderTablaVisitas(); buildOrUpdateFiltros(); forceAdjustVisitas(); });
  window.addEventListener('visita:deleted', async () => { await renderTablaVisitas(); buildOrUpdateFiltros(); forceAdjustVisitas(); });

  console.log('[visitas/ui] initVisitasTab listo. dtV?', !!dtV);
}

