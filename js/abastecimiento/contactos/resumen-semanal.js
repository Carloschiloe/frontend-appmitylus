
// /js/abastecimiento/contactos/resumen-semanal.js
import { state, $ } from './state.js';
import { getAll as getAllVisitas } from '../visitas/api.js';
import { normalizeVisita } from '../visitas/normalizers.js';

const fmtCL = (n) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
const fmt2  = (n) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 });

function toDate(v){
  if (!v) return null;
  try { return (v instanceof Date) ? v : new Date(v); } catch { return null; }
}
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
function uniq(arr){ return Array.from(new Set(arr.filter(Boolean))); }

let _cache = { allVisitas: [], byWeek: new Map() };

async function ensureVisitas() {
  if (_cache.allVisitas.length) return _cache.allVisitas;
  const raw = await getAllVisitas();
  const list = Array.isArray(raw) ? raw.map(normalizeVisita) : [];
  _cache.allVisitas = list;
  // pre-index by week
  _cache.byWeek = new Map();
  for (const v of list){
    const dt = toDate(v.fecha) || toDate(v.proximoPasoFecha);
    if (!dt) continue;
    const wk = weekKeyFromDate(dt);
    if (!_cache.byWeek.has(wk)) _cache.byWeek.set(wk, []);
    _cache.byWeek.get(wk).push(v);
  }
  return list;
}

function buildSemanaOptions() {
  const sel = document.getElementById('resumen_semana');
  if (!sel) return;
  sel.innerHTML = '';
  const weeks = Array.from(_cache.byWeek.keys()).sort().reverse();
  for (const wk of weeks){
    const opt = document.createElement('option');
    opt.value = wk;
    opt.textContent = wk;
    sel.appendChild(opt);
  }
  if (weeks.length) sel.value = weeks[0];
}

function aggregateForWeek(wk){
  const visitas = _cache.byWeek.get(wk) || [];
  const empresas = uniq(visitas.map(v => v.contacto?.empresaNombre || v.contacto?.nombre || v.contactoNombre || v.proveedorNombre));
  const responsables = uniq(visitas.map(v => v.contacto?.responsable || v.responsable || v.creadoPor));
  const comunas = uniq(visitas.map(v => v.comuna || v.contacto?.comuna));
  const centros = uniq(visitas.map(v => String(v.centroCodigo || v.centroId || '')));
  const totalTons = visitas.reduce((acc, v) => acc + Number(v.tonsComprometidas || 0), 0);

  // top proveedores por visitas
  const cnt = {};
  visitas.forEach(v => {
    const key = v.contacto?.empresaNombre || v.proveedorNombre || v.contacto?.nombre || '—';
    cnt[key] = (cnt[key] || 0) + 1;
  });
  const topProveedores = Object.entries(cnt)
    .sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([name,count])=>({name,count}));

  return {
    visitas,
    empresas,
    responsables,
    comunas,
    centros,
    totalTons,
    topProveedores
  };
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

function renderTop(agg){
  const el = $('#resumen_top');
  if (!el) return;
  const items = agg.topProveedores.map(p => `<li class="collection-item">${p.name}<span class="secondary-content">${p.count}</span></li>`).join('') || '<li class="collection-item">—</li>';
  el.innerHTML = `
    <h6 style="margin-top:12px">Top proveedores por nº de visitas</h6>
    <ul class="collection">${items}</ul>
  `;
}

function renderTabla(visitas){
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
    return `<tr>
      <td>${fstr}</td>
      <td>${prov}</td>
      <td>${centro}</td>
      <td>${comuna}</td>
      <td>${tons}</td>
      <td>${estado}</td>
    </tr>`;
  }).join('');
  tbody.innerHTML = rows || '<tr><td colspan="6" class="grey-text">No hay visitas para esta semana.</td></tr>';
}

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
      const range = document.createRange();
      range.selectNode(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('copy');
      sel.removeAllRanges();
      M.toast?.({ html: 'Resumen copiado', displayLength: 1500 });
    });
  }
}

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
