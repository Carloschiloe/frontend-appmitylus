// /js/abastecimiento/visitas/ui.js
import { state, $, setVal, slug } from '../contactos/state.js';
import { escapeHtml, getModalInstance, debounce } from '../contactos/ui-common.js';
import { createLocalTableController } from '../contactos/local-table.js';
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
const esc = escapeHtml;

const fmtISO = (d) => {
  const x = (d instanceof Date) ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth()+1).padStart(2,'0');
  const dd = String(x.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
};
const trunc = (s='', max=42) => (String(s).length>max ? `${String(s).slice(0,max-1)}...` : String(s));

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

// helpers DOM seguros
const getEl = (sel) => (typeof sel === 'string' ? document.getElementById(sel) : sel);
const setIf = (sel, prop, val) => { const el = getEl(sel); if (el && prop in el) el[prop] = val; return !!el; };
const getPasoEl = () => getEl('visita_estado') || getEl('visita_proximoPaso');

/* ============== asegure infraestructura del modal ============== */
async function ensureVisitaInfra(){
  let modal = getEl('modalVisita');
  let form  = getEl('formVisita');

  if (!modal || !form){
    // intenta cambiar a la pestana de "Visitas a cultivos" para que se monte el HTML
    const a = document.querySelector('[href="#tab-visitas"], a[data-target="tab-visitas"]');
    if (a) { try { a.click(); } catch {} }
    // espera un ratito a que el DOM se monte
    const start = Date.now();
    while (Date.now() - start < 800) {
      await new Promise(r=>setTimeout(r, 40));
      modal = getEl('modalVisita');
      form  = getEl('formVisita');
      if (modal && form) break;
    }
  }

  if (modal) {
    try { getModalInstance('modalVisita'); } catch {}
  }
  return !!(modal && form);
}

/* ================= Tabla local (sin DataTables) ================= */
let visitasListenersBound = false;
let visitasActionsBound = false;
let visitasFiltersBound = false;
let tableCtrlVisitas = null;
let visitasPreset = '';

export function forceAdjustVisitas() {}

function ensureLocalTableVisitas() {
  if (tableCtrlVisitas) return tableCtrlVisitas;
  tableCtrlVisitas = createLocalTableController({
    section: '#tab-visitas .mmpp-card',
    table: '#tablaVisitas',
    pageSize: 10,
    emptyColspan: 8,
    emptyText: 'No hay visitas registradas.',
    fileName: 'Visitas_Abastecimiento',
    exportHeaders: ['Semana', 'Fecha', 'Proveedor', 'Contacto', 'Centro', 'Comuna', 'Proximo paso', 'Fecha prox.', 'Tons']
  });
  return tableCtrlVisitas;
}

