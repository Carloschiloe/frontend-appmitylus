import { escapeHtml, fetchJson as fetchJsonCommon } from '../contactos/ui-common.js';
import { slug } from '../../core/utilidades.js';

const API_BASE = window.API_URL || '/api';

const ui = {
  nav: document.getElementById('sideNav'),
  search: document.getElementById('histSearchProv'),
  provider: document.getElementById('histProviderSelect'),
  window: document.getElementById('histWindow'),
  refresh: document.getElementById('histRefresh'),
  meta: document.getElementById('histProviderMeta'),
  timeline: document.getElementById('histTimeline'),
  hint: document.getElementById('histHint'),
  kEventos: document.getElementById('hkEventos'),
  kVisitas: document.getElementById('hkVisitas'),
  kInteracciones: document.getElementById('hkInteracciones'),
  kOportunidades: document.getElementById('hkOportunidades')
};

const state = {
  raw: {
    contactos: [],
    visitas: [],
    interacciones: [],
    oportunidades: []
  },
  providers: [],
  selectedProviderKey: '',
  searchText: '',
  windowDays: 90,
  historialByProveedorId: new Map()
};

const esc = escapeHtml;

function fmtN(n) {
  return Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

function fmtDateTime(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('es-CL')} ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`;
}


function toArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

async function fetchJson(path) {
  return fetchJsonCommon(`${API_BASE}${path}`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
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

function buildProviders() {
  const map = new Map();
  const push = (item, src) => {
    const key = providerKeyOf(item);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: providerNameOf(item),
        proveedorId: '',
        fuentes: new Set(),
        total: 0
      });
    }
    const p = map.get(key);
    p.total += 1;
    p.fuentes.add(src);
    if (!p.proveedorId && item?.proveedorId) p.proveedorId = String(item.proveedorId);
    if (!p.name || p.name === 'Proveedor sin nombre') p.name = providerNameOf(item);
  };

  state.raw.contactos.forEach((x) => push(x, 'contactos'));
  state.raw.visitas.forEach((x) => push(x, 'visitas'));
  state.raw.interacciones.forEach((x) => push(x, 'interacciones'));
  state.raw.oportunidades.forEach((x) => push(x, 'oportunidades'));

  state.providers = Array.from(map.values())
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function filterProviders() {
  const q = state.searchText.trim().toLowerCase();
  if (!q) return state.providers;
  return state.providers.filter((p) => (`${p.name} ${p.key}`).toLowerCase().includes(q));
}

function renderProviderSelect() {
  const items = filterProviders();
  if (!ui.provider) return;

  ui.provider.innerHTML = '<option value="">Selecciona proveedor...</option>' +
    items.map((p) => `<option value="${esc(p.key)}">${esc(p.name)}</option>`).join('');

  if (items.some((x) => x.key === state.selectedProviderKey)) {
    ui.provider.value = state.selectedProviderKey;
  } else {
    state.selectedProviderKey = items[0]?.key || '';
    ui.provider.value = state.selectedProviderKey;
  }
}

function withinWindow(d) {
  if (!d) return false;
  if (!state.windowDays) return true;
  const limit = Date.now() - state.windowDays * 24 * 60 * 60 * 1000;
  return d.getTime() >= limit;
}

function makeEvent(type, date, title, subtitle, raw) {
  return { type, date, title, subtitle, raw };
}

function buildTimeline(providerKey) {
  if (!providerKey) return [];
  const contactos = state.raw.contactos
    .filter((x) => providerKeyOf(x) === providerKey)
    .map((x) => makeEvent(
      'contacto',
      dateOf(x, ['createdAt', 'fecha']),
      'Contacto registrado',
      `${x.contactoNombre || x.contacto || '-'} | Responsable: ${x.responsablePG || x.responsable || x.contactoResponsable || '-'}`,
      x
    ));

  const visitas = state.raw.visitas
    .filter((x) => providerKeyOf(x) === providerKey)
    .map((x) => makeEvent(
      'visita',
      dateOf(x, ['fecha', 'createdAt', 'updatedAt']),
      `Visita ${x.proximoPaso ? `- ${x.proximoPaso}` : ''}`.trim(),
      `${x.contacto || x.contactoNombre || '-'} | ${x.observaciones || 'Sin observaciones'}`,
      x
    ));

  const interacciones = state.raw.interacciones
    .filter((x) => providerKeyOf(x) === providerKey)
    .map((x) => makeEvent(
      'interaccion',
      dateOf(x, ['fecha', 'createdAt', 'updatedAt']),
      `Interaccion ${(x.tipo || '').toUpperCase() || 'N/A'}`,
      `${x.contactoNombre || '-'} | ${x.resumen || x.observaciones || 'Sin detalle'}`,
      x
    ));

  const oportunidades = state.raw.oportunidades
    .filter((x) => providerKeyOf(x) === providerKey)
    .flatMap((x) => {
      const out = [];
      const inicio = dateOf(x, ['fechaInicio', 'createdAt']);
      const cierre = dateOf(x, ['fechaCierre']);
      out.push(makeEvent(
        'oportunidad',
        inicio,
        `Oportunidad ${x.estado || '-'}`,
        `${x.proveedorNombre || '-'} | Biomasa vigente: ${x.biomasaVigente ? 'Si' : 'No'}`,
        x
      ));
      if (cierre) {
        out.push(makeEvent(
          'oportunidad',
          cierre,
          `Cierre oportunidad: ${x.resultadoFinal || x.estado || '-'}`,
          `${x.motivoPerdida || 'Sin motivo registrado'}`,
          x
        ));
      }
      return out;
    });

  const provider = state.providers.find((p) => p.key === providerKey);
  const hist = provider?.proveedorId ? state.historialByProveedorId.get(provider.proveedorId) : null;
  const eventos = toArray(hist?.items)
    .flatMap((it) => toArray(it?.eventos))
    .map((e) => makeEvent(
      'evento',
      dateOf(e, ['fecha', 'createdAt']),
      `Evento oportunidad: ${e.tipo || 'N/A'}`,
      `${e.detalle || 'Sin detalle'}${e.estadoNuevo ? ` | Estado nuevo: ${e.estadoNuevo}` : ''}`,
      e
    ));

  return [...contactos, ...visitas, ...interacciones, ...oportunidades, ...eventos]
    .filter((x) => x.date && withinWindow(x.date))
    .sort((a, b) => a.date - b.date);
}

function renderMeta(provider, timeline) {
  if (!ui.meta) return;
  if (!provider) {
    ui.meta.innerHTML = '<p class="empty">Selecciona un proveedor para ver su resumen.</p>';
    return;
  }

  const last = timeline[timeline.length - 1];
  const first = timeline[0];
  ui.meta.innerHTML = `
    <div class="hist-meta-line"><div class="hist-meta-k">Proveedor</div><div class="hist-meta-v">${esc(provider.name)}</div></div>
    <div class="hist-meta-line"><div class="hist-meta-k">Proveedor key</div><div class="hist-meta-v">${esc(provider.key)}</div></div>
    <div class="hist-meta-line"><div class="hist-meta-k">Fuentes detectadas</div><div class="hist-meta-v">${esc(Array.from(provider.fuentes).join(', '))}</div></div>
    <div class="hist-meta-line"><div class="hist-meta-k">Primer evento visible</div><div class="hist-meta-v">${esc(first ? fmtDateTime(first.date) : '-')}</div></div>
    <div class="hist-meta-line"><div class="hist-meta-k">Ultimo evento visible</div><div class="hist-meta-v">${esc(last ? fmtDateTime(last.date) : '-')}</div></div>
  `;
}

function renderKpis(timeline) {
  const count = (t) => timeline.filter((x) => x.type === t).length;
  if (ui.kEventos) ui.kEventos.textContent = fmtN(timeline.length);
  if (ui.kVisitas) ui.kVisitas.textContent = fmtN(count('visita'));
  if (ui.kInteracciones) ui.kInteracciones.textContent = fmtN(count('interaccion'));
  if (ui.kOportunidades) ui.kOportunidades.textContent = fmtN(count('oportunidad') + count('evento'));
}

function renderTimeline(timeline) {
  if (!ui.timeline) return;
  if (!timeline.length) {
    ui.timeline.innerHTML = '<li class="empty">Sin eventos en la ventana seleccionada.</li>';
    return;
  }
  ui.timeline.innerHTML = timeline.map((e) => `
    <li class="hist-item is-${esc(e.type)}">
      <div class="hist-item-top">
        <span class="hist-item-title">${esc(e.title)}</span>
        <span class="hist-item-date">${esc(fmtDateTime(e.date))}</span>
      </div>
      <div class="hist-item-sub">${esc(e.subtitle)}</div>
    </li>
  `).join('');
}

function refreshView() {
  const provider = state.providers.find((x) => x.key === state.selectedProviderKey);
  const timeline = buildTimeline(state.selectedProviderKey);
  renderMeta(provider, timeline);
  renderKpis(timeline);
  renderTimeline(timeline);
  if (ui.hint) {
    const label = state.windowDays ? `Ultimos ${state.windowDays} dias` : 'Todo el historial';
    ui.hint.textContent = `${label} | ${provider ? provider.name : 'Sin proveedor'}`;
  }
}

async function maybeLoadProviderHistorial() {
  const provider = state.providers.find((x) => x.key === state.selectedProviderKey);
  if (!provider?.proveedorId) return;
  if (state.historialByProveedorId.has(provider.proveedorId)) return;
  try {
    const data = await fetchJson(`/proveedores/${encodeURIComponent(provider.proveedorId)}/historial`);
    state.historialByProveedorId.set(provider.proveedorId, data || {});
  } catch (e) {
    console.warn('[historial] sin historial detallado por proveedor:', e);
  }
}

async function loadAll() {
  const [contactosR, visitasR, interaccionesR, oportunidadesR] = await Promise.all([
    fetchJson('/contactos').catch(() => []),
    fetchJson('/visitas').catch(() => []),
    fetchJson('/interacciones').catch(() => []),
    fetchJson('/oportunidades').catch(() => [])
  ]);

  state.raw.contactos = toArray(contactosR);
  state.raw.visitas = toArray(visitasR);
  state.raw.interacciones = toArray(interaccionesR);
  state.raw.oportunidades = toArray(oportunidadesR);

  buildProviders();
  renderProviderSelect();
  await maybeLoadProviderHistorial();
  refreshView();
}

function bindSidebar() {
  ui.nav?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-toggle-group]');
    if (!btn) return;
    const group = btn.closest('.menu-group');
    if (!group || !ui.nav) return;
    if (group.dataset.group === 'config') {
      group.classList.add('is-open');
      return;
    }
    const willOpen = !group.classList.contains('is-open');
    ui.nav.querySelectorAll('.menu-group.is-open').forEach((g) => {
      if (g !== group && g.dataset.group !== 'config') g.classList.remove('is-open');
    });
    group.classList.toggle('is-open', willOpen);
  });

  // Configuración siempre abierto para que "Maestros" no desaparezca.
  ui.nav?.querySelector('.menu-group[data-group="config"]')?.classList.add('is-open');
}

function bindEvents() {
  ui.search?.addEventListener('input', () => {
    state.searchText = ui.search.value || '';
    renderProviderSelect();
    maybeLoadProviderHistorial().then(refreshView);
  });

  ui.provider?.addEventListener('change', () => {
    state.selectedProviderKey = ui.provider.value || '';
    maybeLoadProviderHistorial().then(refreshView);
  });

  ui.window?.addEventListener('change', () => {
    state.windowDays = Number(ui.window.value || 0);
    refreshView();
  });

  ui.refresh?.addEventListener('click', () => {
    loadAll().catch((e) => {
      console.error('[historial] refresh error:', e);
      if (ui.timeline) ui.timeline.innerHTML = '<li class="empty">No se pudo cargar historial.</li>';
    });
  });
}

bindSidebar();
bindEvents();
loadAll().catch((e) => {
  console.error('[historial] init error:', e);
  if (ui.timeline) ui.timeline.innerHTML = '<li class="empty">No se pudo cargar historial.</li>';
});
