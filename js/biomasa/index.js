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
    const isOffDay = (i % 7 === 4 || i % 7 === 5);

    const hasCancelado = data.items.some(it => it.cancelado);
    const hasReduced   = data.items.some(it => it.esDiaEspecial && !it.cancelado && it.camiones < (it.camionesDefault ?? it.camiones));
    const hasExtra     = data.items.some(it => it.esDiaEspecial && !it.cancelado && it.camiones > (it.camionesDefault ?? it.camiones));
    const novDots = [
      hasCancelado ? `<span class="nov-dot cancel" title="Cancelado"></span>` : '',
      hasReduced   ? `<span class="nov-dot reduced" title="Reducido"></span>` : '',
      hasExtra     ? `<span class="nov-dot extra" title="Extra"></span>` : '',
    ].join('');

    html += `<div class="cal-day${isOther?' other-month':''}${isToday?' today':''}${isSel?' selected':''}${isOffDay?' off-day':''}" data-key="${key}">
      <div class="cal-day-num">${d.getDate()}</div>
      ${novDots ? `<div class="cal-day-novedad">${novDots}</div>` : ''}
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
    const isOffWeek = (i === 4 || i === 5);
    const wCancelado = data.items.some(it => it.cancelado);
    const wReduced   = data.items.some(it => it.esDiaEspecial && !it.cancelado && it.camiones < (it.camionesDefault ?? it.camiones));
    const wExtra     = data.items.some(it => it.esDiaEspecial && !it.cancelado && it.camiones > (it.camionesDefault ?? it.camiones));
    const wNovDots = [
      wCancelado ? `<span class="nov-dot cancel" title="Cancelado"></span>` : '',
      wReduced   ? `<span class="nov-dot reduced" title="Reducido"></span>` : '',
      wExtra     ? `<span class="nov-dot extra" title="Extra"></span>` : '',
    ].join('');

    html += `<div class="cal-week-day${isToday?' today':''}${isSel?' selected':''}${isOffWeek?' off-day':''}" data-key="${key}">
      <div class="cal-week-day-name">${days[i]}</div>
      <div class="cal-week-day-num" style="color:${isToday?'#2dd4bf':'#94a3b8'}">${d.getDate()}</div>
      <div class="cal-week-trucks${data.total===0?' zero':''}">${data.total > 0 ? data.total : '·'}</div>
      ${data.total > 0 ? `<div class="cal-week-day-name" style="margin-top:2px;">camiones</div>` : ''}
      ${wNovDots ? `<div class="cal-week-novedad">${wNovDots}</div>` : ''}
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
    const motivoText = it.motivo || it.nota || '';
    const novedadData = JSON.stringify({ progId: it.programaId, fecha: key, cam: it.camiones, camPlan: it.camionesDefault ?? it.camiones, motivo: motivoText, proveedor: it.proveedorNombre }).replace(/'/g, '&#39;');
    html += `<div class="cal-detail-item"${it.cancelado?' style="opacity:.75;border-color:#fca5a5;"':''}>
      <div class="cal-detail-proveedor">
        <span style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;display:inline-block;"></span>
        ${esc(it.proveedorNombre)}
        ${it.estado==='pausado'?` <span class="badge-pausado">Pausado</span>`:''}
        ${it.cancelado?' <span class="badge-cancelado">Cancelado</span>':''}
        ${it.esFueraDeTurno?' <span class="badge-fuera-turno">Fuera turno</span>':''}
      </div>
      <div class="cal-detail-trucks" style="${it.cancelado?'text-decoration:line-through;color:#ef4444;':''}">
        ${it.camiones} cam${it.camiones!==1?'iones':'ión'}
        ${it.esDiaEspecial&&!it.cancelado?' <span style="font-size:11px;color:#f59e0b;font-weight:600;">· especial</span>':''}
      </div>
      ${motivoText?`<div class="cal-detail-condicion" style="border-color:${it.cancelado?'#ef4444':'#f59e0b'};background:${it.cancelado?'#fff5f5':'#fffbeb'};"><i class="bi bi-chat-left-text"></i> ${esc(motivoText)}</div>`:''}
      ${it.condicion?`<div class="cal-detail-condicion"><i class="bi bi-flag-fill"></i> ${esc(it.condicion)}</div>`:''}
      <div class="cal-detail-edit write-only">
        <button class="btn-novedad${it.esDiaEspecial?' tiene-novedad':''}" data-novedad='${novedadData}'>
          <i class="bi bi-pencil-square"></i> ${it.esDiaEspecial ? 'Editar novedad' : 'Registrar novedad'}
        </button>
      </div>
    </div>`;
  });
  document.getElementById('calDetailBody').innerHTML = html;

  document.getElementById('calDetailBody').querySelectorAll('.btn-novedad').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = JSON.parse(btn.dataset.novedad);
      openNovedadModal(d.progId, d.fecha, d.cam, d.camPlan, d.proveedor, d.motivo);
    });
  });
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
    const DIAS_LABELS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const diasSemana  = Array.isArray(p.diasSemana) && p.diasSemana.length ? p.diasSemana : [0,1,2,3,4];
    const diasLabel   = diasSemana.map(n => DIAS_LABELS[n]).join(', ');
    return `<tr>
      <td>
        <div class="prog-proveedor">${esc(p.proveedorNombre)}</div>
        ${p.centroNombre?`<div class="prog-periodo">${esc(p.centroNombre)}</div>`:''}
      </td>
      <td>
        <div style="font-size:12px;color:var(--text-secondary,#475569);">${fmtDateShort(p.vigenciaDesde)} — ${fmtDateShort(p.vigenciaHasta)}</div>
        ${p.tonsEstimadas?`<div class="prog-periodo">${p.tonsEstimadas} tons est.</div>`:''}
        <div class="prog-periodo" style="margin-top:2px;"><i class="bi bi-calendar-week" style="margin-right:3px;"></i>${diasLabel}</div>
        ${p.totalCamionesEstimados ? `<div class="prog-periodo" style="margin-top:2px;"><i class="bi bi-truck" style="margin-right:3px;"></i>~${p.totalCamionesEstimados} cam. totales</div>` : ''}
        ${p.tipoProducto ? `<div class="prog-periodo" style="margin-top:2px;"><i class="bi bi-tag" style="margin-right:3px;color:#0d9488;"></i>${esc(p.tipoProducto)}</div>` : ''}
      </td>
      <td><span class="prog-camiones">${p.camionesDefault}</span></td>
      <td>
        ${p.condicionContinuidad
          ? `<div class="prog-condicion"><i class="bi bi-flag-fill"></i>${esc(p.condicionContinuidad)}</div>`
          : '<span style="color:var(--text-muted,#94a3b8);">—</span>'}
      </td>
      <td>${estadoBadge}</td>
      <td>
        <div class="prog-actions">
          ${p.estado==='activo'     ? `<button class="prog-btn write-only" title="Pausar" data-action="pausar" data-id="${p._id}"><i class="bi bi-pause-fill"></i></button>` : ''}
          ${p.estado==='pausado'    ? `<button class="prog-btn write-only" title="Reanudar" data-action="reanudar" data-id="${p._id}" style="color:#4ade80;"><i class="bi bi-play-fill"></i></button>` : ''}
          ${p.estado==='finalizado' ? `<button class="prog-btn write-only" title="Reactivar" data-action="reactivar" data-id="${p._id}" style="color:#0d9488;"><i class="bi bi-arrow-counterclockwise"></i></button>` : ''}
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
  if (action === 'finalizar') {
    if (!confirm(`¿Marcar como finalizado el programa de ${prog?.proveedorNombre}?\nPodrás reactivarlo si fue un error.`)) return;
  }
  if (action === 'eliminar') {
    if (!confirm(`¿Eliminar programa de ${prog?.proveedorNombre}? Esta acción no se puede deshacer.`)) return;
    try { await apiDelete(`/api/programa-cosecha/${id}`); toast('Programa eliminado'); loadProgramas(); loadCalendario(); }
    catch(e) { toast(e.message, false); }
    return;
  }
  const estadoMap = { pausar:'pausado', reanudar:'activo', reactivar:'activo', finalizar:'finalizado' };
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

  const activeDias = prog?.diasSemana ?? [0, 1, 2, 3, 4];
  document.querySelectorAll('#diasSemanaChecks .ds-check').forEach(lbl => {
    const val = Number(lbl.dataset.dia);
    const checked = activeDias.includes(val);
    lbl.classList.toggle('checked', checked);
  });

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
      <input type="number" class="bio-input dia-cam" data-i="${i}" value="${d.camiones??1}" min="0" max="20" placeholder="Cam" title="0 = cancelar ese día" />
      <input type="text" class="bio-input dia-nota" data-i="${i}" value="${esc(d.nota||'')}" placeholder="Motivo del cambio *" style="border-color:${d.nota?'var(--border,#e2e8f0)':'#f59e0b'};" />
      <button type="button" class="dia-esp-remove" data-i="${i}"><i class="bi bi-x"></i></button>
    </div>`).join('');
  cont.querySelectorAll('.dia-fecha').forEach(el => el.addEventListener('change', e => { diasEsp[+e.target.dataset.i].fecha = e.target.value; }));
  cont.querySelectorAll('.dia-cam').forEach(el => el.addEventListener('input', e => { diasEsp[+e.target.dataset.i].camiones = +e.target.value; }));
  cont.querySelectorAll('.dia-nota').forEach(el => el.addEventListener('input', e => {
    diasEsp[+e.target.dataset.i].nota = e.target.value;
    el.style.borderColor = e.target.value ? 'var(--border,#e2e8f0)' : '#f59e0b';
  }));
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

