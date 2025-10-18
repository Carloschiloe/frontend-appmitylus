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
    /* KPI cards */
    .kpi-grid{ display:grid; grid-template-columns: repeat(12, 1fr); gap:12px; }
    .kpi-card{
      border:1px solid #e5e7eb; border-radius:14px; background:#fff;
      padding:14px 16px; box-shadow: 0 1px 1px rgba(0,0,0,.03);
      display:flex; flex-direction:column; justify-content:center; min-height:92px;
    }
    .kpi-card .kpi-label{ font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:.6px; }
    .kpi-card .kpi-value{ font-size:26px; margin-top:6px; line-height:1.1; font-weight:600; color:#111827; }
    /* responsive columnas */
    .col-12{ grid-column: span 12; }
    @media (min-width:600px){ .col-6{ grid-column: span 6; } }
    @media (min-width:992px){ .col-3{ grid-column: span 3; } }
    /* tabla */
    #resumen_print_area table.striped thead th{
      font-size:12px; color:#6b7280; font-weight:600; border-bottom:1px solid #e5e7eb;
    }
    #resumen_print_area table.striped tbody td{ padding:10px 12px; }
    /* panel lateral (top proveedores) */
    #resumen_top h6{ font-weight:600; margin: 4px 0 8px; }
    #resumen_top .collection{ border-radius:12px; overflow:hidden; border:1px solid #e5e7eb; }
    #resumen_top .collection .collection-item{ display:flex; justify-content:space-between; }
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
const fmt2 = (n) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 });
const ymd  = (d) => (d instanceof Date && !isNaN(d)) ? d.toISOString().slice(0,10) : '—';
const toDate = (v) => { if (!v) return null; try { return (v instanceof Date) ? v : new Date(v); } catch { return null; } };
const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));

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
  // por contactoId
  const id = v?.contactoId ? String(v.contactoId) : null;
  if (!id) return '';
  const c = (state.contactosGuardados || []).find(x => String(x._id) === id);
  return c?.proveedorNombre || c?.empresaNombre || '';
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
// CONTACTOS (llamadas/gestiones)
function proveedorDeContacto(c){
  return c?.proveedorNombre || c?.empresaNombre || c?.empresa || c?.contacto?.empresaNombre || '';
}
function fechaDeContacto(c){
  return c?.fecha || c?.fechaContacto || c?.createdAt || null;
}
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

/* ======================= Cache ======================= */
let _cache = {
  allVisitas: [], byWeekVis: new Map(),
  allContactos: [], byWeekCont: new Map(),
  optionsSig: null,
  mode: 'visitas' // 'visitas' | 'contactos'
};

async function ensureData(){
  // VISITAS (desde API, normalizadas)
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

  // CONTACTOS (del estado en memoria que ya carga index.js)
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
  // unión de semanas de visitas y contactos
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

  // Si estamos en VISITAS debemos tener 7 columnas (incluye "Fecha prox.")
  // Si estamos en CONTACTOS: 6 columnas (sin "Fecha prox.")
  const want = _cache.mode === 'visitas' ? 7 : 6;
  const curr = thead.children.length;
  if (want === curr) return;

  // Limpia y vuelve a construir el header acorde al modo
  thead.innerHTML = (_cache.mode === 'visitas')
    ? `<th>Fecha</th><th>Proveedor</th><th>Centro</th><th>Comuna</th><th>Tons</th><th>Fecha prox.</th><th>Estado</th>`
    : `<th>Fecha</th><th>Proveedor</th><th>Centro</th><th>Comuna</th><th>Tons</th><th>Responsable</th>`;
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

  const cnt = Object.create(null);
  visitas.forEach(v => {
    const k = proveedorDeVisita(v);
    if (!k) return; cnt[k] = (cnt[k]||0)+1;
  });
  const topProveedores = Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([name,count])=>({name,count}));

  return { visitas, empresas, comunas, centros, totalTons, topProveedores, count: visitas.length };
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
  const totalTons = contactos.reduce((acc,c)=>acc+Number(c.tons||c.tonsComprometidas||0),0);

  const cnt = Object.create(null);
  contactos.forEach(c => {
    const k = proveedorDeContacto(c);
    if (!k) return; cnt[k] = (cnt[k]||0)+1;
  });
  const topProveedores = Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([name,count])=>({name,count}));

  return { contactos, empresas, comunas, centros, totalTons, topProveedores, count: contactos.length };
}

