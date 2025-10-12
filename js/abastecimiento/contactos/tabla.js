// /js/abastecimiento/contactos/tabla.js
import { state, $ } from './state.js';
import { centroCodigoById, comunaPorCodigo } from './normalizers.js';
import { abrirEdicion, eliminarContacto } from './form-contacto.js';
import { abrirDetalleContacto } from './form-contacto.js';
import { abrirModalVisita } from '../visitas/ui.js';

/* ---------- Config local ---------- */
const API_BASE = window.API_URL || '/api';
const fmtCL = (n) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 });

/* ---------- Semana ISO (fallback si no existe en window) ---------- */
function isoWeekNumber(dateStr){
  const d = dateStr ? new Date(dateStr) : new Date();
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThu = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target - firstThu) / 86400000;
  return 1 + Math.floor(diff / 7);
}
const wk = (s) => (window.isoWeekNumber ? window.isoWeekNumber(s) : isoWeekNumber(s));

/* ---------- estilos: proveedor con elipsis + acciones en fila ---------- */
(function injectStyles () {
  const css = `
    #tablaContactos td .ellipsisCell{
      display:inline-block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; vertical-align:middle;
    }
    #tablaContactos td .ellipsisProv{ max-width:26ch; }

    /* Acciones en una sola fila */
    #tablaContactos td.cell-actions{ white-space:nowrap; }
    #tablaContactos td.cell-actions .act{
      display:inline-flex; align-items:center; justify-content:center;
      width:32px; height:32px; margin-right:6px;
      border:1px solid #e5e7eb; border-radius:8px; background:#fff;
      box-shadow:0 2px 8px rgba(2,6,23,.05); cursor:pointer;
    }
    #tablaContactos td.cell-actions .act:last-child{ margin-right:0; }
    #tablaContactos td.cell-actions i.material-icons{ font-size:18px; }

    /* celda tons mientras carga */
    #tablaContactos .tons-cell.loading{ opacity:.6 }
    #tablaContactos tfoot th{ font-weight:700; background:#f6f6f7 }
  `;
  if (!document.getElementById('tabla-contactos-inline-styles')) {
    const s = document.createElement('style');
    s.id = 'tabla-contactos-inline-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }
})();

/* -------------------- helpers locales (solo UI, no escriben BD) -------------------- */
const esc = (s='') => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

const esCodigoValido = (x) => /^\d{4,7}$/.test(String(x || ''));

/* ===== handler único expuesto ===== */
async function _clickAccContacto(aEl){
  try{
    const id = aEl?.dataset?.id;
    const action = (aEl?.dataset?.action || '').toLowerCase();
    const cls = (aEl?.className || '').toLowerCase();

    const c = state.contactosGuardados.find(x => String(x._id) === String(id));
    if (!c) { M.toast?.({ html: 'Contacto no encontrado', classes: 'red' }); return; }

    const act = action || (cls.includes('ver') ? 'ver'
                  : cls.includes('visita') ? 'visita'
                  : cls.includes('editar') ? 'editar'
                  : cls.includes('eliminar') ? 'eliminar'
                  : '');

    if (act === 'ver')     return abrirDetalleContacto(c);
    if (act === 'visita')  return abrirModalVisita(c);
    if (act === 'editar')  return abrirEdicion(c);

    if (act === 'eliminar'){
      if (aEl.dataset.busy === '1') return;
      aEl.dataset.busy = '1';
      try {
        if (!confirm('¿Seguro que quieres eliminar este contacto?')) return;
        await eliminarContacto(id);
      } catch (e) {
        console.error(e);
        M.toast?.({ html: 'No se pudo eliminar', classes: 'red' });
      } finally {
        delete aEl.dataset.busy;
      }
      return;
    }
  }catch(err){
    console.error('[contactos] error en _clickAccContacto', err);
  }
}
window._clickAccContacto = _clickAccContacto;

/* ---------- Cache de totales de disponibilidad (incluye contactoId) ---------- */
// key: `${contactoId}|${proveedorKey}|${centroId}`
state.dispTotalCache = state.dispTotalCache || new Map();

/* Pequeno helper para GET con rango por defecto (y-1 .. y+1) */
async function getDisponibilidades(params){
  const y = new Date().getFullYear();
  const q = new URLSearchParams();
  q.set('from', params?.from || `${y-1}-01`);
  q.set('to',   params?.to   || `${y+1}-12`);

  if (params?.contactoId) q.set('contactoId', params.contactoId);
  if (params?.proveedorKey) q.set('proveedorKey', params.proveedorKey);
  if (params?.centroId) q.set('centroId', params.centroId);

  const url = `${API_BASE}/disponibilidades?${q.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('GET /disponibilidades '+res.status);
  const json = await res.json();
  return Array.isArray(json) ? json : (json.items || []);
}

/* Suma robusta con fallbacks */
async function fetchTotalDisponibilidad({ contactoId='', proveedorKey='', centroId='' }){
  const cacheKey = `${contactoId||''}|${proveedorKey||''}|${centroId||''}`;
  if (state.dispTotalCache.has(cacheKey)) return state.dispTotalCache.get(cacheKey);

  function sum(list, filterByContactoId){
    let arr = Array.isArray(list) ? list : [];
    if (filterByContactoId) arr = arr.filter(it => String(it.contactoId || '') === String(filterByContactoId));
    return arr.reduce((acc, it)=> acc + Number(it.tonsDisponible ?? it.tons ?? 0), 0);
  }

  let total = 0;
  try{
    if (contactoId) {
      const list1 = await getDisponibilidades({ contactoId });
      total = sum(list1, contactoId);
    }
    if (total === 0 && (proveedorKey || centroId)) {
      const list2 = await getDisponibilidades({ proveedorKey, centroId });
      total = sum(list2);
    }
    if (total === 0 && proveedorKey) {
      const list3 = await getDisponibilidades({ proveedorKey });
      total = sum(list3);
    }
  }catch(e){
    console.error('[tablaContactos] fetchTotalDisponibilidad error', e);
  }

  state.dispTotalCache.set(cacheKey, total);
  return total;
}

/* ---------- Footer total (solo registros visibles/página actual/filtrados) ---------- */
function ensureFooter(){
  const table = $('#tablaContactos');
  if (!table) return;
  if (!table.tFoot) {
    const tfoot = table.createTFoot();
    const tr = tfoot.insertRow(0);
    // 9 columnas
    for (let i=0; i<9; i++){
      const th = document.createElement('th');
      if (i === 6) th.textContent = 'Total página: 0'; // bajo "Tons" (índice 6)
      tr.appendChild(th);
    }
  }
}
function setFooterTotal(total){
  const table = $('#tablaContactos');
  if (!table || !table.tFoot) return;
  const th = table.tFoot.querySelectorAll('th')[6];
  if (th) th.textContent = `Total página: ${fmtCL(total)}`;
}

/* --------------------------------- DataTables --------------------------------- */
export function initTablaContactos() {
  const jq = window.jQuery || window.$;
  const tablaEl = $('#tablaContactos');
  if (!jq || !tablaEl) return;
  if (state.dt) return;

  ensureFooter();

  state.dt = jq('#tablaContactos').DataTable({
    dom: 'Blfrtip',
    buttons: [
      { extend: 'excelHtml5', title: 'Contactos_Abastecimiento' },
      { extend: 'pdfHtml5',   title: 'Contactos_Abastecimiento', orientation: 'landscape', pageSize: 'A4' }
    ],
    order: [[1,'desc']],      // ordenar por Fecha (col 1)
    paging: true,
    pageLength: 10,
    lengthMenu: [ [10, 25, 50, -1], [10, 25, 50, 'Todos'] ],
    autoWidth: false,
    responsive: true,
    scrollX: false,
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
    columnDefs: [
      { targets: 0, width: 60 },             // Semana
      { targets: 1, width: 110 },            // Fecha
      { targets: 2, width: 260 },            // Proveedor
      { targets: 8, orderable: false, searchable: false }, // Acciones
      { targets: 6, className: 'tright' },   // Tons derecha
    ]
  });

  // Delegación de acciones
  jq('#tablaContactos tbody')
    .off('click.contactos')
    .on('click.contactos', 'a.icon-action, .cell-actions .act', function(e){
      e.preventDefault();
      e.stopPropagation();
      _clickAccContacto(this);
    });

  // Recalcular celdas y footer en cada draw
  jq('#tablaContactos').on('draw.dt', async () => {
    await actualizarTonsVisiblesYFooter();
  });

  console.log('[contactos] DataTable lista. filas=', state.dt.rows().count());
}

/* ---------------------------- Actualizar celdas visibles ---------------------------- */
async function actualizarTonsVisiblesYFooter(){
  const jq = window.jQuery || window.$;
  if (!state.dt || !jq) return;

  state.dt.rows({ page: 'current', search: 'applied' }).every(function(){
    const cellNode = state.dt.cell(this, 6).node(); // columna Tons (índice 6)
    if (!cellNode) return;
    const span = cellNode.querySelector('.tons-cell');
    if (!span) return;

    const proveedorKey = span.dataset.provkey || '';
    const centroId     = span.dataset.centroid || '';
    const contactoId   = span.dataset.contactoid || '';

    if (span.dataset.value !== undefined && span.dataset.value !== null && span.dataset.value !== '') return;

    span.classList.add('loading');
    span.textContent = '…';

    fetchTotalDisponibilidad({ contactoId, proveedorKey, centroId }).then(total => {
      span.dataset.value = String(total);
      span.textContent = fmtCL(total);
      span.classList.remove('loading');
      recalcularFooterDesdeDom();
    });
  });

  // set inicial rápido con lo visible
  recalcularFooterDesdeDom();
}

function recalcularFooterDesdeDom(){
  const table = $('#tablaContactos');
  if (!table) return;
  const spans = table.querySelectorAll('tbody .tons-cell');
  let sum = 0;
  spans.forEach(sp => {
    const tr = sp.closest('tr');
    if (tr && tr.offsetParent !== null) sum += Number(sp.dataset.value || 0);
  });
  setFooterTotal(sum);
}

/* ------------------------------- Render de filas -------------------------------- */
export function renderTablaContactos() {
  const jq = window.jQuery || window.$;
  const tabla = $('#tablaContactos');
  if (!tabla) return;

  const base = Array.isArray(state.contactosGuardados) ? state.contactosGuardados : [];
  console.debug('[tablaContactos] render → items:', base.length, base[0]);

  // limpiar cache de totales
  if (state.dispTotalCache?.clear) state.dispTotalCache.clear();

  const filas = base
    .slice()
    .sort((a,b)=>{
      const da = new Date(a.createdAt || a.fecha || 0).getTime();
      const db = new Date(b.createdAt || b.fecha || 0).getTime();
      return db - da;
    })
    .map(c => {
      // Fecha
      const f = new Date(c.createdAt || c.fecha || Date.now());
      const yyyy = f.getFullYear();
      const mm   = String(f.getMonth() + 1).padStart(2, '0');
      const dd   = String(f.getDate()).padStart(2, '0');
      const whenDisplay = `${yyyy}-${mm}-${dd}`;
      const whenKey     = f.getTime();

      // Semana ISO
      const semana = wk(whenDisplay);

      // Centro (código) con fallback por centroId
      let centroCodigo = c.centroCodigo;
      if (!esCodigoValido(centroCodigo)) {
        centroCodigo = centroCodigoById(c.centroId) || '';
      }

      // Comuna
      const comuna = c.centroComuna || c.comuna || comunaPorCodigo(centroCodigo) || '';

      // Proveedor con elipsis + tooltip
      const provName = esc(c.proveedorNombre || '');
      const provCell = provName
        ? `<span class="ellipsisCell ellipsisProv" title="${provName}">${provName}</span>`
        : '';

      // MMPP
      const mmpp = c.tieneMMPP || '';

      // Tons (asíncrono)
      const tonsCell = `<span class="tons-cell" data-contactoid="${esc(c._id || '')}" data-provkey="${esc(c.proveedorKey || '')}" data-centroid="${esc(c.centroId || '')}" data-value=""></span>`;

      // Responsable
      const responsable = esc(c.responsable || '—');

      // Acciones (wrapper para que queden en una fila)
      const acciones = `
        <div class="cell-actions">
          <a href="#!" class="act icon-action ver" data-action="ver" title="Ver" data-id="${c._id}">
            <i class="material-icons">visibility</i>
          </a>
          <a href="#!" class="act icon-action visita" data-action="visita" title="Registrar visita" data-id="${c._id}">
            <i class="material-icons">event_available</i>
          </a>
          <a href="#!" class="act icon-action editar" data-action="editar" title="Editar" data-id="${c._id}">
            <i class="material-icons">edit</i>
          </a>
          <a href="#!" class="act icon-action eliminar" data-action="eliminar" title="Eliminar" data-id="${c._id}">
            <i class="material-icons">delete</i>
          </a>
        </div>
      `;

      // 9 columnas: Semana, Fecha, Proveedor, Centro, Comuna, MMPP, Tons, Responsable, Acciones
      return [
        esc(semana),
        `<span data-order="${whenKey}">${whenDisplay}</span>`,
        provCell,
        esc(centroCodigo),
        esc(comuna),
        esc(mmpp),
        tonsCell,
        responsable,
        acciones
      ];
    });

  if (state.dt && jq) {
    state.dt.clear();
    state.dt.rows.add(filas).draw(false);
    return;
  }

  // Fallback sin DataTables
  const tbody = $('#tablaContactos tbody');
  ensureFooter();
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="color:#888">No hay contactos registrados aún.</td></tr>`;
    setFooterTotal(0);
    return;
  }
  filas.forEach(arr => {
    const tr = document.createElement('tr');
    tr.innerHTML = arr.map(td => `<td>${td}</td>`).join('');
    tbody.appendChild(tr);
  });

  // Completar celdas + footer en fallback
  (async () => {
    const spans = tbody.querySelectorAll('.tons-cell');
    for (const sp of spans) {
      sp.classList.add('loading'); sp.textContent = '…';
      const total = await fetchTotalDisponibilidad({
        contactoId: sp.dataset.contactoid || '',
        proveedorKey: sp.dataset.provkey || '',
        centroId: sp.dataset.centroid || ''
      });
      sp.dataset.value = String(total);
      sp.textContent = fmtCL(total);
      sp.classList.remove('loading');
    }
    // total visible (todas las filas en fallback)
    let sum = 0;
    tbody.querySelectorAll('.tons-cell').forEach(s => sum += Number(s.dataset.value || 0));
    setFooterTotal(sum);
  })();
}

/* 🔁 refresco en vivo cuando otros módulos disparan reload */
document.addEventListener('reload-tabla-contactos', () => {
  console.debug('[tablaContactos] reload-tabla-contactos recibido');
  renderTablaContactos();
});
