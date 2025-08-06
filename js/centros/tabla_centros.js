// js/centros/tabla_centros.js

import { Estado } from '../core/estado.js';
import { getCentrosAll, getCentroById, updateCentro } from '../core/centros_repo.js';
import { calcularTotalesTabla } from './helpers_centros.js';
import { registerTablaCentrosEventos } from './eventos_centros.js';

// Lista de campos extra que queremos en el detalle (solo estos)
const detalleFields = [
  'coords',           // Coordenadas
  'region',           // Región
  'rutTitular',       // Rut Titular
  'nroPert',          // Nro. Pert
  'numeroResSSP',     // Número ResSSP
  'fechaResSSP',      // Fecha ResSSP
  'numeroResSSFFAA',  // Número ResSSFFAA
  'fechaResSSFFAA',   // Fecha ResSSFFAA
  'ubicacion',        // Ubicación
  'especies',         // Especies
  'grupoEspecie'      // Grupo Especie
];

// Etiquetas legibles para cada campo
const fieldLabels = {
  coords:           'Coordenadas',
  region:           'Región',
  rutTitular:       'Rut Titular',
  nroPert:          'Nro. Pert',
  numeroResSSP:     'Número ResSSP',
  fechaResSSP:      'Fecha ResSSP',
  numeroResSSFFAA:  'Número ResSSFFAA',
  fechaResSSFFAA:   'Fecha ResSSFFAA',
  ubicacion:        'Ubicación',
  especies:         'Especies',
  grupoEspecie:     'Grupo Especie'
};

// Genera y abre el modal de detalle con campos editables
function attachDetalleEvents() {
  $('#centrosTable').on('click', '.btn-detalle', async function() {
    const id = $(this).data('id');
    const centro = await getCentroById(id);

    // Construye el form con solo los campos de detalle
    let html = `<form id="formDetallesCentro">
                  <input type="hidden" name="_id" value="${centro._id}">`;

    detalleFields.forEach(key => {
      const val = centro[key];
      if (val == null) return;  // si no existe, saltar

      const label = fieldLabels[key];
      // coords es array de objetos {lat,lng}
      if (key === 'coords' && Array.isArray(val)) {
        const content = val.map(o => `${o.lat}, ${o.lng}`).join('\n');
        html += `
          <div class="input-field">
            <textarea name="coords" class="materialize-textarea">${content}</textarea>
            <label class="active">${label}</label>
          </div>`;
      }
      // arrays de strings u otros
      else if (Array.isArray(val)) {
        html += `
          <div class="input-field">
            <textarea name="${key}" class="materialize-textarea">${val.join('\n')}</textarea>
            <label class="active">${label}</label>
          </div>`;
      }
      // objetos (si tuvieras alguno aquí)
      else if (typeof val === 'object') {
        html += `
          <div class="input-field">
            <textarea name="${key}" class="materialize-textarea" readonly>${JSON.stringify(val, null, 2)}</textarea>
            <label class="active">${label}</label>
          </div>`;
      }
      // valores simples
      else {
        html += `
          <div class="input-field">
            <input name="${key}" type="text" value="${val}">
            <label class="active">${label}</label>
          </div>`;
      }
    });

    html += `</form>`;
    $('#detallesCentroBody').html(html);
    M.updateTextFields();  // refresca Materialize labels

    // abrir modal
    const modalElem = document.getElementById('modalDetallesCentro');
    M.Modal.getInstance(modalElem).open();
  });

  // Guardar los cambios
  $('#btnGuardarDetalle').off('click').on('click', async () => {
    const datos = {};
    $('#formDetallesCentro').serializeArray().forEach(({ name, value }) => {
      if (name === 'coords') {
        // reconstruir array de objetos {lat,lng}
        datos.coords = value
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => {
            const [lat, lng] = line.split(',').map(x => x.trim());
            return { lat, lng };
          });
      } else {
        datos[name] = value;
      }
    });

    try {
      await updateCentro(datos._id, datos);
      M.toast({ html: 'Detalles guardados', classes: 'green' });
      M.Modal.getInstance(document.getElementById('modalDetallesCentro')).close();
      await loadCentros();  // refresca la tabla
    } catch (e) {
      console.error(e);
      M.toast({ html: 'Error guardando detalles', classes: 'red' });
    }
  });
}

