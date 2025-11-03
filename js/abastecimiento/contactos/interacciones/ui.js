// /js/abastecimiento/contactos/interacciones/ui.js
import { list } from './api.js';
import { renderTable } from './table.js';
import { mountAgendaLite } from './agenda-lite.js';
import { openInteraccionModal } from './modal.js';

// 👇 para que agenda-lite pueda abrir el modal al hacer doble-click
if (typeof window !== 'undefined') {
  window.openInteraccionModal = openInteraccionModal;
}

const DEBUG_CAL = false; // ponlo en true si quieres logs de calendario

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

    <div id="int-llamadas" class="section">
      <div class="row" id="int-kpis" style="margin-top:8px;"></div>
      <div id="int-table-wrap" class="mmpp-table-wrap"></div>
    </div>

    <div id="int-calendario" class="section hide"></div>
  `;

  if (window.M && M.Tabs) {
    M.Tabs.init(root.querySelectorAll('.tabs'), {});
  }

  document.getElementById('btn-nueva-int').addEventListener('click', () => {
    openInteraccionModal({ onSaved: refreshAll });
  });

  renderTable(document.getElementById('int-table-wrap'), { onChanged: updateKPIs });

  const llamadasDiv = root.querySelector('#int-llamadas');
  const calDiv      = root.querySelector('#int-calendario');
  const tabL        = root.querySelector('a[href="#int-llamadas"]');
  const tabC        = root.querySelector('a[href="#int-calendario"]');

  tabL.addEventListener('click', () => {
    llamadasDiv.classList.remove('hide');
    calDiv.classList.add('hide');
  });

  tabC.addEventListener('click', async () => {
    llamadasDiv.classList.add('hide');
    calDiv.classList.remove('hide');

    if (calDiv.dataset.mounted) return;

    // ⛳ IMPORTANTE: el calendario muestra lo AGENDADO → pedir por fechaProximo
    const { fromProx, toProx } = proxWindowAround(new Date(), 2); // ±2 meses
    let items = [];
    try {
      const resp = await list({ fromProx, toProx, limit: 2000 });
      items = (resp && Array.isArray(resp.items)) ? resp.items : [];
      if (DEBUG_CAL) console.log('[CAL] fetched by fechaProximo:', items.length, { fromProx, toProx });
    } catch (e) {
      console.error('[CAL] fetch error:', e);
      items = [];
    }

    mountAgendaLite(calDiv, items);
    calDiv.dataset.mounted = '1';
  });

  async function refreshAll(){
    await updateKPIs();
    if (calDiv.dataset.mounted){
      const { fromProx, toProx } = proxWindowAround(new Date(), 2);
      let items = [];
      try {
        const resp = await list({ fromProx, toProx, limit: 2000 });
        items = (resp && Array.isArray(resp.items)) ? resp.items : [];
        if (DEBUG_CAL) console.log('[CAL] refresh fetched:', items.length);
      } catch (_) { items = []; }
      mountAgendaLite(calDiv, items);
    }
  }

  async function updateKPIs(rows){
    try{
      if (!rows){
        const semana = currentIsoWeek();
        // KPIs de la TABLA: se calculan por semana de la interacción (fecha)
        const resp = await list({ semana });
        rows = resp.items || [];
      }

      const canonEstado = s => (String(s||'').toLowerCase() === 'completado' ? 'hecho' : String(s||'').toLowerCase());
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

/* ===== utilidades ===== */

// semana ISO de la interacción (para KPIs)
function currentIsoWeek(d = new Date()){
  if (window.app?.utils?.isoWeek) {
    const w = window.app.utils.isoWeek(d);
    return `${d.getFullYear()}-W${String(w).padStart(2,'0')}`;
  }
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7; // 0..6 (0=Lun)
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3); // jueves de esa semana
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((tmp - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6)%7)) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}

/**
 * Ventana centrada en `base` para pedir por fechaProximo (agendados).
 * @param {Date} base
 * @param {number} monthsAheadBehind  cantidad de meses hacia atrás/adelante (default 2)
 * @returns {{fromProx:string, toProx:string}}
 */
function proxWindowAround(base = new Date(), monthsAheadBehind = 2){
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const from = new Date(Date.UTC(y, m - monthsAheadBehind, 1, 0,0,0,0));
  const to   = new Date(Date.UTC(y, m + monthsAheadBehind + 1, 1, 0,0,0,0)); // excluyente
  return { fromProx: from.toISOString(), toProx: to.toISOString() };
}

function fmtNum(n){
  const v = Number(n)||0;
  return v.toLocaleString('es-CL', { maximumFractionDigits: 2 });
}
