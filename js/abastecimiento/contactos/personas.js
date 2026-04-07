// /js/abastecimiento/contactos/personas.js
import { state, $ } from './state.js';
import { abrirEdicion, eliminarContacto, abrirDetalleContacto } from './form-contacto.js';
import { abrirModalVisita } from '../visitas/ui.js';
import { createModalConfirm, escapeHtml, debounce } from './ui-common.js';
import { createLocalTableController } from './local-table.js';

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
    section: '#tab-personas .mmpp-card',
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
          <a href="#!" class="act icon-action icon-ver tbl-action-btn tbl-act-view" title="Ver detalle" data-id="${id}"><i class="material-icons">visibility</i></a>
          <a href="#!" class="act icon-action icon-visita tbl-action-btn tbl-act-visit" title="Registrar visita" data-id="${id}"><i class="material-icons">event_available</i></a>
          <a href="#!" class="act icon-action icon-editar tbl-action-btn tbl-act-edit" title="Editar" data-id="${id}"><i class="material-icons">edit</i></a>
          <a href="#!" class="act icon-action icon-eliminar tbl-action-btn tbl-act-delete" title="Eliminar" data-id="${id}"><i class="material-icons">delete</i></a>
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
    const el = e.target.closest('.cell-actions .act, a.icon-action');
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();

    const id = el.dataset.id || '';
    const cls = String(el.className || '').toLowerCase();
    const c = (state.contactosGuardados || []).find((x) => String(x._id) === String(id));
    if (!c) return;

    if (cls.includes('icon-ver')) return abrirDetalleContacto(c);
    if (cls.includes('icon-visita')) return abrirModalVisita(c);
    if (cls.includes('icon-editar')) return abrirEdicion(c);
    if (cls.includes('icon-eliminar')) {
      const ok = await askDeleteContacto('Eliminar contacto', '¿Seguro que quieres eliminar este contacto?', 'Eliminar');
      if (!ok) return;
      eliminarContacto(id)
        .then(() => renderTablaPersonas())
        .catch((err) => {
          console.error(err);
          M.toast?.({ html: 'No se pudo eliminar', displayLength: 2000, classes: 'red' });
        });
    }
  });

  const rerender = debounce(() => renderTablaPersonas(), 120);
  document.getElementById('searchPersonas')?.addEventListener('input', rerender);
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