// Inicializa DataTable y registros de eventos
export function initTablaCentros() {
  const $t = window.$('#centrosTable');
  if (!$t.length) {
    console.error('No se encontró #centrosTable');
    return;
  }

  Estado.table = $t.DataTable({
    colReorder: true,
    dom: 'Bfrtip',
    buttons: [
      { extend: 'copyHtml5', footer: true, exportOptions: { columns: ':visible' } },
      { extend: 'csvHtml5',  footer: true, exportOptions: { columns: ':visible' } },
      { extend: 'excelHtml5',footer: true, exportOptions: { columns: ':visible' } },
      { extend: 'pdfHtml5',  footer: true, exportOptions: { columns: ':visible' } }
    ],
    searching: false,
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json' },
    footerCallback: calcularTotalesTabla
  });

  Estado.table.draw();
  registerTablaCentrosEventos();
  attachDetalleEvents();
}

// Carga datos y refresca DataTable
export async function loadCentros() {
  Estado.centros = await getCentrosAll();

  const rows = Estado.centros.map((c, i) => {
    const cantLineas = Array.isArray(c.lines) ? c.lines.length : 0;
    const hect = parseFloat(c.hectareas) || 0;
    const tonsDisponibles = Array.isArray(c.lines)
      ? c.lines.reduce((sum, l) => sum + (+l.tons || 0), 0)
      : 0;

    // cálculos de promedio…
    let sumUnKg=0, cntUnKg=0, sumRech=0, cntRech=0, sumRdm=0, cntRdm=0;
    if (Array.isArray(c.lines)) {
      c.lines.forEach(l => {
        if (l.unKg!=null && l.unKg!=='') { sumUnKg+=+l.unKg; cntUnKg++; }
        if (l.porcRechazo!=null && l.porcRechazo!=='') { sumRech+=+l.porcRechazo; cntRech++; }
        if (l.rendimiento!=null && l.rendimiento!=='') { sumRdm+=+l.rendimiento; cntRdm++; }
      });
    }
    const avgUnKg    = cntUnKg    ? sumUnKg/cntUnKg    : 0;
    const avgRechazo = cntRech     ? sumRech/cntRech    : 0;
    const avgRdmto   = cntRdm      ? sumRdm/cntRdm      : 0;

    const proveedor = (c.proveedor||'').toUpperCase();
    const comuna    = (c.comuna   ||'').toUpperCase();
    const coordsCell = `<i class="material-icons btn-detalle" data-id="${c._id}" style="cursor:pointer">visibility</i>`;
    const accionesCell = `
      <i class="material-icons btn-toggle-lineas" data-idx="${i}" style="cursor:pointer">visibility</i>
      <i class="material-icons editar-centro" data-idx="${i}" style="cursor:pointer">edit</i>
      <i class="material-icons eliminar-centro" data-idx="${i}" style="cursor:pointer">delete</i>`;

    return [
      proveedor,
      comuna,
      c.code       || '-',
      hect.toFixed(2),
      cantLineas,
      tonsDisponibles.toLocaleString('es-CL',{minimumFractionDigits:0}),
      avgUnKg.toFixed(2),
      avgRechazo.toFixed(1)+'%',
      avgRdmto.toFixed(1)+'%',
      coordsCell,
      accionesCell
    ];
  });

  Estado.table.clear().rows.add(rows).draw();

  if (Estado.lineAcordionOpen != null) {
    $('#centrosTable tbody tr').eq(Estado.lineAcordionOpen)
      .find('.btn-toggle-lineas').trigger('click');
  }
}
