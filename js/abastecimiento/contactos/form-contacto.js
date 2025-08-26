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
const MES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const pad2 = (n)=>String(n).padStart(2,'0');
const mesKeyFrom = (y,m)=>`${y}-${pad2(m)}`;

function buildAsigURL(c) {
  // Tu colección guarda por proveedorKey + centroId (contactoId puede no existir)
  const q = new URLSearchParams();
  if (c?._id)        q.set('contactoId', c._id);            // por si tu API lo soporta
  if (c?.proveedorKey) q.set('proveedorKey', c.proveedorKey);
  if (c?.centroId)     q.set('centroId', c.centroId);
  return `${API_BASE}/asignaciones?${q.toString()}`;
}

async function fetchAsignaciones(c){
  try {
    const r = await fetch(buildAsigURL(c));
    if (!r.ok) return [];
    return await r.json().catch(()=>[]);
  } catch { return []; }
}

async function postAsignacion(a){
  // Enviamos ambos nombres por compatibilidad: tons y tonsDisponible
  const body = { ...a, tons: a.tons, tonsDisponible: a.tons };
  const r = await fetch(`${API_BASE}/asignaciones`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
  });
  if(!r.ok) throw new Error('asignaciones POST '+r.status);
  try { return await r.json(); } catch { return null; }
}

