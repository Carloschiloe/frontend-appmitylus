/**
 * js/dashboard/render.js (Actualizado)
 */

import { state, STATUS_ORDER, STATUS_LABELS, fmtN, esc, toArray } from './state.js';
import { ui } from './ui.js';

// --- Helpers Existentes (Re-implementados para el módulo) ---
function dateFrom(item, keys) {
  for (const k of keys) {
    if (!item?.[k]) continue;
    const d = new Date(item[k]);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function providerKeyOf(x) {
  const k = String(x?.proveedorKey || '').trim();
  if (k) return k;
  const n = String(x?.proveedorNombre || x?.proveedor || '').trim().toLowerCase();
  return n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function getResponsable(x) { return String(x?.responsablePG || x?.responsable || x?.contactoResponsable || '').trim(); }
function getComuna(x) { return String(x?.centroComuna || x?.comuna || '').trim(); }
function textBag(x) { return [x?.proveedorNombre, x?.contactoNombre, x?.contacto, x?.proveedor, x?.centroCodigo, x?.centroComuna, x?.comuna, x?.proximoPaso].filter(Boolean).join(' ').toLowerCase(); }

function contactMatches(c) {
  const f = state.filters;
  if (f.responsable && getResponsable(c) !== f.responsable) return false;
  if (f.comuna && getComuna(c) !== f.comuna) return false;
  const q = String(f.texto || '').trim().toLowerCase();
  if (q && !textBag(c).includes(q)) return false;
  return true;
}

function buildAllowedProviderKeys() {
  const f = state.filters;
  if (!f.responsable && !f.comuna && !f.texto) return null;
  const keys = new Set();
  (state.raw.contactos || []).forEach(c => { if (contactMatches(c)) keys.add(providerKeyOf(c)); });
  return keys;
}

function overlapDays(aStart, aEnd, bStart, bEnd) {
  const s = Math.max(aStart.getTime(), bStart.getTime());
  const e = Math.min(aEnd.getTime(), bEnd.getTime());
  return e < s ? 0 : Math.floor((e - s) / (24 * 60 * 60 * 1000)) + 1;
}

function monthRangeFromKey(mk) {
  const [y, m] = mk.split('-').map(Number);
  return { start: new Date(y, m - 1, 1, 0, 0, 0, 0), end: new Date(y, m, 0, 23, 59, 59, 999) };
}

function monthKeyFrom(x) {
  const mk = String(x?.mesKey || x?.periodo || '').trim();
  if (/^\d{4}-\d{2}$/.test(mk)) return mk;
  const d = dateFrom(x, ['fecha', 'createdAt', 'updatedAt']);
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : '';
}

function normalizeEstadoOportunidad(o) {
  const e = String(o?.estado || '').toLowerCase();
  const r = String(o?.resultadoFinal || '').toLowerCase();
  if (e === 'semi_acordado' || e === 'semi_cerrado') return 'semi_acordado';
  if (e === 'acordado' || e === 'cerrado' || ['adquirido', 'comprado'].includes(e) || r === 'vendido') return 'acordado';
  if (e === 'descartado') return 'descartado';
  if (e === 'perdido' || r === 'no_vendido') return 'perdido';
  return '';
}

function computeBiomasaForRange(start, end, allowed) {
  const totals = { disponible: 0, semi_acordado: 0, acordado: 0, descartado: 0, perdido: 0 };
  const contrib = { disponible: new Map(), semi_acordado: new Map(), acordado: new Map(), descartado: new Map(), perdido: new Map() };
  
  const allowedRow = (row) => {
    const k = providerKeyOf(row);
    if (allowed && k && !allowed.has(k)) return false;
    const q = String(state.filters.texto || '').trim().toLowerCase();
    if (q && !textBag(row).includes(q)) return false;
    return true;
  };

  (state.raw.disponibilidades || []).forEach(r => {
    if (!allowedRow(r)) return;
    const mk = monthKeyFrom(r); if (!mk) return;
    const m = monthRangeFromKey(mk);
    const d = overlapDays(m.start, m.end, start, end); if (!d) return;
    const tons = Number(r.tons ?? r.tonsDisponible ?? 0) * (d / (overlapDays(m.start, m.end, m.start, m.end) || 30));
    totals.disponible += tons;
    addContrib(contrib, 'disponible', r, tons);
  });

  (state.raw.oportunidades || []).forEach(o => {
    if (!allowedRow(o)) return;
    const status = normalizeEstadoOportunidad(o); if (!status) return;
    const tons = Number(o.tonsAcordadas ?? o.biomasaEstimacion ?? 0); if (!tons) return;
    const rs = dateFrom(o, ['vigenciaDesde', 'fechaInicio', 'createdAt', 'updatedAt']);
    const re = dateFrom(o, ['vigenciaHasta']) || rs;
    const d = overlapDays(rs, re, start, end); if (!d) return;
    const val = tons * (d / (overlapDays(rs, re, rs, re) || 1));
    totals[status] += val;
    addContrib(contrib, status, o, val);
  });

  return { totals, contrib: Object.fromEntries(Object.entries(contrib).map(([k, m]) => [k, Array.from(m.values()).sort((a,b)=>b.tons-a.tons)])) };
}

function addContrib(contrib, status, row, tons) {
  const key = providerKeyOf(row);
  const label = row?.proveedorNombre || row?.proveedor || row?.contactoNombre || 'Sin proveedor';
  const prev = contrib[status].get(key) || { label, tons: 0, key };
  prev.tons += tons;
  contrib[status].set(key, prev);
}

// --- Renderers ---

export function populateGlobalFilters() {
  const contactos = state.raw.contactos || [];
  const respons = [...new Set(contactos.map(getResponsable).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  if (ui.fResp) ui.fResp.innerHTML = '<option value="">Todos los responsables</option>' + respons.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('');
  if (ui.fComuna) {
    const comunas = [...new Set(contactos.map(getComuna).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    ui.fComuna.innerHTML = '<option value="">Todas las comunas</option>' + comunas.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  }
}

export function renderActivity() {
  if (!ui.activity) return;
  const days = Number(state.filters.periodoDias || 30);
  const maxMs = days * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const TYPE_ICON = {
    'Visita':      { icon: 'bi-geo-alt-fill',       color: '#7c3aed' },
    'Interacción': { icon: 'bi-chat-left-dots-fill', color: '#2563eb' },
    'Contacto':    { icon: 'bi-person-fill-add',     color: '#0d9488' }
  };

  const activity = [
    ...(state.raw.visitas || []).map(v => ({ type: 'Visita', subtitle: v.proveedorNombre || v.proveedor || v.proximoPaso || '—', at: dateFrom(v, ['fecha', 'createdAt']) })),
    ...(state.raw.interacciones || []).map(i => ({ type: 'Interacción', subtitle: i.proveedorNombre || i.proveedor || i.tipo || '—', at: dateFrom(i, ['fecha', 'createdAt']) })),
    ...(state.raw.contactos || []).map(c => ({ type: 'Contacto', subtitle: c.proveedorNombre || c.contactoNombre || '—', at: dateFrom(c, ['createdAt']) }))
  ].filter(x => x.at && (now - x.at.getTime()) <= maxMs)
   .sort((a, b) => b.at - a.at)
   .slice(0, 8);

  ui.activity.innerHTML = activity.length
    ? activity.map(it => {
        const ti = TYPE_ICON[it.type] || { icon: 'bi-circle-fill', color: '#94a3b8' };
        return `<li class="timeline-item">
          <div class="timeline-top">
            <span class="timeline-title"><i class="bi ${ti.icon}" style="color:${ti.color}; margin-right:5px;"></i>${esc(it.type)}</span>
            <span class="timeline-date">${it.at.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}</span>
          </div>
          <div class="timeline-sub">${esc(it.subtitle)}</div>
        </li>`;
      }).join('')
    : '<li class="empty">Sin actividad en este periodo.</li>';
}

export function renderBiomasaKpis() {
  const now = new Date();
  const offset = state.bio.offset;
  let start = new Date(now.getFullYear(), now.getMonth()+offset, 1);
  let end   = new Date(now.getFullYear(), now.getMonth()+offset+1, 0, 23, 59, 59);
  
  if (state.bio.scale === 'week') {
    start = new Date(now); start.setDate(start.getDate() - start.getDay() + offset*7); start.setHours(0,0,0,0);
    end = new Date(start); end.setDate(end.getDate()+6); end.setHours(23,59,59,999);
  }

  const allowed = buildAllowedProviderKeys();
  const { totals, contrib } = computeBiomasaForRange(start, end, allowed);
  state.bioContrib = contrib;
  
  if (ui.bioPeriodLabel) ui.bioPeriodLabel.textContent = start.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  
  // Mapeo correcto de IDs: disponible, semi_acordado -> bioCardSemi, acordado -> bioCardConfirmado, etc.
  if (ui.bioCardDisponible) ui.bioCardDisponible.textContent = fmtN(totals.disponible);
  if (ui.bioCardSemi) ui.bioCardSemi.textContent = fmtN(totals.semi_acordado);
  if (ui.bioCardConfirmado) ui.bioCardConfirmado.textContent = fmtN(totals.acordado);
  if (ui.bioCardDescartado) ui.bioCardDescartado.textContent = fmtN(totals.descartado);
  if (ui.bioCardPerdido) ui.bioCardPerdido.textContent = fmtN(totals.perdido);
  
  renderBiomasaChart(totals);
  renderBiomasaTable(totals); // <-- Añadido
  renderProvidersByStatus(state.bio.focusStatus);
}

function renderBiomasaTable(totals) {
  if (!ui.bioTableBody) return;
  const rows = STATUS_ORDER.map(k => `
    <tr>
      <td>${STATUS_LABELS[k]}</td>
      <td>${fmtN(totals[k])}</td>
    </tr>
  `).join('');
  const total = STATUS_ORDER.reduce((acc, k) => acc + (totals[k] || 0), 0);
  ui.bioTableBody.innerHTML = rows + `
    <tr class="total-row">
      <td><strong>Total</strong></td>
      <td><strong>${fmtN(total)}</strong></td>
    </tr>
  `;
}

export function renderBiomasaChart(totals) {
  if (!ui.bioChart || typeof Chart === 'undefined') return;
  const colors = { disponible: '#0d9488', semi_acordado: '#f59e0b', acordado: '#10b981', descartado: '#94a3b8', perdido: '#ef4444' };
  if (state.chart) state.chart.destroy();
  state.chart = new Chart(ui.bioChart, {
    type: 'bar',
    data: {
      labels: STATUS_ORDER.map(k => STATUS_LABELS[k]),
      datasets: [{ data: STATUS_ORDER.map(k => totals[k]), backgroundColor: STATUS_ORDER.map(k => colors[k]), borderRadius: 8 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'end', formatter: v => fmtN(v) } },
      scales: { y: { beginAtZero: true } },
      onClick: (_, els) => {
        if (!els.length) { state.bio.focusStatus = null; } 
        else { const s = STATUS_ORDER[els[0].index]; state.bio.focusStatus = (state.bio.focusStatus === s) ? null : s; }
        renderProvidersByStatus(state.bio.focusStatus);
      }
    }
  });
}

function renderProvidersByStatus(status) {
  if (!ui.bioProvidersList) return;
  let rows = status ? (state.bioContrib[status] || []) : STATUS_ORDER.flatMap(k => state.bioContrib[k] || []);
  ui.bioProvidersList.innerHTML = rows.slice(0, 10).map(r => `
    <li class="bio-providers-item"><span>${esc(r.label)}</span><strong>${fmtN(r.tons)} t</strong></li>
  `).join('') || '<li class="empty">Sin datos.</li>';
}

export function renderAll(data) {
  let sanitario = null;
  if (data && Array.isArray(data)) {
    state.raw = {
      contactos: toArray(data[0]),
      visitas: toArray(data[1]),
      interacciones: toArray(data[2]),
      disponibilidades: toArray(data[3]),
      oportunidades: toArray(data[4])
    };
    sanitario = data[5] || null;
  }
  renderKpis(sanitario);
  renderHorizonte();
  renderPipeline();
  renderTopProveedores();
  renderActivity();
  renderPendientes();
  renderBiomasaKpis();
  syncClearBtn();
}

function syncClearBtn() {
  const f = state.filters;
  const dirty = !!(f.responsable || f.comuna || (f.texto && f.texto.trim()) || (f.periodoDias && f.periodoDias !== 30));
  if (ui.fClear) ui.fClear.style.display = dirty ? 'inline-flex' : 'none';
}

export function renderKpis(sanitario) {
  const now = new Date();

  // Helper: tons acordadas/semi en un rango de fechas
  function tonsEnRango(estado, start, end) {
    let total = 0;
    (state.raw.oportunidades || []).forEach(o => {
      if (normalizeEstadoOportunidad(o) !== estado) return;
      const tons = Number(o.tonsAcordadas ?? o.biomasaEstimacion ?? 0);
      if (!tons) return;
      const rs = dateFrom(o, ['vigenciaDesde', 'fechaInicio', 'createdAt', 'updatedAt']);
      const re = dateFrom(o, ['vigenciaHasta']) || rs;
      if (!rs) return;
      const d = overlapDays(rs, re, start, end);
      if (!d) return;
      total += tons * (d / (overlapDays(rs, re, rs, re) || 1));
    });
    return total;
  }

  // KPI 1: Acordado este mes
  const mesActStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const mesActEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  if (ui.kpiAcordada) ui.kpiAcordada.textContent = fmtN(tonsEnRango('acordado', mesActStart, mesActEnd)) + ' t';

  // KPI 2: Acordado próximo mes
  const proxStart = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  const proxEnd   = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);
  if (ui.kpiProxMes) ui.kpiProxMes.textContent = fmtN(tonsEnRango('acordado', proxStart, proxEnd)) + ' t';

  // KPI 3: En negociación (semi-acordado — sin límite de tiempo, es lo que está en conversación)
  let totalSemi = 0;
  (state.raw.oportunidades || []).forEach(o => {
    if (normalizeEstadoOportunidad(o) !== 'semi_acordado') return;
    totalSemi += Number(o.tonsAcordadas ?? o.biomasaEstimacion ?? 0);
  });
  if (ui.kpiNegociacion) ui.kpiNegociacion.textContent = fmtN(totalSemi) + ' t';

  // KPI 4: Alertas sanitarias
  let alertas = 0;
  if (sanitario) {
    if (Array.isArray(sanitario)) alertas = sanitario.length;
    else alertas = sanitario.alertas ?? sanitario.total ?? sanitario.count ?? 0;
  }
  if (ui.kpiAlertas) {
    ui.kpiAlertas.textContent = alertas;
    const card = document.getElementById('kpiCardAlertas');
    if (card) card.style.opacity = alertas === 0 ? '0.55' : '1';
  }
}

export function renderHorizonte() {
  const el = ui.dshHorizonte;
  if (!el) return;

  const now = new Date();
  const allowed = buildAllowedProviderKeys();

  // 3 meses: actual, +1, +2
  const meses = [0, 1, 2].map(offset => {
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1, 0, 0, 0, 0);
    const end   = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
    const label = start.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    const { totals } = computeBiomasaForRange(start, end, allowed);
    return { label, totals, isCurrent: offset === 0 };
  });

  el.innerHTML = meses.map(mes => {
    const t     = mes.totals;
    const acord = t.acordado    || 0;
    const semi  = t.semi_acordado || 0;
    const disp  = t.disponible  || 0;
    const total = acord + semi + disp;

    const pctA = total > 0 ? Math.round((acord / total) * 100) : 0;
    const pctS = total > 0 ? Math.round((semi  / total) * 100) : 0;
    const pctD = total > 0 ? Math.max(100 - pctA - pctS, 0)   : 0;

    return `<div class="dsh-hor-card${mes.isCurrent ? ' is-current' : ''}">
      <div class="dsh-hor-head">
        <span class="dsh-hor-month">${mes.label}</span>
        ${mes.isCurrent ? '<span class="dsh-hor-badge">Mes actual</span>' : ''}
      </div>
      <div class="dsh-hor-row">
        <span class="dsh-hor-lbl"><span class="dsh-hor-dot" style="background:#059669;"></span>Acordado</span>
        <span class="dsh-hor-val is-green">${fmtN(acord)} t</span>
      </div>
      <div class="dsh-hor-row">
        <span class="dsh-hor-lbl"><span class="dsh-hor-dot" style="background:#f59e0b;"></span>Semi-acordado</span>
        <span class="dsh-hor-val is-yellow">${fmtN(semi)} t</span>
      </div>
      <div class="dsh-hor-row">
        <span class="dsh-hor-lbl"><span class="dsh-hor-dot" style="background:#0d9488;"></span>Disponible</span>
        <span class="dsh-hor-val">${fmtN(disp)} t</span>
      </div>
      <div class="dsh-hor-progress">
        <div class="dsh-hor-seg" style="width:${pctA}%; background:#059669;"></div>
        <div class="dsh-hor-seg" style="width:${pctS}%; background:#f59e0b;"></div>
        <div class="dsh-hor-seg" style="width:${pctD}%; background:#0d9488; opacity:0.35;"></div>
      </div>
      <div class="dsh-hor-total">
        <span>Total declarado</span>
        <strong>${fmtN(total)} t</strong>
      </div>
    </div>`;
  }).join('');
}

function renderPipeline() {
  if (!ui.dshPipeline) return;

  const PIPE = [
    { key: 'disponible',  label: 'Disponible',   color: '#0d9488' },
    { key: 'semi_acordado', label: 'Semi-acord.', color: '#f59e0b' },
    { key: 'acordado',    label: 'Acordado',      color: '#059669' }
  ];

  const data = {};
  PIPE.forEach(p => { data[p.key] = { count: 0, tons: 0 }; });

  (state.raw.oportunidades || []).forEach(o => {
    const s = normalizeEstadoOportunidad(o);
    if (!data[s]) return;
    data[s].count++;
    data[s].tons += Number(o.tonsAcordadas ?? o.biomasaEstimacion ?? 0);
  });

  const maxTons = Math.max(...PIPE.map(p => data[p.key].tons), 1);
  const totalTratos = PIPE.reduce((acc, p) => acc + data[p.key].count, 0);

  if (ui.dshPipelineHint) ui.dshPipelineHint.textContent = `${totalTratos} tratos en seguimiento`;

  const rows = PIPE.map(p => {
    const d = data[p.key];
    const pct = Math.max(Math.round((d.tons / maxTons) * 100), d.tons > 0 ? 4 : 0);
    return `<div class="dsh-pipe-step">
      <span class="dsh-pipe-lbl">${p.label}</span>
      <div class="dsh-pipe-bar-wrap"><div class="dsh-pipe-bar" style="width:${pct}%; background:${p.color};"></div></div>
      <span class="dsh-pipe-val">${fmtN(d.tons)} t</span>
      <span class="dsh-pipe-sub">${d.count} trato${d.count !== 1 ? 's' : ''}</span>
    </div>`;
  }).join('');

  ui.dshPipeline.innerHTML = rows || '<p class="empty">Sin tratos registrados.</p>';
}

function renderTopProveedores() {
  if (!ui.dshTopProveedores) return;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const byProvider = new Map();
  (state.raw.disponibilidades || []).forEach(r => {
    const mk = monthKeyFrom(r);
    if (!mk) return;
    const m = monthRangeFromKey(mk);
    const d = overlapDays(m.start, m.end, monthStart, monthEnd);
    if (!d) return;
    const tons = Number(r.tons ?? r.tonsDisponible ?? 0) * (d / (overlapDays(m.start, m.end, m.start, m.end) || 30));
    if (!tons) return;
    const key = providerKeyOf(r);
    const label = r.proveedorNombre || r.proveedor || r.contactoNombre || 'Sin nombre';
    const prev = byProvider.get(key) || { label, tons: 0 };
    prev.tons += tons;
    byProvider.set(key, prev);
  });

  const top5 = Array.from(byProvider.values()).sort((a, b) => b.tons - a.tons).slice(0, 5);

  if (ui.dshTopHint) {
    ui.dshTopHint.textContent = now.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  }

  ui.dshTopProveedores.innerHTML = top5.length
    ? top5.map((p, i) => `<li class="dsh-top-item">
        <span class="dsh-top-rank">#${i + 1}</span>
        <span class="dsh-top-name">${esc(p.label)}</span>
        <span class="dsh-top-tons">${fmtN(p.tons)} t</span>
      </li>`).join('')
    : '<li class="empty">Sin disponibilidades este mes.</li>';
}

function renderPendientes() {
  if (!ui.dshPendientes) return;

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 30);

  // Última actividad por proveedor
  const lastActivity = new Map();
  const trackActivity = (items, dateKeys) => {
    (items || []).forEach(x => {
      const d = dateFrom(x, dateKeys);
      if (!d) return;
      const k = providerKeyOf(x);
      const prev = lastActivity.get(k);
      const label = x.proveedorNombre || x.proveedor || x.contactoNombre || '—';
      if (!prev || d > prev.date) lastActivity.set(k, { date: d, label });
    });
  };
  trackActivity(state.raw.visitas, ['fecha', 'createdAt']);
  trackActivity(state.raw.interacciones, ['fecha', 'createdAt']);
  trackActivity(state.raw.contactos, ['updatedAt', 'createdAt']);

  // Proveedores con trato activo
  const keysConTrato = new Set();
  (state.raw.oportunidades || []).forEach(o => {
    const s = normalizeEstadoOportunidad(o);
    if (s && s !== 'descartado' && s !== 'perdido') keysConTrato.add(providerKeyOf(o));
  });

  // Disponibilidades este mes sin trato
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const sinTrato = [];
  const dispKeys = new Map();
  (state.raw.disponibilidades || []).forEach(r => {
    const mk = monthKeyFrom(r);
    if (!mk) return;
    const m = monthRangeFromKey(mk);
    if (!overlapDays(m.start, m.end, monthStart, monthEnd)) return;
    const tons = Number(r.tons ?? r.tonsDisponible ?? 0);
    if (!tons) return;
    const key = providerKeyOf(r);
    const label = r.proveedorNombre || r.proveedor || r.contactoNombre || '—';
    const prev = dispKeys.get(key) || { label, tons: 0 };
    prev.tons += tons;
    dispKeys.set(key, prev);
  });
  dispKeys.forEach(({ label, tons }, key) => {
    if (!keysConTrato.has(key)) sinTrato.push({ label, tons });
  });
  sinTrato.sort((a, b) => b.tons - a.tons);

  // Proveedores inactivos
  const inactivos = [];
  (state.raw.contactos || []).slice(0, 60).forEach(c => {
    const key = providerKeyOf(c);
    const act = lastActivity.get(key);
    const nombre = c.proveedorNombre || c.contactoNombre || c.proveedor || '—';
    if (!act || act.date < cutoff) {
      const dias = act ? Math.round((now - act.date) / 86400000) : null;
      inactivos.push({ label: nombre, dias });
    }
  });

  const items = [
    ...sinTrato.slice(0, 3).map(p => ({
      icon: 'bi-exclamation-circle',
      danger: false,
      name: p.label,
      meta: `${fmtN(p.tons)} t disponibles · sin trato activo`
    })),
    ...inactivos.slice(0, 3).map(p => ({
      icon: 'bi-clock-history',
      danger: true,
      name: p.label,
      meta: p.dias ? `${p.dias} días sin actividad` : 'Sin actividad registrada'
    }))
  ];

  ui.dshPendientes.innerHTML = items.length
    ? items.map(it => `<li class="dsh-pending-item${it.danger ? ' is-danger' : ''}">
        <i class="bi ${it.icon} dsh-pending-icon"></i>
        <div class="dsh-pending-text">
          <div class="dsh-pending-name">${esc(it.name)}</div>
          <div class="dsh-pending-meta">${esc(it.meta)}</div>
        </div>
      </li>`).join('')
    : '<li class="empty">Sin pendientes urgentes. ✓</li>';
}
