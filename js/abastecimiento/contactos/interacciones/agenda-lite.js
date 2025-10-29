// /js/abastecimiento/contactos/interacciones/agenda-lite.js
// Calendario lite (solo lectura) para INTERACCIONES
// Entradas esperadas en "items":
// - fechaProx | proximoPasoFecha (ISO)  ← fecha que posiciona
// - proximoPaso | tipo                  ← etiqueta principal (p.ej. "Tomar muestras")
// - responsablePG                       ← chip/autor
// - proveedorNombre | contactoNombre
// - tonsConversadas (opcional, numérico)
// - estado (pendiente, agendado, hecho, cancelado, etc.)

export function mountAgendaLite(rootEl, items = []) {
  injectStyles();

  // --------- Normalización mínima ----------
  const rows = (items || [])
    .map((r) => normalize(r))
    .filter((r) => r.date); // descarta sin fecha

  // mes visible = si hay algo futuro, ese mes; si no, mes actual
  const now = new Date();
  const firstFuture = rows.find((r) => r.date >= startOfDay(now));
  let view = firstFuture ? new Date(firstFuture.date) : now;

  // HTML base (scoped)
  rootEl.innerHTML = `
    <div class="ag-scope">
      <div class="ag-card">
        <div class="ag-header">
          <h5 class="ag-title">Calendario de actividades (Interacciones)</h5>
          <div class="ag-actions"><button id="agAddBtn" class="ag-btn">+</button></div>
        </div>

        <div class="ag-monthbar">
          <button class="ag-nav" id="agPrev" aria-label="Mes anterior">‹</button>
          <div class="ag-month" id="agMonthLabel"></div>
          <button class="ag-nav" id="agNext" aria-label="Mes siguiente">›</button>
        </div>

        <div class="ag-weekdays" id="agWeekdays"></div>
        <div class="ag-grid" id="agGrid"></div>
      </div>
    </div>
  `;

  // listeners nav
  rootEl.querySelector('#agPrev').addEventListener('click', () => {
    view = addMonths(view, -1);
    render();
  });
  rootEl.querySelector('#agNext').addEventListener('click', () => {
    view = addMonths(view, 1);
    render();
  });

  // botón +: dispara el mismo botón global "nueva interacción" si existe
  rootEl.querySelector('#agAddBtn').addEventListener('click', () => {
    const addBtn = document.getElementById('btn-nueva-int');
    if (addBtn) addBtn.click();
  });

  render();

  // ================== render ==================
  function render() {
    // encabezado mes
    const monthLabel = rootEl.querySelector('#agMonthLabel');
    monthLabel.textContent = formatMonth(view);

    // header weekdays
    const wd = ['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM'];
    const wdHtml = wd.map(d => `<div>${d}</div>`).join('');
    rootEl.querySelector('#agWeekdays').innerHTML = wdHtml;

    // matriz de días (6 semanas; con desbordes anterior/siguiente)
    const matrix = buildMonthMatrix(view);
    const from = matrix[0].date;
    const to   = matrix[matrix.length-1].date;

    // agrupamos filas por yyyy-mm-dd del período visible
    const byDay = groupByDate(rows, from, to);

    // pinta grid
    const todayISO = isoDate(new Date());
    const html = matrix.map(cell => {
      const list = byDay[isoDate(cell.date)] || [];
      return dayCell(cell, list, todayISO);
    }).join('');
    rootEl.querySelector('#agGrid').innerHTML = html;

    // wire “+N más / ver menos”
    rootEl.querySelectorAll('.ag-more').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const day = e.currentTarget.closest('.ag-day');
        if (!day) return;
        const full = day.querySelector('.ag-items-full');
        const comp = day.querySelector('.ag-items-compact');
        const expanded = day.dataset.expanded === '1';
        if (expanded) {
          full.classList.add('hide');
          comp.classList.remove('hide');
          day.dataset.expanded = '0';
          e.currentTarget.textContent = e.currentTarget.dataset.moreLabel; // vuelve a "+N más"
        } else {
          comp.classList.add('hide');
          full.classList.remove('hide');
          day.dataset.expanded = '1';
          e.currentTarget.dataset.moreLabel = e.currentTarget.textContent;
          e.currentTarget.textContent = 'ver menos';
        }
      });
    });
  }
}

/* ================= utils & render helpers ================= */

function normalize(r) {
  const dateStr = r.fechaProx || r.proximoPasoFecha || r.destFecha;
  const date = dateStr ? new Date(dateStr) : null;
  return {
    date,
    iso: date ? isoDate(date) : '',
    time: date ? timeHHMM(date) : '',
    paso: (r.proximoPaso || r.tipo || r.__tipo || '').trim(),
    proveedor: r.proveedorNombre || r.contactoNombre || '—',
    responsable: r.responsablePG || r.responsable || '—',
    estado: (r.estado || '').toString().toLowerCase(),
    tons: Number(r.tonsConversadas || r.tons || 0) || 0,
  };
}

