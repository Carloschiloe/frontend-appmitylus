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

/* ---------- CSS para mini acciones en la grilla de disponibilidades ---------- */
(function injectMiniStyles () {
  const css = `
    #asigHist .mini-actions a { display:inline-block; margin:0 6px; cursor:pointer; }
    #asigHist .mini-actions i { font-size:18px; vertical-align:middle; }
    #asigHist table td, #asigHist table th { padding:10px 12px; }
    #asigHist .num { text-align:right; }
  `;
  if (!document.getElementById('disp-mini-styles')) {
    const s = document.createElement('style');
    s.id = 'disp-mini-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }
})();

/* ---------- API helpers para DISPONIBILIDADES ---------- */
// aplanar cualquier formato de _id
const normId = (x) => {
  let id = (x && (x._id ?? x.id)) ?? null;
  if (!id) return null;
  if (typeof id === 'string') return id;
  if (typeof id === 'object') {
    if (id.$oid) return id.$oid;
    if (id.oid) return id.oid;
    // Último intento: extraer 24 hex de toString()
    const m = String(id).match(/[0-9a-fA-F]{24}/);
    if (m) return m[0];
  }
  return null;
};

// GET a /disponibilidades (colección real con tus datos)
async function fetchDisponibilidades({ proveedorKey, centroId, from, to, anio } = {}) {
  if (!proveedorKey && !centroId) return [];

  const q = new URLSearchParams();
  if (proveedorKey) q.set('proveedorKey', proveedorKey);
  if (centroId)     q.set('centroId', centroId);
  if (from)         q.set('from', from);
  if (to)           q.set('to', to);
  if (anio)         q.set('anio', anio);

  try {
    const r = await fetch(`${API_BASE}/disponibilidades?${q.toString()}`);
    if (!r.ok) return [];
    const data = await r.json();
    const list = Array.isArray(data) ? data : (data.items || []);

    const mapped = list.map(x => {
      const id = normId(x);
      const mk = x.mesKey || (x.anio && x.mes ? mesKeyFrom(x.anio, x.mes) : null);
      return {
        _id: id, id,
        anio:   x.anio ?? (Number((mk || '').slice(0, 4)) || null),
        mes:    x.mes  ?? (Number((mk || '').slice(5, 7)) || null),
        tons:   Number(x.tons ?? x.tonsDisponible ?? 0) || 0,
        estado: x.estado || 'disponible',
        mesKey: mk,
        proveedorKey: x.proveedorKey || '',
        centroId: x.centroId || null
      };
    });

    return mapped;
  } catch {
    return [];
  }
}

// POST /disponibilidades
async function postDisponibilidad(d){
  const payload = {
    proveedorKey: d.proveedorKey || '',
    proveedorNombre: d.proveedorNombre || '',
    centroId: d.centroId || null,
    centroCodigo: d.centroCodigo || '',
    comuna: d.comuna || '',
    areaCodigo: d.areaCodigo || '',
    mesKey: d.mesKey || mesKeyFrom(d.anio, d.mes),
    anio: d.anio,
    mes: d.mes,
    tonsDisponible: d.tons,
    estado: d.estado || 'disponible'
  };
  const r = await fetch(`${API_BASE}/disponibilidades`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
  });
  if (!r.ok) throw new Error('disponibilidades POST '+r.status);
  return r.json();
}

// PATCH /disponibilidades/:id
async function patchDisponibilidad(id, d){
  const payload = {};
  if (d.anio && d.mes) payload.mesKey = mesKeyFrom(d.anio, d.mes);
  if ('tons' in d) payload.tonsDisponible = d.tons;
  if (d.estado) payload.estado = d.estado;

  const r = await fetch(`${API_BASE}/disponibilidades/${id}`, {
    method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
  });
  if(!r.ok) throw new Error('disponibilidades PATCH '+r.status);
  return r.json();
}

// DELETE /disponibilidades/:id
async function deleteDisponibilidad(id){
  const r = await fetch(`${API_BASE}/disponibilidades/${id}`, { method:'DELETE' });
  if(!r.ok) throw new Error('disponibilidades DELETE '+r.status);
  return r.json();
}

