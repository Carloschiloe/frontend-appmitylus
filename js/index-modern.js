const API_BASE = window.API_URL || '/api';

const ui = {
  nav: document.getElementById('sideNav'),
  activity: document.getElementById('dashboardActivity'),
  tasks: document.getElementById('dashboardTasks'),
  hint: document.getElementById('dashboardDateHint'),
  refresh: document.getElementById('btnRefreshDashboard'),
  fResp: document.getElementById('dashFiltroResp'),
  fComuna: document.getElementById('dashFiltroComuna'),
  fPeriodo: document.getElementById('dashFiltroPeriodo'),
  fTexto: document.getElementById('dashFiltroProveedor'),
  fClear: document.getElementById('dashClear'),
  goHistorial: document.getElementById('dashGoHistorial'),
  bioCardDisponible: document.getElementById('bioCardDisponible'),
  bioCardSemi: document.getElementById('bioCardSemi'),
  bioCardConfirmado: document.getElementById('bioCardConfirmado'),
  bioCardDescartado: document.getElementById('bioCardDescartado'),
  bioCardPerdido: document.getElementById('bioCardPerdido'),
  bioTableBody: document.getElementById('bioTableBody'),
  bioChart: document.getElementById('bioChart'),
  bioScaleWeek: document.getElementById('bioScaleWeek'),
  bioScaleMonth: document.getElementById('bioScaleMonth'),
  bioScaleYear: document.getElementById('bioScaleYear'),
  bioPrev: document.getElementById('bioPrev'),
  bioNext: document.getElementById('bioNext'),
  bioPeriodLabel: document.getElementById('bioPeriodLabel'),
  bioProvidersTitle: document.getElementById('bioProvidersTitle'),
  bioProvidersHint: document.getElementById('bioProvidersHint'),
  bioProvidersList: document.getElementById('bioProvidersList'),
  bioCardsWrap: document.querySelector('.bio-cards'),
  bioAnnualChart: document.getElementById('bioAnnualChart'),
  bioAnnualTitle: document.getElementById('bioAnnualTitle'),
  bioAnnualHint: document.getElementById('bioAnnualHint'),
  bioAnnualModeLine: document.getElementById('bioAnnualModeLine'),
  bioAnnualModeBar: document.getElementById('bioAnnualModeBar'),
  bioAnnualProvidersTitle: document.getElementById('bioAnnualProvidersTitle'),
  bioAnnualProvidersHint: document.getElementById('bioAnnualProvidersHint'),
  bioAnnualProvidersBody: document.getElementById('bioAnnualProvidersBody'),
  bioAnnualProvidersSearch: document.getElementById('bioAnnualProvidersSearch'),
  bioAnnualProviderClear: document.getElementById('bioAnnualProviderClear'),
  bioSection: document.getElementById('dashboard-biomasa')
};

const state = {
  raw: {
    contactos: [],
    visitas: [],
    interacciones: [],
    disponibilidades: [],
    semiCerrados: [],
    oportunidades: []
  },
  filters: {
    responsable: '',
    comuna: '',
    periodoDias: 30,
    texto: ''
  },
  bio: {
    scale: 'week',
    offset: 0,
    focusStatus: null,
    activeStatuses: new Set(),
    annualMode: 'line',
    annualFocusMonth: null,
    annualProvidersQuery: '',
    annualFocusProviderKey: ''
  },
  chart: null,
  chartAnnual: null,
  bioContrib: {},
  annualYear: null,
  annualRowsByMonth: [],
  annualVisibleProviders: []
};

const STATUS_ORDER = ['disponible', 'semiCerrado', 'confirmado', 'descartado', 'perdido'];
const STATUS_LABELS = {
  disponible: 'Disponible',
  semiCerrado: 'Semi-cerrado',
  confirmado: 'Confirmado compra',
  descartado: 'Descartado',
  perdido: 'Perdido'
};
state.bio.activeStatuses = new Set(STATUS_ORDER);

function fmtN(n) {
  return Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]
  ));
}

function toArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

