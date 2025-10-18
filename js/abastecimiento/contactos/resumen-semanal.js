// /js/abastecimiento/contactos/resumen-semanal.js
import { state, $ } from './state.js';
import { getAll as getAllVisitas } from '../visitas/api.js';
import { normalizeVisita } from '../visitas/normalizers.js';

/* ================== estilos inyectados del módulo ================== */
(function injectResumenStyles(){
  const ID = 'resumen-semanal-styles';
  if (document.getElementById(ID)) return;
  const s = document.createElement('style');
  s.id = ID;
  s.textContent = `
    #tab-resumen{ padding: 8px 4px 24px; }
    #tab-resumen h5{ font-weight:600; letter-spacing:.2px; }

    .resumen-toolbar{ display:flex; gap:12px; align-items:center; justify-content:space-between; margin:8px 0 16px; flex-wrap:wrap; }
    .view-switch{ display:inline-flex; gap:6px; border:1px solid #e5e7eb; border-radius:10px; padding:4px; background:#fff; }
    .view-switch button{ border:0; background:transparent; padding:6px 10px; border-radius:8px; font-weight:700; color:#64748b; cursor:pointer }
    .view-switch button.is-active{ background:#eef2ff; color:#111827; }

    .kpi-row{ display:grid; grid-template-columns: repeat(12, 1fr); gap:12px; margin-top:6px; }
    .kpi{ grid-column: span 12; border:1px solid #e5e7eb; border-radius:14px; background:#fff; padding:14px 16px; min-height:92px; display:flex; flex-direction:column; justify-content:center }
    .kpi small{ color:#6b7280; font-weight:600; text-transform:uppercase; letter-spacing:.5px; }
    .kpi h4{ margin:6px 0 0; font-size:26px; line-height:1.1; font-weight:700; color:#111827 }
    @media (min-width:600px){ .kpi{ grid-column: span 6; } }
    @media (min-width:992px){ .kpi{ grid-column: span 3; } }

    /* tabla print area */
    #resumen_print_area table.striped thead th{
      font-size:12px; color:#6b7280; font-weight:600; border-bottom:1px solid #e5e7eb;
    }
    #resumen_print_area table.striped tbody td{ padding:10px 12px; vertical-align:middle; }
    .subtle{ display:block; font-size:12px; color:#6b7280; margin-top:2px; }

    /* botones */
    #resumen_copy.btn-flat{ border:1px solid #e5e7eb; border-radius:10px; }
    #resumen_print.btn{ border-radius:10px; }

    /* print */
    @media print{
      nav, .tabs, .resumen-toolbar{ display:none !important; }
      body{ background:#fff !important; }
      #tab-resumen{ padding:0 }
      #resumen_print_area{ margin:0 }
      #resumen_print_area h5{ margin-top:0 }
    }
  `;
  document.head.appendChild(s);
})();

/* ================== utils / formato ================== */
const fmtInt = (n) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
const fmt2   = (n) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 });

function toDate(v){ try { return v ? (v instanceof Date ? v : new Date(v)) : null; } catch { return null; } }
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { year: d.getUTCFullYear(), week: Math.ceil((((d - yearStart)/86400000) + 1) / 7) };
}
function weekKeyFromDate(dt){ const {year, week} = isoWeek(dt); return `${year}-W${String(week).padStart(2,'0')}`; }
const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));

/* ================== cachés ================== */
let _cache = { allVisitas: [], visitasByWeek: new Map(), disponibilidades: [], dispoByProv: new Map() };
let _mode = 'contactos'; // 'contactos' | 'visitas'

/* ================== datos: visitas ================== */
async function ensureVisitas() {
  if (_cache.allVisitas.length) return;
  const raw = await getAllVisitas();
  const list = Array.isArray(raw) ? raw.map(normalizeVisita) : [];
  _cache.allVisitas = list;
  _cache.visitasByWeek = new Map();
  for (const v of list){
    const dt = toDate(v.fecha) || toDate(v.proximoPasoFecha);
    if (!dt) continue;
    const wk = weekKeyFromDate(dt);
    if (!_cache.visitasByWeek.has(wk)) _cache.visitasByWeek.set(wk, []);
    _cache.visitasByWeek.get(wk).push(v);
  }
}

