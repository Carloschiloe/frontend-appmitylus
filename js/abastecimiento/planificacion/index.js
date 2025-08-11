// /js/abastecimiento/planificacion/index.js

// Puedes usar tus APIs reales cuando estén listas:
import { apiGetCentros /*, apiGetContactos */ } from '/js/core/api.js';

/* =========================================
   STATE
========================================= */
const state = {
  centros: [],           // [{_id, proveedor, code, comuna, ...}]
  proveedores: [],       // ['Proveedor A', 'Proveedor B', ...]
  bloques: [],           // [{ _id, fecha:'YYYY-MM-DD', proveedor, centro, tons, estado, prioridad, origen, notas, escenario }]
  filtros: {
    semana: null,        // 'YYYY-Www'
    escenario: 'base',
    texto: '',
    soloConfirmado: false,
    ocultarCancelados: true,
  },
  params: {
    objetivo: 400,       // t/semana
    lead: 7,
    buffer: 2,
  },
  editingId: null,       // _id en edición (modal)
};

const LS_KEYS = {
  BLOQUES: 'plan_bloques_v1',
  PARAMS:  'plan_params_v1',
};

/* =========================================
   INIT
========================================= */
let _initialized = false;
export async function init() {
  if (_initialized) return;
  await cargarCentros();
  cargarDesdeStorage();
  prepararUI();
  poblarProveedoresYCentros();
  setDefaultWeekIfNeeded();
  render();
  _initialized = true;
}

// auto-init si se importa directo
init().catch(console.error);

/* =========================================
   LOADERS
========================================= */
async function cargarCentros() {
  try {
    const arr = await apiGetCentros();
    state.centros = Array.isArray(arr) ? arr : (arr.items || arr.data || []);
    // normaliza proveedor strings vacíos
    state.centros.forEach(c => { if (!c.proveedor) c.proveedor = ''; });
    // lista de proveedores únicos (limpio y ordenado)
    const setp = new Set(state.centros.map(c => (c.proveedor || '').trim()).filter(Boolean));
    state.proveedores = Array.from(setp).sort((a,b)=>a.localeCompare(b));
  } catch (e) {
    console.error('[plan] apiGetCentros error', e);
    state.centros = []; state.proveedores = [];
  }
}

function cargarDesdeStorage() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEYS.BLOQUES) || '[]');
    state.bloques = Array.isArray(raw) ? raw : [];
  } catch { state.bloques = []; }

  try {
    const p = JSON.parse(localStorage.getItem(LS_KEYS.PARAMS) || '{}');
    state.params = { ...state.params, ...p };
  } catch {}
}

function guardarBloques() {
  localStorage.setItem(LS_KEYS.BLOQUES, JSON.stringify(state.bloques));
}
function guardarParams() {
  localStorage.setItem(LS_KEYS.PARAMS, JSON.stringify(state.params));
}

/* =========================================
   UI WIRING
========================================= */
function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

function prepararUI() {
  // Params → inputs
  setVal('#p_objetivo', state.params.objetivo);
  setVal('#p_lead', state.params.lead);
  setVal('#p_buffer', state.params.buffer);

  // Filtros
  const semana = $('#f_semana');
  const escenario = $('#f_escenario');
  const buscar = $('#f_buscar');
  const soloConf = $('#f_soloConfirmado');
  const ocCanc = $('#f_ocultarCancelados');

  semana?.addEventListener('change', () => { state.filtros.semana = semana.value || null; render(); });
  escenario?.addEventListener('change', () => { state.filtros.escenario = escenario.value || 'base'; render(); });

  let tmr = null;
  buscar?.addEventListener('input', () => {
    clearTimeout(tmr);
    tmr = setTimeout(()=>{ state.filtros.texto = (buscar.value||'').trim().toLowerCase(); render(); }, 180);
  });
  soloConf?.addEventListener('change', () => { state.filtros.soloConfirmado = !!soloConf.checked; render(); });
  ocCanc?.addEventListener('change', () => { state.filtros.ocultarCancelados = !!ocCanc.checked; render(); });

  // Guardar parámetros
  $('#btnGuardarParametros')?.addEventListener('click', () => {
    state.params.objetivo = num('#p_objetivo', 400);
    state.params.lead = num('#p_lead', 7);
    state.params.buffer = num('#p_buffer', 2);
    guardarParams();
    M.toast?.({ html:'Parámetros guardados', classes:'teal', displayLength:1500 });
    render();
  });

  // Form modal (crear/editar)
  const form = $('#formBloque');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const payload = leerFormBloque();
    if (!payload.fecha || !payload.proveedor || !isFinite(payload.tons)) {
      M.toast?.({ html:'Completa fecha, proveedor y toneladas', displayLength:1800 }); return;
    }
    // escenario actual
    payload.escenario = state.filtros.escenario || 'base';

    if (state.editingId) {
      // update
      const idx = state.bloques.findIndex(b => b._id === state.editingId);
      if (idx >= 0) state.bloques[idx] = { ...state.bloques[idx], ...payload };
      state.editingId = null;
      M.toast?.({ html:'Bloque actualizado', classes:'teal' });
    } else {
      // create
      payload._id = uid();
      state.bloques.push(payload);
      M.toast?.({ html:'Bloque agregado', classes:'teal' });
    }

    guardarBloques();
    cerrarModalBloque();
    form.reset();
    render();
  });

  // Tabla: editar/eliminar (delegación)
  const jq = window.jQuery || window.$;
  jq('#tablaProgramaSemanal tbody')
    .on('click', 'a.icon-action.editar', function(){
      const id = this.dataset.id || '';
      const b = state.bloques.find(x => String(x._id) === String(id));
      if (b) abrirModalEditar(b);
    })
    .on('click', 'a.icon-action.eliminar', function(){
      const id = this.dataset.id || '';
      if (!confirm('¿Eliminar este bloque?')) return;
      state.bloques = state.bloques.filter(x => String(x._id) !== String(id));
      guardarBloques();
      render();
      M.toast?.({ html:'Eliminado', displayLength:1200 });
    });
}

