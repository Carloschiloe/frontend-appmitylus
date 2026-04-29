import { Estado } from '../core/estado.js';
import { getCentrosAll } from '../core/centros-repo.js';
import { registerTablaCentrosEventos } from './eventos-centros.js';
import { tabMapaActiva } from '../core/utilidades-app.js';
import { renderMapaAlways } from '../mapas/control-mapa.js';
import { toast } from '../ui/toast.js';

const fmt2 = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[c]));
const toTitleCase = (str) => (str || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

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

const SANITARIO_ORDER = ['ok', 'alerta', 'bloqueada', 'sin_datos'];
const ESTADO_AREA_ORDER = ['Abierta', 'Inactiva', 'Eliminada', 'Sin estado'];

const toNum = (v) => {
  if (v === '' || v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/\s/g, '');
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

let $t;
let api;
let $buscador;

const filterState = {
  comuna: '',
  estadoArea: '',
  estadoSanitario: '',
};

const COL = {
  PROV: 0,
  CODE: 1,
  AREA: 2,
  EST_AREA: 3,
  EST_SAN: 4,
  HECT_FMT: 5,
  ACC: 6,
  HECT_RAW: 7,
  TONS_RAW: 8,
  COMUNA_RAW: 9,
  EST_AREA_RAW: 10,
  EST_SAN_RAW: 11,
  AREA_RAW: 12,
  CODAREA_RAW: 13,
  ALERT_RAW: 14,
};

const EXPORTABLE_COLUMNS = [COL.PROV, COL.CODE, COL.AREA, COL.EST_AREA, COL.EST_SAN, COL.HECT_FMT];

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeEstadoArea(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'Sin estado';
  if (['abierta', 'activo', 'activa', 'vigente'].includes(raw)) return 'Abierta';
  if (['cerrada', 'suspendida', 'bloqueada'].includes(raw)) return 'Cerrada';
  if (['inactiva', 'inactivo'].includes(raw)) return 'Inactiva';
  if (['eliminada', 'eliminado'].includes(raw)) return 'Eliminada';
  return 'Sin estado';
}

function normalizeEstadoAreaClass(value) {
  return normalizeEstadoArea(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function normalizeSanitarioEstado(value) {
  const estado = String(value || '').trim().toLowerCase();
  if (estado === 'rojo') return 'bloqueada';
  if (estado === 'naranja' || estado === 'amarillo') return 'alerta';
  if (estado === 'verde') return 'ok';
  if (!estado || estado === 'gris') return 'sin_datos';
  return SANITARIO_LABELS[estado] ? estado : 'sin_datos';
}

function getSanitaryState(centro) {
  const areaState = normalizeEstadoArea(centro?.estadoAreaSernapesca || centro?.sanitario?.estadoSernapesca || '');
  if (areaState === 'Cerrada') return 'bloqueada';
  return normalizeSanitarioEstado(centro?.sanitario?.estado);
}

function renderProveedorCell(centro) {
  return `
    <div class="centro-provider-cell">
      <div class="centro-provider-main">${esc(toTitleCase(centro.proveedor) || '-')}</div>
      <div class="centro-provider-sub">${esc(toTitleCase(centro.comuna) || 'Sin comuna')}</div>
    </div>`;
}

function renderCodeCell(code) {
  return `<span class="centro-code-pill">${esc(code || '-')}</span>`;
}

function renderAreaCell(areaPSMB, delimitacion) {
  if (!areaPSMB) return '<span class="centro-empty">Sin area PSMB</span>';
  const delim = String(delimitacion || '').trim();
  return `
    <div class="centro-area-cell">
      <div class="centro-area-main">${esc(areaPSMB)}</div>
      ${delim ? `<div class="centro-state-meta">Delimitacion ${esc(delim)}</div>` : ''}
    </div>`;
}

function renderEstadoAreaCell(estadoArea, codigoArea) {
  const label = normalizeEstadoArea(estadoArea);
  const codigo = String(codigoArea || '').trim();
  return `
    <div class="centro-state-cell">
      <span class="centro-status-badge ${esc(normalizeEstadoAreaClass(label))}">${esc(label)}</span>
      <div class="centro-state-meta">${codigo ? `Codigo area ${esc(codigo)}` : '<span class="centro-empty">Sin codigo de area</span>'}</div>
    </div>`;
}

function renderEstadoSanitarioCell(estado, linked) {
  const key = normalizeSanitarioEstado(estado);
  const label = SANITARIO_LABELS[key];
  const tone = SANITARIO_TONE[key] || 'gris';
  return `
    <div class="centro-state-cell">
      <span class="centro-status-badge ${esc(tone)}">${esc(label)}</span>
      <div class="centro-state-meta">${linked ? 'Con vinculo PSMB' : '<span class="centro-empty">Sin vinculo PSMB</span>'}</div>
    </div>`;
}

function renderActionMenu(idx) {
  return `
    <div class="centro-row-menu">
      <button type="button" class="centro-row-menu-toggle" data-idx="${idx}" aria-label="Abrir acciones" title="Acciones">
        <i class="bi bi-three-dots"></i>
      </button>
      <div class="centro-row-menu-panel" role="menu">
        <button type="button" class="centro-row-menu-item btn-coords" data-idx="${idx}">
          <i class="bi bi-eye"></i> Ver detalle
        </button>
        <button type="button" class="centro-row-menu-item btn-view-on-map" data-idx="${idx}">
          <i class="bi bi-geo-alt"></i> Ver en mapa
        </button>
        <button type="button" class="centro-row-menu-item editar-centro" data-idx="${idx}">
          <i class="bi bi-pencil"></i> Editar
        </button>
        <button type="button" class="centro-row-menu-item eliminar-centro danger" data-idx="${idx}">
          <i class="bi bi-trash"></i> Eliminar
        </button>
      </div>
    </div>`;
}

function centroMatchesFilters(centro) {
  const comuna = toTitleCase(centro.comuna || '').trim();
  const areaPSMB = centro?.sanitario?.areaPSMB || centro.areaPSMB || '';
  const codigoArea = centro.codigoArea || centro?.detalles?.codigoArea || '';
  const estadoArea = normalizeEstadoArea(centro?.estadoAreaSernapesca || centro?.sanitario?.estadoSernapesca || '');
  const estadoSanitario = getSanitaryState(centro);

  if (filterState.comuna && comuna !== filterState.comuna) return false;
  if (filterState.estadoArea && estadoArea !== filterState.estadoArea) return false;
  if (filterState.estadoSanitario && estadoSanitario !== filterState.estadoSanitario) return false;

  const term = normalizeSearchText($buscador?.value || '');
  if (!term) return true;

  const haystack = normalizeSearchText([
    centro.proveedor,
    centro.comuna,
    centro.code,
    areaPSMB,
    codigoArea,
    estadoArea,
    SANITARIO_LABELS[estadoSanitario] || estadoSanitario,
  ].join(' '));

  return haystack.includes(term);
}

function buildRowFromCentro(centro, idx) {
  const proveedor = toTitleCase(centro.proveedor) || '-';
  const comuna = toTitleCase(centro.comuna) || '-';
  const codigo = centro.code || '-';
  const codigoArea = centro.codigoArea || centro?.detalles?.codigoArea || '';
  const areaPSMB = centro?.sanitario?.areaPSMB || centro.areaPSMB || '';
  const delimitacion = centro?.sanitario?.delimitacion || '';
  const estadoArea = normalizeEstadoArea(centro?.estadoAreaSernapesca || centro?.sanitario?.estadoSernapesca || '');
  const estadoSanitario = getSanitaryState(centro);
  const hectRaw = toNum(centro.hectareas);
  const tonsRaw = toNum(centro.tonsMax ?? centro.tons ?? centro?.detalles?.tonsMax);
  const alertRaw = estadoSanitario === 'alerta' ? 1 : 0;

  return [
    renderProveedorCell({ proveedor, comuna }),
    renderCodeCell(codigo),
    renderAreaCell(areaPSMB, delimitacion),
    renderEstadoAreaCell(estadoArea, codigoArea),
    renderEstadoSanitarioCell(estadoSanitario, Boolean(areaPSMB)),
    fmt2.format(hectRaw),
    renderActionMenu(idx),
    hectRaw,
    tonsRaw,
    comuna,
    estadoArea,
    estadoSanitario,
    areaPSMB,
    codigoArea,
    alertRaw,
  ];
}

function applyCurrentFilters() {
  if (!api) return;
  const rows = (Estado.centros || [])
    .map((centro, idx) => ({ centro, idx }))
    .filter(({ centro }) => centroMatchesFilters(centro))
    .map(({ centro, idx }) => buildRowFromCentro(centro, idx));

  api.clear().rows.add(rows).draw();
  renderActiveFilters();
}

function wireExportToolbar() {
  const mapping = [
    ['btnExportCopy', '.buttons-copy'],
    ['btnExportCsv', '.buttons-csv'],
    ['btnExportExcel', '.buttons-excel'],
  ];

  mapping.forEach(([id, btnSelector]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.onclick = () => { if (api) api.button(btnSelector).trigger(); };
  });

  const pdfBtn = document.getElementById('btnExportPdf');
  if (pdfBtn) {
    pdfBtn.onclick = () => exportCentrosPdf();
  }
}

function htmlToExportText(value) {
  const html = String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|tr|h\d)>/gi, '\n');
  const div = document.createElement('div');
  div.innerHTML = html;
  return String(div.textContent || div.innerText || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function getExportSummary() {
  const parts = [];
  const searchTerm = String($buscador?.value || '').trim();
  if (searchTerm) parts.push(`Buscar: ${searchTerm}`);
  if (filterState.comuna) parts.push(`Comuna: ${filterState.comuna}`);
  if (filterState.estadoSanitario) parts.push(`Sanitario: ${SANITARIO_LABELS[filterState.estadoSanitario] || filterState.estadoSanitario}`);
  if (filterState.estadoArea) parts.push(`Estado área: ${filterState.estadoArea}`);
  return parts.length ? parts.join(' · ') : 'Sin filtros aplicados';
}

function getRowsExportedCount() {
  return api ? api.rows({ search: 'applied' }).count() : 0;
}

function buildExportOptions() {
  return {
    columns: EXPORTABLE_COLUMNS,
    modifier: { search: 'applied', order: 'applied', page: 'all' },
    format: {
      header: (data) => htmlToExportText(data),
      body: (data) => htmlToExportText(data),
      footer: (data) => htmlToExportText(data),
    },
  };
}

function buildPdfRows() {
  if (!api) return [];
  const rows = api.rows({ search: 'applied', order: 'applied' }).data().toArray();
  return rows.map((row) => ([
    { text: htmlToExportText(row[COL.PROV]) || '-', margin: [0, 1, 0, 1] },
    { text: htmlToExportText(row[COL.CODE]) || '-', margin: [0, 1, 0, 1] },
    { text: htmlToExportText(row[COL.AREA]) || 'Sin area PSMB', margin: [0, 1, 0, 1] },
    { text: htmlToExportText(row[COL.EST_AREA]) || 'Sin estado', margin: [0, 1, 0, 1] },
    { text: htmlToExportText(row[COL.EST_SAN]) || 'Sin datos', margin: [0, 1, 0, 1] },
    { text: htmlToExportText(row[COL.HECT_FMT]) || '0,00', alignment: 'right', margin: [0, 1, 0, 1] },
  ]));
}

function customizePdf(doc) {
  const corporatePrimary = '#0f766e';
  const corporateDark = '#1e293b';
  const muted = '#64748b';
  const exportedRows = getRowsExportedCount();
  const summary = getExportSummary();
  const generatedAt = new Date().toLocaleString('es-CL');

  doc.pageOrientation = 'landscape';
  doc.pageMargins = [28, 34, 28, 28];
  doc.defaultStyle = { fontSize: 9, color: corporateDark };
  doc.content[0] = {
    text: 'Directorio de Centros — AppMMPP',
    fontSize: 22,
    bold: true,
    color: corporateDark,
    margin: [0, 0, 0, 6],
  };
  doc.content.splice(1, 0, {
    columns: [
      {
        width: '*',
        stack: [
          { text: `Filtros: ${summary}`, fontSize: 9, color: muted },
          { text: `Registros exportados: ${exportedRows}`, fontSize: 9, color: muted, margin: [0, 2, 0, 0] },
        ],
      },
      {
        width: 'auto',
        text: `Generado: ${generatedAt}`,
        fontSize: 9,
        color: muted,
        alignment: 'right',
      },
    ],
    margin: [0, 0, 0, 12],
  });

  const tableNode = doc.content.find((item) => item.table);
  if (tableNode) {
    tableNode.table.headerRows = 1;
    tableNode.layout = {
      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0 : 0.6),
      vLineWidth: () => 0,
      hLineColor: () => '#dbe3ef',
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 7,
      paddingBottom: () => 7,
      fillColor: (rowIndex) => (rowIndex === 0 ? corporateDark : rowIndex % 2 === 0 ? '#f8fafc' : null),
    };
    tableNode.table.widths = ['*', 72, 92, 92, 92, 60];
    tableNode.margin = [0, 2, 0, 0];
  }

  doc.styles = {
    ...(doc.styles || {}),
    tableHeader: {
      ...(doc.styles?.tableHeader || {}),
      bold: true,
      fontSize: 10,
      color: '#ffffff',
      fillColor: corporateDark,
      alignment: 'left',
    },
    tableBodyEven: {
      ...(doc.styles?.tableBodyEven || {}),
      fontSize: 9,
      color: corporateDark,
    },
    tableBodyOdd: {
      ...(doc.styles?.tableBodyOdd || {}),
      fontSize: 9,
      color: corporateDark,
    },
  };

  doc.footer = (currentPage, pageCount) => ({
    margin: [28, 0, 28, 12],
    columns: [
      { text: 'AppMMPP · Directorio de Centros', color: muted, fontSize: 8 },
      { text: `${currentPage} / ${pageCount}`, alignment: 'right', color: muted, fontSize: 8 },
    ],
  });
}

function exportCentrosPdf() {
  if (!api) return;
  const pdfMake = window.pdfMake;
  if (!pdfMake?.createPdf) {
    toast('No se pudo inicializar la exportacion PDF', { variant: 'error' });
    return;
  }

  const bodyRows = buildPdfRows();
  if (!bodyRows.length) {
    toast('No hay registros para exportar en PDF', { variant: 'info' });
    return;
  }

  const headerRow = [
    { text: 'Proveedor', style: 'tableHeader' },
    { text: 'Codigo de centro', style: 'tableHeader' },
    { text: 'Area PSMB', style: 'tableHeader' },
    { text: 'Estado area', style: 'tableHeader' },
    { text: 'Estado sanitario', style: 'tableHeader' },
    { text: 'Hectareas', style: 'tableHeader', alignment: 'right' },
  ];

  const doc = {
    pageOrientation: 'landscape',
    pageMargins: [28, 34, 28, 28],
    defaultStyle: { fontSize: 9, color: '#1e293b' },
    styles: {
      title: {
        fontSize: 22,
        bold: true,
        color: '#1e293b',
      },
      meta: {
        fontSize: 9,
        color: '#64748b',
      },
      tableHeader: {
        bold: true,
        fontSize: 10,
        color: '#ffffff',
        fillColor: '#1e293b',
        alignment: 'left',
        margin: [0, 4, 0, 4],
      },
    },
    content: [
      {
        text: 'Directorio de Centros — AppMMPP',
        style: 'title',
        margin: [0, 0, 0, 6],
      },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: `Filtros: ${getExportSummary()}`, style: 'meta' },
              { text: `Registros exportados: ${bodyRows.length}`, style: 'meta', margin: [0, 2, 0, 0] },
            ],
          },
          {
            width: 'auto',
            text: `Generado: ${new Date().toLocaleString('es-CL')}`,
            style: 'meta',
            alignment: 'right',
          },
        ],
        margin: [0, 0, 0, 12],
      },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          keepWithHeaderRows: 1,
          widths: ['*', 78, 92, 96, 108, 62],
          body: [
            headerRow,
            ...bodyRows,
          ],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 2, 0, 0],
      },
    ],
    footer: (currentPage, pageCount) => ({
      margin: [28, 0, 28, 12],
      columns: [
        { text: 'AppMMPP · Directorio de Centros', color: '#64748b', fontSize: 8 },
        { text: `${currentPage} / ${pageCount}`, alignment: 'right', color: '#64748b', fontSize: 8 },
      ],
    }),
  };

  pdfMake.createPdf(doc).download('directorio-centros-appmmpp.pdf');
}

