// /js/contactos/form-contacto.js
import { apiCreateContacto, apiUpdateContacto, apiDeleteContacto } from '../../core/api.js';
import { state, $, getVal, setVal, slug } from './state.js';
import { cargarContactosGuardados } from './data.js';
import { syncHiddenFromSelect, mostrarCentrosDeProveedor, resetSelectCentros } from './proveedores.js';
import { comunaPorCodigo } from './normalizers.js';
import { renderTablaContactos } from './tabla.js';

const isValidObjectId = (s) => typeof s === 'string' && /^[0-9a-fA-F]{24}$/.test(s);

/* ---------- Disponibilidades (colección nueva, con fallback a asignaciones) ---------- */
const API_BASE = window.API_URL || '/api';
const MESES_N = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const pad2 = (n)=>String(n).padStart(2,'0');
const mesKeyFrom = (y,m)=>`${y}-${pad2(m)}`;

// Crea disponibilidad en /disponibilidades; si falla, intenta /asignaciones (compat)
async function postDisponibilidad(disp){
  // intento principal: /disponibilidades
  let r = await fetch(`${API_BASE}/disponibilidades`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(disp)
  });
  if (r.ok) { try { return await r.json(); } catch { return null; } }

  // fallback legacy: /asignaciones (conversión tonsDisponible -> tons)
  const legacy = { ...disp, tons: disp.tonsDisponible };
  delete legacy.tonsDisponible;
  r = await fetch(`${API_BASE}/asignaciones`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(legacy)
  });
  if(!r.ok) throw new Error('POST disponibilidad/asignacion '+r.status);
  try { return await r.json(); } catch { return null; }
}

// Lee disponibilidades por proveedorKey y (opcional) centroId. Si no existe endpoint, hace fallback.
async function fetchDisponibilidades({ proveedorKey, centroId }){
  const qs = new URLSearchParams();
  if (proveedorKey) qs.set('proveedorKey', proveedorKey);
  if (centroId)     qs.set('centroId', centroId);

  // 1) /disponibilidades
  let r = await fetch(`${API_BASE}/disponibilidades?${qs.toString()}`);
  if (r.ok) { try { return await r.json(); } catch { /* noop */ } }

  // 2) fallback /asignaciones
  r = await fetch(`${API_BASE}/asignaciones?${qs.toString()}`);
  if (!r.ok) return [];
  try { return await r.json(); } catch { return []; }
}