async function fetchJson(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

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
  return n
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getResponsable(x) {
  return String(x?.responsablePG || x?.responsable || x?.contactoResponsable || '').trim();
}

function getComuna(x) {
  return String(x?.centroComuna || x?.comuna || '').trim();
}

function textBag(x) {
  return [
    x?.proveedorNombre,
    x?.contactoNombre,
    x?.contacto,
    x?.proveedor,
    x?.centroCodigo,
    x?.centroComuna,
    x?.comuna,
    x?.proximoPaso
  ].filter(Boolean).join(' ').toLowerCase();
}

function matchesGenericFilters(row) {
  const q = String(state.filters.texto || '').trim().toLowerCase();
  if (q && !textBag(row).includes(q)) return false;
  return true;
}

function contactMatches(c) {
  const f = state.filters;
  if (f.responsable && getResponsable(c) !== f.responsable) return false;
  if (f.comuna && getComuna(c) !== f.comuna) return false;
  if (!matchesGenericFilters(c)) return false;
  return true;
}

function buildAllowedProviderKeys() {
  const hasScopedFilters = Boolean(state.filters.responsable || state.filters.comuna || state.filters.texto);
  if (!hasScopedFilters) return null;
  const keys = new Set();
  (state.raw.contactos || []).forEach((c) => {
    if (!contactMatches(c)) return;
    const k = providerKeyOf(c);
    if (k) keys.add(k);
  });
  return keys;
}

function formatDate(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CL');
}

function formatDateTime(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('es-CL')} ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`;
}

function renderActivity(items) {
  if (!ui.activity) return;
  if (!items.length) {
    ui.activity.innerHTML = '<li class="empty">Sin actividad para estos filtros.</li>';
    return;
  }
  ui.activity.innerHTML = items.map((it) => `
    <li class="timeline-item">
      <div class="timeline-top">
        <span class="timeline-title">${esc(it.title)}</span>
        <span class="timeline-date">${esc(formatDateTime(it.at))}</span>
      </div>
      <div class="timeline-sub">${esc(it.subtitle)}</div>
    </li>
  `).join('');
}

function renderTasks(items) {
  if (!ui.tasks) return;
  if (!items.length) {
    ui.tasks.innerHTML = '<li class="empty">Sin compromisos en la ventana seleccionada.</li>';
    return;
  }
  ui.tasks.innerHTML = items.map((it) => `
    <li class="task-item">
      <div class="task-top">
        <span class="task-title">${esc(it.title)}</span>
        <span class="task-date">${esc(formatDate(it.at))}</span>
      </div>
      <div class="task-sub">${esc(it.subtitle)}</div>
    </li>
  `).join('');
}

function uniqueSorted(list) {
  return [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}

function populateGlobalFilters() {
  if (!ui.fResp || !ui.fComuna) return;
  const contactos = state.raw.contactos || [];
  const respons = uniqueSorted(contactos.map(getResponsable));
  const comunas = uniqueSorted(contactos.map(getComuna));
  const rSel = state.filters.responsable;
  const cSel = state.filters.comuna;

  ui.fResp.innerHTML = '<option value="">Todos los responsables</option>' +
    respons.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join('');
  ui.fComuna.innerHTML = '<option value="">Todas las comunas</option>' +
    comunas.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  ui.fResp.value = respons.includes(rSel) ? rSel : '';
  ui.fComuna.value = comunas.includes(cSel) ? cSel : '';
}

function updateHint() {
  if (!ui.hint) return;
  const now = new Date();
  const bits = [
    `Ventana actividad: ${state.filters.periodoDias} dias`,
    state.filters.responsable ? `Resp: ${state.filters.responsable}` : null,
    state.filters.comuna ? `Comuna: ${state.filters.comuna}` : null,
    state.filters.texto ? `Filtro: ${state.filters.texto}` : null
  ].filter(Boolean).join(' | ');
  ui.hint.textContent = `${bits} | Actualizado: ${now.toLocaleDateString('es-CL')} ${now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`;
}

function updateHistorialLink() {
  if (!ui.goHistorial) return;
  const p = new URLSearchParams();
  if (state.filters.responsable) p.set('responsable', state.filters.responsable);
  if (state.filters.comuna) p.set('comuna', state.filters.comuna);
  if (state.filters.texto) p.set('q', state.filters.texto);
  const qs = p.toString();
  ui.goHistorial.href = `/html/Abastecimiento/historial/index.html${qs ? `?${qs}` : ''}`;
}

function applyAndRenderActivityTasks() {
  const days = Number(state.filters.periodoDias || 30);
  const now = Date.now();
  const maxMs = days * 24 * 60 * 60 * 1000;

  const contactos = (state.raw.contactos || []).filter((c) => {
    const d = dateFrom(c, ['updatedAt', 'createdAt', 'fecha']);
    return d && (now - d.getTime()) <= maxMs && contactMatches(c);
  });
  const visitas = (state.raw.visitas || []).filter((v) => {
    const d = dateFrom(v, ['updatedAt', 'createdAt', 'fecha']);
    return d && (now - d.getTime()) <= maxMs && matchesGenericFilters(v);
  });
  const interacciones = (state.raw.interacciones || []).filter((i) => {
    const d = dateFrom(i, ['updatedAt', 'createdAt', 'fecha']);
    return d && (now - d.getTime()) <= maxMs && matchesGenericFilters(i);
  });

  const activity = [
    ...contactos.map((c) => ({
      title: 'Contacto registrado',
      subtitle: `${c.proveedorNombre || '-'} | ${c.contactoNombre || c.contacto || 'Sin contacto'}`,
      at: dateFrom(c, ['updatedAt', 'createdAt', 'fecha'])
    })),
    ...visitas.map((v) => ({
      title: 'Visita registrada',
      subtitle: `${v.proveedorNombre || '-'} | ${v.proximoPaso || 'Sin proximo paso'}`,
      at: dateFrom(v, ['updatedAt', 'createdAt', 'fecha'])
    })),
    ...interacciones.map((i) => ({
      title: `Interaccion ${(i.tipo || '').toUpperCase() || 'N/A'}`,
      subtitle: `${i.proveedorNombre || '-'} | ${i.contactoNombre || '-'}`,
      at: dateFrom(i, ['updatedAt', 'createdAt', 'fecha'])
    }))
  ].filter((x) => x.at).sort((a, b) => b.at - a.at).slice(0, 8);

  const to = new Date(Date.now() + maxMs);
  const upcoming = [
    ...(state.raw.visitas || []).map((v) => ({
      title: v.proximoPaso || 'Seguimiento visita',
      subtitle: `${v.proveedorNombre || '-'} | ${v.contacto || v.contactoNombre || '-'}`,
      at: dateFrom(v, ['proximoPasoFecha', 'fechaProximo'])
    })),
    ...(state.raw.interacciones || []).map((i) => ({
      title: i.proximoPaso || `Interaccion ${(i.tipo || '').toUpperCase()}`,
      subtitle: `${i.proveedorNombre || '-'} | ${i.contactoNombre || '-'}`,
      at: dateFrom(i, ['fechaProximo', 'proximoPasoFecha'])
    }))
  ].filter((x) => x.at && x.at >= new Date() && x.at <= to).sort((a, b) => a.at - b.at).slice(0, 10);

  renderActivity(activity);
  renderTasks(upcoming);
  updateHint();
}

function startOfWeekSunday(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function endOfWeekSaturday(start) {
  const e = new Date(start);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

function getRangeForBioSelection() {
  const now = new Date();
  const offset = Number(state.bio.offset || 0);
  if (state.bio.scale === 'week') {
    const s = startOfWeekSunday(now);
    s.setDate(s.getDate() + offset * 7);
    const e = endOfWeekSaturday(s);
    return { start: s, end: e, label: `Semana ${formatDate(s)} - ${formatDate(e)}` };
  }
  if (state.bio.scale === 'month') {
    const s = new Date(now.getFullYear(), now.getMonth() + offset, 1, 0, 0, 0, 0);
    const e = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
    const lbl = s.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    return { start: s, end: e, label: lbl.charAt(0).toUpperCase() + lbl.slice(1) };
  }
  const y = now.getFullYear() + offset;
  const s = new Date(y, 0, 1, 0, 0, 0, 0);
  const e = new Date(y, 11, 31, 23, 59, 59, 999);
  return { start: s, end: e, label: `Ano ${y}` };
}

function monthKeyFrom(x) {
  const mk = String(x?.mesKey || x?.periodo || '').trim();
  if (/^\d{4}-\d{2}$/.test(mk)) return mk;
  if (x?.anio && x?.mes) return `${String(x.anio)}-${String(x.mes).padStart(2, '0')}`;
  const d = dateFrom(x, ['fecha', 'createdAt', 'updatedAt']);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthRangeFromKey(mk) {
  const [y, m] = mk.split('-').map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return { start, end };
}

function overlapDays(aStart, aEnd, bStart, bEnd) {
  const s = Math.max(aStart.getTime(), bStart.getTime());
  const e = Math.min(aEnd.getTime(), bEnd.getTime());
  if (e < s) return 0;
  return Math.floor((e - s) / (24 * 60 * 60 * 1000)) + 1;
}

function normalizeEstadoOportunidad(o) {
  const e = String(o?.estado || '').toLowerCase();
  const r = String(o?.resultadoFinal || '').toLowerCase();
  if (['cerrado_exitoso', 'adquirido', 'comprado', 'cerrado'].includes(e) || r === 'vendido') return 'confirmado';
  if (e === 'descartado') return 'descartado';
  if (e === 'perdido' || r === 'no_vendido') return 'perdido';
  return '';
}

function emptyStatusTotals() {
  return { disponible: 0, semiCerrado: 0, confirmado: 0, descartado: 0, perdido: 0 };
}

function getActiveStatusKeys() {
  const active = state.bio.activeStatuses;
  if (!(active instanceof Set) || !active.size) return [...STATUS_ORDER];
  return STATUS_ORDER.filter((k) => active.has(k));
}

function filterTotalsByActiveStatuses(totals) {
  const activeSet = new Set(getActiveStatusKeys());
  return STATUS_ORDER.reduce((acc, k) => {
    acc[k] = activeSet.has(k) ? Number(totals[k] || 0) : 0;
    return acc;
  }, emptyStatusTotals());
}

function filterContribByActiveStatuses(contrib) {
  const activeSet = new Set(getActiveStatusKeys());
  return STATUS_ORDER.reduce((acc, k) => {
    acc[k] = activeSet.has(k) ? (contrib[k] || []) : [];
    return acc;
  }, {});
}

function providerLabel(row) {
  const p = String(row?.proveedorNombre || row?.proveedor || '').trim();
  const c = String(row?.contactoNombre || row?.contacto || '').trim();
  if (p && c) return `${p} | ${c}`;
  return p || c || 'Sin proveedor';
}

function addContribution(contrib, status, row, tons) {
  if (!tons) return;
  if (!contrib[status]) contrib[status] = new Map();
  const key = providerKeyOf(row) || providerLabel(row);
  const prev = contrib[status].get(key) || { label: providerLabel(row), tons: 0 };
  prev.tons += Number(tons || 0);
  contrib[status].set(key, prev);
}

function computeBiomasaForRange(start, end, allowed) {
  const totals = emptyStatusTotals();
  const contrib = {
    disponible: new Map(),
    semiCerrado: new Map(),
    confirmado: new Map(),
    descartado: new Map(),
    perdido: new Map()
  };
  const allowedRow = (row) => {
    const k = providerKeyOf(row);
    if (allowed && k && !allowed.has(k)) return false;
    if (state.filters.texto && !matchesGenericFilters(row)) return false;
    return true;
  };

  (state.raw.disponibilidades || []).forEach((r) => {
    if (!allowedRow(r)) return;
    const mk = monthKeyFrom(r);
    if (!mk) return;
    const m = monthRangeFromKey(mk);
    const d = overlapDays(m.start, m.end, start, end);
    if (!d) return;
    const daysInMonth = overlapDays(m.start, m.end, m.start, m.end) || 30;
    const tons = Number(r?.tons ?? r?.tonsDisponible ?? 0) || 0;
    const val = tons * (d / daysInMonth);
    totals.disponible += val;
    addContribution(contrib, 'disponible', r, val);
  });

  (state.raw.semiCerrados || []).forEach((r) => {
    if (!allowedRow(r)) return;
    const mk = monthKeyFrom(r);
    if (!mk) return;
    const m = monthRangeFromKey(mk);
    const d = overlapDays(m.start, m.end, start, end);
    if (!d) return;
    const daysInMonth = overlapDays(m.start, m.end, m.start, m.end) || 30;
    const tons = Number(r?.tons ?? 0) || 0;
    const val = tons * (d / daysInMonth);
    totals.semiCerrado += val;
    addContribution(contrib, 'semiCerrado', r, val);
  });

  (state.raw.oportunidades || []).forEach((o) => {
    if (!allowedRow(o)) return;
    const status = normalizeEstadoOportunidad(o);
    if (!status) return;
    const tons = Number(o?.biomasaEstimacion || 0) || 0;
    if (!tons) return;
    const d = dateFrom(o, ['fechaCierre', 'ultimaActividadAt', 'updatedAt', 'createdAt']);
    if (!d) return;
    if (d < start || d > end) return;
    totals[status] += tons;
    addContribution(contrib, status, o, tons);
  });

  const contribObj = Object.fromEntries(
    Object.entries(contrib).map(([k, m]) => [
      k,
      Array.from(m.entries())
        .map(([key, val]) => ({ ...val, key }))
        .sort((a, b) => b.tons - a.tons)
    ])
  );
  return { totals, contrib: contribObj };
}

function computeBiomasaForSelectedPeriod() {
  const selected = getRangeForBioSelection();
  const allowed = buildAllowedProviderKeys();
  const agg = computeBiomasaForRange(selected.start, selected.end, allowed);
  return { totals: agg.totals, label: selected.label, contrib: agg.contrib, range: selected, allowed };
}

function buildAnnualTotalsByMonth(year, allowed) {
  const months = [];
  for (let m = 0; m < 12; m += 1) {
    const start = new Date(year, m, 1, 0, 0, 0, 0);
    const end = new Date(year, m + 1, 0, 23, 59, 59, 999);
    const agg = computeBiomasaForRange(start, end, allowed);
    const filtered = filterTotalsByActiveStatuses(agg.totals);
    const total = STATUS_ORDER.reduce((acc, k) => acc + Number(filtered[k] || 0), 0);
    months.push(total);
  }
  return months;
}

function aggregateContribRows(contribByStatus) {
  const all = new Map();
  STATUS_ORDER.forEach((k) => {
    (contribByStatus[k] || []).forEach((r) => {
      const key = String(r.key || r.label || 'sin-proveedor');
      const prev = all.get(key) || { key, label: String(r.label || 'Sin proveedor'), tons: 0 };
      prev.tons += Number(r.tons || 0);
      all.set(key, prev);
    });
  });
  return Array.from(all.values()).sort((a, b) => b.tons - a.tons);
}

function buildAnnualProviderRowsByMonth(year, allowed) {
  const rowsByMonth = [];
  for (let m = 0; m < 12; m += 1) {
    const start = new Date(year, m, 1, 0, 0, 0, 0);
    const end = new Date(year, m + 1, 0, 23, 59, 59, 999);
    const agg = computeBiomasaForRange(start, end, allowed);
    const filteredContrib = filterContribByActiveStatuses(agg.contrib || {});
    rowsByMonth.push(aggregateContribRows(filteredContrib));
  }
  return rowsByMonth;
}

function monthLabelShort(idx) {
  return ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][idx] || '';
}

function providerTotalsAcrossMonths(rowsByMonth, providerLabelSelected) {
  return (rowsByMonth || []).map((rows) => {
    const hit = (rows || []).find((r) => String(r.key || '') === String(providerLabelSelected || ''));
    return Number(hit?.tons || 0);
  });
}

function resetBioInteractiveSelection() {
  state.bio.activeStatuses = new Set(STATUS_ORDER);
  state.bio.focusStatus = null;
  state.bio.annualFocusMonth = null;
  state.bio.annualFocusProviderKey = '';
  state.bio.annualProvidersQuery = '';
  if (ui.bioAnnualProvidersSearch) ui.bioAnnualProvidersSearch.value = '';
}

function renderBiomasaTableAndCards(totalsRaw, totalsFiltered, label) {
  if (ui.bioPeriodLabel) ui.bioPeriodLabel.textContent = label;
  if (ui.bioCardDisponible) ui.bioCardDisponible.textContent = fmtN(totalsRaw.disponible);
  if (ui.bioCardSemi) ui.bioCardSemi.textContent = fmtN(totalsRaw.semiCerrado);
  if (ui.bioCardConfirmado) ui.bioCardConfirmado.textContent = fmtN(totalsRaw.confirmado);
  if (ui.bioCardDescartado) ui.bioCardDescartado.textContent = fmtN(totalsRaw.descartado);
  if (ui.bioCardPerdido) ui.bioCardPerdido.textContent = fmtN(totalsRaw.perdido);

  if (!ui.bioTableBody) return;
  const activeSet = new Set(getActiveStatusKeys());
  const rows = STATUS_ORDER.map((k) => `
    <tr class="${activeSet.has(k) ? '' : 'is-muted'}">
      <td>${STATUS_LABELS[k]}</td>
      <td>${fmtN(totalsFiltered[k])}</td>
    </tr>
  `).join('');
  const total = STATUS_ORDER.reduce((a, k) => a + Number(totalsFiltered[k] || 0), 0);
  ui.bioTableBody.innerHTML = rows + `
    <tr>
      <td><strong>Total activo</strong></td>
      <td><strong>${fmtN(total)}</strong></td>
    </tr>
  `;
}

function renderProvidersByStatus(statusKey) {
  if (!ui.bioProvidersList || !ui.bioProvidersTitle) return;
  let rows = [];
  if (STATUS_ORDER.includes(statusKey)) {
    rows = (state.bioContrib[statusKey] || []).slice(0, 12);
    ui.bioProvidersTitle.textContent = `Proveedores involucrados (${STATUS_LABELS[statusKey]})`;
  } else {
    const all = new Map();
    STATUS_ORDER.forEach((k) => {
      (state.bioContrib[k] || []).forEach((r) => {
        const prev = all.get(r.label) || 0;
        all.set(r.label, prev + Number(r.tons || 0));
      });
    });
    rows = Array.from(all.entries())
      .map(([label, tons]) => ({ label, tons }))
      .sort((a, b) => b.tons - a.tons)
      .slice(0, 12);
    ui.bioProvidersTitle.textContent = 'Proveedores involucrados (Todos los estados)';
  }
  if (ui.bioProvidersHint) ui.bioProvidersHint.textContent = `Top ${rows.length}`;
  if (!rows.length) {
    ui.bioProvidersList.innerHTML = '<li class="empty">Sin proveedores para este estado en el periodo seleccionado.</li>';
    return;
  }
  ui.bioProvidersList.innerHTML = rows.map((r) => `
    <li class="bio-providers-item">
      <span class="bio-providers-name">${esc(r.label)}</span>
      <span class="bio-providers-tons">${fmtN(r.tons)} t</span>
    </li>
  `).join('');
}

function chartColorsForFocus() {
  const base = {
    disponible: '#0ea5e9',
    semiCerrado: '#14b8a6',
    confirmado: '#16a34a',
    descartado: '#f59e0b',
    perdido: '#ef4444'
  };
  if (!state.bio.focusStatus) return STATUS_ORDER.map((k) => base[k]);
  return STATUS_ORDER.map((k) => (k === state.bio.focusStatus ? base[k] : `${base[k]}66`));
}

function applyChartFocus() {
  if (!state.chart) return;
  state.chart.data.datasets[0].backgroundColor = chartColorsForFocus();
  state.chart.update('none');
}

function setBioFocus(status) {
  if (!STATUS_ORDER.includes(status)) return;
  state.bio.focusStatus = status;
  renderProvidersByStatus(status);
  applyChartFocus();
}

function clearBioFocus() {
  state.bio.focusStatus = null;
  renderProvidersByStatus(null);
  applyChartFocus();
}

function renderBiomasaChart(totals) {
  if (!ui.bioChart || typeof Chart === 'undefined') return;
  if (window.ChartDataLabels && !Chart.registry.plugins.get('datalabels')) {
    Chart.register(window.ChartDataLabels);
  }
  const labels = STATUS_ORDER.map((k) => STATUS_LABELS[k]);
  const values = STATUS_ORDER.map((k) => Number(totals[k] || 0));
  const colors = chartColorsForFocus();

  if (state.chart) state.chart.destroy();
  state.chart = new Chart(ui.bioChart, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Tons',
        data: values,
        backgroundColor: colors,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 120,
      animation: false,
      layout: {
        padding: {
          top: 22,
          right: 8
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: {
          anchor: 'end',
          align: 'end',
          offset: 2,
          clamp: true,
          clip: false,
          color: '#334155',
          font: { weight: '700', size: 11 },
          formatter: (v) => fmtN(v)
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grace: '12%'
        }
      },
      onClick: (_evt, activeEls) => {
        if (!activeEls?.length) {
          clearBioFocus();
          return;
        }
        const idx = activeEls[0].index;
        const status = STATUS_ORDER[idx];
        if (!status) return;
        if (state.bio.focusStatus === status) {
          clearBioFocus();
        } else {
          setBioFocus(status);
        }
      }
    }
  });
}

function renderBiomasaAnnualProvidersTable(year, rowsByMonth) {
  if (!ui.bioAnnualProvidersBody || !ui.bioAnnualProvidersTitle) return;
  if (!Number.isFinite(Number(year))) {
    ui.bioAnnualProvidersBody.innerHTML = '<tr><td colspan="2" class="empty">Cargando proveedores...</td></tr>';
    return;
  }
  const monthIdx = Number.isInteger(state.bio.annualFocusMonth) ? state.bio.annualFocusMonth : null;
  const q = String(state.bio.annualProvidersQuery || '').trim().toLowerCase();
  let rows = [];
  if (monthIdx !== null) {
    rows = (rowsByMonth[monthIdx] || []);
    ui.bioAnnualProvidersTitle.textContent = `Proveedores de ${monthLabelShort(monthIdx)} ${year}`;
  } else {
    const annualMap = new Map();
    (rowsByMonth || []).forEach((rowsM) => {
      rowsM.forEach((r) => {
        const key = String(r.key || r.label || 'sin-proveedor');
        const prev = annualMap.get(key) || { key, label: String(r.label || 'Sin proveedor'), tons: 0 };
        prev.tons += Number(r.tons || 0);
        annualMap.set(key, prev);
      });
    });
    rows = Array.from(annualMap.values()).sort((a, b) => b.tons - a.tons);
    ui.bioAnnualProvidersTitle.textContent = `Proveedores anuales ${year}`;
  }
  if (q) rows = rows.filter((r) => String(r.label || '').toLowerCase().includes(q));
  const selectedKey = String(state.bio.annualFocusProviderKey || '').trim();
  if (selectedKey) rows = rows.filter((r) => String(r.key || '') === selectedKey);
  rows = rows.slice(0, 20);
  state.annualVisibleProviders = rows;
  if (ui.bioAnnualProviderClear) ui.bioAnnualProviderClear.hidden = !state.bio.annualFocusProviderKey;
  if (ui.bioAnnualProvidersHint) {
    const selectedTxt = selectedKey ? ' | proveedor seleccionado' : '';
    ui.bioAnnualProvidersHint.textContent = q ? `Top ${rows.length} (filtrado${selectedTxt})` : `Top ${rows.length}${selectedTxt}`;
  }
  if (!rows.length) {
    ui.bioAnnualProvidersBody.innerHTML = '<tr><td colspan="2" class="empty">Sin proveedores para la seleccion actual.</td></tr>';
    return;
  }
  ui.bioAnnualProvidersBody.innerHTML = rows.map((r, idx) => `
    <tr class="${state.bio.annualFocusProviderKey === r.key ? 'is-selected' : ''}" data-provider-idx="${idx}">
      <td>${esc(r.label)}</td>
      <td>${fmtN(r.tons)}</td>
    </tr>
  `).join('');
}

function renderBiomasaAnnualChart(year, monthTotals, rowsByMonth) {
  if (!ui.bioAnnualChart || typeof Chart === 'undefined') return;
  if (window.ChartDataLabels && !Chart.registry.plugins.get('datalabels')) {
    Chart.register(window.ChartDataLabels);
  }
  const activeLabels = getActiveStatusKeys().map((k) => STATUS_LABELS[k]).join(', ') || 'Todos';
  if (ui.bioAnnualTitle) ui.bioAnnualTitle.textContent = `Evolucion mensual ${year}`;
  if (ui.bioAnnualHint) ui.bioAnnualHint.textContent = `Estados activos: ${activeLabels}`;
  const labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const isLine = state.bio.annualMode !== 'bar';
  const focus = Number.isInteger(state.bio.annualFocusMonth) ? state.bio.annualFocusMonth : null;
  const providerFocusKey = String(state.bio.annualFocusProviderKey || '').trim();
  const providerSeries = providerFocusKey ? providerTotalsAcrossMonths(rowsByMonth, providerFocusKey) : [];
  const providerFocusLabel = providerFocusKey
    ? ((rowsByMonth || []).flat().find((r) => r.key === providerFocusKey)?.label || providerFocusKey)
    : '';
  const chartDatasets = providerFocusKey ? [{
    label: `Proveedor: ${providerFocusLabel}`,
    data: providerSeries,
    borderColor: '#0f766e',
    backgroundColor: isLine
      ? 'rgba(15, 118, 110, 0.2)'
      : providerSeries.map((_v, i) => (focus === null || i === focus ? 'rgba(15, 118, 110, 0.85)' : 'rgba(15, 118, 110, 0.35)')),
    fill: isLine,
    tension: isLine ? 0.3 : 0,
    pointRadius: isLine ? providerSeries.map((_v, i) => (focus !== null && i === focus ? 6 : 4)) : 0,
    pointBackgroundColor: isLine ? providerSeries.map((_v, i) => (focus === null || i === focus ? '#0f766e' : '#94a3b8')) : undefined,
    pointHoverRadius: isLine ? 6 : 0,
    borderRadius: isLine ? 0 : 8,
    metaRole: 'focus'
  }] : [{
    label: `Tons ${year}`,
    data: monthTotals,
    borderColor: '#0f766e',
    backgroundColor: isLine
      ? 'rgba(15, 118, 110, 0.2)'
      : monthTotals.map((_v, i) => (focus === null || i === focus ? 'rgba(15, 118, 110, 0.78)' : 'rgba(15, 118, 110, 0.30)')),
    fill: isLine,
    tension: isLine ? 0.3 : 0,
    pointRadius: isLine ? monthTotals.map((_v, i) => (focus !== null && i === focus ? 6 : 4)) : 0,
    pointBackgroundColor: isLine ? monthTotals.map((_v, i) => (focus === null || i === focus ? '#0f766e' : '#94a3b8')) : undefined,
    pointHoverRadius: isLine ? 6 : 0,
    borderRadius: isLine ? 0 : 8,
    metaRole: 'focus'
  }];

  if (ui.bioAnnualHint) {
    ui.bioAnnualHint.textContent = providerFocusKey
      ? `Estados activos + proveedor: ${providerFocusLabel}`
      : `Estados activos: ${activeLabels}`;
  }

  if (state.chartAnnual) state.chartAnnual.destroy();
  state.chartAnnual = new Chart(ui.bioAnnualChart, {
    type: isLine ? 'line' : 'bar',
    data: {
      labels,
      datasets: chartDatasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 120,
      animation: false,
      layout: {
        padding: {
          top: 24,
          right: 10
        }
      },
      plugins: {
        legend: { display: false },
        datalabels: {
          align: 'top',
          anchor: 'end',
          offset: 3,
          clamp: true,
          clip: false,
          color: '#334155',
          font: { weight: '700', size: 10 },
          formatter: (v, ctx) => (ctx?.dataset?.metaRole === 'base' ? '' : fmtN(v))
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grace: '14%'
        }
      },
      onClick: (_evt, activeEls) => {
        if (!activeEls?.length) {
          state.bio.annualFocusMonth = null;
        } else {
          const idx = activeEls[0].index;
          if (!Number.isInteger(idx)) return;
          state.bio.annualFocusMonth = (state.bio.annualFocusMonth === idx) ? null : idx;
        }
        // Avoid destroying/recreating the same chart inside its own click cycle.
        window.setTimeout(() => renderBiomasaKpis(), 0);
      }
    }
  });
}

function applyStatusCardState() {
  if (!ui.bioCardsWrap) return;
  const activeSet = new Set(getActiveStatusKeys());
  ui.bioCardsWrap.querySelectorAll('.bio-status-card[data-status]').forEach((card) => {
    const key = card.getAttribute('data-status');
    const on = activeSet.has(key);
    card.classList.toggle('is-active', on);
    card.classList.toggle('is-muted', !on);
  });
}

function applyAnnualModeState() {
  ui.bioAnnualModeLine?.classList.toggle('is-active', state.bio.annualMode === 'line');
  ui.bioAnnualModeBar?.classList.toggle('is-active', state.bio.annualMode === 'bar');
}

function renderBiomasaKpis() {
  const { totals, label, contrib, range, allowed } = computeBiomasaForSelectedPeriod();
  const filteredTotals = filterTotalsByActiveStatuses(totals);
  const annualYear = range.start.getFullYear();
  const annualTotals = buildAnnualTotalsByMonth(annualYear, allowed);
  const annualRowsByMonth = buildAnnualProviderRowsByMonth(annualYear, allowed);
  state.annualYear = annualYear;
  state.annualRowsByMonth = annualRowsByMonth;
  if (state.bio.annualFocusProviderKey) {
    const exists = annualRowsByMonth.some((rows) => rows.some((r) => r.key === state.bio.annualFocusProviderKey));
    if (!exists) state.bio.annualFocusProviderKey = '';
  }

  if (state.bio.annualFocusMonth !== null && (state.bio.annualFocusMonth < 0 || state.bio.annualFocusMonth > 11)) {
    state.bio.annualFocusMonth = null;
  }

  state.bioContrib = filterContribByActiveStatuses(contrib || {});
  renderBiomasaTableAndCards(totals, filteredTotals, label);
  renderBiomasaChart(filteredTotals);
  renderBiomasaAnnualChart(annualYear, annualTotals, annualRowsByMonth);
  renderBiomasaAnnualProvidersTable(annualYear, annualRowsByMonth);
  if (state.bio.focusStatus && STATUS_ORDER.includes(state.bio.focusStatus)) {
    if (!getActiveStatusKeys().includes(state.bio.focusStatus)) {
      clearBioFocus();
      return;
    }
    setBioFocus(state.bio.focusStatus);
  } else {
    clearBioFocus();
  }
}

function setActiveScalePill() {
  [ui.bioScaleWeek, ui.bioScaleMonth, ui.bioScaleYear].forEach((el) => el?.classList.remove('is-active'));
  if (state.bio.scale === 'week') ui.bioScaleWeek?.classList.add('is-active');
  if (state.bio.scale === 'month') ui.bioScaleMonth?.classList.add('is-active');
  if (state.bio.scale === 'year') ui.bioScaleYear?.classList.add('is-active');
}

function setBioScale(scale) {
  state.bio.scale = scale;
  state.bio.offset = 0;
  setActiveScalePill();
  renderBiomasaKpis();
}

function refreshActiveNav() {
  if (!ui.nav) return;
  const href = window.location.href;
  ui.nav.querySelectorAll('.menu-group').forEach((g) => g.classList.remove('has-active-link'));
  ui.nav.querySelectorAll('.submenu a').forEach((a) => {
    a.classList.remove('is-active-link');
    const h = a.getAttribute('href') || '';
    if (!h) return;
    if (h.startsWith('#')) {
      if (window.location.hash === h || (h === '#dashboard-home' && !window.location.hash)) {
        a.classList.add('is-active-link');
        a.closest('.menu-group')?.classList.add('has-active-link', 'is-open');
      }
      return;
    }
    if (href.includes(h)) {
      a.classList.add('is-active-link');
      a.closest('.menu-group')?.classList.add('has-active-link', 'is-open');
    }
  });
}

function bindSidebar() {
  if (!ui.nav) return;
  ui.nav.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-toggle-group]');
    if (btn) {
      btn.closest('.menu-group')?.classList.toggle('is-open');
      return;
    }
    const link = e.target.closest('.submenu a[href^="#"]');
    if (link) setTimeout(refreshActiveNav, 20);
  });
}

function bindFilters() {
  ui.fResp?.addEventListener('change', () => {
    state.filters.responsable = ui.fResp.value || '';
    renderAll();
  });
  ui.fComuna?.addEventListener('change', () => {
    state.filters.comuna = ui.fComuna.value || '';
    renderAll();
  });
  ui.fPeriodo?.addEventListener('change', () => {
    state.filters.periodoDias = Number(ui.fPeriodo.value || 30);
    applyAndRenderActivityTasks();
  });
  ui.fTexto?.addEventListener('input', () => {
    state.filters.texto = (ui.fTexto.value || '').trim();
    renderAll();
  });
  ui.fClear?.addEventListener('click', () => {
    state.filters = { responsable: '', comuna: '', periodoDias: 30, texto: '' };
    resetBioInteractiveSelection();
    if (ui.fResp) ui.fResp.value = '';
    if (ui.fComuna) ui.fComuna.value = '';
    if (ui.fPeriodo) ui.fPeriodo.value = '30';
    if (ui.fTexto) ui.fTexto.value = '';
    renderAll();
  });
}

function bindBiomasaControls() {
  ui.bioScaleWeek?.addEventListener('click', () => setBioScale('week'));
  ui.bioScaleMonth?.addEventListener('click', () => setBioScale('month'));
  ui.bioScaleYear?.addEventListener('click', () => setBioScale('year'));
  ui.bioPrev?.addEventListener('click', () => {
    state.bio.offset -= 1;
    renderBiomasaKpis();
  });
  ui.bioNext?.addEventListener('click', () => {
    state.bio.offset += 1;
    renderBiomasaKpis();
  });
  ui.bioCardsWrap?.addEventListener('click', (e) => {
    const card = e.target.closest('.bio-status-card[data-status]');
    if (!card) return;
    const key = card.getAttribute('data-status');
    if (!STATUS_ORDER.includes(key)) return;

    const active = state.bio.activeStatuses;
    const allSelected = STATUS_ORDER.every((k) => active.has(k));
    if (allSelected) {
      state.bio.activeStatuses = new Set([key]);
    } else if (active.has(key)) {
      active.delete(key);
    } else {
      active.add(key);
    }
    state.bio.focusStatus = null;
    state.bio.annualFocusProviderKey = '';
    state.bio.annualFocusMonth = null;
    applyStatusCardState();
    renderBiomasaKpis();
  });
  ui.bioAnnualModeLine?.addEventListener('click', () => {
    state.bio.annualMode = 'line';
    applyAnnualModeState();
    renderBiomasaKpis();
  });
  ui.bioAnnualModeBar?.addEventListener('click', () => {
    state.bio.annualMode = 'bar';
    applyAnnualModeState();
    renderBiomasaKpis();
  });
  ui.bioAnnualProvidersSearch?.addEventListener('input', () => {
    state.bio.annualProvidersQuery = String(ui.bioAnnualProvidersSearch.value || '').trim();
    renderBiomasaAnnualProvidersTable(state.annualYear, state.annualRowsByMonth);
  });
  ui.bioAnnualProviderClear?.addEventListener('click', (e) => {
    e.stopPropagation();
    state.bio.annualFocusProviderKey = '';
    state.bio.annualFocusMonth = null;
    renderBiomasaKpis();
  });
  ui.bioAnnualProvidersBody?.addEventListener('click', (e) => {
    e.stopPropagation();
    const tr = e.target.closest('tr[data-provider-idx]');
    if (!tr) return;
    const idx = Number(tr.getAttribute('data-provider-idx'));
    const row = Number.isInteger(idx) ? state.annualVisibleProviders[idx] : null;
    const value = String(row?.key || '').trim();
    if (!value) return;
    state.bio.annualFocusProviderKey = (state.bio.annualFocusProviderKey === value) ? '' : value;
    state.bio.annualFocusMonth = null;
    renderBiomasaKpis();
  });
}

function renderAll() {
  applyAndRenderActivityTasks();
  applyStatusCardState();
  applyAnnualModeState();
  if (ui.bioAnnualProvidersSearch) ui.bioAnnualProvidersSearch.value = state.bio.annualProvidersQuery || '';
  renderBiomasaKpis();
  updateHistorialLink();
}

async function loadDashboardData() {
  if (ui.bioTableBody) ui.bioTableBody.innerHTML = '<tr><td colspan="2" class="empty">Cargando...</td></tr>';
  renderActivity([]);
  renderTasks([]);

  const y = new Date().getFullYear();
  const q = new URLSearchParams({ from: `${y - 1}-01`, to: `${y + 1}-12` });

  const [contactosR, visitasR, interaccionesR, disponibilidadesR, semiR, oportunidadesR] = await Promise.all([
    fetchJson('/contactos').catch(() => []),
    fetchJson('/visitas').catch(() => []),
    fetchJson('/interacciones').catch(() => []),
    fetchJson(`/disponibilidades?${q.toString()}`).catch(() => []),
    fetchJson(`/semi-cerrados?from=${y - 1}-01&to=${y + 1}-12`).catch(() => []),
    fetchJson('/oportunidades').catch(() => [])
  ]);

  state.raw.contactos = toArray(contactosR);
  state.raw.visitas = toArray(visitasR);
  state.raw.interacciones = toArray(interaccionesR);
  state.raw.disponibilidades = toArray(disponibilidadesR);
  state.raw.semiCerrados = toArray(semiR);
  state.raw.oportunidades = toArray(oportunidadesR);

  populateGlobalFilters();
  renderAll();
}

bindSidebar();
bindFilters();
bindBiomasaControls();
setActiveScalePill();
refreshActiveNav();
window.addEventListener('hashchange', refreshActiveNav);

document.addEventListener('click', (e) => {
  const insideBiomasa = Boolean(ui.bioSection && e.target instanceof Node && ui.bioSection.contains(e.target));
  if (!insideBiomasa) {
    const needsReset = (
      state.bio.focusStatus ||
      state.bio.annualFocusMonth !== null ||
      state.bio.annualFocusProviderKey ||
      state.bio.annualProvidersQuery ||
      !STATUS_ORDER.every((k) => state.bio.activeStatuses.has(k))
    );
    if (needsReset) {
      resetBioInteractiveSelection();
      applyStatusCardState();
      renderBiomasaKpis();
    }
  }
});

ui.refresh?.addEventListener('click', () => {
  loadDashboardData().catch((e) => {
    console.error('[dashboard] refresh error:', e);
    if (ui.activity) ui.activity.innerHTML = '<li class="empty">No se pudo cargar actividad.</li>';
    if (ui.tasks) ui.tasks.innerHTML = '<li class="empty">No se pudo cargar compromisos.</li>';
    if (ui.bioTableBody) ui.bioTableBody.innerHTML = '<tr><td colspan="2" class="empty">No se pudo cargar KPIs de biomasa.</td></tr>';
  });
});

loadDashboardData().catch((e) => {
  console.error('[dashboard] init error:', e);
  if (ui.activity) ui.activity.innerHTML = '<li class="empty">No se pudo cargar actividad.</li>';
  if (ui.tasks) ui.tasks.innerHTML = '<li class="empty">No se pudo cargar compromisos.</li>';
  if (ui.bioTableBody) ui.bioTableBody.innerHTML = '<tr><td colspan="2" class="empty">No se pudo cargar KPIs de biomasa.</td></tr>';
});
