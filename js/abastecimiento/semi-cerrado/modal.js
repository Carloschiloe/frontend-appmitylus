// /js/abastecimiento/semi-cerrado/modal.js
// Modal para "Asignar biomasa semi-cerrada" (mensual)
// Requiere Materialize (ya está cargado en tu HTML)

import { crearSemiCerrado } from './api.js';

const MODAL_ID = 'modalSemiCerrado';

function ensureContainer() {
  let el = document.getElementById(MODAL_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = MODAL_ID;
    el.className = 'modal';
    document.body.appendChild(el);
    if (window.M && M.Modal) M.Modal.init(el, { endingTop: '5%' });
  }
  return el;
}

function monthDefaultYYYYMM() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Rellena el modal.
 * preset opcional: { proveedorId, proveedorNombre, centroId, centroCodigo, periodo, toneladas, responsable, notas, origenContactoId }
 */
function renderModal(preset = {}) {
  const el = ensureContainer();
  const {
    proveedorId = '',
    proveedorNombre = '',
    centroId = '',
    centroCodigo = '',
    periodo = monthDefaultYYYYMM(),
    toneladas = '',
    responsable = '',
    notas = '',
    origenContactoId = '',
  } = preset;

  el.innerHTML = `
    <div class="modal-content">
      <h5>Asignar biomasa <span class="green-text text-darken-2">semi-cerrada</span></h5>

      <form id="formSemiCerrado" autocomplete="off">
        <div class="row">
          <div class="input-field col s12 m6">
            <input id="sc_proveedorNombre" type="text" placeholder="Proveedor..." value="${escapeHtml(proveedorNombre)}" ${proveedorId ? 'readonly' : ''}>
            <label class="active" for="sc_proveedorNombre">Proveedor</label>
            <div class="grey-text" style="font-size:12px">Sugerencia: abre este modal desde una fila de proveedor para precargar los datos.</div>
          </div>

          <div class="input-field col s12 m6">
            <input id="sc_proveedorId" type="text" placeholder="ID proveedor" value="${escapeAttr(proveedorId)}" ${proveedorId ? 'readonly' : ''}>
            <label class="active" for="sc_proveedorId">ID proveedor</label>
            <div class="grey-text" style="font-size:12px">Obligatorio si no se precargó automáticamente.</div>
          </div>
        </div>

        <div class="row">
          <div class="input-field col s12 m6">
            <input id="sc_centroId" type="text" placeholder="ID centro (opcional)" value="${escapeAttr(centroId)}">
            <label class="active" for="sc_centroId">Centro (ID, opcional)</label>
          </div>

          <div class="input-field col s12 m6">
            <input id="sc_centroCodigo" type="text" placeholder="Código centro (opcional)" value="${escapeHtml(centroCodigo)}">
            <label class="active" for="sc_centroCodigo">Código centro (opcional)</label>
          </div>
        </div>

        <div class="row">
          <div class="input-field col s12 m4">
            <input id="sc_periodo" type="month" value="${escapeAttr(periodo)}" required>
            <label class="active" for="sc_periodo">Periodo (YYYY-MM)</label>
          </div>

          <div class="input-field col s12 m4">
            <input id="sc_tons" type="number" step="0.01" min="0" placeholder="Ej: 120" value="${escapeAttr(toneladas)}" required>
            <label class="active" for="sc_tons">Cantidad (ton)</label>
          </div>

          <div class="input-field col s12 m4">
            <input id="sc_responsable" type="text" placeholder="Responsable PG" value="${escapeHtml(responsable)}">
            <label class="active" for="sc_responsable">Responsable PG</label>
          </div>
        </div>

        <div class="input-field">
          <textarea id="sc_notas" class="materialize-textarea" placeholder="Notas...">${escapeHtml(notas)}</textarea>
          <label class="active" for="sc_notas">Notas (opcional)</label>
        </div>

        <input type="hidden" id="sc_origenContactoId" value="${escapeAttr(origenContactoId)}">

        <div id="sc_alert" class="card-panel hide" style="padding:10px"></div>
      </form>
    </div>

    <div class="modal-footer" style="display:flex;gap:8px;justify-content:flex-end">
      <button type="button" class="modal-close btn-flat">Cancelar</button>
      <button id="sc_btn_save" class="mmpp-button"><i class="material-icons left">save</i>Guardar</button>
    </div>
  `;

  // Re-init Materialize para este modal recién pintado
  if (window.M && M.updateTextFields) M.updateTextFields();

  // Wire eventos
  el.querySelector('#sc_btn_save').addEventListener('click', onSaveClicked);
}

