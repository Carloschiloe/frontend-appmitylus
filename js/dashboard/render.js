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
  if (!ui.fResp || !ui.fComuna) return;
  const contactos = state.raw.contactos || [];
  const respons = [...new Set(contactos.map(getResponsable).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const comunas = [...new Set(contactos.map(getComuna).filter(Boolean))].sort((a,b)=>a.localeCompare(b));

  ui.fResp.innerHTML = '<option value="">Todos los responsables</option>' + respons.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('');
  ui.fComuna.innerHTML = '<option value="">Todas las comunas</option>' + comunas.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

export function renderActivity() {
  if (!ui.activity) return;
  const days = Number(state.filters.periodoDias || 30);
  const maxMs = days * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const activity = [
    ...(state.raw.contactos || []).map(c => ({ title: 'Contacto', subtitle: c.proveedorNombre, at: dateFrom(c, ['createdAt']) })),
    ...(state.raw.visitas || []).map(v => ({ title: 'Visita', subtitle: v.proximoPaso, at: dateFrom(v, ['createdAt']) }))
  ].filter(x => x.at && (now - x.at.getTime()) <= maxMs).sort((a,b)=>b.at - a.at).slice(0, 8);

  ui.activity.innerHTML = activity.length ? activity.map(it => `
    <li class="timeline-item">
      <div class="timeline-top"><span class="timeline-title">${esc(it.title)}</span><span class="timeline-date">${it.at.toLocaleDateString()}</span></div>
      <div class="timeline-sub">${esc(it.subtitle)}</div>
    </li>`).join('') : '<li class="empty">Sin actividad reciente.</li>';
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
  const colors = { disponible: '#0ea5e9', semi_acordado: '#f59e0b', acordado: '#16a34a', descartado: '#94a3b8', perdido: '#ef4444' };
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
  if (data && Array.isArray(data)) {
    state.raw = {
      contactos: toArray(data[0]),
      visitas: toArray(data[1]),
      interacciones: toArray(data[2]),
      disponibilidades: toArray(data[3]),
      oportunidades: toArray(data[4])
    };
  }
  renderActivity();
  renderBiomasaKpis();
}
