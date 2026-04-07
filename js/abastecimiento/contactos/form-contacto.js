// /js/abastecimiento/contactos/form-contacto.js
import { apiCreateContacto, apiUpdateContacto, apiDeleteContacto, apiGetVisitasByContacto } from '../../core/api.js';
import { state, $, getVal, setVal, slug } from './state.js';
import { cargarContactosGuardados } from './data.js';
import { syncHiddenFromSelect, mostrarCentrosDeProveedor, resetSelectCentros } from './proveedores.js';
import { comunaPorCodigo, centroCodigoById } from './normalizers.js';
import { renderTablaContactos } from './tabla.js';
import { abrirModalVisita } from '../visitas/ui.js';
import { createModalConfirm, escapeHtml, fetchJson, getModalInstance } from './ui-common.js';

const isValidObjectId = (s) => typeof s === 'string' && /^[0-9a-fA-F]{24}$/.test(s);

/* ---------- Constantes ---------- */
const API_BASE = window.API_URL || '/api';
const MES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const pad2 = (n)=>String(n).padStart(2,'0');
const mesKeyFrom = (y,m)=>`${y}-${pad2(m)}`;
const OPORT_ESTADOS = ['disponible','en_gestion','muestreo','semi_cerrado','cerrado_exitoso','perdido','descartado'];
const OPORT_ESTADOS_LABEL = {
  disponible: 'Disponible',
  en_gestion: 'En gestion',
  muestreo: 'Muestreo',
  semi_cerrado: 'Semi-cerrado',
  cerrado_exitoso: 'Cerrado exitoso',
  perdido: 'Perdido',
  descartado: 'Descartado'
};
const OPORT_MOTIVOS = [
  'precio_no_competitivo',
  'sin_biomasa',
  'competencia',
  'calidad_insuficiente',
  'logistica',
  'sin_respuesta',
  'otros'
];
const OBSERVACIONES_MAX = 160;