function groupByDate(list, from, to) {
  const map = Object.create(null);
  const fromISO = isoDate(from), toISO = isoDate(to);
  list.forEach(it => {
    if (!it.iso) return;
    if (it.iso < fromISO || it.iso > toISO) return;
    (map[it.iso] ||= []).push(it);
  });
  // orden: hora asc, luego paso
  Object.values(map).forEach(arr => {
    arr.sort((a,b) => (a.time || '').localeCompare(b.time || '') || a.paso.localeCompare(b.paso));
  });
  return map;
}

function colorForPaso(paso) {
  const key = (paso || '').toLowerCase();
  if (key.includes('muestra'))    return '#0ea5e9'; // celeste
  if (key.includes('visita'))     return '#22c55e'; // verde
  if (key.includes('reun'))       return '#f59e0b'; // ámbar
  if (key.includes('contacto'))   return '#a855f7'; // violeta
  if (key.includes('negoci'))     return '#ef4444'; // rojo
  return '#64748b';               // slate
}
function pillForEstado(estado) {
  const s = (estado || '').toLowerCase();
  if (!s) return '';
  const map = {
    'pendiente': {bd:'#fecaca', bg:'#fee2e2', fg:'#991b1b'},
    'agendado':  {bd:'#fde68a', bg:'#fef3c7', fg:'#92400e'},
    'hecho':     {bd:'#bbf7d0', bg:'#dcfce7', fg:'#166534'},
    'completado':{bd:'#bbf7d0', bg:'#dcfce7', fg:'#166534'},
    'cancelado': {bd:'#fecaca', bg:'#fee2e2', fg:'#991b1b'},
  };
  const c = map[s] || {bd:'#e5e7eb', bg:'#f8fafc', fg:'#334155'};
  return `<span class="ag-pill" style="border-color:${c.bd};background:${c.bg};color:${c.fg}">${escapeHtml(s)}</span>`;
}

function itemCard(it) {
  const dot = colorForPaso(it.paso);
  const tons = it.tons ? ` · ${formatTons(it.tons)}` : '';
  return `
    <div class="ag-item">
      <div class="ag-item-top">
        <span class="ag-dot" style="background:${dot};"></span>
        <span class="ag-time">${escapeHtml(it.time || '')}</span>
        ${pillForEstado(it.estado)}
      </div>
      <div class="ag-item-main">
        <div class="ag-type">${escapeHtml(it.paso || '—')}</div>
      </div>
      <div class="ag-item-sub">${escapeHtml(it.proveedor)}${tons}</div>
      <div class="ag-item-foot">${escapeHtml(it.responsable)}</div>
    </div>
  `;
}

function dayCell(cell, list, todayISO) {
  const isOut = cell.out;
  const isToday = isoDate(cell.date) === todayISO;

  // compact: primeras 3
  const first = list.slice(0, 3).map(itemCard).join('');
  // full: todas
  const full  = list.map(itemCard).join('');
  const moreN = Math.max(0, list.length - 3);

  return `
    <div class="ag-day ${isOut ? 'is-out':''}" data-expanded="0">
      <div class="ag-day-head">
        <span class="ag-day-num" title="${isoDate(cell.date)}">${cell.day}</span>
      </div>
      <div class="ag-day-body">
        <div class="ag-items-compact">${first || ''}</div>
        <div class="ag-items-full hide">${full || ''}</div>
        ${moreN ? `<button class="ag-more" data-more-label="+${moreN} más">+${moreN} más</button>` : ''}
        ${isToday ? `<span class="ag-today-badge" title="Hoy"></span>` : ''}
      </div>
    </div>
  `;
}

/* ---------- fechas ---------- */
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59,999); }
function addMonths(d, n){ const x=new Date(d); x.setMonth(x.getMonth()+n); return x; }

function buildMonthMatrix(refDate){
  const first = startOfMonth(refDate);
  const last  = endOfMonth(refDate);

  // lunes=0 … domingo=6 (normalizamos desde getDay() que es 0=domingo)
  const dayIdx = (d) => (d.getDay() + 6) % 7;

  const start = new Date(first);
  start.setDate(first.getDate() - dayIdx(first)); // arranca lunes de la 1a semana
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - dayIdx(last))); // termina domingo

  // 6 semanas seguras
  const cells = [];
  let cursor = new Date(start);
  for (let i=0;i<42;i++){
    cells.push({
      date: new Date(cursor),
      day: cursor.getDate(),
      out: (cursor < first || cursor > last)
    });
    cursor.setDate(cursor.getDate()+1);
  }
  return cells;
}

