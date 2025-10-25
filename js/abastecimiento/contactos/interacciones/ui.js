// /js/abastecimiento/contactos/interacciones/ui.js
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

    <div id="int-calendario" class="section"></div>
  `;

  // Crear nueva interacción
  document.getElementById('btn-nueva-int').addEventListener('click', () => {
    openInteraccionModal({ onSaved: refreshAll });
  });

  // Tabla (pasa rows a updateKPIs cuando cambian)
  renderTable(document.getElementById('int-table-wrap'), { onChanged: updateKPIs });

  // Calendario: montar lazy al abrir la pestaña
  const calTabLink = root.querySelector('a[href="#int-calendario"]');
  const calDiv = root.querySelector('#int-calendario');

 calTabLink.addEventListener('click', async () => {
  if (calDiv.dataset.mounted) return;
  const { from, to } = currentMonthRange();

  let items = [];
  try {
    const resp = await list({ from, to });
    items = (resp && resp.items) || [];
  } catch (e) {
    // backend aún no existe → montamos calendario vacío (solo UI)
    items = [];
  }

  mountCalendar(calDiv, items);
  calDiv.dataset.mounted = '1';
});


  // ===== helpers internos =====
  async function refreshAll(){
    // refresca KPIs de la semana actual
    await updateKPIs();

    // fuerza refresh del calendario si ya estaba montado (mes visible actual)
    if (calDiv.dataset.mounted){
      const { from, to } = currentMonthRange();
      const { items = [] } = await list({ from, to });
      mountCalendar(calDiv, items);
    }
  }

  async function updateKPIs(rows){
    try{
      // Si la tabla no pasó rows, traemos semana actual al backend
      if (!rows){
        const semana = currentIsoWeek();
        const resp = await list({ semana });
        rows = resp.items || [];
      }

      // normalizaciones
      const canonEstado = s => {
        const raw = String(s || '').toLowerCase();
        return raw === 'completado' ? 'hecho' : raw;
      };
      const isLlamada = r => String(r.tipo||'').toLowerCase().trim() === 'llamada';
      const hasAcuerdoConFecha = r => !!(r.proximoPaso && (r.proximoPasoFecha || r.fechaProx));

      const k = {
        llamadas: rows.filter(isLlamada).length,
        acuerdos: rows.filter(hasAcuerdoConFecha).length,
        cumplidos: rows.filter(r => canonEstado(r.estado) === 'hecho').length,
        tons: rows.reduce((s,r)=> s + (Number(r.tonsConversadas)||0), 0)
      };
      const conv = k.llamadas ? Math.round((k.acuerdos / k.llamadas)*100) : 0;

      document.getElementById('int-kpis').innerHTML = `
        <div class="col s12 m2"><div class="card kpi"><div class="card-content center">Llamadas<br><b>${k.llamadas}</b></div></div></div>
        <div class="col s12 m2"><div class="card kpi"><div class="card-content center">Acuerdos con fecha<br><b>${k.acuerdos}</b></div></div></div>
        <div class="col s12 m2"><div class="card kpi"><div class="card-content center">% Conversión<br><b>${conv}%</b></div></div></div>
        <div class="col s12 m2"><div class="card kpi"><div class="card-content center">Cumplidos<br><b>${k.cumplidos}</b></div></div></div>
        <div class="col s12 m4"><div class="card kpi"><div class="card-content center">Tons conversadas<br><b>${fmtNum(k.tons)} t</b></div></div></div>
      `;
    } catch(e){
      console.error(e);
      if (window.M && M.toast) M.toast({ html:'Error al calcular KPIs', classes:'red' });
    }
  }
}

/* ===== estilos mínimos locales ===== */
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

/* ===== utilidades de fecha/número ===== */
function currentIsoWeek(d = new Date()){
  // Usa helper global si existe para mantener consistencia con el resto de la app
  if (window.app?.utils?.isoWeek) {
    const w = window.app.utils.isoWeek(d);
    return `${d.getFullYear()}-W${String(w).padStart(2,'0')}`;
  }
  // Fallback ISO-8601
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7; // 0..6 (0=Lun)
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3); // jueves de esa semana
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((tmp - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6)%7)) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}

function currentMonthRange(base = new Date()){
  const y = base.getFullYear(), m = base.getMonth();
  const from = new Date(y, m, 1);
  const to   = new Date(y, m+1, 0, 23, 59, 59, 999);
  const iso = d => d.toISOString().slice(0,10);
  return { from: iso(from), to: iso(to) };
}

function fmtNum(n){
  const v = Number(n)||0;
  return v.toLocaleString('es-CL', { maximumFractionDigits: 2 });
}