function showModal() {
  const el = ensureContainer();
  const inst = M.Modal.getInstance(el) || M.Modal.init(el, { endingTop: '5%' });
  inst.open();
}

function closeModal() {
  const el = ensureContainer();
  const inst = M.Modal.getInstance(el);
  if (inst) inst.close();
}

function escapeHtml(s = '') {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
function escapeAttr(s = '') {
  return String(s).replaceAll('"', '&quot;');
}

function setAlert(type /* 'ok' | 'err' */, msg) {
  const el = document.getElementById('sc_alert');
  if (!el) return;
  el.classList.remove('hide');
  el.classList.toggle('green', type === 'ok');
  el.classList.toggle('green lighten-5', type === 'ok');
  el.classList.toggle('red', type !== 'ok');
  el.classList.toggle('red lighten-5', type !== 'ok');
  el.innerHTML = `<span class="${type === 'ok' ? 'green-text text-darken-3' : 'red-text text-darken-3'}">${escapeHtml(msg)}</span>`;
}

async function onSaveClicked(e) {
  e.preventDefault();

  const proveedorId = getValue('#sc_proveedorId').trim();
  const proveedorNombre = getValue('#sc_proveedorNombre').trim();
  const centroId = getValue('#sc_centroId').trim() || undefined;
  const centroCodigo = getValue('#sc_centroCodigo').trim() || undefined;
  const periodo = getValue('#sc_periodo').trim();
  const toneladas = Number(getValue('#sc_tons'));
  const responsable = getValue('#sc_responsable').trim() || undefined;
  const notas = getValue('#sc_notas').trim() || undefined;
  const origenContactoId = getValue('#sc_origenContactoId').trim() || undefined;

  if (!proveedorId) {
    setAlert('err', 'Debes indicar el ID del proveedor (abre el modal desde una fila de proveedor para precargarlo).');
    return;
  }
  if (!periodo) {
    setAlert('err', 'Debes seleccionar el periodo (YYYY-MM).');
    return;
  }
  if (!(toneladas >= 0)) {
    setAlert('err', 'Debes indicar una cantidad válida (ton).');
    return;
  }

  const payload = { proveedorId, periodo, toneladas };
  if (centroId) payload.centroId = centroId;
  if (responsable) payload.responsable = responsable;
  if (notas) payload.notas = (proveedorNombre ? `[${proveedorNombre}] ` : '') + notas;
  if (origenContactoId) payload.origenContactoId = origenContactoId;

  // (opcional) guardar el código del centro dentro de notas como referencia visual
  if (centroCodigo) {
    payload.notas = `${payload.notas ? payload.notas + ' — ' : ''}Centro: ${centroCodigo}`;
  }

  try {
    setAlert('ok', 'Guardando…');
    await crearSemiCerrado(payload);
    setAlert('ok', 'Semi-cerrado guardado correctamente.');
    // Cierra al toque y emite evento para refrescos externos
    setTimeout(() => {
      closeModal();
      document.dispatchEvent(new CustomEvent('semi-cerrado:saved', { detail: { proveedorId, periodo, toneladas } }));
    }, 300);
  } catch (err) {
    const msg = err?.body?.detalle
      ? `No se pudo guardar: ${err.message}. (Disponibilidad: ${fmtNum(err.body.detalle.disponibilidad)}, Asignado: ${fmtNum(err.body.detalle.asignado)}, Semi: ${fmtNum(err.body.detalle.semi)})`
      : `No se pudo guardar: ${err.message}`;
    setAlert('err', msg);
  }
}

function fmtNum(n) {
  if (n == null) return '—';
  try { return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(n); }
  catch { return String(n); }
}

function getValue(sel) {
  const el = document.querySelector(sel);
  return el ? el.value : '';
}

/**
 * API pública para abrir el modal desde la tabla u otras vistas.
 * Ej: window.openSemiCerradoModal({ proveedorId, proveedorNombre, centroId, centroCodigo, periodo, toneladas, responsable, notas, origenContactoId })
 */
export function openSemiCerradoModal(preset = {}) {
  renderModal(preset);
  showModal();
}

// Registramos el botón de la barra superior (Empresas)
function hookToolbarButton() {
  document.addEventListener('click', (ev) => {
    const btn = ev.target?.closest?.('#btnOpenSemiCerrado');
    if (!btn) return;
    // Abre sin datos: el usuario deberá ingresar el ID del proveedor.
    openSemiCerradoModal();
  }, { passive: true });
}

// Exponer en window para que tu tabla pueda usarlo sin imports.
if (typeof window !== 'undefined') {
  window.openSemiCerradoModal = openSemiCerradoModal;
}

function ready(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

ready(() => {
  ensureContainer();
  hookToolbarButton();
});