function renderAsignaciones(list){
  if(!list?.length) return '<span class="grey-text">Sin asignaciones registradas.</span>';
  const rows = list.slice().sort((a,b)=>((b.anio||0)*100+(b.mes||0))-((a.anio||0)*100+(a.mes||0)))
    .map(a=>{
      const when = (a.anio && a.mes) ? `${MES[a.mes]||a.mes} ${a.anio}` : (a.mesKey||'');
      const tons = a.tonsDisponible ?? a.tons ?? a.cantidad ?? null;
      const tonsTxt = (tons==null)? '' : Number(tons).toLocaleString('es-CL',{maximumFractionDigits:2});
      return `<tr><td>${when}</td><td style="text-align:right">${tonsTxt}</td><td>${a.estado||''}</td></tr>`;
    }).join('');
  return `<table class="striped" style="margin:6px 0">
    <thead><tr><th>Mes</th><th style="text-align:right">Tons</th><th>Estado</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
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
  document.addEventListener('click', (e)=>{
    const a = e.target.closest?.('a.icon-action.ver'); if(!a) return;
    const id = a.dataset.id;
    state.contactoActual = (state.contactosGuardados||[]).find(x=>String(x._id)===String(id)) || null;
  }, true);

  // Inyecta historial en el modal del ojo y oculta campos legacy
  hookDetalleHistorial();

  // Sincroniza hidden del centro
  const selCentro = $('#selectCentro');
  selCentro?.addEventListener('change', () => syncHiddenFromSelect(selCentro));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    /* Empresa (opcional) */
    const proveedorKeyRaw    = (getVal(['proveedorKey','proveedorId']) || '').trim();
    const proveedorNombreRaw = (getVal(['proveedorNombre']) || '').trim();
    const proveedorKey    = proveedorKeyRaw || null;
    const proveedorNombre = proveedorNombreRaw || null;
    const hasEmpresa      = !!(proveedorKey && proveedorNombre);

    /* Persona (permite sin empresa) */
    const contactoNombre   = $('#contactoNombre')?.value?.trim() || '';
    const contactoTelefono = $('#contactoTelefono')?.value?.trim() || '';
    const contactoEmail    = $('#contactoEmail')?.value?.trim() || '';
    const hasPersona       = !!contactoNombre && (!!contactoTelefono || !!contactoEmail);
    if (!hasEmpresa && !hasPersona) {
      M.toast?.({ html: 'Ingresa una empresa o una persona (nombre + teléfono o email).', displayLength: 2800 });
      ($('#contactoNombre')?.focus?.()); return;
    }
    if (!hasEmpresa) { clearCentroHidden(); resetSelectCentros(); }

    /* Otros campos */
    const tieneMMPP           = $('#tieneMMPP')?.value || '';
    const fechaDisponibilidad = getOptionalValue('fechaDisponibilidad') || null;
    const dispuestoVender     = $('#dispuestoVender')?.value || '';
    const vendeActualmenteA   = $('#vendeActualmenteA')?.value?.trim() || '';
    const notas               = $('#notasContacto')?.value?.trim() || '';
    const tonsDisponiblesAprox= getOptionalValue('tonsDisponiblesAprox') ?? '';

    syncHiddenFromSelect(selCentro);
    const centroId        = hasEmpresa ? (getVal(['centroId']) || null) : null;
    const centroCodigo    = hasEmpresa ? (getVal(['centroCodigo']) || null) : null;
    const centroComuna    = hasEmpresa ? (getVal(['centroComuna']) || comunaPorCodigo(centroCodigo) || null) : null;
    const centroHectareas = hasEmpresa ? (getVal(['centroHectareas']) || null) : null;

    let resultado = ''; if (tieneMMPP==='Sí') resultado='Disponible'; else if (tieneMMPP==='No') resultado='No disponible';

    const payload = {
      proveedorKey, proveedorNombre,
      resultado, tieneMMPP, fechaDisponibilidad, dispuestoVender, vendeActualmenteA, notas,
      centroId, centroCodigo, centroComuna, centroHectareas,
      contactoNombre, contactoTelefono, contactoEmail,
      tonsDisponiblesAprox: normalizeNumber(tonsDisponiblesAprox),
    };

    // Año/Mes/Ton ingresados (se guardan como asignación si están completos)
    const asigAnio = parseInt(document.getElementById('asigAnio')?.value || '',10);
    const asigMes  = parseInt(document.getElementById('asigMes')?.value || '',10);
    const asigTons = Number(document.getElementById('asigTons')?.value || NaN);
    const tieneAsignacion = hasEmpresa && centroId && Number.isInteger(asigAnio) && Number.isInteger(asigMes) && Number.isFinite(asigTons);

    try {
      const editId = state.editId, esUpdate = isValidObjectId(editId);
      if (esUpdate) await apiUpdateContacto(editId, payload);
      else          await apiCreateContacto(payload);

      if (tieneAsignacion) {
        // id del contacto (si fue CREATE lo tomamos del último)
        let contactoId = esUpdate ? editId : null;
        if (!contactoId) {
          const ultimo = (state.contactosGuardados||[]).slice(-1)[0];
          contactoId = ultimo?._id : null;
        }
        if (contactoId) {
          await postAsignacion({
            contactoId, proveedorKey, proveedorNombre, centroId, centroCodigo, comuna: centroComuna,
            anio: asigAnio, mes: asigMes, mesKey: mesKeyFrom(asigAnio, asigMes),
            tons: asigTons, estado: 'disponible', fuente: 'contactos'
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

/* =================== EDICIÓN =================== */
export function abrirEdicion(c) {
  state.editId = c._id;

  const hasEmpresa = !!(c.proveedorKey || c.proveedorNombre);
  const key = c.proveedorKey || (c.proveedorNombre ? slug(c.proveedorNombre) : '');

  $('#buscadorProveedor').value = c.proveedorNombre || '';
  setVal(['proveedorNombre'], c.proveedorNombre || '');
  setVal(['proveedorKey'], key || ''); setVal(['proveedorId'], key || '');

  if (hasEmpresa && key) {
    mostrarCentrosDeProveedor(key, c.centroId || null);
    setVal(['centroId'], c.centroId || ''); setVal(['centroCodigo'], c.centroCodigo || '');
    setVal(['centroComuna'], c.centroComuna || ''); setVal(['centroHectareas'], c.centroHectareas || '');
  } else { resetSelectCentros(); clearCentroHidden(); }

  const fdEl = document.getElementById('fechaDisponibilidad');
  const tonsEl = document.getElementById('tonsDisponiblesAprox');
  if ($('#tieneMMPP'))       $('#tieneMMPP').value = c.tieneMMPP || '';
  if ($('#dispuestoVender')) $('#dispuestoVender').value = c.dispuestoVender || '';
  if (fdEl)  fdEl.value  = c.fechaDisponibilidad ? String(c.fechaDisponibilidad).slice(0,10) : '';
  if (tonsEl) tonsEl.value = (c.tonsDisponiblesAprox ?? '');
  if ($('#vendeActualmenteA')) $('#vendeActualmenteA').value = c.vendeActualmenteA || '';
  if ($('#notasContacto'))     $('#notasContacto').value     = c.notas || '';
  if ($('#contactoNombre'))   $('#contactoNombre').value   = c.contactoNombre || '';
  if ($('#contactoTelefono')) $('#contactoTelefono').value = c.contactoTelefono || '';
  if ($('#contactoEmail'))    $('#contactoEmail').value    = c.contactoEmail || '';

  // Historial en edición (por proveedorKey/centroId)
  pintarHistorialEdicion(c);

  // Defaults año/mes
  const hoy=new Date();
  const anioEl=document.getElementById('asigAnio'); const mesEl=document.getElementById('asigMes');
  if (anioEl && !anioEl.value) anioEl.value=hoy.getFullYear();
  if (mesEl  && !mesEl.value)  mesEl.value =String(hoy.getMonth()+1);

  M.updateTextFields?.();
  const modal = document.getElementById('modalContacto');
  (M.Modal.getInstance(modal) || M.Modal.init(modal)).open();
}

async function pintarHistorialEdicion(c){
  const box = document.getElementById('asigHist'); if(!box) return;
  box.innerHTML = '<span class="grey-text">Cargando disponibilidad...</span>';
  try { box.innerHTML = renderAsignaciones(await fetchAsignaciones(c)); }
  catch(e){ console.error(e); box.innerHTML = '<span class="red-text">No se pudo cargar disponibilidad</span>'; }
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
  const form = $('#formContacto'); form?.reset();
  clearProveedorHidden(); resetSelectCentros(); clearCentroHidden();
  const hoy=new Date(); const anioEl=document.getElementById('asigAnio'); const mesEl=document.getElementById('asigMes');
  if (anioEl) anioEl.value=hoy.getFullYear(); if (mesEl) mesEl.value=String(hoy.getMonth()+1);
  const box=document.getElementById('asigHist'); if(box) box.innerHTML='<span class="grey-text">Sin asignaciones registradas.</span>';
}

/* =========== Modal del ojo: historial + ocultar legacy =========== */
function hookDetalleHistorial(){
  const body = document.getElementById('detalleContactoBody');
  if(!body) return;
  const hideLegacy = () => {
    // oculta bloques que contengan los textos legacy
    const terms = [/Fecha\s*Disp\./i, /Tons\s*aprox\.?/i];
    Array.from(body.querySelectorAll('*')).forEach(el=>{
      const t = (el.textContent||'').trim();
      if (terms.some(rx=>rx.test(t))) (el.closest('.row') || el.closest('p') || el).style.display='none';
    });
  };
  const obs = new MutationObserver(async ()=>{
    const c = state.contactoActual; if(!c) return;
    hideLegacy();
    let wrap = body.querySelector('#detalleAsignaciones');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id='detalleAsignaciones';
      wrap.innerHTML = `
        <h6 class="grey-text text-darken-2" style="margin-top:12px">Disponibilidad registrada</h6>
        <div id="detalleAsignacionesTable" class="card-panel grey lighten-4" style="padding:8px 12px">
          <span class="grey-text">Cargando disponibilidad...</span>
        </div>`;
      body.appendChild(wrap);
    }
    try{
      const lista = await fetchAsignaciones(c);
      body.querySelector('#detalleAsignacionesTable').innerHTML = renderAsignaciones(lista);
    }catch(e){
      body.querySelector('#detalleAsignacionesTable').innerHTML = '<span class="red-text">No se pudo cargar disponibilidad</span>';
    }
  });
  obs.observe(body, {childList:true, subtree:true});
}
