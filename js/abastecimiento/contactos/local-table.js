// /js/abastecimiento/contactos/local-table.js
import { escapeHtml } from './ui-common.js';

const DEFAULT_PAGE_SIZE = 10;

function resolveEl(ref) {
  if (!ref) return null;
  if (typeof ref === 'string') return document.querySelector(ref);
  return ref;
}

function ensureButton(label, role) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dash-btn tbl-ctrl-btn';
  btn.dataset.role = role;
  btn.textContent = label;
  return btn;
}

function ensureTopControls(sectionEl, tableId) {
  let top = sectionEl.querySelector(`[data-local-top="${tableId}"]`);
  if (top) return top;
  top = document.createElement('div');
  top.className = 'local-table-top';
  top.dataset.localTop = tableId;
  top.innerHTML = `
    <div class="local-export-group">
      <button type="button" class="dash-btn tbl-ctrl-btn" data-role="export-csv">CSV</button>
      <button type="button" class="dash-btn tbl-ctrl-btn" data-role="export-xls">Excel</button>
      <button type="button" class="dash-btn tbl-ctrl-btn" data-role="export-pdf">PDF</button>
    </div>
  `;
  const tableWrap = sectionEl.querySelector('.mmpp-table-wrap');
  if (tableWrap) tableWrap.parentElement.insertBefore(top, tableWrap);
  else sectionEl.appendChild(top);
  return top;
}

function ensureBottomControls(sectionEl, tableId) {
  let bottom = sectionEl.querySelector(`[data-local-bottom="${tableId}"]`);
  if (bottom) return bottom;
  bottom = document.createElement('div');
  bottom.className = 'local-table-bottom';
  bottom.dataset.localBottom = tableId;
  const prev = ensureButton('Anterior', 'prev');
  const next = ensureButton('Siguiente', 'next');
  bottom.innerHTML = `
    <div class="local-table-info" data-role="info">Mostrando 0 de 0</div>
    <div class="local-table-pager">
      <span class="local-table-page" data-role="page">1 / 1</span>
    </div>
  `;
  bottom.querySelector('.local-table-pager')?.prepend(prev);
  bottom.querySelector('.local-table-pager')?.appendChild(next);
  const tableWrap = sectionEl.querySelector('.mmpp-table-wrap');
  if (tableWrap) tableWrap.insertAdjacentElement('afterend', bottom);
  else sectionEl.appendChild(bottom);
  return bottom;
}

function clampPage(page, total, pageSize) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const next = Number(page) || 1;
  if (next < 1) return 1;
  if (next > pages) return pages;
  return next;
}

function attrsToString(attrs) {
  if (!attrs || typeof attrs !== 'object') return '';
  return Object.entries(attrs)
    .filter(([k]) => typeof k === 'string' && k.trim())
    .map(([k, v]) => ` ${escapeHtml(k)}="${escapeHtml(String(v ?? ''))}"`)
    .join('');
}

function makeDelimited(rows, sep = ';') {
  return rows
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(sep))
    .join('\n');
}

function downloadBlob(filename, content, type = 'text/plain;charset=utf-8;') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

