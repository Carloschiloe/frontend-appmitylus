import { state } from './state.js';
import { createLocalTableController } from './local-table.js';
import { debounce, escapeHtml, getModalInstance } from './ui-common.js';
import { listMuestreos, getMuestreosResumen, deleteMuestreo } from './muestreo-api.js';
import { toast } from '../../ui/toast.js';

const PAGE_SIZE = 10;
const esc = escapeHtml;

const RUTA_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'abastecimiento', label: 'Abastecimiento' },
  { value: 'calidad', label: 'Calidad' }
];

const CAT_LABELS = {
  procesable: 'Procesable',
  cholga: 'Cholga',
  quebrado: 'Quebrado',
  malton: 'Malton',
  semilla: 'Semilla (< 4,5 cm)',
  picoroco: 'Picoroco y/o colpa',
  basura: 'Basura',
  esponja_severa: 'Esponja severa',
  anemonas: 'Anemonas',
  valvas_vacias: 'Valvas vacias',
  u_muertas: 'U muertas',
  barbilla: 'Barbilla',
  cogotina: 'Cogotina',
  trizados: 'Trizados',
  esponja_leve: 'Esponja leve',
  sarro: 'Sarro'
};

const RECHAZO_DESC_KEYS = [
  'cholga',
  'quebrado',
  'malton',
  'semilla',
  'picoroco',
  'basura',
  'esponja_severa',
  'anemonas',
  'valvas_vacias',
  'u_muertas',
  'barbilla'
];

const DEFECTO_KEYS = ['cogotina', 'trizados', 'esponja_leve', 'sarro'];

const norm = (v = '') => String(v || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const n2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTHS_SH = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function toDateSafe(v) {
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoWeek(d) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (tmp.getUTCDay() + 6) % 7;
  tmp.setUTCDate(tmp.getUTCDate() - day + 3);
  const jan4 = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((tmp - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}

function getWeekRange(offset) {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0=Lun … 6=Dom
  const mon = new Date(now);
  mon.setHours(0, 0, 0, 0);
  mon.setDate(now.getDate() - day + offset * 7);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { from: mon, to: sun };
}

function getMonthRange(offset) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1, 0, 0, 0, 0);
  const to = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

function getPeriodCut(period) {
  // Retained for backward compatibility if needed, but we'll use ranges now.
  return null;
}

function fmtDate(v) {
  const d = toDateSafe(v);
  if (!d) return '-';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function fmtNum(v, digits = 2) {
  return (Number(v) || 0).toLocaleString('es-CL', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value ?? '');
}

function setHtmlOptions(selectEl, values, placeholder = 'Todos') {
  if (!selectEl) return;
  const prev = String(selectEl.value || '');
  const opts = (values || [])
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'es'));
  selectEl.innerHTML = `<option value="">${esc(placeholder)}</option>${opts
    .map((v) => `<option value="${esc(v)}">${esc(v)}</option>`)
    .join('')}`;
  if (opts.includes(prev)) selectEl.value = prev;
}

function buildScopeFromRow(row = {}) {
  if (row.visitaId) return { visitaId: String(row.visitaId) };
  if (row.proveedorKey) return { proveedorKey: String(row.proveedorKey) };
  if (row.proveedorNombre) return { proveedorNombre: String(row.proveedorNombre) };
  return null;
}

function ensureLocalTable(tableCtrlRef) {
  if (tableCtrlRef.current) return tableCtrlRef.current;
  tableCtrlRef.current = createLocalTableController({
    section: '#tab-muestreos .mmpp-card',
    table: '#tablaMuestreos',
    pageSize: PAGE_SIZE,
    emptyColspan: 7,
    emptyText: 'No hay muestreos registrados.',
    fileName: 'Muestreos_MMPP',
    exportHeaders: [
      'Fecha',
      'Responsable',
      'Contacto',
      'Proveedor',
      'U x Kg',
      'R%',
      'Procesable %',
      'Total rechazos %',
      'Centro',
      'Linea',
      'Ruta'
    ]
  });
  return tableCtrlRef.current;
}

function buildLookups() {
  const contactos = Array.isArray(state.contactosGuardados) ? state.contactosGuardados : [];
  const visitas = Array.isArray(state.visitasGuardadas) ? state.visitasGuardadas : [];

  const contactoById = new Map();
  const contactosByProvKey = new Map();
  const contactosByProvName = new Map();
  const visitaById = new Map();

  for (const c of contactos) {
    const id = String(c?._id || c?.id || '').trim();
    const provKey = String(c?.proveedorKey || '').trim().toLowerCase();
    const provName = String(c?.proveedorNombre || c?.proveedor || '').trim();

    if (id) contactoById.set(id, c);
    if (provKey) {
      if (!contactosByProvKey.has(provKey)) contactosByProvKey.set(provKey, []);
      contactosByProvKey.get(provKey).push(c);
    }
    if (provName) {
      const k = norm(provName);
      if (!contactosByProvName.has(k)) contactosByProvName.set(k, []);
      contactosByProvName.get(k).push(c);
    }
  }

  for (const v of visitas) {
    const id = String(v?._id || v?.id || '').trim();
    if (id) visitaById.set(id, v);
  }

  return {
    contactoById,
    contactosByProvKey,
    contactosByProvName,
    visitaById
  };
}

function resolveContacto(row = {}, lookups) {
  const visita = row.visitaId ? lookups.visitaById.get(String(row.visitaId)) : null;
  if (visita) {
    const visitaContactoId = String(visita?.contactoId || '').trim();
    const visitaContactoNombre = String(visita?.contacto || '').trim();
    const contacto = visitaContactoId ? lookups.contactoById.get(visitaContactoId) : null;
    if (contacto) return String(contacto.contactoNombre || contacto.contacto || visitaContactoNombre || '').trim();
    if (visitaContactoNombre) return visitaContactoNombre;
  }

  const provKey = String(row.proveedorKey || '').trim().toLowerCase();
  if (provKey && lookups.contactosByProvKey.has(provKey)) {
    const list = lookups.contactosByProvKey.get(provKey) || [];
    const first = String(list[0]?.contactoNombre || list[0]?.contacto || '').trim();
    if (first) return list.length > 1 ? `${first} +${list.length - 1}` : first;
  }

  const provName = String(row.proveedorNombre || row.proveedor || '').trim();
  if (provName) {
    const list = lookups.contactosByProvName.get(norm(provName)) || [];
    const first = String(list[0]?.contactoNombre || list[0]?.contacto || '').trim();
    if (first) return list.length > 1 ? `${first} +${list.length - 1}` : first;
  }

  return '';
}

function originLabel(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'calidad') return 'Calidad';
  return 'Abastecimiento';
}

