// /js/abastecimiento/contactos/form-contacto.js
import { apiCreateContacto, apiUpdateContacto, apiDeleteContacto, apiGetVisitasByContacto } from '../../core/api.js';
import { state, $, getVal, setVal, slug } from './state.js';
import { cargarContactosGuardados } from './data.js';
import { syncHiddenFromSelect, mostrarCentrosDeProveedor, resetSelectCentros, seleccionarCentroPorCodigo } from './proveedores.js';
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
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
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
    email: (email || '').trim().toLowerCase(),
    empresaKey,
    empresaNombre: empresaNombre || ''
  };
}

/* ---------- API helpers para DISPONIBILIDADES ---------- */
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

// ✅ soporta filtro por contactoId y aplica un rango por defecto (y-1..y+1)
async function fetchDisponibilidades({ proveedorKey, centroId, contactoId, from, to, anio, mesKey } = {}) {
  if (!proveedorKey && !centroId && !contactoId) return [];

  if (!from && !to && !anio && !mesKey) {
    const y = new Date().getFullYear();
    from = `${y - 1}-01`;
    to   = `${y + 1}-12`;
  }

  const q = new URLSearchParams();
  if (proveedorKey) q.set('proveedorKey', proveedorKey);
  if (centroId)     q.set('centroId', centroId);
  if (contactoId)   q.set('contactoId', contactoId);
  if (from)         q.set('from', from);
  if (to)           q.set('to', to);
  if (anio)         q.set('anio', anio);
  if (mesKey)       q.set('mesKey', mesKey);

  try {
    const r = await fetch(`${API_BASE}/disponibilidades?${q.toString()}`);
    if (!r.ok) return [];
    const data = await r.json();
    let list = Array.isArray(data) ? data : (data.items || []);

    let mapped = list.map(x => {
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
        centroId: x.centroId || null,
        contactoId: x.contactoId || null
      };
    });

    if (contactoId) mapped = mapped.filter(it => String(it.contactoId || '') === String(contactoId));
    return mapped;
  } catch {
    return [];
  }
}

async function resolverDispIdPorMesKey({ contactoId, proveedorKey, centroId, mesKey }) {
  if (!mesKey) return null;
  if (contactoId) {
    try {
      const l1 = await fetchDisponibilidades({ contactoId, mesKey });
      const i1 = (l1 || []).find(x => x.mesKey === mesKey && (x._id || x.id));
      if (i1) return (i1._id || i1.id || null);
    } catch {}
  }
  if (proveedorKey || centroId) {
    try {
      const l2 = await fetchDisponibilidades({ proveedorKey, centroId, mesKey });
      const i2 = (l2 || []).find(x => x.mesKey === mesKey && (x._id || x.id));
      if (i2) return (i2._id || i2.id || null);
    } catch {}
  }
  if (proveedorKey) {
    try {
      const l3 = await fetchDisponibilidades({ proveedorKey, mesKey });
      const i3 = (l3 || []).find(x => x.mesKey === mesKey && (x._id || x.id));
      if (i3) return (i3._id || i3.id || null);
    } catch {}
  }
  return null;
}

