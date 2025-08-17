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

  // copiar data-* del <option> del centro a inputs hidden
  const selCentro = $('#selectCentro');
  selCentro?.addEventListener('change', () => copyCentroToHidden(selCentro));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // --- EMPRESA (opcional) ---
    const proveedorKeyRaw    = (getVal(['proveedorKey','proveedorId']) || '').trim();
    const proveedorNombreRaw = (getVal(['proveedorNombre']) || '').trim();
    const proveedorKey       = proveedorKeyRaw || null;
    const proveedorNombre    = proveedorNombreRaw || null;
    const hasEmpresa         = !!(proveedorKey && proveedorNombre);

    // --- PERSONA (para permitir "sin empresa") ---
    const contactoNombre   = $('#contactoNombre')?.value?.trim() || '';
    const contactoTelefono = $('#contactoTelefono')?.value?.trim() || '';
    const contactoEmail    = $('#contactoEmail')?.value?.trim() || '';
    const hasPersona       = !!contactoNombre && (!!contactoTelefono || !!contactoEmail);

    // Validación mínima: debe haber empresa O persona
    if (!hasEmpresa && !hasPersona) {
      M.toast?.({ html: 'Ingresa una empresa o una persona (nombre + teléfono o email).', displayLength: 2800 });
      ($('#contactoNombre')?.focus?.());
      return;
    }

    // si no hay empresa, asegurar que NO viaja centro
    if (!hasEmpresa) {
      setVal(['centroId','centroCodigo','centroCode','centroComuna','centroHectareas'], '');
      resetSelectCentros();
    }

    // --- resto de campos ---
    const tieneMMPP            = $('#tieneMMPP').value;           // opcional
    const fechaDisponibilidad  = $('#fechaDisponibilidad').value || null;
    const dispuestoVender      = $('#dispuestoVender').value;     // opcional
    const vendeActualmenteA    = $('#vendeActualmenteA').value.trim();
    const notas                = $('#notasContacto').value.trim();
    const tonsDisponiblesAprox = $('#tonsDisponiblesAprox')?.value ?? '';

    // sincroniza hidden del centro por si el usuario no salió del select
    copyCentroToHidden(selCentro);

    const centroId        = hasEmpresa ? (getVal(['centroId']) || null) : null;
    const centroCodigo    = hasEmpresa ? (getVal(['centroCode','centroCodigo']) || null) : null;
    const centroComuna    = hasEmpresa ? (getVal(['centroComuna']) || lookupComunaByCodigo(centroCodigo) || null) : null;
    const centroHectareas = hasEmpresa ? (getVal(['centroHectareas']) || null) : null;

    // Resultado: solo lo inferimos si eliges disponibilidad; si no, va vacío
    let resultado = '';
    if (tieneMMPP === 'Sí') resultado = 'Disponible';
    else if (tieneMMPP === 'No') resultado = 'No disponible';
    // (si está vacío y no hay empresa, el backend lo acepta)

    const payload = {
      // Empresa (opcional)
      proveedorKey,
      proveedorNombre,

      // Estado / disposición (opcionales)
      resultado,
      tieneMMPP,
      fechaDisponibilidad,
      dispuestoVender,
      vendeActualmenteA,
      notas,

      // Centro (opcional)
      centroId,
      centroCodigo,
      centroComuna,
      centroHectareas,

      // Persona
      contactoNombre,
      contactoTelefono,
      contactoEmail,

      // numérico
      tonsDisponiblesAprox: normalizeNumber(tonsDisponiblesAprox),
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

      // limpia hidden y proveedor
      setVal(['centroId','centroCodigo','centroCode','centroComuna','centroHectareas'], '');
      setVal(['proveedorKey','proveedorId','proveedorNombre'], '');

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

  // --- Empresa ---
  const hasEmpresa = !!(c.proveedorKey || c.proveedorNombre);
  $('#buscadorProveedor').value = c.proveedorNombre || '';
  setVal(['proveedorNombre'], c.proveedorNombre || '');
  const key = c.proveedorKey || (c.proveedorNombre ? slug(c.proveedorNombre) : '');
  setVal(['proveedorKey','proveedorId'], key || '');

  // --- Centros del proveedor ---
  if (hasEmpresa && key) {
    mostrarCentrosDeProveedor(key, c.centroId || null);
    // setear hidden del centro por si no cambia nada
    setVal(['centroId'], c.centroId || '');
    setVal(['centroCodigo','centroCode'], c.centroCodigo || '');
    setVal(['centroComuna'], c.centroComuna || '');
    setVal(['centroHectareas'], c.centroHectareas || '');
  } else {
    // sin empresa => no pueblas centros
    resetSelectCentros();
    setVal(['centroId','centroCodigo','centroCode','centroComuna','centroHectareas'], '');
  }

  // --- Estado / campos varios ---
  $('#tieneMMPP').value = c.tieneMMPP || '';
  $('#dispuestoVender').value = c.dispuestoVender || '';
  $('#fechaDisponibilidad').value = c.fechaDisponibilidad ? (''+c.fechaDisponibilidad).slice(0,10) : '';
  $('#tonsDisponiblesAprox').value = c.tonsDisponiblesAprox ?? '';
  $('#vendeActualmenteA').value = c.vendeActualmenteA || '';
  $('#notasContacto').value = c.notas || '';

  // --- Persona ---
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
  state.editId = null;
  const form = $('#formContacto');
  form?.reset();
  setVal(['proveedorKey','proveedorId','proveedorNombre'], '');
  resetSelectCentros();
  setVal(['centroId','centroCodigo','centroCode','centroComuna','centroHectareas'], '');
}

/* ---------------- utils ---------------- */
function normalizeNumber(s){
  if (s == null || s === '') return null;
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