function numberFromCats(cats = {}, key = '') {
  if (!(cats && typeof cats === 'object')) return 0;
  return Number(cats[key]) || 0;
}

function calcRechazoTotal(row = {}) {
  const direct = Number(row.rechazos);
  if (Number.isFinite(direct) && direct > 0) return n2(direct);
  const cats = row.cats && typeof row.cats === 'object' ? row.cats : {};
  return n2(RECHAZO_DESC_KEYS.reduce((acc, k) => acc + numberFromCats(cats, k), 0));
}

function calcDefectos(row = {}) {
  const direct = Number(row.defectos);
  if (Number.isFinite(direct) && direct > 0) return n2(direct);
  const cats = row.cats && typeof row.cats === 'object' ? row.cats : {};
  return n2(DEFECTO_KEYS.reduce((acc, k) => acc + numberFromCats(cats, k), 0));
}

function buildDelta(actual, prev, inverse = false) {
  if (prev === null || prev === undefined || isNaN(prev) || isNaN(actual)) return '<span class="mu-delta is-neu">-</span>';
  const diff = actual - prev;
  if (Math.abs(diff) < 0.01) return '<span class="mu-delta is-neu">-</span>';
  const val = Math.abs(diff).toFixed(1);
  if (diff > 0) return `<span class="mu-delta ${inverse ? 'is-neg' : 'is-pos'}">▲ +${val}</span>`;
  return `<span class="mu-delta ${inverse ? 'is-pos' : 'is-neg'}">▼ -${val}</span>`;
}

function buildSparkline(rendimientos = []) {
  if (rendimientos.length < 2) return '';
  const pts = rendimientos.slice().reverse();
  if (pts.every(x => x === 0)) return '';
  const w = 60;
  const h = 20;
  const min = Math.max(0, Math.min(...pts) - 1.5);
  const max = Math.max(...pts) + 1.5;
  const range = max === min ? 1 : max - min;
  const stepX = w / Math.max(1, pts.length - 1);
  const points = pts.map((val, i) => `${i * stepX},${h - ((val - min) / range) * h}`).join(' ');
  const lastX = (pts.length - 1) * stepX;
  const lastY = h - ((pts[pts.length - 1] - min) / range) * h;
  return `
    <svg class="mu-sparkline" width="${w}" height="${h}" viewBox="-2 -2 ${w+4} ${h+4}">
      <polyline fill="none" stroke="#0ea5e9" stroke-width="2" points="${points}" />
      <circle cx="${lastX}" cy="${lastY}" r="3" />
    </svg>
  `;
}

function renderRutaChips(selected = '') {
  const wrap = document.getElementById('muRutaChips');
  if (!wrap) return;
  const val = String(selected || '').trim().toLowerCase();
  wrap.innerHTML = RUTA_OPTIONS.map((opt) => `
    <button type="button" class="act-period-mode${val === opt.value ? ' is-active' : ''}" data-mu-route="${esc(opt.value)}">
      ${esc(opt.label)}
    </button>
  `).join('');
}

function renderResponsableChips(rows = []) {
  const select = document.getElementById('muFltResponsable');
  if (!select) return;

  const current = String(select.value || '').trim();
  const values = [...new Set(
    rows.map((r) => String(r.responsablePG || '').trim()).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'es'));
  
  setHtmlOptions(select, values, 'Todos los responsables');
  if (values.includes(current)) {
    select.value = current;
  }
}