function poblarProveedoresYCentros() {
  // Datalist proveedores
  const dl = $('#dl_proveedores');
  if (dl) {
    dl.innerHTML = state.proveedores.map(p => `<option value="${escapeHtml(p)}"></option>`).join('');
  }
  // Select centros
  const sel = $('#b_centro');
  if (sel) {
    let opts = `<option value="">Centro (opcional)</option>`;
    opts += state.centros
      .slice()
      .sort((a,b)=>(a.code||'').localeCompare(b.code||''))
      .map(c => `<option value="${escapeHtml(c.code||'')}">${escapeHtml((c.code||'') + (c.comuna? ' – '+c.comuna:''))}</option>`)
      .join('');
    sel.innerHTML = opts;
  }
}

function setDefaultWeekIfNeeded() {
  const el = $('#f_semana');
  if (!el) return;
  if (!el.value) {
    el.value = isoWeekString(new Date());
    state.filtros.semana = el.value;
  } else {
    state.filtros.semana = el.value;
  }
}

/* =========================================
   RENDER (tabla + KPIs + charts via window.planSetData)
========================================= */
function render() {
  const semana = state.filtros.semana;
  const rango = semana ? isoWeekRange(semana) : null;

  // Filtra por semana + escenario
  let rows = state.bloques.filter(b => {
    if (b.escenario && b.escenario !== state.filtros.escenario) return false;
    if (!rango) return true;
    return inRange(b.fecha, rango.start, rango.end);
  });

  // Filtros toggles
  if (state.filtros.soloConfirmado) {
    rows = rows.filter(b => b.estado === 'Confirmado');
  }
  if (state.filtros.ocultarCancelados) {
    rows = rows.filter(b => b.estado !== 'Cancelado');
  }

  // Filtro texto
  const q = (state.filtros.texto || '').toLowerCase();
  if (q) {
    rows = rows.filter(b =>
      (b.proveedor||'').toLowerCase().includes(q) ||
      (b.centro||'').toLowerCase().includes(q) ||
      (b.notas||'').toLowerCase().includes(q)
    );
  }

  // Orden por fecha asc
  rows.sort((a,b)=> (a.fecha||'').localeCompare(b.fecha||''));

  // KPIs
  const meta = number(state.params.objetivo);
  const plan = sumTons(state.bloques.filter(b =>
    (!semana || inRange(b.fecha, rango.start, rango.end)) &&
    (b.escenario === (state.filtros.escenario||'base')) &&
    (b.estado !== 'Cancelado')
  ));
  const confirmado = sumTons(state.bloques.filter(b =>
    (!semana || inRange(b.fecha, rango.start, rango.end)) &&
    (b.escenario === (state.filtros.escenario||'base')) &&
    (b.estado === 'Confirmado')
  ));
  const cumplimiento = meta ? Math.round(Math.min(100, (confirmado/meta)*100)) : 0;

  // Series por día (de los visibles no cancelados)
  const dias = agruparPorDia(
    rows.filter(b => b.estado !== 'Cancelado')
  );

  // Estados (tons)
  const estados = [
    { label:'Planificado', value: sumTons(rows.filter(b => b.estado==='Planificado')) },
    { label:'Confirmado',  value: sumTons(rows.filter(b => b.estado==='Confirmado')) },
    { label:'Cancelado',   value: sumTons(rows.filter(b => b.estado==='Cancelado')) },
  ];

  // Mapea a lo que espera la tabla
  const semanal = rows.map(b => ({
    _id: b._id,
    fecha: b.fecha,
    proveedor: b.proveedor,
    centro: b.centro || '',
    tons: number(b.tons),
    estado: b.estado,
    prioridad: b.prioridad || '',
    origen: b.origen || 'Manual',
    notas: b.notas || '',
  }));

  // Empuja todo al hook global que definimos en el HTML
  window.planSetData?.({
    kpis: { meta, plan, confirmado, cumplimiento },
    semanal,
    dias,     // [{label:'Lun', tons: 120}, ...]
    estados,  // [{label:'Planificado', value: X}, ...]
  });
}

