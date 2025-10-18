// /js/abastecimiento/contactos/resumen-semanal.js
import { state, $ } from './state.js';
import { getAll as getAllVisitas } from '../visitas/api.js';
import { normalizeVisita, centroCodigoById } from '../visitas/normalizers.js';

/* ======================= Estilos del módulo ======================= */
(function injectResumenStyles(){
  if (document.getElementById('resumen-semanal-styles')) return;
  const s = document.createElement('style');
  s.id = 'resumen-semanal-styles';
  s.textContent = `
    #tab-resumen{ padding:8px 4px 24px; }
    #tab-resumen h5{ font-weight:600; letter-spacing:.2px; }
    .resumen-toolbar{ margin:8px 0 4px; display:flex; gap:12px; align-items:center; justify-content:space-between; }

    /* KPI cards */
    .kpi-grid{ display:grid; grid-template-columns: repeat(12, 1fr); gap:12px; }
    .kpi-card{
      border:1px solid #e5e7eb; border-radius:14px; background:#fff;
      padding:14px 16px; box-shadow: 0 1px 1px rgba(0,0,0,.03);
      display:flex; flex-direction:column; justify-content:center; min-height:92px;
    }
    .kpi-card .kpi-label{ font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:.6px; }
    .kpi-card .kpi-value{ font-size:26px; margin-top:6px; line-height:1.1; font-weight:600; color:#111827; }

    /* tabla */
    #resumen_print_area table.striped thead th{
      font-size:12px; color:#6b7280; font-weight:600; border-bottom:1px solid #e5e7eb;
    }
    #resumen_print_area table.striped tbody td{ padding:10px 12px; vertical-align:middle; }

    /* Celdas compuestas (dos líneas) */
    .r-prov, .r-centro{ display:block; min-width:0; }
    .r-top{ display:block; font-weight:600; line-height:1.2; }
    .r-sub{ display:block; font-size:12px; color:#6b7280; line-height:1.15; }

    /* botones */
    #resumen_copy.btn-flat{ border:1px solid #e5e7eb; border-radius:10px; }
    #resumen_print.btn{ border-radius:10px; }

    /* control segmentado (Visitas / Contactos) */
    .segmented{ display:inline-flex; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; }
    .segmented button{ padding:8px 12px; background:#fff; border:0; cursor:pointer; font-weight:700; }
    .segmented button+button{ border-left:1px solid #e5e7eb; }
    .segmented button.is-active{ background:#eef2ff; color:#1e40af; }

    /* print */
    @media print{
      nav, .tabs, .resumen-toolbar{ display:none !important; }
      body{ background:#fff !important; }
      #tab-resumen{ padding:0; } #resumen_print_area{ margin:0; }
      #resumen_print_area h5{ margin-top:0; }
    }
  `;
  document.head.appendChild(s);
})();

/* ======================= Utils ======================= */
const API_BASE = window.API_URL || '/api';
const fmt2 = (n) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 });
const ymd  = (d) => (d instanceof Date && !isNaN(d)) ? d.toISOString().slice(0,10) : '—';
const toDate = (v) => { if (!v) return null; try { return (v instanceof Date) ? v : new Date(v); } catch { return null; } };
const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
const esc = (s='') => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

function isoWeek(date){
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}
function weekKeyFromDate(dt){
  if (!dt) return '';
  const {year, week} = isoWeek(dt);
  return `${year}-W${String(week).padStart(2,'0')}`;
}

