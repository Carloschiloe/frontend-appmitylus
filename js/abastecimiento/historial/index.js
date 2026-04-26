import { escapeHtml, fetchJson as fetchJsonCommon } from '../contactos/ui-common.js';
import { slug } from '../../core/utilidades.js';

const API_BASE = window.API_URL || '/api';
const esc = escapeHtml;

// ─── Helpers ────────────────────────────────────────────────────────────────

function toArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

async function fetchJson(path) {
  return fetchJsonCommon(`${API_BASE}${path}`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
}

function providerKeyOf(x) {
  return String(x?.proveedorKey || '').trim() || slug(x?.proveedorNombre || x?.proveedor || '');
}
function providerNameOf(x) {
  return String(x?.proveedorNombre || x?.proveedor || 'Proveedor sin nombre').trim();
}
function dateOf(x, keys) {
  for (const k of keys) {
    const v = x?.[k];
    if (!v) continue;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function fmtDate(d) {
  if (!d) return '';
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function relativeDate(d) {
  if (!d) return '';
  const days = Math.round((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7)  return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem.`;
  if (days < 365) return `hace ${Math.floor(days / 30)} meses`;
  return `hace ${Math.floor(days / 365)} año(s)`;
}

function fmtN(n) {
  return Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

// ─── Estado ──────────────────────────────────────────────────────────────────

const state = {
  raw: { contactos: [], visitas: [], interacciones: [], oportunidades: [] },
  providers: [],
  searchText: '',
  activeFilter: 'todos',
  currentTimeline: [],
  historialByProveedorId: new Map(),
};

// ─── Construcción de proveedores ──────────────────────────────────────────────

function buildProviders() {
  const map = new Map();
  const push = (item, src) => {
    const key = providerKeyOf(item);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, { key, name: providerNameOf(item), proveedorId: '', fuentes: new Set(), total: 0, lastDate: null });
    }
    const p = map.get(key);
    p.total += 1;
    p.fuentes.add(src);
    if (!p.proveedorId && item?.proveedorId) p.proveedorId = String(item.proveedorId);
    if (!p.name || p.name === 'Proveedor sin nombre') p.name = providerNameOf(item);

    const d = dateOf(item, ['updatedAt', 'createdAt', 'fecha']);
    if (d && (!p.lastDate || d > p.lastDate)) p.lastDate = d;
  };

  state.raw.contactos.forEach((x)      => push(x, 'contactos'));
  state.raw.visitas.forEach((x)        => push(x, 'visitas'));
  state.raw.interacciones.forEach((x)  => push(x, 'interacciones'));
  state.raw.oportunidades.forEach((x)  => push(x, 'oportunidades'));

  state.providers = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

// ─── Alertas automáticas por proveedor ────────────────────────────────────────

function getAlerts(timeline) {
  const alerts = [];
  if (!timeline.length) return alerts;

  const lastEvent = timeline[timeline.length - 1];
  const daysSinceLast = Math.round((Date.now() - lastEvent.date.getTime()) / 86400000);

  const hasCompra  = timeline.some((e) => e.type === 'compra');
  const hasAcordado = timeline.some((e) => e.type === 'acordado');

  if (daysSinceLast >= 90) {
    alerts.push({ cls: 'alert-red',    icon: '🔴', text: `Sin actividad hace ${daysSinceLast} días` });
  } else if (daysSinceLast >= 30) {
    alerts.push({ cls: 'alert-yellow', icon: '🟡', text: `Última actividad hace ${daysSinceLast} días` });
  } else {
    alerts.push({ cls: 'alert-green',  icon: '🟢', text: `Activo — último evento hace ${daysSinceLast} días` });
  }

  if (hasAcordado && !hasCompra) {
    alerts.push({ cls: 'alert-yellow', icon: '⚠️', text: 'Trato acordado sin compra registrada' });
  }
  if (hasCompra) {
    alerts.push({ cls: 'alert-green',  icon: '✅', text: 'Compra efectuada registrada' });
  }

  return alerts;
}

// ─── Alerta rápida para tarjeta de proveedor ──────────────────────────────────

function getProviderBadge(prov) {
  if (!prov.lastDate) return { cls: 'badge-gray', icon: '○', text: 'Sin fechas' };
  const days = Math.round((Date.now() - prov.lastDate.getTime()) / 86400000);
  if (days >= 90) return { cls: 'badge-red',    icon: '●', text: `Inactivo ${days}d` };
  if (days >= 30) return { cls: 'badge-yellow', icon: '●', text: `${days}d sin act.` };
  return              { cls: 'badge-green',  icon: '●', text: `Activo` };
}

// ─── Construcción del timeline ────────────────────────────────────────────────

function makeEvent(type, date, title, subtitle, notes, responsible, raw) {
  return { type, date, title, subtitle, notes: notes || '', responsible: responsible || '', raw };
}

function buildTimeline(providerKey) {
  if (!providerKey) return [];

  const contactos = state.raw.contactos
    .filter((x) => providerKeyOf(x) === providerKey)
    .map((x) => makeEvent(
      'registro',
      dateOf(x, ['createdAt', 'fecha']),
      'Contacto registrado',
      `${x.contactoNombre || x.contacto || '—'}`,
      x.notas || x.observaciones || '',
      x.responsablePG || x.responsable || x.contactoResponsable || '',
      x
    ));

  const visitas = state.raw.visitas
    .filter((x) => providerKeyOf(x) === providerKey)
    .map((x) => makeEvent(
      'visita',
      dateOf(x, ['fecha', 'createdAt', 'updatedAt']),
      `Visita${x.proximoPaso ? ` — ${x.proximoPaso}` : ''}`.trim(),
      x.contacto || x.contactoNombre || '—',
      x.observaciones || '',
      x.responsable || x.responsablePG || '',
      x
    ));

  const interacciones = state.raw.interacciones
    .filter((x) => providerKeyOf(x) === providerKey)
    .map((x) => makeEvent(
      'interaccion',
      dateOf(x, ['fecha', 'createdAt', 'updatedAt']),
      `Interacción — ${(x.tipo || 'N/A').toUpperCase()}`,
      x.contactoNombre || x.contacto || '—',
      x.resumen || x.observaciones || '',
      x.responsable || '',
      x
    ));

  const oportunidades = state.raw.oportunidades
    .filter((x) => providerKeyOf(x) === providerKey)
    .flatMap((x) => {
      const out = [];
      const estado = (x.estado || '').toLowerCase();
      const inicio = dateOf(x, ['fechaInicio', 'createdAt']);
      const cierre = dateOf(x, ['fechaCierre']);

      let type = 'trato';
      if (estado === 'acordado') type = 'acordado';
      else if (estado === 'compra_efectuada') type = 'compra';
      else if (estado === 'perdido') type = 'perdido';

      if (inicio) {
        out.push(makeEvent(
          type,
          inicio,
          `Trato — ${x.estado || '—'}`,
          `Biomasa vigente: ${x.biomasaVigente ? 'Sí' : 'No'}${x.tonsEstimadas ? ` | ${x.tonsEstimadas} ton est.` : ''}`,
          x.notas || '',
          x.responsable || '',
          x
        ));
      }
      if (cierre && estado === 'compra_efectuada') {
        out.push(makeEvent(
          'compra',
          cierre,
          `Compra efectuada${x.tonsReales ? ` — ${x.tonsReales} ton` : ''}`,
          x.notasCierre || x.resultadoFinal || '—',
          x.notasCierre || '',
          x.responsable || '',
          x
        ));
      } else if (cierre && estado === 'perdido') {
        out.push(makeEvent(
          'perdido',
          cierre,
          'Trato perdido',
          x.motivoPerdida || 'Sin motivo registrado',
          '',
          x.responsable || '',
          x
        ));
      }
      return out;
    });

  const muestreos = state.raw.interacciones
    .filter((x) => providerKeyOf(x) === providerKey && (x.tipo || '').toLowerCase().includes('muestreo'))
    .map((x) => makeEvent(
      'muestreo',
      dateOf(x, ['fecha', 'createdAt']),
      'Muestreo',
      x.resumen || x.observaciones || '—',
      '',
      x.responsable || '',
      x
    ));

  // Eventos adicionales desde historial detallado
  const provider = state.providers.find((p) => p.key === providerKey);
  const hist = provider?.proveedorId ? state.historialByProveedorId.get(provider.proveedorId) : null;
  const extraEventos = toArray(hist?.items)
    .flatMap((it) => toArray(it?.eventos))
    .map((e) => makeEvent(
      'evento',
      dateOf(e, ['fecha', 'createdAt']),
      `Evento: ${e.tipo || 'N/A'}`,
      e.detalle || 'Sin detalle',
      e.estadoNuevo ? `Estado nuevo: ${e.estadoNuevo}` : '',
      '',
      e
    ));

  return [...contactos, ...visitas, ...interacciones, ...oportunidades, ...muestreos, ...extraEventos]
    .filter((x) => x.date)
    .sort((a, b) => a.date - b.date);
}

// ─── Render: pantalla de búsqueda ─────────────────────────────────────────────

function renderProviderGrid() {
  const grid = document.getElementById('histProvGrid');
  if (!grid) return;

  const q = state.searchText.trim().toLowerCase();
  const list = q
    ? state.providers.filter((p) => (`${p.name} ${p.key}`).toLowerCase().includes(q))
    : state.providers;

  if (!list.length) {
    grid.innerHTML = `<p class="hst-loading">${q ? 'Sin resultados para esa búsqueda.' : 'No hay proveedores registrados.'}</p>`;
    return;
  }

  grid.innerHTML = list.map((p) => {
    const badge = getProviderBadge(p);
    const fuentes = Array.from(p.fuentes).join(', ');
    return `
      <div class="hst-prov-card" data-key="${esc(p.key)}" role="button" tabindex="0" aria-label="Ver expediente de ${esc(p.name)}">
        <div class="hst-prov-name">${esc(p.name)}</div>
        <div class="hst-prov-meta">${fmtN(p.total)} registros · ${esc(fuentes)}</div>
        <span class="hst-prov-badge ${badge.cls}">${badge.icon} ${badge.text}</span>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.hst-prov-card').forEach((card) => {
    const handler = () => openExpediente(card.dataset.key);
    card.addEventListener('click', handler);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') handler(); });
  });
}

// ─── Render: expediente ───────────────────────────────────────────────────────

function renderExpediente(providerKey) {
  const provider = state.providers.find((p) => p.key === providerKey);
  if (!provider) return;

  const timeline = buildTimeline(providerKey);
  state.currentTimeline = timeline;

  // Header
  document.getElementById('expProvName').textContent = provider.name;
  document.getElementById('expProvSub').textContent =
    `${fmtN(timeline.length)} eventos · ${Array.from(provider.fuentes).join(', ')}`;

  // KPIs
  const count = (t) => timeline.filter((e) => e.type === t).length;
  document.getElementById('kpiTotal').textContent        = fmtN(timeline.length);
  document.getElementById('kpiVisitas').textContent      = fmtN(count('visita'));
  document.getElementById('kpiInteracciones').textContent = fmtN(count('interaccion'));
  document.getElementById('kpiTratos').textContent       = fmtN(count('trato') + count('acordado') + count('perdido'));
  document.getElementById('kpiCompras').textContent      = fmtN(count('compra'));

  // Alertas
  const alertsEl = document.getElementById('expAlerts');
  const alerts = getAlerts(timeline);
  alertsEl.innerHTML = alerts.map((a) =>
    `<span class="exp-alert-pill ${a.cls}">${a.icon} ${esc(a.text)}</span>`
  ).join('');

  // Timeline
  renderTimeline();
}

function typeClass(type) {
  const map = {
    registro: 'ev-registro',
    interaccion: 'ev-interaccion',
    visita: 'ev-visita',
    trato: 'ev-trato',
    acordado: 'ev-acordado',
    compra: 'ev-compra',
    perdido: 'ev-perdido',
    muestreo: 'ev-muestreo',
    evento: 'ev-evento',
  };
  return map[type] || 'ev-evento';
}

function renderTimeline() {
  const el = document.getElementById('expTimeline');
  if (!el) return;

  const filter = state.activeFilter;
  const timeline = state.currentTimeline;

  if (!timeline.length) {
    el.innerHTML = '<p class="exp-empty">Sin eventos registrados para este proveedor.</p>';
    return;
  }

  const GAP_DAYS = 60;
  let html = '';
  let prevDate = null;

  for (let i = 0; i < timeline.length; i++) {
    const ev = timeline[i];
    const tClass = typeClass(ev.type);

    // Brecha visible
    if (prevDate) {
      const gap = Math.round((ev.date.getTime() - prevDate.getTime()) / 86400000);
      if (gap >= GAP_DAYS) {
        html += `<div class="exp-gap">— ${gap} días sin actividad —</div>`;
      }
    }
    prevDate = ev.date;

    // Visibilidad por filtro
    const filterType = ev.type === 'acordado' ? 'trato' : (ev.type === 'perdido' ? 'trato' : ev.type);
    const hidden = filter !== 'todos' && filterType !== filter ? ' is-hidden' : '';

    html += `
      <div class="exp-event ${tClass}${hidden}" data-type="${esc(filterType)}">
        <div class="exp-event-dot"></div>
        <div class="exp-card">
          <div class="exp-card-top">
            <span class="exp-card-title">${esc(ev.title)}</span>
            <span class="exp-card-date">
              <abbr title="${esc(fmtDate(ev.date))}">${esc(relativeDate(ev.date))}</abbr>
            </span>
          </div>
          ${ev.subtitle ? `<div class="exp-card-sub">${esc(ev.subtitle)}</div>` : ''}
          ${ev.notes    ? `<div class="exp-card-notes">${esc(ev.notes)}</div>` : ''}
          ${ev.responsible ? `<div class="exp-card-resp"><i class="bi bi-person"></i> ${esc(ev.responsible)}</div>` : ''}
        </div>
      </div>
    `;
  }

  el.innerHTML = html;
}

// ─── Cambio de vista ──────────────────────────────────────────────────────────

function openExpediente(providerKey) {
  const viewSearch = document.getElementById('viewSearch');
  const viewExp    = document.getElementById('viewExpediente');
  if (!viewSearch || !viewExp) return;

  viewSearch.style.display = 'none';
  viewExp.classList.add('is-visible');

  state.activeFilter = 'todos';
  document.querySelectorAll('.exp-chip').forEach((c) => c.classList.toggle('active', c.dataset.filter === 'todos'));

  renderExpediente(providerKey);

  maybeLoadProviderHistorial(providerKey).then(() => {
    if (state.currentTimeline.length === 0 || document.getElementById('expTimeline')?.children.length <= 1) {
      renderExpediente(providerKey);
    }
  });
}

function closeExpediente() {
  document.getElementById('viewSearch').style.display = '';
  document.getElementById('viewExpediente').classList.remove('is-visible');
}

// ─── Historial detallado por proveedor ────────────────────────────────────────

async function maybeLoadProviderHistorial(providerKey) {
  const provider = state.providers.find((p) => p.key === providerKey);
  if (!provider?.proveedorId) return;
  if (state.historialByProveedorId.has(provider.proveedorId)) return;
  try {
    const data = await fetchJson(`/proveedores/${encodeURIComponent(provider.proveedorId)}/historial`);
    state.historialByProveedorId.set(provider.proveedorId, data || {});
  } catch {
    // historial detallado opcional
  }
}

// ─── Carga inicial ────────────────────────────────────────────────────────────

async function loadAll() {
  const [contactosR, visitasR, interaccionesR, oportunidadesR] = await Promise.all([
    fetchJson('/contactos').catch(() => []),
    fetchJson('/visitas').catch(() => []),
    fetchJson('/interacciones').catch(() => []),
    fetchJson('/oportunidades').catch(() => []),
  ]);

  state.raw.contactos     = toArray(contactosR);
  state.raw.visitas       = toArray(visitasR);
  state.raw.interacciones = toArray(interaccionesR);
  state.raw.oportunidades = toArray(oportunidadesR);

  buildProviders();
  renderProviderGrid();
}

// ─── Eventos de UI ────────────────────────────────────────────────────────────

document.getElementById('histSearch')?.addEventListener('input', (e) => {
  state.searchText = e.target.value || '';
  renderProviderGrid();
});

document.getElementById('btnBack')?.addEventListener('click', closeExpediente);

document.getElementById('btnExport')?.addEventListener('click', () => window.print());

document.querySelectorAll('.exp-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    state.activeFilter = chip.dataset.filter;
    document.querySelectorAll('.exp-chip').forEach((c) => c.classList.toggle('active', c === chip));
    renderTimeline();
  });
});

// ─── Arranque ─────────────────────────────────────────────────────────────────

loadAll().catch((e) => {
  console.error('[historial] init error:', e);
  const grid = document.getElementById('histProvGrid');
  if (grid) grid.innerHTML = '<p class="hst-loading">Error al cargar datos. Recarga la página.</p>';
});
