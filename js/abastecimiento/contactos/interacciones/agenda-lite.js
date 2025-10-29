// /js/abastecimiento/contactos/interacciones/agenda-lite.js
// Calendario ligero SOLO para Interacciones (agenda)
// - NO depende del calendario de cosechas
// - 7 columnas (LU..DO) con CSS Grid
// - Expandir/Contraer por día cuando hay muchas tarjetas

export function mountAgendaLite(root, items = []) {
  injectStyles();

  // Estado local (mes visible)
  let view = firstOfMonth(new Date());

  root.innerHTML = `
    <div class="ag-card">
      <div class="ag-header">
        <h5 class="ag-title">Calendario de actividades (Interacciones)</h5>
        <div class="ag-actions">
          <button class="ag-btn" id="ag-new">+</button>
        </div>
      </div>

      <div class="ag-monthbar">
        <button class="ag-nav" id="ag-prev" aria-label="Mes anterior">‹</button>
        <div class="ag-month" id="ag-month-label"></div>
        <button class="ag-nav" id="ag-next" aria-label="Mes siguiente">›</button>
      </div>

      <div class="ag-weekdays" aria-hidden="true">
        <div>Lun</div><div>Mar</div><div>Mié</div>
        <div>Jue</div><div>Vie</div><div>Sáb</div><div>Dom</div>
      </div>

      <div class="ag-grid" id="ag-grid" role="grid" aria-label="Cuadrícula mensual"></div>
    </div>
  `;

  root.querySelector('#ag-prev').addEventListener('click', () => {
    view = addMonths(view, -1);
    render();
  });
  root.querySelector('#ag-next').addEventListener('click', () => {
    view = addMonths(view, 1);
    render();
  });
  root.querySelector('#ag-new').addEventListener('click', () => {
    // deja el click para que tu botón global abra el modal si quieres engancharlo después
    if (window.M?.toast) M.toast({ html: 'Usa el botón “+ Llamada/Acuerdo” de la pestaña', classes: 'blue' });
  });

  render();

  function render() {
    // etiqueta de mes
    const label = root.querySelector('#ag-month-label');
    label.textContent = monthLabel(view);

    // rango visible (lunes…domingo)
    const start = startOfCalendar(view);
    const end   = endOfCalendar(view);

    // indexa interacciones por día ISO (YYYY-MM-DD)
    const byDay = groupByDay(items);

    const grid = root.querySelector('#ag-grid');
    grid.innerHTML = '';

    // 6 semanas * 7 días = 42 celdas
    let d = new Date(start);
    for (let i = 0; i < 42; i++) {
      const iso = toISO(d);
      const inMonth = d.getMonth() === view.getMonth();
      const dayItems = (byDay.get(iso) || []).sort((a,b) => timeInt(a) - timeInt(b));

      const cell = document.createElement('div');
      cell.className = 'ag-day' + (inMonth ? '' : ' is-out');
      cell.setAttribute('role', 'gridcell');

      // header: número de día
      const head = document.createElement('div');
      head.className = 'ag-day-head';
      head.innerHTML = `<span class="ag-day-num">${String(d.getDate())}</span>`;
      cell.appendChild(head);

      // body: tarjetas
      const body = document.createElement('div');
      body.className = 'ag-day-body';
      cell.appendChild(body);

      // tarjetas (compactas)
      dayItems.forEach((r) => {
        const card = document.createElement('div');
        card.className = 'ag-item';
        const h = hhmm(r.fechaProx || r.proximoPasoFecha);
        const paso = (r.proximoPaso || r.tipo || '').toUpperCase();
        const quien = r.contactoNombre || r.proveedorNombre || '—';
        const resp = r.responsablePG || r.responsable || '';
        const est  = canonEstado(r.estado);
        const tons = num(r.tonsConversadas) ? ` · ${fmtNum(r.tonsConversadas)} t` : '';

        card.innerHTML = `
          <div class="ag-item-top">
            <span class="ag-dot"></span>
            <span class="ag-time">${h || '—'}</span>
            <span class="ag-pill">${est || 'pendiente'}</span>
          </div>
          <div class="ag-item-main">${escapeHtml(paso)}</div>
          <div class="ag-item-sub">
            ${escapeHtml(quien)}${tons}
          </div>
          <div class="ag-item-foot">${escapeHtml(resp)}</div>
        `;
        body.appendChild(card);
      });

      // expandir / contraer si hay mucho
      if (body.scrollHeight > 260) {
        body.classList.add('is-collapsed');
        const more = document.createElement('button');
        more.className = 'ag-more';
        more.textContent = 'Ver más';
        more.addEventListener('click', () => {
          const expanded = body.classList.toggle('is-collapsed');
          // toggle retorna estado DESPUÉS, invertimos el texto
          more.textContent = expanded ? 'Ver más' : 'Ver menos';
        });
        cell.appendChild(more);
      }

      grid.appendChild(cell);
      d.setDate(d.getDate() + 1);
    }
  }
}

