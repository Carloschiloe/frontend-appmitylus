import { list } from './api.js';
import { renderTable } from './table.js';
import { mountCalendar } from './calendar.js';
import { openInteraccionModal } from './modal.js';

export function mountInteracciones(root){
  injectStyles();

  root.innerHTML = `
    <div class="interacciones-toolbar" style="display:flex;justify-content:space-between;align-items:center;margin:6px 0 10px">
      <ul class="tabs">
        <li class="tab"><a class="active" href="#int-llamadas">Llamadas/Acuerdos</a></li>
        <li class="tab"><a href="#int-calendario">Calendario</a></li>
      </ul>
      <button id="btn-nueva-int" class="btn">+ Llamada/Acuerdo</button>
    </div>

    <div id="int-llamadas">
      <div class="row" id="int-kpis" style="margin-top:8px;"></div>
      <div id="int-table-wrap" class="mmpp-table-wrap"></div>
    </div>

    <div id="int-calendario" class="hide"></div>
  `;

  document.getElementById('btn-nueva-int').addEventListener('click', () => {
    openInteraccionModal({ onSaved: refreshAll });
  });

  renderTable(document.getElementById('int-table-wrap'), { onChanged: updateKPIs });
  const calTab = root.querySelector('a[href="#int-calendario"]');
  const calDiv = root.querySelector('#int-calendario');
  calTab.addEventListener('click', async () => {
    if (!calDiv.dataset.mounted){
      const { items } = await list({ scope:'mes' });
      mountCalendar(calDiv, items);
      calDiv.dataset.mounted = '1';
    }
    calDiv.classList.remove('hide');
  });

  async function refreshAll(){
    await updateKPIs();
    // fuerza refresh del calendario si estaba montado
    if (calDiv.dataset.mounted){
      const { items } = await list({ scope:'mes' });
      mountCalendar(calDiv, items);
    }
  }

  async function updateKPIs(rows){
    // Si la tabla no pasó rows, lee semana
    if (!rows){
      const resp = await list({ scope:'semana' });
      rows = resp.items || [];
    }
    const k = {
      llamadas: rows.filter(r => r.tipo==='llamada').length,
      acuerdos: rows.filter(r => !!r.proximoPaso && !!r.fechaProx).length,
      cumplidos: rows.filter(r => r.estado==='completado').length,
      tons: rows.reduce((s,r)=> s + (Number(r.tonsConversadas)||0), 0)
    };
    const conv = k.llamadas ? Math.round((k.acuerdos / k.llamadas)*100) : 0;

    document.getElementById('int-kpis').innerHTML = `
      <div class="col s12 m2"><div class="card kpi"><div class="card-content center">Llamadas<br><b>${k.llamadas}</b></div></div></div>
      <div class="col s12 m2"><div class="card kpi"><div class="card-content center">Acuerdos con fecha<br><b>${k.acuerdos}</b></div></div></div>
      <div class="col s12 m2"><div class="card kpi"><div class="card-content center">% Conversión<br><b>${conv}%</b></div></div></div>
      <div class="col s12 m2"><div class="card kpi"><div class="card-content center">Cumplidos<br><b>${k.cumplidos}</b></div></div></div>
      <div class="col s12 m4"><div class="card kpi"><div class="card-content center">Tons conversadas<br><b>${formatCLP(k.tons).replace('$','')} t</b></div></div></div>
    `;
  }
}

function injectStyles(){
  if (document.getElementById('interacciones-styles')) return;
  const s = document.createElement('style');
  s.id = 'interacciones-styles';
  s.textContent = `
    .kpi .card-content{ padding:14px 12px; }
    #int-calendario ul{ list-style:none; padding-left:0; }
  `;
  document.head.appendChild(s);
}

function formatCLP(value){
  try { return new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',minimumFractionDigits:0}).format(Number(value)||0); }
  catch { return '$' + (Number(value)||0).toLocaleString('es-CL'); }
}
