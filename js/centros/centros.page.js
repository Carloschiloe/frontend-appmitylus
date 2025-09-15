// /js/centros/centros.page.js — Directorio + integra mapa de /js/mapas/*
import { initMapa, renderMapaAlways } from '../mapas/control_mapa.js';
import { cargarYRenderizarCentros, focusCentroInMap } from '../mapas/mapa.js';

const API_BASE = window.API_URL || '/api';
let centrosCache = [];
let dt;

// ========= Materialize init =========
document.addEventListener('DOMContentLoaded', () => {
  const tabsEl = document.getElementById('tabs');
  if (tabsEl) M.Tabs.init(tabsEl);

  M.Modal.init(document.querySelectorAll('.modal'));

  document.getElementById('btnOpenCentroModal')?.addEventListener('click', () => {
    M.Modal.getInstance(document.getElementById('centroModal')).open();
  });
  document.getElementById('btnOpenImportarModal')?.addEventListener('click', () => {
    M.Modal.getInstance(document.getElementById('modalImportarCentros')).open();
  });

  // 👉 usa tu mapa
  initMapa();

  cargarCentros();
});

// ========= Fetch =========
async function cargarCentros() {
  try {
    const res = await fetch(`${API_BASE}/centros`);
    const data = await res.json();
    const arr = Array.isArray(data) ? data : (data.items || []);

    // Normaliza a tu modelo de mapa (coords: [{lat,lng}], lines: [])
    centrosCache = arr.map((x, idx) => {
      const polygon = x.polygon || x.coordenadas || x.coordinates || x.coords || [];
      const coords = Array.isArray(polygon)
        ? (Array.isArray(polygon[0]) ? polygon : []) // [[lat,lng],...]
            .map(([lat, lng]) => ({ lat: Number(lat), lng: Number(lng) }))
        : [];

      // lines puede venir como lineas o similar
      const lines = Array.isArray(x.lines) ? x.lines
                  : Array.isArray(x.lineas) ? x.lineas
                  : [];

      return {
        // para la tabla
        id: x._id || x.id || String(idx),
        proveedor: x.proveedorNombre || x.proveedor || '',
        comuna: x.comuna || '',
        codigo: x.codigo || x.code || '',
        hectareas: Number(x.hectareas ?? x.ha ?? 0),
        lineas: Number(x.lineas ?? (Array.isArray(lines) ? lines.length : 0)),
        tons: Number(x.tons ?? 0),
        unkg: Number(x.unKg ?? x.unkg ?? 0),
        rechazo: Number(x.rechazoPct ?? x.rechazo ?? 0),
        rdmto: Number(x.rendimiento ?? x.rdmto ?? 0),

        // para TU mapa
        name: x.nombre || x.name || (x.codigo || x.code || 'Centro'),
        code: x.codigo || x.code || '',
        hectareasMapa: Number(x.hectareas ?? x.ha ?? 0), // tu popup lo usa como hectáreas
        lines,          // array (si viene)
        coords          // [{lat,lng}, ...]
      };
    });

    pintarTabla(centrosCache);

    // 👉 Pinta en TU mapa y refresca
    cargarYRenderizarCentros(
      centrosCache.map(c => ({
        name: c.name,
        proveedor: c.proveedor,
        code: c.code,
        hectareas: c.hectareasMapa,
        lines: c.lines,
        coords: c.coords
      }))
    );
    renderMapaAlways(true);

    renderKPIs(centrosCache);
  } catch (err) {
    console.error('Error cargando centros', err);
    M.toast({ html: 'No se pudo cargar centros', classes: 'red' });
  }
}

// ========= DataTable =========
function pintarTabla(rows) {
  const table = $('#centrosTable');
  if (dt) dt.destroy();

  dt = table.DataTable({
    data: rows,
    responsive: true,
    colReorder: true,
    dom: 'Bfrtip',
    buttons: ['copy', 'csv', 'excel', 'pdf'],
    pageLength: 25,
    order: [[0, 'asc']],
    columns: [
      { data: 'proveedor' },
      { data: 'comuna' },
      { data: 'codigo' },
      { data: 'hectareas', render: v => fmtNum(v, 2), className: 'right-align' },
      { data: 'lineas', className: 'right-align' },
      { data: 'tons', className: 'right-align' },
      { data: 'unkg', className: 'right-align' },
      { data: 'rechazo', render: v => fmtNum(v, 1) + '%', className: 'right-align' },
      { data: 'rdmto', render: v => fmtNum(v, 1) + '%', className: 'right-align' },
      { data: null, orderable: false, render: (_, __, row, meta) =>
          `<a class="btn-flat waves-effect" data-idx="${meta.row}" title="Ver en mapa">
             <i class="material-icons">visibility</i>
           </a>`
      },
      { data: null, orderable: false, render: () =>
          `<a class="btn-flat"><i class="material-icons">edit</i></a>
           <a class="btn-flat"><i class="material-icons">delete</i></a>`
      }
    ],
    drawCallback: () => actualizarTotales(rows)
  });

  // Click en detalle → foco en TU mapa usando el índice
  table.on('click', 'a[data-idx]', (e) => {
    const idx = Number(e.currentTarget.getAttribute('data-idx'));
    const tabs = M.Tabs.getInstance(document.getElementById('tabs'));
    if (tabs) tabs.select('tab-mapa');
    // give time to render
    setTimeout(() => focusCentroInMap(idx), 120);
  });
}

function actualizarTotales(rows) {
  const sum = (k) => rows.reduce((a, b) => a + Number(b[k] || 0), 0);
  $('#totalHect').text(fmtNum(sum('hectareas'), 2));
  $('#totalLineas').text(fmtNum(sum('lineas'), 0));
  $('#totalTons').text(fmtNum(sum('tons'), 0));
  $('#totalUnKg').text(fmtNum(sum('unkg'), 0));
  $('#totalRechazo').text(fmtNum(sum('rechazo') / Math.max(rows.length, 1), 1) + '%');
  $('#totalRdmto').text(fmtNum(sum('rdmto') / Math.max(rows.length, 1), 1) + '%');
}

function renderKPIs(rows) {
  const sum = (k) => rows.reduce((a, b) => a + Number(b[k] || 0), 0);
  const chips = [
    { icon: 'terrain', label: 'Hectáreas', v: fmtNum(sum('hectareas'), 2) },
    { icon: 'linear_scale', label: 'Líneas', v: fmtNum(sum('lineas'), 0) },
    { icon: 'local_shipping', label: 'Tons', v: fmtNum(sum('tons'), 0) }
  ];
  const wrap = document.getElementById('kpiChips');
  wrap.innerHTML = chips.map(c =>
    `<span class="chip"><i class="material-icons">${c.icon}</i>${c.label}: <b>${c.v}</b></span>`
  ).join('');
}

// ========= utils =========
function fmtNum(n, d = 0) {
  n = Number.isFinite(n) ? n : 0;
  return n.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
}