/* ======================= Resolutores consistentes ======================= */
// VISITAS
function proveedorDeVisita(v){
  const emb = v?.contacto?.empresaNombre || v?.proveedorNombre || v?.empresaNombre || v?.empresa;
  if (emb) return emb;
  const id = v?.contactoId ? String(v.contactoId) : null;
  if (!id) return '';
  const c = (state.contactosGuardados || []).find(x => String(x._id) === id);
  return c?.proveedorNombre || c?.empresaNombre || '';
}
function contactoNombreDeVisita(v){
  if (v?.contactoNombre || v?.contacto) return v.contactoNombre || v.contacto;
  const id = v?.contactoId ? String(v.contactoId) : null;
  if (!id) return '';
  const c = (state.contactosGuardados || []).find(x => String(x._id) === id);
  return c?.contactoNombre || c?.contacto || '';
}
function centroCodigoDeVisita(v){
  if (v?.centroCodigo) return v.centroCodigo;
  if (v?.centroId) return (centroCodigoById?.(v.centroId, state.listaCentros || []) || '');
  return '';
}
function comunaDeVisita(v){
  if (v?.centroComuna) return v.centroComuna;
  const code = centroCodigoDeVisita(v);
  const id   = v?.centroId ? String(v.centroId) : null;
  const lista = state.listaCentros || [];
  const m = lista.find(c =>
    (id && (String(c._id||c.id)===id)) ||
    (code && (String(c.code||c.codigo||c.Codigo)===String(code)))
  );
  return m?.comuna || m?.Comuna || '';
}
// CONTACTOS
function proveedorDeContacto(c){
  return c?.proveedorNombre || c?.empresaNombre || c?.empresa || c?.contacto?.empresaNombre || '';
}
function contactoNombreDeContacto(c){ return c?.contactoNombre || c?.contacto || ''; }
function fechaDeContacto(c){ return c?.fecha || c?.fechaContacto || c?.createdAt || null; }
function centroCodigoDeContacto(c){
  if (c?.centroCodigo) return c.centroCodigo;
  if (c?.centroId) return (centroCodigoById?.(c.centroId, state.listaCentros || []) || '');
  return '';
}
function comunaDeContacto(c){
  if (c?.centroComuna) return c.centroComuna;
  const code = centroCodigoDeContacto(c);
  const id   = c?.centroId ? String(c.centroId) : null;
  const lista = state.listaCentros || [];
  const m = lista.find(x =>
    (id && (String(x._id||x.id)===id)) ||
    (code && (String(x.code||x.codigo||x.Codigo)===String(code)))
  );
  return m?.comuna || m?.Comuna || '';
}

/* ======================= Disponibilidades (para tons faltantes) ======================= */
const dispTotalCache = new Map();

async function getDisponibilidades(params){
  const y = new Date().getFullYear();
  const q = new URLSearchParams();
  q.set('from', params?.from || `${y-1}-01`);
  q.set('to',   params?.to   || `${y+1}-12`);
  if (params?.contactoId)   q.set('contactoId', params.contactoId);
  if (params?.proveedorKey) q.set('proveedorKey', params.proveedorKey);
  if (params?.centroId)     q.set('centroId', params.centroId);
  const res = await fetch(`${API_BASE}/disponibilidades?${q.toString()}`);
  if (!res.ok) throw new Error('GET /disponibilidades '+res.status);
  const json = await res.json();
  return Array.isArray(json) ? json : (json.items || []);
}

async function fetchTotalDisponibilidad({ contactoId='', proveedorKey='', centroId='' }){
  const key = `${contactoId||''}|${proveedorKey||''}|${centroId||''}`;
  if (dispTotalCache.has(key)) return dispTotalCache.get(key);

  const sum = (list, byId) => (Array.isArray(list)?list:[])
    .filter(it => !byId || String(it.contactoId||'')===String(byId))
    .reduce((a,it)=>a+Number(it.tonsDisponible??it.tons??0),0);

  let total = 0;
  try{
    if (contactoId){ total = sum(await getDisponibilidades({ contactoId }), contactoId); }
    if (total===0 && (proveedorKey||centroId)){ total = sum(await getDisponibilidades({ proveedorKey, centroId })); }
    if (total===0 && proveedorKey){ total = sum(await getDisponibilidades({ proveedorKey })); }
  }catch(e){ console.error('[resumen] fetchTotalDisponibilidad', e); }

  dispTotalCache.set(key,total);
  return total;
}

/* ======================= Cache ======================= */
let _cache = {
  allVisitas: [], byWeekVis: new Map(),
  allContactos: [], byWeekCont: new Map(),
  optionsSig: null,
  mode: 'visitas' // 'visitas' | 'contactos'
};

