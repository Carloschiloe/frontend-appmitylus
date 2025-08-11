import { apiCreateContacto, apiUpdateContacto, apiDeleteContacto } from '/js/core/api.js';
import { state, $, getVal, setVal, slug } from './state.js';
import { cargarContactosGuardados } from './data.js';
import { mostrarCentrosDeProveedor, resetSelectCentros } from './proveedores.js';
import { renderTablaContactos } from './tabla.js';

export function setupFormulario() {
  const form = $('#formContacto'); if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const proveedorKey    = getVal(['proveedorKey','proveedorId']).trim();
    const proveedorNombre = getVal(['proveedorNombre']).trim();
    if (!proveedorKey || !proveedorNombre) {
      M.toast?.({ html: 'Selecciona un proveedor válido', displayLength: 2500 });
      $('#buscadorProveedor').focus(); return;
    }

    const tieneMMPP           = $('#tieneMMPP').value;
    const fechaDisponibilidad = $('#fechaDisponibilidad').value || null;
    const dispuestoVender     = $('#dispuestoVender').value;
    const vendeActualmenteA   = $('#vendeActualmenteA').value.trim();
    const notas               = $('#notasContacto').value.trim();
    const tonsDisponiblesAprox = $('#tonsDisponiblesAprox')?.value ?? '';

    const contactoNombre   = $('#contactoNombre')?.value?.trim() || '';
    const contactoTelefono = $('#contactoTelefono')?.value?.trim() || '';
    const contactoEmail    = $('#contactoEmail')?.value?.trim() || '';

    const centroId    = getVal(['centroId']) || null;
    const _centroCode = getVal(['centroCode','centroCodigo']) || null;

    const resultado = tieneMMPP === 'Sí' ? 'Disponible' : (tieneMMPP === 'No' ? 'No disponible' : '');
    if (!resultado) { M.toast?.({ html: 'Selecciona disponibilidad (Sí/No)', displayLength: 2500 }); return; }

    const payload = {
      proveedorKey, proveedorNombre,
      resultado, tieneMMPP, fechaDisponibilidad, dispuestoVender,
      vendeActualmenteA, notas,
      centroId, centroCodigo: _centroCode || null,
      tonsDisponiblesAprox: (tonsDisponiblesAprox !== '' ? Number(tonsDisponiblesAprox) : null),
      contactoNombre, contactoTelefono, contactoEmail
    };

    try {
      if (state.editId) {
        await apiUpdateContacto(state.editId, payload);
      } else {
        await apiCreateContacto(payload);
      }
      await cargarContactosGuardados();
      renderTablaContactos();
      M.toast?.({ html: state.editId ? 'Contacto actualizado' : 'Contacto guardado', displayLength: 2000 });

      const modalInst = M.Modal.getInstance(document.getElementById('modalContacto'));
      form.reset();
      state.editId = null;
      modalInst?.close();
    } catch (err) {
      console.error('[guardarContacto] ERROR:', err?.message || err);
      M.toast?.({ html: 'Error al guardar contacto', displayLength: 2500 });
    }
  });
}

export function abrirEdicion(c) {
  state.editId = c._id;

  $('#buscadorProveedor').value = c.proveedorNombre || '';
  setVal(['proveedorNombre'], c.proveedorNombre || '');
  const key = c.proveedorKey || slug(c.proveedorNombre || '');
  setVal(['proveedorKey','proveedorId'], key);

  mostrarCentrosDeProveedor(key, c.centroId || null);

  $('#tieneMMPP').value = c.tieneMMPP || '';
  $('#dispuestoVender').value = c.dispuestoVender || '';

  $('#fechaDisponibilidad').value = c.fechaDisponibilidad ? (''+c.fechaDisponibilidad).slice(0,10) : '';
  $('#tonsDisponiblesAprox').value = c.tonsDisponiblesAprox ?? '';
  $('#vendeActualmenteA').value = c.vendeActualmenteA || '';
  $('#notasContacto').value = c.notas || '';

  $('#contactoNombre').value = c.contactoNombre || '';
  $('#contactoTelefono').value = c.contactoTelefono || '';
  $('#contactoEmail').value = c.contactoEmail || '';

  M.updateTextFields();

  const modalInst = M.Modal.getInstance(document.getElementById('modalContacto')) || M.Modal.init(document.getElementById('modalContacto'));
  modalInst.open();
}

export async function eliminarContacto(id) {
  await apiDeleteContacto(id);
  await cargarContactosGuardados();
  renderTablaContactos();
  M.toast?.({ html: 'Contacto eliminado', displayLength: 1800 });
}

export function prepararNuevo() {
  state.editId = null;
  const form = $('#formContacto');
  form?.reset();
  setVal(['proveedorKey','proveedorId'],'');
  setVal(['proveedorNombre'],'');
  resetSelectCentros();
}