/* ================== datos: disponibilidades ================== */
/* Fuente prioritaria:
   1) window.__resumenDisponibilidades (si la página la inyecta server-side)
   2) GET /api/disponibilidades  (ajusta a tu backend)
   3) vacío (si nada está disponible)
*/
async function ensureDisponibilidades() {
  if (_cache.disponibilidades.length) return;
  try {
    const injected = Array.isArray(window.__resumenDisponibilidades) ? window.__resumenDisponibilidades : null;
    if (injected) {
      _cache.disponibilidades = injected;
    } else {
      const resp = await fetch('/api/disponibilidades', { credentials:'include' });
      if (resp.ok) _cache.disponibilidades = await resp.json();
    }
  } catch {}
  _cache.disponibilidades = Array.isArray(_cache.disponibilidades) ? _cache.disponibilidades : [];

  // index por proveedorId (string) y por nombre (fallback)
  _cache.dispoByProv = new Map();
  for (const d of _cache.disponibilidades){
    const provId = d?.proveedorId?._id || d?.proveedorId?.$oid || d?.proveedorId || '';
    const provKey = provId || (d.proveedorKey || '').toLowerCase() || (d.proveedorNombre || '').toLowerCase();
    if (!provKey) continue;
    if (!_cache.dispoByProv.has(provKey)) _cache.dispoByProv.set(provKey, []);
    _cache.dispoByProv.get(provKey).push(d);
  }
}

