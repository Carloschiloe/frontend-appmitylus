// /js/abastecimiento/contactos/interacciones/table.js
import { list, remove_ } from './api.js';
import { esContactoNuevo, esProveedorNuevoInteraccion } from './normalizers.js';
import { openInteraccionModal } from './modal.js';
import { createModalConfirm, escapeHtml } from '../ui-common.js';
import { createLocalTableController } from '../local-table.js';

const esc = escapeHtml;
const PAGE_SIZE = 10;
const askDeleteInteraccion = createModalConfirm({
  id: 'modalConfirmDeleteInteraccion',
  className: 'modal app-modal',
  defaultTitle: 'Eliminar interaccion',
  defaultMessage: 'Se eliminara esta interaccion. Deseas continuar?',
  cancelText: 'Cancelar',
  acceptText: 'Eliminar'
});

export async function renderTable(container, { onChanged } = {}) {
  container.innerHTML = `
    <section class="int-modern-card">
      <div class="int-modern-filters">
        <label class="int-f-item int-f-sm">
          <span>Responsable PG</span>
          <select id="f-responsable" class="browser-default" aria-label="Responsable PG">
            <option value="">Todos</option>
            <option value="Claudio Alba">Claudio Alba</option>
            <option value="Patricio Alvarez">Patricio Alvarez</option>
            <option value="Carlos Avendano">Carlos Avendano</option>
          </select>
        </label>
        <label class="int-f-item int-f-sm">
          <span>Tipo</span>
          <select id="f-tipo" class="browser-default" aria-label="Tipo">
            <option value="">Todos los tipos</option>
            <option value="llamada">Llamada</option>
            <option value="visita">Visita</option>
            <option value="muestra">Muestra</option>
            <option value="reunion">Reunion</option>
            <option value="tarea">Tarea</option>
          </select>
        </label>
        <label class="int-f-item int-f-sm">
          <span>Semana</span>
          <select id="f-semana" class="browser-default" aria-label="Semana (YYYY-Www)"></select>
        </label>
        <label class="int-f-item int-f-sm">
          <span>Prox. paso</span>
          <select id="f-prox" class="browser-default" aria-label="Proximo paso">
            <option value="">Todos</option>
          </select>
        </label>
        <label class="int-f-item int-f-grow">
          <span>Buscar proveedor/contacto</span>
          <input id="f-q" type="text" class="mmpp-input" placeholder="Buscar por proveedor, contacto, centro o observacion...">
        </label>
        <div class="int-actions-line int-f-item int-f-actions">
          <label class="int-check-inline">
            <input type="checkbox" id="f-solo-nuevos"><span>Solo contactos nuevos</span>
          </label>
          <button id="btn-int-clear" type="button" class="dash-btn">Limpiar</button>
        </div>
      </div>

      <div class="int-status-row" role="group" aria-label="Estado">
        <button type="button" class="int-status-chip is-active" data-status="">Todos</button>
        <button type="button" class="int-status-chip" data-status="pendiente">Pendientes</button>
        <button type="button" class="int-status-chip" data-status="hecho">Cumplidos</button>
        <button type="button" class="int-status-chip" data-status="cancelado">Cancelados</button>
      </div>

      <div class="mmpp-table-wrap int-modern-table-wrap">
        <table id="int-table" class="striped highlight c-compact table-full">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Contacto</th>
              <th>Proveedor</th>
              <th>Tons</th>
              <th>Proximo paso</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
  `;

  const card = container.querySelector('.int-modern-card');
  const tbody = container.querySelector('#int-table tbody');
  const fTipo = container.querySelector('#f-tipo');
  const fResp = container.querySelector('#f-responsable');
  const fSemana = container.querySelector('#f-semana');
  const fNuevo = container.querySelector('#f-solo-nuevos');
  const fPaso = container.querySelector('#f-prox');
  const fQ = container.querySelector('#f-q');
  const btnClear = container.querySelector('#btn-int-clear');
  const chips = Array.from(container.querySelectorAll('.int-status-chip'));

  let infoPopover = null;
  let infoOwner = null;
  let tableCtrl = null;
  let visibleRows = new Map();
  let _loading = false;
  let _allRows = [];
  let _filteredRows = [];
  let _status = '';
  let _quickFilter = '';

  const applyFiltersDebounced = debounce(() => {
    applyClientFilters({ resetPage: true });
  }, 160);

  populateWeeksSelect(fSemana, 20);

  tableCtrl = createLocalTableController({
    section: card,
    table: container.querySelector('#int-table'),
    pageSize: PAGE_SIZE,
    emptyColspan: 7,
    emptyText: 'Sin resultados.',
    fileName: 'interacciones-remotas',
    exportHeaders: [
      'Fecha',
      'Tipo',
      'Contacto',
      'Proveedor',
      'Centro',
      'Tons',
      'Proximo paso',
      'Fecha proximo',
      'Responsable',
      'Estado',
      'Resumen'
    ],
    onPageRendered: ({ pageRows }) => {
      visibleRows = new Map((pageRows || []).map((r) => [String(r.key || ''), r.raw]));
      hideInfoPopover();
    }
  });

  fSemana.addEventListener('change', refresh);
  fTipo.addEventListener('change', refresh);
  fResp.addEventListener('change', refresh);
  fNuevo.addEventListener('change', refresh);
  fPaso.addEventListener('change', refresh);
  fQ.addEventListener('input', applyFiltersDebounced);

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      _status = chip.dataset.status || '';
      applyClientFilters({ resetPage: true });
    });
  });

  btnClear.addEventListener('click', () => {
    fTipo.value = '';
    fResp.value = '';
    fPaso.value = '';
    fQ.value = '';
    fNuevo.checked = false;
    chips.forEach((c) => c.classList.remove('is-active'));
    chips[0]?.classList.add('is-active');
    _status = '';
    _quickFilter = '';
    refresh();
  });

  tbody.addEventListener('click', (ev) => {
    const t = ev.target;

    const infoBtn = t.closest?.('.info-int');
    if (infoBtn) {
      const tr = infoBtn.closest('tr.main-row[data-rowkey]');
      const row = getVisibleRow(tr);
      if (!row) return;
      if (infoOwner === infoBtn && infoPopover?.classList.contains('is-open')) {
        hideInfoPopover();
      } else {
        showInfoPopover(infoBtn, row);
      }
      return;
    }

    const toggleBtn = t.closest?.('.more-int');
    if (toggleBtn) {
      const main = toggleBtn.closest('tr.main-row[data-rowkey]');
      const sub = main?.nextElementSibling;
      if (sub && sub.classList.contains('subrow')) {
        sub.classList.toggle('hide');
        main.classList.toggle('expanded');
      }
      return;
    }

    const editBtn = t.closest?.('.edit-int');
    if (editBtn) {
      const tr = editBtn.closest('tr.main-row[data-rowkey]');
      const row = getVisibleRow(tr);
      if (!row) return;
      openInteraccionModal({ preset: row, onSaved: refresh });
      return;
    }

    const delBtn = t.closest?.('.delete-int');
    if (delBtn) {
      const tr = delBtn.closest('tr.main-row[data-rowkey]');
      const row = getVisibleRow(tr);
      if (!row) return;
      const id = String(row._id || row.id || '').trim();
      if (!id) {
        window.M?.toast?.({ html: 'No se encontro ID para eliminar', classes: 'red' });
        return;
      }
      (async () => {
        const ok = await askDeleteInteraccion('Eliminar interaccion', 'Esta accion no se puede deshacer.', 'Eliminar');
        if (!ok) return;
        try {
          await remove_(id);
          _allRows = _allRows.filter((x) => String(x._id || x.id || '') !== id);
          applyClientFilters();
          window.M?.toast?.({ html: 'Interaccion eliminada', classes: 'green' });
        } catch (e) {
          console.error('[int] delete error', e);
          window.M?.toast?.({ html: 'No se pudo eliminar la interaccion', classes: 'red' });
        }
      })();
    }
  });

  async function refresh() {
    if (_loading) return;
    _loading = true;
    try {
      const params = {
        tipo: (fTipo.value || '').trim() || undefined,
        responsable: (fResp.value || '').trim() || undefined,
        nuevos: fNuevo.checked ? true : undefined
      };

      const semanaSel = (fSemana.value || '').trim();
      const pasoSel = (fPaso.value || '').trim();

      const resp = await list({ ...params, semana: undefined });
      const items = (resp && (resp.items || resp.data || [])) || [];

      let rows = semanaSel ? items.filter((x) => x.semanaKey === semanaSel) : items;
      if (fNuevo.checked) {
        rows = rows.filter((it) => esContactoNuevo(it.contactoId) || esProveedorNuevoInteraccion(it));
      }

      populatePasoOptions(fPaso, rows, pasoSel);
      if (pasoSel) rows = rows.filter((r) => norm(r.proximoPaso) === norm(pasoSel));

      rows.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
      _allRows = rows;
      applyClientFilters({ resetPage: true });
    } catch (e) {
      console.error('[int] ERROR refresh():', e);
      window.M?.toast?.({ html: 'Error al cargar interacciones', classes: 'red' });
      _allRows = [];
      _filteredRows = [];
      renderRows({ resetPage: true });
    } finally {
      _loading = false;
    }
  }

  function applyClientFilters({ resetPage = false } = {}) {
    const q = norm(fQ.value || '');
    _filteredRows = _allRows.filter((r) => {
      if (_status && bucketEstado(r.estado) !== _status) return false;

      if (_quickFilter === 'llamadas' && norm(r.tipo) !== 'llamada') return false;
      if (_quickFilter === 'acuerdos' && !hasAcuerdoConFecha(r)) return false;
      if (_quickFilter === 'conversion' && !(norm(r.tipo) === 'llamada' && hasAcuerdoConFecha(r))) return false;
      if (_quickFilter === 'cumplidos' && bucketEstado(r.estado) !== 'hecho') return false;
      if (_quickFilter === 'tons' && !(Number(r.tonsAcordadas) > 0)) return false;

      if (q) {
        const hay = norm([
          r.contactoNombre,
          r.proveedorNombre,
          r.centroCodigo,
          r.proximoPaso,
          r.resumen,
          r.observaciones,
          r.responsablePG
        ].join(' ')).includes(q);
        if (!hay) return false;
      }
      return true;
    });

    onChanged?.(_filteredRows);
    renderRows({ resetPage });
  }

  function renderRows({ resetPage = false } = {}) {
    if (!tableCtrl) return;
    const rows = _filteredRows.map((r, idx) => toDisplayRow(r, idx));
    tableCtrl.setRows(rows);
    if (resetPage) tableCtrl.resetPage();
  }

  function toDisplayRow(r, idx) {
    const key = rowKey(r, idx);
    const nuevo = (esContactoNuevo(r.contactoId) || esProveedorNuevoInteraccion(r))
      ? '<span class="nuevo-star yellow" title="Contacto/proveedor nuevo">*</span>'
      : '';
    const resumenRaw = r.resumen || r.observaciones || '';
    const subTexto = esc(resumenRaw || 'Sin observaciones registradas');
    const inlineObs = esc(shortObs(resumenRaw));
    const proveedorTxt = esc(r.proveedorNombre || '-');
    const tonsTxt = fmtNum(r.tonsAcordadas);

    return {
      key,
      raw: r,
      className: 'main-row',
      attrs: {
        'data-id': String(r._id || r.id || ''),
        'data-rowkey': key
      },
      cells: [
        fmtD(r.fecha),
        `<span class="int-type-chip">${esc((r.tipo || '').toUpperCase())}</span>`,
        `
          <div class="strong">${esc(r.contactoNombre || '')} ${nuevo}</div>
          <div class="subline int-provider-line">${proveedorTxt}</div>
        `.trim(),
        proveedorTxt,
        `<div class="txt-right">${tonsTxt}</div>`,
        `
          <div>${esc(r.proximoPaso || '-')}</div>
          <div class="subline">${fmtD(r.fechaProximo)}</div>
          <div class="subline int-tons-line">Tons: ${tonsTxt}</div>
          ${inlineObs ? `<div class="subline int-inline-obs" title="${esc(resumenRaw)}">${inlineObs}</div>` : ''}
        `.trim(),
        `
          <div class="acts tbl-actions">
            <button type="button" class="btn-flat tbl-action-btn tbl-act-view info-int" title="Ver detalle rapido">
              <i class="material-icons tiny">info</i>
            </button>
            <button type="button" class="btn-flat tbl-action-btn tbl-act-more more-int" title="Ver detalle">
              <i class="material-icons tiny caret">expand_more</i>
            </button>
            <button type="button" class="btn-flat tbl-action-btn tbl-act-edit edit-int" title="Editar">
              <i class="material-icons tiny">edit</i>
            </button>
            <button type="button" class="btn-flat tbl-action-btn tbl-act-delete delete-int" title="Eliminar">
              <i class="material-icons tiny">delete</i>
            </button>
          </div>
        `.trim()
      ],
      afterHtml: `
        <tr class="subrow hide" data-parent-rowkey="${esc(key)}">
          <td colspan="7">
            <span class="obs-title">Resumen / Observaciones:</span>
            <span>${subTexto}</span>
          </td>
        </tr>
      `.trim(),
      export: [
        fmtD(r.fecha),
        r.tipo || '',
        r.contactoNombre || '',
        r.proveedorNombre || '',
        r.centroCodigo || '',
        String(Number(r.tonsAcordadas) || 0),
        r.proximoPaso || '',
        fmtD(r.fechaProximo),
        r.responsablePG || '',
        r.estado || '',
        String(resumenRaw || '').replace(/\s+/g, ' ').trim()
      ]
    };
  }

  function getVisibleRow(tr) {
    const key = String(tr?.dataset?.rowkey || '').trim();
    if (!key) return null;
    return visibleRows.get(key) || null;
  }

  function ensureInfoPopover() {
    if (infoPopover) return infoPopover;
    const pop = document.createElement('div');
    pop.className = 'int-info-popover';
    pop.innerHTML = `
      <div class="int-info-pop-head">Detalle</div>
      <div class="int-info-pop-body"></div>
    `;
    document.body.appendChild(pop);
    infoPopover = pop;
    return pop;
  }

  function hideInfoPopover() {
    if (!infoPopover) return;
    infoPopover.classList.remove('is-open');
    infoOwner = null;
  }

  function showInfoPopover(anchor, row) {
    const pop = ensureInfoPopover();
    const estado = bucketEstado(row?.estado);
    const estadoLabel = estado === 'hecho'
      ? 'Cumplido'
      : estado === 'cancelado'
        ? 'Cancelado'
        : 'Pendiente';
    const body = pop.querySelector('.int-info-pop-body');
    body.innerHTML = `
      <div><strong>Responsable:</strong> ${esc(row?.responsablePG || '-')}</div>
      <div><strong>Centro:</strong> ${esc(row?.centroCodigo || '-')}</div>
      <div><strong>Estado:</strong> ${esc(estadoLabel)}</div>
      <div><strong>Observacion:</strong> ${esc((row?.resumen || row?.observaciones || 'Sin observaciones').trim())}</div>
    `;

    pop.classList.add('is-open');
    const a = anchor.getBoundingClientRect();
    const p = pop.getBoundingClientRect();
    const gap = 8;
    let left = a.left + window.scrollX - p.width - gap;
    if (left < 12) left = a.right + gap;
    if (left + p.width > window.scrollX + window.innerWidth - 12) left = window.scrollX + window.innerWidth - p.width - 12;
    let top = a.top + window.scrollY - 6;
    if (top + p.height > window.scrollY + window.innerHeight - 12) top = window.scrollY + window.innerHeight - p.height - 12;
    if (top < window.scrollY + 12) top = window.scrollY + 12;
    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;
    infoOwner = anchor;
  }

  document.addEventListener('click', (ev) => {
    if (!infoPopover?.classList.contains('is-open')) return;
    const t = ev.target;
    if (t.closest('.int-info-popover')) return;
    if (t.closest('.info-int')) return;
    hideInfoPopover();
  }, true);
  window.addEventListener('scroll', hideInfoPopover, { passive: true });
  window.addEventListener('resize', hideInfoPopover, { passive: true });

  await refresh();
  return {
    refresh,
    getQuickFilter: () => _quickFilter,
    setQuickFilter: (key = '') => {
      const k = String(key || '').trim().toLowerCase();
      _quickFilter = (_quickFilter === k) ? '' : k;
      applyClientFilters({ resetPage: true });
      return _quickFilter;
    }
  };
}

