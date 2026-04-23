// /js/abastecimiento/contactos/form-contacto.js
import { apiCreateContacto, apiUpdateContacto, apiDeleteContacto, apiGetVisitasByContacto } from '../../core/api.js';
import { state, $, getVal, setVal, slug } from './state.js';
import { cargarContactosGuardados } from './data.js';
import { syncHiddenFromSelect, mostrarCentrosDeProveedor, resetSelectCentros } from './proveedores.js';
import { comunaPorCodigo, centroCodigoById } from './normalizers.js';
import { renderTablaContactos } from './tabla.js';
import { abrirModalVisita } from '../visitas/ui.js';
import { createModalConfirm, escapeHtml, fetchJson, getModalInstance } from './ui-common.js';
import { toast } from '../../ui/toast.js';

const isValidObjectId = (s) => typeof s === 'string' && /^[0-9a-fA-F]{24}$/.test(s);

/* ---------- Constantes ---------- */
const API_BASE = window.API_URL || '/api';
const MES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const pad2 = (n)=>String(n).padStart(2,'0');
const mesKeyFrom = (y,m)=>`${y}-${pad2(m)}`;
const OPORT_ESTADOS = ['disponible','semi_acordado','acordado','perdido','descartado'];
const OPORT_ESTADOS_LABEL = {
  disponible:   'Disponible',
  semi_acordado:'Semi-acordado',
  acordado:     'Acordado',
  perdido:      'Perdido',
  descartado:   'Descartado',
  // legacy
  semi_cerrado: 'Semi-acordado',
  cerrado:      'Acordado',
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
  if (!arr.length) return '<div class="am-detail-empty">Sin visitas registradas</div>';
  const rows = arr.slice(0, 3).map((v) => {
    const code = v.centroCodigo || (v.centroId ? centroCodigoById(v.centroId) : '') || '-';
    const fechaStr = (v.fecha ? String(v.fecha).slice(0,10) : '');
    const estado = String(v.estado || '-');
    const obs = String(v.observaciones || '').trim();
    const tons = (v.tonsComprometidas != null && v.tonsComprometidas !== '')
      ? `${Number(v.tonsComprometidas).toLocaleString('es-CL', { maximumFractionDigits: 2 })} t`
      : '';
    return `
      <div class="am-visit-row">
        <div class="am-visit-top">
          <span class="am-visit-date">${esc(fechaStr || '-')}</span>
          <span class="am-pill am-pill-soft">${esc(code)}</span>
          <span class="am-pill am-pill-soft">${esc(estado)}</span>
        </div>
        ${tons || obs ? `<div class="am-visit-sub">${tons ? `<strong>${esc(tons)}</strong>` : ''}${tons && obs ? ' · ' : ''}${obs ? esc(obs) : ''}</div>` : ''}
      </div>
    `.trim();
  }).join('');
  return `<div class="am-visit-list">${rows}</div>`;
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

const ESTADO_COLOR = {
  disponible:   '#3b82f6',
  semi_acordado:'#f59e0b',
  acordado:     '#16a34a',
  // legacy
  semi_cerrado: '#f59e0b',
  cerrado:      '#16a34a',
  perdido:      '#ef4444',
  descartado:   '#94a3b8',
};
const ESTADO_LABEL_COMPRAS = {
  disponible:   'Disponible',
  semi_acordado:'Semi-acordado',
  acordado:     'Acordado',
  // legacy
  semi_cerrado: 'Semi-acordado',
  cerrado:      'Acordado',
  perdido:      'Perdido',
  descartado:   'Descartado',
};

function renderOportunidades(list, historialMap){
  if (!list || !list.length) return `
    <div style="display:flex;align-items:center;gap:8px;color:#94a3b8;font-size:13px;">
      <span>Sin registro en Compras</span>
      <a href="#compras" style="color:#3b82f6;font-weight:600;font-size:12px;">Ver tablero →</a>
    </div>`;
  const rows = list.map(o => {
    const id = (o._id || o.id || '');
    const estadoRaw = o.estado || 'disponible';
    const estado = (estadoRaw === 'semi_cerrado') ? 'semi_acordado'
      : (estadoRaw === 'cerrado') ? 'acordado'
      : estadoRaw;
    const isTerminal = ['acordado','perdido','descartado'].includes(estado);
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

    const color = ESTADO_COLOR[estado] || '#94a3b8';
    const labelCompras = ESTADO_LABEL_COMPRAS[estado] || estado;
    const ultimaAct = o.ultimaActividadAt ? fmtISOfechaHora(o.ultimaActividadAt) : '';

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></span>
          <div style="min-width:0;">
            <span style="font-weight:700;font-size:13px;color:${color};">${esc(labelCompras)}</span>
            ${biomasa ? `<span class="text-soft" style="font-size:12px;margin-left:8px;">${esc(biomasa)}</span>` : ''}
            ${ultimaAct ? `<div class="text-soft" style="font-size:11px;margin-top:2px;">Ultima actividad: ${esc(ultimaAct)}</div>` : ''}
          </div>
        </div>
        <a href="#compras" style="color:#3b82f6;font-size:12px;font-weight:600;white-space:nowrap;">Ver en Compras →</a>
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
  // Los estados se gestionan desde el tablero de Compras (#compras).
  // El panel de contacto solo muestra lectura — sin acciones JS aquí.
}

export async function abrirDetalleContacto(c) {
  const body = $('#detalleContactoBody'); if (!body) return;
  state.detalleContacto = c;

  const fechaFmt = fmtISOfechaHora(c.createdAt || c.fecha || Date.now());
  const comunas = comunasDelProveedor(c.proveedorKey || slug(c.proveedorNombre||''));
  const chips = comunas.length
    ? comunas.map(x => `<span class="am-pill am-pill-soft">${esc(x)}</span>`).join('')
    : '<span class="am-detail-empty">Sin centros asociados</span>';

  let visitas = [];
  try { visitas = await apiGetVisitasByContacto(c._id) || []; } catch {}

  const proveedor = c.proveedorNombre || '';
  const proveedorKey = c.proveedorKey || (c.proveedorNombre ? slug(c.proveedorNombre) : '');
  const centro = c.centroCodigo || '-';
  const comuna = c.centroComuna || comunaPorCodigo(c.centroCodigo) || '-';
  const responsable = c.responsablePG || '';

  const contactoNombre = c.contactoNombre || '';
  const contactoTelefono = c.contactoTelefono || '';
  const contactoEmail = c.contactoEmail || '';
  const localidad = c.localidad || '';

  const proxPaso = c.proximoPaso || '';
  const proxFecha = c.proximoPasoFecha ? fmtISOfecha(c.proximoPasoFecha) : '';

  const obs = c.vendeActualmenteA || '';
  const notas = c.notas || '';

  const esNuevo = !!c.proveedorNuevo;
  const hasBio = String(c.biomasa || '').toLowerCase().includes('con') || String(c.tieneMMPP || '').toUpperCase() === 'S';

  body.innerHTML = `
    <div class="am-detail-section">
      <div class="am-detail-title">Comunas con centros del proveedor</div>
      <div class="am-detail-chips">${chips}</div>
    </div>

    <div class="am-detail-section">
      <div class="am-detail-title">Proveedor</div>
      <div class="am-detail-card">
        <div class="am-detail-grid">
          <div class="am-detail-field"><div class="am-detail-label">Fecha registro</div><div class="am-detail-value">${esc(fechaFmt)}</div></div>
          <div class="am-detail-field"><div class="am-detail-label">Proveedor</div><div class="am-detail-value">${esc(proveedor || proveedorKey || '—')}</div></div>
          <div class="am-detail-field"><div class="am-detail-label">Centro</div><div class="am-detail-value">${esc(centro)}</div></div>
          <div class="am-detail-field"><div class="am-detail-label">Comuna</div><div class="am-detail-value">${esc(comuna)}</div></div>
          <div class="am-detail-field"><div class="am-detail-label">Responsable</div><div class="am-detail-value">${esc(responsable || '—')}</div></div>
          <div class="am-detail-field">
            <div class="am-detail-label">Etiquetas</div>
            <div class="am-detail-value">
              ${esNuevo ? '<span class="am-pill am-pill-warn">Proveedor nuevo</span>' : ''}
              ${hasBio ? '<span class="am-pill am-pill-ok">Con biomasa</span>' : '<span class="am-pill am-pill-soft">Sin biomasa</span>'}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="am-detail-section">
      <div class="am-detail-title">Contacto</div>
      <div class="am-detail-card">
        <div class="am-detail-grid">
          <div class="am-detail-field"><div class="am-detail-label">Nombre</div><div class="am-detail-value">${esc(contactoNombre || '—')}</div></div>
          <div class="am-detail-field"><div class="am-detail-label">Teléfono</div><div class="am-detail-value">${esc(contactoTelefono || '—')}</div></div>
          <div class="am-detail-field"><div class="am-detail-label">Email</div><div class="am-detail-value">${esc(contactoEmail || '—')}</div></div>
          <div class="am-detail-field"><div class="am-detail-label">Localidad</div><div class="am-detail-value">${esc(localidad || '—')}</div></div>
        </div>
      </div>
    </div>

    <div class="am-detail-section">
      <div class="am-detail-title">Gestión</div>
      <div class="am-detail-card">
        <div class="am-detail-grid">
          <div class="am-detail-field"><div class="am-detail-label">Próximo paso</div><div class="am-detail-value">${esc(proxPaso || '—')}</div></div>
          <div class="am-detail-field"><div class="am-detail-label">Fecha próximo paso</div><div class="am-detail-value">${esc(proxFecha || '—')}</div></div>
          <div class="am-detail-field am-detail-full"><div class="am-detail-label">Observaciones y acuerdos</div><div class="am-detail-value">${obs ? esc(obs) : '<span class="am-detail-empty">—</span>'}</div></div>
          <div class="am-detail-field am-detail-full"><div class="am-detail-label">Notas</div><div class="am-detail-value">${notas ? esc(notas) : '<span class="am-detail-empty">Sin notas</span>'}</div></div>
        </div>
      </div>
    </div>

    <div class="am-detail-section">
      <div class="am-detail-title">Disponibilidad registrada</div>
      <div id="detalleAsignacionesTable" class="am-detail-card">
        <span class="am-detail-empty">Cargando disponibilidad...</span>
      </div>
    </div>

    <div class="am-detail-section">
      <div class="am-detail-title">Estado en compras</div>
      <div id="oportunidadesList" class="am-detail-card">
        <span class="am-detail-empty">Cargando...</span>
      </div>
    </div>

    <div class="am-detail-section">
      <div class="am-detail-title">Últimas visitas</div>
      <div class="am-detail-card">
        ${miniTimelineHTML(visitas)}
      </div>
    </div>
  `;

  try {
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
  await cargarOportunidadesDetalle(c);

  const btnNV = document.getElementById('btnDetalleNuevaVisita');
  if (btnNV) {
    btnNV.onclick = () => abrirModalVisita(c);
    btnNV.style.display = '';
  }

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
      toast('No hay ID válido para esta fila', { variant: 'error' });
      return;
    }

    if (btn.classList.contains('mini-del')) {
      const ok = await askDeleteDisponibilidad('Eliminar disponibilidad', '¿Eliminar esta disponibilidad?', 'Eliminar');
      if (!ok) return;
      try {
        await deleteDisponibilidad(id);
        const c = state.editingContacto || state.contactoActual || {};
        await pintarHistorialEdicion(c);
        toast('Disponibilidad eliminada', { variant: 'success' });
      } catch (err) {
        try { console.error(err); } catch(_) {}
        toast('No se pudo eliminar', { variant: 'error' });
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
      toast('Editando disponibilidad: recuerda presionar Guardar', { durationMs: 2200 });
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
      toast('Ingresa una empresa o una persona (nombre + teléfono o email).', { variant: 'error', durationMs: 2800 });
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
          toast('Disponibilidad actualizada', { variant: 'success' });
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
          toast('Disponibilidad registrada', { variant: 'success' });
        }
      }

      await cargarContactosGuardados();
      renderTablaContactos();
      document.dispatchEvent(new Event('reload-tabla-contactos'));

      const c = state.editId
        ? { _id: state.editId, proveedorKey, proveedorNombre, centroId }
        : (state.contactoActual || {});
      await pintarHistorialEdicion({ ...c, _id: (state.editId || contactoIdDoc) });

      toast(state.editId ? 'Contacto actualizado' : 'Contacto guardado', { variant: 'success', durationMs: 2000 });

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

      if (modalInst && typeof modalInst.close === 'function') {
        modalInst.close();
      }
    } catch (err) {
      var msg = (err && (err.message || err)) || 'Error desconocido';
      try { console.error('[form-contacto] ERROR:', msg); } catch (_) {}
      toast('Error al guardar contacto', { variant: 'error', durationMs: 2500 });
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
    toast('Contacto ya no existe', { variant: 'success' });
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
      toast('No se pudo eliminar', { variant: 'error' });
      return;
    }
  }

  await cargarContactosGuardados();
  renderTablaContactos();
  document.dispatchEvent(new Event('reload-tabla-contactos'));
  toast('Contacto eliminado', { variant: 'success', durationMs: 1800 });
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
  if (box) box.innerHTML = '<span class="am-muted">Sin disponibilidades registradas.</span>';
  const respEl = document.getElementById('contactoResponsable'); if (respEl) respEl.value = '';
}