function exportPdfLike(fileTitle, headers, rows) {
  const html = `
    <html><head><meta charset="utf-8"><title>${escapeHtml(fileTitle)}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:16px}
      h3{margin:0 0 10px}
      table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #cbd5e1;padding:6px;font-size:12px;text-align:left;vertical-align:top}
      th{background:#f1f5f9}
    </style>
    </head><body>
      <h3>${escapeHtml(fileTitle)}</h3>
      <table>
        <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </body></html>
  `;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

export function createLocalTableController({
  section,
  table,
  pageSize = DEFAULT_PAGE_SIZE,
  emptyColspan,
  emptyText = 'Sin resultados.',
  fileName = 'export',
  exportHeaders = [],
  onPageRendered
}) {
  const sectionEl = resolveEl(section);
  const tableEl = resolveEl(table);
  if (!sectionEl || !tableEl) return null;
  const tbody = tableEl.querySelector('tbody');
  if (!tbody) return null;

  const tableId = tableEl.id || `table-${Math.random().toString(36).slice(2)}`;
  const top = ensureTopControls(sectionEl, tableId);
  const bottom = ensureBottomControls(sectionEl, tableId);
  const infoEl = bottom.querySelector('[data-role="info"]');
  const pageEl = bottom.querySelector('[data-role="page"]');
  const prevBtn = bottom.querySelector('[data-role="prev"]');
  const nextBtn = bottom.querySelector('[data-role="next"]');

  const state = {
    rows: [],
    page: 1,
    pageSize: Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE)
  };

  function getAllExportRows() {
    return state.rows.map((r) => (Array.isArray(r.export) ? r.export : []));
  }

  function renderPage() {
    const total = state.rows.length;
    state.page = clampPage(state.page, total, state.pageSize);
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    const start = total ? (state.page - 1) * state.pageSize : 0;
    const end = Math.min(start + state.pageSize, total);
    const pageRows = state.rows.slice(start, end);

    if (!pageRows.length) {
      tbody.innerHTML = `<tr><td colspan="${Number(emptyColspan) || 1}" class="mmpp-empty-row">${escapeHtml(emptyText)}</td></tr>`;
    } else {
      tbody.innerHTML = pageRows
        .map((r) => {
          if (typeof r?.html === 'string' && r.html.trim()) return r.html;
          const cls = r?.className ? ` class="${escapeHtml(String(r.className))}"` : '';
          const attrs = attrsToString(r?.attrs);
          const cells = (r?.cells || []).map((c) => `<td>${c ?? ''}</td>`).join('');
          const after = typeof r?.afterHtml === 'string' ? r.afterHtml : '';
          return `<tr${cls}${attrs}>${cells}</tr>${after}`;
        })
        .join('');
    }

    if (infoEl) {
      infoEl.textContent = total ? `Mostrando ${start + 1} a ${end} de ${total} registros` : 'Mostrando 0 de 0 registros';
    }
    if (pageEl) pageEl.textContent = `${state.page} / ${pages}`;
    if (prevBtn) prevBtn.disabled = state.page <= 1;
    if (nextBtn) nextBtn.disabled = state.page >= pages;

    onPageRendered?.({
      pageRows,
      total,
      page: state.page,
      pages,
      start: total ? start + 1 : 0,
      end
    });
  }

  prevBtn?.addEventListener('click', () => {
    if (state.page <= 1) return;
    state.page -= 1;
    renderPage();
  });

  nextBtn?.addEventListener('click', () => {
    const pages = Math.max(1, Math.ceil(state.rows.length / state.pageSize));
    if (state.page >= pages) return;
    state.page += 1;
    renderPage();
  });

  top?.querySelector('[data-role="export-csv"]')?.addEventListener('click', () => {
    const rows = getAllExportRows();
    const txt = makeDelimited([exportHeaders, ...rows], ';');
    downloadBlob(`${fileName}.csv`, `\ufeff${txt}`, 'text/csv;charset=utf-8;');
  });

  top?.querySelector('[data-role="export-xls"]')?.addEventListener('click', () => {
    const rows = getAllExportRows();
    const txt = makeDelimited([exportHeaders, ...rows], '\t');
    downloadBlob(`${fileName}.xls`, `\ufeff${txt}`, 'application/vnd.ms-excel;charset=utf-8;');
  });

  top?.querySelector('[data-role="export-pdf"]')?.addEventListener('click', () => {
    exportPdfLike(fileName, exportHeaders, getAllExportRows());
  });

  return {
    setRows(rows = []) {
      state.rows = Array.isArray(rows) ? rows : [];
      state.page = clampPage(state.page, state.rows.length, state.pageSize);
      renderPage();
    },
    refresh() {
      renderPage();
    },
    resetPage() {
      state.page = 1;
      renderPage();
    },
    getState() {
      return { ...state };
    },
    getVisibleRows() {
      const start = (state.page - 1) * state.pageSize;
      return state.rows.slice(start, start + state.pageSize);
    },
    getAllRows() {
      return state.rows.slice();
    }
  };
}