document.getElementById('diasSemanaChecks').addEventListener('click', e => {
  const lbl = e.target.closest('.ds-check');
  if (!lbl) return;
  lbl.classList.toggle('checked');
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
  const diasSemana = [...document.querySelectorAll('#diasSemanaChecks .ds-check.checked')]
    .map(lbl => Number(lbl.dataset.dia));

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
    diasSemana,
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
// TAB 3: SEGUIMIENTO DE PROGRAMAS
// ════════════════════════════════════════════════════════════════════════

const SEG_ICON  = { en_plan:'✅', con_retrasos:'⚠️', en_riesgo:'🔴' };
const SEG_LABEL = { en_plan:'En plan', con_retrasos:'Con retrasos', en_riesgo:'En riesgo' };
const CIERRE_LABEL = {
  completado: 'Completado normalmente',
  proveedor_paro: 'El proveedor paró anticipadamente',
  causa_externa: 'Causa externa',
  decision_interna: 'Decisión interna',
};

let segProgramaId = null;
let cierreProgramaId = null;

async function loadRegistro() {
  try {
    const res = await apiGet('/api/programa-cosecha');
    const todos = res.items || [];
    const activos   = todos.filter(p => p.estado === 'activo' || p.estado === 'pausado');
    const cerrados  = todos.filter(p => p.estado === 'finalizado');

    document.getElementById('segCountActivos').textContent  = activos.length;
    document.getElementById('segCountCerrados').textContent = cerrados.length;

    renderSegList('segActivosList', activos, false);
    renderSegList('segCerradosList', cerrados, true);
  } catch(e) {
    document.getElementById('segActivosList').innerHTML = `<p class="reg-empty" style="color:#ef4444;">${esc(e.message)}</p>`;
  }
}

function progDiasInfo(p) {
  const hoy   = new Date(); hoy.setHours(0,0,0,0);
  const desde = new Date(p.vigenciaDesde); desde.setHours(0,0,0,0);
  const hasta = new Date(p.vigenciaHasta); hasta.setHours(0,0,0,0);
  const total = Math.max(1, Math.round((hasta - desde) / 86400000) + 1);
  const transcurridos = Math.min(total, Math.max(0, Math.round((hoy - desde) / 86400000) + 1));
  const pct = Math.round(transcurridos / total * 100);
  return { total, transcurridos, pct };
}

function fmtRelative(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  if (d < 7)  return `hace ${d} días`;
  if (d < 30) return `hace ${Math.floor(d/7)} sem.`;
  return `hace ${Math.floor(d/30)} mes.`;
}

function renderSegList(containerId, items, isCerrado) {
  const cont = document.getElementById(containerId);
  if (!items.length) {
    cont.innerHTML = `<p class="reg-empty">${isCerrado ? 'Sin programas cerrados.' : 'No hay programas activos.'}</p>`;
    return;
  }
  cont.innerHTML = items.map(p => {
    const { total, transcurridos, pct } = progDiasInfo(p);
    const DIAS_LABELS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const diasLabel = (Array.isArray(p.diasSemana) && p.diasSemana.length ? p.diasSemana : [0,1,2,3,4])
      .map(n => DIAS_LABELS[n]).join(', ');

    const ultimo = p.seguimientos && p.seguimientos.length ? p.seguimientos[0] : null;
    const ultimoHtml = ultimo
      ? `<div class="seg-last-entry">
           <span>${SEG_ICON[ultimo.estado]}</span>
           <span class="seg-entry-date">${fmtRelative(ultimo.fecha)}</span>
           <span style="color:#94a3b8;">—</span>
           <span class="seg-entry-nota">${esc(ultimo.nota || SEG_LABEL[ultimo.estado])}</span>
         </div>`
      : `<div class="seg-last-none"><i class="bi bi-info-circle"></i> Sin seguimientos registrados aún</div>`;

    const historial = (p.seguimientos || []).map(s => `
      <div class="seg-entry">
        <span class="seg-entry-icon">${SEG_ICON[s.estado]}</span>
        <div style="flex:1;">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:2px;">
            <span class="seg-entry-date">${fmtDate(s.fecha)}</span>
            <span class="badge-${s.estado}">${SEG_LABEL[s.estado]}</span>
          </div>
          ${s.nota ? `<div class="seg-entry-nota">${esc(s.nota)}</div>` : ''}
        </div>
      </div>`).join('');

    const histCount = (p.seguimientos || []).length;
    const estadoBadge = p.estado === 'activo' ? `<span class="badge-activo">Activo</span>`
      : p.estado === 'pausado' ? `<span class="badge-pausado2">Pausado</span>`
      : `<span class="badge-finalizado">Finalizado</span>`;

    return `<div class="seg-card" id="segcard-${p._id}">
      <div class="seg-card-header">
        <div class="seg-card-info">
          <div class="seg-card-name">${esc(p.proveedorNombre)}</div>
          <div class="seg-card-meta">
            ${estadoBadge}
            <span><i class="bi bi-calendar3"></i>${fmtDateShort(p.vigenciaDesde)} — ${fmtDateShort(p.vigenciaHasta)}</span>
            <span><i class="bi bi-truck"></i>${p.camionesDefault} cam/día · ${diasLabel}</span>
            ${p.totalCamionesEstimados ? `<span><i class="bi bi-truck"></i>~${p.totalCamionesEstimados} cam. totales</span>` : ''}
            ${p.tipoProducto ? `<span><i class="bi bi-tag" style="color:#0d9488;"></i>${esc(p.tipoProducto)}</span>` : ''}
            ${p.tonsEstimadas ? `<span><i class="bi bi-boxes"></i>~${p.tonsEstimadas} tons est.</span>` : ''}
          </div>
          ${isCerrado && p.motivoCierre ? `<div style="margin-top:6px;font-size:11px;color:#94a3b8;"><i class="bi bi-flag"></i> ${esc(CIERRE_LABEL[p.motivoCierre] || p.motivoCierre)}</div>` : ''}
        </div>
        ${!isCerrado ? `
        <div class="seg-card-actions write-only">
          <button class="am-btn am-btn-secondary" style="font-size:12px;padding:6px 12px;" data-action="seg" data-id="${p._id}">
            <i class="bi bi-plus-lg"></i> Seguimiento
          </button>
          <button class="prog-btn" style="color:#64748b;" title="Cerrar programa" data-action="cerrar" data-id="${p._id}">
            <i class="bi bi-flag"></i>
          </button>
        </div>` : ''}
      </div>

      <div class="seg-progress">
        <div class="seg-progress-label">
          <span>Progreso del período</span>
          <span>${transcurridos} / ${total} días (${pct}%)</span>
        </div>
        <div class="seg-progress-bar"><div class="seg-progress-fill" style="width:${pct}%;"></div></div>
      </div>

      <div class="seg-last">${ultimoHtml}</div>

      ${histCount > 0 ? `
      <div class="seg-history">
        <button class="seg-history-toggle" data-target="hist-${p._id}">
          <i class="bi bi-chevron-down"></i> ${histCount} entrada${histCount !== 1 ? 's' : ''} de seguimiento
        </button>
        <div class="seg-history-body" id="hist-${p._id}">${historial}</div>
      </div>` : ''}
    </div>`;
  }).join('');

  cont.querySelectorAll('[data-action="seg"]').forEach(btn =>
    btn.addEventListener('click', () => openSegModal(btn.dataset.id, items.find(p => p._id === btn.dataset.id)?.proveedorNombre)));
  cont.querySelectorAll('[data-action="cerrar"]').forEach(btn =>
    btn.addEventListener('click', () => openCierreModal(btn.dataset.id, items.find(p => p._id === btn.dataset.id)?.proveedorNombre)));
  cont.querySelectorAll('.seg-history-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const body = document.getElementById(btn.dataset.target);
      body.classList.toggle('open');
      btn.querySelector('i').className = body.classList.contains('open') ? 'bi bi-chevron-up' : 'bi bi-chevron-down';
    });
  });
}

