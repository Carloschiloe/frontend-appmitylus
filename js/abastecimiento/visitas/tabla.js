// /js/abastecimiento/visitas/tabla.js
import { dtVisitas } from './state.js';

export function renderTablaVisitas(rows) {
  const jq = window.jQuery || window.$;
  const table = jq('#tablaVisitas');

  const data = rows.map(r => ([
    r.fecha,
    r.proveedor || '',
    r.centro || '',
    r.actividad || '',
    r.proximoPaso || '',
    r.tons || '',
    r.observaciones || '',
    `
    <a href="#!" class="icon-action eliminar" data-id="${r._id}" title="Eliminar">
      <i class="material-icons">delete</i>
    </a>
    `
  ]));

  if (dtVisitas) {
    dtVisitas.clear();
    dtVisitas.rows.add(data).draw();
    return;
  }

  window.dtVisitas = jq('#tablaVisitas').DataTable({
    data,
    dom: 'Bfrtip',
    buttons: [
      { extend: 'excelHtml5', title: 'Visitas' },
      { extend: 'pdfHtml5',   title: 'Visitas', orientation: 'landscape', pageSize: 'A4' }
    ],
    order: [[0, 'desc']],
    pageLength: 25,
    autoWidth: false,
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
    columnDefs: [
      { targets: -1, orderable: false, searchable: false }
    ]
  });
}