/* ---------- Render helpers (grilla en el modal) ---------- */
function renderAsignaciones(list){
  if(!list?.length) return '<span class="grey-text">Sin disponibilidades registradas.</span>';
  const rows = list.slice().sort((a,b)=>((b.anio||0)*100+b.mes)-((a.anio||0)*100+a.mes))
    .map(a=>{
      const rowId = (a._id || a.id || '');
      const mk = a.mesKey || '';
      return `<tr>
        <td>${MES[a.mes]||a.mes} ${a.anio||''}</td>
        <td class="num">${Number(a.tons||0).toLocaleString('es-CL',{maximumFractionDigits:2})}</td>
        <td>${a.estado||''}</td>
        <td class="mini-actions">
          <a href="javascript:;" class="mini-edit" data-id="${rowId}" data-meskey="${mk}" data-anio="${a.anio||''}" data-mes="${a.mes||''}" data-tons="${a.tons||''}" title="Editar">
            <i class="material-icons">edit</i>
          </a>
          <a href="javascript:;" class="mini-del" data-id="${rowId}" data-meskey="${mk}" title="Eliminar">
            <i class="material-icons red-text">delete</i>
          </a>
        </td>
      </tr>`;
    }).join('');

  return `<table class="striped" style="margin:6px 0">
    <thead><tr>
      <th>Mes</th><th class="num">Tons</th><th>Estado</th><th style="width:100px">Opciones</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

async function pintarHistorialEdicion(contacto){
  const box = document.getElementById('asigHist'); if(!box) return;
  const proveedorKey = contacto?.proveedorKey || (contacto?.proveedorNombre ? slug(contacto.proveedorNombre) : '');
  const centroId = contacto?.centroId || null;

  if (!proveedorKey && !centroId) {
    box.innerHTML = '<span class="grey-text">Sin disponibilidades registradas.</span>';
    state._ultimaDispLista = [];
    return;
  }

  box.innerHTML = '<span class="grey-text">Cargando disponibilidad...</span>';
  try {
    const lista = await fetchDisponibilidades({ proveedorKey, centroId });
    state._ultimaDispLista = lista; // <- guardo para resolver id por mesKey si hiciera falta
    box.innerHTML = renderAsignaciones(lista);
  } catch(e){
    console.error(e);
    state._ultimaDispLista = [];
    box.innerHTML = '<span class="red-text">No se pudo cargar disponibilidad</span>';
  }
}

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

    try {
      const proveedorKey = c.proveedorKey || (c.proveedorNombre ? slug(c.proveedorNombre) : '');
      const centroId = c.centroId || null;

      if (!proveedorKey && !centroId) {
        body.querySelector('#detalleAsignacionesTable').innerHTML = '<span class="grey-text">Sin disponibilidades registradas.</span>';
        return;
      }

      const lista = await fetchDisponibilidades({ proveedorKey, centroId });
      const html = renderAsignaciones(lista)
        .replace(/<th[^>]*>Opciones<\/th>/,'<th></th>')
        .replace(/<td class="mini-actions">[\s\S]*?<\/td>/g,'<td></td>');
      body.querySelector('#detalleAsignacionesTable').innerHTML = html;
    } catch(e) {
      console.error(e);
      body.querySelector('#detalleAsignacionesTable').innerHTML = '<span class="red-text">No se pudo cargar disponibilidad</span>';
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
  state.dispEditId = null; // para PATCH

  document.addEventListener('click', (e)=>{
    const a = e.target.closest?.('a.icon-action.ver'); if(!a) return;
    const id = a.dataset.id;
    state.contactoActual = (state.contactosGuardados||[]).find(x=>String(x._id)===String(id)) || null;
  }, true);
  hookDetalleHistorial();

  const selCentro = $('#selectCentro');
  selCentro?.addEventListener('change', () => syncHiddenFromSelect(selCentro));

  // Delegación de acciones en la tabla de disponibilidades (editar/eliminar)
  document.getElementById('asigHist')?.addEventListener('click', async (e)=>{
    const btn = e.target.closest('.mini-actions a'); if(!btn) return;
    e.preventDefault();

    let id = btn.dataset.id?.trim() || '';
    if (!isValidObjectId(id)) {
      // intentar resolver por mesKey con la lista cached
      const mk = btn.dataset.meskey || '';
      if (mk && Array.isArray(state._ultimaDispLista)) {
        const found = state._ultimaDispLista.find(x => x.mesKey === mk && isValidObjectId(x._id));
        if (found) id = found._id;
      }
    }

    if (!isValidObjectId(id)) {
      M.toast?.({ html:'No hay ID válido para esta fila', classes:'red' });
      return;
    }

    if (btn.classList.contains('mini-del')) {
      if (!confirm('¿Eliminar esta disponibilidad?')) return;
      try {
        await deleteDisponibilidad(id);
        const c = state.editingContacto || state.contactoActual || {};
        await pintarHistorialEdicion(c);
        M.toast?.({ html:'Disponibilidad eliminada', classes:'teal' });
      } catch (err) {
        console.error(err);
        M.toast?.({ html:'No se pudo eliminar', classes:'red' });
      }
      return;
    }

    if (btn.classList.contains('mini-edit')) {
      const anioEl = document.getElementById('asigAnio');
      const mesEl  = document.getElementById('asigMes');
      const tonsEl = document.getElementById('asigTons');
      if (anioEl) anioEl.value = btn.dataset.anio || '';
      if (mesEl)  mesEl.value  = btn.dataset.mes  || '';
      if (tonsEl) tonsEl.value = btn.dataset.tons || '';
      state.dispEditId = id;
      M.toast?.({ html:'Editando disponibilidad: recuerda presionar Guardar', displayLength: 2200 });
      return;
    }
  });

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

    // Campos de disponibilidad (crear o patch)
    const asigAnio = parseInt(document.getElementById('asigAnio')?.value || '',10);
    const asigMes  = parseInt(document.getElementById('asigMes')?.value || '',10);
    const asigTonsNum = Number(document.getElementById('asigTons')?.value || NaN);
    const tieneDispCampos = Number.isInteger(asigAnio) && Number.isInteger(asigMes) && Number.isFinite(asigTonsNum) && asigTonsNum>0;

    try {
      const editId = state.editId, esUpdate = isValidObjectId(editId);
      if (esUpdate) await apiUpdateContacto(editId, payload);
      else          await apiCreateContacto(payload);

      // Crear o actualizar disponibilidad (sólo si hay filtros válidos)
      if (tieneDispCampos && hasEmpresa && centroId) {
        if (state.dispEditId) {
          await patchDisponibilidad(state.dispEditId, { anio: asigAnio, mes: asigMes, tons: asigTonsNum, estado:'disponible' });
          state.dispEditId = null;
          M.toast?.({ html:'Disponibilidad actualizada', classes:'teal' });
        } else {
          await postDisponibilidad({
            proveedorKey, proveedorNombre,
            centroId, centroCodigo: centroCodigo||'', comuna: centroComuna||'',
            anio: asigAnio, mes: asigMes, tons: asigTonsNum, estado:'disponible'
          });
          M.toast?.({ html:'Disponibilidad registrada', classes:'teal' });
        }
      }

      await cargarContactosGuardados();
      renderTablaContactos();
      document.dispatchEvent(new Event('reload-tabla-contactos'));

      // refresca el panel de historial en edición
      const c = state.editId ? { _id: state.editId, proveedorKey, proveedorNombre, centroId } : (state.contactoActual || {});
      await pintarHistorialEdicion(c);

      M.toast?.({ html: state.editId ? 'Contacto actualizado' : 'Contacto guardado', displayLength: 2000 });

      const modalInst = M.Modal.getInstance(document.getElementById('modalContacto'));
      form.reset(); clearCentroHidden(); clearProveedorHidden(); state.editId = null; modalInst?.close();
    } catch (err) {
      console.error('[form-contacto] ERROR:', err?.message || err);
      M.toast?.({ html: 'Error al guardar contacto', displayLength: 2500 });
    }
  });
}

/* ---------- Acciones ---------- */
export function abrirEdicion(c) {
  state.editId = c._id;
  state.editingContacto = c; // para refresco al borrar/editar
  state.dispEditId = null;

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
  state.dispEditId = null;
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
