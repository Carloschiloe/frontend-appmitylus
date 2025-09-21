// js/centros/tabla_centros.js
import { Estado } from '../core/estado.js';
import { getCentrosAll } from '../core/centros_repo.js';
import { registerTablaCentrosEventos } from './eventos_centros.js';

/* ===== Utils ===== */
const fmt2 = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc  = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toTitleCase = (str)=> (str || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const num = (v)=> (v === '' || v == null) ? 0 : (Number(v) || 0);
const debounce = (fn, ms=250) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

/* ===== Estado local de filtros ===== */
Estado.filtroComuna = Estado.filtroComuna || '';
Estado.filtroTexto  = Estado.filtroTexto  || ''; // busca por proveedor O código

/* ===== Footer (usa colección filtrada actual) ===== */
function setFooter({ hectareas=0, total=0 }){
  const elTotalCentros = document.getElementById('totalCentros');
  const elHect = document.getElementById('totalHect');
  if (elTotalCentros) elTotalCentros.textContent = String(total);
  if (elHect) elHect.textContent = hectareas.toFixed(2);
}

/* ===== KPIs arriba (coinciden con el filtro) ===== */
function setKpis(filtered){
  const kCentros = document.getElementById('kpiCentros');
  const kHa      = document.getElementById('kpiHectareas');
  const kComunas = document.getElementById('kpiComunas');
  const ha = filtered.reduce((s,c)=> s + num(c.hectareas), 0);
  const comunas = new Set(filtered.map(c => (c.comuna || '').trim()).filter(Boolean));
  if (kCentros)  kCentros.textContent  = String(filtered.length);
  if (kHa)       kHa.textContent       = ha.toFixed(2);
  if (kComunas)  kComunas.textContent  = String(comunas.size);
}

/* ===== Construcción de opciones de comuna ===== */
function fillComunasSelect(centros){
  const sel = document.getElementById('filtroComuna');
  if (!sel) return;
  const prev = Estado.filtroComuna;
  const set = new Set();
  centros.forEach(c=>{ const v=(c.comuna||'').trim(); if(v) set.add(v); });
  const opts = ['<option value="">Todas las comunas</option>']
    .concat([...set].sort().map(c => `<option value="${esc(c)}">${esc(c)}</option>`))
    .join('');
  sel.innerHTML = opts;
  sel.value = prev || '';
}

/* ===== Aplicar filtros a la colección ===== */
function applyFilters(list){
  const txt = (Estado.filtroTexto || '').trim().toLowerCase();
  const com = (Estado.filtroComuna || '').trim();
  return (list || []).filter(c => {
    const okComuna = !com || (c.comuna || '') === com;
    if (!txt) return okComuna;
    const proveedor = (c.proveedor || '').toString().toLowerCase();
    const codigo    = (c.code || c.codigo_centro || '').toString().toLowerCase();
    return okComuna && (proveedor.includes(txt) || codigo.includes(txt));
  });
}

/* ===== DataTable ===== */
export function initTablaCentros() {
  const $t = window.$('#centrosTable');
  if (!$t.length) { console.error('No se encontró #centrosTable'); return; }

  Estado.table = $t.DataTable({
    colReorder: true,
    dom: 'Bfrtip',
    buttons: [
      { extend: 'copyHtml5',  footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } },
      { extend: 'csvHtml5',   footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } },
      { extend: 'excelHtml5', footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } },
      { extend: 'pdfHtml5',   footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } }
    ],
    searching: false, // usamos filtros custom
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json' },
    columnDefs: [
      { targets: [3], className: 'dt-right' },                // hectáreas derecha
      { targets: [4,5], orderable: false, searchable: false } // detalle/acciones
    ]
  });

  Estado.table.draw();
  wireFiltroUI();          // ← engancha los inputs
  registerTablaCentrosEventos();
}

/* ===== UI de filtros ===== */
function wireFiltroUI(){
  const selComuna = document.getElementById('filtroComuna');
  const inputTxt  = document.getElementById('buscarProveedor')    // nombre viejo
                    || document.getElementById('buscarCentro')    // alterno
                    || document.getElementById('inputBuscar');    // fallback

  const btnClear  = document.getElementById('btnLimpiarFiltros');

  if (selComuna) {
    selComuna.addEventListener('change', () => {
      Estado.filtroComuna = selComuna.value || '';
      // reconstruimos tabla desde dataset original
      buildTableFrom(Estado.centros);
    });
  }

  if (inputTxt) {
    const onTxt = debounce(() => {
      Estado.filtroTexto = inputTxt.value || '';
      buildTableFrom(Estado.centros);
    }, 200);
    inputTxt.addEventListener('input', onTxt);
  }

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      Estado.filtroComuna = '';
      Estado.filtroTexto  = '';
      if (selComuna) selComuna.value = '';
      if (inputTxt)  inputTxt.value  = '';
      buildTableFrom(Estado.centros);
    });
  }
}

/* ===== Construye la tabla (aplica filtros + KPIs + footer) ===== */
function buildTableFrom(allCentros){
  const filtered = applyFilters(allCentros || []);
  setKpis(filtered);

  const rows = filtered.map((c, i) => {
    const proveedor = toTitleCase(c.proveedor) || '-';
    const comuna    = toTitleCase(c.comuna)    || '-';
    const codigo    = c.code || c.codigo_centro || '-';
    const hect      = (c.hectareas ?? '') === '' ? '' : fmt2.format(Number(c.hectareas) || 0);

    const coordsCell = `
      <i class="material-icons btn-coords"
         data-idx="${i}"
         style="cursor:pointer"
         title="Ver detalles"
         aria-label="Ver detalles"
         role="button"
         tabindex="0">visibility</i>`;

    const accionesCell = `
      <i class="material-icons btn-ver-mapa"
         data-idx="${i}"
         style="cursor:pointer"
         title="Ver en mapa"
         aria-label="Ver en mapa"
         role="button"
         tabindex="0">map</i>
      <i class="material-icons editar-centro"
         data-idx="${i}"
         style="cursor:pointer"
         title="Editar centro"
         aria-label="Editar centro"
         role="button"
         tabindex="0">edit</i>
      <i class="material-icons eliminar-centro"
         data-idx="${i}"
         style="cursor:pointer;color:#e53935"
         title="Eliminar centro"
         aria-label="Eliminar centro"
         role="button"
         tabindex="0">delete</i>`;

    return [esc(proveedor), esc(comuna), esc(codigo), hect, coordsCell, accionesCell];
  });

  Estado.table.clear().rows.add(rows).draw();

  // footer según filtrado
  const hectFiltered = filtered.reduce((s,c)=> s + num(c.hectareas), 0);
  setFooter({ hectareas: hectFiltered, total: filtered.length });
}

/* ===== API ===== */
export async function loadCentros(data) {
  if (!Estado.table) { console.warn('DataTable no inicializada aún'); return; }

  try {
    Estado.centros = Array.isArray(data) ? data : await getCentrosAll();
    fillComunasSelect(Estado.centros);
    buildTableFrom(Estado.centros);
  } catch (e) {
    console.error('Error cargando centros:', e);
    window.M?.toast?.({ html: 'Error cargando centros', classes: 'red' });
  }
}
