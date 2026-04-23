// /js/abastecimiento/contactos/interacciones/activity-table.js
// Tabla unificada Visitas + Interacciones (llamadas, reuniones, tareas, etc.)

import { getAll as getAllVisitas } from '../../visitas/api.js';
import { list as listInteracciones, API_BASE } from './api.js';
import { openInteraccionModal } from './modal.js';
import { state } from '../state.js';
import { createLocalTableController } from '../local-table.js';
import { escapeHtml, debounce } from '../ui-common.js';

const esc = escapeHtml;
const PAGE_SIZE = 15;

const TIPO_MAP = {
  visita:   { label: 'Visita',      icon: 'bi-geo-alt-fill',         color: '#0ea5e9' },
  llamada:  { label: 'Llamada',     icon: 'bi-telephone-fill',       color: '#8b5cf6' },
  reunion:  { label: 'Reunión',     icon: 'bi-people-fill',          color: '#f59e0b' },
  tarea:    { label: 'Compromiso',  icon: 'bi-check-square-fill',    color: '#10b981' },
  muestra:  { label: 'Muestra',     icon: 'bi-eyedropper-fill',      color: '#ef4444' },
  otro:     { label: 'Otro',        icon: 'bi-three-dots',           color: '#94a3b8' },
};

function cfg(tipo) {
  const k = norm(tipo || '');
  return TIPO_MAP[k] || TIPO_MAP.otro;
}

function norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function fmtDate(v) {
  if (!v) return '-';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTons(n) {
  const v = Number(n) || 0;
  return v > 0 ? v.toLocaleString('es-CL', { maximumFractionDigits: 2 }) : '-';
}

function estadoBucket(estado) {
  const e = norm(estado);
  if (e === 'hecho' || e === 'cumplido' || e === 'completado' || e === 'cerrado' || e === 'finalizado' || e === 'sin accion') return 'cumplido';
  if (e === 'cancelado') return 'cancelado';
  return 'pendiente';
}

function isVencido(row) {
  if (!row.fechaProximo) return false;
  const d = new Date(row.fechaProximo);
  return !Number.isNaN(d.getTime()) && d < new Date();
}

// ── Normalización ──────────────────────────────────────────────────────────────

function fromVisita(v, contactos) {
  const id = v?.contactoId ? String(v.contactoId) : null;
  const c = id ? (contactos || []).find(x => String(x._id) === id) : null;
  return {
    _id: String(v._id || v.id || ''),
    _source: 'visita',
    fecha: v.fecha,
    tipo: 'visita',
    proveedorNombre: v.proveedorNombre || c?.proveedorNombre || '',
    contactoNombre: c?.contactoNombre || c?.contacto || v.contacto || '',
    centroCodigo: v.centroCodigo || '',
    tons: Number(v.tonsComprometidas ?? 0),
    proximoPaso: String(v.estado || '').replace('Tomar/entregar muestras', 'Tomar muestras'),
    fechaProximo: v.proximoPasoFecha || '',
    responsable: v.responsablePG || '',
    estado: v.estado || '',
    observaciones: v.observaciones || '',
    hasMuestreo: !!v.hasMuestreo || (Number(v.muestreoCount) || 0) > 0,
    fotoCount: Array.isArray(v.fotos) ? v.fotos.length : 0,
    _raw: v,
  };
}

function fromInteraccion(r) {
  return {
    _id: String(r._id || r.id || ''),
    _source: 'interaccion',
    fecha: r.fecha,
    tipo: String(r.tipo || 'otro').toLowerCase(),
    proveedorNombre: r.proveedorNombre || '',
    contactoNombre: r.contactoNombre || '',
    centroCodigo: r.centroCodigo || '',
    tons: Number(r.tonsAcordadas ?? 0),
    proximoPaso: r.proximoPaso || '',
    fechaProximo: r.fechaProximo || '',
    responsable: r.responsablePG || '',
    estado: r.estado || '',
    observaciones: r.resumen || r.observaciones || '',
    hasMuestreo: false,
    _raw: r,
  };
}

// ── Módulo principal ───────────────────────────────────────────────────────────

export async function mountActivityTable(root) {
  root.innerHTML = `
    <div class="act-wrap">

      <!-- Navegación de periodo + botón nueva actividad -->
      <div class="act-period-nav" id="act-period-nav">
        <div class="act-period-left">
          <div class="act-period-modes" role="group" aria-label="Modo de periodo">
            <button class="act-period-mode is-active" data-period="all">Todo</button>
            <button class="act-period-mode" data-period="week">Semana</button>
            <button class="act-period-mode" data-period="month">Mes</button>
          </div>
          <div class="act-period-ctrl" id="act-period-ctrl" hidden>
            <button class="act-period-arrow" id="act-period-prev" title="Periodo anterior" aria-label="Periodo anterior">
              <i class="bi bi-chevron-left"></i>
            </button>
            <span class="act-period-label" id="act-period-label"></span>
            <button class="act-period-arrow" id="act-period-next" title="Periodo siguiente" aria-label="Periodo siguiente">
              <i class="bi bi-chevron-right"></i>
            </button>
            <button class="act-period-today" id="act-period-today">Hoy</button>
          </div>
        </div>
        <div class="act-new-dropdown" id="actNewDropdown">
          <button class="am-btn am-btn-primary act-new-trigger" id="actNewTrigger" type="button" aria-haspopup="true" aria-expanded="false">
            <i class="bi bi-plus-lg"></i> Nueva actividad
            <i class="bi bi-chevron-down act-new-caret"></i>
          </button>
          <div class="act-new-menu" id="actNewMenu" role="menu">
            <button class="act-new-item" id="qaNuevaLlamada" type="button" role="menuitem">
              <span class="act-new-icon" style="background:#ede9fe;color:#7c3aed"><i class="bi bi-telephone-fill"></i></span>
              <span class="act-new-label">Llamada</span>
            </button>
            <button class="act-new-item" id="qaNuevaReunion" type="button" role="menuitem">
              <span class="act-new-icon" style="background:#fef3c7;color:#d97706"><i class="bi bi-people-fill"></i></span>
              <span class="act-new-label">Reunión</span>
            </button>
            <button class="act-new-item" id="qaNuevoCompromiso" type="button" role="menuitem">
              <span class="act-new-icon" style="background:#d1fae5;color:#059669"><i class="bi bi-check-square-fill"></i></span>
              <span class="act-new-label">Compromiso</span>
            </button>
            <div class="act-new-divider"></div>
            <button class="act-new-item" id="qaNuevaVisita" type="button" role="menuitem">
              <span class="act-new-icon" style="background:#e0f2fe;color:#0284c7"><i class="bi bi-geo-alt-fill"></i></span>
              <span class="act-new-label">Visita terreno</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Barra de filtros -->
      <div class="act-filters-bar">
        <div class="act-filters-left">
          <select id="act-f-tipo" class="browser-default act-select" aria-label="Tipo de actividad">
            <option value="">Todos los tipos</option>
            <option value="visita">Visitas</option>
            <option value="llamada">Llamadas</option>
            <option value="reunion">Reuniones</option>
            <option value="tarea">Compromisos</option>
            <option value="muestra">Muestras</option>
          </select>
          <select id="act-f-estado" class="browser-default act-select" aria-label="Estado">
            <option value="">Todo estado</option>
            <option value="pendiente">Pendiente</option>
            <option value="cumplido">Cumplido</option>
            <option value="vencido">Vencido</option>
          </select>
          <input id="act-f-q" type="text" class="mmpp-input act-input-q" placeholder="Buscar proveedor, contacto, paso…">
          <button id="act-f-clear" class="dash-btn act-btn-clear" type="button">Limpiar</button>
          <div class="act-export-group">
            <button class="act-export-btn" data-act-export="csv" title="Exportar CSV">CSV</button>
            <button class="act-export-btn" data-act-export="xls" title="Exportar Excel">XLS</button>
            <button class="act-export-btn" data-act-export="pdf" title="Exportar PDF">PDF</button>
          </div>
        </div>
        <div class="act-filters-right">
          <select id="act-f-resp" class="browser-default act-select" aria-label="Responsable">
            <option value="">Todos los responsables</option>
          </select>
        </div>
      </div>

      <!-- Tabla -->
      <div class="mmpp-table-wrap">
        <table id="act-table" class="mmpp table-full">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Proveedor / Contacto</th>
              <th>Centro</th>
              <th>Próximo paso</th>
              <th>Fecha prox.</th>
              <th style="text-align:right">Tons</th>
              <th></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

    </div>
  `;

  const card    = root.querySelector('.act-wrap');
  const fQ      = root.querySelector('#act-f-q');
  const fResp   = root.querySelector('#act-f-resp');
  const fEstado = root.querySelector('#act-f-estado');
  const fTipo   = root.querySelector('#act-f-tipo');
  const btnClear = root.querySelector('#act-f-clear');

  let allRows      = [];
  let loading      = false;
  let periodMode   = 'all';   // 'all' | 'week' | 'month'
  let periodOffset = 0;       // 0 = periodo actual, -1 anterior, +1 siguiente

  const tableCtrl = createLocalTableController({
    section: card,
    table: root.querySelector('#act-table'),
    pageSize: PAGE_SIZE,
    emptyColspan: 8,
    emptyText: 'Sin actividad registrada.',
    fileName: 'Actividad_MMPP',
    exportHeaders: ['Fecha', 'Tipo', 'Proveedor', 'Contacto', 'Centro', 'Próx. paso', 'Fecha prox.', 'Tons', 'Responsable'],
  });

  // ── Exportación inline (la fila local-table-top se oculta vía CSS) ───────────

  const EXPORT_HEADERS = ['Fecha', 'Tipo', 'Proveedor', 'Contacto', 'Centro', 'Próx. paso', 'Fecha prox.', 'Tons', 'Responsable'];

  function dlBlob(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  function delimited(rows, sep) {
    return rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(sep)).join('\n');
  }

  root.querySelector('[data-act-export="csv"]')?.addEventListener('click', () => {
    const rows = (tableCtrl?.getAllRows() || []).map(r => r.export || []);
    dlBlob('Actividad_MMPP.csv', '\ufeff' + delimited([EXPORT_HEADERS, ...rows], ';'), 'text/csv;charset=utf-8;');
  });
  root.querySelector('[data-act-export="xls"]')?.addEventListener('click', () => {
    const rows = (tableCtrl?.getAllRows() || []).map(r => r.export || []);
    dlBlob('Actividad_MMPP.xls', '\ufeff' + delimited([EXPORT_HEADERS, ...rows], '\t'), 'application/vnd.ms-excel;charset=utf-8;');
  });
  root.querySelector('[data-act-export="pdf"]')?.addEventListener('click', () => {
    const rows = (tableCtrl?.getAllRows() || []).map(r => r.export || []);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><meta charset="utf-8"><title>Actividad MMPP</title>
      <style>body{font-family:Arial,sans-serif;padding:16px}table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #cbd5e1;padding:5px 8px;font-size:12px}th{background:#f1f5f9}</style></head>
      <body><h3>Actividad MMPP</h3><table><thead><tr>${EXPORT_HEADERS.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${String(c ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 250);
  });

  // ── Periodo: helpers ─────────────────────────────────────────────────────────

  const MONTHS     = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const MONTHS_SH  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  function isoWeek(d) {
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = (tmp.getUTCDay() + 6) % 7;
    tmp.setUTCDate(tmp.getUTCDate() - day + 3);
    const jan4 = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((tmp - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  }

  function getWeekRange(offset) {
    const now  = new Date();
    const day  = (now.getDay() + 6) % 7;           // 0=Lun … 6=Dom
    const mon  = new Date(now);
    mon.setDate(now.getDate() - day + offset * 7);
    mon.setHours(0, 0, 0, 0);
    const sun  = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);
    return { from: mon, to: sun };
  }

  function getMonthRange(offset) {
    const now  = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() + offset, 1, 0, 0, 0, 0);
    const to   = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
    return { from, to };
  }

  function getPeriodRange() {
    if (periodMode === 'week')  return getWeekRange(periodOffset);
    if (periodMode === 'month') return getMonthRange(periodOffset);
    return null;
  }

  function getPeriodLabel() {
    if (periodMode === 'week') {
      const { from, to } = getWeekRange(periodOffset);
      const wk   = isoWeek(from);
      const same = from.getFullYear() === to.getFullYear();
      const fStr = `${from.getDate()} ${MONTHS_SH[from.getMonth()]}`;
      const tStr = `${to.getDate()} ${MONTHS_SH[to.getMonth()]} ${to.getFullYear()}`;
      return `Sem. ${wk} · ${fStr}–${tStr}`;
    }
    if (periodMode === 'month') {
      const d = new Date(new Date().getFullYear(), new Date().getMonth() + periodOffset, 1);
      return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    }
    return '';
  }

  // ── Periodo: elementos DOM ────────────────────────────────────────────────────

  const periodModes  = Array.from(root.querySelectorAll('.act-period-mode'));
  const periodCtrl   = root.querySelector('#act-period-ctrl');
  const periodLabel  = root.querySelector('#act-period-label');
  const btnPrev      = root.querySelector('#act-period-prev');
  const btnNext      = root.querySelector('#act-period-next');
  const btnToday     = root.querySelector('#act-period-today');

  function syncPeriodUI() {
    const hasNav = periodMode !== 'all';
    periodCtrl.hidden = !hasNav;
    if (hasNav) periodLabel.textContent = getPeriodLabel();
    // resaltar botón de modo activo
    periodModes.forEach(b => b.classList.toggle('is-active', b.dataset.period === periodMode));
    // desactivar "Hoy" cuando ya estamos en offset 0
    if (btnToday) btnToday.disabled = periodOffset === 0;
  }

  // ── Dropdown "Nueva actividad" ────────────────────────────────────────────────

  const actTrigger = root.querySelector('#actNewTrigger');
  const actMenu    = root.querySelector('#actNewMenu');

  if (actTrigger && actMenu) {
    actTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = actMenu.classList.toggle('is-open');
      actTrigger.setAttribute('aria-expanded', String(open));
    });
    actMenu.addEventListener('click', () => {
      actMenu.classList.remove('is-open');
      actTrigger.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('click', () => {
      actMenu.classList.remove('is-open');
      actTrigger.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        actMenu.classList.remove('is-open');
        actTrigger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ── Periodo: eventos ─────────────────────────────────────────────────────────

  periodModes.forEach(btn => {
    btn.addEventListener('click', () => {
      periodMode   = btn.dataset.period;
      periodOffset = 0;
      syncPeriodUI();
      applyFilters();
    });
  });

  btnPrev?.addEventListener('click', () => { periodOffset--; syncPeriodUI(); applyFilters(); });
  btnNext?.addEventListener('click', () => { periodOffset++; syncPeriodUI(); applyFilters(); });
  btnToday?.addEventListener('click', () => { periodOffset = 0; syncPeriodUI(); applyFilters(); });

  // ── Eventos UI ───────────────────────────────────────────────────────────────

  const rerender = debounce(() => applyFilters(), 140);
  fQ.addEventListener('input', rerender);
  fResp.addEventListener('change', rerender);
  fEstado.addEventListener('change', rerender);
  fTipo.addEventListener('change', rerender);

  btnClear.addEventListener('click', () => {
    fQ.value = '';
    fResp.value = '';
    fEstado.value = '';
    fTipo.value = '';
    periodMode   = 'all';
    periodOffset = 0;
    syncPeriodUI();
    applyFilters();
  });

  // Clicks en la tabla (delegado)
  root.querySelector('#act-table tbody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    e.preventDefault();
    const id     = btn.dataset.id     || '';
    const source = btn.dataset.source || '';
    const action = btn.dataset.act    || '';
    const row = allRows.find(r => r._id === id);
    if (!row) return;

    if (action === 'editar') {
      if (source === 'visita') {
        document.dispatchEvent(new CustomEvent('visita:open-edit', { detail: { id } }));
      } else {
        openInteraccionModal({ preset: row._raw, onSaved: () => loadAll() });
      }
    }

    if (action === 'ver') {
      if (source === 'visita') {
        document.dispatchEvent(new CustomEvent('visita:open-readonly', { detail: { id } }));
      } else {
        openInteraccionModal({ preset: row._raw, onSaved: () => loadAll() });
      }
    }

    if (action === 'muestreo') {
      document.dispatchEvent(new CustomEvent('muestreo:open-from-visita', {
        detail: { id, view: row.hasMuestreo ? 'summary' : 'form' }
      }));
    }
  });

  // ── Filtros y renderizado ─────────────────────────────────────────────────────

  function applyFilters() {
    if (!tableCtrl) return;
    const q      = norm(fQ.value || '');
    const resp   = norm(fResp.value || '');
    const estado = (fEstado.value || '').trim();
    const tipo   = (fTipo.value || '').trim();
    const range  = getPeriodRange();

    const filtered = allRows.filter(row => {
      if (tipo && norm(row.tipo) !== tipo) return false;
      if (resp && norm(row.responsable) !== resp) return false;
      if (estado === 'vencido'   && !isVencido(row)) return false;
      if (estado === 'pendiente' && estadoBucket(row.estado) !== 'pendiente') return false;
      if (estado === 'cumplido'  && estadoBucket(row.estado) !== 'cumplido') return false;
      if (range) {
        const d = row.fecha ? new Date(row.fecha) : null;
        if (!d || d < range.from || d > range.to) return false;
      }
      if (q) {
        const txt = norm([row.proveedorNombre, row.contactoNombre, row.centroCodigo, row.proximoPaso, row.observaciones, row.responsable].join(' '));
        if (!txt.includes(q)) return false;
      }
      return true;
    });

    tableCtrl.setRows(filtered.map(toDisplayRow));
    tableCtrl.resetPage();
  }

  function toDisplayRow(row) {
    const c     = cfg(row.tipo);
    const fotoTag = row.fotoCount > 0
      ? `<span class="act-foto-tag"><i class="bi bi-camera-fill"></i> ${row.fotoCount}</span>`
      : '';
    const badge = `<div class="act-tipo-cell"><span class="act-type-badge" style="--act-color:${c.color}"><i class="bi ${c.icon}"></i> ${esc(c.label)}</span>${fotoTag}</div>`;

    const fpDate = row.fechaProximo ? new Date(row.fechaProximo) : null;
    const fpStr  = fpDate && !Number.isNaN(fpDate.getTime()) ? fmtDate(fpDate) : '';
    const venc   = fpDate && fpDate < new Date();
    const fpCell = fpStr
      ? `<span style="color:${venc ? '#ef4444' : 'inherit'};font-weight:${venc ? '700' : '400'}">${fpStr}${venc ? ' ⚠' : ''}</span>`
      : '-';

    const provCell = `
      <div class="act-prov-cell">
        <span class="act-prov-name">${esc(row.proveedorNombre || '-')}</span>
        ${row.contactoNombre ? `<span class="act-prov-contact">${esc(row.contactoNombre)}</span>` : ''}
      </div>`.trim();

    const pasoCell = `
      <div class="act-paso-cell">
        <span class="act-paso">${esc(row.proximoPaso || '-')}</span>
        ${row.responsable ? `<span class="act-resp-tag"><i class="bi bi-person"></i>${esc(row.responsable)}</span>` : ''}
      </div>`.trim();

    const muestreoBtn = row._source === 'visita'
      ? `<button class="tbl-action-btn ${row.hasMuestreo ? 'tbl-act-biomasa mu-green' : ''}" data-act="muestreo" data-id="${esc(row._id)}" data-source="visita" title="${row.hasMuestreo ? 'Ver muestreo' : 'Registrar muestreo'}"><i class="bi bi-eyedropper"></i></button>`
      : '';

    const accs = [
      muestreoBtn,
      `<button class="tbl-action-btn tbl-act-view" data-act="ver" data-id="${esc(row._id)}" data-source="${esc(row._source)}" title="Ver detalle"><i class="bi bi-eye"></i></button>`,
      `<button class="tbl-action-btn tbl-act-edit" data-act="editar" data-id="${esc(row._id)}" data-source="${esc(row._source)}" title="Editar"><i class="bi bi-pencil"></i></button>`,
    ].join('');

    return {
      key: `${row._source}-${row._id}`,
      cells: [
        `<span class="act-date">${fmtDate(row.fecha)}</span>`,
        badge,
        provCell,
        `<span class="act-centro">${esc(row.centroCodigo || '-')}</span>`,
        pasoCell,
        fpCell,
        `<span class="act-tons">${fmtTons(row.tons)}</span>`,
        `<div class="acts tbl-actions">${accs}</div>`,
      ],
      export: [
        fmtDate(row.fecha), row.tipo, row.proveedorNombre, row.contactoNombre,
        row.centroCodigo, row.proximoPaso, fpStr,
        String(row.tons || 0), row.responsable,
      ],
    };
  }

  async function loadResponsables() {
    try {
      const res = await fetch(`${API_BASE}/maestros?tipo=responsable&soloActivos=true`);
      if (!res.ok) return;
      const { items } = await res.json();
      const prev = fResp.value;
      const resps = (items || []).map(i => i.nombre).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
      fResp.innerHTML = `<option value="">Todos los responsables</option>` +
        resps.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('');
      if (fResp.querySelector(`option[value="${CSS.escape(prev)}"]`)) fResp.value = prev;
    } catch { /* mantener select vacío */ }
  }

  // ── Carga de datos ────────────────────────────────────────────────────────────

  async function loadAll() {
    if (loading) return;
    loading = true;
    try {
      const contactos = state.contactosGuardados || [];
      const [visitasRaw, intResp] = await Promise.all([
        getAllVisitas().catch(() => []),
        listInteracciones({ limit: 2000 }).catch(() => ({ items: [] })),
      ]);

      // Actualizar state para que otros módulos (muestreos) tengan los datos
      if (Array.isArray(visitasRaw)) state.visitasGuardadas = visitasRaw;

      const visitas  = (Array.isArray(visitasRaw) ? visitasRaw : []).map(v => fromVisita(v, contactos));
      const ints     = (intResp?.items || intResp?.data || []).map(fromInteraccion);

      allRows = [...visitas, ...ints].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
      applyFilters();
    } catch (e) {
      console.error('[activity-table] loadAll error', e);
    } finally {
      loading = false;
    }
  }

  syncPeriodUI();
  await Promise.all([loadResponsables(), loadAll()]);

  // Exponer recarga para que el sistema pueda refrescar tras guardar
  root._activityRefresh = loadAll;
}