/* ---------- helpers comunes ---------- */
const esc = escapeHtml;
const apiJson = (path, options = {}) => {
  const opts = { credentials: 'same-origin', ...options, headers: { ...(options.headers || {}) } };
  if (opts.body !== undefined && opts.body !== null && typeof opts.body !== 'string') {
    opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  return fetchJson(`${API_BASE}${path}`, opts);
};
const askDeleteDisponibilidad = createModalConfirm({
  id: 'modalConfirmDeleteDisponibilidad',
  defaultTitle: 'Eliminar disponibilidad',
  defaultMessage: '¿Eliminar esta disponibilidad?',
  acceptText: 'Eliminar'
});

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

const fmtISOfecha = (d) => {
  const x = (d instanceof Date) ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const normalizeUser = (u) => {
  if (!u || typeof u !== 'object') return null;
  const id = u._id || u.id || u.userId || u.usuarioId || u.uid || '';
  const name = u.nombre || u.name || u.fullName || u.displayName || u.usuario || u.email || '';
  if (!id) return null;
  return { id: String(id), name: String(name || '') };
};

const getLoggedUser = () => {
  try {
    const candidates = [
      window.__USER__,
      window.__USER,
      window.USER,
      window.user,
      window.currentUser,
      window.usuario,
      window.usuarioActual,
      window.MMppUser,
      window.appUser,
      window.sessionUser,
      window.APP_STATE && window.APP_STATE.user,
      window.__APP__ && window.__APP__.user
    ].filter(Boolean);

    for (const c of candidates) {
      const u = normalizeUser(c);
      if (u && isValidObjectId(u.id)) return u;
    }
  } catch {}
  return null;
};

function updateObservacionesCounter() {
  const input = document.getElementById('vendeActualmenteA');
  const counter = document.getElementById('observacionesCounter');
  if (!input || !counter) return;

  const raw = String(input.value || '');
  if (raw.length > OBSERVACIONES_MAX) {
    input.value = raw.slice(0, OBSERVACIONES_MAX);
  }

  const len = String(input.value || '').length;
  counter.textContent = `${len}/${OBSERVACIONES_MAX}`;
  counter.classList.toggle('is-limit', len >= OBSERVACIONES_MAX);
}

function bindObservacionesCounter() {
  const input = document.getElementById('vendeActualmenteA');
  if (!input) return;
  input.setAttribute('maxlength', String(OBSERVACIONES_MAX));

  if (input.dataset.counterBound !== '1') {
    input.dataset.counterBound = '1';
    input.addEventListener('input', updateObservacionesCounter);
  }

  updateObservacionesCounter();
}

/* ---------- helpers de contacto   snapshot ---------- */
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
  let id = x && (x._id || x.id);
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

// S& soporta filtro por contactoId y aplica un rango por defecto (y-1..y+1)
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
    const data = await apiJson(`/disponibilidades?${q.toString()}`);
    let list = Array.isArray(data) ? data : (data.items || []);

    let mapped = list.map(x => {
      const id = normId(x);
      const mk = x.mesKey || (x.anio && x.mes ? mesKeyFrom(x.anio, x.mes) : null);
      return {
        _id: id, id,
        anio:   x.anio ? (Number((mk || '').slice(0, 4)) || null) : null,
        mes:    x.mes  ? (Number((mk || '').slice(5, 7)) || null) : null,
        tons:   Number(x.tonsDisponible ?? x.tons ?? 0) || 0,
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

  return apiJson('/disponibilidades', { method: 'POST', body: payload });
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

  return apiJson(`/disponibilidades/${id}`, { method: 'PATCH', body: patch });
}

// DELETE /disponibilidades/:id
async function deleteDisponibilidad(id){
  return apiJson(`/disponibilidades/${id}`, { method: 'DELETE' });
}

/* ---------- API helpers para OPORTUNIDADES ---------- */
async function fetchOportunidadesByProveedor(proveedorId){
  if (!proveedorId) return [];
  try {
    const data = await apiJson(`/proveedores/${proveedorId}/oportunidades`);
    return Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
  } catch {
    return [];
  }
}

async function fetchHistorialByProveedor(proveedorId){
  if (!proveedorId) return { items: [] };
  try {
    const data = await apiJson(`/proveedores/${proveedorId}/historial`);
    return data && typeof data === 'object' ? data : { items: [] };
  } catch {
    return { items: [] };
  }
}

async function postOportunidad(payload){
  return apiJson('/oportunidades', { method: 'POST', body: payload });
}

async function patchOportunidadEstado(id, payload){
  return apiJson(`/oportunidades/${id}/estado`, { method: 'PATCH', body: payload });
}

async function postOportunidadEvento(id, payload){
  return apiJson(`/oportunidades/${id}/eventos`, { method: 'POST', body: payload });
}

async function cerrarOportunidadExitoso(id, payload){
  return apiJson(`/oportunidades/${id}/cerrar-exitoso`, { method: 'POST', body: payload });
}

async function cerrarOportunidadPerdido(id, payload){
  return apiJson(`/oportunidades/${id}/cerrar-perdido`, { method: 'POST', body: payload });
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

  return `<table class="striped asig-table">
    <thead><tr>
      <th>Mes</th><th class="num">Tons</th><th>Estado</th><th class="th-opts-100">Opciones</th>
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
      <div class="row mini-tl-row">
        <div class="col s4"><strong>${fechaStr || '-'}</strong></div>
        <div class="col s4">${esc(code)}</div>
        <div class="col s4">${esc(v.estado || '-')}</div>
        <div class="col s12"><span class="text-soft">${v.tonsComprometidas ? (v.tonsComprometidas + ' t " ') : ''}${esc(v.observaciones || '')}</span></div>
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
    <table class="striped highlight asig-table">
      <thead>
        <tr><th>Mes</th><th class="right-align">Tons</th><th>Estado</th><th class="right-align th-opts-100">Opciones</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderOportunidades(list, historialMap){
  if (!list || !list.length) return '<span class="grey-text">Sin oportunidades registradas.</span>';
  const rows = list.map(o => {
    const id = (o._id || o.id || '');
    const estado = o.estado || 'disponible';
    const isTerminal = ['cerrado_exitoso','perdido','descartado'].includes(estado);
    const biomasa = (o.biomasaEstimacion != null)
      ? `${Number(o.biomasaEstimacion)} ${o.biomasaUnidad || 'tons'}`
      : '';
    const next = o.nextActionAt ? fmtISOfecha(o.nextActionAt) : '';
    const hist = (historialMap && historialMap.get(String(id))) ? historialMap.get(String(id)) : null;
    const eventos = (hist && Array.isArray(hist.eventos)) ? hist.eventos.slice(-3) : [];
    const eventosHtml = eventos.length
      ? eventos.map(ev => {
          const fecha = ev.fecha ? fmtISOfechaHora(ev.fecha) : '';
          const tipo = ev.tipo || '';
          const detalle = ev.detalle || '';
          return `<div class="text-soft event-line">${esc(fecha)} " ${esc(tipo)}${detalle ? '  ' + esc(detalle) : ''}</div>`;
        }).join('')
      : '<div class="text-soft">Sin eventos</div>';

    const estadoOptions = OPORT_ESTADOS.map(s =>
      `<option value="${s}"${s === estado ? ' selected' : ''}>${OPORT_ESTADOS_LABEL[s] || s}</option>`
    ).join('');
    const motivoOptions = [''].concat(OPORT_MOTIVOS).map(m =>
      `<option value="${m}">${m ? esc(m) : 'Motivo (si aplica)'}</option>`
    ).join('');

    return `
      <div class="card-panel grey lighten-5 opp-item opp-item-card" data-id="${id}" data-estado="${estado}">
        <div class="opp-meta-grid">
          <div><strong>Estado:</strong> ${esc(OPORT_ESTADOS_LABEL[estado] || estado)}</div>
          <div><strong>Biomasa:</strong> ${esc(biomasa)}</div>
          <div><strong>Inicio:</strong> ${esc(fmtISOfecha(o.fechaInicio)) || ''}</div>
          <div><strong>Ultima actividad:</strong> ${esc(fmtISOfechaHora(o.ultimaActividadAt)) || ''}</div>
        </div>

        <div class="row row-mt-8">
          <div class="col s12 m3">
            <label class="text-soft lbl-12">Estado</label>
            <select class="browser-default opp-estado"${isTerminal ? ' disabled' : ''}>${estadoOptions}</select>
          </div>
          <div class="col s12 m3">
            <label class="text-soft lbl-12">Motivo perdida</label>
            <select class="browser-default opp-motivo"${isTerminal ? ' disabled' : ''}>${motivoOptions}</select>
          </div>
          <div class="col s12 m3">
            <label class="text-soft lbl-12">Proximo paso</label>
            <input class="opp-next" type="date" value="${esc(next)}"${isTerminal ? ' disabled' : ''}>
          </div>
          <div class="col s12 m3">
            <label class="text-soft lbl-12">Observacion</label>
            <input class="opp-obs" type="text" placeholder="Opcional"${isTerminal ? ' disabled' : ''}>
          </div>
        </div>

        <div class="right-align mt-6">
          <a href="javascript:;" class="btn btn--ghost opp-actualizar${isTerminal ? ' disabled' : ''}" data-id="${id}"${isTerminal ? ' aria-disabled="true"' : ''}>Actualizar estado</a>
        </div>

        <div class="row row-mt-8">
          <div class="col s12 m9">
            <input class="opp-nota" type="text" placeholder="Agregar nota/evento">
          </div>
          <div class="col s12 m3 right-align mt-6">
            <a href="javascript:;" class="btn btn--ghost opp-evento" data-id="${id}">Guardar nota</a>
          </div>
        </div>

        <div class="mt-6">
          <strong>Eventos recientes</strong>
          ${eventosHtml}
        </div>
      </div>
    `;
  }).join('');

  return rows;
}