function isEstadoPendiente(rawEstado) {
  const est = String(rawEstado || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (!est) return false;
  if (est === 'sin accion' || est === 'cerrado' || est === 'completado' || est === 'finalizado') return false;
  return true;
}

function buildRowsVisitas(visitas) {
  return visitas
    .slice()
    .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
    .map((v, idx) => {
      const f = new Date(v.fecha || Date.now());
      const semana = String(getISOWeek(f));
      const fecha = fmtISO(f);
      const { empresa, contacto } = proveedorDeVisita(v);
      const centro = codigoDeVisita(v);
      const comuna = comunaDeVisita(v);
      const proximoPaso = normalizeEstado(v.estado || '');
      const tons = Number(v.tonsComprometidas ?? 0);
      const fpp = v.proximoPasoFecha ? new Date(v.proximoPasoFecha) : null;
      const fppISO = fpp && !Number.isNaN(fpp.getTime()) ? fmtISO(fpp) : '';
      const vid = esc(v._id || `v-${idx}`);
      const tieneMuestreo = !!v.hasMuestreo || (Number(v.muestreoCount) || 0) > 0;
      const muClase = tieneMuestreo ? 'mu-green' : 'mu-red';
      const muTitle = tieneMuestreo ? 'Ver resumen de muestreos' : 'Registrar muestreo';

      const provHTML = `
        <span class="v-prov" title="${esc(empresa)}${contacto ? ` - ${esc(contacto)}` : ''}">
          <span class="v-top">${esc(trunc(empresa, 48)) || '-'}</span>
          ${contacto ? `<span class="v-sub">${esc(trunc(contacto, 46))}</span>` : ''}
        </span>
      `.trim();

      const centroHTML = `
        <span class="v-centro" title="${esc(centro)}${comuna ? ` - ${esc(comuna)}` : ''}">
          <span class="v-top">${esc(centro) || '-'}</span>
          ${comuna ? `<span class="v-sub">${esc(comuna)}</span>` : ''}
        </span>
      `.trim();

      const acciones = `
        <div class="acts tbl-actions">
          <a href="#!" class="tbl-action-btn tbl-act-biomasa ${muClase}" data-action="muestreo" title="${muTitle}" data-id="${vid}"
             onpointerdown="window.__visAction && window.__visAction(this,event)" ontouchstart="window.__visAction && window.__visAction(this,event)" onclick="return false;">
            <i class="material-icons">science</i>
          </a>
          <a href="#!" class="tbl-action-btn tbl-act-view" data-action="ver" title="Ver visita" data-id="${vid}"
             onpointerdown="window.__visAction && window.__visAction(this,event)" ontouchstart="window.__visAction && window.__visAction(this,event)" onclick="return false;">
            <i class="material-icons">visibility</i>
          </a>
          <a href="#!" class="tbl-action-btn tbl-act-edit" data-action="editar" title="Editar visita" data-id="${vid}"
             onpointerdown="window.__visAction && window.__visAction(this,event)" ontouchstart="window.__visAction && window.__visAction(this,event)" onclick="return false;">
            <i class="material-icons">edit</i>
          </a>
          <a href="#!" class="tbl-action-btn tbl-act-delete" data-action="eliminar" title="Eliminar visita" data-id="${vid}"
             onpointerdown="window.__visAction && window.__visAction(this,event)" ontouchstart="window.__visAction && window.__visAction(this,event)" onclick="return false;">
            <i class="material-icons">delete</i>
          </a>
        </div>
      `.trim();

      const searchKey = String([semana, fecha, empresa, contacto, centro, comuna, proximoPaso, fppISO].join(' '))
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

      return {
        id: v._id || '',
        semana,
        comuna,
        estado: proximoPaso,
        searchKey,
        cells: [
          esc(semana),
          `<span data-order="${f.getTime()}">${fecha}</span>`,
          provHTML,
          centroHTML,
          esc(proximoPaso),
          fppISO ? `<span data-order="${fpp.getTime()}">${fppISO}</span>` : '<span data-order="-1"></span>',
          esc(tons ? String(tons) : ''),
          acciones
        ],
        export: [
          semana,
          fecha,
          String(empresa || ''),
          String(contacto || ''),
          String(centro || ''),
          String(comuna || ''),
          String(proximoPaso || ''),
          String(fppISO || ''),
          tons ? String(tons) : ''
        ]
      };
    });
}

function filterRowsVisitas(rows) {
  const sem = String(document.getElementById('fltVisSem')?.value || '').trim();
  const comuna = String(document.getElementById('fltVisComuna')?.value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  const q = String(document.getElementById('searchVisitas')?.value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  return rows.filter((r) => {
    if (sem && r.semana !== sem) return false;
    if (comuna) {
      const rc = String(r.comuna || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
      if (rc !== comuna) return false;
    }
    if (visitasPreset === 'visitas-pendientes' && !isEstadoPendiente(r.estado)) return false;
    if (q && !r.searchKey.includes(q)) return false;
    return true;
  });
}

async function loadVisitas(forceReload = false) {
  if (!forceReload && Array.isArray(state.visitasGuardadas) && state.visitasGuardadas.length) {
    return state.visitasGuardadas.slice();
  }
  try {
    const visitas = await getAll();
    state.visitasGuardadas = visitas.slice();
    return visitas;
  } catch (e) {
    console.error('[visitas/ui] getAll error:', e?.message || e);
    return [];
  }
}

export async function renderTablaVisitas(forceReload = false) {
  const table = ensureLocalTableVisitas();
  if (!table) return;
  const visitas = await loadVisitas(!!forceReload);
  const rows = buildRowsVisitas(visitas);
  table.setRows(filterRowsVisitas(rows));
}

export function setVisitasPreset(preset = '') {
  visitasPreset = String(preset || '').trim();
  renderTablaVisitas(false).catch(() => {});
}

/* ================= helpers: fecha "proximo paso" ================= */
function toggleProximoPasoFecha(){
  const sel = getPasoEl();
  const fecha = getEl('visita_proximoPasoFecha');
  if (!sel || !fecha) return;
  const sv = String(sel.value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const disabled = !sv || sv === 'sin accion';
  fecha.disabled = disabled;
  if (disabled) fecha.value = '';
}

/* ================= Modal NUEVA VISITA desde Contactos ================= */
export async function abrirModalVisita(contacto){
  const ok = await ensureVisitaInfra();
  if (!ok) {
    console.warn('[visitas/ui] No se encontro infraestructura del modal de visitas.');
    M.toast?.({ html:'No se pudo abrir el modal de visitas', classes:'red' });
    return;
  }

  const form = getEl('formVisita'); if (!form) return;
  form.dataset.editId = '';
  ensureFotosBlock();
  setVisitaModalMode(false);

  // proveedor/contacto
  setVal(['visita_proveedorId'], contacto?._id);

  const proveedorKey = contacto?.proveedorKey || slug(contacto?.proveedorNombre || '');

  // centros del mismo proveedor
  const selectVisita = getEl('visita_centroId');
  if (selectVisita){
    const centros = (state.listaCentros || []).filter(
      (c) => (c.proveedorKey?.length ? c.proveedorKey : slug(c.proveedor || '')) === proveedorKey
    );
    let options = `<option value="">Centro visitado (opcional)</option>`;
    options += centros.map((c)=>`
      <option value="${c._id || c.id}" data-code="${c.code || c.codigo || ''}">
        ${(c.code || c.codigo || '')} - ${(c.comuna || 's/comuna')}
      </option>`).join('');
    selectVisita.innerHTML = options;
    selectVisita.value = '';
  }

  const hoyISO = fmtISO(new Date());
  setIf('visita_fecha', 'value', hoyISO);

  setIf('visita_contacto', 'value', '');
  setIf('visita_enAgua', 'value', '');
  setIf('visita_tonsComprometidas', 'value', '');
  setIf('visita_estado', 'value', 'Programar nueva visita');
  setIf('visita_proximoPaso', 'value', 'Nueva visita');
  setIf('visita_observaciones', 'value', '');
  setIf('visita_proximoPasoFecha', 'value', '');

  try { M.updateTextFields(); } catch {}

  resetFotosModal();
  toggleProximoPasoFecha();
  const selEstado = getPasoEl();
  if (selEstado) selEstado.addEventListener('change', toggleProximoPasoFecha, { once:true });

  const modal = getEl('modalVisita');
  if (modal) getModalInstance('modalVisita')?.open();
}

/* ================= Editar / Ver existente ================= */
async function abrirEditarVisita(v, readOnly=false){
  const ok = await ensureVisitaInfra();
  if (!ok) {
    console.warn('[visitas/ui] Modal/forma de visitas no disponible.');
    M.toast?.({ html:'No se pudo abrir la visita', classes:'red' });
    return;
  }

  const form = getEl('formVisita'); if (!form) return;
  form.dataset.editId = String(v._id || '');

  ensureFotosBlock();

  setVal(['visita_proveedorId'], v.contactoId || '');
  setIf('visita_fecha', 'value', fmtISO(v.fecha));
  setIf('visita_contacto', 'value', v.contacto || '');
  setIf('visita_enAgua', 'value', v.enAgua || '');
  setIf('visita_tonsComprometidas', 'value', v.tonsComprometidas ?? '');
  const estadoNorm = normalizeEstado(v.estado || 'Programar nueva visita');
  setIf('visita_estado', 'value', estadoNorm);
  setIf('visita_proximoPaso', 'value', estadoNorm);
  setIf('visita_observaciones', 'value', v.observaciones || '');
  const fppISO = v.proximoPasoFecha ? fmtISO(v.proximoPasoFecha) : '';
  setIf('visita_proximoPasoFecha', 'value', fppISO);

  const contacto = (state.contactosGuardados || []).find(x => String(x._id) === String(v.contactoId));
  if (contacto){
    const proveedorKey = contacto.proveedorKey || slug(contacto.proveedorNombre || '');
    const selectVisita = getEl('visita_centroId');
    if (selectVisita){
      const centros = (state.listaCentros || []).filter(
        (c) => (c.proveedorKey?.length ? c.proveedorKey : slug(c.proveedor || '')) === proveedorKey
      );
      let options = `<option value="">Centro visitado (opcional)</option>`;
      options += centros.map((c)=>`
        <option value="${c._id || c.id}" data-code="${c.code || c.codigo || ''}">
          ${(c.code || c.codigo || '')} - ${(c.comuna || 's/comuna')}
        </option>`).join('');
      selectVisita.innerHTML = options;
      selectVisita.value = v.centroId || '';
    }
  }

  try { M.updateTextFields(); } catch {}
  resetFotosModal();
  await renderGallery(v._id);

  toggleProximoPasoFecha();
  const selEstado = getPasoEl();
  if (selEstado) selEstado.addEventListener('change', toggleProximoPasoFecha, { once:true });

  const modal = getEl('modalVisita');
  if (modal) getModalInstance('modalVisita')?.open();

  setVisitaModalMode(!!readOnly);
}

/* ================= Submit ================= */
export function setupFormularioVisita(){
  const form = getEl('formVisita'); if (!form) return;

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const contactoId = getEl('visita_proveedorId')?.value;

    const selCentro = getEl('visita_centroId');
    const centroId = selCentro?.value || null;
    const centroCodigo =
      selCentro?.selectedOptions?.[0]?.dataset?.code || (centroId ? centroCodigoById(centroId) : null);

    const payload = {
      contactoId,
      fecha: getEl('visita_fecha')?.value,
      centroId,
      centroCodigo,
      contacto: getEl('visita_contacto')?.value || null,
      enAgua: getEl('visita_enAgua')?.value || null,
      tonsComprometidas: getEl('visita_tonsComprometidas')?.value ? Number(getEl('visita_tonsComprometidas')?.value) : null,
      estado: normalizeEstado(getPasoEl()?.value || 'Programar nueva visita'),
      proximoPasoFecha: getEl('visita_proximoPasoFecha')?.value || null,
      observaciones: getEl('visita_observaciones')?.value || null
    };

    try{
      const editId = (form.dataset.editId || '').trim();
      if (editId){
        await update(editId, payload);
        await renderTablaVisitas(true); forceAdjustVisitas();
        window.dispatchEvent(new CustomEvent('visita:updated', { detail:{ id: editId } }));
        M.toast?.({ html:'Visita actualizada', classes:'teal' });
        await handleFotosAfterSave(editId);
      }else{
        const nueva = await create(payload);
        await renderTablaVisitas(true); forceAdjustVisitas();
        window.dispatchEvent(new CustomEvent('visita:created', { detail:{ visita: nueva, contactoId } }));
        M.toast?.({ html:'Visita guardada', classes:'teal' });
        const visitId = (nueva && (nueva._id || nueva.id)) ? (nueva._id || nueva.id) : null;
        await handleFotosAfterSave(visitId);
      }

      getModalInstance('modalVisita')?.close();
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
  const form = getEl('formVisita'); if (!form) return;

  const inputs = form.querySelectorAll('input, select, textarea, label input');
  const btnSave = form.querySelector('button[type="submit"]');
  const fotosActions = document.querySelector('#visita_fotos .fotos-actions');
  const closeBtn = form.closest('.modal-content')?.parentElement?.querySelector('.modal-close');
  const titleEl = document.querySelector('#modalVisita .inter-modal-head h5') || document.querySelector('#modalVisita h5');
  const badgeEl = document.querySelector('#modalVisita .inter-type-badge');

  if (readOnly){
    inputs.forEach(el => { if (el.type !== 'button') el.setAttribute('disabled','disabled'); });
    if (btnSave) btnSave.style.display = 'none';
    if (fotosActions) fotosActions.style.display = 'none';
    if (closeBtn) closeBtn.textContent = 'Cerrar';
    if (titleEl) titleEl.textContent = 'Detalle de visita';
    if (badgeEl) badgeEl.innerHTML = '<i class="material-icons tiny">visibility</i>Solo lectura';
  }else{
    inputs.forEach(el => el.removeAttribute('disabled'));
    if (btnSave) btnSave.style.display = '';
    if (fotosActions) fotosActions.style.display = '';
    if (closeBtn) closeBtn.textContent = 'Cancelar';
    if (titleEl) titleEl.textContent = 'Registrar visita';
    if (badgeEl) badgeEl.innerHTML = '<i class="material-icons tiny">directions_boat</i>Visita';
  }
}

/* ================= Bloque FOTOS ================= */
function ensureFotosBlock(){
  if (document.getElementById('visita_fotos')) return;

  const form = getEl('formVisita'); if (!form) return;

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
    <div id="visita_fotos_preview" class="fotos-grid fotos-grid-spaced"></div>
    <div id="visita_fotos_gallery" class="fotos-grid fotos-grid-spaced"></div>
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
  const bar = document.getElementById('visitas-filtros-bar');
  if (!bar) return;

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

  const selSem = bar.querySelector('#fltVisSem');
  const selComuna = bar.querySelector('#fltVisComuna');
  const prevSem = selSem?.value || '';
  const prevComuna = selComuna?.value || '';

  repoblar(selSem, semanas, 'Todas');
  repoblar(selComuna, comunas, 'Todas');
  if (selSem) selSem.value = semanas.includes(prevSem) ? prevSem : '';
  if (selComuna) selComuna.value = comunas.includes(prevComuna) ? prevComuna : '';
}

/* ================= Init principal ======================= */
export async function initVisitasTab(forceReload = false) {
  let tabla = $('#tablaVisitas');
  if (!tabla) {
    await new Promise((r) => setTimeout(r, 50));
    tabla = $('#tablaVisitas');
  }
  if (!tabla) { console.warn('[visitas/ui] #tablaVisitas no esta en el DOM'); return; }

  const HEADERS = ['Sem.', 'Fecha', 'Proveedor', 'Centro', 'Proximo paso', 'Fecha prox.', 'Tons', 'Acciones'];
  const thead   = tabla.querySelector('thead') || (() => { const t=document.createElement('thead'); tabla.prepend(t); return t; })();
  const trHead  = thead.querySelector('tr');
  const thCount = trHead ? trHead.children.length : 0;

  if (thCount !== HEADERS.length) {
    thead.innerHTML = `<tr>${HEADERS.map(h => `<th>${h}</th>`).join('')}</tr>`;
  }

  wireActionsGlobalsOnce();
  wireUIEventsOnce();
  mountFotosUIOnce();
  ensureLocalTableVisitas();

  if (!visitasActionsBound) {
    visitasActionsBound = true;
    document.addEventListener('click', (e) => {
      const a = e.target.closest?.('[data-action]');
      if (!a || !a.closest?.('#tablaVisitas')) return;
      e.preventDefault();
      manejarAccionVisitaEl(a);
    }, true);
  }

  if (!visitasFiltersBound) {
    visitasFiltersBound = true;
    const onFilter = debounce(() => {
      renderTablaVisitas(false).catch(() => {});
    }, 120);

    document.getElementById('fltVisSem')?.addEventListener('change', () => {
      if (visitasPreset) visitasPreset = '';
      onFilter();
    });
    document.getElementById('fltVisComuna')?.addEventListener('change', () => {
      if (visitasPreset) visitasPreset = '';
      onFilter();
    });
    document.getElementById('searchVisitas')?.addEventListener('input', (e) => {
      if ((e.target?.value || '').trim() && visitasPreset) visitasPreset = '';
      onFilter();
    });
  }

  await renderTablaVisitas(!!forceReload);
  buildOrUpdateFiltros();

  if (!visitasListenersBound) {
    visitasListenersBound = true;
    window.addEventListener('visita:created', async () => {
      await renderTablaVisitas(true);
      buildOrUpdateFiltros();
    });
    window.addEventListener('visita:updated', async () => {
      await renderTablaVisitas(true);
      buildOrUpdateFiltros();
    });
    window.addEventListener('visita:deleted', async () => {
      await renderTablaVisitas(true);
      buildOrUpdateFiltros();
    });
  }

  console.log('[visitas/ui] initVisitasTab listo (local table)');
}

