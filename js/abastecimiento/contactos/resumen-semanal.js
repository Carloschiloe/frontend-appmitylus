// /js/abastecimiento/contactos/resumen-semanal.js
import { state, $ } from './state.js';
import { getAll as getAllVisitas } from '../visitas/api.js';
import { normalizeVisita } from '../visitas/normalizers.js';

/* ======================= Estilos del módulo (inyección segura) ======================= */
(function injectResumenStyles(){
  if (document.getElementById('resumen-semanal-styles')) return;
  const s = document.createElement('style');
  s.id = 'resumen-semanal-styles';
  s.textContent = `
    /* layout base */
    #tab-resumen{ padding: 8px 4px 24px; }
    #tab-resumen h5{ font-weight:600; letter-spacing: .2px; }
    .resumen-toolbar{ margin: 8px 0 4px; }

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
    @media (min-width: 600px){ .col-6{ grid-column: span 6; } }
    @media (min-width: 992px){ .col-3{ grid-column: span 3; } }

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

    /* print: fondo blanco, sin barras ni select */
    @media print{
      nav, .tabs, .resumen-toolbar{ display:none !important; }
      body{ background:#fff !important; }
      #tab-resumen{ padding:0; }
      #resumen_print_area{ margin:0; }
      #resumen_print_area h5{ margin-top:0; }
    }
  `;
  document.head.appendChild(s);
})();

/* ======================= Utils ======================= */
const fmt2 = (n) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 });
const ymd = (d) => (d instanceof Date && !isNaN(d)) ? d.toISOString().slice(0,10) : '—';
const toDate = (v) => { if (!v) return null; try { return (v instanceof Date) ? v : new Date(v); } catch { return null; } };
const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));

// Semana ISO (Lunes=1), usando jueves ISO y CEIL
function isoWeek(date) {
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

/* ======================= Resolutores robustos ======================= */
function resolveProveedor(v){
  // Prueba distintos campos comunes
  return (
    v.contacto?.empresaNombre ||
    v.proveedorNombre ||
    v.empresaNombre ||
    v.empresa ||
    v.contacto?.nombre ||
    v.proveedor?.nombre ||
    null
  );
}
function resolveComuna(v){
  return (
    v.comuna ||
    v.contacto?.comuna ||
    v.centro?.comuna ||
    null
  );
}
function resolveCentro(v){
  return (
    v.centroCodigo ||
    v.centroId ||
    v.centro?.codigo ||
    v.centro?.id ||
    null
  );
}

/* ======================= Cache en memoria ======================= */
let _cache = { allVisitas: [], byWeek: new Map(), optionsSig: null };

async function ensureVisitas() {
  if (_cache.allVisitas.length) return _cache.allVisitas;

  const raw = await getAllVisitas();
  const list = Array.isArray(raw) ? raw.map(normalizeVisita) : [];
  _cache.allVisitas = list;

  // pre-index por semana (usar fecha de visita o del próximo paso)
  const byWeek = new Map();
  for (const v of list){
    const dt = toDate(v.fecha) || toDate(v.proximoPasoFecha);
    if (!dt) continue;
    const wk = weekKeyFromDate(dt);
    if (!byWeek.has(wk)) byWeek.set(wk, []);
    byWeek.get(wk).push(v);
  }
  _cache.byWeek = byWeek;
  _cache.optionsSig = null;
  return list;
}

/* ======================= Render ======================= */
function buildSemanaOptions() {
  const sel = document.getElementById('resumen_semana');
  if (!sel) return;

  const weeks = Array.from(_cache.byWeek.keys()).sort().reverse();
  const sig = weeks.join(',');
  if (_cache.optionsSig === sig) return;

  sel.innerHTML = '';
  for (const wk of weeks){
    const opt = document.createElement('option');
    opt.value = wk;
    opt.textContent = wk;
    sel.appendChild(opt);
  }
  if (weeks.length) sel.value = weeks[0];
  _cache.optionsSig = sig;
}

function aggregateForWeek(wk){
  // ordenar por fecha desc para la tabla
  const visitas = (_cache.byWeek.get(wk) || []).slice().sort((a,b)=>{
    const da = toDate(a.fecha) || toDate(a.proximoPasoFecha) || new Date(0);
    const db = toDate(b.fecha) || toDate(b.proximoPasoFecha) || new Date(0);
    return db - da;
  });

  // conjuntos sin placeholders
  const empresas = uniq(visitas.map(resolveProveedor)).filter(x => x && x !== '—');
  const comunas  = uniq(visitas.map(resolveComuna)).filter(x => x && x !== '—');
  const centros  = uniq(visitas.map(resolveCentro)).filter(x => x && x !== '—');

  const totalTons = visitas.reduce((acc, v) => acc + Number(v.tonsComprometidas || 0), 0);

  // Top proveedores por nº de visitas (ignora vacíos)
  const cnt = Object.create(null);
  visitas.forEach(v => {
    const key = resolveProveedor(v);
    if (!key) return;
    cnt[key] = (cnt[key] || 0) + 1;
  });
  const topProveedores = Object.entries(cnt)
    .sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([name,count])=>({name,count}));

  return { visitas, empresas, comunas, centros, totalTons, topProveedores };
}