function renderDisponibilidades(list){
  if(!Array.isArray(list) || !list.length){
    return '<span class="grey-text">Sin asignaciones registradas.</span>';
  }
  const rows = list.slice()
    .sort((a,b)=>((b.anio||0)*100+(b.mes||0))-((a.anio||0)*100+(a.mes||0)))
    .map(a=>{
      const mm = MESES_N[a.mes] || a.mes || '';
      const yy = a.anio ?? '';
      const tons = Number((a.tonsDisponible ?? a.tons) || 0);
      const estado = a.estado || '';
      return `<tr>
        <td>${mm} ${yy}</td>
        <td style="text-align:right">${tons.toLocaleString('es-CL',{maximumFractionDigits:2})}</td>
        <td>${estado}</td>
      </tr>`;
    }).join('');
  return `<table class="striped" style="margin:6px 0">
    <thead><tr><th>Mes</th><th style="text-align:right">Tons</th><th>Estado</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// Pinta historial en el panel del modal de edición (bloque asigHist)
async function pintarHistorialEdicionFromContacto(c){
  const box = document.getElementById('asigHist'); if(!box) return;
  box.innerHTML = '<span class="grey-text">Cargando disponibilidad...</span>';
  try {
    const lista = await fetchDisponibilidades({ proveedorKey: c.proveedorKey, centroId: c.centroId });
    box.innerHTML = renderDisponibilidades(lista);
  } catch (e) {
    console.error(e);
    box.innerHTML = '<span class="red-text">No se pudo cargar disponibilidad</span>';
  }
}

// Inyecta el historial en el modal del ojo al abrirse
function hookDetalleHistorial(){
  const body = document.getElementById('detalleContactoBody');
  if(!body) return;
  const obs = new MutationObserver(async ()=>{
    const c = state.contactoActual; if(!c) return;
    if(body.querySelector('#detalleAsignaciones')) return;

    const wrap = document.createElement('div');
    wrap.id='detalleAsignaciones';
    wrap.innerHTML = `
      <h6 class="grey-text text-darken-2" style="margin-top:12px">Disponibilidad registrada</h6>
      <div id="detalleAsignacionesTable" class="card-panel grey lighten-4" style="padding:8px 12px">
        <span class="grey-text">Cargando disponibilidad...</span>
      </div>`;
    body.appendChild(wrap);

    try{
      const lista = await fetchDisponibilidades({ proveedorKey: c.proveedorKey, centroId: c.centroId });
      body.querySelector('#detalleAsignacionesTable').innerHTML = renderDisponibilidades(lista);
    }catch(e){
      body.querySelector('#detalleAsignacionesTable').innerHTML = '<span class="red-text">No se pudo cargar disponibilidad</span>';
    }
  });
  obs.observe(body, {childList:true, subtree:true});
}

/* -------------------- utilidades de formulario -------------------- */
function clearCentroHidden(){ setVal(['centroId'],''); setVal(['centroCodigo'],''); setVal(['centroComuna'],''); setVal(['centroHectareas'],''); }
function clearProveedorHidden(){ setVal(['proveedorKey'],''); setVal(['proveedorId'],''); setVal(['proveedorNombre'],''); }

/* ============================ Setup ============================ */
export function setupFormulario() {
  const form = $('#formContacto'); if (!form) return;
  state.editId = null;

  // Para el modal del ojo: guarda el contacto seleccionado
  document.addEventListener('click', (e)=>{
    const a = e.target.closest?.('a.icon-action.ver'); if(!a) return;
    const id = a.dataset.id;
    state.contactoActual = (state.contactosGuardados||[]).find(x=>String(x._id)===String(id)) || null;
  }, true);
  hookDetalleHistorial();

  const selCentro = $('#selectCentro');
  selCentro?.addEventListener('change', () => syncHiddenFromSelect(selCentro));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const proveedorKeyRaw    = (getVal(['proveedorKey','proveedorId']) || '').trim();
    const proveedorNombreRaw = (getVal(['proveedorNombre']) || '').trim();
    const proveedorKey    = proveedorKeyRaw || null;
    const proveedorNombre = proveedorNombreRaw || null;
    const hasEmpresa      = !!(proveedorKey && proveedorNombre);

    const contactoNombre   = $('#contactoNombre')?.value?.trim() || '';
    const contactoTelefono = $('#contactoTelefono')?.value?.trim() || '';
    const contactoEmail    = $('#contactoEmail')?.value?.trim() || '';
    const hasPersona       = !!contactoNombre && (!!contactoTelefono || !!contactoEmail);
    if (!hasEmpresa && !hasPersona) {
      M.toast?.({ html: 'Ingresa una empresa o una persona (nombre + teléfono o email).', displayLength: 2800 });
      ($('#contactoNombre')?.focus?.()); return;
    }

    if (!hasEmpresa) { clearCentroHidden(); resetSelectCentros(); }

    const tieneMMPP         = $('#tieneMMPP')?.value || '';
    const dispuestoVender   = $('#dispuestoVender')?.value || '';
    const vendeActualmenteA = $('#vendeActualmenteA')?.value?.trim() || '';
    const notas             = $('#notasContacto')?.value?.trim() || '';

    syncHiddenFromSelect(selCentro);
    const centroId        = hasEmpresa ? (getVal(['centroId']) || null) : null;
    const centroCodigo    = hasEmpresa ? (getVal(['centroCodigo']) || null) : null;
    const centroComuna    = hasEmpresa ? (getVal(['centroComuna']) || comunaPorCodigo(centroCodigo) || null) : null;
    const centroHectareas = hasEmpresa ? (getVal(['centroHectareas']) || null) : null;

    let resultado = ''; if (tieneMMPP==='Sí') resultado='Disponible'; else if (tieneMMPP==='No') resultado='No disponible';

    const payload = {
      proveedorKey, proveedorNombre,
      resultado, tieneMMPP, dispuestoVender, vendeActualmenteA, notas,
      centroId, centroCodigo, centroComuna, centroHectareas,
      contactoNombre, contactoTelefono, contactoEmail
    };

    const asigAnio = parseInt(document.getElementById('asigAnio')?.value || '',10);
    const asigMes  = parseInt(document.getElementById('asigMes')?.value || '',10);
    const asigTonsNum = Number(document.getElementById('asigTons')?.value || NaN);
    const puedeGuardarAsignacion = hasEmpresa && centroId && Number.isInteger(asigAnio) && Number.isInteger(asigMes) && Number.isFinite(asigTonsNum);

    try {
      const editId = state.editId, esUpdate = isValidObjectId(editId);
      if (esUpdate) await apiUpdateContacto(editId, payload);
      else          await apiCreateContacto(payload);

      // Registrar disponibilidad (si se llenaron los campos)
      if (puedeGuardarAsignacion) {
        if (!proveedorKey || !centroId) {
          M.toast?.({ html: 'Para registrar disponibilidad necesitas empresa y centro.', classes: 'orange' });
        } else {
          await postDisponibilidad({
            proveedorKey, proveedorNombre,
            centroId, centroCodigo,
            comuna: centroComuna || '',
            anio: asigAnio, mes: asigMes, mesKey: mesKeyFrom(asigAnio, asigMes),
            tonsDisponible: asigTonsNum,
            estado: 'disponible',
            fuente: 'contactos',
            createdFrom: 'modal_contacto'
          });
          M.toast?.({ html: 'Disponibilidad registrada', classes:'teal' });
        }
      }

      await cargarContactosGuardados();
      renderTablaContactos();
      document.dispatchEvent(new Event('reload-tabla-contactos'));
      M.toast?.({ html: state.editId ? 'Contacto actualizado' : 'Contacto guardado', displayLength: 2000 });

      const modalInst = M.Modal.getInstance(document.getElementById('modalContacto'));
      form.reset(); clearCentroHidden(); clearProveedorHidden(); state.editId = null; modalInst?.close();
    } catch (err) {
      console.error('[form-contacto] ERROR:', err?.message || err);
      M.toast?.({ html: 'Error al guardar contacto', displayLength: 2500 });
    }
  });
}

/* ============================ Edición / Borrar / Nuevo ============================ */
export function abrirEdicion(c) {
  state.editId = c._id;
  const hasEmpresa = !!(c.proveedorKey || c.proveedorNombre);
  const key = c.proveedorKey || (c.proveedorNombre ? slug(c.proveedorNombre) : '');

  $('#buscadorProveedor').value = c.proveedorNombre || '';
  setVal(['proveedorNombre'], c.proveedorNombre || '');
  setVal(['proveedorKey'], key || '');
  setVal(['proveedorId'], key || '');

  if (hasEmpresa && key) {
    mostrarCentrosDeProveedor(key, c.centroId || null);
    setVal(['centroId'], c.centroId || '');
    setVal(['centroCodigo'], c.centroCodigo || '');
    setVal(['centroComuna'], c.centroComuna || '');
    setVal(['centroHectareas'], c.centroHectareas || '');
  } else {
    resetSelectCentros(); clearCentroHidden();
  }

  if ($('#tieneMMPP')) $('#tieneMMPP').value = c.tieneMMPP || '';
  if ($('#dispuestoVender')) $('#dispuestoVender').value = c.dispuestoVender || '';
  if ($('#vendeActualmenteA')) $('#vendeActualmenteA').value = c.vendeActualmenteA || '';
  if ($('#notasContacto')) $('#notasContacto').value = c.notas || '';
  if ($('#contactoNombre')) $('#contactoNombre').value = c.contactoNombre || '';
  if ($('#contactoTelefono')) $('#contactoTelefono').value = c.contactoTelefono || '';
  if ($('#contactoEmail')) $('#contactoEmail').value = c.contactoEmail || '';

  const hoy = new Date();
  const anioEl = document.getElementById('asigAnio');
  const mesEl = document.getElementById('asigMes');
  if (anioEl && !anioEl.value) anioEl.value = hoy.getFullYear();
  if (mesEl && !mesEl.value) mesEl.value = String(hoy.getMonth() + 1);

  // Historial en el bloque inferior del modal de edición
  pintarHistorialEdicionFromContacto(c);

  M.updateTextFields?.();
  const modal = document.getElementById('modalContacto');
  (M.Modal.getInstance(modal) || M.Modal.init(modal)).open();
}

export async function eliminarContacto(id) {
  await apiDeleteContacto(id);
  await cargarContactosGuardados();
  renderTablaContactos();
  document.dispatchEvent(new Event('reload-tabla-contactos'));
  M.toast?.({ html: 'Contacto eliminado', displayLength: 1800 });
}

export function prepararNuevo() {
  state.editId = null;
  const form = $('#formContacto'); form?.reset();
  clearProveedorHidden(); resetSelectCentros(); clearCentroHidden();
  const hoy = new Date();
  const anioEl = document.getElementById('asigAnio');
  const mesEl = document.getElementById('asigMes');
  if (anioEl) anioEl.value = hoy.getFullYear();
  if (mesEl) mesEl.value = String(hoy.getMonth() + 1);
  const box = document.getElementById('asigHist');
  if (box) box.innerHTML = '<span class="grey-text">Sin asignaciones registradas.</span>';
}
