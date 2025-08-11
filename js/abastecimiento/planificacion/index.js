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
    vista: 'semana',     // 'semana' | 'mes' | 'anio'
    semana: null,        // 'YYYY-Www'
    mes: null,           // 'YYYY-MM'
    anio: null,          // 'YYYY'
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
  FILTROS: 'plan_filtros_v1'
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
  setDefaultPeriodIfNeeded();
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
    state.centros.forEach(c => { if (!c.proveedor) c.proveedor = ''; });
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

  try {
    const f = JSON.parse(localStorage.getItem(LS_KEYS.FILTROS) || '{}');
    state.filtros = { ...state.filtros, ...f };
  } catch {}
}

function guardarBloques() {
  localStorage.setItem(LS_KEYS.BLOQUES, JSON.stringify(state.bloques));
}
function guardarParams() {
  localStorage.setItem(LS_KEYS.PARAMS, JSON.stringify(state.params));
}
function guardarFiltros() {
  localStorage.setItem(LS_KEYS.FILTROS, JSON.stringify({
    vista: state.filtros.vista,
    semana: state.filtros.semana,
    mes: state.filtros.mes,
    anio: state.filtros.anio,
    escenario: state.filtros.escenario
  }));
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

  // Filtros básicos
  const semana = $('#f_semana');
  const mes    = $('#f_mes');
  const anio   = $('#f_anio');
  const vista  = $('#f_vista');
  const escenario = $('#f_escenario');
  const buscar = $('#f_buscar');
  const soloConf = $('#f_soloConfirmado');
  const ocCanc = $('#f_ocultarCancelados');

  // Eventos de periodo
  semana?.addEventListener('change', () => { state.filtros.semana = semana.value || null; guardarFiltros(); render(); });
  mes?.addEventListener('change',    () => { state.filtros.mes    = mes.value || null;    guardarFiltros(); render(); });
  anio?.addEventListener('change',   () => { state.filtros.anio   = clampAnio(anio.value); setVal('#f_anio', state.filtros.anio); guardarFiltros(); render(); });

  // Vista
  vista?.addEventListener('change', () => {
    state.filtros.vista = vista.value || 'semana';
    toggleVistaUI();
    setDefaultPeriodIfNeeded();
    guardarFiltros();
    render();
  });

  // Navegación de periodo
  $('#btnPrevPeriodo')?.addEventListener('click', () => { navigatePeriodo(-1); });
  $('#btnNextPeriodo')?.addEventListener('click', () => { navigatePeriodo(+1); });

  // Escenario
  escenario?.addEventListener('change', () => { state.filtros.escenario = escenario.value || 'base'; guardarFiltros(); render(); });

  // Búsqueda
  let tmr = null;
  buscar?.addEventListener('input', () => {
    clearTimeout(tmr);
    tmr = setTimeout(()=>{ state.filtros.texto = (buscar.value||'').trim().toLowerCase(); render(); }, 180);
  });

  // Toggles
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
    payload.escenario = state.filtros.escenario || 'base';

    if (state.editingId) {
      const idx = state.bloques.findIndex(b => b._id === state.editingId);
      if (idx >= 0) state.bloques[idx] = { ...state.bloques[idx], ...payload };
      state.editingId = null;
      M.toast?.({ html:'Bloque actualizado', classes:'teal' });
    } else {
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

  // Pinta UI inicial de vista/periodos
  toggleVistaUI();
}

function toggleVistaUI(){
  const v = state.filtros.vista || 'semana';
  const wrapSemana = $('#wrap_semana');
  const wrapMes    = $('#wrap_mes');
  const wrapAnio   = $('#wrap_anio');

  wrapSemana?.classList.toggle('hidden', v !== 'semana');
  wrapMes?.classList.toggle('hidden',    v !== 'mes');
  wrapAnio?.classList.toggle('hidden',   v !== 'anio');
}

function navigatePeriodo(delta){
  const v = state.filtros.vista || 'semana';
  if (v === 'semana') {
    const curr = state.filtros.semana || isoWeekString(new Date());
    const d = weekStrToDate(curr);
    d.setDate(d.getDate() + delta*7);
    const next = isoWeekString(d);
    if (yearFromWeekStr(next) > 2027) return;
    state.filtros.semana = next;
    setVal('#f_semana', next);
  } else if (v === 'mes') {
    const base = state.filtros.mes || fmtMonth(new Date());
    const [y,m] = base.split('-').map(Number);
    const d = new Date(y, m-1, 1);
    d.setMonth(d.getMonth() + delta);
    const y2 = d.getFullYear(), m2 = d.getMonth()+1;
    if (y2 > 2027) return;
    const next = `${y2}-${String(m2).padStart(2,'0')}`;
    state.filtros.mes = next;
    setVal('#f_mes', next);
  } else {
    let y = Number(state.filtros.anio || new Date().getFullYear());
    y = clampAnio(String(y + delta));
    state.filtros.anio = y;
    setVal('#f_anio', y);
  }
  guardarFiltros();
  render();
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

function setDefaultPeriodIfNeeded() {
  const v = state.filtros.vista || 'semana';
  if (v === 'semana') {
    if (!state.filtros.semana) state.filtros.semana = isoWeekString(new Date());
    setVal('#f_semana', state.filtros.semana);
  } else if (v === 'mes') {
    if (!state.filtros.mes) state.filtros.mes = fmtMonth(new Date());
    setVal('#f_mes', state.filtros.mes);
  } else {
    if (!state.filtros.anio) state.filtros.anio = String(new Date().getFullYear());
    setVal('#f_anio', state.filtros.anio);
  }
}

/* =========================================
   RENDER (tabla + KPIs + charts via window.planSetData)
========================================= */
function render() {
  const rango = getRangeFromFilters();
  const vista = state.filtros.vista || 'semana';

  // Filtra por rango + escenario
  let rows = state.bloques.filter(b => {
    if (b.escenario && b.escenario !== state.filtros.escenario) return false;
    if (!rango) return true;
    return inRange(b.fecha, rango.start, rango.end);
  });

  // Toggles
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

  // KPIs (meta escalada por duración del período)
  const metaSemana = number(state.params.objetivo);
  const durDias = rango ? diffDaysInclusive(rango.start, rango.end) : 7;
  const meta = Math.round(metaSemana * (durDias / 7)); // escala simple
  const plan = sumTons(state.bloques.filter(b =>
    (!rango || inRange(b.fecha, rango.start, rango.end)) &&
    (b.escenario === (state.filtros.escenario||'base')) &&
    (b.estado !== 'Cancelado')
  ));
  const confirmado = sumTons(state.bloques.filter(b =>
    (!rango || inRange(b.fecha, rango.start, rango.end)) &&
    (b.escenario === (state.filtros.escenario||'base')) &&
    (b.estado === 'Confirmado')
  ));
  const cumplimiento = meta ? Math.round(Math.min(100, (confirmado/meta)*100)) : 0;

  // Series "dias" (según vista)
  let dias = [];
  let labelDias = 'Tons por día (semana)';
  if (vista === 'semana') {
    dias = agruparPorDia(rows.filter(b => b.estado !== 'Cancelado'));
    labelDias = 'Tons por día (semana)';
  } else if (vista === 'mes') {
    dias = agruparPorSemana(rows.filter(b => b.estado !== 'Cancelado'));
    labelDias = 'Tons por semana (mes)';
  } else {
    dias = agruparPorMes(rows.filter(b => b.estado !== 'Cancelado'));
    labelDias = 'Tons por mes (año)';
  }

  // Estados (tons)
  const estados = [
    { label:'Planificado', value: sumTons(rows.filter(b => b.estado==='Planificado')) },
    { label:'Confirmado',  value: sumTons(rows.filter(b => b.estado==='Confirmado')) },
    { label:'Cancelado',   value: sumTons(rows.filter(b => b.estado==='Cancelado')) },
  ];

  // Tabla
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

  // Empuja al hook global en el HTML
  window.planSetData?.({
    kpis: { meta, plan, confirmado, cumplimiento },
    semanal,
    dias,       // array { label, tons }
    estados,    // array { label, value }
    labelDias
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

function clampAnio(y){
  let n = Number(String(y).replace(/\D/g,'')) || new Date().getFullYear();
  if (n < 2020) n = 2020;
  if (n > 2027) n = 2027;
  return String(n);
}

function isoWeekString(d) {
  const dt = new Date(d);
  dt.setHours(0,0,0,0);
  dt.setDate(dt.getDate() + 4 - (dt.getDay() || 7));
  const year = dt.getFullYear();
  const start = new Date(year,0,1);
  const week = Math.ceil((((dt - start) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2,'0')}`;
}
function yearFromWeekStr(ws){ return Number(ws.split('-W')[0] || new Date().getFullYear()); }
function weekStrToDate(ws){
  const { start } = isoWeekRange(ws);
  return new Date(start);
}
function isoWeekRange(weekStr) {
  const [y, w] = weekStr.split('-W');
  const year = Number(y);
  const week = Number(w);
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dayOfWeek = simple.getDay();
  const ISOweekStart = new Date(simple);
  if (dayOfWeek <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  const ISOweekEnd = new Date(ISOweekStart);
  ISOweekEnd.setDate(ISOweekStart.getDate() + 6);
  return { start: fmtDate(ISOweekStart), end: fmtDate(ISOweekEnd) };
}
function monthRange(yyyy_mm){
  const [y,m] = (yyyy_mm||'').split('-').map(Number);
  const d1 = new Date(y, (m||1)-1, 1);
  const d2 = new Date(y, (m||1), 0);
  return { start: fmtDate(d1), end: fmtDate(d2) };
}
function yearRange(yyyy){
  const y = Number(yyyy)||new Date().getFullYear();
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}
function fmtDate(d) {
  const f = new Date(d);
  const y = f.getFullYear();
  const m = String(f.getMonth()+1).padStart(2,'0');
  const dd = String(f.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function fmtMonth(d){
  const f = new Date(d);
  return `${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,'0')}`;
}
function inRange(yyyy_mm_dd, start, end) {
  return yyyy_mm_dd >= start && yyyy_mm_dd <= end;
}
function diffDaysInclusive(a,b){
  const d1 = new Date(a+'T00:00:00'); const d2 = new Date(b+'T00:00:00');
  return Math.floor((d2 - d1)/86400000) + 1;
}
function sumTons(arr){ return Math.round((arr.reduce((x,b)=>x + (Number(b.tons)||0), 0)) * 100) / 100; }

function getRangeFromFilters(){
  const v = state.filtros.vista || 'semana';
  if (v === 'semana') return isoWeekRange(state.filtros.semana || isoWeekString(new Date()));
  if (v === 'mes')    return monthRange(state.filtros.mes || fmtMonth(new Date()));
  return yearRange(state.filtros.anio || String(new Date().getFullYear()));
}

/* ---------- Agrupadores para el chart derecho ---------- */
function agruparPorDia(rows) {
  const map = new Map(); // 'YYYY-MM-DD' -> tons
  rows.forEach(b => {
    if (!b.fecha) return;
    map.set(b.fecha, (map.get(b.fecha)||0) + (Number(b.tons)||0));
  });
  const fechas = Array.from(map.keys()).sort();
  const labels = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  return fechas.map(f => {
    const d = new Date(f);
    return { label: labels[d.getDay()], tons: Math.round(map.get(f)*100)/100 };
  });
}
function agruparPorSemana(rows){
  // usa ISO week dentro del mes actual (o rango)
  const rango = getRangeFromFilters();
  const map = new Map(); // 'YYYY-Www' -> tons
  rows.forEach(b => {
    if (!b.fecha) return;
    if (!inRange(b.fecha, rango.start, rango.end)) return;
    const ws = isoWeekString(new Date(b.fecha));
    map.set(ws, (map.get(ws)||0) + (Number(b.tons)||0));
  });
  const keys = Array.from(map.keys()).sort();
  return keys.map(ws => ({ label: 'Sem ' + ws.split('-W')[1], tons: Math.round(map.get(ws)*100)/100 }));
}
function agruparPorMes(rows){
  const map = new Map(); // 'YYYY-MM' -> tons
  rows.forEach(b => {
    if (!b.fecha) return;
    const ym = b.fecha.slice(0,7);
    map.set(ym, (map.get(ym)||0) + (Number(b.tons)||0));
  });
  const mesesEs = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const keys = Array.from(map.keys()).sort();
  return keys.map(ym => {
    const [y,m] = ym.split('-').map(Number);
    return { label: mesesEs[(m-1)%12], tons: Math.round(map.get(ym)*100)/100 };
  });
}

/* =========================================
   EXTRAS (semilla opcional para probar)
// if (!state.bloques.length) {
//   const today = fmtDate(new Date());
//   state.bloques = [
//     { _id: uid(), fecha: today, proveedor:'Proveedor Demo', centro:'104123', tons:120, estado:'Planificado', prioridad:'Media', origen:'Manual', notas:'', escenario:'base' },
//   ];
//   guardarBloques();
// }
========================================= */
