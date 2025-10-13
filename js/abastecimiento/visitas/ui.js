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

/* ========== utils locales ========== */
const esc = (s = '') => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

const fmtISO = (d) => {
  const x = (d instanceof Date) ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const trunc = (s = '', max = 42) =>
  (String(s).length > max ? String(s).slice(0, max - 1) + '…' : String(s));

function proveedorDeVisita(v) {
  const id = v?.contactoId ? String(v.contactoId) : null;
  if (!id) return '';
  const c = (state.contactosGuardados || []).find(x => String(x._id) === id);
  return c?.proveedorNombre || '';
}
function codigoDeVisita(v) {
  return v.centroCodigo || (v.centroId ? centroCodigoById(v.centroId) : '') || '';
}

/* ========== DataTable ========== */
let dtV = null;
const rafThrottle = (fn) => {
  let t = 0;
  return (...args) => { if (t) return; t = requestAnimationFrame(() => { t = 0; fn(...args); }); };
};
const adjustNow = rafThrottle(() => {
  const jq = window.jQuery || window.$;
  if (jq && dtV) { try { dtV.columns.adjust().draw(false); } catch {} }
});
export function forceAdjustVisitas() { adjustNow(); }

/* ========== render tabla ========== */
export async function renderTablaVisitas() {
  const jq = window.jQuery || window.$;
  let visitas = [];
  try {
    visitas = await getAll();
    state.visitasGuardadas = visitas.slice();
  } catch (e) {
    console.error('[visitas/ui] getAll error:', e?.message || e);
    visitas = [];
  }

  const filas = visitas
    .slice()
    .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
    .map((v) => {
      const fecha = fmtISO(v.fecha);
      const proveedor = proveedorDeVisita(v);
      const proveedorHTML = proveedor
        ? `<span class="ellipsisCell ellipsisProv" title="${esc(proveedor)}">${esc(trunc(proveedor, 48))}</span>`
        : '<span class="text-soft">—</span>';

      const centro = codigoDeVisita(v);
      const actividad = v.enAgua || '';
      const proximoPaso = v.estado || '';
      const tons = (v.tonsComprometidas ?? '') + '';
      const obs = v.observaciones || '';
      const obsHTML = obs
        ? `<span class="ellipsisCell ellipsisObs" title="${esc(obs)}">${esc(trunc(obs, 72))}</span>`
        : '—';

      const vid = esc(v._id || '');

      const acciones = `
        <a href="#!" data-action="ver" title="Ver visita" data-id="${vid}"
           role="button"
           onpointerdown="window.__visAction && window.__visAction(this,event)"
           ontouchstart="window.__visAction && window.__visAction(this,event)"
           onclick="return false;">
          <i class="material-icons">visibility</i>
        </a>
        <a href="#!" data-action="editar" title="Editar visita" data-id="${vid}"
           role="button"
           onpointerdown="window.__visAction && window.__visAction(this,event)"
           ontouchstart="window.__visAction && window.__visAction(this,event)"
           onclick="return false;">
          <i class="material-icons">edit</i>
        </a>
        <a href="#!" data-action="eliminar" title="Eliminar visita" data-id="${vid}"
           role="button"
           onpointerdown="window.__visAction && window.__visAction(this,event)"
           ontouchstart="window.__visAction && window.__visAction(this,event)"
           onclick="return false;">
          <i class="material-icons">delete</i>
        </a>
      `;

      return [
        `<span data-order="${new Date(v.fecha || 0).getTime()}">${fecha || ''}</span>`,
        proveedorHTML,
        esc(centro),
        esc(actividad),
        esc(proximoPaso),
        esc(tons),
        obsHTML,
        acciones,
      ];
    });

  const jqOk = jq?.fn?.DataTable;
  if (dtV && jqOk) {
    dtV.clear();
    dtV.rows.add(filas).draw(false);
    return;
  }

  // Fallback sin DataTables
  const tbody = $('#tablaVisitas tbody');
  if (!tbody) return;
  tbody.innerHTML = filas.length
    ? filas.map(arr => `<tr>${arr.map((td)=>`<td>${td}</td>`).join('')}</tr>`).join('')
    : '<tr><td colspan="8" style="color:#888">No hay visitas registradas.</td></tr>';
}

/* ========== helpers de UI para el campo fecha del próximo paso ========== */
function toggleProximoPasoFecha() {
  const sel = $('#visita_estado');
  const fecha = $('#visita_proximoPasoFecha');
  if (!sel || !fecha) return;
  const disabled = !sel.value || sel.value === 'Sin acción';
  fecha.disabled = disabled;
  if (disabled) fecha.value = '';
}

/* ========== Modal NUEVA VISITA desde Contactos ========== */
export function abrirModalVisita(contacto) {
  const form = $('#formVisita');
  if (!form) return;

  form.dataset.editId = '';

  ensureFotosBlock(); // inyecta el bloque de fotos propio (evita duplicados)

  setVisitaModalMode(false);

  setVal(['visita_proveedorId'], contacto._id);
  const proveedorKey = contacto.proveedorKey || slug(contacto.proveedorNombre || '');

  const selectVisita = $('#visita_centroId');
  if (selectVisita) {
    const centros = (state.listaCentros || []).filter(
      (c) => (c.proveedorKey?.length ? c.proveedorKey : slug(c.proveedor || '')) === proveedorKey
    );
    let options = `<option value="">Centro visitado (opcional)</option>`;
    options += centros.map((c) => `
      <option value="${c._id || c.id}" data-code="${c.code || c.codigo || ''}">
        ${(c.code || c.codigo || '')} – ${(c.comuna || 's/comuna')}
      </option>`).join('');
    selectVisita.innerHTML = options;
    selectVisita.value = '';
  }

  const hoy = new Date();
  const fechaEl = $('#visita_fecha');
  if (fechaEl) fechaEl.value = fmtISO(hoy);

  $('#visita_contacto').value = '';
  $('#visita_enAgua').value = '';
  $('#visita_tonsComprometidas').value = '';
  $('#visita_estado').value = 'Programar nueva visita';
  $('#visita_observaciones').value = '';
  const fpp = $('#visita_proximoPasoFecha');
  if (fpp) fpp.value = '';

  M.updateTextFields();

  resetFotosModal();

  toggleProximoPasoFecha();
  $('#visita_estado')?.addEventListener('change', toggleProximoPasoFecha, { once: true });

  (M.Modal.getInstance(document.getElementById('modalVisita')) || M.Modal.init(document.getElementById('modalVisita'))).open();
}

/* ========== Editar / Ver existente (privado) ========== */
async function abrirEditarVisita(v, readOnly = false) {
  const form = $('#formVisita'); if (!form) return;
  form.dataset.editId = String(v._id || '');

  ensureFotosBlock();

  setVal(['visita_proveedorId'], v.contactoId || '');
  $('#visita_fecha').value = fmtISO(v.fecha);
  $('#visita_contacto').value = v.contacto || '';
  $('#visita_enAgua').value = v.enAgua || '';
  $('#visita_tonsComprometidas').value = v.tonsComprometidas ?? '';
  $('#visita_estado').value = v.estado || 'Programar nueva visita';
  $('#visita_observaciones').value = v.observaciones || '';
  const fpp = $('#visita_proximoPasoFecha');
  if (fpp) fpp.value = v.proximoPasoFecha ? fmtISO(v.proximoPasoFecha) : '';

  const contacto = (state.contactosGuardados || []).find(x => String(x._id) === String(v.contactoId));
  if (contacto) {
    const proveedorKey = contacto.proveedorKey || slug(contacto.proveedorNombre || '');
    const selectVisita = $('#visita_centroId');
    if (selectVisita) {
      const centros = (state.listaCentros || []).filter(
        (c) => (c.proveedorKey?.length ? c.proveedorKey : slug(c.proveedor || '')) === proveedorKey
      );
      let options = `<option value="">Centro visitado (opcional)</option>`;
      options += centros.map((c) => `
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
  $('#visita_estado')?.addEventListener('change', toggleProximoPasoFecha, { once: true });

  const modal = M.Modal.getInstance(document.getElementById('modalVisita')) || M.Modal.init(document.getElementById('modalVisita'));
  modal.open();

  setVisitaModalMode(!!readOnly);
}

/* ========== Submit ========== */
export function setupFormularioVisita() {
  const form = $('#formVisita');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
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
      estado: $('#visita_estado').value || 'Programar nueva visita',
      proximoPasoFecha: $('#visita_proximoPasoFecha')?.value || null, // ← NUEVO
      observaciones: $('#visita_observaciones').value || null
    };

    try {
      const editId = (form.dataset.editId || '').trim();
      if (editId) {
        await update(editId, payload);
        window.dispatchEvent(new CustomEvent('visita:updated', { detail: { id: editId } }));
        M.toast?.({ html: 'Visita actualizada', classes: 'teal', displayLength: 1800 });
        await handleFotosAfterSave(editId);
      } else {
        const nueva = await create(payload);
        window.dispatchEvent(new CustomEvent('visita:created', { detail: { visita: nueva, contactoId } }));
        M.toast?.({ html: 'Visita guardada', classes: 'teal', displayLength: 1800 });
        const visitId = (nueva && (nueva._id || nueva.id)) ? (nueva._id || nueva.id) : null;
        await handleFotosAfterSave(visitId);
      }

      (M.Modal.getInstance(document.getElementById('modalVisita')))?.close();
      form.reset();
      form.dataset.editId = '';
      setVisitaModalMode(false);
      resetFotosModal();
      forceAdjustVisitas();
    } catch (e2) {
      console.warn('[visitas/ui] create/update error:', e2?.message || e2);
      M.toast?.({ html: 'No se pudo guardar la visita', displayLength: 2200, classes: 'red' });
    }
  });
}

/* ========== Modo del modal ========== */
function setVisitaModalMode(readOnly){
  const form = $('#formVisita');
  if (!form) return;

  const inputs = form.querySelectorAll('input, select, textarea, label input');
  const btnSave = form.querySelector('button[type="submit"]');
  const fotosActions = document.querySelector('#visita_fotos .fotos-actions');
  const closeBtn = form.closest('.modal-content')?.parentElement?.querySelector('.modal-close');
  const titleEl = document.querySelector('#modalVisita h5');

  if (readOnly) {
    inputs.forEach(el => { if (el.type !== 'button') el.setAttribute('disabled','disabled'); });
    if (btnSave) btnSave.style.display = 'none';
    if (fotosActions) fotosActions.style.display = 'none';
    if (closeBtn) closeBtn.textContent = 'Cerrar';
    if (titleEl) titleEl.textContent = 'Detalle de visita';
  } else {
    inputs.forEach(el => el.removeAttribute('disabled'));
    if (btnSave) btnSave.style.display = '';
    if (fotosActions) fotosActions.style.display = '';
    if (closeBtn) closeBtn.textContent = 'Cancelar';
    if (titleEl) titleEl.textContent = 'Registrar visita';
  }
}

/* ========== Bloque de FOTOS ========== */
function ensureFotosBlock() {
  if (document.getElementById('visita_fotos')) return;

  const form = $('#formVisita');
  if (!form) return;

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
  if (submitBtn?.parentElement) {
    submitBtn.parentElement.insertBefore(wrapper, submitBtn);
  } else {
    form.appendChild(wrapper);
  }

  const btn = wrapper.querySelector('#btnPickFotos');
  const input = wrapper.querySelector('#visita_fotos_input');
  if (btn && input) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      input.click();
    });
  }

  try { mountFotosUIOnce(); } catch {}
}

/* ========== UI wiring (una sola vez) ========== */
function wireUIEventsOnce() {
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

/* ========== Init principal ========== */
export async function initVisitasTab(forceReload = false) {
  const jq = window.jQuery || window.$;
  const tabla = $('#tablaVisitas');
  if (!tabla) { console.warn('[visitas/ui] #tablaVisitas no está en el DOM'); return; }

  wireActionsGlobalsOnce();
  wireUIEventsOnce();
  mountFotosUIOnce();

  if (dtV && forceReload) {
    await renderTablaVisitas();
    adjustNow();
    return;
  }

  if (jq && !dtV) {
    dtV = jq('#tablaVisitas').DataTable({
      dom: 'Blfrtip',
      buttons: [
        { extend: 'excelHtml5', title: 'Visitas_Abastecimiento' },
        { extend: 'pdfHtml5',   title: 'Visitas_Abastecimiento', orientation: 'landscape', pageSize: 'A4' },
      ],
      order: [[0, 'desc']],
      paging: true,
      pageLength: 10,
      lengthMenu: [[10,25,50,-1],[10,25,50,'Todos']],
      autoWidth: false,
      responsive: true,
      scrollX: false,
      language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
      columnDefs: [{ targets: -1, orderable:false, searchable:false }],
      initComplete: () => adjustNow(),
      drawCallback:   () => adjustNow(),
    });

    // Delegación: click en acciones
    document.addEventListener('click', (e) => {
      const a = e.target.closest?.('[data-action]');
      if (!a || !a.closest?.('#tablaVisitas')) return;
      e.preventDefault();
      manejarAccionVisitaEl(a);
    }, true);

    window.addEventListener('resize', adjustNow);
  }

  await renderTablaVisitas();
  adjustNow();

  window.addEventListener('visita:created', async () => { await renderTablaVisitas(); adjustNow(); });
  window.addEventListener('visita:updated', async () => { await renderTablaVisitas(); adjustNow(); });
  window.addEventListener('visita:deleted', async () => { await renderTablaVisitas(); adjustNow(); });

  console.log('[visitas/ui] initVisitasTab listo. dtV?', !!dtV);
}
