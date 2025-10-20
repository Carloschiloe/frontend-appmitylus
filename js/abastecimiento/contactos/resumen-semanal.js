// /js/abastecimiento/contactos/resumen-semanal.js
import { state, $ } from './state.js';
import { getAll as getAllVisitas } from '../visitas/api.js';
import { normalizeVisita, centroCodigoById } from '../visitas/normalizers.js';

console.log('[resumen] CARGADO v=2025-10-20-2');

/* ======================= Estilos del módulo ======================= */
(function injectResumenStyles(){
  if (document.getElementById('resumen-semanal-styles')) return;
  const s = document.createElement('style');
  s.id = 'resumen-semanal-styles';
  s.textContent = `
    #tab-resumen{ padding:8px 4px 24px; }
    #tab-resumen h5{ font-weight:600; letter-spacing:.2px; }
    .resumen-toolbar{ margin:8px 0 4px; display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap; }

    #resumen_kpis .kpi-row{ display:flex; flex-wrap:nowrap; gap:12px; overflow:visible; padding-bottom:0; }
    #resumen_kpis .kpi-card{
      flex:1 1 0; min-width:0; border:1px solid #e5e7eb; border-radius:14px; background:#fff;
      padding:14px 16px; box-shadow:0 1px 1px rgba(0,0,0,.03);
      display:flex; flex-direction:column; justify-content:center; min-height:92px; width:100%;
    }
    .kpi-card .kpi-label{ font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:.6px; }
    .kpi-card .kpi-value{ font-size:26px; margin-top:6px; line-height:1.1; font-weight:600; color:#111827; }

    #resumen_print_area table{ width:100%; table-layout:auto; }
    #resumen_print_area table.striped thead th{
      font-size:12px; color:#6b7280; font-weight:600; border-bottom:1px solid #e5e7eb;
    }
    #resumen_print_area table.striped tbody td{ padding:10px 12px; vertical-align:middle; }

    #resumen_top:empty{ display:none !important; }
    .res-col-table.full-width{ width:100% !important; max-width:100% !important; flex:0 0 100% !important; }

    .res-link{ color:#0ea5a8; font-weight:700; text-decoration:none; }
    .res-link:hover{ text-decoration:underline; }
    .subline{ font-size:12px; line-height:1.2; color:#6b7280; }

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

    .segmented{ display:inline-flex; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; }
    .segmented button{ padding:8px 12px; background:#fff; border:0; cursor:pointer; font-weight:700; }
    .segmented button+button{ border-left:1px solid #e5e7eb; }
    .segmented button.is-active{ background:#eef2ff; color:#1e40af; }

    .resumen-filtros{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .resumen-filtros .modern{ min-width:140px; padding:6px 8px; border:1px solid #e5e7eb; border-radius:8px; background:#fff; }

    .star-new{ color:#f59e0b; font-size:18px; vertical-align:middle; margin-left:6px; }

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
const toDate = (v) => { if (!v) return null; try { return (v instanceof Date) ? v : new Date(v); } catch { return null; } };
const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
const esc  = (s='') => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

/* Abreviaturas ES */
const MES_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const pad2 = (n) => String(n).padStart(2,'0');
const fmtDMYShort = (dt) => { const d = toDate(dt); return d ? `${pad2(d.getDate())}.${MES_ABBR[d.getMonth()]}.${String(d.getFullYear()).slice(-2)}` : '—'; };

/* Slug */
function slug(v=''){
  return String(v||'')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}

/* ======================= Semana/Mes keys ======================= */
function isoWeek(date){
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}
function weekKeyFromDate(dt){ if (!dt) return ''; const {year, week} = isoWeek(dt); return `${year}-W${String(week).padStart(2,'0')}`; }
function monthKeyFromDate(dt){ if (!dt) return ''; return `${dt.getFullYear()}-${pad2(dt.getMonth()+1)}`; }
function getCurrentWeekKey(){ const now = new Date(); const {year, week} = isoWeek(now); return `${year}-W${String(week).padStart(2,'0')}`; }
function getCurrentMonthKey(){ const now = new Date(); return `${now.getFullYear()}-${pad2(now.getMonth()+1)}`; }

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

/* ====== Proveedor NUEVO ====== */
function isProveedorNuevoByContact(contactOrNameOrKey){
  const lista = state.contactosGuardados || [];
  if (!lista.length) return false;

  const matchesFlag = (c) => Boolean(
    c?.proveedorNuevo === true ||
    c?.contactoProveedorNuevo === true ||
    c?.esNuevo === true ||
    c?.nuevo === true
  );

  if (contactOrNameOrKey && typeof contactOrNameOrKey === 'object') return matchesFlag(contactOrNameOrKey);

  const target = String(contactOrNameOrKey || '').trim();
  if (!target) return false;

  const byKey = lista.find(c => String(c.proveedorKey || c.empresaKey || '').trim() &&
                                String(c.proveedorKey || c.empresaKey).trim() === target);
  if (byKey) return matchesFlag(byKey);

  const tslug = slug(target);
  const found = lista.find(c => {
    const name = proveedorDeContacto(c) || '';
    const key  = c.proveedorKey || c.empresaKey || '';
    return slug(name) === tslug || slug(String(key)) === tslug;
  });
  return found ? matchesFlag(found) : false;
}
function renderStarIfNuevo({ proveedorKey, proveedorNombre } = {}){
  const nuevo = isProveedorNuevoByContact(proveedorKey || proveedorNombre || '');
  return nuevo ? `<i class="material-icons star-new" title="Proveedor nuevo">star</i>` : '';
}

/* ======================= Cache ======================= */
let _cache = {
  allVisitas: [], byWeekVis: new Map(), byMonthVis: new Map(),
  allContactos: [], byWeekCont: new Map(), byMonthCont: new Map(),
  mode: 'contactos',
  periodMode: 'semana',      // semana | mes
  dispSumCacheContact: new Map(),
  respFilter: '',
};

/* ======================= Data ======================= */
async function ensureData(){
  if (!_cache.allVisitas.length){
    const rawV = await getAllVisitas();
    const listV = Array.isArray(rawV) ? rawV.map(normalizeVisita) : [];
    _cache.allVisitas = listV;

    const byW = new Map(), byM = new Map();
    for (const v of listV){
      const dt = toDate(v.fecha) || toDate(v.proximoPasoFecha);
      if (!dt) continue;
      const wk = weekKeyFromDate(dt), mk = monthKeyFromDate(dt);
      if (!byW.has(wk)) byW.set(wk, []); if (!byM.has(mk)) byM.set(mk, []);
      byW.get(wk).push(v); byM.get(mk).push(v);
    }
    _cache.byWeekVis = byW; _cache.byMonthVis = byM;
  }
  if (!_cache.allContactos.length){
    const listC = Array.isArray(state.contactosGuardados) ? state.contactosGuardados.slice() : [];
    _cache.allContactos = listC;

    const byWc = new Map(), byMc = new Map();
    for (const c of listC){
      const dt = toDate(fechaDeContacto(c));
      if (!dt) continue;
      const wk = weekKeyFromDate(dt), mk = monthKeyFromDate(dt);
      if (!byWc.has(wk)) byWc.set(wk, []); if (!byMc.has(mk)) byMc.set(mk, []);
      byWc.get(wk).push(c); byMc.get(mk).push(c);
    }
    _cache.byWeekCont  = byWc; _cache.byMonthCont = byMc;
  }
}

/* ======================= Disponibilidades ======================= */
async function getDisponibilidades(params = {}){
  const y = new Date().getFullYear();
  const q = new URLSearchParams();
  q.set('from', params.from || `${y-1}-01`);
  q.set('to',   params.to   || `${y+1}-12`);
  if (params.proveedorKey) q.set('proveedorKey', params.proveedorKey);
  if (params.centroId)     q.set('centroId', params.centroId);
  const res = await fetch(`${API_BASE}/disponibilidades?${q.toString()}`);
  if (!res.ok) throw new Error('GET /disponibilidades '+res.status);
  const json = await res.json();
  return Array.isArray(json) ? json : (json.items || []);
}
function providerKeyLooksValid(k){ return !!(k && typeof k === 'string' && k.trim().length >= 3); }

/* ===== CONTACTOS: sumar disponibilidades ===== */
async function sumDisponibilidadesContacto(c){
  const proveedorKey = c.proveedorKey || c.empresaKey || (c.empresa && c.empresa.key) || '';
  const provNombre   = proveedorDeContacto(c) || '';
  const provSlug     = slug(proveedorKey || provNombre);
  if (_cache.dispSumCacheContact.has(provSlug)) return _cache.dispSumCacheContact.get(provSlug);

  let total = 0;
  try{
    if (providerKeyLooksValid(proveedorKey)) {
      const list = await getDisponibilidades({ proveedorKey });
      total = (Array.isArray(list) ? list : []).reduce((a,it)=> a + Number(it.tonsDisponible ?? it.tons ?? 0), 0);
    } else {
      const list = await getDisponibilidades({});
      total = (Array.isArray(list) ? list : [])
        .filter(it => slug(it.proveedorKey || it.empresaKey || it.proveedorNombre || it.empresaNombre || '') === provSlug)
        .reduce((a,it)=> a + Number(it.tonsDisponible ?? it.tons ?? 0), 0);
    }
  }catch(e){ console.warn('[resumen] sumDisponibilidadesContacto error', e); total = 0; }

  _cache.dispSumCacheContact.set(provSlug, total);
  return total;
}

/* ======================= Agregaciones ======================= */
function filterByResp(items, getResp, resp){
  if (!resp) return items;
  return items.filter(it => (getResp(it) || '').trim() === resp);
}
function aggregateVisitasByKey(key, isWeek, resp){
  const src = isWeek ? _cache.byWeekVis : _cache.byMonthVis;
  const visitasAll = (src.get(key) || []);
  const visitas = filterByResp(visitasAll, (v)=> v?.responsable || v?.contactoResponsable || v?.responsablePG || '', resp)
    .slice().sort((a,b)=>{
      const da = toDate(a.fecha) || toDate(a.proximoPasoFecha) || new Date(0);
      const db = toDate(b.fecha) || toDate(b.proximoPasoFecha) || new Date(0);
      return db - da;
    });
  const empresas = uniq(visitas.map(proveedorDeVisita)).filter(Boolean);
  const comunas  = uniq(visitas.map(comunaDeVisita)).filter(Boolean);
  const centros  = uniq(visitas.map(centroCodigoDeVisita)).filter(Boolean);
  const totalConversadas = visitas.reduce((acc,v)=> acc + Number(v.tonsComprometidas || 0), 0);
  return { visitas, empresas, comunas, centros, totalConversadas, count: visitas.length };
}
async function aggregateContactosByKeyAsync(key, isWeek, resp){
  const src = isWeek ? _cache.byWeekCont : _cache.byMonthCont;
  const contactosAll = (src.get(key) || []);
  const contactos = filterByResp(contactosAll, (c)=> c?.responsable || c?.contactoResponsable || c?.responsablePG || '', resp)
    .slice().sort((a,b)=>{
      const da = toDate(fechaDeContacto(a)) || new Date(0);
      const db = toDate(fechaDeContacto(b)) || new Date(0);
      return db - da;
    });
  const empresas = uniq(contactos.map(proveedorDeContacto)).filter(Boolean);
  const comunas  = uniq(contactos.map(comunaDeContacto)).filter(Boolean);
  const centros  = uniq(contactos.map(centroCodigoDeContacto)).filter(Boolean);
  let totalProducidas = 0;
  for (const c of contactos){ totalProducidas += await sumDisponibilidadesContacto(c); }
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
    ? [ kpi('Visitas realizadas', aggV.count), kpi('Tons conversadas', fmt2(aggV.totalConversadas || 0)), kpi('Centros distintos', (aggV.centros||[]).length), kpi('Comunas cubiertas', (aggV.comunas||[]).length) ].join('')
    : [ kpi('Contactos realizados', aggC.count), kpi('Tons producidas', fmt2(aggC.totalProducidas || 0)), kpi('Centros distintos', (aggC.centros||[]).length), kpi('Comunas cubiertas', (aggC.comunas||[]).length) ].join('');
  el.innerHTML = `<div class="kpi-row">${cardsHtml}</div>`;
}

/* ======================= Opciones Semana/Mes ======================= */
function allWeeks(){ return Array.from(new Set([ ..._cache.byWeekVis.keys(), ..._cache.byWeekCont.keys() ])).sort().reverse(); }
function allMonths(){ return Array.from(new Set([ ..._cache.byMonthVis.keys(), ..._cache.byMonthCont.keys() ])).sort().reverse(); }
function buildOptions(sel, items, current){
  if (!sel) return;
  const sig = items.join(',');
  if (sel.__sig === sig) { if (!sel.value && items.length) sel.value = current || items[0]; return; }
  sel.innerHTML = '';
  for (const it of items){ const opt = document.createElement('option'); opt.value = it; opt.textContent = it; sel.appendChild(opt); }
  if (items.length) sel.value = current || items[0];
  sel.__sig = sig;
}
function buildSemanaOptions(){ buildOptions(document.getElementById('resumen_semana'), allWeeks(), getCurrentWeekKey()); }
function buildMesOptions(){ buildOptions(document.getElementById('resumen_mes'), allMonths(), getCurrentMonthKey()); }

/* ======================= Tablas ======================= */
function ensureHeadColumns(tbody){
  const thead = tbody.closest('table')?.querySelector('thead tr');
  if (!thead) return;
  const want = _cache.mode === 'visitas' ? 7 : 6;
  if (thead.children.length === want) return;
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

    const provKey = v.proveedorKey || (v.contacto && v.contacto.proveedorKey) || '';
    const star = renderStarIfNuevo({ proveedorKey: provKey, proveedorNombre: prov });

    const sub = (contacto || resp) ? `<div class="subline">${esc(contacto || '')}${resp ? ` · Resp.: ${esc(resp)}`:''}</div>` : ``;

    return `<tr data-visita-id="${vid}">
      <td>${fmtDMYShort(toDate(v.fecha))}</td>
      <td><a href="#!" class="res-link js-open-visita" data-id="${vid}" title="Ver visita">${esc(prov)}</a>${star}${sub}</td>
      <td><span class="res-link js-open-visita" data-id="${vid}" title="Ver visita">${esc(centro)}</span></td>
      <td>${esc(comuna)}</td>
      <td data-col="tons">${tons}</td>
      <td>${fpp}</td>
      <td><span class="${chipCl}">${esc(estado || '—')}</span></td>
    </tr>`;
  }).join('');
  tbody.innerHTML = rowsHtml || '<tr><td colspan="7" class="grey-text">No hay visitas para este período.</td></tr>';
  tbody.querySelectorAll('.js-open-visita').forEach(a => {
    a.addEventListener('click', (e)=>{ e.preventDefault(); const id = a.getAttribute('data-id'); if (!id) return;
      document.dispatchEvent(new CustomEvent('visita:open-readonly', { detail:{ id } })); });
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
    const sumDisp = await sumDisponibilidadesContacto(c);
    const tons = sumDisp ? fmt2(sumDisp) : '—';
    const cid    = esc(c._id || '');
    const star = renderStarIfNuevo({ proveedorKey: c.proveedorKey || c.empresaKey || '', proveedorNombre: prov });

    rowsHtml += `<tr data-contacto-id="${cid}">
      <td>${fmtDMYShort(toDate(fechaDeContacto(c)))}</td>
      <td><a href="#!" class="res-link js-open-contacto" data-id="${cid}" title="Ver contacto">${esc(prov)}</a>${star}${contacto ? `<div class="subline">${esc(contacto)}</div>` : ``}</td>
      <td>${esc(centro)}</td>
      <td>${esc(comuna)}</td>
      <td data-col="tons">${tons}</td>
      <td>${esc(resp)}</td>
    </tr>`;
  }
  tbody.innerHTML = rowsHtml || '<tr><td colspan="6" class="grey-text">No hay contactos para este período.</td></tr>';
  tbody.querySelectorAll('.js-open-contacto').forEach(a => {
    a.addEventListener('click', (e)=>{ e.preventDefault(); const id = a.getAttribute('data-id'); if (!id) return;
      try { const c = (state.contactosGuardados||[]).find(x => String(x._id) === String(id));
        if (!c) return (window.M?.toast) && M.toast({ html:'Contacto no encontrado', classes:'red' });
        if (typeof window.abrirDetalleContacto === 'function') window.abrirDetalleContacto(c);
      } catch {}
    });
  });
  ensureFullWidthTable();
}
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

/* ======================= Controles (Semana/Mes/Resp) ======================= */
function ensureModeSwitcher(){
  const toolbar = document.querySelector('.resumen-toolbar');
  if (!toolbar) return;

  // Segmentado Semana/Mes (ya existe en HTML): sólo wiring
  const seg = document.getElementById('resumen_period');
  if (seg && !seg.__wired){
    seg.__wired = true;
    seg.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-period]');
      if (!btn) return;
      const period = btn.getAttribute('data-period');
      if (_cache.periodMode === period) return;
      _cache.periodMode = period;
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b===btn));
      document.getElementById('resumen_semana').parentElement.style.display = (period==='semana')?'':'none';
      document.getElementById('resumen_mes').parentElement.style.display    = (period==='mes')?'':'none';
      document.getElementById('resumen_titulo')?.textContent = (period==='semana') ? 'Informe semanal' : 'Informe mensual';
      await refreshResumen();
    });
  }

  // Poblar responsables (una vez)
  const selResp = document.getElementById('resumen_resp');
  if (selResp && !selResp.__filled){
    selResp.__filled = true;
    const set = new Set();
    (_cache.allVisitas || []).forEach(v=>{
      const r = v?.responsable || v?.contactoResponsable || v?.responsablePG;
      if (r) set.add(String(r));
    });
    (_cache.allContactos || []).forEach(c=>{
      const r = c?.responsable || c?.contactoResponsable || c?.responsablePG;
      if (r) set.add(String(r));
    });
    Array.from(set).sort().forEach(o=>{
      const op = document.createElement('option'); op.value = o; op.textContent = o; selResp.appendChild(op);
    });
  }

  const selSemana = document.getElementById('resumen_semana');
  const selMes    = document.getElementById('resumen_mes');

  if (selSemana && !selSemana.__wired){ selSemana.__wired = true; selSemana.addEventListener('change', () => refreshResumen()); }
  if (selMes && !selMes.__wired){ selMes.__wired = true; selMes.addEventListener('change', () => refreshResumen()); }
  if (selResp && !selResp.__wired){ selResp.__wired = true; selResp.addEventListener('change', () => { _cache.respFilter = selResp.value || ''; refreshResumen(); }); }

  // Visibilidad inicial
  const period = _cache.periodMode;
  document.getElementById('resumen_semana').parentElement.style.display = (period==='semana')?'':'none';
  document.getElementById('resumen_mes').parentElement.style.display    = (period==='mes')?'':'none';
}

function wireCopyPrint(){
  const btnPrint = $('#resumen_print');
  const btnCopy  = $('#resumen_copy');
  if (btnPrint && !btnPrint.__wired){ btnPrint.__wired = true; btnPrint.addEventListener('click', () => window.print()); }
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
}

/* ======================= API ======================= */
export async function initResumenSemanalTab(){
  await ensureData();
  ensureModeSwitcher();
  buildSemanaOptions();
  buildMesOptions();
  wireCopyPrint();
  syncHeaderWeekBadge();
  await refreshResumen();

  window.addEventListener('visita:created', async () => { _cache.allVisitas = []; _cache.byWeekVis.clear(); _cache.byMonthVis.clear(); await ensureData(); await refreshResumen(); });
  window.addEventListener('visita:updated', async () => { _cache.allVisitas = []; _cache.byWeekVis.clear(); _cache.byMonthVis.clear(); await ensureData(); await refreshResumen(); });
  window.addEventListener('visita:deleted', async () => { _cache.allVisitas = []; _cache.byWeekVis.clear(); _cache.byMonthVis.clear(); await ensureData(); await refreshResumen(); });
  document.addEventListener('reload-tabla-contactos', async () => {
    _cache.allContactos = []; _cache.byWeekCont.clear(); _cache.byMonthCont.clear(); _cache.dispSumCacheContact.clear();
    await ensureData(); await refreshResumen();
  });
}
export function setResumenMode(mode, opts = {}){
  if (mode !== 'visitas' && mode !== 'contactos') return;
  if (_cache.mode === mode) return;
  _cache.mode = mode;
  if (!opts.silentRewire) refreshResumen();
}

/* ======================= Header badge ======================= */
function syncHeaderWeekBadge(){
  const badge = document.getElementById('badgeSemanaActual');
  if (!badge) return;
  const span = badge.querySelector('span');
  const curr = getCurrentWeekKey();
  if (span) span.textContent = `Semana ${curr}`;
  badge.style.border = '1px solid #f59e0b';
  badge.style.background = '#fff7ed';
  badge.style.fontWeight = '700';
}

/* ======================= Refresh ======================= */
export async function refreshResumen(){
  await ensureData();
  buildSemanaOptions(); buildMesOptions();

  const selW = document.getElementById('resumen_semana');
  const selM = document.getElementById('resumen_mes');
  const selectedWeek  = (selW?.value) || getCurrentWeekKey();
  const selectedMonth = (selM?.value) || getCurrentMonthKey();

  const isWeek = _cache.periodMode === 'semana';
  const key = isWeek ? selectedWeek : selectedMonth;
  const resp = _cache.respFilter || (document.getElementById('resumen_resp')?.value || '');

  const top = document.getElementById('resumen_top');
  if (top){
    if (isWeek && key === getCurrentWeekKey()){
      top.innerHTML = `<div class="chip-estado" style="background:#fef3c7;border-color:#fde68a;color:#92400e">
        <i class="material-icons" style="font-size:16px">event</i> Semana actual: ${key}
      </div>`;
    } else {
      top.innerHTML = '';
    }
  }

  const aggV = aggregateVisitasByKey(key, isWeek, resp);
  const aggC = await aggregateContactosByKeyAsync(key, isWeek, resp);

  await renderKPIs(aggV, aggC);

  if (_cache.mode === 'visitas') renderTablaVisitas(aggV.visitas);
  else                           await renderTablaContactos(aggC.contactos);
}

/* ======================= Auto-init si está el tab ======================= */
if (document.getElementById('tab-resumen')) {
  initResumenSemanalTab().catch(err => console.error('[resumen] init error', err));
}

