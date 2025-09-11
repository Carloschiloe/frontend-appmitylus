// /js/abastecimiento/contactos/form-contacto.js
import { apiCreateContacto, apiUpdateContacto, apiDeleteContacto, apiGetVisitasByContacto } from '../../core/api.js';
import { state, $, getVal, setVal, slug } from './state.js';
import { cargarContactosGuardados } from './data.js';
import { syncHiddenFromSelect, mostrarCentrosDeProveedor, resetSelectCentros } from './proveedores.js';
import { comunaPorCodigo, centroCodigoById } from './normalizers.js';
import { renderTablaContactos } from './tabla.js';
import { abrirModalVisita } from '../visitas/ui.js';

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

/* ---------- helpers comunes ---------- */
const esc = (s='') => String(s)
  .replace(/&/g,'&amp;').replace(/<//g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

const fmtISOfechaHora = (d) => {
  const x = (d instanceof Date) ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  const hh = String(x.getHours()).padStart(2, '0');
  const mm = String(x.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${dd} ${hh}:${mm}`;
};

/* ---------- helpers de contacto → snapshot ---------- */
function buildContactoSnapshot({ tel='', email='', empresaNombre='' } = {}) {
  const empresaKey = slug(empresaNombre || '');
  return {
    telefono: (tel || '').trim(),
    email: (email || '').trim(),
    empresaKey,
    empresaNombre: empresaNombre || ''
  };
}

/* ---------- API helpers para DISPONIBILIDADES ---------- */
// aplanar cualquier formato de _id
const normId = (x) => {
  let id = (x && (x._id ?? x.id)) ?? null;
  if (!id) return null;
  if (typeof id === 'string') return id;
  if (typeof id === 'object') {
    if (id.$oid) return id.$oid;
    if (id.oid) return id.oid;
    const m = String(id).match(/[0-9a-fA-F]{24}/);
    if (m) return m[0];
  }
  return null;
};

// GET a /disponibilidades (colección real con tus datos)
async function fetchDisponibilidades({ proveedorKey, centroId, from, to, anio, mesKey } = {}) {
  if (!proveedorKey && !centroId) return [];

  const q = new URLSearchParams();
  if (proveedorKey) q.set('proveedorKey', proveedorKey);
  if (centroId)     q.set('centroId', centroId);
  if (from)         q.set('from', from);
  if (to)           q.set('to', to);
  if (anio)         q.set('anio', anio);
  if (mesKey)       q.set('mesKey', mesKey);

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

// Resolver _id haciendo una query específica por mesKey (fallback)
async function resolverDispIdPorMesKey({ proveedorKey, centroId, mesKey }) {
  if (!proveedorKey && !centroId) return null;
  if (!mesKey) return null;
  const lista = await fetchDisponibilidades({ proveedorKey, centroId, mesKey });
  const item = (lista || []).find(x => x.mesKey === mesKey && (x._id || x.id));
  return item ? (item._id || item.id || null) : null;
}

// POST /disponibilidades
async function postDisponibilidad(d){
  const empresaNombre = d.empresaNombre || d.proveedorNombre || '';
  const payload = {
    proveedorKey: d.proveedorKey || slug(empresaNombre),
    proveedorNombre: empresaNombre,
    empresaNombre, // para filtros en Inventario

    contactoId: d.contactoId || null,
    contactoNombre: d.contactoNombre || '',
    contactoSnapshot: buildContactoSnapshot({
      tel: d.contactoTelefono || '',
      email: d.contactoEmail || '',
      empresaNombre
    }),

    centroId: d.centroId || null,
    centroCodigo: d.centroCodigo || '',
    comuna: d.comuna || '',
    areaCodigo: d.areaCodigo || '',

    mesKey: d.mesKey || mesKeyFrom(d.anio, d.mes),
    anio: Number(d.anio),
    mes: Number(d.mes),
    // fecha opcional, por compatibilidad
    fecha: new Date(Number(d.anio), Number(d.mes) - 1, 1).toISOString(),

    tonsDisponible: Number(d.tons),
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
  const empresaNombre = d.empresaNombre || d.proveedorNombre || '';
  const patch = {};

  if (d.anio && d.mes) {
    patch.mesKey = mesKeyFrom(d.anio, d.mes);
    patch.anio = Number(d.anio);
    patch.mes  = Number(d.mes);
    patch.fecha = new Date(Number(d.anio), Number(d.mes) - 1, 1).toISOString();
  }
  if ('tons' in d) patch.tonsDisponible = Number(d.tons);
  if (d.estado) patch.estado = d.estado;

  // actualizar datos de contacto/empresa si vienen
  if (empresaNombre) {
    patch.empresaNombre = empresaNombre;
    patch.proveedorNombre = empresaNombre;
    patch.proveedorKey = slug(empresaNombre);
  }
  if ('contactoId' in d) patch.contactoId = d.contactoId || null;
  if ('contactoNombre' in d) patch.contactoNombre = d.contactoNombre || '';
  if ('contactoTelefono' in d || 'contactoEmail' in d || empresaNombre) {
    patch.contactoSnapshot = buildContactoSnapshot({
      tel: d.contactoTelefono || '',
      email: d.contactoEmail || '',
      empresaNombre
    });
  }

  const r = await fetch(`${API_BASE}/disponibilidades/${id}`, {
    method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(patch)
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
    state._ultimaDispLista = lista; // cache para acciones
    box.innerHTML = renderAsignaciones(lista);
  } catch(e){
    console.error(e);
    state._ultimaDispLista = [];
    box.innerHTML = '<span class="red-text">No se pudo cargar disponibilidad</span>';
  }
}

/* ---------- Utilidades de formulario ---------- */
function clearCentroHidden(){ setVal(['centroId'],''); setVal(['centroCodigo'],''); setVal(['centroComuna'],''); setVal(['centroHectareas'],''); }
function clearProveedorHidden(){ setVal(['proveedorKey'],''); setVal(['proveedorId'],''); setVal(['proveedorNombre'],''); }

/* ================== Detalle (modal del ojo) ================== */
function comunasDelProveedor(proveedorKey) {
  const key = proveedorKey?.length ? proveedorKey : null;
  const comunas = new Set();
  for (const c of state.listaCentros || []) {
    const k = c.proveedorKey?.length ? c.proveedorKey : slug(c.proveedor || '');
    if (!key || k === key) {
      const comuna = (c.comuna || '').trim();
      if (comuna) comunas.add(comuna);
    }
  }
  return Array.from(comunas);
}

function miniTimelineHTML(visitas = []) {
  const arr = Array.isArray(visitas) ? visitas : (visitas?.items || []);
  if (!arr.length) return '<div class="text-soft">Sin visitas registradas</div>';
  const filas = arr.slice(0, 3).map((v) => {
    const code = v.centroCodigo || (v.centroId ? centroCodigoById(v.centroId) : '') || '-';
    const fechaStr = (v.fecha ? String(v.fecha).slice(0,10) : '');
    return `
      <div class="row" style="margin-bottom:.35rem">
        <div class="col s4"><strong>${fechaStr || '-'}</strong></div>
        <div class="col s4">${esc(code)}</div>
        <div class="col s4">${esc(v.estado || '-')}</div>
        <div class="col s12"><span class="text-soft">${v.tonsComprometidas ? (v.tonsComprometidas + ' t • ') : ''}${esc(v.observaciones || '')}</span></div>
      </div>
    `;
  }).join('');
  return filas + `<a class="btn btn--ghost" id="btnVerVisitas">Ver todas</a>`;
}

function renderAsignacionesSimple(list){
  if(!list?.length) return '<span class="grey-text">Sin disponibilidades registradas.</span>';
  const rows = list.map(a => `
    <tr>
      <td>${MES[a.mes]||a.mes} ${a.anio||''}</td>
      <td class="right-align">${Number(a.tons||0).toLocaleString('es-CL',{maximumFractionDigits:2})}</td>
      <td>${esc(a.estado||'')}</td>
      <td class="right-align"></td>
    </tr>
  `).join('');
  return `
    <table class="striped highlight" style="margin:6px 0">
      <thead>
        <tr><th>Mes</th><th class="right-align">Tons</th><th>Estado</th><th class="right-align" style="width:100px">Opciones</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export async function abrirDetalleContacto(c) {
  const body = $('#detalleContactoBody'); if (!body) return;

  const fechaFmt = fmtISOfechaHora(c.createdAt || c.fecha || Date.now());
  const comunas = comunasDelProveedor(c.proveedorKey || slug(c.proveedorNombre||''));
  const chips = comunas.length
    ? comunas.map(x => `<span class="badge chip" style="margin-right:.35rem;margin-bottom:.35rem">${esc(x)}</span>`).join('')
    : '<span class="text-soft">Sin centros asociados</span>';

  // últimas visitas (para el timeline)
  let visitas = [];
  try { visitas = await apiGetVisitasByContacto(c._id) || []; } catch {}

  // estructura principal del modal
  body.innerHTML = `
    <div class="mb-4">
      <h6 class="text-soft" style="margin:0 0 .5rem">Comunas con centros del proveedor</h6>
      ${chips}
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
      <div><strong>Fecha:</strong> ${esc(fechaFmt)}</div>
      <div><strong>Proveedor:</strong> ${esc(c.proveedorNombre || '')}</div>
      <div><strong>Centro:</strong> ${esc(c.centroCodigo || '-')}</div>
      <div><strong>Disposición:</strong> ${esc(c.dispuestoVender || '-')}</div>
      <div><strong>Vende a:</strong> ${esc(c.vendeActualmenteA || '-')}</div>
      <div style="grid-column:1/-1;"><strong>Notas:</strong> ${c.notas ? esc(c.notas) : '<span class="text-soft">Sin notas</span>'}</div>
      <div style="grid-column:1/-1;"><strong>Contacto:</strong> ${[c.contactoNombre, c.contactoTelefono, c.contactoEmail].filter(Boolean).map(esc).join(' • ') || '-'}</div>
    </div>

    <div class="mb-4" style="margin-top:1rem;">
      <h6 class="text-soft" style="margin:0 0 .5rem">Disponibilidad registrada</h6>
      <div id="detalleAsignacionesTable" class="card-panel grey lighten-4" style="padding:8px 12px">
        <span class="grey-text">Cargando disponibilidad...</span>
      </div>
    </div>

    <div class="mb-4" style="margin-top:1rem;">
      <h6 class="text-soft" style="margin:0 0 .5rem">Últimas visitas</h6>
      ${miniTimelineHTML(visitas)}
    </div>

    <div class="right-align">
      <button class="btn teal" id="btnNuevaVisita" data-id="${c._id}">
        <i class="material-icons left">event_available</i>Registrar visita
      </button>
    </div>
  `;

  // cargar disponibilidades
  try {
    const proveedorKey = c.proveedorKey || (c.proveedorNombre ? slug(c.proveedorNombre) : '');
    const centroId = c.centroId || null;
    const lista = await fetchDisponibilidades({ proveedorKey, centroId });
    const mapped = (lista||[]).map(x => ({
      anio: x.anio, mes: x.mes, tons: Number(x.tons||0), estado: x.estado || 'disponible'
    }));
    const cont = document.getElementById('detalleAsignacionesTable');
    if (cont) cont.innerHTML = renderAsignacionesSimple(mapped);
  } catch (e) {
    const cont = document.getElementById('detalleAsignacionesTable');
    if (cont) cont.innerHTML = '<span class="red-text">No se pudo cargar disponibilidad</span>';
  }

  // botón registrar visita
  $('#btnNuevaVisita')?.addEventListener('click', () => abrirModalVisita(c));

  // abrir modal
  (M.Modal.getInstance(document.getElementById('modalDetalleContacto')) || M.Modal.init(document.getElementById('modalDetalleContacto'))).open();
}

/* ---------- Setup ---------- */
export function setupFormulario() {
  const form = $('#formContacto'); if (!form) return;
  state.editId = null;
  state.dispEditId = null; // para PATCH

  // setear contactoActual al pulsar "ver"
  document.addEventListener('click', (e)=>{
    const a = e.target.closest?.('a.icon-action.ver'); if(!a) return;
    const id = a.dataset.id;
    state.contactoActual = (state.contactosGuardados||[]).find(x=>String(x._id)===String(id)) || null;
  }, true);

  const selCentro = $('#selectCentro');
  selCentro?.addEventListener('change', () => syncHiddenFromSelect(selCentro));

  // Delegación de acciones en la tabla de disponibilidades (editar/eliminar)
  document.getElementById('asigHist')?.addEventListener('click', async (e)=>{
    const btn = e.target.closest('.mini-actions a'); if(!btn) return;
    e.preventDefault();

    let id = btn.dataset.id?.trim() || '';
    if (!id || !isValidObjectId(id)) {
      // intentar resolver por mesKey con API si el id no vino en la lista
      const mk = btn.dataset.meskey || '';
      const contacto = state.editingContacto || state.contactoActual || {};
      const proveedorKey = contacto?.proveedorKey || (contacto?.proveedorNombre ? slug(contacto.proveedorNombre) : '');
      const centroId = contacto?.centroId || null;
      if (mk) {
        try {
          const resolved = await resolverDispIdPorMesKey({ proveedorKey, centroId, mesKey: mk });
          if (resolved) id = resolved;
        } catch {}
      }
    }

    if (!id || !isValidObjectId(id)) {
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
      const editId = state.editId;
      const esUpdate = isValidObjectId(editId);

      let created = null;
      if (esUpdate) {
        // Guardamos contacto
        await apiUpdateContacto(editId, payload);

        // SYNC: propaga cambios a disponibilidades existentes del contacto
        try {
          const oldKey =
            (state.editingContacto &&
             (state.editingContacto.proveedorKey ||
              (state.editingContacto.proveedorNombre ? slug(state.editingContacto.proveedorNombre) : ''))) || '';
          await fetch(`${API_BASE}/disponibilidades/sync-by-contacto/${encodeURIComponent(editId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldProveedorKey: oldKey })
          });
        } catch (syncErr) {
          console.warn('sync-by-contacto falló (no crítico):', syncErr);
        }
      } else {
        // Creamos contacto (intentamos obtener el _id)
        created = await apiCreateContacto(payload);
        // opcional: sincronizar si ya existieran disponibilidades previas relacionadas
        try {
          const nuevoId = created && (created._id || created.id);
          if (nuevoId) {
            await fetch(`${API_BASE}/disponibilidades/sync-by-contacto/${encodeURIComponent(nuevoId)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({})
            });
          }
        } catch (syncErr) {
          console.warn('sync-by-contacto (post-create) falló (no crítico):', syncErr);
        }
      }

      const contactoIdDoc = esUpdate ? editId : (created && (created._id || created.id)) || null;

      // Crear o actualizar disponibilidad (sólo si hay datos válidos)
      if (tieneDispCampos && hasEmpresa && centroId) {
        const dispCommon = {
          proveedorKey, proveedorNombre,
          empresaNombre: proveedorNombre || '',
          contactoId: contactoIdDoc,
          contactoNombre,
          contactoTelefono,
          contactoEmail
        };

        if (state.dispEditId) {
          await patchDisponibilidad(state.dispEditId, {
            ...dispCommon,
            anio: asigAnio, mes: asigMes, tons: asigTonsNum, estado:'disponible'
          });
          state.dispEditId = null;
          M.toast?.({ html:'Disponibilidad actualizada', classes:'teal' });
        } else {
          await postDisponibilidad({
            ...dispCommon,
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

