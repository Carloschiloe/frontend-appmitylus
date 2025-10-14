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
    /* sin forzar scroll horizontal */
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

    /* Acciones */
    #tablaVisitas td:last-child{ overflow:visible!important; text-align:center; }
    #tablaVisitas td .acts{ display:flex; gap:8px; align-items:center; justify-content:center; }
    #tablaVisitas td .acts a{
      display:inline-flex; align-items:center; justify-content:center;
      width:32px; height:32px; border-radius:8px; border:1px solid #e5e7eb; background:#fff;
      box-shadow:0 2px 8px rgba(2,6,23,.05); cursor:pointer;
    }
    #tablaVisitas td .acts a i{ font-size:18px; line-height:18px; }

    /* Muestreo */
    #tablaVisitas td .acts a.mu-red  { border-color:#fecaca; background:#fff1f2; }
    #tablaVisitas td .acts a.mu-red  i{ color:#dc2626; }
    #tablaVisitas td .acts a.mu-green{ border-color:#bbf7d0; background:#ecfdf5; }
    #tablaVisitas td .acts a.mu-green i{ color:#059669; }
  `;
  if (!document.getElementById('visitas-inline-styles')){
    const s = document.createElement('style');
    s.id = 'visitas-inline-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }
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
  if (x === 'Programar nueva visita') return 'Nueva visita';
  return (x === 'Tomar/entregar muestras') ? 'Tomar muestras' : x;
};

/* ================= DataTable helpers ================= */
let dtV = null;

/* Ajuste SEGURO: siempre ajusta columnas */
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

      // 0 Sem | 1 Fecha | 2 Proveedor | 3 Centro | 4 Próximo paso | 5 Fecha prox. | 6 Tons | 7 Acciones
      return [
        esc(String(semana)),
        `<span data-order="${f.getTime()}">${fecha}</span>`,
        provHTML,
        centroHTML,
        esc(proximoPaso),
        fppHTML,
        esc(tons),
        acciones
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
  $('#visita_estado').value = 'Nueva visita';     // <- default correcto
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
  $('#visita_estado').value = normalizeEstado(v.estado || 'Nueva visita');  // <- normalizado
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
      estado: normalizeEstado($('#visita_estado').value || 'Nueva visita'), // <- default correcto
      proximoPasoFecha: $('#visita_proximoPasoFecha')?.value || null,
      observaciones: $('#visita_observaciones').value || null
    };

    try{
      const editId = (form.dataset.editId || '').trim();
      if (editId){
        await update(editId, payload);
        window.dispatchEvent(new CustomEvent('visita:updated', { detail:{ id: editId } }));
        M.toast?.({ html:'Visita actualizada', classes:'teal', displayLength:1800 });
        await handleFotosAfterSave(editId);
      }else{
        const nueva = await create(payload);
        window.dispatchEvent(new CustomEvent('visita:created', { detail:{ visita: nueva, contactoId } }));
        M.toast?.({ html:'Visita guardada', classes:'teal', displayLength:1800 });
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
      M.toast?.({ html:'No se pudo guardar la visita', displayLength:2200, classes:'red' });
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

/* ================= Init principal ======================= */
export async function initVisitasTab(forceReload = false) {
  const jq    = window.jQuery || window.$;
  const tabla = $('#tablaVisitas');
  if (!tabla) { console.warn('[visitas/ui] #tablaVisitas no está en el DOM'); return; }

  // --- Header canónico (8 columnas) ---
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

  // Si existe un DataTable previo, destrúyelo
  if (jq?.fn?.DataTable && jq.fn.DataTable.isDataTable('#tablaVisitas')) {
    try { jq('#tablaVisitas').DataTable().destroy(true); } catch {}
    dtV = null;
  }

  if (jq && !dtV) {
    const defs = [
      { targets: 0, width: 60  },  // Sem.
      { targets: 1, width: 108 },  // Fecha
      { targets: 2, width: 280 },  // Proveedor
      { targets: 3, width: 160 },  // Centro
      { targets: 4, width: 180 },  // Próximo paso
      { targets: 5, width: 128 },  // Fecha prox.
      { targets: 6, width: 90  },  // Tons
      { targets: 7, width: 180, orderable: false, searchable: false }, // Acciones
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
      autoWidth: true,   // deja que DT calcule anchos
      responsive: false,
      scrollX: false,    // sin scroll horizontal
      language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
      columnDefs: defs,
      initComplete: () => forceAdjustVisitas(),
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
  forceAdjustVisitas();

  window.addEventListener('visita:created', async () => { await renderTablaVisitas(); forceAdjustVisitas(); });
  window.addEventListener('visita:updated', async () => { await renderTablaVisitas(); forceAdjustVisitas(); });
  window.addEventListener('visita:deleted', async () => { await renderTablaVisitas(); forceAdjustVisitas(); });

  console.log('[visitas/ui] initVisitasTab listo. dtV?', !!dtV);
}