function filterRows(rows = [], { rutaId, respId, provId, contId, prodId, periodMode, periodOffset, q, fromManual, toManual }) {
  let range = null;
  if (periodMode === 'week') range = getWeekRange(periodOffset);
  else if (periodMode === 'month') range = getMonthRange(periodOffset);

  const from = fromManual ? new Date(`${fromManual}T00:00:00`) : (range ? range.from : null);
  const to = toManual ? new Date(`${toManual}T23:59:59`) : (range ? range.to : null);

  return rows.filter((r) => {
    if (rutaId && r.origen !== rutaId) return false;
    if (respId && r.responsablePG !== respId) return false;
    if (provId && String(r.proveedorNombre || '').trim() !== provId) return false;
    if (contId && String(r.contactoNombre || '').trim() !== contId) return false;
    if (prodId && String(r.productoPrincipal || '').trim() !== prodId) return false;
    
    if (from || to) {
      const d = toDateSafe(r.fecha);
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
    }

    if (q && !norm(r.searchKey).includes(q)) return false;
    return true;
  });
}

function renderKpis(filteredRows = []) {
  const total = filteredRows.length;
  const proveedores = new Set();
  
  let sumRend = 0;
  let criticalCount = 0;
  let minU = Infinity;
  let maxU = -Infinity;

  filteredRows.forEach((r) => {
    const prov = String(r.proveedorNombre || '').trim().toLowerCase();
    if (prov) proveedores.add(prov);
    
    sumRend += Number(r.rendimiento) || 0;
    
    const rech = Number(r.rechazoTotal) || 0;
    if (rech > 15) criticalCount++;

    const u = Number(r.uxkg) || 0;
    if (u > 0) {
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
    }
  });

  const avgRend = total ? sumRend / total : 0;

  const statusEl = document.getElementById('muSemanticStatus');
  if (!statusEl) return;

  if (total === 0) {
    statusEl.innerHTML = `<p class="mu-semantic-text">No hay muestreos para los filtros actuales.</p>`;
    statusEl.style.display = 'block';
    return;
  }

  let text = `Estás viendo <strong>${total} muestreos</strong> `;
  if (proveedores.size > 0) text += `de <strong>${proveedores.size} proveedor${proveedores.size === 1 ? '' : 'es'}</strong>. `;
  
  if (minU !== Infinity && maxU !== -Infinity && minU !== maxU) {
    text += `El calibre oscila entre <strong>${fmtNum(minU, 0)} y ${fmtNum(maxU, 0)} U/kg</strong> `;
  } else if (minU !== Infinity && minU > 0) {
    text += `El calibre reportado es de <strong>${fmtNum(minU, 0)} U/kg</strong> `;
  } else {
    text += `Sin calibres registrados, `;
  }

  text += `con un <strong>R% medio de ${fmtNum(avgRend, 1)}%</strong>.`;

  let alertHtml = '';
  if (criticalCount > 0) {
    alertHtml = `<span class="mu-semantic-alert is-danger">⚠️ ${criticalCount} muestra${criticalCount === 1 ? '' : 's'} con rechazo > 15%</span>`;
  } else {
    alertHtml = `<span class="mu-semantic-alert is-safe">✅ Rechazos dentro de norma</span>`;
  }

  statusEl.innerHTML = `
    <p class="mu-semantic-text">${text}</p>
    ${alertHtml}
  `;
  statusEl.style.display = 'flex';
}

function openInfoModal(row = {}) {
  const el = document.getElementById('muInfoBody');
  if (!el) return;
  const asoc = (row.visitaId || row.proveedorKey) ? 'Asociado' : 'Sin asociar';
  el.innerHTML = `
    <div class="mu-modal-grid">
      <article><span>Fecha</span><strong>${esc(fmtDate(row.fecha))}</strong></article>
      <article><span>Responsable</span><strong>${esc(row.responsablePG || '-')}</strong></article>
      <article><span>Contacto</span><strong>${esc(row.contactoNombre || '-')}</strong></article>
      <article><span>Proveedor</span><strong>${esc(row.proveedorNombre || '-')}</strong></article>
      <article><span>Centro</span><strong>${esc(row.centro || '-')}</strong></article>
      <article><span>Linea</span><strong>${esc(row.linea || '-')}</strong></article>
      <article><span>Ruta</span><strong>${esc(originLabel(row.origen))}</strong></article>
      <article><span>Estado</span><strong>${esc(asoc)}</strong></article>
    </div>
  `.trim();
  getModalInstance('modalMuInfo')?.open();
}

function rowCatValue(row = {}, key = '') {
  const cats = row.cats && typeof row.cats === 'object' ? row.cats : {};
  return n2(numberFromCats(cats, key));
}

function buildCatTableRows(row, keys, className = '') {
  const total = n2(Number(row.total) || 0);
  return keys.map((k) => {
    const val = rowCatValue(row, k);
    const pct = (total > 0) ? (val / total) * 100 : 0;
    return `
      <tr class="${className}">
        <td>${esc(CAT_LABELS[k] || k)}</td>
        <td class="mu-num">${fmtNum(pct, 2)} %</td>
      </tr>
    `;
  }).join('');
}

