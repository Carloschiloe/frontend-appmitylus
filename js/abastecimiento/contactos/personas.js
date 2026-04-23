// /js/abastecimiento/contactos/personas.js
import { state, $ } from './state.js';
import { abrirEdicion, eliminarContacto, abrirDetalleContacto } from './form-contacto.js';
import { abrirModalVisita } from '../visitas/ui.js';
import { createModalConfirm, escapeHtml, debounce } from './ui-common.js';
import { createLocalTableController } from './local-table.js';
import { toast } from '../../ui/toast.js';

const esc = escapeHtml;
const PAGE_SIZE = 10;
let tableCtrl = null;
let uiBound = false;
let reloadBound = false;

const askDeleteContacto = createModalConfirm({
  id: 'modalConfirmDeleteContactoPersonas',
  defaultTitle: 'Eliminar contacto',
  defaultMessage: '¿Seguro que quieres eliminar este contacto?',
  acceptText: 'Eliminar'
});

const normalizeText = (v) => String(v || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const fmtDateYMD = (d) => {
  const x = d ? new Date(d) : new Date();
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

function ensureLocalTable() {
  if (tableCtrl) return tableCtrl;
  tableCtrl = createLocalTableController({
    section: '#tab-personas',
    table: '#tablaPersonas',
    pageSize: PAGE_SIZE,
    emptyColspan: 6,
    emptyText: 'No hay contactos registrados.',
    fileName: 'Agenda_de_Personas',
    exportHeaders: ['Fecha', 'Contacto', 'Empresa', 'Telefono(s)', 'Email', 'Comuna']
  });
  return tableCtrl;
}

function buildRows() {
  const lista = (state.contactosGuardados || []).slice();
  return lista
    .sort((a, b) => (new Date(b.createdAt || b.fecha || 0)) - (new Date(a.createdAt || a.fecha || 0)))
    .map((c, idx) => {
      const fStr = fmtDateYMD(c.createdAt || c.fecha || Date.now());
      const fKey = new Date(fStr).getTime();
      const nombre = c.contactoNombre || c.contacto || c.nombre || '-';
      const empresa = c.proveedorNombre || '';
      const tels = Array.isArray(c.contactoTelefonos)
        ? c.contactoTelefonos.filter(Boolean).join(' / ')
        : (c.contactoTelefono || '');
      const email = Array.isArray(c.contactoEmails)
        ? c.contactoEmails.filter(Boolean).join(' / ')
        : (c.contactoEmail || '');
      const comuna = c.centroComuna || c.comuna || '';
      const id = esc(c._id || `p-${idx}`);

      const contactoCell = `
        <div class="p-contacto" title="${esc(nombre)}${empresa ? ` - ${esc(empresa)}` : ''}">
          <span class="p-nombre">${esc(nombre)}</span>
          ${empresa ? `<span class="p-empresa">${esc(empresa)}</span>` : ''}
        </div>
      `.trim();

      const acciones = `
        <div class="cell-actions tbl-actions">
          <button type="button" class="tbl-action-btn tbl-act-view" data-action="ver" title="Ver detalle" data-id="${id}"><i class="bi bi-eye"></i></button>
          <button type="button" class="tbl-action-btn tbl-act-visit" data-action="visita" title="Registrar visita" data-id="${id}"><i class="bi bi-calendar-check"></i></button>
          <button type="button" class="tbl-action-btn tbl-act-edit" data-action="editar" title="Editar" data-id="${id}"><i class="bi bi-pencil"></i></button>
          <button type="button" class="tbl-action-btn tbl-act-delete mu-red" data-action="eliminar" title="Eliminar" data-id="${id}"><i class="bi bi-trash"></i></button>
        </div>
      `;

      return {
        id: c._id || '',
        searchKey: normalizeText([nombre, empresa, tels, email, comuna].join(' ')),
        cells: [
          `<span data-order="${fKey}">${fStr}</span>`,
          contactoCell,
          esc(String(tels || '')),
          esc(String(email || '')),
          esc(String(comuna || '')),
          acciones
        ],
        export: [
          fStr,
          String(nombre || ''),
          String(empresa || ''),
          String(tels || ''),
          String(email || ''),
          String(comuna || '')
        ]
      };
    });
}

function filterRows(rows) {
  const q = normalizeText(document.getElementById('searchPersonas')?.value || '');
  if (!q) return rows;
  return rows.filter((r) => r.searchKey.includes(q));
}

function bindUiOnce() {
  if (uiBound) return;
  uiBound = true;

  const tbody = document.querySelector('#tablaPersonas tbody');
  tbody?.addEventListener('click', async (e) => {
    const el = e.target.closest('.tbl-action-btn[data-action]');
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();

    const id = el.dataset.id || '';
    const action = String(el.dataset.action || '').toLowerCase();
    const c = (state.contactosGuardados || []).find((x) => String(x._id) === String(id));
    if (!c) return;

    if (action === 'ver') return abrirDetalleContacto(c);
    if (action === 'visita') return abrirModalVisita(c);
    if (action === 'editar') return abrirEdicion(c);
    if (action === 'eliminar') {
      const ok = await askDeleteContacto('Eliminar contacto', '¿Seguro que quieres eliminar este contacto?', 'Eliminar');
      if (!ok) return;
        eliminarContacto(id)
          .then(() => renderTablaPersonas())
          .catch((err) => {
            console.error(err);
            toast('No se pudo eliminar', { variant: 'error', durationMs: 2000 });
          });
    }
  });

  const rerender = debounce(() => renderTablaPersonas(), 120);
  document.getElementById('searchPersonas')?.addEventListener('input', rerender);

  document.getElementById('per-f-clear')?.addEventListener('click', () => {
    const q = document.getElementById('searchPersonas');
    if (q) q.value = '';
    ensureLocalTable()?.resetPage?.();
    renderTablaPersonas();
  });

  document.querySelectorAll('[data-personas-export]')?.forEach((btn) => {
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      ensureLocalTable();
      const type = btn.getAttribute('data-personas-export');
      const map = { csv: 'export-csv', xls: 'export-xls', pdf: 'export-pdf' };
      const role = map[String(type || '').toLowerCase()];
      if (!role) return;
      document.querySelector(`#tab-personas .local-table-top [data-role="${role}"]`)?.click();
    });
  });
}

export function initPersonasTab() {
  if (!$('#tablaPersonas')) return;
  ensureLocalTable();
  bindUiOnce();
  if (!reloadBound) {
    reloadBound = true;
    document.addEventListener('reload-tabla-contactos', () => renderTablaPersonas());
  }
  renderTablaPersonas();
}

export function renderTablaPersonas() {
  const table = ensureLocalTable();
  if (!table) return;
  const rows = buildRows();
  table.setRows(filterRows(rows));
}