// ── Modal Seguimiento ─────────────────────────────────────────────────────────

function openSegModal(id, nombre) {
  segProgramaId = id;
  document.getElementById('modalSegTitulo').textContent = `Seguimiento — ${nombre || ''}`;
  document.querySelectorAll('.seg-opt-label').forEach(l => l.classList.remove('selected'));
  document.getElementById('seg-nota').value = '';
  document.getElementById('seg-error').style.display = 'none';
  document.getElementById('overlaySegModal').classList.add('open');
  document.getElementById('modalSeg').classList.add('open');
}
function closeSegModal() {
  document.getElementById('overlaySegModal').classList.remove('open');
  document.getElementById('modalSeg').classList.remove('open');
  segProgramaId = null;
}

document.querySelectorAll('.seg-opt-label').forEach(lbl => {
  lbl.addEventListener('click', () => {
    document.querySelectorAll('.seg-opt-label').forEach(l => l.classList.remove('selected'));
    lbl.classList.add('selected');
    lbl.querySelector('input').checked = true;
  });
});

document.getElementById('saveSegModal').addEventListener('click', async () => {
  const estado = document.querySelector('.seg-opt-label.selected')?.dataset.val;
  const nota   = document.getElementById('seg-nota').value.trim();
  const errEl  = document.getElementById('seg-error');
  if (!estado) { errEl.textContent = 'Selecciona cómo va el programa.'; errEl.style.display = ''; return; }
  if (!nota)   { errEl.textContent = 'La nota es obligatoria.'; errEl.style.display = ''; return; }
  errEl.style.display = 'none';
  const btn = document.getElementById('saveSegModal');
  btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando…';
  try {
    await apiPost(`/api/programa-cosecha/${segProgramaId}/seguimiento`, { estado, nota });
    toast('Seguimiento registrado');
    closeSegModal();
    loadRegistro();
  } catch(e) {
    errEl.textContent = e.message; errEl.style.display = '';
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="bi bi-check-lg"></i> Guardar seguimiento';
  }
});
document.getElementById('closeSegModal').addEventListener('click', closeSegModal);
document.getElementById('cancelSegModal').addEventListener('click', closeSegModal);
document.getElementById('overlaySegModal').addEventListener('click', closeSegModal);

