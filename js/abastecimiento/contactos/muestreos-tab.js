import { state } from './state.js';
import { createLocalTableController } from './local-table.js';
import { debounce, escapeHtml, getModalInstance } from './ui-common.js';
import { listMuestreos, getMuestreosResumen } from './muestreo-api.js';

const PAGE_SIZE = 10;
const esc = escapeHtml;

const RUTA_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'directa', label: 'Directa' },
  { value: 'planta', label: 'Planta' }
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

function toDateSafe(v) {
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
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

function originLabel(v = '') {
  const x = norm(v);
  if (x === 'planta') return 'Planta';
  if (x === 'directa') return 'Directa';
  return 'Terreno';
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

function renderRutaChips(selected = '') {
  const wrap = document.getElementById('muRutaChips');
  if (!wrap) return;
  const val = String(selected || '').trim().toLowerCase();
  wrap.innerHTML = RUTA_OPTIONS.map((opt) => `
    <button type="button" class="mu-chip-btn${val === opt.value ? ' is-active' : ''}" data-mu-route="${esc(opt.value)}">
      ${esc(opt.label)}
    </button>
  `).join('');
}

function renderResponsableChips(rows = []) {
  const wrap = document.getElementById('muRespChips');
  const hidden = document.getElementById('muFltResponsable');
  if (!(wrap && hidden)) return;

  const current = String(hidden.value || '').trim();
  const values = [...new Set(
    rows.map((r) => String(r.responsablePG || '').trim()).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'es'));
  const selected = values.includes(current) ? current : '';
  hidden.value = selected;

  const all = [{ value: '', label: 'Todos' }, ...values.map((v) => ({ value: v, label: v }))];
  wrap.innerHTML = all.map((opt) => `
    <button type="button" class="mu-chip-btn${selected === opt.value ? ' is-active' : ''}" data-mu-resp="${esc(opt.value)}">
      ${esc(opt.label)}
    </button>
  `).join('');
}

function filterRows(rows = []) {
  const fProveedor = norm(document.getElementById('muFltProveedor')?.value || '');
  const fContacto = norm(document.getElementById('muFltContacto')?.value || '');
  const fResponsable = norm(document.getElementById('muFltResponsable')?.value || '');
  const fOrigen = norm(document.getElementById('muFltOrigen')?.value || '');
  const fDesde = String(document.getElementById('muFltDesde')?.value || '').trim();
  const fHasta = String(document.getElementById('muFltHasta')?.value || '').trim();
  const q = norm(document.getElementById('searchMuestreos')?.value || '');

  const from = fDesde ? new Date(`${fDesde}T00:00:00`) : null;
  const to = fHasta ? new Date(`${fHasta}T23:59:59`) : null;

  return rows.filter((r) => {
    if (fProveedor && norm(r.proveedorNombre) !== fProveedor) return false;
    if (fContacto && norm(r.contactoNombre) !== fContacto) return false;
    if (fResponsable && norm(r.responsablePG) !== fResponsable) return false;
    if (fOrigen && norm(r.origen) !== fOrigen) return false;
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
  let sumUxkg = 0;
  let sumProcesable = 0;
  let sumRend = 0;
  let linked = 0;
  let sumRech = 0;

  filteredRows.forEach((r) => {
    const prov = String(r.proveedorNombre || '').trim().toLowerCase();
    if (prov) proveedores.add(prov);
    sumUxkg += Number(r.uxkg) || 0;
    sumProcesable += Number(r.procesable) || 0;
    sumRend += Number(r.rendimiento) || 0;
    sumRech += Number(r.rechazoTotal) || 0;
    if (r.visitaId || r.proveedorKey) linked += 1;
  });

  const avgUxkg = total ? sumUxkg / total : 0;
  const avgProc = total ? sumProcesable / total : 0;
  const avgRend = total ? sumRend / total : 0;
  const avgRech = total ? sumRech / total : 0;

  setText('muTabKpiTotal', total);
  setText('muTabKpiProveedores', proveedores.size);
  setText('muTabKpiUxkg', fmtNum(avgUxkg, 0));
  setText('muTabKpiProcesable', `${fmtNum(avgProc, 2)} %`);
  setText('muTabKpiRend', `${fmtNum(avgRend, 2)} %`);
  setText('muTabKpiRechazos', `${fmtNum(avgRech, 2)} %`);
  setText('muTabKpiPendientes', total - linked);
}

function setJumpCount(summary, fallbackCount) {
  const total = Number(summary?.total) || Number(fallbackCount) || 0;
  setText('consultaCountMuestreos', total);
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
  return keys.map((k) => `
    <tr class="${className}">
      <td>${esc(CAT_LABELS[k] || k)}</td>
      <td class="mu-num">${fmtNum(rowCatValue(row, k), 2)} %</td>
    </tr>
  `).join('');
}

function openRechazoModal(row = {}) {
  const el = document.getElementById('muRechazoBody');
  if (!el) return;

  const procesable = n2(Number(row.procesable) || rowCatValue(row, 'procesable'));
  const rechazoTotal = n2(Number(row.rechazoTotal) || calcRechazoTotal(row));
  const defectos = n2(Number(row.defectos) || calcDefectos(row));
  const total = n2(Number(row.total) || (procesable + rechazoTotal + defectos));

  el.innerHTML = `
    <div class="mu-rechazo-head">
      <article><span>Procesable</span><strong>${fmtNum(procesable, 2)} %</strong></article>
      <article><span>Total rechazos</span><strong>${fmtNum(rechazoTotal, 2)} %</strong></article>
      <article><span>Total defectos</span><strong>${fmtNum(defectos, 2)} %</strong></article>
      <article><span>Total muestra</span><strong>${fmtNum(total, 2)} %</strong></article>
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
      setJumpCount(summary, rawRows.length);
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
          origen: String(m.origen || ''),
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
          <div class="acts tbl-actions">
            <button type="button" class="btn-flat tbl-action-btn tbl-act-view" data-mu-action="info" data-id="${esc(id)}" title="Info de muestra">
              <i class="material-icons tiny">info</i>
            </button>
            <button type="button" class="btn-flat tbl-action-btn tbl-act-edit" data-mu-action="edit" data-id="${esc(id)}" title="Editar muestreo">
              <i class="material-icons tiny">edit</i>
            </button>
            <button type="button" class="btn-flat tbl-action-btn tbl-act-view" data-mu-action="view" data-id="${esc(id)}" title="Ver resumen relacionado">
              <i class="material-icons tiny">visibility</i>
            </button>
            <button type="button" class="btn-flat tbl-action-btn tbl-act-biomasa" data-mu-action="new" data-id="${esc(id)}" title="Registrar nuevo muestreo">
              <i class="material-icons tiny">science</i>
            </button>
          </div>
        `.trim();

        return {
          key: id,
          ...row,
          cells: [
            fechaCell,
            contactoCell,
            `<span class="mu-num-main">${fmtNum(row.uxkg, 0)}</span>`,
            `<span class="mu-num-main">${fmtNum(row.rendimiento, 2)} %</span>`,
            `<span class="mu-num-main">${fmtNum(row.procesable, 2)} %</span>`,
            rechazoCell,
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
    renderResponsableChips(rows);
  }

  async function renderTablaMuestreos(forceReload = false) {
    const table = ensureLocalTable(tableCtrlRef);
    if (!table) return;

    try {
      const items = await loadRemote(!!forceReload);
      const displayRows = toDisplayRows(items);
      populateFilters(displayRows);
      const filtered = filterRows(displayRows);
      table.setRows(filtered);
      renderKpis(filtered);
      refreshConsultaFilterStates?.();
    } catch (err) {
      console.error('[muestreos-tab] no se pudieron cargar datos', err);
      table.setRows([]);
      renderKpis([]);
      setJumpCount(summary, 0);
      M.toast?.({ html: 'No se pudo cargar la tabla de muestreos.', classes: 'red' });
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

    const rerender = debounce(() => {
      renderTablaMuestreos(false).catch(() => {});
    }, 140);

    renderRutaChips(document.getElementById('muFltOrigen')?.value || '');
    renderResponsableChips([]);

    ['muFltProveedor', 'muFltContacto', 'muFltDesde', 'muFltHasta']
      .forEach((id) => document.getElementById(id)?.addEventListener('change', rerender));
    document.getElementById('searchMuestreos')?.addEventListener('input', rerender);

    document.getElementById('muRutaChips')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mu-route]');
      if (!btn) return;
      const value = String(btn.getAttribute('data-mu-route') || '');
      const input = document.getElementById('muFltOrigen');
      if (input) input.value = value;
      renderRutaChips(value);
      rerender();
    });

    document.getElementById('muRespChips')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mu-resp]');
      if (!btn) return;
      const value = String(btn.getAttribute('data-mu-resp') || '');
      const input = document.getElementById('muFltResponsable');
      if (input) input.value = value;
      document.querySelectorAll('#muRespChips .mu-chip-btn').forEach((x) => {
        x.classList.toggle('is-active', x === btn);
      });
      rerender();
    });

    document.getElementById('btnMuFltClear')?.addEventListener('click', () => {
      ['muFltProveedor', 'muFltContacto', 'muFltDesde', 'muFltHasta', 'searchMuestreos']
        .forEach((id) => {
          const el = document.getElementById(id);
          if (!el) return;
          if ('value' in el) el.value = '';
        });

      const fOrigen = document.getElementById('muFltOrigen');
      const fResp = document.getElementById('muFltResponsable');
      if (fOrigen) fOrigen.value = '';
      if (fResp) fResp.value = '';

      renderRutaChips('');
      renderTablaMuestreos(false).catch(() => {});
    });

    document.querySelector('#tablaMuestreos tbody')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mu-action]');
      if (!btn) return;
      e.preventDefault();
      const id = String(btn.getAttribute('data-id') || '').trim();
      const action = String(btn.getAttribute('data-mu-action') || '').trim();
      const row = rowsById.get(id);
      if (!row) return;

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
      }
    });

    window.addEventListener('muestreo:created', () => {
      renderTablaMuestreos(true).catch(() => {});
    });
    window.addEventListener('muestreo:updated', () => {
      renderTablaMuestreos(true).catch(() => {});
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

