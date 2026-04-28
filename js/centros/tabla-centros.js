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
  rojo: 'Suspendida',
  naranja: 'Alerta activa',
  amarillo: 'En seguimiento',
  verde: 'Sin alertas',
  gris: 'Sin datos',
};

const SANITARIO_ORDER = ['rojo', 'naranja', 'amarillo', 'verde', 'gris'];
const ESTADO_AREA_ORDER = ['Abierta', 'Suspendida', 'Cerrada', 'Inactiva', 'Eliminada', 'Sin estado'];

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
  vinculoArea: '',
  quick: '',
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

function normalizeEstadoArea(value) {
  const raw = String(value || '').trim();
  return raw || 'Sin estado';
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
  return SANITARIO_LABELS[estado] ? estado : 'gris';
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

function renderAreaCell(areaPSMB) {
  if (!areaPSMB) return '<span class="centro-empty">Sin area PSMB</span>';
  return `
    <div class="centro-area-cell">
      <div class="centro-area-main">${esc(areaPSMB)}</div>
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
  return `
    <div class="centro-state-cell">
      <span class="centro-status-badge ${esc(key)}">${esc(label)}</span>
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

function wireExportToolbar() {
  const mapping = [
    ['btnExportCopy', '.buttons-copy'],
    ['btnExportCsv', '.buttons-csv'],
    ['btnExportExcel', '.buttons-excel'],
    ['btnExportPdf', '.buttons-pdf'],
  ];

  mapping.forEach(([id, btnSelector]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.onclick = () => { if (api) api.button(btnSelector).trigger(); };
  });
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

  const estadosArea = Array.from(new Set((Estado.centros || [])
    .map((c) => normalizeEstadoArea(c?.sanitario?.estadoSernapesca || c?.estadoAreaSernapesca))
    .filter(Boolean)))
    .sort((a, b) => {
      const ia = ESTADO_AREA_ORDER.indexOf(a);
      const ib = ESTADO_AREA_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b, 'es');
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  setOptions(document.getElementById('filtroEstadoArea'), estadosArea, 'Todos los estados de area');

  const estadosSan = Array.from(new Set((Estado.centros || [])
    .map((c) => normalizeSanitarioEstado(c?.sanitario?.estado))
    .filter(Boolean)))
    .sort((a, b) => SANITARIO_ORDER.indexOf(a) - SANITARIO_ORDER.indexOf(b))
    .map((key) => ({ key, label: SANITARIO_LABELS[key] }));

  const selSan = document.getElementById('filtroEstadoSanitario');
  if (selSan) {
    const current = selSan.value;
    selSan.innerHTML = '<option value="">Todos los estados sanitarios</option>' + estadosSan.map(({ key, label }) => `<option value="${esc(key)}">${esc(label)}</option>`).join('');
    if (current && estadosSan.some((item) => item.key === current)) selSan.value = current;
  }
}

function syncQuickFilterButtons() {
  document.querySelectorAll('#centroQuickFilters .centro-filter-chip').forEach((btn) => {
    btn.classList.toggle('is-active', (btn.dataset.quickFilter || '') === filterState.quick);
  });
}

function matchesQuickFilter(row) {
  switch (filterState.quick) {
    case 'alerta':
      return String(row[COL.ALERT_RAW]) === '1';
    case 'seguimiento':
      return String(row[COL.EST_SAN_RAW]) === 'amarillo';
    case 'suspendida': {
      const estadoArea = String(row[COL.EST_AREA_RAW] || '').toLowerCase();
      return estadoArea === 'suspendida' || String(row[COL.EST_SAN_RAW]) === 'rojo';
    }
    case 'sin-area':
      return !String(row[COL.AREA_RAW] || '').trim();
    default:
      return true;
  }
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
    const areaRaw = String(row[COL.AREA_RAW] || '').trim();
    const codigoAreaRaw = String(row[COL.CODAREA_RAW] || '').trim();

    if (filterState.comuna && comuna !== filterState.comuna) return false;
    if (filterState.estadoArea && estadoArea !== filterState.estadoArea) return false;
    if (filterState.estadoSanitario && estadoSanitario !== filterState.estadoSanitario) return false;
    if (filterState.vinculoArea === 'con-area' && !areaRaw) return false;
    if (filterState.vinculoArea === 'sin-area' && areaRaw) return false;
    if (filterState.vinculoArea === 'con-codigo-area' && !codigoAreaRaw) return false;
    if (filterState.vinculoArea === 'sin-codigo-area' && codigoAreaRaw) return false;

    return matchesQuickFilter(row);
  };

  dtExt.push(window.__centrosTableFilterFn);
}

function wireExternalSearch() {
  $buscador = document.getElementById('buscarProveedor');
  if (!$buscador) return;
  $buscador.addEventListener('input', () => {
    const q = ($buscador.value || '').trim();
    api.search(q).draw();
  });
}

function resetFilterState() {
  filterState.comuna = '';
  filterState.estadoArea = '';
  filterState.estadoSanitario = '';
  filterState.vinculoArea = '';
  filterState.quick = '';
}

function wireFilterEvents() {
  const comunaSelect = document.getElementById('filtroComuna');
  const estadoAreaSelect = document.getElementById('filtroEstadoArea');
  const estadoSanitarioSelect = document.getElementById('filtroEstadoSanitario');
  const vinculoAreaSelect = document.getElementById('filtroVinculoArea');

  comunaSelect?.addEventListener('change', () => {
    filterState.comuna = comunaSelect.value || '';
    api.draw();
  });

  estadoAreaSelect?.addEventListener('change', () => {
    filterState.estadoArea = estadoAreaSelect.value || '';
    api.draw();
  });

  estadoSanitarioSelect?.addEventListener('change', () => {
    filterState.estadoSanitario = estadoSanitarioSelect.value || '';
    api.draw();
  });

  vinculoAreaSelect?.addEventListener('change', () => {
    filterState.vinculoArea = vinculoAreaSelect.value || '';
    api.draw();
  });

  document.querySelectorAll('#centroQuickFilters .centro-filter-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      filterState.quick = btn.dataset.quickFilter || '';
      syncQuickFilterButtons();
      api.draw();
    });
  });

  const btnLimpiar = document.getElementById('btnLimpiarFiltros');
  if (btnLimpiar) {
    btnLimpiar.onclick = () => {
      resetFilterState();
      if (comunaSelect) comunaSelect.value = '';
      if (estadoAreaSelect) estadoAreaSelect.value = '';
      if (estadoSanitarioSelect) estadoSanitarioSelect.value = '';
      if (vinculoAreaSelect) vinculoAreaSelect.value = '';
      if ($buscador) $buscador.value = '';
      syncQuickFilterButtons();
      api.search('').draw();
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

  attachCustomFilters();

  Estado.table = $t.DataTable({
    dom: 'Brtip',
    autoWidth: false,
    buttons: [
      { extend: 'copyHtml5', footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } },
      { extend: 'csvHtml5', footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } },
      { extend: 'excelHtml5', footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } },
      { extend: 'pdfHtml5', footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } },
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
    syncQuickFilterButtons();

    const rows = (Estado.centros || []).map((centro, i) => {
      const proveedor = toTitleCase(centro.proveedor) || '-';
      const comuna = toTitleCase(centro.comuna) || '-';
      const codigo = centro.code || '-';
      const codigoArea = centro.codigoArea || centro?.detalles?.codigoArea || '';
      const areaPSMB = centro?.sanitario?.areaPSMB || centro.areaPSMB || '';
      const estadoArea = normalizeEstadoArea(centro?.sanitario?.estadoSernapesca || centro.estadoAreaSernapesca || '');
      const estadoSanitario = normalizeSanitarioEstado(centro?.sanitario?.estado);
      const hectRaw = toNum(centro.hectareas);
      const tonsRaw = toNum(centro.tonsMax ?? centro.tons ?? centro?.detalles?.tonsMax);
      const alertRaw = estadoSanitario === 'naranja' ? 1 : 0;

      return [
        renderProveedorCell({ proveedor, comuna }),
        renderCodeCell(codigo),
        renderAreaCell(areaPSMB),
        renderEstadoAreaCell(estadoArea, codigoArea),
        renderEstadoSanitarioCell(estadoSanitario, Boolean(areaPSMB)),
        fmt2.format(hectRaw),
        renderActionMenu(i),
        hectRaw,
        tonsRaw,
        comuna,
        estadoArea,
        estadoSanitario,
        areaPSMB,
        codigoArea,
        alertRaw,
      ];
    });

    api.clear().rows.add(rows).draw();

    if (tabMapaActiva?.()) await renderMapaAlways(true);
  } catch (e) {
    console.error('Error cargando centros:', e);
    toast('Error cargando centros', { variant: 'error' });
  }
}