/* =========================================
   FORM MODAL (crear/editar)
========================================= */
function leerFormBloque() {
  return {
    fecha: val('#b_fecha').slice(0,10),
    proveedor: val('#b_proveedor').trim(),
    centro: val('#b_centro') || '',
    tons: number(val('#b_tons')),
    estado: val('#b_estado') || 'Planificado',
    prioridad: val('#b_prioridad') || 'Media',
    origen: 'Manual',
    notas: val('#b_notas') || '',
  };
}
function abrirModalEditar(b) {
  state.editingId = b._id;
  setVal('#b_fecha', b.fecha?.slice(0,10) || '');
  setVal('#b_proveedor', b.proveedor || '');
  setVal('#b_centro', b.centro || '');
  setVal('#b_tons', b.tons ?? '');
  setVal('#b_estado', b.estado || 'Planificado');
  setVal('#b_prioridad', b.prioridad || 'Media');
  setVal('#b_notas', b.notas || '');
  M.updateTextFields?.();
  const modal = M.Modal.getInstance(document.getElementById('modalBloque')) || M.Modal.init(document.getElementById('modalBloque'));
  modal.open();
}
function cerrarModalBloque() {
  const modal = M.Modal.getInstance(document.getElementById('modalBloque'));
  modal?.close();
}

/* =========================================
   HELPERS
========================================= */
function val(sel){ return ($(sel)?.value) ?? ''; }
function setVal(sel, v){ const el = $(sel); if (el){ el.value = v ?? ''; } }
function num(sel, def=0){ const n = Number(val(sel)); return Number.isFinite(n) ? n : def; }
function number(n){ const x = Number(n); return Number.isFinite(x) ? x : 0; }
function uid(){ return (Date.now().toString(36) + Math.random().toString(36).slice(2,8)); }
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function isoWeekString(d) {
  const dt = new Date(d);
  dt.setHours(0,0,0,0);
  // ISO week: jueves define la semana
  dt.setDate(dt.getDate() + 4 - (dt.getDay() || 7));
  const year = dt.getFullYear();
  const start = new Date(year,0,1);
  const week = Math.ceil((((dt - start) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2,'0')}`;
}
function isoWeekRange(weekStr) {
  // 'YYYY-Www' → lunes/domingo
  const [y, w] = weekStr.split('-W');
  const year = Number(y);
  const week = Number(w);
  // lunes de esa ISO semana:
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dayOfWeek = simple.getDay(); // 0 dom ... 6 sab
  const ISOweekStart = new Date(simple);
  if (dayOfWeek <= 4) {
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }
  const ISOweekEnd = new Date(ISOweekStart);
  ISOweekEnd.setDate(ISOweekStart.getDate() + 6);

  const start = fmtDate(ISOweekStart);
  const end = fmtDate(ISOweekEnd);
  return { start, end };
}
function fmtDate(d) {
  const f = new Date(d);
  const y = f.getFullYear();
  const m = String(f.getMonth()+1).padStart(2,'0');
  const dd = String(f.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function inRange(yyyy_mm_dd, start, end) {
  return yyyy_mm_dd >= start && yyyy_mm_dd <= end;
}
function sumTons(arr){ return Math.round((arr.reduce((a,b)=>a + (Number(b.tons)||0), 0)) * 100) / 100; }
function agruparPorDia(rows) {
  const map = new Map(); // 'YYYY-MM-DD' -> tons
  rows.forEach(b => {
    if (!b.fecha) return;
    map.set(b.fecha, (map.get(b.fecha)||0) + (Number(b.tons)||0));
  });
  const fechas = Array.from(map.keys()).sort();
  // Etiquetas legibles: Lun, Mar, ...
  const labels = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  return fechas.map(f => {
    const d = new Date(f);
    return { label: labels[d.getDay()], tons: Math.round(map.get(f)*100)/100 };
  });
}

/* =========================================
   EXTRAS (semilla opcional para probar)
========================================= */
// Si no hay bloques, puedes descomentar para ver algo:
// if (!state.bloques.length) {
//   const today = fmtDate(new Date());
//   state.bloques = [
//     { _id: uid(), fecha: today, proveedor:'Proveedor Demo', centro:'104123', tons:120, estado:'Planificado', prioridad:'Media', origen:'Manual', notas:'', escenario:'base' },
//   ];
//   guardarBloques();
// }
