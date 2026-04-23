// /js/abastecimiento/contactos/tabla.js
import { state, $ } from './state.js';
import { centroCodigoById, comunaPorCodigo } from './normalizers.js';
import { abrirEdicion, eliminarContacto, abrirDetalleContacto } from './form-contacto.js';
import { abrirModalVisita } from '../visitas/ui.js';
import { createModalConfirm, escapeHtml, fetchJson, debounce } from './ui-common.js';
import { createLocalTableController } from './local-table.js';
import { toast } from '../../ui/toast.js';

const API_BASE = window.API_URL || '/api';
const PAGE_SIZE = 10;
const esc = escapeHtml;
const fmtCL = (n) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 });
const apiJson = (path, options = {}) => fetchJson(`${API_BASE}${path}`, { credentials: 'same-origin', ...options });

const askDeleteContacto = createModalConfirm({
  id: 'modalConfirmDeleteContactoTabla',
  defaultTitle: 'Eliminar contacto',
  defaultMessage: '¿Seguro que quieres eliminar este contacto?',
  acceptText: 'Eliminar'
});

let tableCtrl = null;
let uiBound = false;

let maestrosResponsables = [];
let maestrosResponsablesByNorm = new Map();
let maestrosResponsablesPromise = null;

const normalizeText = (v) => String(v || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

async function ensureMaestrosResponsables() {
  if (maestrosResponsablesPromise) return maestrosResponsablesPromise;
  if (maestrosResponsables.length) return maestrosResponsables;

  maestrosResponsablesPromise = (async () => {
    try {
      const json = await apiJson('/maestros?tipo=responsable&soloActivos=true');
      const items = Array.isArray(json?.items) ? json.items : (Array.isArray(json) ? json : []);
      maestrosResponsables = items
        .map((x) => String(x?.nombre || x?.label || x || '').trim())
        .filter(Boolean);

      maestrosResponsablesByNorm = new Map();
      maestrosResponsables.forEach((name) => {
        const key = normalizeText(name);
        if (!key) return;
        if (!maestrosResponsablesByNorm.has(key)) maestrosResponsablesByNorm.set(key, name);
      });
    } catch (e) {
      maestrosResponsables = [];
      maestrosResponsablesByNorm = new Map();
    } finally {
      maestrosResponsablesPromise = null;
    }
    return maestrosResponsables;
  })();

  return maestrosResponsablesPromise;
}

function canonicalResponsable(v) {
  const raw = String(v || '').trim();
  if (!raw) return '';
  const key = normalizeText(raw);
  return maestrosResponsablesByNorm.get(key) || raw;
}

const escapeSelector = (v) => {
  const s = String(v || '');
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(s);
  return s.replace(/["\\]/g, '\\$&');
};

const esCodigoValido = (x) => /^\d{4,7}$/.test(String(x || ''));

function getISOWeek(d = new Date()) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x - yearStart) / 86400000 + 1) / 7);
}

state.dispTotalCache = state.dispTotalCache || new Map();

async function getDisponibilidades(params) {
  const y = new Date().getFullYear();
  const q = new URLSearchParams();
  q.set('from', params?.from || `${y - 1}-01`);
  q.set('to', params?.to || `${y + 1}-12`);
  if (params?.contactoId) q.set('contactoId', params.contactoId);
  if (params?.proveedorKey) q.set('proveedorKey', params.proveedorKey);
  if (params?.centroId) q.set('centroId', params.centroId);
  const json = await apiJson(`/disponibilidades?${q.toString()}`);
  return Array.isArray(json) ? json : (json.items || []);
}

async function fetchTotalDisponibilidad({ contactoId = '', proveedorKey = '', centroId = '' }) {
  const key = `${contactoId || ''}|${proveedorKey || ''}|${centroId || ''}`;
  if (state.dispTotalCache.has(key)) return state.dispTotalCache.get(key);

  const sum = (list, byId) => (Array.isArray(list) ? list : [])
    .filter((it) => !byId || String(it.contactoId || '') === String(byId))
    .reduce((a, it) => a + Number(it.tonsDisponible ?? it.tons ?? 0), 0);

  let total = 0;
  try {
    if (contactoId) total = sum(await getDisponibilidades({ contactoId }), contactoId);
    if (total === 0 && (proveedorKey || centroId)) total = sum(await getDisponibilidades({ proveedorKey, centroId }));
    if (total === 0 && proveedorKey) total = sum(await getDisponibilidades({ proveedorKey }));
  } catch (e) {
    console.error('[tablaContactos] fetchTotalDisponibilidad', e);
  }

  state.dispTotalCache.set(key, total);
  return total;
}

