// /js/abastecimiento/contactos/resumen-semanal.js
import { state, $ } from './state.js';
import { getAll as getAllVisitas } from '../visitas/api.js';
import { normalizeVisita, centroCodigoById } from '../visitas/normalizers.js';
import { escapeHtml, fetchJson } from './ui-common.js';
import { slug, pad2, weekKeyFromDate, monthKeyFromDate, getCurrentWeekKey, getCurrentMonthKey } from '../../core/utilidades.js';
import { toast } from '../../ui/toast.js';

/* ======================= Utils ======================= */
const API_BASE = window.API_URL || '/api';
const fmt2 = (n) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 });
const ymd  = (d) => (d instanceof Date && !isNaN(d)) ? d.toISOString().slice(0,10) : '-';
const toDate = (v) => { if (!v) return null; try { return (v instanceof Date) ? v : new Date(v); } catch { return null; } };
const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
const esc = escapeHtml;

/* Abreviaturas ES */
const MES_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const fmtDMYShort = (dt) => { const d = toDate(dt); return d ? `${pad2(d.getDate())}.${MES_ABBR[d.getMonth()]}.${String(d.getFullYear()).slice(-2)}` : '-'; };

/* Normaliza ids (string/number/ObjectId/{$oid}) */
function normId(v){
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object'){
    if (v.$oid) return String(v.$oid);
    if (v.oid)  return String(v.oid);
    if (typeof v.toString === 'function') return String(v.toString());
  }
  return String(v);
}

/* ======================= Resolutores ======================= */
// VISITAS
function proveedorDeVisita(v){
  const emb = v?.contacto?.empresaNombre || v?.proveedorNombre || v?.empresaNombre || v?.empresa;
  if (emb) return emb;
  const id = v?.contactoId ? normId(v.contactoId) : null;
  if (!id) return '';
  const c = (state.contactosGuardados || []).find(x => normId(x._id) === id);
  return c?.proveedorNombre || c?.empresaNombre || '';
}
function contactoDeVisita(v){
  const id = v?.contactoId ? normId(v.contactoId) : null;
  if (!id) return v?.contacto || '';
  const c = (state.contactosGuardados || []).find(x => normId(x._id) === id);
  return c?.contactoNombre || c?.contacto || v?.contacto || '';
}
/* === Resolver correcto del Responsable para una visita === */
function responsableDeVisita(v){
  const direct = v?.responsable || v?.contactoResponsable || v?.responsablePG;
  if (direct) return direct;
  const id = v?.contactoId ? normId(v.contactoId) : null;
  if (!id) return '';
  const c = (state.contactosGuardados || []).find(x => normId(x._id) === id);
  return c?.responsablePG || c?.responsable || c?.contactoResponsable || '';
}
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
  if (!e || e === 'sin accion') return 'chip-estado chip-na';
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
  allVisitas: [],  byWeekVis: new Map(),  byMonthVis: new Map(),
  allContactos: [], byWeekCont: new Map(), byMonthCont: new Map(),
  optionsSigW: null, optionsSigM: null,
  mode: 'visitas',          // visitas | contactos
  periodMode: 'semana',     // semana | mes
  respFilter: '',           // filtro por responsable
  dispSumCacheContact: new Map(),
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

/* ======================= Disponibilidades (API) ======================= */
async function getDisponibilidades(params = {}){
  const y = new Date().getFullYear();
  const q = new URLSearchParams();
  q.set('from', params.from || `${y-1}-01`);
  q.set('to',   params.to   || `${y+1}-12`);
  if (params.proveedorKey) q.set('proveedorKey', params.proveedorKey);
  if (params.centroId)     q.set('centroId', params.centroId);
  const json = await fetchJson(`${API_BASE}/disponibilidades?${q.toString()}`, { credentials: 'same-origin' });
  return Array.isArray(json) ? json : (json.items || []);
}
function providerKeyLooksValid(k){ return !!(k && typeof k === 'string' && k.trim().length >= 3); }