function updateKpisYFooter() {
  if (!api) return;
  const rows = api.rows({ search: 'applied' }).data();
  let totalHa = 0;
  let totalTons = 0;
  const comunas = new Set();

  rows.each((row) => {
    totalHa += Number(row[COL.HECT_RAW]) || 0;
    totalTons += Number(row[COL.TONS_RAW]) || 0;
    const comuna = String(row[COL.COMUNA_RAW] || '').trim().toLowerCase();
    if (comuna) comunas.add(comuna);
  });

  const kCent = document.getElementById('kpiCentros');
  const kHa = document.getElementById('kpiHect');
  const kCom = document.getElementById('kpiComunas');
  const kTons = document.getElementById('kpiTonsMax');
  if (kCent) kCent.textContent = String(rows.length);
  if (kHa) kHa.textContent = fmt2.format(totalHa);
  if (kCom) kCom.textContent = String(comunas.size);
  if (kTons) kTons.textContent = fmt2.format(totalTons);

  const totalCentrosEl = document.getElementById('totalCentros');
  const totalHectEl = document.getElementById('totalHect');
  if (totalCentrosEl) totalCentrosEl.textContent = String(rows.length);
  if (totalHectEl) totalHectEl.textContent = fmt2.format(totalHa);
}

function setOptions(select, options, placeholder) {
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>` + options.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
  if (current && options.includes(current)) select.value = current;
}

function populateFilterOptions() {
  const comunas = Array.from(new Set((Estado.centros || []).map((c) => toTitleCase(c.comuna).trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'es'));
  setOptions(document.getElementById('filtroComuna'), comunas, 'Todas las comunas');

}

function attachCustomFilters() {
  const dtExt = window.$.fn.dataTable.ext.search;
  if (window.__centrosTableFilterFn) {
    const idx = dtExt.indexOf(window.__centrosTableFilterFn);
    if (idx >= 0) dtExt.splice(idx, 1);
  }

  window.__centrosTableFilterFn = (settings, data, dataIndex, rowData) => {
    if (settings.nTable?.id !== 'centrosTable') return true;

    const row = Array.isArray(rowData) ? rowData : data;
    const comuna = String(row[COL.COMUNA_RAW] || '').trim();
    const estadoArea = normalizeEstadoArea(String(row[COL.EST_AREA_RAW] || '').trim());
    const estadoSanitario = normalizeSanitarioEstado(String(row[COL.EST_SAN_RAW] || '').trim());
    if (filterState.comuna && comuna !== filterState.comuna) return false;
    if (filterState.estadoArea && estadoArea !== filterState.estadoArea) return false;
    if (filterState.estadoSanitario && estadoSanitario !== filterState.estadoSanitario) return false;

    return true;
  };

  dtExt.push(window.__centrosTableFilterFn);
}

function wireExternalSearch() {
  $buscador = document.getElementById('buscarProveedor');
  if (!$buscador) return;
  $buscador.addEventListener('input', () => {
    applyCurrentFilters();
  });
}

function resetFilterState() {
  filterState.comuna = '';
  filterState.estadoArea = '';
  filterState.estadoSanitario = '';
}

function syncChipGroup(selector, activeValue, dataAttr) {
  document.querySelectorAll(selector).forEach((btn) => {
    btn.classList.toggle('is-active', (btn.dataset[dataAttr] || '') === activeValue);
  });
}

function syncFilterButtons() {
  syncChipGroup('#centroSanitarioFilters .centro-filter-chip', filterState.estadoSanitario, 'sanitaryFilter');
  syncChipGroup('#centroAreaFilters .centro-filter-chip', filterState.estadoArea, 'areaFilter');
  syncFilterTriggers();
}

function setPanelOpen(panelId, shouldOpen) {
  const panel = document.getElementById(panelId);
  const trigger = document.querySelector(`[aria-controls="${panelId}"]`);
  if (!panel || !trigger) return;
  const filterBar = trigger.closest('.am-filter-bar');
  panel.hidden = !shouldOpen;
  trigger.classList.toggle('is-open', shouldOpen);
  trigger.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  if (filterBar) {
    const anyOpen = Array.from(filterBar.querySelectorAll('.centro-filter-popover')).some((popover) => !popover.hidden);
    filterBar.classList.toggle('has-open-panel', anyOpen);
  }
}

function togglePanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const willOpen = panel.hidden;
  ['panelSanitarioFilters', 'panelAreaFilters'].forEach((id) => {
    setPanelOpen(id, id === panelId ? willOpen : false);
  });
}

function syncFilterTriggers() {
  const sanitaryText = document.getElementById('centroSanitarioTriggerText');
  if (sanitaryText) sanitaryText.textContent = filterState.estadoSanitario
    ? `Sanitario: ${SANITARIO_LABELS[filterState.estadoSanitario] || filterState.estadoSanitario}`
    : 'Sanitario';

  const areaText = document.getElementById('centroAreaTriggerText');
  if (areaText) areaText.textContent = filterState.estadoArea
    ? `Estado area: ${filterState.estadoArea}`
    : 'Estado area';

  const sanitaryTrigger = document.getElementById('btnToggleSanitarioFilters');
  sanitaryTrigger?.classList.toggle('is-active', Boolean(filterState.estadoSanitario));
  const areaTrigger = document.getElementById('btnToggleAreaFilters');
  areaTrigger?.classList.toggle('is-active', Boolean(filterState.estadoArea));
}

function renderActiveFilters() {
  syncFilterTriggers();
}

function wireFilterEvents() {
  const comunaSelect = document.getElementById('filtroComuna');
  const btnToggleSanitario = document.getElementById('btnToggleSanitarioFilters');
  const btnToggleArea = document.getElementById('btnToggleAreaFilters');

  comunaSelect?.addEventListener('change', () => {
    filterState.comuna = comunaSelect.value || '';
    applyCurrentFilters();
  });

  document.querySelectorAll('#centroSanitarioFilters .centro-filter-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      filterState.estadoSanitario = btn.dataset.sanitaryFilter || '';
      syncFilterButtons();
      applyCurrentFilters();
    });
  });

  document.querySelectorAll('#centroAreaFilters .centro-filter-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      filterState.estadoArea = btn.dataset.areaFilter || '';
      syncFilterButtons();
      applyCurrentFilters();
    });
  });

  btnToggleSanitario?.addEventListener('click', () => togglePanel('panelSanitarioFilters'));
  btnToggleArea?.addEventListener('click', () => togglePanel('panelAreaFilters'));

  document.querySelectorAll('[data-close-panel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setPanelOpen(btn.dataset.closePanel || '', false);
    });
  });

  document.querySelectorAll('[data-clear-panel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.clearPanel || '';
      if (type === 'sanitario') filterState.estadoSanitario = '';
      if (type === 'area') filterState.estadoArea = '';
      syncFilterButtons();
      applyCurrentFilters();
    });
  });

  const btnLimpiar = document.getElementById('btnLimpiarFiltros');
  if (btnLimpiar) {
    btnLimpiar.onclick = () => {
      resetFilterState();
      if (comunaSelect) comunaSelect.value = '';
      if ($buscador) $buscador.value = '';
      setPanelOpen('panelSanitarioFilters', false);
      setPanelOpen('panelAreaFilters', false);
      syncFilterButtons();
      applyCurrentFilters();
    };
  }
}

export function initTablaCentros() {
  const jq = window.$;
  $t = jq('#centrosTable');
  if (!$t.length) {
    console.error('No se encontro #centrosTable');
    return;
  }

  Estado.table = $t.DataTable({
    dom: 'Brtip',
    autoWidth: false,
    buttons: [
      { extend: 'copyHtml5', footer: false, title: null, exportOptions: buildExportOptions() },
      { extend: 'csvHtml5', footer: false, title: 'directorio-centros-appmmpp', exportOptions: buildExportOptions() },
      { extend: 'excelHtml5', footer: false, title: 'directorio-centros-appmmpp', exportOptions: buildExportOptions() },
    ],
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json' },
    columnDefs: [
      { targets: [COL.HECT_FMT], className: 'dt-right' },
      { targets: [COL.ACC], className: 'centro-col-actions', orderable: false, searchable: false },
      { targets: [COL.HECT_RAW, COL.TONS_RAW, COL.EST_AREA_RAW, COL.EST_SAN_RAW, COL.ALERT_RAW], visible: false, searchable: false },
      { targets: [COL.COMUNA_RAW, COL.AREA_RAW, COL.CODAREA_RAW], visible: false },
    ],
  });

  api = Estado.table;
  $t.on('draw.dt', updateKpisYFooter);

  registerTablaCentrosEventos();
  wireExternalSearch();
  wireExportToolbar();
  wireFilterEvents();
  syncFilterButtons();
  renderActiveFilters();

  window.$('#centrosTable_filter').hide();
}

export async function loadCentros(data) {
  if (!api) {
    console.warn('DataTable no inicializada aun');
    return;
  }

  try {
    Estado.centros = Array.isArray(data) ? data : await getCentrosAll();
    populateFilterOptions();
    syncFilterButtons();
    renderActiveFilters();

    applyCurrentFilters();

    if (tabMapaActiva?.()) await renderMapaAlways(true);
  } catch (e) {
    console.error('Error cargando centros:', e);
    toast('Error cargando centros', { variant: 'error' });
  }
}
