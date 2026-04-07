// /js/abastecimiento/contactos/tabla.js
import { state, $ } from './state.js';
import { centroCodigoById, comunaPorCodigo } from './normalizers.js';
import { abrirEdicion, eliminarContacto, abrirDetalleContacto } from './form-contacto.js';
import { abrirModalVisita } from '../visitas/ui.js';
import { createModalConfirm, escapeHtml, fetchJson, debounce } from './ui-common.js';
import { createLocalTableController } from './local-table.js';

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

const normalizeText = (v) => String(v || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

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

async function openSemiCerradoDesdeFila(c) {
  try {
    const hoy = new Date();
    const periodoYM = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    const tonsDisponible = await fetchTotalDisponibilidad({
      contactoId: c._id || '',
      proveedorKey: c.proveedorKey || '',
      centroId: c.centroId || ''
    });

    const preset = {
      proveedorNombre: c.proveedorNombre || '',
      proveedorKey: c.proveedorKey || '',
      contacto: c.contactoNombre || c.contacto || '',
      responsablePG: c.responsablePG || c.responsable || c.contactoResponsable || '',
      centroCodigo: (c.centroCodigo && esCodigoValido(c.centroCodigo))
        ? c.centroCodigo
        : (centroCodigoById(c.centroId) || ''),
      periodoYM,
      tonsDisponible
    };

    if (typeof window.openSemiCerradoModal === 'function') {
      window.openSemiCerradoModal(preset);
    } else {
      document.dispatchEvent(new CustomEvent('semi-cerrado:open', { detail: preset }));
    }
  } catch (e) {
    console.error('[semi-cerrado] no se pudo abrir con preset:', e);
    M.toast?.({ html: 'No se pudo abrir el modal de semi-cerrado', classes: 'red' });
  }
}

async function clickAccContacto(aEl) {
  try {
    const id = aEl?.dataset?.id;
    const action = (aEl?.dataset?.action || '').toLowerCase();
    const c = state.contactosGuardados.find((x) => String(x._id) === String(id));
    if (!c) {
      M.toast?.({ html: 'Contacto no encontrado', classes: 'red' });
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

    if (action === 'semi') return openSemiCerradoDesdeFila(c);
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
        M.toast?.({ html: 'No se pudo eliminar', classes: 'red' });
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
      const responsable = String(c.responsablePG || c.responsable || c.contactoResponsable || '?');

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
        <div class="actions tbl-actions">
          <a href="#!" class="icon-action tbl-action-btn tbl-act-view" data-action="ver" title="Ver detalle" data-id="${esc(c._id || '')}"><i class="material-icons">visibility</i></a>
          <a href="#!" class="icon-action tbl-action-btn tbl-act-visit" data-action="visita" title="Registrar visita" data-id="${esc(c._id || '')}"><i class="material-icons">event_available</i></a>
          <a href="#!" class="icon-action tbl-action-btn tbl-act-biomasa" data-action="semi" title="Asignar biomasa semi-cerrada" data-id="${esc(c._id || '')}"><i class="material-icons">inventory</i></a>
          <a href="#!" class="icon-action tbl-action-btn tbl-act-edit" data-action="editar" title="Editar" data-id="${esc(c._id || '')}"><i class="material-icons">edit</i></a>
          <a href="#!" class="icon-action tbl-action-btn tbl-act-delete" data-action="eliminar" title="Eliminar" data-id="${esc(c._id || '')}"><i class="material-icons">delete</i></a>
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
  if (!$sem || !$com) return;

  const prevSem = $sem.value;
  const prevCom = $com.value;
  const semanas = [...new Set(rows.map((r) => r.semana))].sort((a, b) => Number(a) - Number(b));
  const comunas = [...new Set(rows.map((r) => String(r.comuna || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));

  $sem.innerHTML = '<option value="">Semana…</option>' + semanas.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  $com.innerHTML = '<option value="">Comuna…</option>' + comunas.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  $sem.value = semanas.includes(prevSem) ? prevSem : '';
  $com.value = comunas.includes(prevCom) ? prevCom : '';
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
    section: '#tab-contactos .mmpp-card',
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
    const a = e.target.closest('a.icon-action');
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    clickAccContacto(a);
  });

  const rerender = debounce(() => renderTablaContactos(), 120);
  document.getElementById('searchContactos')?.addEventListener('input', rerender);
  document.getElementById('fltSemana')?.addEventListener('change', rerender);
  document.getElementById('fltComuna')?.addEventListener('change', rerender);
  document.getElementById('fltResp')?.addEventListener('change', rerender);
}

export function initTablaContactos() {
  ensureFooter();
  ensureLocalTable();
  bindUiOnce();
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
