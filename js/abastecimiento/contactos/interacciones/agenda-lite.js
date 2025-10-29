// /js/abastecimiento/contactos/interacciones/agenda-lite.js
// Calendario lite para INTERACCIONES (solo-lectura + dblclick para editar)

export function mountAgendaLite(rootEl, items = []) {
  injectStyles();

  // Normaliza pero conserva "raw" para editar luego
  const allRows = (items || [])
    .map((r) => normalize(r))
    .filter((r) => r.date);

  // Mes visible: primer futuro o mes actual
  const now = new Date();
  const firstFuture = allRows.find((r) => r.date >= startOfDay(now));
  let view = firstFuture ? new Date(firstFuture.date) : now;

  // Estado de filtros (responsable, tipo, query contacto/proveedor)
  const filters = { responsable:'', tipo:'', q:'' };

  rootEl.innerHTML = `
    <div class="ag-scope">
      <div class="ag-card">
        <div class="ag-header">
          <h5 class="ag-title">Calendario de actividades (Interacciones)</h5>
        </div>

        <!-- Filtros -->
        <div class="ag-filters">
          <div class="ag-filter">
            <label for="agFilterResp">Responsable</label>
            <select id="agFilterResp" class="browser-default ag-select">
              <option value="">Todos</option>
            </select>
          </div>
          <div class="ag-filter">
            <label for="agFilterTipo">Tipo</label>
            <select id="agFilterTipo" class="browser-default ag-select">
              <option value="">Todos</option>
            </select>
          </div>
          <div class="ag-filter ag-filter-grow">
            <label for="agFilterQ">Buscar (Contacto / Proveedor)</label>
            <input id="agFilterQ" type="text" class="ag-input" placeholder="Ej: PATRICIO, Paillacar…"/>
          </div>
          <div class="ag-filter ag-filter-min">
            <label>&nbsp;</label>
            <button id="agFilterClear" class="ag-btn-secondary" title="Limpiar filtros">Limpiar</button>
          </div>
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

  // refs UI
  const $resp = rootEl.querySelector('#agFilterResp');
  const $tipo = rootEl.querySelector('#agFilterTipo');
  const $q    = rootEl.querySelector('#agFilterQ');

  // filtros
  $resp.addEventListener('change', () => { filters.responsable = $resp.value; render(); });
  $tipo.addEventListener('change', () => { filters.tipo = $tipo.value; render(); });
  $q.addEventListener('input',   () => { filters.q = $q.value.trim(); render(); });
  rootEl.querySelector('#agFilterClear').addEventListener('click', () => {
    $resp.value = $tipo.value = $q.value = '';
    filters.responsable = filters.tipo = filters.q = '';
    render(true);
  });

  // navegación
  rootEl.querySelector('#agPrev').addEventListener('click', () => { view = addMonths(view, -1); render(true); });
  rootEl.querySelector('#agNext').addEventListener('click', () => { view = addMonths(view,  1); render(true); });

  render(true); // primera vez refresca combos

  function render(refreshCombos = false) {
    // Etiqueta del mes (solo mes visible)
    rootEl.querySelector('#agMonthLabel').textContent = formatMonth(view);

    // Header de semana, domingo en rojo
    const wd = ['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM'];
    rootEl.querySelector('#agWeekdays').innerHTML = wd
      .map((d,i) => `<div class="${i===6?'is-sunday':''}">${d}</div>`).join('');

    // Matriz exacta del mes (sin arrastres de otros meses)
    const matrix = buildMonthMatrixExact(view);
    const first = startOfMonth(view);
    const last  = endOfMonth(view);

    // Filas solo del mes (sirven para combos mes-sensibles)
    const monthRows = allRows.filter(r => r.date >= first && r.date <= last);

    // Poblar selects del mes (únicos ordenados)
    if (refreshCombos) {
      populateSelectReset($resp, uniq(monthRows.map(r => r.responsable)).sort());
      populateSelectReset($tipo, uniq(monthRows.map(r => r.paso)).filter(Boolean).sort());
    }

    // Aplicar filtros
    const rows = applyFilters(monthRows, filters);

    // Agrupar por día del mes
    const byDay = groupByDateStrict(rows, first, last);

    // Pintar grilla
    const todayISO = isoDate(new Date());
    const html = matrix.map(cell => dayCell(cell, byDay[isoDate(cell.date)] || [], todayISO)).join('');
    const grid = rootEl.querySelector('#agGrid');
    grid.innerHTML = html;

    // Toggle “+N más”
    grid.querySelectorAll('.ag-more').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const day = e.currentTarget.closest('.ag-day');
        const full = day.querySelector('.ag-items-full');
        const comp = day.querySelector('.ag-items-compact');
        const expanded = day.dataset.expanded === '1';
        if (expanded) {
          full.classList.add('hide'); comp.classList.remove('hide');
          day.dataset.expanded = '0'; e.currentTarget.textContent = e.currentTarget.dataset.moreLabel;
        } else {
          comp.classList.add('hide'); full.classList.remove('hide');
          day.dataset.moreLabel = e.currentTarget.textContent;
          day.dataset.expanded = '1'; e.currentTarget.textContent = 'ver menos';
        }
      });
    });

    // Doble-click para editar en modal (lee data-raw serializado)
    grid.querySelectorAll('.ag-item').forEach(el => {
      el.addEventListener('dblclick', () => {
        let payload = null;
        try {
          payload = JSON.parse(decodeURIComponent(el.dataset.raw || '{}'));
        } catch (_) { payload = null; }
        if (!payload) return;
        if (typeof window !== 'undefined' && typeof window.openInteraccionModal === 'function') {
          window.openInteraccionModal({ preset: payload, onSaved: () => render(true) });
        } else {
          window.dispatchEvent(new CustomEvent('interaccion:edit', { detail: payload }));
        }
      });
    });
  }
}

/* ================= helpers ================= */

function normalize(r) {
  const dateStr = r.fechaProx || r.proximoPasoFecha || r.destFecha;
  const date = dateStr ? new Date(dateStr) : null;

  const contacto  = r.contactoNombre || r.contacto || '';
  const proveedor = r.proveedorNombre || r.proveedor || '';
  const persona   = contacto || proveedor || '—'; // 👈 prioridad a CONTACTO

  return {
    raw: r,
    date,
    iso: date ? isoDate(date) : '',
    time: date ? timeHHMM(date) : '',
    paso: (r.proximoPaso || r.tipo || r.__tipo || '').trim(),
    contacto,
    proveedor,
    persona,
    responsable: r.responsablePG || r.responsable || '—',
    estado: (r.estado || '').toString().toLowerCase(),
    tons: Number(r.tonsConversadas || r.tons || 0) || 0,
    notas: r.observaciones || r.notas || r.descripcion || ''
  };
}

function applyFilters(list, f) {
  const q = f.q.toLowerCase();
  return list.filter(it => {
    if (f.responsable && it.responsable !== f.responsable) return false;
    if (f.tipo && it.paso !== f.tipo) return false;
    if (q) {
      const hay = `${it.contacto} ${it.proveedor}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function groupByDateStrict(list, from, to) {
  const map = Object.create(null);
  const fromISO = isoDate(from), toISO = isoDate(to);
  list.forEach(it => {
    if (!it.iso) return;
    if (it.iso < fromISO || it.iso > toISO) return;
    (map[it.iso] ||= []).push(it);
  });
  Object.values(map).forEach(arr => {
    arr.sort((a,b) => (a.time || '').localeCompare(b.time || '') || a.paso.localeCompare(b.paso));
  });
  return map;
}

function colorForPaso(paso) {
  const key = (paso || '').toLowerCase();
  if (key.includes('muestra'))    return '#0ea5e9';
  if (key.includes('visita'))     return '#22c55e';
  if (key.includes('reun'))       return '#f59e0b';
  if (key.includes('contacto'))   return '#a855f7';
  if (key.includes('negoci'))     return '#ef4444';
  return '#64748b';
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

function tooltipForItem(it) {
  const campos = [
    ['Fecha', it.iso + (it.time ? ` ${it.time}` : '')],
    ['Tipo', it.paso],
    ['Responsable', it.responsable],
    ['Contacto', it.contacto],
    ['Proveedor', it.proveedor],
    ['Estado', it.estado],
    ['Tons', it.tons ? `${it.tons}` : '—'],
    ['Notas', it.notas || '—']
  ];
  return campos
    .filter(([_,v]) => v != null && String(v).trim() !== '')
    .map(([k,v]) => `${k}: ${String(v)}`)
    .join('\n');
}

function itemCard(it) {
  const dot  = colorForPaso(it.paso);
  const tons = it.tons ? ` · ${formatTons(it.tons)}` : '';
  const title = tooltipForItem(it);

  // Serializamos el raw en data-raw para poder recuperarlo en dblclick
  const rawEncoded = encodeURIComponent(JSON.stringify(it.raw || {}));

  return `
    <div class="ag-item" title="${escapeHtml(title)}" data-raw="${rawEncoded}">
      <div class="ag-item-top">
        <span class="ag-dot" style="background:${dot};"></span>
        <span class="ag-time">${escapeHtml(it.time || '')}</span>
        ${pillForEstado(it.estado)}
      </div>
      <div class="ag-item-main"><div class="ag-type">${escapeHtml(it.paso || '—')}</div></div>
      <div class="ag-item-sub">${escapeHtml(it.persona)}${tons}</div>
      <div class="ag-item-foot">${escapeHtml(it.responsable)}</div>
    </div>
  `;
}

function dayCell(cell, list, todayISO) {
  if (cell.empty) return `<div class="ag-day ag-empty" aria-hidden="true"></div>`;
  const isToday  = isoDate(cell.date) === todayISO;
  const isSunday = cell.date.getDay() === 0;

  const first = list.slice(0, 3).map(itemCard).join('');
  const full  = list.map(itemCard).join('');
  const moreN = Math.max(0, list.length - 3);

  return `
    <div class="ag-day ${isToday ? 'is-today':''} ${isSunday ? 'is-sunday':''}" data-expanded="0">
      <div class="ag-day-head"><span class="ag-day-num" title="${isoDate(cell.date)}">${cell.day}</span></div>
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
function buildMonthMatrixExact(refDate){
  const first = startOfMonth(refDate);
  const last  = endOfMonth(refDate);
  const dayIdx = (d) => (d.getDay() + 6) % 7; // L=0 … D=6

  const totalDays = last.getDate();
  const lead = dayIdx(first);
  const used = lead + totalDays;
  const tail = (7 - (used % 7)) % 7;

  const cells = [];
  for (let i=0;i<lead;i++) cells.push({ empty:true, date:new Date(NaN), day:null });
  for (let d=1; d<=totalDays; d++){
    const curr = new Date(first.getFullYear(), first.getMonth(), d);
    cells.push({ empty:false, date:curr, day:d });
  }
  for (let i=0;i<tail;i++) cells.push({ empty:true, date:new Date(NaN), day:null });

  if (cells.length <= 35) for (let i=0;i<42-cells.length;i++) cells.push({ empty:true, date:new Date(NaN), day:null });
  return cells;
}

/* ---------- format & misc ---------- */
function isoDate(d){ return d && !Number.isNaN(d.valueOf()) ? d.toISOString().slice(0,10) : ''; }
function timeHHMM(d){ const h=String(d.getHours()).padStart(2,'0'); const m=String(d.getMinutes()).padStart(2,'0'); return `${h}:${m}`; }
function formatMonth(d){
  const fmt = new Intl.DateTimeFormat('es-CL',{month:'long', year:'numeric'});
  const txt = fmt.format(d);
  return txt.charAt(0).toUpperCase()+txt.slice(1);
}
function formatTons(v){ return `${Number(v).toLocaleString('es-CL',{maximumFractionDigits:0})} t`; }
function escapeHtml(s){ return String(s||'').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }
function uniq(arr){ return Array.from(new Set(arr.filter(Boolean))); }
function populateSelectReset(sel, options){
  const keep = sel.value;
  sel.innerHTML = `<option value="">Todos</option>` + options.map(o => `<option>${escapeHtml(o)}</option>`).join('');
  if (options.includes(keep)) sel.value = keep; else sel.value = '';
}

/* ================= estilos ================= */
function injectStyles(){
  if (document.getElementById('ag-lite-styles')) return;
  const s = document.createElement('style');
  s.id = 'ag-lite-styles';
  s.textContent = `
    .ag-scope, .ag-scope * { box-sizing: border-box; }
    .ag-scope .hide{ display:none !important; }
    .ag-scope .ag-card{ width:100%; background:#fff; border-radius:12px; box-shadow:0 6px 16px rgba(0,0,0,.05); padding:10px; }
    .ag-scope .ag-header{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:4px; }
    .ag-scope .ag-title{ margin:0; font-size:16px; letter-spacing:.2px; font-weight:700; }

    /* Filtros */
    .ag-scope .ag-filters{
      display:grid;
      grid-template-columns: 220px 220px 1fr 120px;
      gap:10px; align-items:end; margin:6px 0 10px;
    }
    .ag-scope .ag-filter{ display:flex; flex-direction:column; gap:4px; min-width:160px; }
    .ag-scope .ag-filter-grow{ min-width:260px; }
    .ag-scope .ag-filter-min{ min-width:120px; }
    .ag-scope .ag-select{ width:100%; padding:6px 8px; border:1px solid #e5e7eb; border-radius:8px; font-size:12px; background:#fff; }
    .ag-scope .ag-input{ width:100%; padding:6px 8px; border:1px solid #e5e7eb; border-radius:8px; font-size:12px; background:#fff; }
    .ag-scope .ag-btn-secondary{ border:1px solid #cbd5e1; background:#fff; border-radius:8px; padding:6px 10px; font-size:12px; color:#334155; cursor:pointer; }
    .ag-scope .ag-filter label{ font-size:.72rem; color:#475569; font-weight:600; letter-spacing:.2px; }

    .ag-scope .ag-monthbar{ display:flex; align-items:center; justify-content:center; gap:8px; margin:0 0 6px; }
    .ag-scope .ag-month{ font-weight:700; letter-spacing:.3px; font-size:13px; }
    .ag-scope .ag-nav{ border:1px solid #e5e7eb; background:#f8fafc; border-radius:8px; padding:2px 8px; cursor:pointer; line-height:1; }

    .ag-scope .ag-weekdays{ display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); gap:6px; width:100%; }
    .ag-scope .ag-weekdays>div{ background:#f3f4f6; color:#0f172a; font-weight:700; border-radius:8px; padding:4px 6px; text-align:center; font-size:.78rem; }
    .ag-scope .ag-weekdays>div.is-sunday{ color:#b91c1c; } /* DOMINGO ROJO */

    .ag-scope .ag-grid{ display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); grid-auto-rows:auto; gap:6px; width:100%; }
    .ag-scope .ag-day{ background:#fff; border:1px solid #eef2f7; border-radius:10px; min-height:170px; display:flex; flex-direction:column; position:relative; }
    .ag-scope .ag-day.is-sunday .ag-day-num{ color:#b91c1c; }
    .ag-scope .ag-day-head{ display:flex; justify-content:flex-end; padding:4px 6px 0; }
    .ag-scope .ag-day-num{ font-weight:700; color:#475569; font-size:.8rem; }
    .ag-scope .ag-day-body{ padding:6px; display:flex; flex-direction:column; gap:4px; }

    /* === HOY bien destacado === */
    .ag-scope .ag-day.is-today{
      border-color:#10b981;               /* borde verde */
      background:#f0fdf4;                 /* verde muy suave */
      box-shadow:
        0 0 0 2px #bbf7d0 inset,          /* halo interior */
        0 0 0 2px rgba(16,185,129,.35);   /* aro exterior */
      position:relative;
      animation: agPulse 2.4s ease-in-out 1;
    }
    .ag-scope .ag-day.is-today .ag-day-num{
      color:#065f46;                       /* verde oscuro */
      background:#dcfce7;                  /* pastilla del número */
      border-radius:999px;
      padding:2px 6px;
    }
    .ag-scope .ag-day.is-today .ag-today-badge{
      position:absolute; right:6px; top:6px;
      width:auto; height:auto;
      padding:2px 6px;
      border-radius:999px;
      background:#10b981;                  /* verde PG */
      color:#fff; font-weight:700;
      font-size:.70rem;
    }
    @keyframes agPulse {
      0%{ box-shadow:0 0 0 0 rgba(16,185,129,.45); }
      70%{ box-shadow:0 0 0 8px rgba(16,185,129,0); }
      100%{ box-shadow:0 0 0 0 rgba(16,185,129,0); }
    }

    /* Tarjetas compactas */
    .ag-scope .ag-item{ border:1px solid #e5e7eb; border-radius:8px; padding:6px; background:#fff; }
    .ag-scope .ag-item-top{ display:flex; align-items:center; gap:6px; margin-bottom:2px; }
    .ag-scope .ag-dot{ width:6px; height:6px; border-radius:50%; display:inline-block; }
    .ag-scope .ag-time{ font-weight:700; color:#0f172a; font-size:.78rem; }
    .ag-scope .ag-pill{ margin-left:auto; font-size:.62rem; padding:0 6px; border-radius:999px; border:1px solid transparent; text-transform:capitalize; }
    .ag-scope .ag-type{ font-size:.8rem; font-weight:700; letter-spacing:.2px; line-height:1.05; }
    .ag-scope .ag-item-sub{ color:#475569; font-size:.78rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ag-scope .ag-item-foot{ color:#64748b; font-size:.72rem; }

    .ag-scope .ag-more{ margin:4px 0 0; border:1px dashed #cbd5e1; background:#fff; border-radius:8px; padding:4px 6px; font-size:.72rem; color:#334155; cursor:pointer; align-self:flex-start; }

    @media (max-width: 1200px){
      .ag-scope .ag-filters{ grid-template-columns: 1fr 1fr 1fr 120px; }
      .ag-scope .ag-day{ min-height:150px; }
    }
    @media (max-width: 900px){
      .ag-scope .ag-title{ font-size:15px; }
      .ag-scope .ag-day{ min-height:140px; }
      .ag-scope .ag-filters{ grid-template-columns: 1fr 1fr; }
    }
  `;
  document.head.appendChild(s);
}