async function ensureData(){
  if (!_cache.allVisitas.length){
    const rawV = await getAllVisitas();
    const listV = Array.isArray(rawV) ? rawV.map(normalizeVisita) : [];
    _cache.allVisitas = listV;
    const byW = new Map();
    for (const v of listV){
      const dt = toDate(v.fecha) || toDate(v.proximoPasoFecha);
      if (!dt) continue;
      const wk = weekKeyFromDate(dt);
      if (!byW.has(wk)) byW.set(wk, []);
      byW.get(wk).push(v);
    }
    _cache.byWeekVis = byW;
  }

  if (!_cache.allContactos.length){
    const listC = Array.isArray(state.contactosGuardados) ? state.contactosGuardados.slice() : [];
    _cache.allContactos = listC;
    const byWc = new Map();
    for (const c of listC){
      const dt = toDate(fechaDeContacto(c));
      if (!dt) continue;
      const wk = weekKeyFromDate(dt);
      if (!byWc.has(wk)) byWc.set(wk, []);
      byWc.get(wk).push(c);
    }
    _cache.byWeekCont = byWc;
  }
}

/* ======================= Render base ======================= */
function allWeeks(){
  return Array.from(new Set([
    ..._cache.byWeekVis.keys(),
    ..._cache.byWeekCont.keys()
  ])).sort().reverse();
}

function buildSemanaOptions(){
  const sel = document.getElementById('resumen_semana');
  if (!sel) return;
  const weeks = allWeeks();
  const sig = weeks.join(',');
  if (_cache.optionsSig === sig) return;

  sel.innerHTML = '';
  for (const wk of weeks){
    const opt = document.createElement('option');
    opt.value = wk; opt.textContent = wk;
    sel.appendChild(opt);
  }
  if (weeks.length) sel.value = weeks[0];
  _cache.optionsSig = sig;
}

function ensureHeadColumns(tbody){
  const thead = tbody.closest('table')?.querySelector('thead tr');
  if (!thead) return;
  // VISITAS: Fecha | Proveedor | Centro | Tons | Fecha prox. | Estado  (6)
  // CONTACTOS: Fecha | Proveedor | Centro | Tons | Responsable          (5)
  const want = _cache.mode === 'visitas' ? 6 : 5;
  const curr = thead.children.length;
  if (want === curr) return;

  thead.innerHTML = (_cache.mode === 'visitas')
    ? `<th>Fecha</th><th>Proveedor</th><th>Centro</th><th>Tons</th><th>Fecha prox.</th><th>Estado</th>`
    : `<th>Fecha</th><th>Proveedor</th><th>Centro</th><th>Tons</th><th>Responsable</th>`;
}

/* ======================= Agregaciones ======================= */
function aggregateVisitas(wk){
  const visitas = (_cache.byWeekVis.get(wk) || []).slice().sort((a,b)=>{
    const da = toDate(a.fecha) || toDate(a.proximoPasoFecha) || new Date(0);
    const db = toDate(b.fecha) || toDate(b.proximoPasoFecha) || new Date(0);
    return db - da;
  });
  const empresas = uniq(visitas.map(proveedorDeVisita)).filter(Boolean);
  const comunas  = uniq(visitas.map(comunaDeVisita)).filter(Boolean);
  const centros  = uniq(visitas.map(centroCodigoDeVisita)).filter(Boolean);
  const totalTons = visitas.reduce((acc,v)=>acc+Number(v.tonsComprometidas||0),0);
  return { visitas, empresas, comunas, centros, totalTons, count: visitas.length };
}

function aggregateContactos(wk){
  const contactos = (_cache.byWeekCont.get(wk) || []).slice().sort((a,b)=>{
    const da = toDate(fechaDeContacto(a)) || new Date(0);
    const db = toDate(fechaDeContacto(b)) || new Date(0);
    return db - da;
  });
  const empresas = uniq(contactos.map(proveedorDeContacto)).filter(Boolean);
  const comunas  = uniq(contactos.map(comunaDeContacto)).filter(Boolean);
  const centros  = uniq(contactos.map(centroCodigoDeContacto)).filter(Boolean);
  // nota: los contactos rara vez traen tons; se intentará rellenar con disponibilidades si no hay
  const totalTons = contactos.reduce((acc,c)=>acc+Number(c.tons||c.tonsComprometidas||0),0);
  return { contactos, empresas, comunas, centros, totalTons, count: contactos.length };
}