async function cargarOportunidadesDetalle(contacto){
  const cont = document.getElementById('oportunidadesList');
  if (!cont) return;

  const proveedorId = contacto && (contacto._id || contacto.proveedorId);
  if (!proveedorId || !isValidObjectId(String(proveedorId))) {
    cont.innerHTML = '<span class="grey-text">Proveedor sin ID valido para oportunidades.</span>';
    return;
  }

  cont.innerHTML = '<span class="grey-text">Cargando oportunidades...</span>';
  try {
    const [lista, historial] = await Promise.all([
      fetchOportunidadesByProveedor(proveedorId),
      fetchHistorialByProveedor(proveedorId)
    ]);

    const map = new Map();
    if (historial && Array.isArray(historial.items)) {
      for (const it of historial.items) {
        const key = String(it?.oportunidad?._id || it?.oportunidad?.id || '');
        if (key) map.set(key, it);
      }
    }

    cont.innerHTML = renderOportunidades(lista, map);
  } catch (e) {
    try { console.error(e); } catch(_) {}
    cont.innerHTML = '<span class="red-text">No se pudo cargar oportunidades</span>';
  }
}

function bindOportunidadesActions(body){
  if (!body || body.dataset.oppBound) return;
  body.dataset.oppBound = '1';

  body.addEventListener('click', async function(e){
    const btnCrear = e.target && e.target.closest ? e.target.closest('#btnCrearOportunidad') : null;
    if (btnCrear) {
      e.preventDefault();
      if (btnCrear.dataset.loading === '1') return;
      btnCrear.dataset.loading = '1';
      btnCrear.classList.add('disabled');
      const prevText = btnCrear.textContent;
      btnCrear.textContent = 'Creando...';
      const c = state.detalleContacto || {};
      const proveedorId = c._id || c.proveedorId || '';
      if (!isValidObjectId(String(proveedorId))) {
        if (typeof M !== 'undefined' && M.toast) M.toast({ html:'Proveedor sin ID valido', classes:'red' });
        btnCrear.dataset.loading = '0';
        btnCrear.classList.remove('disabled');
        btnCrear.textContent = prevText;
        return;
      }

      const loggedUser = getLoggedUser();
      const estado = (document.getElementById('oppEstadoNew') && document.getElementById('oppEstadoNew').value) || 'disponible';
      const biomasaVal = document.getElementById('oppBiomasaNew') ? document.getElementById('oppBiomasaNew').value : '';
      const biomasaUnidad = (document.getElementById('oppBiomasaUnidadNew') && document.getElementById('oppBiomasaUnidadNew').value) || 'tons';
      const nextActionAt = document.getElementById('oppNextActionNew') ? document.getElementById('oppNextActionNew').value : '';
      const responsableUserId = loggedUser?.id || (document.getElementById('oppResponsableUserId') && document.getElementById('oppResponsableUserId').value) || '';
      const observacion = (document.getElementById('oppObservacionNew') && document.getElementById('oppObservacionNew').value) || '';

      if (!responsableUserId || !isValidObjectId(String(responsableUserId))) {
        if (typeof M !== 'undefined' && M.toast) M.toast({ html:'No se detecto usuario logueado. Ingresa Responsable ID valido.', classes:'red' });
        btnCrear.dataset.loading = '0';
        btnCrear.classList.remove('disabled');
        btnCrear.textContent = prevText;
        return;
      }

      const payload = {
        proveedorId,
        proveedorKey: c.proveedorKey || (c.proveedorNombre ? slug(c.proveedorNombre) : ''),
        proveedorNombre: c.proveedorNombre || '',
        estado,
        responsableUserId,
        responsableNombre: loggedUser?.name || c.responsablePG || c.responsable || c.contactoResponsable || '',
        centroId: c.centroId || null,
        centroCodigo: c.centroCodigo || '',
        biomasaEstimacion: biomasaVal ? Number(biomasaVal) : undefined,
        biomasaUnidad,
        biomasaVigente: !['cerrado_exitoso','perdido','descartado'].includes(estado),
        origen: 'contacto',
        nextActionAt: nextActionAt || undefined,
        meta: observacion ? { observacion } : undefined
      };

      try {
        await postOportunidad(payload);
        if (typeof M !== 'undefined' && M.toast) M.toast({ html:'Oportunidad creada', classes:'teal' });
        await cargarOportunidadesDetalle(c);
      } catch (err) {
        try { console.error(err); } catch(_) {}
        if (typeof M !== 'undefined' && M.toast) M.toast({ html:'No se pudo crear oportunidad', classes:'red' });
      } finally {
        btnCrear.dataset.loading = '0';
        btnCrear.classList.remove('disabled');
        btnCrear.textContent = prevText;
      }
      return;
    }

    const btnActualizar = e.target && e.target.closest ? e.target.closest('.opp-actualizar') : null;
    if (btnActualizar) {
      e.preventDefault();
      if (btnActualizar.classList.contains('disabled')) return;
      if (btnActualizar.dataset.loading === '1') return;
      btnActualizar.dataset.loading = '1';
      btnActualizar.classList.add('disabled');
      const prevText = btnActualizar.textContent;
      btnActualizar.textContent = 'Actualizando...';
      const item = btnActualizar.closest('.opp-item');
      const id = item && item.dataset ? item.dataset.id : '';
      const estadoActual = item && item.dataset ? item.dataset.estado : '';
      if (!id || !isValidObjectId(String(id))) {
        btnActualizar.dataset.loading = '0';
        btnActualizar.classList.remove('disabled');
        btnActualizar.textContent = prevText;
        return;
      }

      const estado = item.querySelector('.opp-estado') ? item.querySelector('.opp-estado').value : '';
      const motivoPerdida = item.querySelector('.opp-motivo') ? item.querySelector('.opp-motivo').value : '';
      const nextActionAt = item.querySelector('.opp-next') ? item.querySelector('.opp-next').value : '';
      const observacion = item.querySelector('.opp-obs') ? item.querySelector('.opp-obs').value.trim() : '';

      if (!estado || estado === estadoActual) {
        if (typeof M !== 'undefined' && M.toast) M.toast({ html:'Selecciona un nuevo estado', classes:'orange' });
        btnActualizar.dataset.loading = '0';
        btnActualizar.classList.remove('disabled');
        btnActualizar.textContent = prevText;
        return;
      }

      try {
        if (estado === 'cerrado_exitoso') {
          await cerrarOportunidadExitoso(id, { observacion: observacion || undefined });
        } else if (estado === 'perdido' || estado === 'descartado') {
          if (!motivoPerdida) {
            if (typeof M !== 'undefined' && M.toast) M.toast({ html:'Selecciona un motivo de perdida', classes:'red' });
            btnActualizar.dataset.loading = '0';
            btnActualizar.classList.remove('disabled');
            btnActualizar.textContent = prevText;
            return;
          }
          await cerrarOportunidadPerdido(id, {
            motivoPerdida,
            observacion: observacion || undefined,
            estado
          });
        } else {
          await patchOportunidadEstado(id, {
            estado,
            nextActionAt: nextActionAt || undefined,
            observacion: observacion || undefined
          });
        }

        if (typeof M !== 'undefined' && M.toast) M.toast({ html:'Estado actualizado', classes:'teal' });
        const c = state.detalleContacto || {};
        await cargarOportunidadesDetalle(c);
      } catch (err) {
        try { console.error(err); } catch(_) {}
        if (typeof M !== 'undefined' && M.toast) M.toast({ html:'No se pudo actualizar', classes:'red' });
      } finally {
        btnActualizar.dataset.loading = '0';
        btnActualizar.classList.remove('disabled');
        btnActualizar.textContent = prevText;
      }
      return;
    }

    const btnEvento = e.target && e.target.closest ? e.target.closest('.opp-evento') : null;
    if (btnEvento) {
      e.preventDefault();
      if (btnEvento.dataset.loading === '1') return;
      btnEvento.dataset.loading = '1';
      btnEvento.classList.add('disabled');
      const prevText = btnEvento.textContent;
      btnEvento.textContent = 'Guardando...';
      const item = btnEvento.closest('.opp-item');
      const id = item && item.dataset ? item.dataset.id : '';
      if (!id || !isValidObjectId(String(id))) {
        btnEvento.dataset.loading = '0';
        btnEvento.classList.remove('disabled');
        btnEvento.textContent = prevText;
        return;
      }

      const nota = item.querySelector('.opp-nota') ? item.querySelector('.opp-nota').value.trim() : '';
      if (!nota) {
        if (typeof M !== 'undefined' && M.toast) M.toast({ html:'Escribe una nota', classes:'red' });
        btnEvento.dataset.loading = '0';
        btnEvento.classList.remove('disabled');
        btnEvento.textContent = prevText;
        return;
      }

      try {
        await postOportunidadEvento(id, { tipo: 'nota', detalle: nota });
        if (typeof M !== 'undefined' && M.toast) M.toast({ html:'Nota guardada', classes:'teal' });
        const c = state.detalleContacto || {};
        await cargarOportunidadesDetalle(c);
      } catch (err) {
        try { console.error(err); } catch(_) {}
        if (typeof M !== 'undefined' && M.toast) M.toast({ html:'No se pudo guardar nota', classes:'red' });
      } finally {
        btnEvento.dataset.loading = '0';
        btnEvento.classList.remove('disabled');
        btnEvento.textContent = prevText;
      }
    }
  });
}

