// /js/contactos/form-contacto.js
import { apiCreateContacto, apiUpdateContacto, apiDeleteContacto } from '../../core/api.js';
import { state, $, getVal, setVal, slug } from './state.js';
import { cargarContactosGuardados } from './data.js';
import { syncHiddenFromSelect, mostrarCentrosDeProveedor, resetSelectCentros } from './proveedores.js';
import { comunaPorCodigo } from './normalizers.js';
import { renderTablaContactos } from './tabla.js';

const isValidObjectId = (s) => typeof s === 'string' && /^[0-9a-fA-F]{24}$/.test(s);

/* ---------- Asignaciones (ajustado a tu colección) ---------- */
const API_BASE = window.API_URL || '/api';
const MES = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
function pad2(n){ return String(n).padStart(2,"0"); }
function mesKeyFrom(y,m){ return String(y) + "-" + pad2(m); }

function buildAsigURL(c) {
  var q = new URLSearchParams();
  if (c && c._id) q.set("contactoId", c._id);        // por si tu API lo soporta
  if (c && c.proveedorKey) q.set("proveedorKey", c.proveedorKey);
  if (c && c.centroId) q.set("centroId", c.centroId);
  return API_BASE + "/asignaciones?" + q.toString();
}

async function fetchAsignaciones(c){
  try {
    const r = await fetch(buildAsigURL(c));
    if (!r.ok) return [];
    const j = await r.json().catch(()=>[]);
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

async function postAsignacion(a){
  // Compatibilidad: enviamos tons y tonsDisponible
  const body = Object.assign({}, a, { tonsDisponible: a.tons });
  const r = await fetch(API_BASE + "/asignaciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error("asignaciones POST " + r.status);
  try { return await r.json(); } catch { return null; }
}

function renderAsignaciones(list){
  if (!list || !list.length) return '<span class="grey-text">Sin asignaciones registradas.</span>';
  const rows = list.slice().sort(function(a,b){
    return ((b.anio||0)*100 + (b.mes||0)) - ((a.anio||0)*100 + (a.mes||0));
  }).map(function(a){
    const when = (a.anio && a.mes) ? ( (MES[a.mes] || a.mes) + " " + a.anio ) : (a.mesKey || "");
    const v = (a.tonsDisponible != null ? a.tonsDisponible : (a.tons != null ? a.tons : a.cantidad));
    const tonsTxt = (v == null) ? "" : Number(v).toLocaleString("es-CL",{ maximumFractionDigits: 2 });
    return '<tr>' +
      '<td>' + when + '</td>' +
      '<td class="right-align">' + tonsTxt + '</td>' +
      '<td>' + (a.estado || "") + '</td>' +
    '</tr>';
  }).join("");
  return [
    '<table class="striped">',
      '<thead><tr><th>Mes</th><th class="right-align">Tons</th><th>Estado</th></tr></thead>',
      '<tbody>', rows, '</tbody>',
    '</table>'
  ].join("");
}

/* ---------- helpers ---------- */
function clearCentroHidden(){ setVal(['centroId'],''); setVal(['centroCodigo'],''); setVal(['centroComuna'],''); setVal(['centroHectareas'],''); }
function clearProveedorHidden(){ setVal(['proveedorKey'],''); setVal(['proveedorId'],''); setVal(['proveedorNombre'],''); }
function getOptionalValue(id){ const el=document.getElementById(id); return el?el.value:undefined; }
function normalizeNumber(s){ if(s==null||s==='') return null; const n=Number(String(s).replace(',','.')); return Number.isFinite(n)?n:null; }

/* =================== INIT =================== */
export function setupFormulario() {
  const form = $('#formContacto'); if (!form) return;
  state.editId = null;

  // Guarda el contacto activo para el modal "ojo"
  document.addEventListener('click', function(e){
    const a = e.target && e.target.closest ? e.target.closest('a.icon-action.ver') : null;
    if (!a) return;
    const id = a.dataset.id;
    const lst = state.contactosGuardados || [];
    state.contactoActual = lst.find(x => String(x._id) === String(id)) || null;
  }, true);

  // Inyecta historial en el modal del ojo y oculta campos legacy
  hookDetalleHistorial();

  // Sincroniza hidden del centro
  const selCentro = $('#selectCentro');
  if (selCentro) selCentro.addEventListener('change', function(){ syncHiddenFromSelect(selCentro); });

  form.addEventListener('submit', async function(e){
    e.preventDefault();

    /* Empresa (opcional) */
    const proveedorKeyRaw    = (getVal(['proveedorKey','proveedorId']) || '').trim();
    const proveedorNombreRaw = (getVal(['proveedorNombre']) || '').trim();
    const proveedorKey    = proveedorKeyRaw || null;
    const proveedorNombre = proveedorNombreRaw || null;
    const hasEmpresa      = !!(proveedorKey && proveedorNombre);

    /* Persona (permite sin empresa) */
    const contactoNombre   = ($('#contactoNombre') && $('#contactoNombre').value || '').trim();
    const contactoTelefono = ($('#contactoTelefono') && $('#contactoTelefono').value || '').trim();
    const contactoEmail    = ($('#contactoEmail') && $('#contactoEmail').value || '').trim();
    const hasPersona       = !!contactoNombre && (!!contactoTelefono || !!contactoEmail);
    if (!hasEmpresa && !hasPersona) {
      if (window.M && M.toast) M.toast({ html: 'Ingresa una empresa o una persona (nombre + teléfono o email).', displayLength: 2800 });
      if (document.getElementById('contactoNombre')) document.getElementById('contactoNombre').focus();
      return;
    }
    if (!hasEmpresa) { clearCentroHidden(); resetSelectCentros(); }

    /* Otros campos */
    const tieneMMPP           = (document.getElementById('tieneMMPP') || {}).value || '';
    const fechaDisponibilidad = getOptionalValue('fechaDisponibilidad') || null; // puede no existir
    const dispuestoVender     = (document.getElementById('dispuestoVender') || {}).value || '';
    const vendeActualmenteA   = (document.getElementById('vendeActualmenteA') || {}).value || '';
    const notas               = (document.getElementById('notasContacto') || {}).value || '';
    const tonsDisponiblesAprox= getOptionalValue('tonsDisponiblesAprox') ?? '';

    if (selCentro) syncHiddenFromSelect(selCentro);
    const centroId        = hasEmpresa ? (getVal(['centroId']) || null) : null;
    const centroCodigo    = hasEmpresa ? (getVal(['centroCodigo']) || null) : null;
    const centroComuna    = hasEmpresa ? (getVal(['centroComuna']) || comunaPorCodigo(centroCodigo) || null) : null;
    const centroHectareas = hasEmpresa ? (getVal(['centroHectareas']) || null) : null;

    let resultado = '';
    if (tieneMMPP === 'Sí') resultado = 'Disponible';
    else if (tieneMMPP === 'No') resultado = 'No disponible';

    const payload = {
      proveedorKey, proveedorNombre,
      resultado, tieneMMPP, fechaDisponibilidad, dispuestoVender, vendeActualmenteA, notas,
      centroId, centroCodigo, centroComuna, centroHectareas,
      contactoNombre, contactoTelefono, contactoEmail,
      tonsDisponiblesAprox: normalizeNumber(tonsDisponiblesAprox),
    };

    // Año/Mes/Ton para asignación
    const asigAnio = parseInt((document.getElementById('asigAnio') || {}).value || '',10);
    const asigMes  = parseInt((document.getElementById('asigMes')  || {}).value || '',10);
    const asigTons = Number((document.getElementById('asigTons') || {}).value || NaN);
    const tieneAsignacion = hasEmpresa && centroId && Number.isInteger(asigAnio) && Number.isInteger(asigMes) && Number.isFinite(asigTons);

    try {
      const editId = state.editId;
      const esUpdate = isValidObjectId(editId);
      if (esUpdate) await apiUpdateContacto(editId, payload);
      else          await apiCreateContacto(payload);

      if (tieneAsignacion) {
        let contactoId = esUpdate ? editId : null;
        if (!contactoId) {
          const ultimo = (state.contactosGuardados || []).slice(-1)[0];
          contactoId = ultimo ? ultimo._id : null;
        }
        if (contactoId) {
          await postAsignacion({
            contactoId,
            proveedorKey, proveedorNombre,
            centroId, centroCodigo, comuna: centroComuna,
            anio: asigAnio, mes: asigMes, mesKey: mesKeyFrom(asigAnio, asigMes),
            tons: asigTons, estado: 'disponible', fuente: 'contactos'
          });
          if (window.M && M.toast) M.toast({ html: 'Disponibilidad registrada', classes: 'teal' });
        }
      }

      await cargarContactosGuardados();
      renderTablaContactos();
      document.dispatchEvent(new Event('reload-tabla-contactos'));
      if (window.M && M.toast) M.toast({ html: (state.editId ? 'Contacto actualizado' : 'Contacto guardado'), displayLength: 2000 });

      const modal = document.getElementById('modalContacto');
      const modalInst = window.M && M.Modal ? M.Modal.getInstance(modal) : null;
      form.reset();
      clearCentroHidden();
      clearProveedorHidden();
      state.editId = null;
      if (modalInst) modalInst.close();
    } catch (err) {
      console.error('[form-contacto] ERROR:', err && (err.message || err));
      if (window.M && M.toast) M.toast({ html: 'Error al guardar contacto', displayLength: 2500 });
    }
  });
}

/* =================== EDICIÓN =================== */
export function abrirEdicion(c) {
  state.editId = c._id;

  const hasEmpresa = !!(c.proveedorKey || c.proveedorNombre);
  const key = c.proveedorKey || (c.proveedorNombre ? slug(c.proveedorNombre) : '');

  if (document.getElementById('buscadorProveedor')) document.getElementById('buscadorProveedor').value = c.proveedorNombre || '';
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
    resetSelectCentros();
    clearCentroHidden();
  }

  if (document.getElementById('tieneMMPP')) document.getElementById('tieneMMPP').value = c.tieneMMPP || '';
  if (document.getElementById('dispuestoVender')) document.getElementById('dispuestoVender').value = c.dispuestoVender || '';
  if (document.getElementById('fechaDisponibilidad')) document.getElementById('fechaDisponibilidad').value = c.fechaDisponibilidad ? String(c.fechaDisponibilidad).slice(0,10) : '';
  if (document.getElementById('tonsDisponiblesAprox')) document.getElementById('tonsDisponiblesAprox').value = (c.tonsDisponiblesAprox != null ? c.tonsDisponiblesAprox : '');
  if (document.getElementById('vendeActualmenteA')) document.getElementById('vendeActualmenteA').value = c.vendeActualmenteA || '';
  if (document.getElementById('notasContacto')) document.getElementById('notasContacto').value = c.notas || '';

  if (document.getElementById('contactoNombre')) document.getElementById('contactoNombre').value = c.contactoNombre || '';
  if (document.getElementById('contactoTelefono')) document.getElementById('contactoTelefono').value = c.contactoTelefono || '';
  if (document.getElementById('contactoEmail')) document.getElementById('contactoEmail').value = c.contactoEmail || '';

  // Historial en edición
  pintarHistorialEdicion(c);

  // Defaults año/mes
  const hoy = new Date();
  const anioEl = document.getElementById('asigAnio');
  const mesEl  = document.getElementById('asigMes');
  if (anioEl && !anioEl.value) anioEl.value = hoy.getFullYear();
  if (mesEl && !mesEl.value)   mesEl.value  = String(hoy.getMonth()+1);

  if (window.M && M.updateTextFields) M.updateTextFields();
  const modal = document.getElementById('modalContacto');
  const inst  = window.M && M.Modal ? (M.Modal.getInstance(modal) || M.Modal.init(modal)) : null;
  if (inst) inst.open();
}

async function pintarHistorialEdicion(c){
  const box = document.getElementById('asigHist');
  if (!box) return;
  box.innerHTML = '<span class="grey-text">Cargando disponibilidad...</span>';
  try {
    const lista = await fetchAsignaciones(c);
    box.innerHTML = renderAsignaciones(lista);
  } catch (e) {
    console.error(e);
    box.innerHTML = '<span class="red-text">No se pudo cargar disponibilidad</span>';
  }
}

/* =================== BORRADO =================== */
export async function eliminarContacto(id) {
  await apiDeleteContacto(id);
  await cargarContactosGuardados();
  renderTablaContactos();
  document.dispatchEvent(new Event('reload-tabla-contactos'));
  if (window.M && M.toast) M.toast({ html: 'Contacto eliminado', displayLength: 1800 });
}

/* =================== NUEVO =================== */
export function prepararNuevo() {
  state.editId = null;
  const form = $('#formContacto'); if (form) form.reset();
  clearProveedorHidden(); resetSelectCentros(); clearCentroHidden();
  const hoy = new Date();
  const anioEl = document.getElementById('asigAnio');
  const mesEl  = document.getElementById('asigMes');
  if (anioEl) anioEl.value = hoy.getFullYear();
  if (mesEl)  mesEl.value  = String(hoy.getMonth()+1);
  const box = document.getElementById('asigHist');
  if (box) box.innerHTML = '<span class="grey-text">Sin asignaciones registradas.</span>';
}

/* =========== Modal del ojo: historial + ocultar legacy =========== */
function hookDetalleHistorial(){
  const body = document.getElementById('detalleContactoBody');
  if (!body) return;

  function hideLegacy() {
    const rx = /(Fecha\s*Disp\.?|Tons\s*aprox\.?)/i;
    Array.prototype.forEach.call(body.querySelectorAll('*'), function(el){
      const t = (el.textContent || '').trim();
      if (rx.test(t)) {
        const blk = el.closest('.row') || el.closest('p') || el.closest('div') || el;
        if (blk) blk.style.display = 'none';
      }
    });
  }

  const obs = new MutationObserver(async function(){
    const c = state.contactoActual;
    if (!c) return;

    hideLegacy();

    let wrap = body.querySelector('#detalleAsignaciones');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'detalleAsignaciones';
      wrap.innerHTML =
        '<h6 class="grey-text text-darken-2 disponibilidad-title">Disponibilidad registrada</h6>' +
        '<div id="detalleAsignacionesTable" class="card-panel grey lighten-4 disponibilidad-panel">' +
          '<span class="grey-text">Cargando disponibilidad...</span>' +
        '</div>';
      body.appendChild(wrap);
    }
    try{
      const lista = await fetchAsignaciones(c);
      const tbl = renderAsignaciones(lista);
      const cont = body.querySelector('#detalleAsignacionesTable');
      if (cont) cont.innerHTML = tbl;
    }catch(e){
      const cont = body.querySelector('#detalleAsignacionesTable');
      if (cont) cont.innerHTML = '<span class="red-text">No se pudo cargar disponibilidad</span>';
    }
  });

  obs.observe(body, { childList: true, subtree: true });
}
