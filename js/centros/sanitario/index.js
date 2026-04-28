// js/centros/sanitario/index.js
import { Sidebar } from '../../components/Sidebar.js';
import { toast }   from '../../ui/toast.js';
import {
  getAreas, getResumen, getHistorial,
  syncMrSat, limpiarInvalidas,
} from './api.js';

new Sidebar();

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[char]));

const SANITARIO_LABELS = {
  ok: 'OK',
  alerta: 'Con alerta',
  bloqueada: 'Bloqueada',
  sin_datos: 'Sin datos',
};

const SANITARIO_TONE = {
  ok: 'verde',
  alerta: 'naranja',
  bloqueada: 'rojo',
  sin_datos: 'gris',
};

const AREA_LABELS = {
  abierta: 'Abierta',
  cerrada: 'Cerrada',
  inactiva: 'Inactiva',
  eliminada: 'Eliminada',
  sin_estado: 'Sin estado',
};

const ESTADO_SERNAPESCA_STYLES = {
  abierta: 'ok',
  cerrada: 'warn',
  inactiva: 'muted',
  eliminada: 'muted',
  sin_estado: 'muted',
};

let areasCache = [];
let expandedId = null;
let currentSearchTerm = '';
let currentKpiFilter = '';
let currentAreaFilter = '';
let latestSyncMrSat = null;

function normalizeAreaState(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || ['abierta', 'activo', 'activa', 'vigente'].includes(raw)) return 'abierta';
  if (['cerrada', 'suspendida', 'bloqueada'].includes(raw)) return 'cerrada';
  if (['inactiva', 'inactivo'].includes(raw)) return 'inactiva';
  if (['eliminada', 'eliminado'].includes(raw)) return 'eliminada';
  return 'sin_estado';
}

function getSanitaryState(area) {
  const registros = Array.isArray(area?.registrosRecientes) ? area.registrosRecientes : [];
  if (isBlockedArea(area)) return 'bloqueada';
  if (hasPositiveAlert(area)) return 'alerta';
  if (!registros.length || area?.estado === 'gris') return 'sin_datos';
  return 'ok';
}

function badge(estado) {
  const tone = SANITARIO_TONE[estado] || 'gris';
  return `<span class="san-badge ${tone}"><span class="san-dot ${tone}"></span>${SANITARIO_LABELS[estado] || estado}</span>`;
}

function badgeSernapesca(estado) {
  const stateKey = normalizeAreaState(estado);
  const tone = ESTADO_SERNAPESCA_STYLES[stateKey] || 'muted';
  return `<span class="san-serna-badge ${tone}">${esc(AREA_LABELS[stateKey] || stateKey)}</span>`;
}

function fmtFecha(val, short = false) {
  if (!val) return '-';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: short ? '2-digit' : 'numeric' });
}