/* ======================= KPIs ======================= */
function kpiCard(label, val){
  return `
    <div class="col s12 m6 l3">
      <div class="card z-depth-0" style="border:1px solid #e5e7eb; border-radius:12px">
        <div class="card-content">
          <span class="grey-text text-darken-1" style="font-size:12px">${label}</span>
          <h5 style="margin:6px 0 0">${val}</h5>
        </div>
      </div>
    </div>`;
}
function renderKPIs(aggV, aggC){
  const el = $('#resumen_kpis'); if (!el) return;
  el.innerHTML = `
    <div class="row" style="margin-top:8px">
      ${kpiCard('Contactos realizados', aggC.count)}
      ${kpiCard('Visitas realizadas', aggV.count)}
      ${kpiCard('Tons comprometidas', fmt2(aggV.totalTons || 0))}
      ${kpiCard('Centros distintos', uniq([...(aggV.centros||[]), ...(aggC.centros||[])]).length)}
      ${kpiCard('Comunas cubiertas', uniq([...(aggV.comunas||[]), ...(aggC.comunas||[])]).length)}
    </div>`;
}

/* ======================= Tablas ======================= */
function provCellHTML(nombreEmpresa, nombreContacto){
  const top = esc(nombreEmpresa||'—');
  const sub = (nombreContacto||'').trim();
  return `
    <span class="r-prov" title="${top}${sub? ' – '+esc(sub):''}">
      <span class="r-top">${top}</span>
      ${sub ? `<span class="r-sub">${esc(sub)}</span>` : ``}
    </span>`;
}
function centroCellHTML(codigo, comuna){
  const top = esc(codigo||'—');
  const sub = (comuna||'').trim();
  return `
    <span class="r-centro" title="${top}${sub? ' – '+esc(sub):''}">
      <span class="r-top">${top}</span>
      ${sub ? `<span class="r-sub">${esc(sub)}</span>` : ``}
    </span>`;
}

function renderTablaVisitas(visitas){
  const tbody = $('#resumen_table_body'); if (!tbody) return;
  ensureHeadColumns(tbody);

  const rows = visitas.map(v => {
    const prov   = proveedorDeVisita(v) || '—';
    const cto    = contactoNombreDeVisita(v) || '';
    const centro = centroCodigoDeVisita(v) || '—';
    const comuna = comunaDeVisita(v) || '';
    const tons   = v.tonsComprometidas; // fallback asíncrono abajo si falta
    const fpp    = ymd(toDate(v.proximoPasoFecha));
    const estado = v.estado || '—';

    const tonsTxt = (tons != null && tons !== '') ? fmt2(tons) : '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ymd(toDate(v.fecha))}</td>
      <td>${provCellHTML(prov, cto)}</td>
      <td>${centroCellHTML(centro, comuna)}</td>
      <td class="tons-cell" data-kind="visita"
          data-contactoid="${esc(v.contactoId||'')}"
          data-proveedorkey="${esc(v.proveedorKey||'')}"
          data-centroid="${esc(v.centroId||'')}"
          data-value="${(tons!=null&&tons!=='')?Number(tons):''}">${tonsTxt}</td>
      <td>${fpp}</td>
      <td>${esc(estado)}</td>
    `;
    return tr;
  });

  tbody.innerHTML = '';
  rows.forEach(r => tbody.appendChild(r));

  // completar tons faltantes con disponibilidades
  fillMissingTonsInTable(tbody);
}

function renderTablaContactos(contactos){
  const tbody = $('#resumen_table_body'); if (!tbody) return;
  ensureHeadColumns(tbody);

  const rows = contactos.map(c => {
    const prov   = proveedorDeContacto(c) || '—';
    const cto    = contactoNombreDeContacto(c) || '';
    const centro = centroCodigoDeContacto(c) || '—';
    const comuna = comunaDeContacto(c) || '';
    const tons   = c.tons ?? c.tonsComprometidas; // fallback asíncrono abajo si falta
    const resp   = c.responsable || c.contactoResponsable || '—';

    const tonsTxt = (tons != null && tons !== '') ? fmt2(tons) : '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ymd(toDate(fechaDeContacto(c)))}</td>
      <td>${provCellHTML(prov, cto)}</td>
      <td>${centroCellHTML(centro, comuna)}</td>
      <td class="tons-cell" data-kind="contacto"
          data-contactoid="${esc(c._id||'')}"
          data-proveedorkey="${esc(c.proveedorKey||'')}"
          data-centroid="${esc(c.centroId||'')}"
          data-value="${(tons!=null&&tons!=='')?Number(tons):''}">${tonsTxt}</td>
      <td>${esc(resp)}</td>
    `;
    return tr;
  });

  tbody.innerHTML = '';
  rows.forEach(r => tbody.appendChild(r));

  // completar tons faltantes con disponibilidades
  fillMissingTonsInTable(tbody);
}

