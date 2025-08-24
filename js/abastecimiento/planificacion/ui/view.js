// /js/abastecimiento/planificacion/ui/view.js
// UI de alto nivel: DataTable/KPIs/Realtime/Gantt. Usa charts.js para los gráficos.

import { initCharts, updateCharts } from './charts.js';
import { escapeHtml } from '../utils.js';

const $ = window.jQuery; // DataTables requiere jQuery
const UI = { dt:null, nf: new Intl.NumberFormat('es-CL') };

export async function initUI(){
  M.Tabs.init(document.querySelectorAll('.tabs'));
  M.Modal.init(document.getElementById('modalBloque'));

  // DataTable principal
  UI.dt = $('#tablaProgramaSemanal').DataTable({
    data: [], dom:'Bfrtip',
    buttons:[
      { extend:'excelHtml5', title: ()=> tituloExport(), className:'btn-export-excel' },
      { extend:'pdfHtml5',   title: ()=> tituloExport(), orientation:'landscape', pageSize:'A4', className:'btn-export-pdf' }
    ],
    order:[[0,'asc']], pageLength:20, autoWidth:false,
    language:{ url:'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
    columnDefs:[
      {targets:0,type:'date',width:'120px'},
      {targets:3,type:'num',className:'right-align',width:'90px'},
      {targets:-1,orderable:false,searchable:false,width:'110px'}
    ]
  });
  document.getElementById('btnXls')?.addEventListener('click', ()=> UI.dt.button('.buttons-excel').trigger());
  document.getElementById('btnPdf')?.addEventListener('click', ()=> UI.dt.button('.buttons-pdf').trigger());

  // Gráficos
  initCharts();
}

/** Población de proveedores (datalist) y centros (select) */
export function populateProveedoresYCentros({ proveedores = [], centros = [] } = {}) {
  // Datalist de proveedores
  const dl = document.getElementById('dl_proveedores');
  if (dl) {
    dl.innerHTML = proveedores.map(p => `<option value="${escapeHtml(p)}"></option>`).join('');
  }
  // Select de centros
  const sel = document.getElementById('b_centro');
  if (sel) {
    let opts = `<option value="">Centro (opcional)</option>`;
    const list = centros.slice().sort((a,b)=> (a.code||'').localeCompare(b.code||''));
    opts += list.map(c =>
      `<option value="${escapeHtml(c.code||'')}">${escapeHtml((c.code||'') + (c.comuna? ' – '+c.comuna:''))}</option>`
    ).join('');
    sel.innerHTML = opts;
  }
}

export function planSetData({
  kpis={}, semanal=[], dias=[], estados=[], labelDias='Tons por día (semana)',
  rpa={labels:[],requerida:[],programada:[],abastecida:[]},
  rt={required:0,supplied:0,items:[]},
  mensualWeeks=[]
}={}){

  // KPIs
  setTxt('kpi_meta', kpis.meta ?? '—');
  setTxt('kpi_plan', kpis.plan ?? '—');
  setTxt('kpi_confirmado', kpis.confirmado ?? '—');
  setTxt('kpi_requerida', kpis.requerida ?? '—');
  setTxt('kpi_abastecida', kpis.abastecida ?? '—');
  setCumplimientoBar(kpis.cumplimiento ?? 0);

  // Tabla
  updateTable(semanal);

  // Gráficos
  updateCharts({ kpis, dias, estados, rpa, labelDias });

  // Realtime + Gantt
  setRealtime(rt.required||0, rt.supplied||0);
  updateRealtimeList(rt.items||[], rt.required||0);
  renderGanttMes(mensualWeeks||[]);
}

/* ===== Tabla ===== */
function updateTable(semanal){
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const rows = (semanal||[]).map(r => ([
    `<span data-order="${esc(r.fechaISO||r.fecha||'')}">${esc(r.fecha||'')}</span>`,
    esc(r.proveedor), esc(r.centro), r.tons ?? '', esc(r.estado), esc(r.prioridad), esc(r.origen), esc(r.notas),
    `<a href="#" class="icon-action editar" data-id="${esc(r._id||'')}" title="Editar"><i class="material-icons">edit</i></a>
     <a href="#" class="icon-action eliminar" data-id="${esc(r._id||'')}" title="Eliminar"><i class="material-icons">delete</i></a>`
  ]));
  UI.dt.clear(); UI.dt.rows.add(rows).draw();
}

/* ===== KPIs ===== */
function setTxt(id, val){ const el=document.getElementById(id); if(el) el.textContent = val ?? '—'; }
function setCumplimientoBar(pct){ const v = Number.isFinite(pct) ? pct : 0; const elPct = document.getElementById('kpi_cumplimiento'); const bar = document.getElementById('kpi_bar'); if (elPct) elPct.textContent = `${v}%`; if (bar) bar.style.width = `${v}%`; }

/* ===== Realtime ===== */
function setRealtime(required, supplied){
  const r = Number(required)||0; const s = Number(supplied)||0; const pct = r>0 ? Math.min(100, Math.round((s/r)*100)) : 0;
  const bar = document.getElementById('rt_bar'); const lbl = document.getElementById('rt_label');
  if (bar) bar.style.width = pct + '%'; if (lbl) lbl.textContent = `${pct}% (${UI.nf.format(s)} / ${UI.nf.format(r)} t)`;
}
function updateRealtimeList(items=[], required=0){
  const ul = document.getElementById('rt_list'); if(!ul) return; ul.innerHTML = '';
  items.slice(0,5).forEach(it=>{
    const tons = Number(it.tons)||0; const pct = required>0 ? Math.min(100, (tons/required)*100) : 0;
    const li = document.createElement('li');
    li.innerHTML = `<div style="display:flex;justify-content:space-between;font-size:.9rem;color:#607d8b"><span>${it.fecha} · ${it.proveedor||''}</span><strong>${UI.nf.format(tons)} t</strong></div><div class="progress slim"><div class="determinate" style="width:${pct}%"></div></div>`;
    ul.appendChild(li);
  });
}

/* ===== Gantt ===== */
function renderGanttMes(weeks=[]){
  const el = document.getElementById('ganttMes'); if(!el) return; el.innerHTML = '';
  weeks.forEach(w=>{
    const meta = Number(w.meta)||0, plan = Number(w.plan)||0, real = Number(w.real)||0;
    const pctPlan = meta>0 ? Math.min(100,(plan/meta)*100) : 0;
    const pctReal = meta>0 ? Math.min(100,(real/meta)*100) : 0;
    const row = document.createElement('div'); row.className='gantt__row';
    row.innerHTML = `<div class="gantt__label">${w.label||''}</div><div class="gantt__track"><div class="gantt__bar gantt__bar--meta"></div><div class="gantt__bar gantt__bar--plan" style="width:${pctPlan}%"></div><div class="gantt__bar gantt__bar--real" style="width:${pctReal}%"></div></div>`;
    el.appendChild(row);
  });
}

/* ===== Aux ===== */
function tituloExport(){ const vista = document.getElementById('f_vista')?.value || 'vista'; const hoy = new Date().toISOString().slice(0,10); return `Programa_${vista}_${hoy}`; }