function fmtFechaHora(val) {
  if (!val) return '-';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function tiempoRelativo(val) {
  if (!val) return '-';
  const diff = Date.now() - new Date(val).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'hace < 1 hora';
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d} dia${d !== 1 ? 's' : ''}`;
}

function renderBanner(areas) {
  const alertas = areas.filter((area) => ['alerta', 'bloqueada'].includes(getSanitaryState(area)));
  const banner = $('sanAlertBanner');
  if (!banner) return;
  if (!alertas.length) {
    banner.classList.add('hidden');
    return;
  }
  banner.classList.remove('hidden');
  $('sanBannerAreas').textContent = alertas.map((area) => `${area.areaPSMB} (${SANITARIO_LABELS[getSanitaryState(area)] || getSanitaryState(area)})`).join(' · ');
}

function hasPositiveAlert(area) {
  return Array.isArray(area?.registrosRecientes) && area.registrosRecientes.some((registro) => registro?.resultadoPositivo);
}

function isSuspendidaArea(area) {
  const estadoSernapesca = normalizeAreaState(area?.estadoSernapesca);
  return Boolean(area?.suspendidaSernapesca) || estadoSernapesca === 'cerrada' || area?.estado === 'rojo';
}

function isBlockedArea(area) {
  return isSuspendidaArea(area);
}

function computeKpis(areas) {
  const resumen = { ok: 0, alerta: 0, bloqueada: 0, sin_datos: 0 };
  areas.forEach((area) => {
    const state = getSanitaryState(area);
    resumen[state] = (resumen[state] || 0) + 1;
  });
  return {
    ...resumen,
  };
}

function renderKpis(areas, ultimaSync) {
  const resumen = computeKpis(areas);
  [
    ['ok', 'kpiOk'],
    ['alerta', 'kpiAlerta'],
    ['bloqueada', 'kpiBloqueada'],
  ].forEach(([estado, id]) => {
    const el = $(id);
    if (el) el.textContent = resumen[estado] ?? 0;
    const card = el?.closest('.san-kpi');
    if (card) {
      card.classList.toggle('is-active', currentKpiFilter === estado);
    }
  });

  const syncInfo = $('sanSyncInfo');
  if (syncInfo) {
    syncInfo.textContent = ultimaSync
      ? `Ultima sync mrSAT: ${tiempoRelativo(ultimaSync)}`
      : 'Sin sincronizacion aun';
  }

  const dot = $('sanGlobalDot');
  if (dot) {
    const peor = resumen.bloqueada > 0 ? 'rojo' : resumen.alerta > 0 ? 'naranja' : resumen.ok > 0 ? 'verde' : 'gris';
    dot.className = `san-dot ${peor}`;
    dot.style.width = '14px';
    dot.style.height = '14px';
  }

  syncAreaFilterButtons();
}

function buildSearchText(area) {
  const centros = Array.isArray(area.centros) ? area.centros : [];
  const registros = Array.isArray(area.registrosRecientes) ? area.registrosRecientes : [];
  return [
    area.areaPSMB,
    area.codigoArea,
    getSanitaryState(area),
    SANITARIO_LABELS[getSanitaryState(area)],
    normalizeAreaState(area.estadoSernapesca),
    AREA_LABELS[normalizeAreaState(area.estadoSernapesca)],
    area.restriccionSernapesca,
    area.notas,
    ...registros.flatMap((registro) => [registro.tipoAnalisis, registro.categoriaTipo, registro.recurso, registro.agenteCausal, registro.glosaResultado]),
    ...centros.flatMap((centro) => [centro.code, centro.proveedor, centro.comuna, centro.codigoArea]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function matchesKpiFilter(area, filter) {
  if (!filter) return true;
  return getSanitaryState(area) === filter;
}

function matchesAreaFilter(area, filter) {
  if (!filter) return true;
  return normalizeAreaState(area?.estadoSernapesca) === filter;
}

function filterAreas(areas, term, kpiFilter = '') {
  const query = String(term || '').trim().toLowerCase();
  return areas.filter((area) => {
    const searchMatch = !query || buildSearchText(area).includes(query);
    const kpiMatch = matchesKpiFilter(area, kpiFilter);
    const areaMatch = matchesAreaFilter(area, currentAreaFilter);
    return searchMatch && kpiMatch && areaMatch;
  });
}

function renderSearchMeta(filtered, total, term) {
  const meta = $('sanSearchMeta');
  if (!meta) return;
  const resumen = computeKpis(areasCache);
  const filtros = [];
  if (currentKpiFilter) filtros.push(SANITARIO_LABELS[currentKpiFilter]);
  if (currentAreaFilter) filtros.push(AREA_LABELS[currentAreaFilter]);
  if (resumen.sin_datos > 0) filtros.push(`${resumen.sin_datos} sin datos`);
  meta.textContent = term || currentKpiFilter || currentAreaFilter
    ? `${filtered} de ${total} areas${filtros.length ? ` · ${filtros.join(' · ')}` : ''}`
    : `${total} areas${resumen.sin_datos > 0 ? ` · ${resumen.sin_datos} sin datos` : ''}`;
}

function syncClearFilterButton() {
  const btn = $('sanClearFilter');
  if (!btn) return;
  const hasFilter = Boolean(currentKpiFilter || currentAreaFilter);
  btn.classList.toggle('is-hidden', !hasFilter);
  btn.disabled = !hasFilter;
}

function syncAreaFilterButtons() {
  document.querySelectorAll('#sanAreaFilters .san-state-chip').forEach((btn) => {
    btn.classList.toggle('is-active', (btn.dataset.areaFilter || '') === currentAreaFilter);
  });
}

function renderTiposPills(registros) {
  const tipos = [...new Set(registros.map((registro) => registro.tipoAnalisis).filter(Boolean))];
  if (!tipos.length) return '<span class="san-muted-inline">-</span>';
  return `<div class="san-tipos-wrap">${tipos.map((tipo) => `<span class="san-tipo-pill">${esc(tipo)}</span>`).join('')}</div>`;
}

function renderDetalleRegistros(registros) {
  if (!registros.length) {
    return '<p class="san-empty-copy">Sin registros de analisis disponibles.</p>';
  }

  const sorted = [...registros].sort((left, right) => {
    if (left.resultadoPositivo !== right.resultadoPositivo) return left.resultadoPositivo ? -1 : 1;
    const dl = left.fechaExtraccion ? new Date(left.fechaExtraccion).getTime() : 0;
    const dr = right.fechaExtraccion ? new Date(right.fechaExtraccion).getTime() : 0;
    return dr - dl;
  });

  const filas = sorted.map((registro) => {
    const valorStr = registro.valorNumerico
      ? `<span style="font-weight:700;font-size:13px;${registro.resultadoPositivo ? 'color:#dc2626;' : 'color:#0f172a;'}">${registro.valorNumerico}</span>${registro.unidad ? `<span style="font-size:10px;color:#64748b;margin-left:2px;">${registro.unidad}</span>` : ''}`
      : '-';

    return `
    <tr style="${registro.resultadoPositivo ? 'background:#fef2f2;' : ''}">
      <td style="font-weight:700;font-size:12px;white-space:nowrap;">${esc(registro.tipoAnalisis || '-')}</td>
      <td style="font-size:11px;color:#64748b;white-space:nowrap;">${esc(registro.categoriaTipo || '-')}</td>
      <td style="font-size:12px;">${esc(registro.recurso || '-')}</td>
      <td style="font-size:12px;white-space:nowrap;">${valorStr}</td>
      <td style="font-size:11px;max-width:200px;${registro.resultadoPositivo ? 'color:#dc2626;font-weight:600;' : 'color:#475569;'}">${esc(registro.glosaResultado || '-')}</td>
      <td style="font-size:11px;">${esc(registro.agenteCausal || '-')}</td>
      <td style="font-size:11px;white-space:nowrap;">${fmtFecha(registro.fechaExtraccion)}</td>
      <td style="font-size:11px;color:#64748b;">${esc(registro.laboratorio || '-')}</td>
    </tr>`;
  }).join('');

  return `
    <div class="san-inner-table-wrap">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#475569;white-space:nowrap;">Analisis</th>
            <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#475569;">Categoria</th>
            <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#475569;">Recurso</th>
            <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#475569;white-space:nowrap;">Valor</th>
            <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#475569;">Resultado</th>
            <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#475569;white-space:nowrap;">Agente causal</th>
            <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#475569;white-space:nowrap;">Fecha extr.</th>
            <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#475569;">Laboratorio</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

function renderCentroChips(centros) {
  if (!centros.length) return '<span class="san-centro-chip muted">Sin centros vinculados</span>';
  return centros.map((centro) => `
    <span class="san-centro-chip" title="${esc(centro.proveedor || centro.comuna || centro.code)}">
      <span class="san-centro-code">${esc(centro.code || '-')}</span>
      <span class="san-centro-meta">${esc(centro.proveedor || centro.comuna || 'Sin referencia')}</span>
    </span>`).join('');
}

function renderAreas(areas) {
  const body = $('sanAreasBody');
  if (!body) return;

  if (!areas.length) {
    body.innerHTML = '<tr><td colspan="9" class="muted">Sin areas registradas para esta busqueda.</td></tr>';
    return;
  }

  const fuenteLabel = (fuente) => (
    fuente === 'sernapesca' ? '<span style="color:#0ea5e9;font-size:11px;font-weight:600;">SERNAPESCA</span>' :
    fuente === 'mrsat' ? '<span style="color:#8b5cf6;font-size:11px;font-weight:600;">mrSAT</span>' :
    fuente === 'ambas' ? '<span style="color:#dc2626;font-size:11px;font-weight:600;">Ambas</span>' :
    '<span style="color:#94a3b8;font-size:11px;">-</span>'
  );

  body.innerHTML = areas.map((area) => {
    const id = area._id;
    const isExpanded = expandedId === id;
    const registros = Array.isArray(area.registrosRecientes) ? area.registrosRecientes : [];
    const centros = Array.isArray(area.centros)
      ? [...area.centros].sort((left, right) => String(left.code || '').localeCompare(String(right.code || ''), 'es'))
      : [];
    const positivos = registros.filter((registro) => registro.resultadoPositivo);
    const estadoSanitario = getSanitaryState(area);
    const fechas = registros
      .map((registro) => registro.fechaExtraccion)
      .filter(Boolean)
      .map((fecha) => new Date(fecha).getTime());
    const ultimaFecha = fechas.length ? new Date(Math.max(...fechas)) : null;

    const alertaCell = positivos.length > 0
      ? `<span class="san-alert-cell danger">${positivos.length} alerta${positivos.length !== 1 ? 's' : ''}</span>`
      : registros.length > 0
        ? '<span class="san-alert-cell ok">OK</span>'
        : '<span class="san-muted-inline">-</span>';

    return `
      <tr data-san-id="${id}" style="cursor:pointer;">
        <td style="white-space:nowrap;">${badge(estadoSanitario)}</td>
        <td style="font-weight:700;font-size:13px;white-space:nowrap;">${esc(area.codigoArea || '-')}</td>
        <td style="font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(area.areaPSMB)}">${esc(area.areaPSMB)}</td>
        <td style="white-space:nowrap;">${badgeSernapesca(area.estadoSernapesca)}</td>
        <td style="font-size:12px;color:#475569;white-space:nowrap;">${area.centrosCount || 0}</td>
        <td>${alertaCell}</td>
        <td style="overflow:hidden;">${renderTiposPills(registros)}</td>
        <td style="font-size:12px;color:#475569;white-space:nowrap;">${fmtFecha(ultimaFecha, true)}</td>
        <td>
          <button type="button" class="am-btn am-btn-flat san-btn-detalle" data-san-id="${id}" style="padding:3px 7px;font-size:11px;white-space:nowrap;width:100%;">
            ${isExpanded ? '▲ Cerrar' : '▼ Ver'}
          </button>
        </td>
      </tr>
      ${isExpanded ? `
      <tr>
        <td colspan="9" style="padding:0;">
          <div class="san-detail">
            <div class="san-detail-grid">
              <div class="san-detail-item"><label>Codigo area</label><span>${esc(area.codigoArea || '-')}</span></div>
              <div class="san-detail-item"><label>Estado sanitario</label><span>${esc(SANITARIO_LABELS[estadoSanitario] || estadoSanitario)}</span></div>
              <div class="san-detail-item"><label>Estado area</label><span>${esc(AREA_LABELS[normalizeAreaState(area.estadoSernapesca)] || 'Sin estado')}</span></div>
              <div class="san-detail-item"><label>Centros asociados</label><span>${area.centrosCount || 0}</span></div>
              <div class="san-detail-item"><label>Fuente datos</label><span>${fuenteLabel(area.fuenteEstado)}</span></div>
              <div class="san-detail-item"><label>Ultima sync mrSAT</label><span>${fmtFechaHora(area.ultimaSyncMrsat)}</span></div>
              <div class="san-detail-item"><label>Bloqueada</label><span>${isBlockedArea(area) ? 'Si' : 'No'}</span></div>
              ${area.restriccionSernapesca ? `<div class="san-detail-item"><label>Restriccion</label><span>${esc(area.restriccionSernapesca)}</span></div>` : ''}
              ${area.notas ? `<div class="san-detail-item" style="grid-column:span 3;"><label>Notas</label><span>${esc(area.notas)}</span></div>` : ''}
            </div>
            <div class="san-centros-list">
              <label>Centros vinculados</label>
              <div class="san-centros-chips">${renderCentroChips(centros)}</div>
            </div>
            ${renderDetalleRegistros(registros)}
            <div style="margin-top:8px;text-align:right;">
              <button type="button" class="am-btn am-btn-flat san-btn-hist" data-area="${area.areaPSMB}" style="font-size:12px;">
                <i class="bi bi-clock-history"></i> Ver historial completo
              </button>
            </div>
          </div>
        </td>
      </tr>` : ''}
    `;
  }).join('');
}

async function abrirHistorial(areaPSMB) {
  $('sanHistTitulo').textContent = `Historial - Area ${areaPSMB}`;
  $('sanHistBody').innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center;">Cargando...</div>';
  $('modalSanHistorial').style.display = 'flex';
  $('modalSanHistorial').style.alignItems = 'center';
  $('modalSanHistorial').style.justifyContent = 'center';
  $('modalSanHistorial').style.position = 'fixed';
  $('modalSanHistorial').style.inset = '0';
  $('modalSanHistorial').style.zIndex = '500';
  $('modalSanHistorial').style.background = 'rgba(15,23,42,.45)';

  try {
    const items = await getHistorial(areaPSMB, 30);
    if (!items.length) {
      $('sanHistBody').innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center;">Sin registros historicos.</div>';
      return;
    }

    $('sanHistBody').innerHTML = items.map((item) => `
      <div class="san-hist-item" style="${item.resultadoPositivo ? 'background:#fef2f2;' : ''}">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            ${item.resultadoPositivo
              ? '<span style="background:#dc2626;color:#fff;border-radius:5px;padding:1px 7px;font-size:11px;font-weight:700;">ALERTA</span>'
              : '<span style="background:#dcfce7;color:#16a34a;border-radius:5px;padding:1px 7px;font-size:11px;font-weight:700;">OK</span>'}
            <strong style="font-size:13px;">${esc(item.tipoAnalisis || '-')}</strong>
            ${item.recurso ? `<span style="color:#64748b;font-size:12px;">${esc(item.recurso)}</span>` : ''}
            ${item.agenteCausal ? `<span style="background:#fef2f2;color:#dc2626;border-radius:5px;padding:1px 7px;font-size:11px;font-weight:700;">${esc(item.agenteCausal)}</span>` : ''}
          </div>
          <span style="font-size:11px;font-weight:600;color:${item.fuente === 'sernapesca' ? '#0ea5e9' : '#8b5cf6'};white-space:nowrap;">${esc((item.fuente || '').toUpperCase())}</span>
        </div>
        <div style="margin-top:5px;font-size:12px;${item.resultadoPositivo ? 'color:#dc2626;font-weight:600;' : 'color:#475569;'}">${esc(item.glosaResultado || '-')}</div>
        <div class="san-hist-fecha" style="margin-top:4px;">
          Extraccion: ${fmtFecha(item.fechaExtraccion)}
          ${item.categoriaTipo ? ` · Categoria: ${esc(item.categoriaTipo)}` : ''}
          ${item.bancaNatural ? ` · Banca: ${esc(item.bancaNatural)}` : ''}
          ${item.laboratorio ? ` · Lab: ${esc(item.laboratorio)}` : ''}
        </div>
      </div>
    `).join('');
  } catch {
    $('sanHistBody').innerHTML = '<div style="padding:20px;color:#dc2626;">Error cargando historial.</div>';
  }
}

function applyFilters() {
  const filtered = filterAreas(areasCache, currentSearchTerm, currentKpiFilter);
  syncClearFilterButton();
  renderBanner(filtered);
  renderAreas(filtered);
  renderSearchMeta(filtered.length, areasCache.length, currentSearchTerm);
}

async function cargar() {
  try {
    const [areas, resumen] = await Promise.all([getAreas(), getResumen()]);
    areasCache = areas;
    latestSyncMrSat = resumen?.ultimaSync || null;
    renderKpis(areas, latestSyncMrSat);
    applyFilters();
  } catch (err) {
    console.error('[sanitario]', err);
    toast('Error cargando datos sanitarios.', { variant: 'error' });
  }
}

function initEventos() {
  $('btnSanSync')?.addEventListener('click', async () => {
    const btn = $('btnSanSync');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise" style="animation:spin 1s linear infinite;"></i> Sincronizando...';
    try {
      const result = await syncMrSat();
      if ((result.procesados ?? 0) === 0) {
        const detalle = result.mensaje
          ? result.mensaje
          : `Total scrapeado: ${result.total ?? 0}, Los Lagos: ${result.losLagos ?? 0}. Errores: ${JSON.stringify(result.errores ?? [])}`;
        toast(`mrSAT: 0 areas procesadas. ${detalle}`, { variant: 'error' });
      } else {
        toast(`mrSAT sincronizado: ${result.procesados} areas procesadas.`, { variant: 'success' });
      }
      await cargar();
    } catch (err) {
      toast(`Error al sincronizar mrSAT: ${err.message}`, { variant: 'error' });
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Actualizar mrSAT';
    }
  });

  $('sanSearchInput')?.addEventListener('input', (e) => {
    currentSearchTerm = String(e.target.value || '').trim();
    expandedId = null;
    applyFilters();
  });

  $('sanClearFilter')?.addEventListener('click', () => {
    currentKpiFilter = '';
    currentAreaFilter = '';
    expandedId = null;
    renderKpis(areasCache, latestSyncMrSat);
    applyFilters();
  });

  document.querySelectorAll('.san-kpi[data-filter]').forEach((card) => {
    card.addEventListener('click', () => {
      const nextFilter = card.dataset.filter || '';
      currentKpiFilter = currentKpiFilter === nextFilter ? '' : nextFilter;
      expandedId = null;
      renderKpis(areasCache, latestSyncMrSat);
      applyFilters();
    });
  });

  document.querySelectorAll('#sanAreaFilters .san-state-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const nextFilter = chip.dataset.areaFilter || '';
      currentAreaFilter = currentAreaFilter === nextFilter ? '' : nextFilter;
      expandedId = null;
      renderKpis(areasCache, latestSyncMrSat);
      applyFilters();
    });
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.san-btn-detalle');
    if (btn) {
      const id = btn.getAttribute('data-san-id');
      expandedId = expandedId === id ? null : id;
      applyFilters();
    }

    const histBtn = e.target.closest('.san-btn-hist');
    if (histBtn) abrirHistorial(histBtn.getAttribute('data-area'));

    if (e.target.closest('#btnSanHistClose') || e.target === $('modalSanHistorial')) {
      $('modalSanHistorial').style.display = 'none';
    }
  });
}

const style = document.createElement('style');
style.textContent = '@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }';
document.head.appendChild(style);

initEventos();
limpiarInvalidas().catch(() => {}).finally(() => cargar());
