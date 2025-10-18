// /js/abastecimiento/contactos/resumen-semanal.js
import { state, $ } from './state.js';
import { getAll as getAllVisitas } from '../visitas/api.js';
import { normalizeVisita, centroCodigoById } from '../visitas/normalizers.js';

/* ======================= Estilos del módulo (inyección segura) ======================= */
(function injectResumenStyles(){
  if (document.getElementById('resumen-semanal-styles')) return;
  const s = document.createElement('style');
  s.id = 'resumen-semanal-styles';
  s.textContent = `
    #tab-resumen{ padding:8px 4px 24px; }
    #tab-resumen h5{ font-weight:600; letter-spacing:.2px; }
    .resumen-toolbar{ margin:8px 0 4px; display:flex; gap:12px; align-items:center; justify-content:space-between; }

    /* KPI en UNA SOLA FILA */
    #resumen_kpis .kpi-row{ display:flex; flex-wrap:nowrap; gap:12px; overflow:visible; padding-bottom:0; }
    #resumen_kpis .kpi-card{
      flex:1 1 0; min-width:0; border:1px solid #e5e7eb; border-radius:14px; background:#fff;
      padding:14px 16px; box-shadow:0 1px 1px rgba(0,0,0,.03);
      display:flex; flex-direction:column; justify-content:center; min-height:92px; width:100%;
    }
    .kpi-card .kpi-label{ font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:.6px; }
    .kpi-card .kpi-value{ font-size:26px; margin-top:6px; line-height:1.1; font-weight:600; color:#111827; }

    /* Tabla */
    #resumen_print_area table{ width:100%; table-layout:auto; }
    #resumen_print_area table.striped thead th{
      font-size:12px; color:#6b7280; font-weight:600; border-bottom:1px solid #e5e7eb;
    }
    #resumen_print_area table.striped tbody td{ padding:10px 12px; vertical-align:middle; }

    /* expandir tabla si el panel superior está vacío */
    #resumen_top:empty{ display:none !important; }
    .res-col-table.full-width{ width:100% !important; max-width:100% !important; flex:0 0 100% !important; }

    /* enlaces y sublíneas */
    .res-link{ color:#0ea5a8; font-weight:700; text-decoration:none; }
    .res-link:hover{ text-decoration:underline; }
    .subline{ font-size:12px; line-height:1.2; color:#6b7280; }

    /* chips de estado */
    .chip-estado{
      display:inline-flex; align-items:center; gap:6px;
      padding:4px 8px; border-radius:999px; border:1px solid #e5e7eb;
      font-size:12px; font-weight:700; white-space:nowrap;
    }
    .chip-vis{ background:#ecfeff; border-color:#a5f3fc; color:#075985; }
    .chip-mue{ background:#f0fdf4; border-color:#bbf7d0; color:#166534; }
    .chip-neg{ background:#fef3c7; border-color:#fde68a; color:#92400e; }
    .chip-tel{ background:#eef2ff; border-color:#c7d2fe; color:#3730a3; }
    .chip-esp{ background:#faf5ff; border-color:#e9d5ff; color:#6b21a8; }
    .chip-na { background:#f3f4f6; border-color:#e5e7eb; color:#374151; }

    /* switch modo */
    .segmented{ display:inline-flex; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; }
    .segmented button{ padding:8px 12px; background:#fff; border:0; cursor:pointer; font-weight:700; }
    .segmented button+button{ border-left:1px solid #e5e7eb; }
    .segmented button.is-active{ background:#eef2ff; color:#1e40af; }

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
const esc  = (s='') => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

/* Abreviaturas ES */
const MES_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const pad2 = (n) => String(n).padStart(2,'0');
const fmtDMYShort = (dt) => { const d = toDate(dt); return d ? `${pad2(d.getDate())}.${MES_ABBR[d.getMonth()]}.${String(d.getFullYear()).slice(-2)}` : '—'; };

/* Slug robusto para emparejar nombres con keys */
function slug(v=''){
  return String(v||'')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')  // quita tildes
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}

/* ======================= Semana ISO ======================= */
function isoWeek(date){
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}
function weekKeyFromDate(dt){ if (!dt) return ''; const {year, week} = isoWeek(dt); return `${year}-W${String(week).padStart(2,'0')}`; }

/* ======================= Resolutores ======================= */
// VISITAS
function proveedorDeVisita(v){
  const emb = v?.contacto?.empresaNombre || v?.proveedorNombre || v?.empresaNombre || v?.empresa;
  if (emb) return emb;
  const id = v?.contactoId ? String(v.contactoId) : null;
  if (!id) return '';
  const c = (state.contactosGuardados || []).find(x => String(x._id) === id);
  return c?.proveedorNombre || c?.empresaNombre || '';
}
function contactoDeVisita(v){
  const id = v?.contactoId ? String(v.contactoId) : null;
  if (!id) return v?.contacto || '';
  const c = (state.contactosGuardados || []).find(x => String(x._id) === id);
  return c?.contactoNombre || c?.contacto || v?.contacto || '';
}
function responsableDeVisita(v){ return v?.responsable || v?.contactoResponsable || v?.responsablePG || ''; }
function centroCodigoDeVisita(v){ if (v?.centroCodigo) return v.centroCodigo; if (v?.centroId) return (centroCodigoById?.(v.centroId, state.listaCentros || []) || ''); return ''; }
function comunaDeVisita(v){
  if (v?.centroComuna) return v.centroComuna;
  const code = centroCodigoDeVisita(v);
  const id   = v?.centroId ? String(v.centroId) : null;
  const lista = state.listaCentros || [];
  const m = lista.find(c => (id && String(c._id||c.id)===id) || (code && String(c.code||c.codigo||c.Codigo)===String(code)));
  return m?.comuna || m?.Comuna || '';
}
const normalizeEstado = (s='') => { const x = String(s||'').trim(); return (x === 'Tomar/entregar muestras') ? 'Tomar muestras' : x; };
function estadoClaseChip(estado){
  const e = normalizeEstado(estado).toLowerCase();
  if (!e || e === 'sin acción') return 'chip-estado chip-na';
  if (e.includes('muestr')) return 'chip-estado chip-mue';
  if (e.includes('negoci')) return 'chip-estado chip-neg';
  if (e.includes('tel'))    return 'chip-estado chip-tel';
  if (e.includes('esper'))  return 'chip-estado chip-esp';
  if (e.includes('visita')) return 'chip-estado chip-vis';
  return 'chip-estado chip-na';
}
// CONTACTOS
function proveedorDeContacto(c){ return c?.proveedorNombre || c?.empresaNombre || c?.empresa || c?.contacto?.empresaNombre || ''; }
function contactoNombreDeContacto(c){ return c?.contactoNombre || c?.contacto || ''; }
function fechaDeContacto(c){ return c?.fecha || c?.fechaContacto || c?.createdAt || null; }
function centroCodigoDeContacto(c){ if (c?.centroCodigo) return c.centroCodigo; if (c?.centroId) return (centroCodigoById?.(c.centroId, state.listaCentros || []) || ''); return ''; }
function comunaDeContacto(c){
  if (c?.centroComuna) return c.centroComuna;
  const code = centroCodigoDeContacto(c);
  const id   = c?.centroId ? String(c.centroId) : null;
  const lista = state.listaCentros || [];
  const m = lista.find(x => (id && String(x._id||x.id)===id) || (code && String(x.code||x.codigo||x.Codigo)===String(code)));
  return m?.comuna || m?.Comuna || '';
}

/* ======================= Cache ======================= */
let _cache = {
  allVisitas: [], byWeekVis: new Map(),
  allContactos: [], byWeekCont: new Map(),
  optionsSig: null,
  mode: 'visitas',
  dispSumCacheContact: new Map(), // clave: proveedorSlug -> suma de disponibilidades
};

/* ======================= Data ======================= */
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

/* ======================= Disponibilidades (API) ======================= */
async function getDisponibilidades(params = {}){
  const y = new Date().getFullYear();
  const q = new URLSearchParams();
  q.set('from', params.from || `${y-1}-01`);
  q.set('to',   params.to   || `${y+1}-12`);
  if (params.proveedorKey) q.set('proveedorKey', params.proveedorKey);
  if (params.centroId)     q.set('centroId', params.centroId);
  // OJO: NO filtramos por contactoId porque muchas disponibilidades no lo traen
  const res = await fetch(`${API_BASE}/disponibilidades?${q.toString()}`);
  if (!res.ok) throw new Error('GET /disponibilidades '+res.status);
  const json = await res.json();
  return Array.isArray(json) ? json : (json.items || []);
}

/* Normaliza distintos formatos de ids (string, number, ObjectId, {$oid}) */
const normId = (v) => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') {
    if (v.$oid) return v.$oid;
    if (v.oid)  return v.oid;
    if (typeof v.toString === 'function') return v.toString();
  }
  return String(v);
};

/* ===== CONTACTOS: sumar disponibilidades (Tons producidas) ===== */
/**
 * Empareja disponibilidades con el contacto:
 *  1) Si existe proveedorKey en el contacto => llama API filtrando por proveedorKey.
 *  2) Si no, descarga disponibilidades del rango y filtra localmente por slug del nombre.
 *     Coincide contra proveedorKey, empresaKey o proveedorNombre de cada disponibilidad.
 */
async function sumDisponibilidadesContacto(c){
  // claves del contacto
  const proveedorKey = c.proveedorKey || c.empresaKey || (c.empresa && c.empresa.key) || '';
  const provNombre   = proveedorDeContacto(c) || '';
  const provSlug     = slug(proveedorKey || provNombre);

  if (_cache.dispSumCacheContact.has(provSlug)) {
    return _cache.dispSumCacheContact.get(provSlug);
  }

  let total = 0;

  try{
    if (providerKeyLooksValid(proveedorKey)) {
      // Camino feliz: tenemos proveedorKey consistente con tu BD
      const list = await getDisponibilidades({ proveedorKey });
      total = (Array.isArray(list) ? list : []).reduce(
        (a,it)=> a + Number(it.tonsDisponible ?? it.tons ?? 0),
        0
      );
    } else {
      // Fallback: filtrado local por slug de nombre (soporta casos sin key)
      const list = await getDisponibilidades({});
      total = (Array.isArray(list) ? list : [])
        .filter(it => {
          const k = it.proveedorKey || it.empresaKey || it.proveedorNombre || it.empresaNombre || '';
          return slug(k) === provSlug; // match por slug
        })
        .reduce((a,it)=> a + Number(it.tonsDisponible ?? it.tons ?? 0), 0);
    }
  }catch(e){
    console.warn('[resumen] sumDisponibilidadesContacto error', e);
    total = 0;
  }

  _cache.dispSumCacheContact.set(provSlug, total);
  return total;
}

function providerKeyLooksValid(k){ return !!(k && typeof k === 'string' && k.trim().length >= 3); }

/* ======================= Agregaciones (para KPIs) ======================= */
function aggregateVisitas(wk){
  const visitas = (_cache.byWeekVis.get(wk) || []).slice().sort((a,b)=>{
    const da = toDate(a.fecha) || toDate(a.proximoPasoFecha) || new Date(0);
    const db = toDate(b.fecha) || toDate(b.proximoPasoFecha) || new Date(0);
    return db - da;
  });
  const empresas = uniq(visitas.map(proveedorDeVisita)).filter(Boolean);
  const comunas  = uniq(visitas.map(comunaDeVisita)).filter(Boolean);
  const centros  = uniq(visitas.map(centroCodigoDeVisita)).filter(Boolean);
  // KPI: Tons conversadas desde visitas (tonsComprometidas)
  const totalConversadas = visitas.reduce((acc,v)=> acc + Number(v.tonsComprometidas || 0), 0);
  return { visitas, empresas, comunas, centros, totalConversadas, count: visitas.length };
}
async function aggregateContactosAsync(wk){
  const contactos = (_cache.byWeekCont.get(wk) || []).slice().sort((a,b)=>{
    const da = toDate(fechaDeContacto(a)) || new Date(0);
    const db = toDate(fechaDeContacto(b)) || new Date(0);
    return db - da;
  });
  const empresas = uniq(contactos.map(proveedorDeContacto)).filter(Boolean);
  const comunas  = uniq(contactos.map(comunaDeContacto)).filter(Boolean);
  const centros  = uniq(contactos.map(centroCodigoDeContacto)).filter(Boolean);

  // KPI: Tons producidas = suma de disponibilidades por cada proveedor listado
  // (se usa cache por proveedor para no repetir llamadas)
  let totalProducidas = 0;
  for (const c of contactos){
    totalProducidas += await sumDisponibilidadesContacto(c);
  }
  return { contactos, empresas, comunas, centros, totalProducidas, count: contactos.length };
}

/* ======================= KPIs ======================= */
function kpi(label, val){
  return `<div class="kpi-card">
    <span class="kpi-label">${label}</span>
    <span class="kpi-value">${val}</span>
  </div>`;
}
async function renderKPIs(aggV, aggC){
  const el = $('#resumen_kpis'); if (!el) return;
  const cardsHtml = (_cache.mode === 'visitas')
    ? [
        kpi('Visitas realizadas', aggV.count),
        kpi('Tons conversadas', fmt2(aggV.totalConversadas || 0)),
        kpi('Centros distintos', (aggV.centros||[]).length),
        kpi('Comunas cubiertas', (aggV.comunas||[]).length),
      ].join('')
    : [
        kpi('Contactos realizados', aggC.count),
        kpi('Tons producidas', fmt2(aggC.totalProducidas || 0)),
        kpi('Centros distintos', (aggC.centros||[]).length),
        kpi('Comunas cubiertas', (aggC.comunas||[]).length),
      ].join('');
  el.innerHTML = `<div class="kpi-row">${cardsHtml}</div>`;
}

/* ======================= Semanas: helpers ======================= */
function allWeeks(){
  return Array.from(new Set([
    ..._cache.byWeekVis.keys(),
    ..._cache.byWeekCont.keys(),
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

/* ======================= Tablas ======================= */
function ensureHeadColumns(tbody){
  const thead = tbody.closest('table')?.querySelector('thead tr');
  if (!thead) return;
  const want = _cache.mode === 'visitas' ? 7 : 6;
  const curr = thead.children.length;
  if (want === curr) return;
  thead.innerHTML = (_cache.mode === 'visitas')
    ? `<th>Fecha</th><th>Proveedor</th><th>Centro</th><th>Comuna</th><th>Tons conversadas</th><th>Fecha prox.</th><th>Estado</th>`
    : `<th>Fecha</th><th>Proveedor</th><th>Centro</th><th>Comuna</th><th>Tons producidas</th><th>Responsable</th>`;
}

function renderTablaVisitas(visitas){
  const tbody = $('#resumen_table_body'); if (!tbody) return;
  ensureHeadColumns(tbody);

  const rowsHtml = visitas.map(v => {
    const prov   = proveedorDeVisita(v) || '—';
    const contacto = contactoDeVisita(v) || '';
    const resp   = responsableDeVisita(v) || '';
    const centro = centroCodigoDeVisita(v) || '—';
    const comuna = comunaDeVisita(v) || '—';
    const tons   = (v.tonsComprometidas != null) ? fmt2(v.tonsComprometidas) : '—';
    const fpp    = fmtDMYShort(toDate(v.proximoPasoFecha));
    const estado = normalizeEstado(v.estado || '—');
    const chipCl = estadoClaseChip(estado);
    const vid = esc(v._id || '');

    const sub = (contacto || resp) ? `<div class="subline">${esc(contacto || '')}${resp ? ` · Resp.: ${esc(resp)}`:''}</div>` : ``;

    return `<tr data-visita-id="${vid}">
      <td>${fmtDMYShort(toDate(v.fecha))}</td>
      <td>
        <a href="#!" class="res-link js-open-visita" data-id="${vid}" title="Ver visita">${esc(prov)}</a>
        ${sub}
      </td>
      <td><span class="res-link js-open-visita" data-id="${vid}" title="Ver visita">${esc(centro)}</span></td>
      <td>${esc(comuna)}</td>
      <td data-col="tons">${tons}</td>
      <td>${fpp}</td>
      <td><span class="${chipCl}">${esc(estado || '—')}</span></td>
    </tr>`;
  }).join('');

  tbody.innerHTML = rowsHtml || '<tr><td colspan="7" class="grey-text">No hay visitas para esta semana.</td></tr>';

  // abrir visita
  tbody.querySelectorAll('.js-open-visita').forEach(a => {
    a.addEventListener('click', (e)=>{
      e.preventDefault();
      const id = a.getAttribute('data-id');
      if (!id) return;
      document.dispatchEvent(new CustomEvent('visita:open-readonly', { detail:{ id } }));
    });
  });

  ensureFullWidthTable();
}

async function renderTablaContactos(contactos){
  const tbody = $('#resumen_table_body'); if (!tbody) return;
  ensureHeadColumns(tbody);

  let rowsHtml = '';
  for (const c of contactos){
    const prov   = proveedorDeContacto(c) || '—';
    const contacto = contactoNombreDeContacto(c) || '';
    const centro = centroCodigoDeContacto(c) || '—';
    const comuna = comunaDeContacto(c) || '—';
    const resp   = c.responsable || c.contactoResponsable || c.responsablePG || '—';

    // Sumatoria de disponibilidades = TONS PRODUCIDAS (con cache por proveedor)
    const sumDisp = await sumDisponibilidadesContacto(c);
    const tons = sumDisp ? fmt2(sumDisp) : '—';

    const cid    = esc(c._id || '');
    rowsHtml += `<tr data-contacto-id="${cid}">
      <td>${fmtDMYShort(toDate(fechaDeContacto(c)))}</td>
      <td>
        <a href="#!" class="res-link js-open-contacto" data-id="${cid}" title="Ver contacto">${esc(prov)}</a>
        ${contacto ? `<div class="subline">${esc(contacto)}</div>` : ``}
      </td>
      <td>${esc(centro)}</td>
      <td>${esc(comuna)}</td>
      <td data-col="tons">${tons}</td>
      <td>${esc(resp)}</td>
    </tr>`;
  }

  tbody.innerHTML = rowsHtml || '<tr><td colspan="6" class="grey-text">No hay contactos para esta semana.</td></tr>';

  // abrir contacto
  tbody.querySelectorAll('.js-open-contacto').forEach(a => {
    a.addEventListener('click', (e)=>{
      e.preventDefault();
      const id = a.getAttribute('data-id');
      if (!id) return;
      try {
        const c = (state.contactosGuardados||[]).find(x => String(x._id) === String(id));
        if (!c) return (window.M?.toast) && M.toast({ html:'Contacto no encontrado', classes:'red' });
        if (typeof window.abrirDetalleContacto === 'function') window.abrirDetalleContacto(c);
      } catch {}
    });
  });

  ensureFullWidthTable();
}

/* ===== Expandir tabla si el panel está vacío ===== */
function ensureFullWidthTable(){
  const tableCol = document.querySelector('#resumen_print_area .row .col.s12.m7') || document.querySelector('#resumen_print_area .row .col:first-child');
  const rightCol = document.querySelector('#resumen_print_area .row .col.s12.m5');
  const topBox   = document.getElementById('resumen_top');
  if (topBox && rightCol){
    const isEmpty = !topBox.innerHTML.trim();
    if (isEmpty){ rightCol.style.display = 'none'; if (tableCol) tableCol.classList.add('res-col-table','full-width'); }
    else { rightCol.style.display = ''; if (tableCol) tableCol.classList.remove('full-width'); }
  }
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

  seg.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    const mode = btn.getAttribute('data-mode');
    if (_cache.mode === mode) return;
    _cache.mode = mode;
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b===btn));
    await refreshResumen();
  });
}
function trySyncModeFromMainTabs(){
  const active = document.querySelector('.tabs .tab a.active');
  if (!active) return;
  const href = (active.getAttribute('href')||'').toLowerCase();
  if (href.includes('contacto'))      setResumenMode('contactos', {silentRewire:false});
  else if (href.includes('visita'))   setResumenMode('visitas', {silentRewire:false});
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
      } catch { try { await navigator.clipboard.writeText(area.innerText); } catch {} }
    });
  }
  ensureModeSwitcher();
  window.addEventListener('hashchange', () => trySyncModeFromMainTabs());
}

/* ======================= API ======================= */
export async function initResumenSemanalTab(){
  await ensureData();
  buildSemanaOptions();
  wireControls();
  trySyncModeFromMainTabs();
  await refreshResumen();

  window.addEventListener('visita:created', async () => { _cache.allVisitas = []; _cache.byWeekVis.clear(); await refreshResumen(); });
  window.addEventListener('visita:updated', async () => { _cache.allVisitas = []; _cache.byWeekVis.clear(); await refreshResumen(); });
  window.addEventListener('visita:deleted', async () => { _cache.allVisitas = []; _cache.byWeekVis.clear(); await refreshResumen(); });
  document.addEventListener('reload-tabla-contactos', async () => {
    _cache.allContactos = []; _cache.byWeekCont.clear(); _cache.dispSumCacheContact.clear(); await refreshResumen();
  });
}

/** Forzar modo desde otras vistas */
export function setResumenMode(mode, opts = {}){
  if (mode !== 'visitas' && mode !== 'contactos') return;
  if (_cache.mode === mode) return;
  _cache.mode = mode;
  const seg = document.getElementById('resumen_mode');
  if (seg){
    seg.querySelectorAll('button').forEach(b => {
      b.classList.toggle('is-active', b.getAttribute('data-mode') === mode);
    });
  }
  if (!opts.silentRewire) refreshResumen();
}

export async function refreshResumen(){
  await ensureData();

  // fallback: seleccionar semana más reciente si el <select> está vacío
  const sel = document.getElementById('resumen_semana');
  if (sel && !sel.value){
    const weeks = allWeeks();
    if (weeks.length){ sel.value = weeks[0]; }
  }
  const wk = (sel?.value) || '';

  const aggV = aggregateVisitas(wk);
  const aggC = await aggregateContactosAsync(wk);

  await renderKPIs(aggV, aggC);

  if (_cache.mode === 'visitas'){
    renderTablaVisitas(aggV.visitas);
  } else {
    await renderTablaContactos(aggC.contactos);
  }
}