// ── Modal Cierre ──────────────────────────────────────────────────────────────

function openCierreModal(id, nombre) {
  cierreProgramaId = id;
  document.getElementById('modalCierreTitulo').textContent = `Cerrar programa — ${nombre || ''}`;
  document.querySelectorAll('.cierre-opt-label').forEach(l => l.classList.remove('selected'));
  document.getElementById('cierre-nota').value = '';
  document.getElementById('cierre-error').style.display = 'none';
  document.getElementById('overlayCierreModal').classList.add('open');
  document.getElementById('modalCierre').classList.add('open');
}
function closeCierreModal() {
  document.getElementById('overlayCierreModal').classList.remove('open');
  document.getElementById('modalCierre').classList.remove('open');
  cierreProgramaId = null;
}

document.querySelectorAll('.cierre-opt-label').forEach(lbl => {
  lbl.addEventListener('click', () => {
    document.querySelectorAll('.cierre-opt-label').forEach(l => l.classList.remove('selected'));
    lbl.classList.add('selected');
    lbl.querySelector('input').checked = true;
  });
});

document.getElementById('saveCierreModal').addEventListener('click', async () => {
  const motivo = document.querySelector('.cierre-opt-label.selected')?.dataset.val;
  const nota   = document.getElementById('cierre-nota').value.trim();
  const errEl  = document.getElementById('cierre-error');
  if (!motivo) { errEl.textContent = 'Selecciona el motivo de cierre.'; errEl.style.display = ''; return; }
  errEl.style.display = 'none';
  const btn = document.getElementById('saveCierreModal');
  btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Cerrando…';
  try {
    await apiPost(`/api/programa-cosecha/${cierreProgramaId}/cerrar`, { motivoCierre: motivo, nota });
    toast('Programa cerrado');
    closeCierreModal();
    loadRegistro();
    loadProgramas();
    loadCalendario();
  } catch(e) {
    errEl.textContent = e.message; errEl.style.display = '';
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="bi bi-flag"></i> Cerrar programa';
  }
});
document.getElementById('closeCierreModal').addEventListener('click', closeCierreModal);
document.getElementById('cancelCierreModal').addEventListener('click', closeCierreModal);
document.getElementById('overlayCierreModal').addEventListener('click', closeCierreModal);

