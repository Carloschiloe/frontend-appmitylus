// /js/contactos/form-contacto.js
import { apiCreateContacto, apiUpdateContacto, apiDeleteContacto } from '/js/core/api.js';
import { state, $, getVal, setVal, slug } from './state.js';
import { cargarContactosGuardados, copyCentroToHidden, lookupComunaByCodigo } from './data.js';
import { mostrarCentrosDeProveedor, resetSelectCentros } from './proveedores.js';
import { renderTablaContactos } from './tabla.js';

const isValidObjectId = (s) => typeof s === 'string' && /^[0-9a-fA-F]{24}$/.test(s);

export function setupFormulario() {
  const form = $('#formContacto');
  if (!form) return;

  // modo "nuevo" por defecto
  state.editId = null;

  // cuando cambie el centro, copiar data-* a los hidden (incluye comuna)
  const selCentro = $('#selectCentro');
  selCentro?.addEventListener('change', () => copyCentroToHidden(selCentro));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const proveedorKey    = getVal(['proveedorKey','proveedorId']).trim();
    const proveedorNombre = getVal(['proveedorNombre']).trim();
    if (!proveedorKey || !proveedorNombre) {
      M.toast?.({ html: 'Selecciona un proveedor válido', displayLength: 2500 });
      $('#buscadorProveedor')?.focus();
      return;
    }

    const tieneMMPP            = $('#tieneMMPP').value;
    const fechaDisponibilidad  = $('#fechaDisponibilidad').value || null;
    const dispuestoVender      = $('#dispuestoVender').value;
    const vendeActualmenteA    = $('#vendeActualmenteA').value.trim();
    const notas                = $('#notasContacto').value.trim();
    const tonsDisponiblesAprox = $('#tonsDisponiblesAprox')?.value ?? '';

    const contactoNombre   = $('#contactoNombre')?.value?.trim() || '';
    const contactoTelefono = $('#contactoTelefono')?.value?.trim() || '';
    const contactoEmail    = $('#contactoEmail')?.value?.trim() || '';

    // sincroniza hidden del centro por si el usuario no salió del select
    copyCentroToHidden(selCentro);

    const centroId     = getVal(['centroId']) || null;
    const centroCodigo = getVal(['centroCode','centroCodigo']) || null;
    // 👇 comuna a guardar: hidden -> fallback al catálogo de centros
    const centroComuna = getVal(['centroComuna']) || lookupComunaByCodigo(centroCodigo) || null;
    const centroHectareas = getVal(['centroHectareas']) || null;

    const resultado = tieneMMPP === 'Sí' ? 'Disponible'
                    : (tieneMMPP === 'No' ? 'No disponible' : '');
    if (!resultado) {
      M.toast?.({ html: 'Selecciona disponibilidad (Sí/No)', displayLength: 2500 });
      return;
    }

    const payload = {
      proveedorKey, proveedorNombre,
      resultado, tieneMMPP, fechaDisponibilidad, dispuestoVender,
      vendeActualmenteA, notas,
      centroId,
      centroCodigo,
      centroComuna,          // ← se guarda
      centroHectareas,       // (por si lo necesitas en backend)
      tonsDisponiblesAprox: normalizeNumber(tonsDisponiblesAprox),
      contactoNombre, contactoTelefono, contactoEmail
    };

    try {
      const editId = state.editId;
      console.log('[guardarContacto] editId=', editId, 'payload=', payload);

      if (isValidObjectId(editId)) {
        await apiUpdateContacto(editId, payload);
      } else {
        await apiCreateContacto(payload);
      }

      await cargarContactosGuardados();
      renderTablaContactos();
      M.toast?.({
        html: isValidObjectId(editId) ? 'Contacto actualizado' : 'Contacto guardado',
        displayLength: 2000
      });

      const modalInst = M.Modal.getInstance(document.getElementById('modalContacto'));
      form.reset();
      // limpia hidden del centro
      setVal(['centroId','centroCodigo','centroCode','centroComuna','centroHectareas'], '');
      state.editId = null;
      modalInst?.close();
    } catch (err) {
      console.error('[guardarContacto] ERROR:', err?.message || err);
      M.toast?.({ html: 'Error al guardar contacto', displayLength: 2500 });
    }
  });
}

export function abrirEdicion(c) {
  state.editId = c._id; // solo al editar

  $('#buscadorProveedor').value = c.proveedorNombre || '';
  setVal(['proveedorNombre'], c.proveedorNombre || '');
  const key = c.proveedorKey || slug(c.proveedorNombre || '');
  setVal(['proveedorKey','proveedorId'], key);

  // poblar centros del proveedor y seleccionar el actual
  mostrarCentrosDeProveedor(key, c.centroId || null);

  // setear hidden del centro por si no cambia nada
  setVal(['centroId'], c.centroId || '');
  setVal(['centroCodigo','centroCode'], c.centroCodigo || '');
  setVal(['centroComuna'], c.centroComuna || '');
  setVal(['centroHectareas'], c.centroHectareas || '');

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

  const modal = document.getElementById('modalContacto');
  (M.Modal.getInstance(modal) || M.Modal.init(modal)).open();
}

export async function eliminarContacto(id) {
  await apiDeleteContacto(id);
  await cargarContactosGuardados();
  renderTablaContactos();
  M.toast?.({ html: 'Contacto eliminado', displayLength: 1800 });
}

export function prepararNuevo() {
  // cada vez que abras “Registrar contacto”, limpia editId
  state.editId = null;
  const form = $('#formContacto');
  form?.reset();
  setVal(['proveedorKey','proveedorId','proveedorNombre'], '');
  resetSelectCentros();
  // limpia hidden del centro
  setVal(['centroId','centroCodigo','centroCode','centroComuna','centroHectareas'], '');
}

/* ---------------- utils ---------------- */
function normalizeNumber(s){
  if (s == null || s === '') return null;
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
