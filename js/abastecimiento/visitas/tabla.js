// /js/abastecimiento/visitas/tabla.js
import { dtVisitas, setDtVisitas } from './state.js';

function fmtDate(d) {
  if (!d) return '';
  const f = new Date(d);
  const yyyy = f.getFullYear();
  const mm = String(f.getMonth() + 1).padStart(2, '0');
  const dd = String(f.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function renderTablaVisitas(rows = []) {
  const jq = window.jQuery || window.$;
  if (!jq) return;

  const data = (rows || []).map(r => ([
    fmtDate(r.fecha),
    r.proveedorNombre || '',
    r.centroCodigo || r.centroId || '',
    r.enAgua ?? '',
    r.estado || '',
    (r.tonsComprometidas ?? '') + '',
    r.observaciones || '',
    `
      <a href="#!" class="icon-action editar" data-id="${r._id}" title="Editar">
        <i class="material-icons">edit</i>
      </a>    
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

  const instance = jq('#tablaVisitas').DataTable({
    data,
    dom: 'Bfrtip',
    buttons: [
      { extend: 'excelHtml5', title: 'Visitas_Abastecimiento' },
      { extend: 'pdfHtml5',   title: 'Visitas_Abastecimiento', orientation: 'landscape', pageSize: 'A4' }
    ],
    order: [[0, 'desc']],
    pageLength: 25,
    autoWidth: false,
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
    columnDefs: [
      { targets: -1, orderable: false, searchable: false }
    ]
  });

  // guarda la instancia en el state para futuros reloads
  setDtVisitas(instance);
}