// POST /disponibilidades
async function postDisponibilidad(d){
  const empresaNombre = d.empresaNombre || d.proveedorNombre || '';
  const payload = {
    proveedorKey: d.proveedorKey || slug(empresaNombre),
    proveedorNombre: empresaNombre,
    empresaNombre,

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
  if(!list || !list.length) return '<span class="grey-text">Sin disponibilidades registradas.</span>';
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

  const proveedorKey = (contacto && (contacto.proveedorKey || (contacto.proveedorNombre ? slug(contacto.proveedorNombre) : ''))) || '';
  const centroId = (contacto && contacto.centroId) || null;
  const contactoId = (contacto && (contacto._id || contacto.contactoId)) || null;

  if (!proveedorKey && !centroId && !contactoId) {
    box.innerHTML = '<span class="grey-text">Sin disponibilidades registradas.</span>';
    state._ultimaDispLista = [];
    return;
  }

  box.innerHTML = '<span class="grey-text">Cargando disponibilidad...</span>';
  try {
    let lista = contactoId ? await fetchDisponibilidades({ contactoId }) : [];
    if (!lista.length && (proveedorKey || centroId)) {
      lista = await fetchDisponibilidades({ proveedorKey, centroId });
    }
    if (!lista.length && proveedorKey) {
      lista = await fetchDisponibilidades({ proveedorKey });
    }

    state._ultimaDispLista = lista;
    box.innerHTML = renderAsignaciones(lista);
  } catch(e){
    try { console.error(e); } catch(_) {}
    state._ultimaDispLista = [];
    box.innerHTML = '<span class="red-text">No se pudo cargar disponibilidad</span>';
  }
}

/* ---------- Utilidades de formulario ---------- */
function clearCentroHidden(){ setVal(['centroId'],''); setVal(['centroCodigo'],''); setVal(['centroComuna'],''); setVal(['centroHectareas'],''); }
function clearProveedorHidden(){ setVal(['proveedorKey'],''); setVal(['proveedorId'],''); setVal(['proveedorNombre'],''); }

/* ================== Detalle (modal del ojo) ================== */
function comunasDelProveedor(proveedorKey) {
  const key = (proveedorKey && proveedorKey.length) ? proveedorKey : null;
  const comunas = new Set();
  const lista = state.listaCentros || [];
  for (let i=0; i<lista.length; i++) {
    const c = lista[i];
    const k = (c.proveedorKey && c.proveedorKey.length) ? c.proveedorKey : slug(c.proveedor || '');
    if (!key || k === key) {
      const comuna = (c.comuna || '').trim();
      if (comuna) comunas.add(comuna);
    }
  }
  return Array.from(comunas);
}

function miniTimelineHTML(visitas = []) {
  const arr = Array.isArray(visitas) ? visitas : ((visitas && visitas.items) || []);
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
  if(!list || !list.length) return '<span class="grey-text">Sin disponibilidades registradas.</span>';
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

  let visitas = [];
  try { visitas = await apiGetVisitasByContacto(c._id) || []; } catch {}

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

  try {
    const proveedorKey = c.proveedorKey || (c.proveedorNombre ? slug(c.proveedorNombre) : '');
    const centroId = c.centroId || null;
    const contactoId = c._id || null;

    let lista = contactoId ? await fetchDisponibilidades({ contactoId }) : [];
    if (!lista.length && (proveedorKey || centroId)) {
      lista = await fetchDisponibilidades({ proveedorKey, centroId });
    }
    if (!lista.length && proveedorKey) {
      lista = await fetchDisponibilidades({ proveedorKey });
    }

    const mapped = (lista||[]).map(x => ({
      anio: x.anio, mes: x.mes, tons: Number(x.tons||0), estado: x.estado || 'disponible'
    }));
    const cont = document.getElementById('detalleAsignacionesTable');
    if (cont) cont.innerHTML = renderAsignacionesSimple(mapped);
  } catch (e) {
    const cont = document.getElementById('detalleAsignacionesTable');
    if (cont) cont.innerHTML = '<span class="red-text">No se pudo cargar disponibilidad</span>';
  }

  const btnNV = document.getElementById('btnNuevaVisita');
  if (btnNV) btnNV.addEventListener('click', function(){ abrirModalVisita(c); });

  const md = document.getElementById('modalDetalleContacto');
  (M.Modal.getInstance(md) || M.Modal.init(md)).open();
}

/* ---------- Setup ---------- */
export function setupFormulario() {
  const form = $('#formContacto'); if (!form) return;
  state.editId = null;
  state.dispEditId = null;

  // 👉 soporte de búsqueda por CÓDIGO DE CENTRO en el mismo input del proveedor
  const provInput = document.getElementById('buscadorProveedor');
  if (provInput) {
    const tryCode = (val) => {
      const m = String(val || '').trim().match(/\b(\d{4,7})\b/);
      if (m) seleccionarCentroPorCodigo(m[1]);
    };
    provInput.addEventListener('input', function(){ tryCode(provInput.value); });
    provInput.addEventListener('change', function(){ tryCode(provInput.value); });
  }

  document.addEventListener('click', function(e){
    const a = e.target && e.target.closest ? e.target.closest('a.icon-action.ver') : null;
    if(!a) return;
    const id = a.dataset.id;
    state.contactoActual = (state.contactosGuardados||[]).find(x=>String(x._id)===String(id)) || null;
  }, true);

  const selCentro = $('#selectCentro');
  if (selCentro) selCentro.addEventListener('change', function(){ syncHiddenFromSelect(selCentro); });

  const asigHist = document.getElementById('asigHist');
  if (asigHist) asigHist.addEventListener('click', async function(e){
    const btn = e.target && e.target.closest ? e.target.closest('.mini-actions a') : null;
    if(!btn) return;
    e.preventDefault();

    let id = (btn.dataset.id || '').trim();
    if (!id || !isValidObjectId(id)) {
      const mk = btn.dataset.meskey || '';
      const contacto = state.editingContacto || state.contactoActual || {};
      const proveedorKey = (contacto && (contacto.proveedorKey || (contacto.proveedorNombre ? slug(contacto.proveedorNombre) : ''))) || '';
      const centroId = (contacto && contacto.centroId) || null;
      const contactoId = (contacto && (contacto._id || contacto.contactoId)) || null;
      if (mk) {
        try {
          const resolved = await resolverDispIdPorMesKey({ contactoId, proveedorKey, centroId, mesKey: mk });
          if (resolved) id = resolved;
        } catch {}
      }
    }

    if (!id || !isValidObjectId(id)) {
      if (typeof M !== 'undefined' && M.toast) M.toast({ html:'No hay ID válido para esta fila', classes:'red' });
      return;
    }

    if (btn.classList.contains('mini-del')) {
      if (!confirm('¿Eliminar esta disponibilidad?')) return;
      try {
        await deleteDisponibilidad(id);
        const c = state.editingContacto || state.contactoActual || {};
        await pintarHistorialEdicion(c);
        if (typeof M !== 'undefined' && M.toast) M.toast({ html:'Disponibilidad eliminada', classes:'teal' });
      } catch (err) {
        try { console.error(err); } catch(_) {}
        if (typeof M !== 'undefined' && M.toast) M.toast({ html:'No se pudo eliminar', classes:'red' });
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
      if (typeof M !== 'undefined' && M.toast) M.toast({ html:'Editando disponibilidad: recuerda presionar Guardar', displayLength: 2200 });
      return;
    }
  });

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    // Empresa / proveedor
    const proveedorKeyRaw    = (getVal(['proveedorKey','proveedorId']) || '').trim();
    const proveedorNombreRaw = (getVal(['proveedorNombre']) || '').trim();
    const proveedorKey    = proveedorKeyRaw || null;
    const proveedorNombre = proveedorNombreRaw || null;
    const hasEmpresa      = !!(proveedorKey && proveedorNombre);

    // Persona de contacto
    const contactoNombre   = (document.getElementById('contactoNombre') && document.getElementById('contactoNombre').value || '').trim();
    const contactoTelefono = (document.getElementById('contactoTelefono') && document.getElementById('contactoTelefono').value || '').trim();
    const contactoEmail    = (document.getElementById('contactoEmail') && document.getElementById('contactoEmail').value || '').trim();
    const hasPersona       = !!contactoNombre && (!!contactoTelefono || !!contactoEmail);

    if (!hasEmpresa && !hasPersona) {
      if (typeof M !== 'undefined' && M.toast) M.toast({ html: 'Ingresa una empresa o una persona (nombre + teléfono o email).', displayLength: 2800 });
      const cn = document.getElementById('contactoNombre'); if (cn && cn.focus) cn.focus();
      return;
    }

    if (!hasEmpresa) { clearCentroHidden(); resetSelectCentros(); }

    // ===== Campos NUEVOS =====
    const localidadEl = document.getElementById('contactoLocalidad');
    const biomasaEl   = document.getElementById('contactoBiomasa');
    const provNuevoEl = document.getElementById('contactoProveedorNuevo');
    const proxPasoEl  = document.getElementById('contacto_proximoPaso');
    const proxFechaEl = document.getElementById('contacto_proximoPasoFecha');

    const localidad           = (localidadEl && localidadEl.value || '').trim();
    const biomasaVal          = biomasaEl ? (biomasaEl.value || '') : ''; // '' | 'con' | 'sin'
    const proveedorNuevoBool  = !!(provNuevoEl && provNuevoEl.checked);
    const proximoPaso         = proxPasoEl ? (proxPasoEl.value || '') : '';
    const proximoPasoFechaRaw = proxFechaEl ? (proxFechaEl.value || '') : ''; // YYYY-MM-DD o ''

    // Otros campos existentes
    const vendeActualmenteA = (document.getElementById('vendeActualmenteA') && document.getElementById('vendeActualmenteA').value || '').trim();
    const notas             = (document.getElementById('notasContacto') && document.getElementById('notasContacto').value || '').trim();
    const responsablePG     = (document.getElementById('contactoResponsable') && document.getElementById('contactoResponsable').value) || '';

    // Centro (opcional)
    if (selCentro) syncHiddenFromSelect(selCentro);
    const centroId        = hasEmpresa ? (getVal(['centroId']) || null) : null;
    const centroCodigo    = hasEmpresa ? (getVal(['centroCodigo']) || null) : null;
    const centroComuna    = hasEmpresa ? (getVal(['centroComuna']) || comunaPorCodigo(centroCodigo) || null) : null;
    const centroHectareas = hasEmpresa ? (getVal(['centroHectareas']) || null) : null;

    // Compatibilidad: mapear biomasa → tieneMMPP/resultado
    let tieneMMPP = '';
    let resultado = '';
    if (biomasaVal === 'con') { tieneMMPP = 'Sí';  resultado = 'Disponible'; }
    if (biomasaVal === 'sin') { tieneMMPP = 'No';  resultado = 'No disponible'; }

    const payload = {
      proveedorKey, proveedorNombre,
      resultado, tieneMMPP,
      biomasa: biomasaVal,
      localidad,
      proveedorNuevo: proveedorNuevoBool,
      proximoPaso,
      proximoPasoFecha: proximoPasoFechaRaw || null,
      vendeActualmenteA, notas,
      centroId, centroCodigo, centroComuna, centroHectareas,
      contactoNombre, contactoTelefono, contactoEmail,
      responsablePG
    };

    // Campos de disponibilidad (crear o patch)
    const asigAnio    = parseInt((document.getElementById('asigAnio') && document.getElementById('asigAnio').value) || '', 10);
    const asigMes     = parseInt((document.getElementById('asigMes') && document.getElementById('asigMes').value) || '', 10);
    const asigTonsNum = Number((document.getElementById('asigTons') && document.getElementById('asigTons').value) || NaN);
    const tieneDispCampos = Number.isInteger(asigAnio) && Number.isInteger(asigMes) &&
                            Number.isFinite(asigTonsNum) && asigTonsNum > 0;

    try {
      const editId   = state.editId;
      const esUpdate = isValidObjectId(editId);

      let created = null;
      if (esUpdate) {
        await apiUpdateContacto(editId, payload);
      } else {
        created = await apiCreateContacto(payload);
      }

      const contactoIdDoc = esUpdate
        ? editId
        : ((created && created.item && (created.item._id || created.item.id)) || (created && (created._id || created.id)) || null);

      if (tieneDispCampos) {
        const dispCommon = {
          proveedorKey,
          proveedorNombre,
          empresaNombre: proveedorNombre || '',
          contactoId: contactoIdDoc,
          contactoNombre,
          contactoTelefono,
          contactoEmail
        };

        if (state.dispEditId) {
          await patchDisponibilidad(state.dispEditId, {
            ...dispCommon,
            anio: asigAnio,
            mes: asigMes,
            tons: asigTonsNum,
            estado: 'disponible'
          });
          state.dispEditId = null;
          if (typeof M !== 'undefined' && M.toast) M.toast({ html: 'Disponibilidad actualizada', classes: 'teal' });
        } else {
          await postDisponibilidad({
            ...dispCommon,
            centroId: hasEmpresa ? (centroId || null) : null,
            centroCodigo: hasEmpresa ? (centroCodigo || '') : '',
            comuna: hasEmpresa ? (centroComuna || '') : '',
            anio: asigAnio,
            mes: asigMes,
            tons: asigTonsNum,
            estado: 'disponible'
          });
          if (typeof M !== 'undefined' && M.toast) M.toast({ html: 'Disponibilidad registrada', classes: 'teal' });
        }
      }

      await cargarContactosGuardados();
      renderTablaContactos();
      document.dispatchEvent(new Event('reload-tabla-contactos'));

      const c = state.editId
        ? { _id: state.editId, proveedorKey, proveedorNombre, centroId }
        : (state.contactoActual || {});
      await pintarHistorialEdicion({ ...c, _id: (state.editId || contactoIdDoc) });

      if (typeof M !== 'undefined' && M.toast) M.toast({ html: state.editId ? 'Contacto actualizado' : 'Contacto guardado', displayLength: 2000 });

      const modalInst = M.Modal.getInstance(document.getElementById('modalContacto'));
      form.reset();
      clearCentroHidden();
      clearProveedorHidden();
      state.editId = null;

      // limpiar extras nuevos
      var n1 = document.getElementById('contactoBiomasa');        if (n1) n1.value = '';
      var n2 = document.getElementById('contactoLocalidad');      if (n2) n2.value = '';
      var n3 = document.getElementById('contactoProveedorNuevo'); if (n3) n3.checked = false;
      var n4 = document.getElementById('contacto_proximoPaso');   if (n4) n4.value = '';
      var n5 = document.getElementById('contacto_proximoPasoFecha'); if (n5) n5.value = '';

      if (typeof M !== 'undefined' && typeof M.updateTextFields === 'function') {
        M.updateTextFields();
      }

      if (modalInst && typeof modalInst.close === 'function') {
        modalInst.close();
      }
    } catch (err) {
      var msg = (err && (err.message || err)) || 'Error desconocido';
      try { console.error('[form-contacto] ERROR:', msg); } catch (_) {}
      if (typeof M !== 'undefined' && M.toast) {
        M.toast({ html: 'Error al guardar contacto', displayLength: 2500 });
      }
    }
  }); // <-- cierre del addEventListener submit
}

