// /js/abastecimiento/visitas/tab.js
import {
  apiGetVisitas,
  apiGetVisitasByContacto,
  apiCreateVisita,
  apiUpdateVisita,
  apiDeleteVisita,
} from '../../core/api.js';

import { state, $, setVal, slug } from '../contactos/state.js';
import { normalizeVisita, centroCodigoById } from './normalizers.js';

import {
  mountFotosUIOnce,
  resetFotosModal,
  handleFotosAfterSave,
  renderGallery,
} from './fotos/ui.js';

console.log('[visitas] tab.js cargado');

const normalizeVisitas = (arr) => (Array.isArray(arr) ? arr.map(normalizeVisita) : []);

// ---------------- utils ----------------
const esc = (s = '') =>
  String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

const fmtISO = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const trunc = (s = '', max = 42) =>
  (String(s).length > max ? String(s).slice(0, max - 1) + '…' : String(s));

function proveedorDeVisita(v) {
  const id = v.contactoId ? String(v.contactoId) : null;
  if (!id) return '';
  const c = (state.contactosGuardados || []).find((x) => String(x._id) === id);
  return c?.proveedorNombre || '';
}
function codigoDeVisita(v) {
  return v.centroCodigo || (v.centroId ? centroCodigoById(v.centroId) : '') || '';
}

// ---------------- DataTable ----------------
let dtV = null;

// pequeño throttle para no recalcular columnas de más
const rafThrottle = (fn) => {
  let t = 0;
  return (...args) => {
    if (t) return;
    t = requestAnimationFrame(() => { t = 0; fn(...args); });
  };
};

const adjustNow = rafThrottle(() => {
  const jq = window.jQuery || window.$;
  if (jq && dtV) { try { dtV.columns.adjust().draw(false); } catch {} }
});
export function forceAdjustVisitas() { adjustNow(); }

// CSS para que el ícono no bloquee el click y los botones sean clickeables
(function ensureClickCSS(){
  if (document.getElementById('visitas-click-fix')) return;
  const css = `
    #tablaVisitas i.material-icons{ pointer-events:none; }
    #tablaVisitas td:last-child [data-action]{
      pointer-events:auto; cursor:pointer; display:inline-block; margin:0 5px;
    }
    #tablaVisitas td:last-child [data-action] i{
      font-size:18px; vertical-align:middle;
    }
  `;
  const s = document.createElement('style');
  s.id = 'visitas-click-fix';
  s.textContent = css;
  document.head.appendChild(s);
})();

export async function initVisitasTab(forceReload = false) {
  const jq = window.jQuery || window.$;
  const tabla = $('#tablaVisitas');
  if (!tabla) { console.warn('[visitas] #tablaVisitas no está en el DOM aún'); return; }

  mountFotosUIOnce();

  if (dtV && forceReload) {
    console.log('[visitas] reload (force) → renderTablaVisitas()');
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

    // --- wiring de clicks (global y solo 1 vez) ---
    if (!window.__visitasClicksWired) {
      window.__visitasClicksWired = true;
      document.addEventListener('click', (e) => {
        const a = e.target.closest('#tablaVisitas [data-action]');
        if (!a) return;
        e.preventDefault();
        console.log('[visitas] click capturado → action=%s  dataset=%o', a.dataset.action, a.dataset);
        manejarAccionVisita(a);
      });
    }

    window.addEventListener('resize', adjustNow);
  }

  await renderTablaVisitas();
  adjustNow();

  // estos listeners podrían acumularse si llamas muchas veces initVisitasTab; si es tu caso, muévelos fuera y pon {once:true}
  window.addEventListener('visita:created', async () => { await renderTablaVisitas(); adjustNow(); });
  window.addEventListener('visita:updated', async () => { await renderTablaVisitas(); adjustNow(); });

  console.log('[visitas] initVisitasTab listo. dtV?', !!dtV);
}

