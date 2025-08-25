// /js/contactos/form-contacto.js
import { apiCreateContacto, apiUpdateContacto, apiDeleteContacto } from '../../core/api.js';
import { state, $, getVal, setVal, slug } from './state.js';
import { cargarContactosGuardados } from './data.js';
import { syncHiddenFromSelect, mostrarCentrosDeProveedor, resetSelectCentros } from './proveedores.js';
import { comunaPorCodigo } from './normalizers.js';
import { renderTablaContactos } from './tabla.js';

const isValidObjectId = (s) => typeof s === 'string' && /^[0-9a-fA-F]{24}$/.test(s);

/* =================== INIT =================== */
export function setupFormulario() {
  const form = $('#formContacto');
  if (!form) return;

  state.editId = null;

  // Sincroniza los hidden cuando cambie el centro
  const selCentro = $('#selectCentro');
  selCentro?.addEventListener('change', () => syncHiddenFromSelect(selCentro));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    /* -------- EMPRESA (opcional) -------- */
    const proveedorKeyRaw    = (getVal(['proveedorKey', 'proveedorId']) || '').trim();
    const proveedorNombreRaw = (getVal(['proveedorNombre']) || '').trim();
    const proveedorKey       = proveedorKeyRaw || null;
    const proveedorNombre    = proveedorNombreRaw || null;
    const hasEmpresa         = !!(proveedorKey && proveedorNombre);

    /* -------- PERSONA (permite “sin empresa”) -------- */
    const contactoNombre   = $('#contactoNombre')?.value?.trim() || '';
    const contactoTelefono = $('#contactoTelefono')?.value?.trim() || '';
    const contactoEmail    = $('#contactoEmail')?.value?.trim() || '';
    const hasPersona       = !!contactoNombre && (!!contactoTelefono || !!contactoEmail);

    if (!hasEmpresa && !hasPersona) {
      M.toast?.({ html: 'Ingresa una empresa o una persona (nombre + teléfono o email).', displayLength: 2800 });
      ($('#contactoNombre')?.focus?.());
      return;
    }

    // Si no hay empresa, limpia centro
    if (!hasEmpresa) {
      setVal(['centroId','centroCodigo','centroComuna','centroHectareas'], '');
      resetSelectCentros();
    }

    /* -------- Otros campos -------- */
    const tieneMMPP            = $('#tieneMMPP').value || '';
    const fechaDisponibilidad  = $('#fechaDisponibilidad').value || null;
    const dispuestoVender      = $('#dispuestoVender').value || '';
    const vendeActualmenteA    = $('#vendeActualmenteA').value.trim();
    const notas                = $('#notasContacto').value.trim();
    const tonsDisponiblesAprox = $('#tonsDisponiblesAprox')?.value ?? '';

    // Asegura que los hidden estén sincronizados aunque no haya cambiado el select
    syncHiddenFromSelect(selCentro);

    const centroId        = hasEmpresa ? (getVal(['centroId']) || null) : null;
    const centroCodigo    = hasEmpresa ? (getVal(['centroCodigo']) || null) : null;
    const centroComuna    = hasEmpresa ? (getVal(['centroComuna']) || comunaPorCodigo(centroCodigo) || null) : null;
    const centroHectareas = hasEmpresa ? (getVal(['centroHectareas']) || null) : null;

    // Resultado inferido a partir de disponibilidad (si se indicó)
    let resultado = '';
    if (tieneMMPP === 'Sí')      resultado = 'Disponible';
    else if (tieneMMPP === 'No') resultado = 'No disponible';

    const payload = {
      // Empresa (opcional)
      proveedorKey,
      proveedorNombre,

      // Estado / disposición
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
      console.log('[form-contacto] submit →', isValidObjectId(editId) ? 'UPDATE' : 'CREATE', { editId, payload });

      if (isValidObjectId(editId)) {
        await apiUpdateContacto(editId, payload); // PATCH (o PUT) según api.js
      } else {
        await apiCreateContacto(payload);
      }

      // Refresca estado y tablas (Contactos + Personas)
      await cargarContactosGuardados();
      renderTablaContactos();
      document.dispatchEvent(new Event('reload-tabla-contactos'));

      M.toast?.({
        html: isValidObjectId(editId) ? 'Contacto actualizado' : 'Contacto guardado',
        displayLength: 2000
      });

      // Limpieza de formulario y estado
      const modalInst = M.Modal.getInstance(document.getElementById('modalContacto'));
      form.reset();
      setVal(['centroId','centroCodigo','centroComuna','centroHectareas'], '');
      setVal(['proveedorKey','proveedorId','proveedorNombre'], '');
      state.editId = null;
      modalInst?.close();
    } catch (err) {
      console.error('[form-contacto] ERROR:', err?.message || err);
      M.toast?.({ html: 'Error al guardar contacto', displayLength: 2500 });
    }
  });
}

/* =================== EDICIÓN =================== */
export function abrirEdicion(c) {
  state.editId = c._id;

  // Empresa
  const hasEmpresa = !!(c.proveedorKey || c.proveedorNombre);
  $('#buscadorProveedor').value = c.proveedorNombre || '';
  setVal(['proveedorNombre'], c.proveedorNombre || '');
  const key = c.proveedorKey || (c.proveedorNombre ? slug(c.proveedorNombre) : '');
  setVal(['proveedorKey','proveedorId'], key || '');

  // Centros del proveedor
  if (hasEmpresa && key) {
    mostrarCentrosDeProveedor(key, c.centroId || null);
    setVal(['centroId'], c.centroId || '');
    setVal(['centroCodigo'], c.centroCodigo || '');
    setVal(['centroComuna'], c.centroComuna || '');
    setVal(['centroHectareas'], c.centroHectareas || '');
  } else {
    resetSelectCentros();
    setVal(['centroId','centroCodigo','centroComuna','centroHectareas'], '');
  }

  // Estado / varios
  $('#tieneMMPP').value = c.tieneMMPP || '';
  $('#dispuestoVender').value = c.dispuestoVender || '';
  $('#fechaDisponibilidad').value = c.fechaDisponibilidad ? (''+c.fechaDisponibilidad).slice(0,10) : '';
  $('#tonsDisponiblesAprox').value = c.tonsDisponiblesAprox ?? '';
  $('#vendeActualmenteA').value = c.vendeActualmenteA || '';
  $('#notasContacto').value = c.notas || '';

  // Persona
  $('#contactoNombre').value = c.contactoNombre || '';
  $('#contactoTelefono').value = c.contactoTelefono || '';
  $('#contactoEmail').value = c.contactoEmail || '';

  M.updateTextFields();
  const modal = document.getElementById('modalContacto');
  (M.Modal.getInstance(modal) || M.Modal.init(modal)).open();
}

/* =================== BORRADO =================== */
export async function eliminarContacto(id) {
  await apiDeleteContacto(id);
  await cargarContactosGuardados();
  renderTablaContactos();
  document.dispatchEvent(new Event('reload-tabla-contactos'));
  M.toast?.({ html: 'Contacto eliminado', displayLength: 1800 });
}

/* =================== NUEVO =================== */
export function prepararNuevo() {
  state.editId = null;
  const form = $('#formContacto');
  form?.reset();
  setVal(['proveedorKey','proveedorId','proveedorNombre'], '');
  resetSelectCentros();
  setVal(['centroId','centroCodigo','centroComuna','centroHectareas'], '');
}

/* =================== UTILS =================== */
function normalizeNumber(s) {
  if (s == null || s === '') return null;
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