/* ---------- Acciones ---------- */
export function abrirEdicion(c) {
  state.editId = c._id;
  state.editingContacto = c;
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

  // Existentes
  const vA = document.getElementById('vendeActualmenteA'); if (vA) vA.value = c.vendeActualmenteA || '';
  const notasEl = document.getElementById('notasContacto'); if (notasEl) notasEl.value = c.notas || '';
  const nomEl = document.getElementById('contactoNombre'); if (nomEl) nomEl.value = c.contactoNombre || '';
  const telEl = document.getElementById('contactoTelefono'); if (telEl) telEl.value = c.contactoTelefono || '';
  const emEl = document.getElementById('contactoEmail'); if (emEl) emEl.value = c.contactoEmail || '';
  const respEl = document.getElementById('contactoResponsable'); if (respEl) respEl.value = c.responsablePG || '';

  // NUEVOS
  const locEl = document.getElementById('contactoLocalidad'); if (locEl) locEl.value = c.localidad || '';
  const bioEl = document.getElementById('contactoBiomasa');   if (bioEl) bioEl.value = (c.biomasa || (c.tieneMMPP === 'Sí' ? 'con' : (c.tieneMMPP === 'No' ? 'sin' : ''))) || '';
  const pnEl  = document.getElementById('contactoProveedorNuevo'); if (pnEl) pnEl.checked = !!c.proveedorNuevo;
  const ppEl  = document.getElementById('contacto_proximoPaso'); if (ppEl) ppEl.value = c.proximoPaso || '';
  const pfEl  = document.getElementById('contacto_proximoPasoFecha');
  if (pfEl) {
    const f = (c.proximoPasoFecha || '').slice(0,10);
    pfEl.value = f || '';
  }

  const hoy = new Date();
  const anioEl = document.getElementById('asigAnio');
  const mesEl  = document.getElementById('asigMes');
  if (anioEl && !anioEl.value) anioEl.value = hoy.getFullYear();
  if (mesEl && !mesEl.value) mesEl.value = String(hoy.getMonth() + 1);

  pintarHistorialEdicion(c);

  if (typeof M !== 'undefined' && typeof M.updateTextFields === 'function') M.updateTextFields();
  const modal = document.getElementById('modalContacto');
  (M.Modal.getInstance(modal) || M.Modal.init(modal)).open();
}