/* ====== completar tons desde /disponibilidades cuando falten ====== */
async function fillMissingTonsInTable(tbody){
  const cells = Array.from(tbody.querySelectorAll('.tons-cell'));
  const pending = cells.filter(td => td.dataset.value === '' || td.dataset.value == null);

  if (!pending.length) return;

  await Promise.all(pending.map(async (td) => {
    const contactoId = td.dataset.contactoid || '';
    const proveedorKey = td.dataset.proveedorkey || '';
    const centroId = td.dataset.centroid || '';
    td.textContent = '…';
    try{
      const total = await fetchTotalDisponibilidad({ contactoId, proveedorKey, centroId });
      td.dataset.value = String(total);
      td.textContent = fmt2(total);
    }catch(e){
      td.textContent = '—';
    }
  }));
}

/* ======================= Controles (semana / modo) ======================= */
function ensureModeSwitcher(){
  const toolbar = document.querySelector('.resumen-toolbar');
  if (!toolbar) return;
  if (document.getElementById('resumen_mode')) return;

  const seg = document.createElement('div');
  seg.className = 'segmented';
  seg.id = 'resumen_mode';
  seg.innerHTML = `
    <button data-mode="visitas" class="is-active">Visitas</button>
    <button data-mode="contactos">Contactos</button>
  `;
  toolbar.insertBefore(seg, toolbar.lastElementChild);

  seg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    const mode = btn.getAttribute('data-mode');
    if (_cache.mode === mode) return;
    _cache.mode = mode;
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b===btn));
    refreshResumen();
  });
}

function wireControls(){
  const sel = $('#resumen_semana');
  const btnPrint = $('#resumen_print');
  const btnCopy  = $('#resumen_copy');

  if (sel && !sel.__wired){
    sel.__wired = true;
    sel.addEventListener('change', () => refreshResumen());
  }
  if (btnPrint && !btnPrint.__wired){
    btnPrint.__wired = true;
    btnPrint.addEventListener('click', () => window.print());
  }
  if (btnCopy && !btnCopy.__wired){
    btnCopy.__wired = true;
    btnCopy.addEventListener('click', async () => {
      const area = document.getElementById('resumen_print_area'); if (!area) return;
      const html = area.outerHTML;
      try {
        if (navigator.clipboard?.write) {
          const type = 'text/html';
          const blob = new Blob([html], { type });
          await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
        } else {
          const range = document.createRange(); range.selectNode(area);
          const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
          document.execCommand('copy'); sel.removeAllRanges();
        }
        (window.M?.toast) && M.toast({ html: 'Resumen copiado', displayLength: 1500 });
      } catch {
        try { await navigator.clipboard.writeText(area.innerText); } catch {}
      }
    });
  }

  ensureModeSwitcher();
}

/* ======================= API ======================= */
export async function initResumenSemanalTab(){
  await ensureData();
  buildSemanaOptions();
  wireControls();
  refreshResumen();
}

export async function refreshResumen(){
  await ensureData();
  const wk = ($('#resumen_semana')?.value) || '';

  const aggV = aggregateVisitas(wk);
  const aggC = aggregateContactos(wk);

  renderKPIs(aggV, aggC);

  if (_cache.mode === 'visitas'){
    renderTablaVisitas(aggV.visitas);
  } else {
    renderTablaContactos(aggC.contactos);
  }
}