function openRechazoModal(row = {}) {
  const el = document.getElementById('muRechazoBody');
  if (!el) return;

  const procesable = n2(Number(row.procesable) || rowCatValue(row, 'procesable'));
  const rechazoTotal = n2(Number(row.rechazoTotal) || calcRechazoTotal(row));
  const defectos = n2(Number(row.defectos) || calcDefectos(row));
  const total = n2(Number(row.total) || (procesable + rechazoTotal + defectos));

  const procPct = total > 0 ? (procesable / total) * 100 : 0;
  const rechPct = total > 0 ? (rechazoTotal / total) * 100 : 0;
  const defectPct = total > 0 ? (defectos / total) * 100 : 0;

  el.innerHTML = `
    <div class="mu-rechazo-head">
      <article><span>Procesable</span><strong>${fmtNum(procPct, 2)} %</strong></article>
      <article><span>Total rechazos</span><strong>${fmtNum(rechPct, 2)} %</strong></article>
      <article><span>Total defectos</span><strong>${fmtNum(defectPct, 2)} %</strong></article>
      <article><span>Total muestra</span><strong>${fmtNum(total, 2)} kg</strong></article>
    </div>
    <div class="mu-rechazo-grid">
      <div class="mu-rechazo-col">
        <h6>Items de rechazo</h6>
        <table class="striped mu-mini-table">
          <thead><tr><th>Categoria</th><th>%</th></tr></thead>
          <tbody>
            ${buildCatTableRows(row, RECHAZO_DESC_KEYS, 'is-desc')}
          </tbody>
        </table>
      </div>
      <div class="mu-rechazo-col">
        <h6>Items de defecto</h6>
        <table class="striped mu-mini-table">
          <thead><tr><th>Categoria</th><th>%</th></tr></thead>
          <tbody>
            ${buildCatTableRows(row, DEFECTO_KEYS, 'is-defecto')}
          </tbody>
        </table>
      </div>
    </div>
  `.trim();
  getModalInstance('modalMuRechazo')?.open();
}