/* ---------- format & misc ---------- */
function isoDate(d){ return d.toISOString().slice(0,10); }
function timeHHMM(d){
  const h = String(d.getHours()).padStart(2,'0');
  const m = String(d.getMinutes()).padStart(2,'0');
  return `${h}:${m}`;
}
function formatMonth(d){
  const fmt = new Intl.DateTimeFormat('es-CL',{month:'long', year:'numeric'});
  let txt = fmt.format(d); // "octubre de 2025"
  // Capitaliza primera letra
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
function formatTons(v){
  return `${Number(v).toLocaleString('es-CL', {maximumFractionDigits:0})} t`;
}
function escapeHtml(s){ return String(s||'').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }

/* ================== estilos ================== */
function injectStyles(){
  if (document.getElementById('ag-lite-styles')) return;
  const s = document.createElement('style');
  s.id = 'ag-lite-styles';
  s.textContent = `
  /* --- SCOPE: evitamos choques con Materialize y estilos globales --- */
  .ag-scope, .ag-scope * { box-sizing: border-box; }

  .ag-scope .hide{ display:none !important; }

  .ag-scope .ag-card{
    width:100%;
    background:#fff; border-radius:12px;
    box-shadow:0 6px 16px rgba(0,0,0,.05);
    padding:12px;
  }
  .ag-scope .ag-header{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:6px; }
  .ag-scope .ag-title{ margin:0; font-size:18px; letter-spacing:.2px; font-weight:700; }
  .ag-scope .ag-actions .ag-btn{ background:#16a34a; color:#fff; border:none; border-radius:8px; padding:6px 10px; cursor:pointer; font-size:14px; }

  .ag-scope .ag-monthbar{ display:flex; align-items:center; justify-content:center; gap:8px; margin:4px 0 8px; }
  .ag-scope .ag-month{ font-weight:700; letter-spacing:.3px; font-size:14px; }
  .ag-scope .ag-nav{ border:1px solid #e5e7eb; background:#f8fafc; border-radius:8px; padding:4px 8px; cursor:pointer; line-height:1; }

  /* 7 columnas fijas, sin desbordes */
  .ag-scope .ag-weekdays{
    display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); gap:8px; width:100%;
  }
  .ag-scope .ag-weekdays>div{
    background:#f3f4f6; color:#0f172a; font-weight:700;
    border-radius:8px; padding:6px 6px; text-align:center; font-size:.82rem;
  }

  .ag-scope .ag-grid{
    display:grid;
    grid-template-columns:repeat(7, minmax(0,1fr));
    grid-auto-flow: row dense;
    grid-auto-rows: auto;
    gap:8px; width:100%;
  }
  .ag-scope .ag-grid > * { min-width:0; }

  .ag-scope .ag-day{
    background:#fff; border:1px solid #eef2f7; border-radius:10px;
    min-height:200px; display:flex; flex-direction:column; position:relative;
  }
  .ag-scope .ag-day.is-out{ opacity:.55; background:#fafafa; }
  .ag-scope .ag-day-head{ display:flex; justify-content:flex-end; padding:6px 6px 0; }
  .ag-scope .ag-day-num{ font-weight:700; color:#475569; font-size:.85rem; }
  .ag-scope .ag-day-body{ padding:6px; display:flex; flex-direction:column; gap:5px; }
  .ag-scope .ag-today-badge{
    position:absolute; right:8px; top:8px; width:6px; height:6px; border-radius:50%;
    background:#22c55e;
  }

  /* Tarjetas compactas (más densidad) */
  .ag-scope .ag-item{ border:1px solid #e5e7eb; border-radius:8px; padding:6px; background:#fff; }
  .ag-scope .ag-item-top{ display:flex; align-items:center; gap:6px; margin-bottom:2px; }
  .ag-scope .ag-dot{ width:7px; height:7px; border-radius:50%; display:inline-block; }
  .ag-scope .ag-time{ font-weight:700; color:#0f172a; font-size:.82rem; }
  .ag-scope .ag-pill{
    margin-left:auto; font-size:.65rem; padding:1px 6px; border-radius:999px;
    border:1px solid transparent; text-transform:capitalize;
  }
  .ag-scope .ag-item-main{ font-weight:700; letter-spacing:.2px; line-height:1.05; }
  .ag-scope .ag-type{ font-size:.86rem; }
  .ag-scope .ag-item-sub{ color:#475569; font-size:.8rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .ag-scope .ag-item-foot{ color:#64748b; font-size:.75rem; }

  .ag-scope .ag-more{
    margin:6px; border:1px dashed #cbd5e1; background:#fff;
    border-radius:8px; padding:5px; font-size:.78rem; color:#334155; cursor:pointer;
    align-self:flex-start;
  }

  /* Responsive pequeño */
  @media (max-width: 1200px){
    .ag-scope .ag-day{ min-height:180px; }
  }
  @media (max-width: 900px){
    .ag-scope .ag-title{ font-size:16px; }
    .ag-scope .ag-weekdays>div{ font-size:.78rem; }
    .ag-scope .ag-day{ min-height:160px; }
  }
  `;
  document.head.appendChild(s);
}
