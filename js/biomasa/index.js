// js/biomasa/index.js — Módulo Biomasa: Calendario / Programas / Registro de Compras

const API = window.APP_CONFIG?.API_BASE_URL || '';

// ── Paleta de colores para proveedores en el calendario ──────────────────────
const PROVIDER_COLORS = [
  '#2dd4bf','#60a5fa','#f59e0b','#a78bfa','#f472b6',
  '#34d399','#fb923c','#818cf8','#e879f9','#38bdf8',
];
const providerColorMap = {};
let colorIdx = 0;
function getProviderColor(nombre) {
  if (!providerColorMap[nombre]) {
    providerColorMap[nombre] = PROVIDER_COLORS[colorIdx % PROVIDER_COLORS.length];
    colorIdx++;
  }
  return providerColorMap[nombre];
}

// ── Estado global ─────────────────────────────────────────────────────────────
let calView      = 'month';   // 'month' | 'week'
let calDate      = new Date();
let calData      = {};        // { 'YYYY-MM-DD': { total, items } }
let selectedDay  = null;
let programas    = [];
let progFiltro   = '';
let editingId    = null;      // programa en edición
let compraTratoId = null;     // trato seleccionado para registrar compra

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', { day:'2-digit', month:'short', year:'numeric', timeZone:'UTC' });
}
function fmtDateShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', { day:'2-digit', month:'short', timeZone:'UTC' });
}
function dayKey(date) {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function localDayKey(date) {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function toast(msg, ok = true) {
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:80px;right:20px;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999;background:${ok?'#0f766e':'#7f1d1d'};color:#fff;box-shadow:0 4px 20px rgba(0,0,0,.4);`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── API calls ─────────────────────────────────────────────────────────────────
async function apiGet(path) {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) { const e = await r.json().catch(()=>({error:'Error'})); throw new Error(e.error || r.statusText); }
  return r.json();
}
async function apiPost(path, body) {
  const r = await fetch(`${API}${path}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  if (!r.ok) { const e = await r.json().catch(()=>({error:'Error'})); throw new Error(e.error || r.statusText); }
  return r.json();
}
async function apiPut(path, body) {
  const r = await fetch(`${API}${path}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  if (!r.ok) { const e = await r.json().catch(()=>({error:'Error'})); throw new Error(e.error || r.statusText); }
  return r.json();
}
async function apiPatch(path, body) {
  const r = await fetch(`${API}${path}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  if (!r.ok) { const e = await r.json().catch(()=>({error:'Error'})); throw new Error(e.error || r.statusText); }
  return r.json();
}
async function apiDelete(path) {
  const r = await fetch(`${API}${path}`, { method:'DELETE' });
  if (!r.ok) { const e = await r.json().catch(()=>({error:'Error'})); throw new Error(e.error || r.statusText); }
  return r.json();
}

// ════════════════════════════════════════════════════════════════════════
// TAB 1: CALENDARIO
// ════════════════════════════════════════════════════════════════════════

function getCalRange() {
  if (calView === 'month') {
    const y = calDate.getFullYear(), m = calDate.getMonth();
    // Full grid range (Mon of first week to Sun of last week)
    const first = new Date(y, m, 1);
    const last  = new Date(y, m+1, 0);
    const startDay = (first.getDay() + 6) % 7; // 0=Mon
    const endDay   = (last.getDay() + 6) % 7;
    const from = new Date(first); from.setDate(first.getDate() - startDay);
    const to   = new Date(last);  to.setDate(last.getDate() + (6 - endDay));
    return { from: localDayKey(from), to: localDayKey(to) };
  } else {
    // Week: Mon to Sun
    const d = new Date(calDate);
    const day = (d.getDay() + 6) % 7;
    const mon = new Date(d); mon.setDate(d.getDate() - day);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: localDayKey(mon), to: localDayKey(sun) };
  }
}

async function loadCalendario() {
  const { from, to } = getCalRange();
  try {
    const res = await apiGet(`/api/programa-cosecha/calendario?from=${from}&to=${to}`);
    calData = res.calendario || {};
    renderCalendar();
    renderCalSummary();
  } catch(e) {
    console.error('Error cargando calendario:', e);
  }
}

function renderCalSummary() {
  let total = 0, max = 0;
  const provSet = new Set();
  Object.values(calData).forEach(d => {
    if (d.total > 0) {
      total += d.total;
      if (d.total > max) max = d.total;
      d.items.forEach(i => provSet.add(i.programaId));
    }
  });
  document.getElementById('calSumTotalCam').textContent = total;
  document.getElementById('calSumProgActivos').textContent = provSet.size;
  document.getElementById('calSumMaxDia').textContent = max || '—';
}

function renderCalendar() {
  if (calView === 'month') renderMonthView();
  else renderWeekView();
  renderLegend();
}

function renderMonthView() {
  document.getElementById('calMonthView').style.display = '';
  document.getElementById('calWeekView').style.display = 'none';
  const y = calDate.getFullYear(), m = calDate.getMonth();
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('calTitle').textContent = `${months[m]} ${y}`;

  const first = new Date(y, m, 1);
  const startDay = (first.getDay() + 6) % 7;
  const from = new Date(first); from.setDate(first.getDate() - startDay);

  const today = localDayKey(new Date());
  let html = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(from); d.setDate(from.getDate() + i);
    const key = localDayKey(d);
    const isOther = d.getMonth() !== m;
    const isToday = key === today;
    const isSel   = key === selectedDay;
    const data    = calData[key] || { total:0, items:[] };
    const dots    = data.items.slice(0,5).map(it => `<div class="cal-day-dot" style="background:${getProviderColor(it.proveedorNombre)};"></div>`).join('');

    html += `<div class="cal-day${isOther?' other-month':''}${isToday?' today':''}${isSel?' selected':''}" data-key="${key}">
      <div class="cal-day-num">${d.getDate()}</div>
      ${data.total > 0
        ? `<div class="cal-day-trucks">${data.total}</div><div class="cal-day-label">cam.</div><div class="cal-day-dots">${dots}</div>`
        : `<div class="cal-day-trucks zero">·</div>`}
    </div>`;
  }
  document.getElementById('calDays').innerHTML = html;
  document.getElementById('calDays').querySelectorAll('.cal-day:not(.other-month)').forEach(el => {
    el.addEventListener('click', () => selectDay(el.dataset.key));
  });
}

function renderWeekView() {
  document.getElementById('calMonthView').style.display = 'none';
  document.getElementById('calWeekView').style.display = '';
  const { from } = getCalRange();
  const mon = new Date(from + 'T00:00:00');
  const days = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const today = localDayKey(new Date());
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  document.getElementById('calTitle').textContent = (() => {
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return `${mon.getDate()} ${months[mon.getMonth()]} — ${sun.getDate()} ${months[sun.getMonth()]} ${sun.getFullYear()}`;
  })();

  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    const key  = localDayKey(d);
    const data = calData[key] || { total:0, items:[] };
    const isToday = key === today;
    const isSel   = key === selectedDay;
    const provLines = data.items.map(it =>
      `<div class="cal-week-provider"><div class="dot" style="background:${getProviderColor(it.proveedorNombre)};"></div>${esc(it.proveedorNombre)} ×${it.camiones}</div>`
    ).join('');
    html += `<div class="cal-week-day${isToday?' today':''}${isSel?' selected':''}" data-key="${key}">
      <div class="cal-week-day-name">${days[i]}</div>
      <div class="cal-week-day-num" style="color:${isToday?'#2dd4bf':'#94a3b8'}">${d.getDate()}</div>
      <div class="cal-week-trucks${data.total===0?' zero':''}">${data.total > 0 ? data.total : '·'}</div>
      ${data.total > 0 ? `<div class="cal-week-day-name" style="margin-top:2px;">camiones</div>` : ''}
      <div class="cal-week-providers">${provLines}</div>
    </div>`;
  }
  document.getElementById('calWeekDays').innerHTML = html;
  document.getElementById('calWeekDays').querySelectorAll('.cal-week-day').forEach(el => {
    el.addEventListener('click', () => selectDay(el.dataset.key));
  });
}

function renderLegend() {
  const provs = new Set();
  Object.values(calData).forEach(d => d.items.forEach(i => provs.add(i.proveedorNombre)));
  const html = [...provs].map(p =>
    `<div class="cal-legend-item"><div class="cal-legend-dot" style="background:${getProviderColor(p)};"></div>${esc(p)}</div>`
  ).join('');
  document.getElementById('calLegend').innerHTML = html;
}

function selectDay(key) {
  selectedDay = key;
  renderCalendar();
  renderDayDetail(key);
}

function renderDayDetail(key) {
  const data = calData[key] || { total:0, items:[] };
  const [y,m,d] = key.split('-');
  const fecha = new Date(Number(y), Number(m)-1, Number(d));
  const opts = { weekday:'long', day:'numeric', month:'long' };
  document.getElementById('calDetailTitle').textContent = fecha.toLocaleDateString('es-CL', opts);

  if (!data.items.length) {
    document.getElementById('calDetailBody').innerHTML = '<p class="cal-detail-empty">Sin despachos este día.</p>';
    return;
  }

  let html = `<div style="font-size:28px;font-weight:900;color:#2dd4bf;margin-bottom:16px;">${data.total} <span style="font-size:14px;color:#64748b;font-weight:600;">camiones totales</span></div>`;
  data.items.forEach(it => {
    const color = getProviderColor(it.proveedorNombre);
    html += `<div class="cal-detail-item">
      <div class="cal-detail-proveedor"><span style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;display:inline-block;"></span>${esc(it.proveedorNombre)}${it.estado==='pausado'?` <span class="badge-pausado">Pausado</span>`:''}</div>
      <div class="cal-detail-trucks">${it.camiones} cam${it.camiones!==1?'iones':'ión'}${it.esDiaEspecial?' <span style="font-size:11px;color:#f59e0b;font-weight:600;">· especial</span>':''}</div>
      ${it.condicion?`<div class="cal-detail-condicion"><i class="bi bi-flag-fill"></i> ${esc(it.condicion)}</div>`:''}
      ${it.nota?`<div class="cal-detail-nota">${esc(it.nota)}</div>`:''}
    </div>`;
  });
  document.getElementById('calDetailBody').innerHTML = html;
}

function navCal(delta) {
  if (calView === 'month') { calDate.setMonth(calDate.getMonth() + delta); }
  else { calDate.setDate(calDate.getDate() + delta * 7); }
  loadCalendario();
}

// ════════════════════════════════════════════════════════════════════════
// TAB 2: PROGRAMAS
// ════════════════════════════════════════════════════════════════════════

async function loadProgramas() {
  const url = progFiltro ? `/api/programa-cosecha?estado=${progFiltro}` : '/api/programa-cosecha';
  try {
    const res = await apiGet(url);
    programas = res.items || [];
    renderProgramas();
  } catch(e) {
    document.getElementById('progTableBody').innerHTML = `<tr><td colspan="6" class="prog-empty" style="color:#ef4444;">${esc(e.message)}</td></tr>`;
  }
}

function renderProgramas() {
  const tbody = document.getElementById('progTableBody');
  if (!programas.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="prog-empty"><i class="bi bi-inbox" style="font-size:28px;display:block;margin-bottom:8px;"></i>No hay programas</td></tr>`;
    return;
  }
  tbody.innerHTML = programas.map(p => {
    const estadoBadge = p.estado === 'activo' ? `<span class="badge-activo">Activo</span>`
      : p.estado === 'pausado' ? `<span class="badge-pausado2">Pausado</span>`
      : `<span class="badge-finalizado">Finalizado</span>`;
    return `<tr>
      <td>
        <div class="prog-proveedor">${esc(p.proveedorNombre)}</div>
        ${p.centroNombre?`<div class="prog-periodo">${esc(p.centroNombre)}</div>`:''}
      </td>
      <td>
        <div style="color:#f1f5f9;font-size:12px;">${fmtDateShort(p.vigenciaDesde)} — ${fmtDateShort(p.vigenciaHasta)}</div>
        ${p.tonsEstimadas?`<div class="prog-periodo">${p.tonsEstimadas} tons est.</div>`:''}
      </td>
      <td><span class="prog-camiones">${p.camionesDefault}</span></td>
      <td>
        ${p.condicionContinuidad
          ? `<div class="prog-condicion"><i class="bi bi-flag-fill"></i>${esc(p.condicionContinuidad)}</div>`
          : '<span style="color:#334155;">—</span>'}
      </td>
      <td>${estadoBadge}</td>
      <td>
        <div class="prog-actions">
          ${p.estado==='activo' ? `<button class="prog-btn write-only" title="Pausar" data-action="pausar" data-id="${p._id}"><i class="bi bi-pause-fill"></i></button>` : ''}
          ${p.estado==='pausado' ? `<button class="prog-btn write-only" title="Reanudar" data-action="reanudar" data-id="${p._id}" style="color:#4ade80;"><i class="bi bi-play-fill"></i></button>` : ''}
          ${p.estado!=='finalizado' ? `<button class="prog-btn write-only" title="Finalizar" data-action="finalizar" data-id="${p._id}" style="color:#f59e0b;"><i class="bi bi-check-square"></i></button>` : ''}
          <button class="prog-btn write-only" title="Editar" data-action="editar" data-id="${p._id}"><i class="bi bi-pencil"></i></button>
          <button class="prog-btn write-only danger" title="Eliminar" data-action="eliminar" data-id="${p._id}"><i class="bi bi-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleProgAction(btn.dataset.action, btn.dataset.id));
  });
}

async function handleProgAction(action, id) {
  const prog = programas.find(p => p._id === id);
  if (action === 'editar') { openProgramaModal(prog); return; }
  if (action === 'eliminar') {
    if (!confirm(`¿Eliminar programa de ${prog?.proveedorNombre}? Esta acción no se puede deshacer.`)) return;
    try { await apiDelete(`/api/programa-cosecha/${id}`); toast('Programa eliminado'); loadProgramas(); loadCalendario(); }
    catch(e) { toast(e.message, false); }
    return;
  }
  const estadoMap = { pausar:'pausado', reanudar:'activo', finalizar:'finalizado' };
  try {
    await apiPatch(`/api/programa-cosecha/${id}/estado`, { estado: estadoMap[action] });
    toast('Estado actualizado');
    loadProgramas(); loadCalendario();
  } catch(e) { toast(e.message, false); }
}

// ════════════════════════════════════════════════════════════════════════
// MODAL PROGRAMA
// ════════════════════════════════════════════════════════════════════════

let tratosDisponibles = [];

async function openProgramaModal(prog = null) {
  editingId = prog?._id || null;
  document.getElementById('modalProgramaTitulo').textContent = prog ? 'Editar programa' : 'Nuevo programa';
  document.getElementById('p-error').style.display = 'none';

  // Cargar tratos acordados para el select
  try {
    const res = await apiGet('/api/programa-cosecha/tratos-acordados');
    tratosDisponibles = res.items || [];
    const sel = document.getElementById('p-trato');
    sel.innerHTML = '<option value="">— Seleccionar trato acordado —</option>' +
      tratosDisponibles.map(t =>
        `<option value="${t._id}" data-proveedor="${esc(t.proveedorNombre)}" data-tons="${t.tonsAcordadas||''}" data-cam="${t.camionesXDia||''}" data-desde="${t.vigenciaDesde||''}" data-hasta="${t.vigenciaHasta||''}" data-centro="${esc(t.centroNombre||t.centroCodigo||'')}">
          ${esc(t.proveedorNombre)} — ${t.estado==='acordado'?'Acordado':'Efectuado'} ${t.tonsAcordadas?`(${t.tonsAcordadas}T)`:''}
        </option>`
      ).join('');
  } catch(e) { /* silenciar */ }

  if (prog) {
    document.getElementById('p-trato').value = prog.tratoId || '';
    document.getElementById('p-desde').value = prog.vigenciaDesde ? prog.vigenciaDesde.substring(0,10) : '';
    document.getElementById('p-hasta').value = prog.vigenciaHasta ? prog.vigenciaHasta.substring(0,10) : '';
    document.getElementById('p-camiones').value = prog.camionesDefault ?? 1;
    document.getElementById('p-tons').value = prog.tonsEstimadas || '';
    document.getElementById('p-condicion').value = prog.condicionContinuidad || '';
    document.getElementById('p-notas').value = prog.notas || '';
    renderDiasEsp(prog.diasEspeciales || []);
  } else {
    document.getElementById('p-trato').value = '';
    document.getElementById('p-desde').value = '';
    document.getElementById('p-hasta').value = '';
    document.getElementById('p-camiones').value = 1;
    document.getElementById('p-tons').value = '';
    document.getElementById('p-condicion').value = '';
    document.getElementById('p-notas').value = '';
    renderDiasEsp([]);
  }

  document.getElementById('overlayPrograma').classList.add('open');
  document.getElementById('modalPrograma').classList.add('open');
}

function closeProgramaModal() {
  document.getElementById('overlayPrograma').classList.remove('open');
  document.getElementById('modalPrograma').classList.remove('open');
  editingId = null;
}

// Días especiales
let diasEsp = [];
function renderDiasEsp(list) {
  diasEsp = list.map(d => ({ ...d, fecha: d.fecha ? String(d.fecha).substring(0,10) : '' }));
  redrawDiasEsp();
}
function redrawDiasEsp() {
  const cont = document.getElementById('diasEspList');
  cont.innerHTML = diasEsp.map((d, i) => `
    <div class="dia-esp-row">
      <input type="date" class="bio-input dia-fecha" data-i="${i}" value="${d.fecha||''}" />
      <input type="number" class="bio-input dia-cam" data-i="${i}" value="${d.camiones??1}" min="0" max="20" placeholder="Cam" />
      <input type="text" class="bio-input dia-nota" data-i="${i}" value="${esc(d.nota||'')}" placeholder="Nota (opcional)" />
      <button type="button" class="dia-esp-remove" data-i="${i}"><i class="bi bi-x"></i></button>
    </div>`).join('');
  cont.querySelectorAll('.dia-fecha').forEach(el => el.addEventListener('change', e => { diasEsp[+e.target.dataset.i].fecha = e.target.value; }));
  cont.querySelectorAll('.dia-cam').forEach(el => el.addEventListener('input', e => { diasEsp[+e.target.dataset.i].camiones = +e.target.value; }));
  cont.querySelectorAll('.dia-nota').forEach(el => el.addEventListener('input', e => { diasEsp[+e.target.dataset.i].nota = e.target.value; }));
  cont.querySelectorAll('.dia-esp-remove').forEach(el => el.addEventListener('click', e => { diasEsp.splice(+e.currentTarget.dataset.i, 1); redrawDiasEsp(); }));
}

// Al seleccionar un trato, pre-llenar datos
document.getElementById('p-trato').addEventListener('change', function() {
  const opt = this.options[this.selectedIndex];
  const desde = opt.dataset.desde; const hasta = opt.dataset.hasta;
  const cam = opt.dataset.cam; const tons = opt.dataset.tons;
  if (desde) document.getElementById('p-desde').value = desde.substring(0,10);
  if (hasta) document.getElementById('p-hasta').value = hasta.substring(0,10);
  if (cam)   document.getElementById('p-camiones').value = cam;
  if (tons)  document.getElementById('p-tons').value = tons;
  if (this.value) {
    const trato = tratosDisponibles.find(t => t._id === this.value);
    document.getElementById('p-trato-info').style.display = '';
    document.getElementById('p-trato-info').textContent = trato
      ? `${trato.tonsAcordadas ? trato.tonsAcordadas + ' tons acordadas · ' : ''}${trato.precioAcordado ? trato.precioAcordado + ' ' + (trato.unidadPrecio||'') + ' · ' : ''}${trato.notasTrato||''}`
      : '';
  } else { document.getElementById('p-trato-info').style.display = 'none'; }
});

document.getElementById('btnAddDiaEsp').addEventListener('click', () => {
  diasEsp.push({ fecha: '', camiones: 1, nota: '' });
  redrawDiasEsp();
});

document.getElementById('saveProgramaModal').addEventListener('click', async () => {
  const tratoVal = document.getElementById('p-trato').value;
  const desde    = document.getElementById('p-desde').value;
  const hasta    = document.getElementById('p-hasta').value;
  const camiones = Number(document.getElementById('p-camiones').value);
  const errEl    = document.getElementById('p-error');

  if (!desde || !hasta) { errEl.textContent = 'Las fechas de vigencia son obligatorias.'; errEl.style.display = ''; return; }
  if (camiones < 0)     { errEl.textContent = 'Camiones/día debe ser ≥ 0.'; errEl.style.display = ''; return; }
  errEl.style.display = 'none';

  const trato = tratosDisponibles.find(t => t._id === tratoVal);
  const body = {
    tratoId:      tratoVal || null,
    proveedorNombre: trato?.proveedorNombre || document.getElementById('p-trato').options[document.getElementById('p-trato').selectedIndex]?.text?.split(' —')[0] || 'Sin nombre',
    centroNombre: trato?.centroNombre || trato?.centroCodigo || '',
    vigenciaDesde: desde,
    vigenciaHasta: hasta,
    camionesDefault: camiones,
    tonsEstimadas: document.getElementById('p-tons').value ? Number(document.getElementById('p-tons').value) : null,
    condicionContinuidad: document.getElementById('p-condicion').value.trim(),
    notas: document.getElementById('p-notas').value.trim(),
    diasEspeciales: diasEsp.filter(d => d.fecha).map(d => ({ fecha: d.fecha, camiones: d.camiones, nota: d.nota })),
  };

  const btn = document.getElementById('saveProgramaModal');
  btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando…';
  try {
    if (editingId) {
      await apiPut(`/api/programa-cosecha/${editingId}`, body);
      toast('Programa actualizado');
    } else {
      await apiPost('/api/programa-cosecha', body);
      toast('Programa creado');
    }
    closeProgramaModal();
    loadProgramas();
    loadCalendario();
  } catch(e) {
    errEl.textContent = e.message;
    errEl.style.display = '';
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="bi bi-check-lg"></i> Guardar programa';
  }
});

document.getElementById('closeProgramaModal').addEventListener('click', closeProgramaModal);
document.getElementById('cancelProgramaModal').addEventListener('click', closeProgramaModal);
document.getElementById('overlayPrograma').addEventListener('click', closeProgramaModal);

// ════════════════════════════════════════════════════════════════════════
// TAB 3: REGISTRO DE COMPRAS
// ════════════════════════════════════════════════════════════════════════

async function loadRegistro() {
  try {
    const res = await apiGet('/api/programa-cosecha/tratos-acordados');
    const items = res.items || [];
    const acordados   = items.filter(t => t.estado === 'acordado');
    const efectuados  = items.filter(t => t.estado === 'compra_efectuada');

    document.getElementById('regCountAcordado').textContent  = acordados.length;
    document.getElementById('regCountEfectuada').textContent = efectuados.length;

    renderRegList('regAcordadoList', acordados, false);
    renderRegList('regEfectuadaList', efectuados, true);
  } catch(e) {
    document.getElementById('regAcordadoList').innerHTML = `<p class="reg-empty" style="color:#ef4444;">${esc(e.message)}</p>`;
  }
}

function renderRegList(containerId, items, isEfectuada) {
  const cont = document.getElementById(containerId);
  if (!items.length) {
    cont.innerHTML = `<p class="reg-empty">${isEfectuada ? 'Sin compras registradas aún.' : 'No hay acuerdos activos pendientes.'}</p>`;
    return;
  }
  cont.innerHTML = items.map(t => {
    const diff = isEfectuada && t.tonsAcordadas && t.tonsReales != null
      ? ((t.tonsReales - t.tonsAcordadas) / t.tonsAcordadas * 100).toFixed(1)
      : null;
    const diffColor = diff === null ? '' : Number(diff) >= 0 ? 'pos' : 'neg';
    return `<div class="reg-card${isEfectuada?' efectuada':''}">
      <div class="reg-card-left">
        <div class="reg-card-name">${esc(t.proveedorNombre)}</div>
        <div class="reg-card-meta">
          ${t.vigenciaDesde ? `<span><i class="bi bi-calendar3"></i>${fmtDateShort(t.vigenciaDesde)} — ${fmtDateShort(t.vigenciaHasta)}</span>` : ''}
          ${t.precioAcordado ? `<span><i class="bi bi-currency-dollar"></i>${t.precioAcordado} ${t.unidadPrecio||''}</span>` : ''}
          ${t.camionesXDia  ? `<span><i class="bi bi-truck"></i>${t.camionesXDia} cam/día</span>` : ''}
          ${t.centroCodigo  ? `<span><i class="bi bi-geo-alt"></i>${esc(t.centroCodigo)}</span>` : ''}
        </div>
        ${t.notasTrato ? `<div style="font-size:11px;color:#64748b;margin-top:6px;font-style:italic;">${esc(t.notasTrato)}</div>` : ''}
        ${t.notasCierre && isEfectuada ? `<div style="font-size:11px;color:#4ade80;margin-top:4px;">${esc(t.notasCierre)}</div>` : ''}
      </div>

      <div class="reg-card-tons">
        <div class="val">${t.tonsAcordadas ?? '—'}</div>
        <div class="lbl">TONS ACORDADAS</div>
      </div>

      ${isEfectuada ? `
        <div class="reg-card-tons">
          <div class="val real">${t.tonsReales ?? '—'}</div>
          <div class="lbl">TONS REALES</div>
        </div>
        ${diff !== null ? `
          <div class="reg-card-diff">
            <div class="val ${diffColor}">${diff > 0 ? '+' : ''}${diff}%</div>
            <div class="lbl">DIFERENCIA</div>
          </div>` : ''}
      ` : ''}

      <div class="reg-card-actions">
        ${!isEfectuada
          ? `<button class="am-btn am-btn-primary write-only" style="font-size:12px;padding:7px 14px;" data-action="compra" data-id="${t._id}">
               <i class="bi bi-bag-check"></i> Registrar compra
             </button>`
          : `<span style="font-size:11px;color:#4ade80;font-weight:700;display:flex;align-items:center;gap:4px;">
               <i class="bi bi-check-circle-fill"></i> Efectuada
             </span>`}
      </div>
    </div>`;
  }).join('');

  cont.querySelectorAll('[data-action="compra"]').forEach(btn => {
    btn.addEventListener('click', () => openCompraModal(btn.dataset.id));
  });
}

// Modal Registrar Compra
function openCompraModal(tratoId) {
  const trato = (window._tratosCache || []).find(t => t._id === tratoId);
  compraTratoId = tratoId;
  const info = document.getElementById('compraTratoInfo');
  if (trato) {
    info.innerHTML = `<strong style="color:#f1f5f9;">${esc(trato.proveedorNombre)}</strong>
      <div style="margin-top:6px;">Tons acordadas: <strong style="color:#2dd4bf;">${trato.tonsAcordadas ?? '—'}</strong>
      ${trato.precioAcordado ? ` · Precio: <strong>${trato.precioAcordado} ${trato.unidadPrecio||''}</strong>` : ''}</div>`;
  } else {
    info.textContent = '';
  }
  document.getElementById('c-tons-reales').value = trato?.tonsAcordadas || '';
  document.getElementById('c-notas-cierre').value = '';
  document.getElementById('c-error').style.display = 'none';
  document.getElementById('overlayCompra').classList.add('open');
  document.getElementById('modalCompra').classList.add('open');
}
function closeCompraModal() {
  document.getElementById('overlayCompra').classList.remove('open');
  document.getElementById('modalCompra').classList.remove('open');
  compraTratoId = null;
}

document.getElementById('saveCompraModal').addEventListener('click', async () => {
  const tons = document.getElementById('c-tons-reales').value;
  const errEl = document.getElementById('c-error');
  if (!tons || isNaN(Number(tons))) { errEl.textContent = 'Ingresa las tons reales recibidas.'; errEl.style.display = ''; return; }
  errEl.style.display = 'none';
  const btn = document.getElementById('saveCompraModal');
  btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando…';
  try {
    await apiPost(`/api/programa-cosecha/tratos/${compraTratoId}/compra`, {
      tonsReales:   Number(tons),
      notasCierre:  document.getElementById('c-notas-cierre').value.trim(),
    });
    toast('Compra registrada correctamente');
    closeCompraModal();
    loadRegistro();
  } catch(e) {
    errEl.textContent = e.message;
    errEl.style.display = '';
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="bi bi-bag-check"></i> Confirmar compra';
  }
});
document.getElementById('closeCompraModal').addEventListener('click', closeCompraModal);
document.getElementById('cancelCompraModal').addEventListener('click', closeCompraModal);
document.getElementById('overlayCompra').addEventListener('click', closeCompraModal);

// Cache tratos para el modal de compra
async function cacheTratos() {
  try {
    const res = await apiGet('/api/programa-cosecha/tratos-acordados');
    window._tratosCache = res.items || [];
  } catch {}
}

// ════════════════════════════════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════════════════════════════════

function setupTabs() {
  document.querySelectorAll('.bio-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.bio-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.bio-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById(tab.dataset.panel);
      if (panel) panel.classList.add('active');
      if (tab.dataset.panel === 'panel-programas') loadProgramas();
      if (tab.dataset.panel === 'panel-registro')  { cacheTratos(); loadRegistro(); }
    });
  });
}

function setupCalControls() {
  document.getElementById('calPrev').addEventListener('click', () => navCal(-1));
  document.getElementById('calNext').addEventListener('click', () => navCal(+1));
  document.querySelectorAll('.cal-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cal-view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      calView = btn.dataset.view;
      loadCalendario();
    });
  });
}

function setupProgFilters() {
  document.querySelectorAll('.prog-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.prog-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      progFiltro = btn.dataset.estado;
      loadProgramas();
    });
  });
}

function setupNewProg() {
  const openModal = () => openProgramaModal(null);
  document.getElementById('btnNuevoPrograma')?.addEventListener('click', openModal);
  document.getElementById('fabNuevoPrograma')?.addEventListener('click', openModal);
}

// ════════════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupCalControls();
  setupProgFilters();
  setupNewProg();
  loadCalendario();
});