export async function eliminarContacto(id) {
  const idStr = String(id || '').trim();

  const esContacto = (state.contactosGuardados || [])
    .some(c => String(c._id) === idStr);

  if (!esContacto) {
    try { console.warn('[deleteContacto] id no corresponde a un contacto visible:', idStr); } catch(_) {}
    await cargarContactosGuardados();
    renderTablaContactos();
    document.dispatchEvent(new Event('reload-tabla-contactos'));
    if (typeof M !== 'undefined' && M.toast) M.toast({ html: 'Contacto ya no existe', classes: 'teal' });
    return;
  }

  try {
    await apiDeleteContacto(idStr);
  } catch (err) {
    const msg = (err && err.message) || '';
    if (/Contacto no encontrado/i.test(msg) || /404/.test(msg)) {
      try { console.warn('[deleteContacto] backend devolvió 404, tratando como éxito'); } catch(_) {}
    } else {
      try { console.error(err); } catch(_) {}
      if (typeof M !== 'undefined' && M.toast) M.toast({ html: 'No se pudo eliminar', classes: 'red' });
      return;
    }
  }

  await cargarContactosGuardados();
  renderTablaContactos();
  document.dispatchEvent(new Event('reload-tabla-contactos'));
  if (typeof M !== 'undefined' && M.toast) M.toast({ html: 'Contacto eliminado', displayLength: 1800 });
}