/* ===== CONTACTOS: sumar disponibilidades ===== */
async function sumDisponibilidadesContacto(c){
  const proveedorKey = c.proveedorKey || c.empresaKey || (c.empresa && c.empresa.key) || '';
  const provNombre   = proveedorDeContacto(c) || '';
  const provSlug     = slug(proveedorKey || provNombre);

  if (!provSlug) return 0;

  if (_cache.dispSumCacheContact.has(provSlug)) {
    return _cache.dispSumCacheContact.get(provSlug);
  }

  let list = [];
  try{
    list = providerKeyLooksValid(proveedorKey)
      ? await getDisponibilidades({ proveedorKey })
      : await getDisponibilidades({});
  }catch(e){
    console.warn('[resumen] sumDisponibilidadesContacto error', e);
    list = [];
  }

  const total = (Array.isArray(list) ? list : [])
    .filter(it => {
      const name = it.proveedorKey || it.empresaKey || it.proveedorNombre || it.empresaNombre || '';
      return name && slug(name) === provSlug;
    })
    .reduce((a,it)=> a + Number(it.tonsDisponible ?? it.tons ?? 0), 0);

  _cache.dispSumCacheContact.set(provSlug, total);
  return total;
}

/* ======================= Agregaciones + Filtros ======================= */
function filterByResp(items, getResp, resp){
  if (!resp) return items;
  return items.filter(it => (getResp(it) || '').trim() === resp);
}