function syncResponsableFields(){
  const inputId = document.getElementById('oppResponsableUserId');
  if (!inputId) return;

  const loggedUser = getLoggedUser();
  if (loggedUser && isValidObjectId(String(loggedUser.id))) {
    inputId.value = loggedUser.id;
    inputId.setAttribute('disabled', 'disabled');
    inputId.setAttribute('data-locked', '1');
    inputId.setAttribute('title', loggedUser.name || 'Usuario logueado');
  } else {
    inputId.removeAttribute('disabled');
    inputId.removeAttribute('data-locked');
    inputId.removeAttribute('title');
    if (!inputId.value) inputId.placeholder = 'ObjectId del responsable';
  }
}

export async function abrirDetalleContacto(c) {
  const body = $('#detalleContactoBody'); if (!body) return;
  state.detalleContacto = c;

  const fechaFmt = fmtISOfechaHora(c.createdAt || c.fecha || Date.now());
  const comunas = comunasDelProveedor(c.proveedorKey || slug(c.proveedorNombre||''));
  const chips = comunas.length
    ? comunas.map(x => `<span class="badge chip chip-compact">${esc(x)}</span>`).join('')
    : '<span class="text-soft">Sin centros asociados</span>';

  let visitas = [];
  try { visitas = await apiGetVisitasByContacto(c._id) || []; } catch {}

  body.innerHTML = `
    <div class="mb-4">
      <h6 class="text-soft mb-05">Comunas con centros del proveedor</h6>
      ${chips}
    </div>

    <div class="detail-grid">
      <div><strong>Fecha:</strong> ${esc(fechaFmt)}</div>
      <div><strong>Proveedor:</strong> ${esc(c.proveedorNombre || '')}</div>
      <div><strong>Centro:</strong> ${esc(c.centroCodigo || '-')}</div>
      <div><strong>Disposicin:</strong> ${esc(c.dispuestoVender || '-')}</div>
      <div><strong>Vende a:</strong> ${esc(c.vendeActualmenteA || '-')}</div>
      <div class="full-col"><strong>Notas:</strong> ${c.notas ? esc(c.notas) : '<span class="text-soft">Sin notas</span>'}</div>
      <div class="full-col"><strong>Contacto:</strong> ${[c.contactoNombre, c.contactoTelefono, c.contactoEmail].filter(Boolean).map(esc).join(' " ') || '-'}</div>
    </div>

    <div class="mb-4 mt-1">
      <h6 class="text-soft mb-05">Disponibilidad registrada</h6>
      <div id="detalleAsignacionesTable" class="card-panel grey lighten-4 detail-asig-box">
        <span class="grey-text">Cargando disponibilidad...</span>
      </div>
    </div>

    <div class="mb-4 mt-1">
      <h6 class="text-soft mb-05">Oportunidades</h6>
      <div class="card-panel grey lighten-4 detail-card-pad">
        <div class="row row-m-0">
          <div class="col s12 m3">
            <label class="text-soft lbl-12">Estado inicial</label>
            <select id="oppEstadoNew" class="browser-default">
              ${OPORT_ESTADOS.map(s => `<option value="${s}">${OPORT_ESTADOS_LABEL[s] || s}</option>`).join('')}
            </select>
          </div>
          <div class="col s12 m3">
            <label class="text-soft lbl-12">Biomasa</label>
            <input id="oppBiomasaNew" type="number" step="0.01" min="0" placeholder="Tons">
          </div>
          <div class="col s12 m2">
            <label class="text-soft lbl-12">Unidad</label>
            <select id="oppBiomasaUnidadNew" class="browser-default">
              <option value="tons" selected>tons</option>
              <option value="kg">kg</option>
            </select>
          </div>
          <div class="col s12 m4">
            <label class="text-soft lbl-12">Proximo paso</label>
            <input id="oppNextActionNew" type="date">
          </div>
        </div>
        <div class="row row-m-0">
          <div class="col s12 m6">
            <label class="text-soft lbl-12">Responsable ID</label>
            <input id="oppResponsableUserId" type="text" placeholder="ObjectId del responsable">
          </div>
          <div class="col s12 m6">
            <label class="text-soft lbl-12">Observacion</label>
            <input id="oppObservacionNew" type="text" placeholder="Opcional">
          </div>
        </div>
        <div class="right-align mt-6">
          <a href="javascript:;" class="btn teal" id="btnCrearOportunidad">Crear oportunidad</a>
        </div>

        <div id="oportunidadesList" class="mt-8">
          <span class="grey-text">Cargando oportunidades...</span>
        </div>
      </div>
    </div>

    <div class="mb-4 mt-1">
      <h6 class="text-soft mb-05">Ultimas visitas</h6>
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

  bindOportunidadesActions(body);
  syncResponsableFields();
  await cargarOportunidadesDetalle(c);

  const btnNV = document.getElementById('btnNuevaVisita');
  if (btnNV) btnNV.addEventListener('click', function(){ abrirModalVisita(c); });

  getModalInstance('modalDetalleContacto')?.open();
}

/* ---------- Setup ---------- */
export function setupFormulario() {
  const form = $('#formContacto'); if (!form) return;
  state.editId = null;
  state.dispEditId = null;
  bindObservacionesCounter();

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
      if (typeof M !== 'undefined' && M.toast) M.toast({ html:'No hay ID valido para esta fila', classes:'red' });
      return;
    }

    if (btn.classList.contains('mini-del')) {
      const ok = await askDeleteDisponibilidad('Eliminar disponibilidad', '¿Eliminar esta disponibilidad?', 'Eliminar');
      if (!ok) return;
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
      if (typeof M !== 'undefined' && M.toast) M.toast({ html: 'Ingresa una empresa o una persona (nombre + telfono o email).', displayLength: 2800 });
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
    const biomasaVal          = (biomasaEl && biomasaEl.checked) ? 'Con biomasa' : 'Sin biomasa';
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

    // Compatibilidad: mapear biomasa   tieneMMPP/resultado
    let tieneMMPP = '';
    let resultado = '';
    if (biomasaVal === 'con') { tieneMMPP = 'S';  resultado = 'Disponible'; }
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

      const modalInst = getModalInstance('modalContacto');
      form.reset();
      clearCentroHidden();
      clearProveedorHidden();
      state.editId = null;

      // limpiar extras nuevos
      var n1 = document.getElementById('contactoBiomasa');        if (n1) n1.checked = false;
      var n2 = document.getElementById('contactoLocalidad');      if (n2) n2.value = '';
      var n3 = document.getElementById('contactoProveedorNuevo'); if (n3) n3.checked = false;
      var n4 = document.getElementById('contacto_proximoPaso');   if (n4) n4.value = '';
      var n5 = document.getElementById('contacto_proximoPasoFecha'); if (n5) n5.value = '';
      updateObservacionesCounter();

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
  const bioEl = document.getElementById('contactoBiomasa');   if (bioEl) {
    const b = (c.biomasa || (c.tieneMMPP === 'S' ? 'con' : (c.tieneMMPP === 'No' ? 'sin' : ''))) || '';
    bioEl.checked = b.toLowerCase().includes('con');
  }
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
  updateObservacionesCounter();

  if (typeof M !== 'undefined' && typeof M.updateTextFields === 'function') M.updateTextFields();
  getModalInstance('modalContacto')?.open();
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
      try { console.warn('[deleteContacto] backend devolvio 404, tratando como exito'); } catch(_) {}
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
  const n1 = document.getElementById('contactoBiomasa'); if (n1) n1.checked = false;
  const n2 = document.getElementById('contactoLocalidad'); if (n2) n2.value = '';
  const n3 = document.getElementById('contactoProveedorNuevo'); if (n3) n3.checked = false;
  const n4 = document.getElementById('contacto_proximoPaso'); if (n4) n4.value = '';
  const n5 = document.getElementById('contacto_proximoPasoFecha'); if (n5) n5.value = '';
  updateObservacionesCounter();

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