// ════════════════════════════════════════════════════════════════════════
// MODAL NOVEDAD DIARIA
// ════════════════════════════════════════════════════════════════════════

let novedadProgId = null;
let novedadFecha  = null;
let novedadCamSel = null;

function openNovedadModal(progId, fecha, camActual, camPlan, proveedor, motivoActual) {
  novedadProgId = progId;
  novedadFecha  = fecha;
  novedadCamSel = camActual;

  const [y, m, d] = fecha.split('-');
  const fechaStr = new Date(Number(y), Number(m)-1, Number(d))
    .toLocaleDateString('es-CL', { weekday:'long', day:'numeric', month:'long' });
  document.getElementById('modalNovedadTitulo').textContent = fechaStr;
  document.getElementById('novedadPlanInfo').innerHTML =
    `<strong>${esc(proveedor)}</strong> · Planificado: <strong>${camPlan} camión${camPlan!==1?'es':''}</strong>`;

  // Marcar el botón del valor actual
  document.querySelectorAll('.cam-btn').forEach(b => {
    b.classList.remove('sel', 'sel-0');
    if (Number(b.dataset.cam) === camActual) {
      b.classList.add(camActual === 0 ? 'sel-0' : 'sel');
    }
  });

  document.getElementById('novedad-nota').value = motivoActual || '';
  document.getElementById('novedad-error').style.display = 'none';
  document.getElementById('overlayNovedad').classList.add('open');
  document.getElementById('modalNovedad').classList.add('open');
}

