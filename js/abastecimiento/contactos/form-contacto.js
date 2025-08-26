// /js/contactos/form-contacto.js
import { apiCreateContacto, apiUpdateContacto, apiDeleteContacto } from '../../core/api.js';
import { state, $, getVal, setVal, slug } from './state.js';
import { cargarContactosGuardados } from './data.js';
import { syncHiddenFromSelect, mostrarCentrosDeProveedor, resetSelectCentros } from './proveedores.js';
import { comunaPorCodigo } from './normalizers.js';
import { renderTablaContactos } from './tabla.js';

const isValidObjectId = (s) => typeof s === 'string' && /^[0-9a-fA-F]{24}$/.test(s);

/* ---------- Constantes ---------- */
const API_BASE = window.API_URL || '/api';
const MES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const pad2 = (n)=>String(n).padStart(2,'0');
const mesKeyFrom = (y,m)=>`${y}-${pad2(m)}`;

/* ---------- API helpers ---------- */
// POST a /disponibilidades (stock declarado)
async function postDisponibilidad(d){
  const r = await fetch(`${API_BASE}/disponibilidades`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(d)
  });
  if(!r.ok) throw new Error('disponibilidades POST '+r.status);
  try { return await r.json(); } catch { return null; }
}

// GET a /disponibilidades
async function fetchDisponibilidades({ proveedorKey, centroId, from, to, anio } = {}){
  const q = new URLSearchParams();
  if (proveedorKey) q.set('proveedorKey', proveedorKey);
  if (centroId)     q.set('centroId', centroId);
  if (from)         q.set('from', from);
  if (to)           q.set('to', to);
  if (anio)         q.set('anio', anio);

  const r = await fetch(`${API_BASE}/disponibilidades?${q.toString()}`);
  if(!r.ok) return [];
  try {
    const data = await r.json();
    const list = Array.isArray(data) ? data : (data.items || []);
    return list.map(x => ({
      anio:  (x.anio ?? (Number((x.mesKey || '').slice(0,4)) || null)),
      mes:   (x.mes  ?? (Number((x.mesKey || '').slice(5,7)) || null)),
      tons:  Number(x.tons ?? x.tonsDisponible ?? 0) || 0,
      estado: x.estado || 'disponible'
    }));
  } catch {
    return [];
  }
}