/* ======================= KPIs / Top ======================= */
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

function renderTop(items, titulo){
  const el = $('#resumen_top'); if (!el) return;
  const list = (items && items.length)
    ? items.map(p => `<li class="collection-item">${p.name}<span class="secondary-content">${p.count}</span></li>`).join('')
    : '<li class="collection-item">—</li>';
  el.innerHTML = `<h6 style="margin-top:12px">${titulo}</h6><ul class="collection">${list}</ul>`;
}

/* ======================= Tablas ======================= */
function renderTablaVisitas(visitas){
  const tbody = $('#resumen_table_body'); if (!tbody) return;
  ensureHeadColumns(tbody);

  const rows = visitas.map(v => {
    const prov   = proveedorDeVisita(v) || '—';
    const centro = centroCodigoDeVisita(v) || '—';
    const comuna = comunaDeVisita(v) || '—';
    const tons   = v.tonsComprometidas ? fmt2(v.tonsComprometidas) : '—';
    return `<tr>
      <td>${ymd(toDate(v.fecha))}</td>
      <td>${prov}</td>
      <td>${centro}</td>
      <td>${comuna}</td>
      <td>${tons}</td>
      <td>${ymd(toDate(v.proximoPasoFecha))}</td>
      <td>${v.estado || '—'}</td>
    </tr>`;
  }).join('');
  tbody.innerHTML = rows || '<tr><td colspan="7" class="grey-text">No hay visitas para esta semana.</td></tr>';
}

function renderTablaContactos(contactos){
  const tbody = $('#resumen_table_body'); if (!tbody) return;
  ensureHeadColumns(tbody);

  const rows = contactos.map(c => {
    const prov   = proveedorDeContacto(c) || '—';
    const centro = centroCodigoDeContacto(c) || '—';
    const comuna = comunaDeContacto(c) || '—';
    const tons   = (c.tons ?? c.tonsComprometidas) ? fmt2(c.tons ?? c.tonsComprometidas) : '—';
    const resp   = c.responsable || c.contactoResponsable || '—';
    return `<tr>
      <td>${ymd(toDate(fechaDeContacto(c)))}</td>
      <td>${prov}</td>
      <td>${centro}</td>
      <td>${comuna}</td>
      <td>${tons}</td>
      <td>${resp}</td>
    </tr>`;
  }).join('');
  tbody.innerHTML = rows || '<tr><td colspan="6" class="grey-text">No hay contactos para esta semana.</td></tr>';
}

/* ======================= Controles (semana / modo) ======================= */
function ensureModeSwitcher(){
  // Inserta el control segmentado si no existe
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
  // lo ponemos a la derecha de la toolbar (junto a Copiar/Imprimir)
  toolbar.insertBefore(seg, toolbar.lastElementChild);

  seg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    const mode = btn.getAttribute('data-mode');
    if (_cache.mode === mode) return;
    _cache.mode = mode;
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b===btn));
    refreshResumen(); // re-render según modo
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

  // KPIs combinados
  renderKPIs(aggV, aggC);

  // Top depende del modo visible
  if (_cache.mode === 'visitas'){
    renderTop(aggV.topProveedores, 'Top proveedores por nº de visitas');
    renderTablaVisitas(aggV.visitas);
  } else {
    renderTop(aggC.topProveedores, 'Top proveedores por nº de contactos');
    renderTablaContactos(aggC.contactos);
  }
}