function kpiCard(label, val){
  return `
    <div class="col s12 m6 l3">
      <div class="card z-depth-0" style="border:1px solid #e5e7eb; border-radius:12px">
        <div class="card-content">
          <span class="grey-text text-darken-1" style="font-size:12px">${label}</span>
          <h5 style="margin:6px 0 0">${val}</h5>
        </div>
      </div>
    </div>
  `;
}

function renderKPIs(agg){
  const el = $('#resumen_kpis');
  if (!el) return;
  el.innerHTML = `
    <div class="row" style="margin-top:8px">
      ${kpiCard("Empresas visitadas", agg.empresas.length)}
      ${kpiCard("Visitas realizadas", agg.visitas.length)}
      ${kpiCard("Tons comprometidas", fmt2(agg.totalTons))}
      ${kpiCard("Centros distintos", agg.centros.length)}
      ${kpiCard("Comunas cubiertas", agg.comunas.length)}
    </div>
  `;
}

function renderTop(agg){
  const el = $('#resumen_top');
  if (!el) return;
  const items = (agg.topProveedores.length
    ? agg.topProveedores.map(p =>
        `<li class="collection-item">${p.name}<span class="secondary-content">${p.count}</span></li>`
      ).join('')
    : '<li class="collection-item">—</li>');
  el.innerHTML = `
    <h6 style="margin-top:12px">Top proveedores por nº de visitas</h6>
    <ul class="collection">${items}</ul>
  `;
}

function renderTabla(visitas){
  const tbody = $('#resumen_table_body');
  if (!tbody) return;

  const rows = visitas.map(v => {
    const f      = toDate(v.fecha);
    const fNext  = toDate(v.proximoPasoFecha);
    const prov   = resolveProveedor(v) || '—';
    const centro = resolveCentro(v) || '—';
    const comuna = resolveComuna(v) || '—';
    const tons   = v.tonsComprometidas ? fmt2(v.tonsComprometidas) : '—';
    const estado = v.estado || '—';

    return `<tr>
      <td>${ymd(f)}</td>
      <td>${prov}</td>
      <td>${centro}</td>
      <td>${comuna}</td>
      <td>${tons}</td>
      <td>${ymd(fNext)}</td>
      <td>${estado}</td>
    </tr>`;
  }).join('');

  // Ajusta headers si aún no tienen la nueva columna
  const thead = tbody.closest('table')?.querySelector('thead tr');
  if (thead && thead.children.length === 6) {
    // Añade "Fecha prox." antes de Estado
    const th = document.createElement('th');
    th.textContent = 'Fecha prox.';
    thead.insertBefore(th, thead.lastElementChild);
  }

  tbody.innerHTML = rows || '<tr><td colspan="7" class="grey-text">No hay visitas para esta semana.</td></tr>';
}

/* ======================= Controles ======================= */
function wireControls(){
  const sel = $('#resumen_semana');
  const btnPrint = $('#resumen_print');
  const btnCopy = $('#resumen_copy');

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
      const area = document.getElementById('resumen_print_area');
      if (!area) return;
      const html = area.outerHTML;
      try {
        if (navigator.clipboard?.write) {
          const type = 'text/html';
          const blob = new Blob([html], { type });
          const data = [new ClipboardItem({ [type]: blob })];
          await navigator.clipboard.write(data);
        } else {
          const range = document.createRange();
          range.selectNode(area);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand('copy');
          sel.removeAllRanges();
        }
        (window.M?.toast) && M.toast({ html: 'Resumen copiado', displayLength: 1500 });
      } catch {
        try {
          await navigator.clipboard.writeText(area.innerText);
          (window.M?.toast) && M.toast({ html: 'Resumen copiado (texto)', displayLength: 1500 });
        } catch {}
      }
    });
  }
}

/* ======================= API ======================= */
export async function initResumenSemanalTab(){
  await ensureVisitas();
  buildSemanaOptions();
  wireControls();
  refreshResumen();
}

export function refreshResumen(){
  const wk = ($('#resumen_semana')?.value) || '';
  const agg = aggregateForWeek(wk);
  renderKPIs(agg);
  renderTop(agg);
  renderTabla(agg.visitas);
}