function closeNovedadModal() {
  document.getElementById('overlayNovedad').classList.remove('open');
  document.getElementById('modalNovedad').classList.remove('open');
  novedadProgId = null; novedadFecha = null; novedadCamSel = null;
}

document.getElementById('camBtns').addEventListener('click', e => {
  const btn = e.target.closest('.cam-btn');
  if (!btn) return;
  novedadCamSel = Number(btn.dataset.cam);
  document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('sel', 'sel-0'));
  btn.classList.add(novedadCamSel === 0 ? 'sel-0' : 'sel');
});

document.getElementById('saveNovedadModal').addEventListener('click', async () => {
  const nota  = document.getElementById('novedad-nota').value.trim();
  const errEl = document.getElementById('novedad-error');
  if (novedadCamSel === null) { errEl.textContent = 'Selecciona cuántos camiones llegaron.'; errEl.style.display = ''; return; }
  if (!nota) { errEl.textContent = 'El motivo es obligatorio.'; errEl.style.display = ''; return; }
  errEl.style.display = 'none';
  const btn = document.getElementById('saveNovedadModal');
  btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando…';
  try {
    await apiPatch(`/api/programa-cosecha/${novedadProgId}/dia-especial`, {
      fecha:    novedadFecha,
      camiones: novedadCamSel,
      nota,
    });
    toast('Novedad registrada');
    closeNovedadModal();
    loadCalendario();
  } catch(e) {
    errEl.textContent = e.message; errEl.style.display = '';
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="bi bi-check-lg"></i> Guardar';
  }
});

