// /js/abastecimiento/contactos/interacciones/agenda-lite.js
// Agenda mensual ligera para Interacciones (independiente del calendario de cosechas)

const MAX_COLLAPSED = 2;

const TYPE_COLORS = {
  'llamada':    '#0284c7',
  'visita':     '#16a34a',
  'muestra':    '#7c3aed',
  'reunión':    '#ea580c',
  'tarea':      '#0ea5e9',
};
const STATE_COLORS = {
  'pendiente':  {bg:'#fff7ed', fg:'#9a3412', br:'#fed7aa'},
  'agendado':   {bg:'#ecfeff', fg:'#155e75', br:'#a5f3fc'},
  'hecho':      {bg:'#ecfdf5', fg:'#065f46', br:'#a7f3d0'},
};

export function mountAgendaLite(root, items = []) {
  injectStyles();

  let view = firstOfMonth(new Date());

  root.innerHTML = `
    <div class="ag-card">
      <div class="ag-header">
        <h5 class="ag-title">Calendario de actividades (Interacciones)</h5>
        <div class="ag-actions">
          <button class="ag-btn" id="ag-new" title="Nueva interacción">+</button>
        </div>
      </div>

      <div class="ag-monthbar">
        <button class="ag-nav" id="ag-prev">‹</button>
        <div class="ag-month" id="ag-month-label"></div>
        <button class="ag-nav" id="ag-next">›</button>
      </div>

      <div class="ag-weekdays">
        <div>Lun</div><div>Mar</div><div>Mié</div>
        <div>Jue</div><div>Vie</div><div>Sáb</div><div>Dom</div>
      </div>

      <div class="ag-grid" id="ag-grid" role="grid"></div>
    </div>
  `;

  root.querySelector('#ag-prev').onclick = () => { view = addMonths(view, -1); render(); };
  root.querySelector('#ag-next').onclick = () => { view = addMonths(view,  1); render(); };
  root.querySelector('#ag-new').onclick  = () => { window.M?.toast && M.toast({html:'Usa “+ Llamada/Acuerdo” arriba', classes:'blue'}); };

  render();

  function render(){
    root.querySelector('#ag-month-label').textContent = monthLabel(view);

    const start = startOfCalendar(view);
    const byDay = groupByDay(items);

    const grid = root.querySelector('#ag-grid');
    grid.innerHTML = '';

    let d = new Date(start);
    for (let i=0;i<42;i++){
      const iso = toISO(d);
      const inMonth = d.getMonth() === view.getMonth();
      const dayItems = (byDay.get(iso)||[]).sort((a,b)=> timeInt(a) - timeInt(b));

      const cell = document.createElement('div');
      cell.className = 'ag-day'+(inMonth?'':' is-out');
      cell.setAttribute('role','gridcell');

      const head = document.createElement('div');
      head.className = 'ag-day-head';
      head.innerHTML  = `<span class="ag-day-num">${d.getDate()}</span>`;
      cell.appendChild(head);

      const body = document.createElement('div');
      body.className = 'ag-day-body';
      cell.appendChild(body);

      // Pintar hasta MAX_COLLAPSED; si hay más, botón +N
      const toShow = Math.min(dayItems.length, MAX_COLLAPSED);
      for (let k=0;k<toShow;k++) body.appendChild(renderItem(dayItems[k]));

      if (dayItems.length > MAX_COLLAPSED){
        const moreBtn = document.createElement('button');
        moreBtn.className = 'ag-more';
        moreBtn.textContent = `+${dayItems.length - MAX_COLLAPSED} más`;
        moreBtn.onclick = () => {
          if (moreBtn.dataset.open === '1'){
            // contraer
            body.querySelectorAll('.ag-item.extra').forEach(n=>n.remove());
            moreBtn.textContent = `+${dayItems.length - MAX_COLLAPSED} más`;
            moreBtn.dataset.open = '0';
          } else {
            // expandir
            for (let k=MAX_COLLAPSED;k<dayItems.length;k++){
              const n = renderItem(dayItems[k]);
              n.classList.add('extra');
              body.appendChild(n);
            }
            moreBtn.textContent = 'Ver menos';
            moreBtn.dataset.open = '1';
          }
        };
        cell.appendChild(moreBtn);
      }

      grid.appendChild(cell);
      d.setDate(d.getDate()+1);
    }
  }
}

/* -------------------- Tarjeta -------------------- */
function renderItem(r){
  const tipo = String(r.proximoPaso || r.tipo || 'Interacción').toLowerCase();
  const color = TYPE_COLORS[tipo] || '#2563eb';

  const estado = canonEstado(r.estado);
  const stateC = STATE_COLORS[estado] || STATE_COLORS.pendiente;

  const card = document.createElement('div');
  card.className = 'ag-item';
  card.style.borderLeft = `6px solid ${hashColor(r.responsablePG || r.responsable || '')}`;

  const h = hhmm(r.fechaProx || r.proximoPasoFecha);
  const tons = num(r.tonsConversadas) ? ` · ${fmtNum(r.tonsConversadas)} t` : '';
  const quien = r.contactoNombre || r.proveedorNombre || '—';
  const resp  = r.responsablePG || r.responsable || '';

  card.innerHTML = `
    <div class="ag-item-top">
      <span class="ag-dot" style="background:${color}"></span>
      <span class="ag-time">${h || '—'}</span>
      <span class="ag-pill" style="background:${stateC.bg};color:${stateC.fg};border-color:${stateC.br}">
        ${escapeHtml(estado)}
      </span>
    </div>
    <div class="ag-item-main" title="${escapeHtml(quien)}">
      <span class="ag-type" style="color:${color}">${escapeHtml((r.proximoPaso||r.tipo||'').toUpperCase())}</span>
    </div>
    <div class="ag-item-sub">${escapeHtml(quien)}${tons}</div>
    <div class="ag-item-foot">${escapeHtml(resp)}</div>
  `;
  return card;
}

