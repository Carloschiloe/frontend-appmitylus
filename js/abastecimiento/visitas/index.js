// /js/abastecimiento/visitas/index.js
import { setVisitas, visitasRaw } from './state.js';
import { cargarVisitasEnriquecidas } from './data.js';
import { renderTablaVisitas } from './tabla.js';
import { apiDeleteVisita, apiUpdateVisita } from '/js/core/api.js';

// Helper local (evita depender de Contactos)
const qs = (sel) => document.querySelector(sel);

let _initialized = false;
let _bound = false;
let _submitHooked = false;
let __editVisitaId = null;

// ------- público --------
export async function initVisitasTab(forceReload = false) {
  if (_initialized && !forceReload) return;
  await cargarYRenderVisitas();
  bindActions();     // delegación jQuery (una sola vez)
  hookEditSubmit();  // intercepta submit SOLO en edición
  _initialized = true;
}

// ------- internos --------
async function cargarYRenderVisitas() {
  try {
    const { raw, rows } = await cargarVisitasEnriquecidas(); // ya enriquecidas
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

  // Relleno campos
  setHidden('visita_proveedorId', v.contactoId);
  setValue('visita_fecha', (v.fecha || '').slice(0, 10));
  setValue('visita_contacto', v.contacto || '');
  setValue('visita_enAgua', v.enAgua || '');
  setValue('visita_tonsComprometidas', v.tonsComprometidas ?? '');
  setValue('visita_estado', v.estado || '');
  setValue('visita_observaciones', v.observaciones || '');

  // Centro: si la opción no existe, se crea temporal con data-code
  const sel = qs('#visita_centroId');
  if (sel) {
    const hasOption = v.centroId && [...sel.options].some(o => String(o.value) === String(v.centroId));
    if (!hasOption && v.centroId) {
      const opt = document.createElement('option');
      opt.value = v.centroId;
      opt.textContent = (v.centroCodigo || v.centroId);
      opt.dataset.code = v.centroCodigo || '';
      sel.insertBefore(opt, sel.firstChild);
    }
    sel.value = v.centroId || '';
  }

  M.updateTextFields();
  const el = document.getElementById('modalVisita');
  const modal = M.Modal.getInstance(el) || M.Modal.init(el, {
    onCloseEnd: () => {                // 🔒 limpia estado si se cierra sin guardar
      __editVisitaId = null;
      const f = qs('#formVisita'); f?.reset();
    }
  });
  modal.open();
}

function hookEditSubmit() {
  if (_submitHooked) return;
  _submitHooked = true;

  const form = qs('#formVisita');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    // Solo interceptamos cuando estamos editando
    if (!__editVisitaId) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const selCentro = qs('#visita_centroId');
    const centroId = selCentro?.value || null;
    const centroCodeFromDataset =
      selCentro?.selectedOptions?.[0]?.dataset?.code ||
      selCentro?.selectedOptions?.[0]?.getAttribute('data-code') || null;

    const payload = {
      contactoId: qs('#visita_proveedorId')?.value || null,
      fecha: qs('#visita_fecha')?.value || null,
      centroId,
      centroCodigo: centroCodeFromDataset,
      contacto: qs('#visita_contacto')?.value || null,
      enAgua: qs('#visita_enAgua')?.value || null,
      tonsComprometidas: qs('#visita_tonsComprometidas')?.value
        ? Number(qs('#visita_tonsComprometidas').value) : null,
      estado: qs('#visita_estado')?.value || '',
      observaciones: qs('#visita_observaciones')?.value || null
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

// helpers DOM
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
    const form = qs('#formVisita');
    (form || document.body).appendChild(el);  // ✅ dentro del form si existe
  }
  el.value = val ?? '';
}