document.getElementById('btnResetNovedad').addEventListener('click', async () => {
  if (!confirm('¿Restablecer este día a lo planificado? Se borrará la novedad registrada.')) return;
  const btn = document.getElementById('saveNovedadModal');
  btn.disabled = true;
  try {
    await apiPatch(`/api/programa-cosecha/${novedadProgId}/dia-especial`, {
      fecha:    novedadFecha,
      camiones: null,
      nota:     '',
    });
    toast('Día restablecido a lo planificado');
    closeNovedadModal();
    loadCalendario();
  } catch(e) {
    document.getElementById('novedad-error').textContent = e.message;
    document.getElementById('novedad-error').style.display = '';
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('closeNovedadModal').addEventListener('click', closeNovedadModal);
document.getElementById('cancelNovedadModal').addEventListener('click', closeNovedadModal);
document.getElementById('overlayNovedad').addEventListener('click', closeNovedadModal);

// ════════════════════════════════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════════════════════════════════

function setupTabs() {
  const fab = document.getElementById('fabNuevoPrograma');
  document.querySelectorAll('.bio-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.bio-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.bio-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById(tab.dataset.panel);
      if (panel) panel.classList.add('active');
      if (fab) fab.style.display = tab.dataset.panel === 'panel-programas' ? '' : 'none';
      if (tab.dataset.panel === 'panel-programas') loadProgramas();
      if (tab.dataset.panel === 'panel-registro')  { loadRegistro(); }
    });
  });
  // Ocultar FAB en la tab inicial (Calendario)
  if (fab) fab.style.display = 'none';
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
  document.getElementById('fabNuevoPrograma')?.addEventListener('click', () => openProgramaModal(null));
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
