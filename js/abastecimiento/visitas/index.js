// /js/abastecimiento/visitas/index.js
import { setVisitas, visitasRaw } from './state.js';
import { cargarVisitasEnriquecidas } from './data.js';
import { renderTablaVisitas } from './tabla.js';

import { apiDeleteVisita, apiUpdateVisita } from '/js/core/api.js';

// helper del módulo Contactos (solo usamos el $ para seleccionar rápido)
import { $ } from '../contactos/state.js';

let _initialized = false;
let _bound = false;
let _submitHooked = false;
let __editVisitaId = null;

// ------- público --------
export async function initVisitasTab(forceReload = false) {
  if (_initialized && !forceReload) return;

  await cargarYRenderVisitas();
  bindActions();     // click en editar/eliminar (una sola vez)
  hookEditSubmit();  // intercepta submit SOLO cuando es edición
  _initialized = true;
}

// ------- internos --------
async function cargarYRenderVisitas() {
  try {
    // ya nos devuelve enriquecido; NO pasar función
    const { raw, rows } = await cargarVisitasEnriquecidas();
    setVisitas(raw, rows);
    renderTablaVisitas(rows);
  } catch (e) {
    console.error('[Visitas] Error al cargar:', e);
    M.toast?.({ html: 'Error al cargar visitas', displayLength: 2500 });
  }
}

function bindActions() {
  if (_bound) return;
  _bound = true;

  const jq = window.jQuery || window.$;

  jq('#tablaVisitas tbody')
    // Eliminar
    .on('click', 'a.icon-action.eliminar', async function () {
      const id = this.dataset.id;
      if (!confirm('¿Eliminar esta visita?')) return;

      try {
        await apiDeleteVisita(id);
        M.toast?.({ html: 'Visita eliminada', displayLength: 1500 });
        await cargarYRenderVisitas();
      } catch (e) {
        console.error(e);
        M.toast?.({ html: 'No se pudo eliminar', displayLength: 2000 });
      }
    })
    // Editar
    .on('click', 'a.icon-action.editar', function () {
      const id = this.dataset.id;
      const v = visitasRaw.find(x => String(x._id) === String(id));
      if (v) openEditVisita(v);
    });
}

function openEditVisita(v) {
  __editVisitaId = v._id;

  // Rellenamos campos del modal
  setHidden('visita_proveedorId', v.contactoId);
  setValue('visita_fecha', (v.fecha || '').slice(0, 10));
  setValue('visita_contacto', v.contacto || '');
  setValue('visita_enAgua', v.enAgua || '');
  setValue('visita_tonsComprometidas', v.tonsComprometidas ?? '');
  setValue('visita_estado', v.estado || '');
  setValue('visita_observaciones', v.observaciones || '');

  // Centro: si la opción no existe, la creamos temporalmente para poder seleccionarla
  const sel = $('#visita_centroId');
  if (sel) {
    const hasOption = v.centroId && [...sel.options].some(o => String(o.value) === String(v.centroId));
    if (!hasOption && v.centroId) {
      const opt = document.createElement('option');
      opt.value = v.centroId;
      opt.textContent = (v.centroCodigo || v.centroId);
      // 🔴 importante: para que al guardar podamos leer centroCodigo
      opt.dataset.code = v.centroCodigo || '';
      sel.insertBefore(opt, sel.firstChild);
    }
    sel.value = v.centroId || '';
  }

  M.updateTextFields();
  const modal = M.Modal.getInstance(document.getElementById('modalVisita'))
             || M.Modal.init(document.getElementById('modalVisita'));
  modal.open();
}

function hookEditSubmit() {
  if (_submitHooked) return;
  _submitHooked = true;

  const form = $('#formVisita');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    // Solo interceptamos cuando estamos editando
    if (!__editVisitaId) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const selCentro = $('#visita_centroId');
    const centroId = selCentro?.value || null;
    const centroCodigo =
      selCentro?.selectedOptions?.[0]?.dataset?.code || null;

    const payload = {
      contactoId: $('#visita_proveedorId').value,
      fecha: $('#visita_fecha').value,
      centroId,
      centroCodigo,
      contacto: $('#visita_contacto').value || null,
      enAgua: $('#visita_enAgua').value || null,
      tonsComprometidas: $('#visita_tonsComprometidas').value
        ? Number($('#visita_tonsComprometidas').value) : null,
      estado: $('#visita_estado').value || '',
      observaciones: $('#visita_observaciones').value || null
    };

    try {
      await apiUpdateVisita(__editVisitaId, payload);
      __editVisitaId = null;

      M.toast?.({ html: 'Visita actualizada', classes: 'teal', displayLength: 1500 });
      M.Modal.getInstance(document.getElementById('modalVisita'))?.close();
      form.reset();

      await cargarYRenderVisitas();
    } catch (err) {
      console.error(err);
      M.toast?.({ html: 'No se pudo actualizar', displayLength: 2000 });
    }
  });
}

// pequeños helpers de valores
function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? '';
}
function setHidden(id, val) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('input');
    el.type = 'hidden';
    el.id = id;
    document.body.appendChild(el);
  }
  el.value = val ?? '';
}