export function prepararNuevo() {
  state.editId = null;
  state.dispEditId = null;
  const form = $('#formContacto'); if (form && form.reset) form.reset();
  clearProveedorHidden(); resetSelectCentros(); clearCentroHidden();

  // limpiar extras nuevos
  const n1 = document.getElementById('contactoBiomasa'); if (n1) n1.value = '';
  const n2 = document.getElementById('contactoLocalidad'); if (n2) n2.value = '';
  const n3 = document.getElementById('contactoProveedorNuevo'); if (n3) n3.checked = false;
  const n4 = document.getElementById('contacto_proximoPaso'); if (n4) n4.value = '';
  const n5 = document.getElementById('contacto_proximoPasoFecha'); if (n5) n5.value = '';

  const hoy = new Date();
  const anioEl = document.getElementById('asigAnio');
  const mesEl  = document.getElementById('asigMes');
  if (anioEl) anioEl.value = hoy.getFullYear();
  if (mesEl) mesEl.value = String(hoy.getMonth() + 1);
  const box = document.getElementById('asigHist');
  if (box) box.innerHTML = '<span class="grey-text">Sin disponibilidades registradas.</span>';
  const respEl = document.getElementById('contactoResponsable'); if (respEl) respEl.value = '';

  if (typeof M !== 'undefined' && typeof M.updateTextFields === 'function') M.updateTextFields();
}