/* Suma de toneladas para un proveedor (y opcional centro) desde el mes corriente en adelante */
function tonsDisponiblesFor({ proveedorId, proveedorNombre, centroCodigo }) {
  const now = new Date();
  const ymNow = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}`; // YYYY-MM
  const provKey = (proveedorId || '').toString()
    || (proveedorNombre || '').toLowerCase();

  const list =
    _cache.dispoByProv.get(provKey) ||
    _cache.dispoByProv.get((proveedorNombre || '').toLowerCase()) ||
    [];

  const filtered = list.filter(d => {
    const okMonth = (d.mesKey || '') >= ymNow;
    const okCentro = centroCodigo ? (String(d.centroCodigo || '') === String(centroCodigo)) : true;
    return okMonth && okCentro;
  });

  return filtered.reduce((acc, d) => acc + Number(d.tonsDisponible || 0), 0);
}

/* ================== opciones de semana ================== */
function buildSemanaOptions() {
  const sel = document.getElementById('resumen_semana');
  if (!sel) return;
  sel.innerHTML = '';

  // Semanas desde VISITAS y desde CONTACTOS (tabla principal)
  const weeks = new Set();

  // visitas indexadas
  for (const wk of _cache.visitasByWeek.keys()) weeks.add(wk);

  // contactos guardados en state
  const contactos = Array.isArray(state?.contactos) ? state.contactos : [];
  contactos.forEach(c => {
    const dt = toDate(c?.fecha || c?.createdAt);
    if (dt) weeks.add(weekKeyFromDate(dt));
  });

  const arr = Array.from(weeks).sort().reverse();
  for (const wk of arr){
    const opt = document.createElement('option');
    opt.value = wk; opt.textContent = wk;
    sel.appendChild(opt);
  }
  if (arr.length) sel.value = arr[0];
}

/* ================== agregados ================== */
function aggregateVisitasForWeek(wk){
  const visitas = _cache.visitasByWeek.get(wk) || [];
  const empresas = uniq(visitas.map(v => v.contacto?.empresaNombre || v.proveedorNombre || v.contacto?.nombre));
  const responsables = uniq(visitas.map(v => v.contacto?.responsable || v.responsable || v.creadoPor));
  const comunas = uniq(visitas.map(v => v.comuna || v.contacto?.comuna));
  const centros = uniq(visitas.map(v => String(v.centroCodigo || v.centroId || '')));
  const totalTons = visitas.reduce((a,v)=>a + Number(v.tonsComprometidas || 0), 0);
  return { visitas, empresas, responsables, comunas, centros, totalTons };
}

function aggregateContactosForWeek(wk){
  const contactos = (Array.isArray(state?.contactos) ? state.contactos : []).filter(c => {
    const dt = toDate(c?.fecha || c?.createdAt);
    return dt ? weekKeyFromDate(dt) === wk : false;
  });

  // armar filas enriquecidas con tons de disponibilidades
  const rows = contactos.map(c => {
    const proveedorId = c?.proveedorId?._id || c?.proveedorId || c?.proveedorKey || '';
    const proveedorNombre = c?.empresaNombre || c?.proveedorNombre || c?.contacto?.empresaNombre || c?.contacto?.nombre || '';
    const centroCodigo = c?.centroCodigo || c?.centro?.codigo || '';
    const tons = tonsDisponiblesFor({ proveedorId, proveedorNombre, centroCodigo });
    return { ...c, __tonsDisponible: tons };
  });

  const empresas = uniq(rows.map(r => r.empresaNombre || r.proveedorNombre));
  const comunas = uniq(rows.map(r => r.centroComuna || r.comuna || r.centro?.comuna));
  const centros = uniq(rows.map(r => String(r.centroCodigo || r.centro?.codigo || '')));

  return { contactos: rows, empresas, comunas, centros };
}

/* ================== render KPIs ================== */
function renderKPIsForVisitas(agg){
  $('#resumen_kpis').innerHTML = `
    <div class="kpi-row">
      <div class="kpi"><small>Empresas visitadas</small><h4>${fmtInt(agg.empresas.length)}</h4></div>
      <div class="kpi"><small>Visitas realizadas</small><h4>${fmtInt(agg.visitas.length)}</h4></div>
      <div class="kpi"><small>Tons comprometidas</small><h4>${fmt2(agg.totalTons)}</h4></div>
      <div class="kpi"><small>Centros distintos</small><h4>${fmtInt(agg.centros.length)}</h4></div>
    </div>
  `;
}

function renderKPIsForContactos(agg){
  $('#resumen_kpis').innerHTML = `
    <div class="kpi-row">
      <div class="kpi"><small>Contactos realizados</small><h4>${fmtInt(agg.contactos.length)}</h4></div>
      <div class="kpi"><small>Comunas cubiertas</small><h4>${fmtInt(agg.comunas.length)}</h4></div>
      <div class="kpi"><small>Centros distintos</small><h4>${fmtInt(agg.centros.length)}</h4></div>
      <div class="kpi"><small>Tons disponibles (suma)</small><h4>${fmt2(agg.contactos.reduce((a,r)=>a+Number(r.__tonsDisponible||0),0))}</h4></div>
    </div>
  `;
}

/* ================== render tablas ================== */
function renderTablaVisitas(visitas){
  const tbody = $('#resumen_table_body');
  if (!tbody) return;
  const rows = visitas.map(v => {
    const f = v.fecha ? new Date(v.fecha) : null;
    const fstr = f ? f.toISOString().slice(0,10) : '—';
    const prov = v.contacto?.empresaNombre || v.proveedorNombre || v.contacto?.nombre || '—';
    const centro = v.centroCodigo || v.centroId || '—';
    const comuna = v.comuna || v.contacto?.comuna || '—';
    const tons = v.tonsComprometidas ? fmt2(v.tonsComprometidas) : '—';
    const estado = v.estado || '—';
    const prox = v.proximoPasoFecha ? new Date(v.proximoPasoFecha).toISOString().slice(0,10) : '—';
    return `<tr>
      <td>${fstr}</td>
      <td>${prov}${v.contacto ? `<span class="subtle">${v.contacto?.nombre || ''}</span>`:''}</td>
      <td>${centro}<span class="subtle">${comuna}</span></td>
      <td>${tons}</td>
      <td>${estado}<span class="subtle">${prox}</span></td>
    </tr>`;
  }).join('');
  tbody.innerHTML = rows || '<tr><td colspan="5" class="grey-text">No hay visitas para esta semana.</td></tr>';
}

function renderTablaContactos(rows){
  const tbody = $('#resumen_table_body');
  if (!tbody) return;
  const html = rows.map(c => {
    const f = c.fecha ? new Date(c.fecha).toISOString().slice(0,10) : (c.createdAt ? new Date(c.createdAt).toISOString().slice(0,10) : '—');
    const prov = c.empresaNombre || c.proveedorNombre || '—';
    const contacto = c.contactoNombre || c.contacto?.nombre || '';
    const centro = c.centroCodigo || c.centro?.codigo || '—';
    const comuna = c.centroComuna || c.comuna || c.centro?.comuna || '—';
    const resp = c.responsable || c.contactoResponsable || c.creadoPor || '—';
    const tons = c.__tonsDisponible ? fmt2(c.__tonsDisponible) : '—';
    return `<tr>
      <td>${f}</td>
      <td>${prov}${contacto ? `<span class="subtle">${contacto}</span>`:''}</td>
      <td>${centro}<span class="subtle">${comuna}</span></td>
      <td>${tons}</td>
      <td>${resp}</td>
    </tr>`;
  }).join('');
  tbody.innerHTML = html || '<tr><td colspan="5" class="grey-text">No hay contactos para esta semana.</td></tr>';
}

/* ================== wiring de controles ================== */
function wireControls(){
  const sel = $('#resumen_semana');
  const btn = $('#resumen_print');
  const btnCopy = $('#resumen_copy');

  if (sel && !sel.__wired){
    sel.__wired = true;
    sel.addEventListener('change', () => refreshResumen());
  }
  if (btn && !btn.__wired){
    btn.__wired = true;
    btn.addEventListener('click', () => window.print());
  }
  if (btnCopy && !btnCopy.__wired){
    btnCopy.__wired = true;
    btnCopy.addEventListener('click', () => {
      const el = document.getElementById('resumen_print_area');
      if (!el) return;
      const range = document.createRange(); range.selectNode(el);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      document.execCommand('copy'); sel.removeAllRanges();
      M.toast?.({ html: 'Resumen copiado', displayLength: 1500 });
    });
  }

  // Switch Visitas/Contactos
  const sw = document.getElementById('resumen_view_switch');
  if (sw && !sw.__wired){
    sw.__wired = true;
    sw.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-mode]');
      if (!btn) return;
      _mode = btn.dataset.mode;
      sw.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b.dataset.mode === _mode));
      refreshResumen();
    });
  }
}

/* ================== API pública ================== */
export async function initResumenSemanalTab(){
  await Promise.all([ensureVisitas(), ensureDisponibilidades()]);
  buildSemanaOptions();
  mountToolbarExtras();
  wireControls();
  refreshResumen();
}

export function refreshResumen(){
  const wk = ($('#resumen_semana')?.value) || '';
  if (_mode === 'visitas'){
    const agg = aggregateVisitasForWeek(wk);
    renderKPIsForVisitas(agg);
    renderTableHeader('visitas');
    renderTablaVisitas(agg.visitas);
  } else {
    const agg = aggregateContactosForWeek(wk);
    renderKPIsForContactos(agg);
    renderTableHeader('contactos');
    renderTablaContactos(agg.contactos);
  }
}

/* ================== UI helpers ================== */
function mountToolbarExtras(){
  const bar = document.querySelector('.resumen-toolbar');
  if (!bar || document.getElementById('resumen_view_switch')) return;
  const box = document.createElement('div');
  box.className = 'view-switch';
  box.id = 'resumen_view_switch';
  box.innerHTML = `
    <button type="button" data-mode="visitas">Visitas</button>
    <button type="button" data-mode="contactos" class="is-active">Contactos</button>
  `;
  // Inserta el switch entre el selector y los botones copiar/imprimir
  bar.insertBefore(box, bar.children[1] || null);
}

function renderTableHeader(mode){
  const thead = $('#resumen_print_area thead');
  if (!thead) return;
  if (mode === 'visitas'){
    thead.innerHTML = `
      <tr>
        <th>Fecha</th>
        <th>Proveedor / Contacto</th>
        <th>Centro / Comuna</th>
        <th>Tons</th>
        <th>Estado / Próx. paso</th>
      </tr>
    `;
  } else {
    thead.innerHTML = `
      <tr>
        <th>Fecha</th>
        <th>Proveedor / Contacto</th>
        <th>Centro / Comuna</th>
        <th>Tons (disponibles)</th>
        <th>Responsable</th>
      </tr>
    `;
  }
}