function aggregateVisitasByKey(key, isWeek, resp){
  const src = isWeek ? _cache.byWeekVis : _cache.byMonthVis;
  const visitasAll = (src.get(key) || []);
  const visitas = filterByResp(
    visitasAll,
    (v)=> responsableDeVisita(v),
    resp
  ).slice().sort((a,b)=>{
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
  const contactos = filterByResp(
    contactosAll,
    (c)=> c?.responsablePG || c?.responsable || c?.contactoResponsable || '',
    resp
  ).slice().sort((a,b)=>{
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

/* ======================= Select Responsable (helpers) ======================= */
function collectResponsables(){
  const set = new Set();

  (_cache.allContactos || []).forEach(c=>{
    const r = c?.responsablePG || c?.responsable || c?.contactoResponsable;
    if (r && String(r).trim()) set.add(String(r).trim());
  });

  (_cache.allVisitas || []).forEach(v=>{
    const r = responsableDeVisita(v);
    if (r && String(r).trim()) set.add(String(r).trim());
  });

  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}

function fillResponsableSelect(){
  const sel = document.getElementById('resumen_resp');
  if (!sel) return;

  const items = collectResponsables();
  const sig = items.join('|');
  if (sel.__sig === sig && sel.options.length > 0) {
    return; // nada cambio
  }

  sel.innerHTML = '';
  const optEmpty = document.createElement('option');
  optEmpty.value = '';
  optEmpty.textContent = 'Responsable...';
  sel.appendChild(optEmpty);

  for (const r of items){
    const op = document.createElement('option');
    op.value = r; op.textContent = r;
    sel.appendChild(op);
  }
  sel.__sig = sig;
}

/* ======================= Tablas (sin cambios visuales) ======================= */
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
    const prov   = proveedorDeVisita(v) || '-';
    const contacto = contactoDeVisita(v) || '';
    const resp   = responsableDeVisita(v) || '';
    const centro = centroCodigoDeVisita(v) || '-';
    const comuna = comunaDeVisita(v) || '-';
    const tons   = (v.tonsComprometidas != null) ? fmt2(v.tonsComprometidas) : '-';
    const fpp    = fmtDMYShort(toDate(v.proximoPasoFecha));
    const estado = normalizeEstado(v.estado || '-');
    const chipCl = estadoClaseChip(estado);
    const vid = esc(v._id || '');

    const sub = (contacto || resp) ? `<div class="subline">${esc(contacto || '')}${resp ? `  Resp.: ${esc(resp)}`:''}</div>` : ``;

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
      <td><span class="${chipCl}">${esc(estado || '-')}</span></td>
    </tr>`;
  }).join('');

  tbody.innerHTML = rowsHtml || '<tr><td colspan="7" class="resumen-empty">No hay visitas para este periodo.</td></tr>';

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
    const prov   = proveedorDeContacto(c) || '-';
    const contacto = contactoNombreDeContacto(c) || '';
    const centro = centroCodigoDeContacto(c) || '-';
    const comuna = comunaDeContacto(c) || '-';
    const resp   = c.responsable || c.contactoResponsable || c.responsablePG || '-';

    // Sumatoria de disponibilidades = TONS PRODUCIDAS
    const sumDisp = await sumDisponibilidadesContacto(c);
    const tons = sumDisp ? fmt2(sumDisp) : '-';

    const cid = esc(c._id || '');
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

  tbody.innerHTML = rowsHtml || '<tr><td colspan="6" class="resumen-empty">No hay contactos para este periodo.</td></tr>';

  // abrir contacto
  tbody.querySelectorAll('.js-open-contacto').forEach(a => {
    a.addEventListener('click', (e)=>{
        e.preventDefault();
        const id = a.getAttribute('data-id'); if (!id) return;
        try {
          const c = (state.contactosGuardados||[]).find(x => String(x._id) === String(id));
          if (!c) return toast('Contacto no encontrado', { variant: 'error' });
          if (typeof window.abrirDetalleContacto === 'function') window.abrirDetalleContacto(c);
        } catch {}
      });
    });

  ensureFullWidthTable();
}

/* ===== Expandir tabla si el panel esta vacio ===== */
function ensureFullWidthTable(){
  const tableCol = document.querySelector('#resumen_print_area [data-resumen-col="main"]') || document.querySelector('#resumen_print_area [data-resumen-col]:first-child');
  const rightCol = document.querySelector('#resumen_print_area [data-resumen-col="side"]');
  const topBox   = document.getElementById('resumen_top');
  if (topBox && rightCol){
    const isEmpty = !topBox.innerHTML.trim();
    if (isEmpty){ rightCol.style.display = 'none'; if (tableCol) tableCol.classList.add('res-col-table','full-width'); }
    else { rightCol.style.display = ''; if (tableCol) tableCol.classList.remove('full-width'); }
  }
}

/* ======================= Controles (modo / periodo / selects) ======================= */
function ensureModeSwitcher(){
  const toolbar = document.querySelector('.resumen-toolbar');
  if (!toolbar) return;
  if (!document.getElementById('resumen_mode')){
    const seg = document.createElement('div');
    seg.className = 'segmented';
    seg.id = 'resumen_mode';
    seg.innerHTML = `
      <button data-mode="visitas" class="is-active">Visitas</button>
      <button data-mode="contactos">Contactos</button>
    `;
    toolbar.insertBefore(seg, toolbar.lastElementChild);
    seg.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-mode]'); if (!btn) return;
      const mode = btn.getAttribute('data-mode');
      if (_cache.mode === mode) return;
      _cache.mode = mode;
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b===btn));
      await refreshResumen();
    });
  }

  // Segmentado Semana/Mes
  const segPeriod = document.getElementById('resumen_period');
  const tituloEl  = document.getElementById('resumen_titulo');
  const selW = document.getElementById('resumen_semana');
  const selM = document.getElementById('resumen_mes');
  const applyVisibility = () => {
    if (selW && selW.parentElement) selW.parentElement.style.display = (_cache.periodMode === 'semana') ? '' : 'none';
    if (selM && selM.parentElement) selM.parentElement.style.display = (_cache.periodMode === 'mes') ? '' : 'none';
    if (tituloEl) tituloEl.textContent = (_cache.periodMode === 'semana') ? 'Informe semanal' : 'Informe mensual';
  };
  if (segPeriod && !segPeriod.__wired){
    segPeriod.__wired = true;
    segPeriod.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-period]'); if (!btn) return;
      const period = btn.getAttribute('data-period');
      if (_cache.periodMode === period) return;
      _cache.periodMode = period;
      (segPeriod.querySelectorAll('button[data-period]') || []).forEach(b => b.classList.toggle('is-active', b===btn));
      applyVisibility();
      await refreshResumen();
    });
    applyVisibility();
  }

  // Filtro Responsable (llenado idempotente + reinicializacion Materialize)
  const selResp = document.getElementById('resumen_resp');
  if (selResp && !selResp.__wired){
    selResp.__wired = true;
    selResp.addEventListener('change', () => { _cache.respFilter = selResp.value || ''; refreshResumen(); });
  }
  // Siempre intenta llenar (si cambia el dataset, se repinta)
  fillResponsableSelect();
}

function wireControls(){
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
        toast('Resumen copiado', { variant: 'success', durationMs: 1500 });
      } catch { try { await navigator.clipboard.writeText(area.innerText); } catch {} }
    });
  }

  ensureModeSwitcher();

  const selW = document.getElementById('resumen_semana');
  const selM = document.getElementById('resumen_mes');
  if (selW && !selW.__wired){ selW.__wired = true; selW.addEventListener('change', () => refreshResumen()); }
  if (selM && !selM.__wired){ selM.__wired = true; selM.addEventListener('change', () => refreshResumen()); }
}

/* ======================= API ======================= */
export async function initResumenSemanalTab(){
  await ensureData();
  buildSemanaOptions();
  buildMesOptions();
  wireControls();
  await refreshResumen();

  window.addEventListener('visita:created', async () => { _cache.allVisitas = []; _cache.byWeekVis.clear(); _cache.byMonthVis.clear(); await ensureData(); fillResponsableSelect(); await refreshResumen(); });
  window.addEventListener('visita:updated', async () => { _cache.allVisitas = []; _cache.byWeekVis.clear(); _cache.byMonthVis.clear(); await ensureData(); fillResponsableSelect(); await refreshResumen(); });
  window.addEventListener('visita:deleted', async () => { _cache.allVisitas = []; _cache.byWeekVis.clear(); _cache.byMonthVis.clear(); await ensureData(); fillResponsableSelect(); await refreshResumen(); });
  document.addEventListener('reload-tabla-contactos', async () => {
    _cache.allContactos = []; _cache.byWeekCont.clear(); _cache.byMonthCont.clear(); _cache.dispSumCacheContact.clear();
    await ensureData(); fillResponsableSelect(); await refreshResumen();
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

/* ======================= Refresh ======================= */
export async function refreshResumen(){
  await ensureData();
  buildSemanaOptions(); buildMesOptions();
  fillResponsableSelect(); // <-- actualizar combo de responsable con los datos vigentes

  const isWeek = _cache.periodMode === 'semana';
  const selW = document.getElementById('resumen_semana');
  const selM = document.getElementById('resumen_mes');

  // fallback valores por defecto
  if (isWeek && selW && !selW.value){ const weeks = allWeeks(); if (weeks.length) selW.value = weeks[0]; }
  if (!isWeek && selM && !selM.value){ const months = allMonths(); if (months.length) selM.value = months[0]; }

  const key  = isWeek ? ((selW && selW.value) || getCurrentWeekKey()) : ((selM && selM.value) || getCurrentMonthKey());
  const resp = _cache.respFilter || (document.getElementById('resumen_resp')?.value || '');

  const aggV = aggregateVisitasByKey(key, isWeek, resp);
  const aggC = await aggregateContactosByKeyAsync(key, isWeek, resp);

  await renderKPIs(aggV, aggC);

  if (_cache.mode === 'visitas') renderTablaVisitas(aggV.visitas);
  else                           await renderTablaContactos(aggC.contactos);
}

/* ======================= Auto-init si esta el tab ======================= */
if (document.getElementById('tab-resumen')) {
  initResumenSemanalTab().catch(err => console.error('[resumen] init error', err));
}