/* -------------------- Styles -------------------- */
function injectStyles(){
  if (document.getElementById('ag-lite-styles')) return;
  const s = document.createElement('style');
  s.id = 'ag-lite-styles';
  s.textContent = `
  .ag-card{ background:#fff; border-radius:14px; box-shadow:0 6px 18px rgba(0,0,0,.05); padding:14px; }
  .ag-header{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
  .ag-title{ margin:0; font-size:20px; letter-spacing:.2px; }
  .ag-actions .ag-btn{ background:#16a34a; color:#fff; border:none; border-radius:10px; padding:8px 12px; cursor:pointer; }
  .ag-monthbar{ display:flex; align-items:center; justify-content:center; gap:10px; margin:6px 0 10px; }
  .ag-month{ font-weight:700; letter-spacing:.3px; }
  .ag-nav{ border:1px solid #e5e7eb; background:#f8fafc; border-radius:8px; padding:6px 10px; cursor:pointer; }
  .ag-weekdays{ display:grid; grid-template-columns:repeat(7,1fr); gap:10px; margin-bottom:6px; }
  .ag-weekdays>div{ background:#f3f4f6; color:#111827; font-weight:600; border-radius:10px; padding:6px 8px; text-align:center; font-size:.9rem; }
  .ag-grid{ display:grid; grid-template-columns:repeat(7,1fr); gap:10px; }
  .ag-day{ background:#fff; border:1px solid #eef2f7; border-radius:12px; min-height:240px; display:flex; flex-direction:column; position:relative; }
  .ag-day.is-out{ opacity:.55; background:#fafafa; }
  .ag-day-head{ display:flex; justify-content:flex-end; padding:6px 8px 0; }
  .ag-day-num{ font-weight:700; color:#475569; font-size:.95rem; }
  .ag-day-body{ padding:8px; display:flex; flex-direction:column; gap:6px; }
  .ag-more{ margin:6px 8px 8px; border:1px dashed #cbd5e1; background:#fff; border-radius:8px; padding:6px; font-size:.85rem; color:#334155; cursor:pointer; }
  .ag-item{ border:1px solid #e5e7eb; border-radius:10px; padding:6px 8px; background:#fff; }
  .ag-item-top{ display:flex; align-items:center; gap:6px; margin-bottom:2px; }
  .ag-dot{ width:8px; height:8px; border-radius:50%; display:inline-block; }
  .ag-time{ font-weight:700; color:#0f172a; font-size:.88rem; }
  .ag-pill{ margin-left:auto; font-size:.7rem; padding:1px 6px; border-radius:999px; border:1px solid transparent; text-transform:capitalize; }
  .ag-item-main{ font-weight:700; letter-spacing:.2px; line-height:1.1; }
  .ag-type{ font-size:.92rem; }
  .ag-item-sub{ color:#475569; font-size:.86rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .ag-item-foot{ color:#64748b; font-size:.8rem; }
  @media (max-width: 992px){
    .ag-weekdays, .ag-grid{ gap:8px; }
    .ag-day{ min-height:220px; }
  }
  `;
  document.head.appendChild(s);
}

/* -------------------- Utils -------------------- */
function firstOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d,n){ return new Date(d.getFullYear(), d.getMonth()+n, 1); }
function startOfCalendar(base){
  const d = new Date(base.getFullYear(), base.getMonth(), 1);
  const weekday = (d.getDay()+6)%7; // 0..6 (lunes=0)
  d.setDate(d.getDate()-weekday);
  return d;
}
function toISO(d){ return d.toISOString().slice(0,10); }
function monthLabel(d){
  return d.toLocaleDateString('es-CL',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());
}
function groupByDay(items){
  const m = new Map();
  for (const r of items){
    const dt = r.fechaProx || r.proximoPasoFecha; if (!dt) continue;
    const iso = toISO(new Date(dt));
    if (!m.has(iso)) m.set(iso, []);
    m.get(iso).push(r);
  }
  return m;
}
function timeInt(row){
  const s = row?.fechaProx || row?.proximoPasoFecha || '';
  const d = new Date(s); if (!isFinite(d)) return 999999;
  return d.getHours()*100 + d.getMinutes();
}
function hhmm(iso){ if(!iso) return ''; const d=new Date(iso); if(!isFinite(d)) return ''; return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function canonEstado(s){ const raw=String(s||'').trim().toLowerCase(); if(raw==='completado')return 'hecho'; return raw||'pendiente'; }
function num(n){ const v=Number(n); return Number.isFinite(v)?v:0; }
function fmtNum(n){ return Number(n||0).toLocaleString('es-CL',{maximumFractionDigits:0}); }
function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
function hashColor(s){
  // color estable por responsable
  let h=0; for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i))|0;
  const hue = Math.abs(h)%360;
  return `hsl(${hue} 65% 45%)`;
}