export function createMuestreosTabModule({
  openMuestreoPanel,
  openMuestreoFromSeed,
  refreshConsultaFilterStates,
  ensureVisitasLoaded
} = {}) {
  const tableCtrlRef = { current: null };
  const rowsById = new Map();
  let rawRows = [];
  let summary = null;
  let uiBound = false;
  let loadingPromise = null;
  let viewMode = 'flat'; // flat, grouped
  let periodMode = 'all';
  let periodOffset = 0;

  async function loadRemote(forceReload = false) {
    if (loadingPromise) return loadingPromise;
    if (!forceReload && rawRows.length) return rawRows;

    loadingPromise = (async () => {
      await Promise.resolve(ensureVisitasLoaded?.()).catch(() => {});
      const [rows, resumen] = await Promise.all([
        listMuestreos({ limit: 2000 }),
        getMuestreosResumen({}).catch(() => null)
      ]);
      rawRows = Array.isArray(rows) ? rows : [];
      summary = resumen && typeof resumen === 'object' ? resumen : null;
      return rawRows;
    })();

    try {
      return await loadingPromise;
    } finally {
      loadingPromise = null;
    }
  }

  function toDisplayRows(items = []) {
    rowsById.clear();
    const lookups = buildLookups();

    return items
      .slice()
      .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
      .map((m, idx) => {
        const id = String(m.id || m._id || `m-${idx}`);
        const proveedorNombre = String(m.proveedorNombre || m.proveedor || '').trim();
        const contactoNombre = resolveContacto(m, lookups);
        const centro = String(m.centro || m.centroCodigo || '').trim();
        const linea = String(m.linea || '').trim();
        const responsablePG = String(m.responsablePG || m.responsable || '').trim();
        const fechaTxt = fmtDate(m.fecha);
        const fechaOrder = toDateSafe(m.fecha)?.getTime() || 0;
        const rechazoTotal = calcRechazoTotal(m);
        const rechazoClass = rechazoTotal >= 20 ? 'is-high' : (rechazoTotal >= 10 ? 'is-mid' : 'is-low');

        const clasificaciones = Array.isArray(m.clasificaciones) ? m.clasificaciones : [];
        const primaryClas = clasificaciones.length ? clasificaciones.sort((a,b) => (a.prioridad||99) - (b.prioridad||99))[0] : null;
        const productoPrincipal = primaryClas?.nombre || '';
        const productoTipo = primaryClas?.tipoPrincipal || '';

        const row = {
          id,
          visitaId: String(m.visitaId || ''),
          proveedorKey: String(m.proveedorKey || ''),
          proveedorNombre,
          centroId: String(m.centroId || ''),
          centroCodigo: String(m.centroCodigo || ''),
          contactoNombre,
          centro,
          linea,
          productoPrincipal,
          productoTipo,
          origen: String(m.origen || '').toLowerCase() === 'calidad' ? 'calidad' : 'abastecimiento',
          responsablePG,
          fecha: m.fecha,
          uxkg: Number(m.uxkg) || 0,
          pesoVivo: Number(m.pesoVivo) || 0,
          pesoCocida: Number(m.pesoCocida) || 0,
          rendimiento: Number(m.rendimiento) || 0,
          total: Number(m.total) || 0,
          procesable: Number(m.procesable) || 0,
          rechazos: Number(m.rechazos) || 0,
          rechazoTotal,
          defectos: Number(m.defectos) || 0,
          cats: m.cats && typeof m.cats === 'object' ? m.cats : {},
          searchKey: [
            fechaTxt,
            proveedorNombre,
            contactoNombre,
            centro,
            linea,
            productoPrincipal,
            responsablePG,
            originLabel(m.origen)
          ].join(' ')
        };

        rowsById.set(id, row);

        const fechaCell = `
          <div class="mu-date-cell">
            <span class="mu-date-main" data-order="${fechaOrder}">${esc(fechaTxt)}</span>
            <span class="mu-date-sub">${esc(responsablePG || 'Sin responsable')}</span>
          </div>
        `.trim();

        const contactoCell = `
          <div class="mu-contact-stack" title="${esc(`${contactoNombre || '-'} | ${proveedorNombre || '-'}`)}">
            <span class="mu-contact-main">${esc(contactoNombre || '-')}</span>
            <span class="mu-provider-sub">${esc(proveedorNombre || '-')}</span>
          </div>
        `.trim();

        const rechazoCell = `
          <button type="button" class="mu-rechazo-btn ${rechazoClass}" data-mu-action="rechazo" data-id="${esc(id)}" title="Ver composicion de rechazos y defectos">
            ${fmtNum(rechazoTotal, 2)} %
          </button>
        `.trim();

        const acciones = `
          <div class="mu-action-dropdown">
            <button type="button" class="mu-action-trigger" data-mu-action="toggle-menu" title="Acciones de muestreo">
              <i class="bi bi-three-dots-vertical" aria-hidden="true"></i>
            </button>
            <div class="mu-action-menu">
              <button class="mu-action-item" data-mu-action="info" data-id="${esc(id)}">
                <i class="bi bi-info-circle" aria-hidden="true"></i> Info detalle
              </button>
              <button class="mu-action-item" data-mu-action="edit" data-id="${esc(id)}">
                <i class="bi bi-pencil-square" aria-hidden="true"></i> Editar
              </button>
              <div class="mu-action-divider"></div>
              <button class="mu-action-item" data-mu-action="view" data-id="${esc(id)}">
                <i class="bi bi-eye" aria-hidden="true"></i> Ver relacionado
              </button>
              <button class="mu-action-item" data-mu-action="new" data-id="${esc(id)}">
                <i class="bi bi-eyedropper" aria-hidden="true"></i> Nuevo muestreo
              </button>
              <div class="mu-action-divider"></div>
              <button class="mu-action-item mu-action-item--danger" data-mu-action="delete" data-id="${esc(id)}">
                <i class="bi bi-trash" aria-hidden="true"></i> Eliminar
              </button>
            </div>
          </div>
        `.trim();

        const procPct = row.total > 0 ? (row.procesable / row.total) * 100 : 0;
        const rechPct = row.total > 0 ? (row.rechazoTotal / row.total) * 100 : 0;

        const badgeClass = productoTipo.toLowerCase().includes('entero') ? 'is-entero' : (productoTipo.toLowerCase().includes('media') ? 'is-media' : (productoTipo.toLowerCase().includes('carne') ? 'is-carne' : ''));
        const productoCell = productoPrincipal ? `<span class="mu-badge-producto ${badgeClass}">${esc(productoPrincipal)}</span>` : '<span style="color:#cbd5e1; font-size:10px;">S/C</span>';

        return {
          key: id,
          ...row,
          cells: [
            fechaCell,
            contactoCell,
            esc(row.linea || '-'),
            productoCell,
            `<span class="mu-num-main">${fmtNum(row.uxkg, 0)}</span>`,
            `<span class="mu-num-main">${fmtNum(row.rendimiento, 2)} %</span>`,
            `<span class="mu-num-main">${fmtNum(procPct, 2)} %</span>`,
            `
              <button type="button" class="mu-rechazo-btn ${rechazoClass}" data-mu-action="rechazo" data-id="${esc(id)}">
                ${fmtNum(rechPct, 2)} %
              </button>
            `.trim(),
            acciones
          ],
          export: [
            fechaTxt,
            responsablePG,
            contactoNombre,
            proveedorNombre,
            String(n2(row.uxkg)),
            String(n2(row.rendimiento)),
            String(n2(row.procesable)),
            String(n2(row.rechazoTotal)),
            centro,
            linea,
            originLabel(row.origen)
          ]
        };
      });
  }

  function populateFilters(rows = []) {
    setHtmlOptions(
      document.getElementById('muFltProveedor'),
      [...new Set(rows.map((r) => String(r.proveedorNombre || '').trim()).filter(Boolean))],
      'Todos los proveedores'
    );
    setHtmlOptions(
      document.getElementById('muFltContacto'),
      [...new Set(rows.map((r) => String(r.contactoNombre || '').trim()).filter(Boolean))],
      'Todos los contactos'
    );
    setHtmlOptions(
      document.getElementById('muFltProducto'),
      [...new Set(rows.map((r) => String(r.productoPrincipal || '').trim()).filter(Boolean))],
      'Todos los productos'
    );
    renderResponsableChips(rows);
  }

  function toGroupedRows(filtered = []) {
    const groups = new Map();
    filtered.forEach(r => {
      const gKey = r.proveedorKey || r.proveedorNombre || 'Desconocido';
      if (!groups.has(gKey)) {
        groups.set(gKey, {
          key: gKey,
          nombre: r.proveedorNombre,
          contacto: r.contactoNombre,
          items: []
        });
      }
      groups.get(gKey).items.push(r);
    });

    const rows = [];
    groups.forEach(g => {
      const items = g.items.sort((a,b) => new Date(b.fecha||0) - new Date(a.fecha||0));
      const latest = items[0];
      const prev = items[1];

      const rDelta = prev ? buildDelta(latest.rendimiento, prev.rendimiento, false) : '<span class="mu-delta is-neu">-</span>';
      const uDelta = prev ? buildDelta(latest.uxkg, prev.uxkg, true) : '<span class="mu-delta is-neu">-</span>';
      const sparkR = buildSparkline(items.slice(0, 10).map(x => x.rendimiento));

      const nameCell = `
        <div class="mu-prov-stack">
          <span class="mu-prov-name">${esc(g.nombre || '-')}</span>
          <span class="mu-prov-count">${items.length} muestras totales | Contacto: ${esc(g.contacto || '-')}</span>
        </div>
      `;

      const detailRows = items.map(x => `
        <tr>
          <td>${esc(fmtDate(x.fecha))}</td>
          <td>${esc(x.centro || '-')}</td>
          <td>${esc(x.linea || '-')}</td>
          <td>${fmtNum(x.rendimiento, 2)} %</td>
          <td>${fmtNum(x.uxkg, 0)}</td>
          <td>${fmtNum(x.total > 0 ? (x.procesable / x.total) * 100 : 0, 2)} %</td>
          <td>
            <button type="button" class="btn-flat tbl-action-btn tbl-act-view" data-mu-action="info" data-id="${esc(x.id)}" title="Info">
              <i class="bi bi-info-circle" aria-hidden="true"></i>
            </button>
          </td>
        </tr>
      `).join('');

      const detailHtml = `
        <tr class="mu-grouped-detail" data-detail-prov="${esc(g.key)}">
          <td colspan="7" style="padding: 10px 16px;">
            <table class="mu-mini-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Centro</th>
                  <th>Línea</th>
                  <th>R%</th>
                  <th>U° x Kg</th>
                  <th>Procesable</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>${detailRows}</tbody>
            </table>
          </td>
        </tr>
      `;

      rows.push({
        className: 'muestreo-master-row',
        attrs: { 'data-grupo-prov': g.key },
        afterHtml: detailHtml,
        cells: [
          `<span class="mu-master-kpi" style="font-size:12px; color:#64748b;">${esc(fmtDate(latest.fecha))}</span>`,
          nameCell,
          `<span class="mu-master-kpi">${fmtNum(latest.uxkg, 0)} ${uDelta}</span>`,
          `<span class="mu-master-kpi">${fmtNum(latest.rendimiento, 2)} % ${rDelta}</span>`,
          `<span class="mu-master-kpi">${fmtNum(latest.total > 0 ? (latest.procesable / latest.total) * 100 : 0, 2)} %</span>`,
          `<div style="display:flex; justify-content:center;">${sparkR}</div>`,
          `<i class="bi bi-chevron-down muted mu-icon-expand" aria-hidden="true" style="font-size:18px;vertical-align:middle;"></i>`
        ],
        export: [
          'Última: ' + fmtDate(latest.fecha), // Fecha
          '-',                                // Responsable
          g.contacto || '-',                  // Contacto
          g.nombre || '-',                    // Proveedor
          String(n2(latest.uxkg)),            // U x Kg
          String(n2(latest.rendimiento)),     // R%
          String(n2(latest.total > 0 ? (latest.procesable / latest.total) * 100 : 0)), // Procesable %
          '-',                                // Total rechazos %
          `${items.length} muestras totales`, // Centro
          '-',                                // Linea
          '-'                                 // Ruta
        ]
      });
    });

    return rows;
  }

  async function renderTablaMuestreos(forceReload = false) {
    const table = ensureLocalTable(tableCtrlRef);
    if (!table) return;

    try {
      const items = await loadRemote(!!forceReload);
      const displayRows = toDisplayRows(items);
      populateFilters(displayRows);
      
      const fRuta = document.getElementById('muFltOrigen')?.value || '';
      const fResp = document.getElementById('muFltResponsable')?.value || '';
      const fProv = document.getElementById('muFltProveedor')?.value || '';
      const fCont = document.getElementById('muFltContacto')?.value || '';
      const fProd = document.getElementById('muFltProducto')?.value || '';
      const fQ = document.getElementById('searchMuestreos')?.value || '';
      const fDesde = document.getElementById('muFltDesde')?.value || '';
      const fHasta = document.getElementById('muFltHasta')?.value || '';
      
      const filtered = filterRows(displayRows, { 
        rutaId: fRuta, 
        respId: fResp, 
        provId: fProv,
        contId: fCont,
        prodId: fProd,
        periodMode,
        periodOffset, 
        q: norm(fQ),
        fromManual: fDesde,
        toManual: fHasta
      });
      
      const head = document.getElementById('muTableHeaders');
      document.getElementById('tablaMuestreos')?.classList.toggle('is-grouped', viewMode !== 'flat');
      if (viewMode === 'flat') {
        if (head) head.innerHTML = '<th>Fecha / Responsable</th><th>Proveedor / Contacto</th><th>Línea</th><th>Producto</th><th>U/Kg</th><th>R%</th><th>Proc.%</th><th>Rech.%</th><th>Acciones</th>';
        table.setRows(filtered);
      } else {
        if (head) head.innerHTML = '<th>Última Muestra</th><th>Proveedor / Muestras totales</th><th>U° × Kg (Última)</th><th>R% (Última)</th><th>Procesable</th><th>Tendencia R%</th><th></th>';
        table.setRows(toGroupedRows(filtered));
      }

      renderKpis(filtered);
      refreshConsultaFilterStates?.();
    } catch (err) {
      console.error('[muestreos-tab] no se pudieron cargar datos', err);
      table.setRows([]);
      renderKpis([]);
      toast('No se pudo cargar la tabla de muestreos.', { variant: 'error' });
    }
  }

  function openViewForRow(row = {}) {
    openMuestreoPanel?.({
      route: row.origen || 'terreno',
      view: 'summary',
      scope: buildScopeFromRow(row)
    });
  }

  function openNewForRow(row = {}) {
    openMuestreoFromSeed?.({
      visitaId: row.visitaId || '',
      proveedorKey: row.proveedorKey || '',
      proveedorNombre: row.proveedorNombre || '',
      proveedor: row.proveedorNombre || '',
      centro: row.centro || '',
      linea: row.linea || '',
      fecha: fmtDate(new Date()),
      responsable: row.responsablePG || '',
      route: row.origen || 'terreno'
    }, {
      route: row.origen || 'terreno',
      view: 'form'
    });
  }

  function openEditModal(row = {}) {
    openMuestreoFromSeed?.({
      muestreoId: row.id || '',
      editMode: true,
      visitaId: row.visitaId || '',
      proveedorKey: row.proveedorKey || '',
      proveedorNombre: row.proveedorNombre || '',
      proveedor: row.proveedorNombre || '',
      centroId: row.centroId || '',
      centroCodigo: row.centroCodigo || '',
      centro: row.centro || '',
      linea: row.linea || '',
      fecha: fmtDate(row.fecha),
      responsable: row.responsablePG || '',
      responsablePG: row.responsablePG || '',
      route: row.origen || 'terreno',
      origen: row.origen || 'terreno',
      uxkg: row.uxkg,
      pesoVivo: row.pesoVivo,
      pesoCocida: row.pesoCocida,
      rendimiento: row.rendimiento,
      total: row.total,
      procesable: row.procesable,
      rechazos: row.rechazos,
      defectos: row.defectos,
      cats: row.cats && typeof row.cats === 'object' ? { ...row.cats } : {}
    }, {
      route: row.origen || 'terreno',
      view: 'form',
      mode: 'edit'
    });
  }

  function bindUiOnce() {
    if (uiBound) return;
    uiBound = true;

    const refresh = debounce(() => {
      renderTablaMuestreos(false).catch(() => {});
    }, 140);

    const fResp = document.getElementById('muFltResponsable');
    const fQ = document.getElementById('searchMuestreos');

    const periodModes = Array.from(document.querySelectorAll('.act-period-mode[data-period]'));
    const periodCtrl = document.getElementById('mu-period-ctrl');
    const periodLabel = document.getElementById('mu-period-label');
    const btnPrev = document.getElementById('mu-period-prev');
    const btnNext = document.getElementById('mu-period-next');
    const btnToday = document.getElementById('mu-period-today');

    function syncPeriodUI() {
      const hasNav = periodMode !== 'all';
      if (periodCtrl) periodCtrl.hidden = !hasNav;
      if (hasNav && periodLabel) {
        if (periodMode === 'week') {
          const { from, to } = getWeekRange(periodOffset);
          const wk = isoWeek(from);
          const fStr = `${from.getDate()} ${MONTHS_SH[from.getMonth()]}`;
          const tStr = `${to.getDate()} ${MONTHS_SH[to.getMonth()]} ${to.getFullYear()}`;
          periodLabel.textContent = `Sem. ${wk} · ${fStr}–${tStr}`;
        } else if (periodMode === 'month') {
          const d = new Date(new Date().getFullYear(), new Date().getMonth() + periodOffset, 1);
          periodLabel.textContent = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
        }
      }
      periodModes.forEach(b => b.classList.toggle('is-active', b.dataset.period === periodMode));
      if (btnToday) btnToday.disabled = (periodOffset === 0);
    }

    periodModes.forEach(btn => {
      btn.addEventListener('click', () => {
        periodMode = btn.dataset.period;
        periodOffset = 0;
        syncPeriodUI();
        refresh();
      });
    });

    btnPrev?.addEventListener('click', () => { periodOffset--; syncPeriodUI(); refresh(); });
    btnNext?.addEventListener('click', () => { periodOffset++; syncPeriodUI(); refresh(); });
    btnToday?.addEventListener('click', () => { periodOffset = 0; syncPeriodUI(); refresh(); });

    renderRutaChips(document.getElementById('muFltOrigen')?.value || '');
    renderResponsableChips([]);

    ['muFltProveedor', 'muFltContacto', 'muFltProducto', 'muFltDesde', 'muFltHasta']
      .forEach((id) => document.getElementById(id)?.addEventListener('change', refresh));
    
    fResp?.addEventListener('change', refresh);
    fQ?.addEventListener('input', refresh);

    document.getElementById('muModeSwitch')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mu-mode]');
      if (!btn) return;
      const mode = String(btn.getAttribute('data-mu-mode') || 'flat');
      viewMode = mode;
      document.querySelectorAll('#muModeSwitch .act-period-mode').forEach(b => {
        b.classList.toggle('is-active', b === btn);
      });
      renderTablaMuestreos(false).catch(() => {});
    });

    document.getElementById('muRutaChips')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mu-route]');
      if (!btn) return;
      const value = String(btn.getAttribute('data-mu-route') || '');
      const input = document.getElementById('muFltOrigen');
      if (input) input.value = value;
      renderRutaChips(value);
      refresh();
    });

    document.getElementById('btnMuFltClear')?.addEventListener('click', () => {
      ['muFltProveedor', 'muFltContacto', 'muFltProducto', 'muFltDesde', 'muFltHasta', 'searchMuestreos']
        .forEach((id) => {
          const el = document.getElementById(id);
          if (!el) return;
          if ('value' in el) el.value = '';
        });

      const fOrigen = document.getElementById('muFltOrigen');
      const fResp = document.getElementById('muFltResponsable');
      const fQ = document.getElementById('searchMuestreos');
      
      if (fOrigen) fOrigen.value = '';
      if (fResp) fResp.value = '';
      periodMode = 'all';
      periodOffset = 0;
      if (fQ) fQ.value = '';
      syncPeriodUI();
    });

    document.querySelector('#tablaMuestreos tbody')?.addEventListener('click', async (e) => {
      const rowBtn = e.target.closest('.muestreo-master-row');
      if (rowBtn && !e.target.closest('[data-mu-action]')) {
        const provKey = rowBtn.getAttribute('data-grupo-prov');
        const detailRow = document.querySelector(`.mu-grouped-detail[data-detail-prov="${provKey}"]`);
        if (detailRow) {
          detailRow.classList.toggle('is-open');
          rowBtn.classList.toggle('is-expanded');
        }
        return;
      }

      const btn = e.target.closest('[data-mu-action]');
      if (!btn) return;
      e.preventDefault();
      
      const action = String(btn.getAttribute('data-mu-action') || '').trim();
      
      // Toggle menu logic
      if (action === 'toggle-menu') {
        const menu = btn.nextElementSibling;
        if (menu) {
          const isOpen = menu.classList.contains('is-open');
          
          if (!isOpen) {
            // Check vertical space to decide if open up or down
            const rect = btn.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const menuHeight = 220; // Estimated height of the menu
            
            if (spaceBelow < menuHeight && rect.top > menuHeight) {
              menu.style.top = 'auto';
              menu.style.bottom = '100%';
              menu.style.marginTop = '0';
              menu.style.marginBottom = '4px';
            } else {
              menu.style.top = '100%';
              menu.style.bottom = 'auto';
              menu.style.marginTop = '4px';
              menu.style.marginBottom = '0';
            }
          }

          // Close all other menus first
          document.querySelectorAll('.mu-action-menu.is-open').forEach(m => m.classList.remove('is-open'));
          document.querySelectorAll('.mu-action-trigger.is-active').forEach(b => b.classList.remove('is-active'));

          menu.classList.toggle('is-open', !isOpen);
          btn.classList.toggle('is-active', !isOpen);
        }
        return;
      }

      const id = String(btn.getAttribute('data-id') || '').trim();
      const row = rowsById.get(id);
      if (!row) return;

      // Close menu after action
      const menu = btn.closest('.mu-action-menu');
      if (menu) {
        menu.classList.remove('is-open');
        menu.previousElementSibling?.classList.remove('is-active');
      }

      if (action === 'info') {
        openInfoModal(row);
        return;
      }
      if (action === 'edit') {
        openEditModal(row);
        return;
      }
      if (action === 'rechazo') {
        openRechazoModal(row);
        return;
      }
      if (action === 'view') {
        openViewForRow(row);
        return;
      }
      if (action === 'new') {
        openNewForRow(row);
        return;
      }
      if (action === 'delete') {
        const label = [row.proveedor, row.centro, row.fecha].filter(Boolean).join(' · ');
        if (!confirm(`¿Eliminar muestreo de ${label}?\n\nEsta acción no se puede deshacer.`)) return;
        try {
          await deleteMuestreo(row.id);
          toast('Muestreo eliminado.', { variant: 'success' });
          renderTablaMuestreos(true).catch(() => {});
        } catch (err) {
          toast('No se pudo eliminar el muestreo.', { variant: 'error' });
          console.error('[muestreos-tab] delete error', err);
        }
      }
    });

    window.addEventListener('muestreo:created', () => {
      renderTablaMuestreos(true).catch(() => {});
    });
    window.addEventListener('muestreo:updated', () => {
      renderTablaMuestreos(true).catch(() => {});
    });

    // Global listener to close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.mu-action-dropdown')) {
        document.querySelectorAll('.mu-action-menu.is-open').forEach(m => m.classList.remove('is-open'));
        document.querySelectorAll('.mu-action-trigger.is-active').forEach(b => b.classList.remove('is-active'));
      }
    });
  }

  async function initTab(forceReload = false) {
    bindUiOnce();
    await renderTablaMuestreos(!!forceReload);
  }

  return {
    initTab,
    renderTablaMuestreos
  };
}