function ensureFooter() {
  const table = $('#tablaContactos');
  if (!table) return;
  if (table.tFoot) return;
  const tfoot = table.createTFoot();
  const tr = tfoot.insertRow(0);
  for (let i = 0; i < 7; i += 1) {
    const th = document.createElement('th');
    if (i === 4) th.textContent = 'Total pagina: 0';
    tr.appendChild(th);
  }
}

function setFooterTotal(total) {
  const table = $('#tablaContactos');
  if (!table?.tFoot) return;
  const th = table.tFoot.querySelectorAll('th')[4];
  if (th) th.textContent = `Total pagina: ${fmtCL(total)}`;
}

async function clickAccContacto(aEl) {
  try {
    const id = aEl?.dataset?.id;
    const action = (aEl?.dataset?.action || '').toLowerCase();
    const c = state.contactosGuardados.find((x) => String(x._id) === String(id));
    if (!c) {
      toast('Contacto no encontrado', { variant: 'error' });
      return;
    }

    if (action === 'ver') return abrirDetalleContacto(c);

    if (action === 'visita') {
      try {
        if (typeof abrirModalVisita === 'function') return abrirModalVisita(c);
      } catch (err) {
        console.warn('[contactos] abrirModalVisita error, fallback evento:', err);
      }
      document.dispatchEvent(new CustomEvent('contacto:visita', { detail: { contacto: c } }));
      return;
    }

    if (action === 'editar') return abrirEdicion(c);

    if (action === 'eliminar') {
      if (aEl.dataset.busy === '1') return;
      aEl.dataset.busy = '1';
      try {
        const ok = await askDeleteContacto('Eliminar contacto', '¿Seguro que quieres eliminar este contacto?', 'Eliminar');
        if (!ok) return;
        await eliminarContacto(id);
      } catch (e) {
        console.error(e);
        toast('No se pudo eliminar', { variant: 'error' });
      } finally {
        delete aEl.dataset.busy;
      }
    }
  } catch (err) {
    console.error('[contactos] clickAccContacto', err);
  }
}
window._clickAccContacto = clickAccContacto;

function buildRows() {
  const base = Array.isArray(state.contactosGuardados) ? state.contactosGuardados : [];
  return base
    .slice()
    .sort((a, b) => (new Date(b.createdAt || b.fecha || 0)) - (new Date(a.createdAt || a.fecha || 0)))
    .map((c, idx) => {
      const f = new Date(c.createdAt || c.fecha || Date.now());
      const whenKey = f.getTime();
      const whenDisplay = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
      const semana = String(getISOWeek(f));
      const rowKey = String(c._id || `c-${idx}-${whenKey}`);

      let centroCodigo = c.centroCodigo;
      if (!esCodigoValido(centroCodigo)) centroCodigo = centroCodigoById(c.centroId) || '';
      const comuna = c.centroComuna || c.comuna || comunaPorCodigo(centroCodigo) || '';

      const proveedorNombre = String(c.proveedorNombre || '');
      const contactoNombre = String(c.contactoNombre || c.contacto || '');
      const responsableRaw = String(c.responsablePG || c.responsable || c.contactoResponsable || '?');
      const responsable = canonicalResponsable(responsableRaw);

      const provCell = proveedorNombre
        ? `
          <span class="prov-cell" title="${esc(proveedorNombre)}${contactoNombre ? ` - ${esc(contactoNombre)}` : ''}">
            <span class="prov-top ellipsisProv">${esc(proveedorNombre)}</span>
            ${contactoNombre ? `<span class="prov-sub ellipsisProv">${esc(contactoNombre)}</span>` : ''}
          </span>
        `.trim()
        : '';

      const centroHTML = `
        <span class="centro-cell" title="${esc(centroCodigo)}${comuna ? ` - ${esc(comuna)}` : ''}">
          <span class="centro-top">${esc(centroCodigo) || '?'}</span>
          ${comuna ? `<span class="centro-sub">${esc(comuna)}</span>` : ''}
        </span>
      `.trim();

      const tonsCell = `<span class="tons-cell" data-rowkey="${esc(rowKey)}" data-contactoid="${esc(c._id || '')}" data-provkey="${esc(c.proveedorKey || '')}" data-centroid="${esc(c.centroId || '')}" data-value=""></span>`;

      const acciones = `
        <div class="acts tbl-actions">
          <button type="button" class="tbl-action-btn tbl-act-view" data-action="ver" title="Ver detalle" data-id="${esc(c._id || '')}"><i class="bi bi-eye"></i></button>
          <button type="button" class="tbl-action-btn tbl-act-visit" data-action="visita" title="Registrar visita" data-id="${esc(c._id || '')}"><i class="bi bi-calendar-check"></i></button>
          <button type="button" class="tbl-action-btn tbl-act-edit" data-action="editar" title="Editar" data-id="${esc(c._id || '')}"><i class="bi bi-pencil"></i></button>
          <button type="button" class="tbl-action-btn tbl-act-delete mu-red" data-action="eliminar" title="Eliminar" data-id="${esc(c._id || '')}"><i class="bi bi-trash"></i></button>
        </div>
      `.trim();

      return {
        key: rowKey,
        semana,
        comuna,
        responsable,
        searchKey: normalizeText([proveedorNombre, contactoNombre, centroCodigo, comuna, responsable, whenDisplay].join(' ')),
        contactoId: c._id || '',
        proveedorKey: c.proveedorKey || '',
        centroId: c.centroId || '',
        tonsValue: null,
        cells: [
          esc(semana),
          `<span data-order="${whenKey}">${whenDisplay}</span>`,
          provCell,
          centroHTML,
          tonsCell,
          esc(responsable),
          acciones
        ],
        export: [whenDisplay, proveedorNombre, contactoNombre, centroCodigo, comuna, '', responsable]
      };
    });
}

