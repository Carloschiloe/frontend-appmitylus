// /js/abastecimiento/contactos/interacciones/ui.js
import { list } from './api.js';
import { renderTable } from './table.js';
import { mountAgendaLite } from './agenda-lite.js';
import { openInteraccionModal } from './modal.js';

// Exponer para que agenda-lite pueda abrir el modal al hacer doble-click
if (typeof window !== 'undefined') {
  window.openInteraccionModal = openInteraccionModal;
}

const DEBUG_CAL = false; // ponlo en true si quieres logs de calendario

export function mountInteracciones(root) {
  let tableApi = null;
  root.innerHTML = `
    <div class="interacciones-toolbar">
      <div class="int-tab-switch" role="tablist" aria-label="Secciones interacciones">
        <button type="button" class="int-tab-btn is-active" data-target="llamadas">Llamadas/Acuerdos</button>
        <button type="button" class="int-tab-btn" data-target="calendario">Calendario</button>
      </div>
      <button id="btn-nueva-int" class="mmpp-add int-new-btn">
        <i class="material-icons tiny">add</i>
        Nueva interaccion
      </button>
    </div>

    <div id="int-llamadas" class="section int-section-surface">
      <div class="row int-kpis-row" id="int-kpis"></div>
      <div id="int-table-wrap" class="mmpp-table-wrap"></div>
    </div>

    <div id="int-calendario" class="section hide"></div>
  `;

  document.getElementById('btn-nueva-int').addEventListener('click', () => {
    openInteraccionModal({ onSaved: refreshAll });
  });

  renderTable(document.getElementById('int-table-wrap'), { onChanged: updateKPIs })
    .then((api) => { tableApi = api; })
    .catch((e) => console.error('[int] renderTable error', e));

  root.querySelector('#int-kpis')?.addEventListener('click', (ev) => {
    const card = ev.target.closest?.('[data-kpi-key]');
    if (!card || !tableApi) return;
    tableApi.setQuickFilter(card.dataset.kpiKey || '');
  });

  const llamadasDiv = root.querySelector('#int-llamadas');
  const calDiv = root.querySelector('#int-calendario');
  const tabL = root.querySelector('.int-tab-btn[data-target="llamadas"]');
  const tabC = root.querySelector('.int-tab-btn[data-target="calendario"]');
  const setTab = (target) => {
    const isLlamadas = target === 'llamadas';
    tabL?.classList.toggle('is-active', isLlamadas);
    tabC?.classList.toggle('is-active', !isLlamadas);
    llamadasDiv.classList.toggle('hide', !isLlamadas);
    calDiv.classList.toggle('hide', isLlamadas);
  };

  tabL.addEventListener('click', () => {
    setTab('llamadas');
  });

  tabC.addEventListener('click', async () => {
    setTab('calendario');
    if (calDiv.dataset.mounted) return;

    // IMPORTANTE: el calendario muestra lo agendado, pedir por fechaProximo
    const { fromProx, toProx } = proxWindowAround(new Date(), 2); // +-2 meses
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

  async function refreshAll() {
    await updateKPIs();
    if (calDiv.dataset.mounted) {
      const { fromProx, toProx } = proxWindowAround(new Date(), 2);
      let items = [];
      try {
        const resp = await list({ fromProx, toProx, limit: 2000 });
        items = (resp && Array.isArray(resp.items)) ? resp.items : [];
        if (DEBUG_CAL) console.log('[CAL] refresh fetched:', items.length);
      } catch (_) {
        items = [];
      }
      mountAgendaLite(calDiv, items);
    }
  }

  async function updateKPIs(rows) {
    try {
      if (!rows) {
        const semana = currentIsoWeek();
        // KPIs de la tabla: se calculan por semana de la interaccion (fecha)
        const resp = await list({ semana });
        rows = resp.items || [];
      }

      const canonEstado = (s) => (String(s || '').toLowerCase() === 'completado' ? 'hecho' : String(s || '').toLowerCase());
      const isLlamada = (r) => String(r.tipo || '').toLowerCase().trim() === 'llamada';
      const hasAcuerdoConFecha = (r) => !!(r.proximoPaso && (r.proximoPasoFecha || r.fechaProx));

      const k = {
        llamadas: rows.filter(isLlamada).length,
        acuerdos: rows.filter(hasAcuerdoConFecha).length,
        cumplidos: rows.filter((r) => canonEstado(r.estado) === 'hecho').length,
        tons: rows.reduce((s, r) => s + (Number(r.tonsConversadas) || 0), 0),
      };
      const conv = k.llamadas ? Math.round((k.acuerdos / k.llamadas) * 100) : 0;
      const activeQuick = tableApi?.getQuickFilter?.() || '';
      const mkCls = (key) => `dw-card int-kpi-card int-kpi-card--filter${activeQuick === key ? ' is-active' : ''}`;

      document.getElementById('int-kpis').innerHTML = `
        <div class="int-kpi-grid">
          <article class="${mkCls('llamadas')}" data-kpi-key="llamadas" title="Filtrar llamadas">
            <p class="dw-label">Llamadas</p>
            <p class="dw-value">${k.llamadas}</p>
          </article>
          <article class="${mkCls('acuerdos')}" data-kpi-key="acuerdos" title="Filtrar acuerdos con fecha">
            <p class="dw-label">Acuerdos con fecha</p>
            <p class="dw-value">${k.acuerdos}</p>
          </article>
          <article class="${mkCls('conversion')}" data-kpi-key="conversion" title="Filtrar llamadas con acuerdo">
            <p class="dw-label">% Conversion</p>
            <p class="dw-value">${conv}%</p>
          </article>
          <article class="${mkCls('cumplidos')}" data-kpi-key="cumplidos" title="Filtrar cumplidos">
            <p class="dw-label">Cumplidos</p>
            <p class="dw-value">${k.cumplidos}</p>
          </article>
          <article class="${mkCls('tons')} int-kpi-card--wide" data-kpi-key="tons" title="Filtrar con tons > 0">
            <p class="dw-label">Tons conversadas</p>
            <p class="dw-value">${fmtNum(k.tons)} <span class="int-kpi-unit">t</span></p>
          </article>
        </div>
      `;
    } catch (e) {
      console.error(e);
      if (window.M && M.toast) M.toast({ html: 'Error al calcular KPIs', classes: 'red' });
    }
  }
}

/* ===== utilidades ===== */

// semana ISO de la interaccion (para KPIs)
function currentIsoWeek(d = new Date()) {
  if (window.app?.utils?.isoWeek) {
    const w = window.app.utils.isoWeek(d);
    return `${d.getFullYear()}-W${String(w).padStart(2, '0')}`;
  }
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7; // 0..6 (0=Lun)
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3); // jueves de esa semana
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((tmp - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Ventana centrada en `base` para pedir por fechaProximo (agendados).
 * @param {Date} base
 * @param {number} monthsAheadBehind cantidad de meses hacia atras/adelante (default 2)
 * @returns {{fromProx:string, toProx:string}}
 */
function proxWindowAround(base = new Date(), monthsAheadBehind = 2) {
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const from = new Date(Date.UTC(y, m - monthsAheadBehind, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(y, m + monthsAheadBehind + 1, 1, 0, 0, 0, 0)); // excluyente
  return { fromProx: from.toISOString(), toProx: to.toISOString() };
}

function fmtNum(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('es-CL', { maximumFractionDigits: 2 });
}