/* ---------- Render helpers ---------- */
function renderDisponibilidades(list){
  if(!list?.length) return '<span class="grey-text">Sin disponibilidades registradas.</span>';
  const rows = list.slice().sort((a,b)=>((b.anio||0)*100+b.mes)-((a.anio||0)*100+a.mes))
    .map(a=>`<tr><td>${MES[a.mes]||a.mes} ${a.anio||''}</td>
      <td style="text-align:right">${Number(a.tons||0).toLocaleString('es-CL',{maximumFractionDigits:2})}</td>
      <td>${a.estado||''}</td></tr>`).join('');
  return `<table class="striped" style="margin:6px 0"><thead><tr>
    <th>Mes</th><th style="text-align:right">Tons</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function pintarHistorialEdicion(contacto){
  const box = document.getElementById('asigHist'); // reutilizamos contenedor
  if(!box) return;
  box.innerHTML = '<span class="grey-text">Cargando disponibilidades...</span>';
  try {
    const proveedorKey = contacto.proveedorKey || (contacto.proveedorNombre ? slug(contacto.proveedorNombre) : '');
    const lista = await fetchDisponibilidades({
      proveedorKey,
      centroId: contacto.centroId || undefined
    });
    box.innerHTML = renderDisponibilidades(lista);
  } catch(e){
    console.error(e);
    box.innerHTML = '<span class="red-text">No se pudo cargar disponibilidades</span>';
  }
}

function hookDetalleHistorial(){
  const body = document.getElementById('detalleContactoBody');
  if(!body) return;
  const obs = new MutationObserver(async ()=>{
    const c = state.contactoActual; if(!c) return;
    if(body.querySelector('#detalleDisponibilidades')) return;

    const wrap = document.createElement('div');
    wrap.id='detalleDisponibilidades';
    wrap.innerHTML = `
      <h6 class="grey-text text-darken-2" style="margin-top:12px">Disponibilidad registrada</h6>
      <div id="detalleDisponibilidadesTable" class="card-panel grey lighten-4" style="padding:8px 12px">
        <span class="grey-text">Cargando disponibilidades...</span>
      </div>`;
    body.appendChild(wrap);

    try {
      const proveedorKey = c.proveedorKey || (c.proveedorNombre ? slug(c.proveedorNombre) : '');
      const lista = await fetchDisponibilidades({
        proveedorKey,
        centroId: c.centroId || undefined
      });
      body.querySelector('#detalleDisponibilidadesTable').innerHTML = renderDisponibilidades(lista);
    } catch(e) {
      console.error(e);
      body.querySelector('#detalleDisponibilidadesTable').innerHTML = '<span class="red-text">No se pudo cargar disponibilidades</span>';
    }
  });
  obs.observe(body, {childList:true, subtree:true});
}

/* ---------- Utilidades de formulario ---------- */
function clearCentroHidden(){ setVal(['centroId'],''); setVal(['centroCodigo'],''); setVal(['centroComuna'],''); setVal(['centroHectareas'],''); }
function clearProveedorHidden(){ setVal(['proveedorKey'],''); setVal(['proveedorId'],''); setVal(['proveedorNombre'],''); }

/* ---------- Setup ---------- */
export function setupFormulario() {
  const form = $('#formContacto'); if (!form) return;
  state.editId = null;

  // Ajuste de textos (el HTML antiguo dice "asignaciones")
  const tituloDisp = document.querySelector('#asigDisponibilidadBlock h6');
  if (tituloDisp) tituloDisp.textContent = 'Disponibilidad de MMPP';

  const box = document.getElementById('asigHist');
  if (box) box.innerHTML = '<span class="grey-text">Sin disponibilidades registradas.</span>';

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

    let resultado = '';
    if (tieneMMPP==='Sí') resultado='Disponible';
    else if (tieneMMPP==='No') resultado='No disponible';

    const payload = {
      proveedorKey, proveedorNombre,
      resultado, tieneMMPP, dispuestoVender, vendeActualmenteA, notas,
      centroId, centroCodigo, centroComuna, centroHectareas,
      contactoNombre, contactoTelefono, contactoEmail
    };

    const dispAnio = parseInt(document.getElementById('asigAnio')?.value || '',10);
    const dispMes  = parseInt(document.getElementById('asigMes')?.value || '',10);
    const dispTonsNum = Number(document.getElementById('asigTons')?.value || NaN);
    const puedeGuardarDisp = hasEmpresa && centroId && Number.isInteger(dispAnio) && Number.isInteger(dispMes) && Number.isFinite(dispTonsNum);

    try {
      const editId = state.editId, esUpdate = isValidObjectId(editId);
      if (esUpdate) await apiUpdateContacto(editId, payload);
      else          await apiCreateContacto(payload);

      // Guardar disponibilidad (NO asignación)
      if (puedeGuardarDisp) {
        await postDisponibilidad({
          proveedorKey, proveedorNombre,
          centroId, centroCodigo, comuna: centroComuna,
          anio: dispAnio, mes: dispMes, mesKey: mesKeyFrom(dispAnio, dispMes),
          tonsDisponible: dispTonsNum,
        });
        M.toast?.({ html: 'Disponibilidad registrada', classes:'teal' });
      }

      await cargarContactosGuardados();
      renderTablaContactos();
      document.dispatchEvent(new Event('reload-tabla-contactos'));
      M.toast?.({ html: state.editId ? 'Contacto actualizado' : 'Contacto guardado', displayLength: 2000 });

      // refrescar listado en edición (si se agregó disponibilidad)
      if (puedeGuardarDisp) {
        const ctmp = { _id: esUpdate ? editId : null, proveedorKey, proveedorNombre, centroId };
        await pintarHistorialEdicion(ctmp);
      }

      const modalInst = M.Modal.getInstance(document.getElementById('modalContacto'));
      form.reset(); clearCentroHidden(); clearProveedorHidden(); state.editId = null; modalInst?.close();
    } catch (err) {
      console.error('[form-contacto] ERROR:', err?.message || err);
      M.toast?.({ html: 'Error al guardar', displayLength: 2500 });
    }
  });
}

/* ---------- Acciones ---------- */
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

  // Cargar disponibilidades del proveedor/centro
  pintarHistorialEdicion(c);

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
  if (box) box.innerHTML = '<span class="grey-text">Sin disponibilidades registradas.</span>';
}