function populateFiltrosDesdeDatos(rows) {
  const $sem = document.getElementById('fltSemana');
  const $com = document.getElementById('fltComuna');
  const $resp = document.getElementById('fltResp');
  if (!$sem || !$com) return;

  const prevSem = $sem.value;
  const prevCom = $com.value;
  const prevResp = $resp ? $resp.value : '';
  const semanas = [...new Set(rows.map((r) => r.semana))].sort((a, b) => Number(a) - Number(b));
  const comunas = [...new Set(rows.map((r) => String(r.comuna || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));

  const presentResp = new Set(rows.map((r) => normalizeText(r.responsable)).filter(Boolean));
  const responsablesFuente = maestrosResponsables.length
    ? maestrosResponsables.filter((name) => presentResp.has(normalizeText(name)))
    : rows.map((r) => String(r.responsable || '').trim()).filter(Boolean);

  const responsablesMap = new Map();
  responsablesFuente.forEach((name) => {
    const k = normalizeText(name);
    if (!k) return;
    if (!responsablesMap.has(k)) {
      responsablesMap.set(k, maestrosResponsablesByNorm.get(k) || name);
    }
  });
  const responsables = [...responsablesMap.values()].sort((a, b) => a.localeCompare(b, 'es'));

  $sem.innerHTML = '<option value="">Semana…</option>' + semanas.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  $com.innerHTML = '<option value="">Comuna…</option>' + comunas.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  $sem.value = semanas.includes(prevSem) ? prevSem : '';
  $com.value = comunas.includes(prevCom) ? prevCom : '';
  if ($resp) {
    $resp.innerHTML = '<option value="">Responsable…</option>' + responsables.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join('');
    $resp.value = responsables.includes(prevResp) ? prevResp : '';
  }
}

function filterRows(rows) {
  const semana = String(document.getElementById('fltSemana')?.value || '').trim();
  const comuna = normalizeText(document.getElementById('fltComuna')?.value || '');
  const resp = normalizeText(document.getElementById('fltResp')?.value || '');
  const q = normalizeText(document.getElementById('searchContactos')?.value || '');

  return rows.filter((r) => {
    if (semana && r.semana !== semana) return false;
    if (comuna && normalizeText(r.comuna) !== comuna) return false;
    if (resp && normalizeText(r.responsable) !== resp) return false;
    if (q && !r.searchKey.includes(q)) return false;
    return true;
  });
}

function recalcFooterFromVisible() {
  if (!tableCtrl) return;
  const rows = tableCtrl.getVisibleRows();
  const total = rows.reduce((sum, r) => sum + Number(r.tonsValue || 0), 0);
  setFooterTotal(total);
}

function hydrateVisibleTons({ pageRows }) {
  const rows = Array.isArray(pageRows) ? pageRows : [];
  recalcFooterFromVisible();
  rows.forEach((row) => {
    const sel = `.tons-cell[data-rowkey="${escapeSelector(row.key || '')}"]`;
    const span = document.querySelector(sel);
    if (!span) return;

    if (row.tonsValue !== null && row.tonsValue !== undefined) {
      span.dataset.value = String(row.tonsValue);
      span.textContent = fmtCL(row.tonsValue);
      span.classList.remove('loading');
      return;
    }

    span.classList.add('loading');
    span.textContent = '';
    fetchTotalDisponibilidad({
      contactoId: row.contactoId || '',
      proveedorKey: row.proveedorKey || '',
      centroId: row.centroId || ''
    }).then((total) => {
      row.tonsValue = Number(total || 0);
      row.export[5] = fmtCL(row.tonsValue);
      span.dataset.value = String(row.tonsValue);
      span.textContent = fmtCL(row.tonsValue);
      span.classList.remove('loading');
      recalcFooterFromVisible();
    }).catch(() => {
      span.classList.remove('loading');
    });
  });
}

function ensureLocalTable() {
  if (tableCtrl) return tableCtrl;
  tableCtrl = createLocalTableController({
    section: '#tab-contactos',
    table: '#tablaContactos',
    pageSize: PAGE_SIZE,
    emptyColspan: 7,
    emptyText: 'No hay contactos registrados aun.',
    fileName: 'Contactos_Abastecimiento',
    exportHeaders: ['Fecha', 'Proveedor', 'Contacto', 'Centro', 'Comuna', 'Tons', 'Responsable'],
    onPageRendered: hydrateVisibleTons
  });
  return tableCtrl;
}

function bindUiOnce() {
  if (uiBound) return;
  uiBound = true;

  const tbody = document.querySelector('#tablaContactos tbody');
  tbody?.addEventListener('click', (e) => {
    const btn = e.target.closest('.tbl-action-btn[data-action]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    clickAccContacto(btn);
  });

  const rerender = debounce(() => renderTablaContactos(), 120);
  document.getElementById('searchContactos')?.addEventListener('input', rerender);
  document.getElementById('fltSemana')?.addEventListener('change', rerender);
  document.getElementById('fltComuna')?.addEventListener('change', rerender);
  document.getElementById('fltResp')?.addEventListener('change', rerender);

  // Barra de filtros estilo Interacciones (limpiar + export)
  document.getElementById('dir-f-clear')?.addEventListener('click', () => {
    const sem = document.getElementById('fltSemana');
    const com = document.getElementById('fltComuna');
    const resp = document.getElementById('fltResp');
    const q = document.getElementById('searchContactos');
    if (sem) sem.value = '';
    if (com) com.value = '';
    if (resp) resp.value = '';
    if (q) q.value = '';
    ensureLocalTable()?.resetPage?.();
    renderTablaContactos();
  });

  document.querySelectorAll('[data-dir-export]')?.forEach((btn) => {
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      // Reusar la exportación existente del local-table (oculta por CSS)
      ensureLocalTable();
      const type = btn.getAttribute('data-dir-export');
      const map = { csv: 'export-csv', xls: 'export-xls', pdf: 'export-pdf' };
      const role = map[String(type || '').toLowerCase()];
      if (!role) return;
      document.querySelector(`#tab-contactos .local-table-top [data-role="${role}"]`)?.click();
    });
  });
}

export function initTablaContactos() {
  ensureFooter();
  ensureLocalTable();
  bindUiOnce();
  ensureMaestrosResponsables().then(() => renderTablaContactos()).catch(() => {});
}

export function renderTablaContactos() {
  const table = ensureLocalTable();
  if (!table) return;
  if (state.dispTotalCache?.clear) state.dispTotalCache.clear();

  const rows = buildRows();
  populateFiltrosDesdeDatos(rows);
  const filtered = filterRows(rows);
  table.setRows(filtered);
}

document.addEventListener('reload-tabla-contactos', () => renderTablaContactos());