/* ======================= Styles inyectados ======================= */
function injectStyles() {
  if (document.getElementById('ag-lite-styles')) return;
  const css = `
  .ag-card{ background:#fff; border-radius:14px; box-shadow:0 6px 18px rgba(0,0,0,.05); padding:14px; }
  .ag-header{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
  .ag-title{ margin:0; font-size:20px; letter-spacing:.2px; }
  .ag-actions{ display:flex; gap:8px; }
  .ag-btn{ background:#16a34a; color:#fff; border:none; border-radius:10px; padding:8px 12px; cursor:pointer; }
  .ag-monthbar{ display:flex; align-items:center; justify-content:center; gap:10px; margin:6px 0 10px; }
  .ag-month{ font-weight:700; letter-spacing:.3px; }
  .ag-nav{ border:1px solid #e5e7eb; background:#f8fafc; border-radius:8px; padding:6px 10px; cursor:pointer; }
  .ag-weekdays{ display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:12px; margin-bottom:8px; }
  .ag-weekdays>div{ background:#f3f4f6; color:#111827; font-weight:600; border-radius:10px; padding:8px 10px; text-align:center; }
  .ag-grid{ display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:12px; }
  .ag-day{ display:flex; flex-direction:column; background:#fff; border:1px solid #eef2f7; border-radius:12px; min-height:260px; position:relative; }
  .ag-day.is-out{ opacity:.55; background:#fafafa; }
  .ag-day-head{ display:flex; justify-content:flex-end; padding:6px 8px 0; }
  .ag-day-num{ font-weight:700; color:#374151; }
  .ag-day-body{ padding:8px; display:flex; flex-direction:column; gap:6px; max-height:260px; overflow:hidden; }
  .ag-day-body.is-collapsed{ max-height:190px; }
  .ag-more{ position:absolute; bottom:6px; left:8px; right:8px; border:1px dashed #cbd5e1; background:#fff; border-radius:8px; padding:6px; font-size:.85rem; color:#334155; cursor:pointer; }
  .ag-item{ border:1px solid #e5e7eb; border-radius:10px; padding:8px; background:#fff; }
  .ag-item-top{ display:flex; align-items:center; gap:8px; margin-bottom:2px; }
  .ag-dot{ width:8px; height:8px; border-radius:50%; background:#0ea5e9; display:inline-block; }
  .ag-time{ font-weight:600; color:#0f172a; }
  .ag-pill{ margin-left:auto; font-size:.72rem; padding:2px 6px; border-radius:999px; border:1px solid #e2e8f0; color:#334155; background:#f8fafc; }
  .ag-item-main{ font-weight:700; letter-spacing:.2px; }
  .ag-item-sub{ color:#475569; font-size:.9rem; }
  .ag-item-foot{ color:#64748b; font-size:.85rem; }
  @media (max-width: 992px){
    .ag-grid, .ag-weekdays{ gap:8px; }
    .ag-day{ min-height:220px; }
    .ag-day-body{ max-height:220px; }
    .ag-day-body.is-collapsed{ max-height:160px; }
  }
  `;
  const s = document.createElement('style');
  s.id = 'ag-lite-styles';
  s.textContent = css;
  document.head.appendChild(s);
}

/* ======================= Utilidades ======================= */
function firstOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d, n){ return new Date(d.getFullYear(), d.getMonth()+n, 1); }

function startOfCalendar(base){
  // lunes de la primera semana visible
  const d = new Date(base.getFullYear(), base.getMonth(), 1);
  const weekday = (d.getDay()+6)%7; // 0..6 (0=lunes)
  d.setDate(d.getDate() - weekday);
  return d;
}
function endOfCalendar(base){
  const start = startOfCalendar(base);
  const d = new Date(start);
  d.setDate(d.getDate() + 41);
  return d;
}
function monthLabel(d){
  return d.toLocaleDateString('es-CL', { month:'long', year:'numeric' }).replace(/^./, c=>c.toUpperCase());
}

function toISO(d){ return d.toISOString().slice(0,10); }
function timeInt(row){
  const s = row?.fechaProx || row?.proximoPasoFecha || '';
  const d = new Date(s);
  if (!isFinite(d)) return 999999;
  return d.getHours()*100 + d.getMinutes();
}
function groupByDay(items){
  const m = new Map();
  for (const r of items){
    const dt = r.fechaProx || r.proximoPasoFecha;
    if (!dt) continue;
    const iso = toISO(new Date(dt));
    if (!m.has(iso)) m.set(iso, []);
    m.get(iso).push(r);
  }
  return m;
}
function hhmm(iso){
  if (!iso) return '';
  const d = new Date(iso); if (!isFinite(d)) return '';
  const h = String(d.getHours()).padStart(2,'0');
  const m = String(d.getMinutes()).padStart(2,'0');
  return `${h}:${m}`;
}
function canonEstado(s){
  const raw = String(s||'').trim().toLowerCase();
  if (raw === 'completado') return 'hecho';
  return raw || 'pendiente';
}
function num(n){ const v = Number(n); return Number.isFinite(v) ? v : 0; }
function fmtNum(n){ return Number(n||0).toLocaleString('es-CL', { maximumFractionDigits: 0 }); }
function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