/* ===== Helpers ===== */
function populateWeeksSelect(selectEl, count = 20) {
  const weeks = lastNWeeks(count);
  selectEl.innerHTML = weeks.map((w) => `<option value="${w}">${w}</option>`).join('');
  const curr = currentIsoWeek();
  const has = weeks.includes(curr);
  selectEl.value = has ? curr : weeks[0];
}

function populatePasoOptions(sel, rows, keepValue = '') {
  const uniq = [...new Set(rows.map((r) => String(r.proximoPaso || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));
  const old = sel.value;
  const want = keepValue || old;
  sel.innerHTML = '<option value="">Todos</option>' + uniq.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  if (want && uniq.includes(want)) sel.value = want;
}

function rowKey(row, idx) {
  const id = String(row?._id || row?.id || '').trim();
  const fecha = String(row?.fecha || row?.fechaProximo || '').trim();
  return id ? `${id}::${fecha}` : `int-${idx}-${fecha}`;
}

function bucketEstado(s) {
  const raw = norm(s);
  if (!raw) return 'pendiente';
  if (raw === 'completado' || raw === 'hecho' || raw === 'cumplido') return 'hecho';
  if (raw.includes('cancel')) return 'cancelado';
  return 'pendiente';
}

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function lastNWeeks(n = 20) {
  const out = [];
  let d = new Date();
  for (let i = 0; i < n; i += 1) {
    out.push(currentIsoWeek(d));
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7);
  }
  return out;
}

function currentIsoWeek(d = new Date()) {
  if (window.app?.utils?.isoWeek) {
    const w = window.app.utils.isoWeek(d);
    return `${d.getFullYear()}-W${String(w).padStart(2, '0')}`;
  }
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7;
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((tmp - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function fmtD(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CL');
}

function fmtNum(n) {
  if (n === null || n === undefined || n === '') return '0';
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  return v.toLocaleString('es-CL', { maximumFractionDigits: 2 });
}

function shortObs(v) {
  const t = String(v || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length > 56 ? `${t.slice(0, 56)}...` : t;
}

function hasAcuerdoConFecha(r) {
  return !!(r?.proximoPaso && (r?.proximoPasoFecha || r?.fechaProximo));
}

function debounce(fn, wait = 160) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