// ---------------- render ----------------
export async function renderTablaVisitas() {
  const jq = window.jQuery || window.$;

  let visitas = [];
  try {
    const raw = await apiGetVisitas();
    visitas = normalizeVisitas(Array.isArray(raw) ? raw : raw?.items || []);
    state.visitasGuardadas = visitas.slice();
  } catch (e) {
    console.error('[visitas] apiGetVisitas error:', e?.message || e);
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

      const cid = esc(v.contactoId || '');
      const vid = esc(v._id || '');
      const acciones = `
        <a href="#!" data-action="ver"      title="Ver proveedor"  data-contacto-id="${cid}"><i class="material-icons">visibility</i></a>
        <a href="#!" data-action="nueva"    title="Nueva visita"   data-contacto-id="${cid}"><i class="material-icons">event_available</i></a>
        <a href="#!" data-action="editar"   title="Editar visita"  data-id="${vid}"><i class="material-icons">edit</i></a>
        <a href="#!" data-action="eliminar" title="Eliminar visita" data-id="${vid}"><i class="material-icons">delete</i></a>
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

  const jqOk = jq && jq.fn && jq.fn.DataTable;
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

// ---------------- Detalle + Modales ----------------
function comunasDelProveedor(proveedorKey) {
  const key = proveedorKey?.length ? proveedorKey : null;
  const comunas = new Set();
  for (const c of state.listaCentros) {
    const k = c.proveedorKey?.length ? c.proveedorKey : slug(c.proveedor || '');
    if (!key || k === key) {
      const comuna = (c.comuna || '').trim();
      if (comuna) comunas.add(comuna);
    }
  }
  return Array.from(comunas);
}

function miniTimelineHTML(visitas = []) {
  if (!visitas.length) return '<div class="text-soft">Sin visitas registradas</div>';
  const filas = visitas.slice(0, 3).map((v) => {
    const code = v.centroCodigo || centroCodigoById(v.centroId) || '-';
    const fechaStr = fmtISO(v.fecha);
    return `
      <div class="row" style="margin-bottom:.35rem">
        <div class="col s4"><strong>${fechaStr || '-'}</strong></div>
        <div class="col s4">${code}</div>
        <div class="col s4">${v.estado || '-'}</div>
        <div class="col s12"><span class="text-soft">${v.tonsComprometidas ? (v.tonsComprometidas + ' t • ') : ''}${esc(v.observaciones || '')}</span></div>
      </div>
    `;
  }).join('');
  return filas + `<a class="btn btn--ghost" id="btnVerVisitas">Ver todas</a>`;
}

export async function abrirDetalleContacto(c) {
  const body = $('#detalleContactoBody'); if (!body) return;

  const f = new Date(c.createdAt || c.fecha || Date.now());
  const fechaFmt = `${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,'0')}-${String(f.getDate()).padStart(2,'0')} ${String(f.getHours()).padStart(2,'0')}:${String(f.getMinutes()).padStart(2,'0')}`;

  const comunas = comunasDelProveedor(c.proveedorKey || slug(c.proveedorNombre||''));
  const chips = comunas.length
    ? comunas.map(x => `<span class="badge chip" style="margin-right:.35rem;margin-bottom:.35rem">${esc(x)}</span>`).join('')
    : '<span class="text-soft">Sin centros asociados</span>';

  const visitas = normalizeVisitas(await apiGetVisitasByContacto(c._id));

  body.innerHTML = `
    <div class="mb-4">
      <h6 class="text-soft" style="margin:0 0 .5rem">Comunas con centros del proveedor</h6>
      ${chips}
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
      <div><strong>Fecha:</strong> ${fechaFmt}</div>
      <div><strong>Proveedor:</strong> ${esc(c.proveedorNombre || '')}</div>
      <div><strong>Centro:</strong> ${esc(c.centroCodigo || '-')}</div>
      <div><strong>Disponibilidad:</strong> ${esc(c.tieneMMPP || '-')}</div>
      <div><strong>Fecha Disp.:</strong> ${c.fechaDisponibilidad ? (''+c.fechaDisponibilidad).slice(0,10) : '-'}</div>
      <div><strong>Disposición:</strong> ${esc(c.dispuestoVender || '-')}</div>
      <div><strong>Tons aprox.:</strong> ${(c.tonsDisponiblesAprox ?? '') + ''}</div>
      <div><strong>Vende a:</strong> ${esc(c.vendeActualmenteA || '-')}</div>
      <div style="grid-column:1/-1;"><strong>Notas:</strong> ${c.notas ? esc(c.notas) : '<span class="text-soft">Sin notas</span>'}</div>
      <div style="grid-column:1/-1;"><strong>Contacto:</strong> ${[c.contactoNombre, c.contactoTelefono, c.contactoEmail].filter(Boolean).map(esc).join(' • ') || '-'}</div>
    </div>
    <div class="mb-4" style="margin-top:1rem;">
      <h6 class="text-soft" style="margin:0 0 .5rem">Últimas visitas</h6>
      ${miniTimelineHTML(visitas)}
    </div>
    <div class="right-align">
      <button class="btn teal" id="btnNuevaVisita" data-id="${c._id}">
        <i class="material-icons left">event_available</i>Registrar visita
      </button>
    </div>
  `;
  $('#btnNuevaVisita')?.addEventListener('click', () => abrirModalVisita(c));
  (M.Modal.getInstance(document.getElementById('modalDetalleContacto')) || M.Modal.init(document.getElementById('modalDetalleContacto'))).open();
}

export function abrirModalVisita(contacto) {
  const form = $('#formVisita');
  if (form) form.dataset.editId = ''; // nuevo
  setVal(['visita_proveedorId'], contacto._id);
  const proveedorKey = contacto.proveedorKey || slug(contacto.proveedorNombre || '');

  const selectVisita = $('#visita_centroId');
  if (selectVisita) {
    const centros = state.listaCentros.filter(
      (c) => (c.proveedorKey?.length ? c.proveedorKey : slug(c.proveedor || '')) === proveedorKey
    );
    let options = `<option value="">Centro visitado (opcional)</option>`;
    options += centros.map((c) => `
      <option value="${c._id || c.id}" data-code="${c.code || c.codigo || ''}">${(c.code || c.codigo || '')} – ${(c.comuna || 's/comuna')}</option>`
    ).join('');
    selectVisita.innerHTML = options;
  }

  resetFotosModal();
  (M.Modal.getInstance(document.getElementById('modalVisita')) || M.Modal.init(document.getElementById('modalVisita'))).open();
}

async function abrirEditarVisita(v) {
  const form = $('#formVisita'); if (!form) return;
  form.dataset.editId = String(v._id || '');

  setVal(['visita_proveedorId'], v.contactoId || '');
  $('#visita_fecha').value = fmtISO(v.fecha);
  $('#visita_contacto').value = v.contacto || '';
  $('#visita_enAgua').value = v.enAgua || '';
  $('#visita_tonsComprometidas').value = v.tonsComprometidas ?? '';
  $('#visita_estado').value = v.estado || 'Programar nueva visita';
  $('#visita_observaciones').value = v.observaciones || '';

  const contacto = (state.contactosGuardados || []).find(x => String(x._id) === String(v.contactoId));
  if (contacto) {
    const proveedorKey = contacto.proveedorKey || slug(contacto.proveedorNombre || '');
    const selectVisita = $('#visita_centroId');
    if (selectVisita) {
      const centros = state.listaCentros.filter(
        (c) => (c.proveedorKey?.length ? c.proveedorKey : slug(c.proveedor || '')) === proveedorKey
      );
      let options = `<option value="">Centro visitado (opcional)</option>`;
      options += centros.map((c) => `
        <option value="${c._id || c.id}" data-code="${c.code || c.codigo || ''}">${(c.code || c.codigo || '')} – ${(c.comuna || 's/comuna')}</option>`
      ).join('');
      selectVisita.innerHTML = options;
      selectVisita.value = v.centroId || '';
    }
  }

  M.updateTextFields();
  resetFotosModal();
  await renderGallery(v._id);
  (M.Modal.getInstance(document.getElementById('modalVisita')) || M.Modal.init(document.getElementById('modalVisita'))).open();
}

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
      observaciones: $('#visita_observaciones').value || null
    };

    try {
      const editId = (form.dataset.editId || '').trim();
      if (editId) {
        await apiUpdateVisita(editId, payload);
        window.dispatchEvent(new CustomEvent('visita:updated', { detail: { id: editId } }));
        M.toast?.({ html: 'Visita actualizada', classes: 'teal', displayLength: 1800 });
        await handleFotosAfterSave(editId);
      } else {
        const nueva = await apiCreateVisita(payload);
        window.dispatchEvent(new CustomEvent('visita:created', { detail: { visita: nueva, contactoId } }));
        M.toast?.({ html: 'Visita guardada', classes: 'teal', displayLength: 1800 });
        const visitId = (nueva && (nueva._id || nueva.id)) ? (nueva._id || nueva.id) : null;
        await handleFotosAfterSave(visitId);
      }

      (M.Modal.getInstance(document.getElementById('modalVisita')))?.close();
      form.reset();
      form.dataset.editId = '';
      forceAdjustVisitas();
    } catch (e2) {
      console.warn('apiCreate/UpdateVisita error:', e2?.message || e2);
      M.toast?.({ html: 'No se pudo guardar la visita', displayLength: 2200, classes: 'red' });
    }
  });
}

/* ==== Delegación en la tabla (simple y estable) ==== */
function manejarAccionVisita(aEl){
  console.log('[visitas] manejarAccionVisita()', aEl?.dataset);
  const action = (aEl.dataset.action || '').toLowerCase();
  try {
    if (action === 'ver' || action === 'detalle') {
      console.log('[visitas] abrirDetalleContacto para contactoId=', aEl.dataset.contactoId);
      const c = (state.contactosGuardados || []).find(x => String(x._id) === String(aEl.dataset.contactoId));
      if (c) abrirDetalleContacto(c); else M.toast?.({ html: 'Contacto no encontrado', classes: 'red' });
      return;
    }
    if (action === 'nueva' || action === 'visita') {
      console.log('[visitas] abrirModalVisita para contactoId=', aEl.dataset.contactoId);
      const c = (state.contactosGuardados || []).find(x => String(x._id) === String(aEl.dataset.contactoId));
      if (c) abrirModalVisita(c); else M.toast?.({ html: 'Contacto no encontrado', classes: 'red' });
      return;
    }
    if (action === 'editar' || action === 'editar-visita') {
      console.log('[visitas] abrirEditarVisita para visitaId=', aEl.dataset.id);
      const v = (state.visitasGuardadas || []).find(x => String(x._id) === String(aEl.dataset.id));
      if (v) abrirEditarVisita(v); else M.toast?.({ html: 'Visita no encontrada', classes: 'red' });
      return;
    }
    if (action === 'eliminar') {
      console.log('[visitas] eliminar visitaId=', aEl.dataset.id);
      const id = aEl.dataset.id;
      if (!id) return;
      if (!confirm('¿Eliminar esta visita?')) return;
      (async () => {
        await apiDeleteVisita(id);
        M.toast?.({ html: 'Visita eliminada', displayLength: 1600 });
        await renderTablaVisitas();
        forceAdjustVisitas();
      })().catch(err => {
        console.warn(err);
        M.toast?.({ html: 'No se pudo eliminar', classes: 'red', displayLength: 2000 });
      });
      return;
    }
  } catch (err) {
    console.error('[visitas] acción error', err);
    M.toast?.({ html: 'Acción no disponible', classes: 'red' });
  }
}

// helpers para consola / test
window.initVisitasTab = initVisitasTab;
window.manejarAccionVisita = manejarAccionVisita;
window.forceAdjustVisitas = forceAdjustVisitas;
