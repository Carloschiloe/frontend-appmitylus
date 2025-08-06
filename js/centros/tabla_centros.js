// js/centros/tabla_centros.js
import { Estado } from '../core/estado.js';
import { getCentrosAll, getCentroById, updateCentro } from '../core/centros_repo.js';
import { calcularTotalesTabla } from './helpers_centros.js';
import { registerTablaCentrosEventos } from './eventos_centros.js';

// Helper para capitalizar tipo título
function toTitleCase(str) {
  return (str || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// Función para renderizar el formulario de detalle dentro del modal
function renderDetalleCentroForm(centro) {
  let html = `<form id="formDetalleCentro">`;
  // Campo oculto para el ID
  html += `<input type="hidden" id="_id" name="_id" value="${centro._id}">`;
  Object.entries(centro).forEach(([key, value]) => {
    if (key === '_id' || value == null) return;
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    if (Array.isArray(value)) {
      html += `
        <div class="input-field">
          <textarea id="${key}" name="${key}" class="materialize-textarea">${value.join('\n')}</textarea>
          <label class="active" for="${key}">${label}</label>
        </div>`;
    } else {
      html += `
        <div class="input-field">
          <input id="${key}" name="${key}" type="text" value="${value}">
          <label class="active" for="${key}">${label}</label>
        </div>`;
    }
  });
  html += `</form>`;
  $('#modalDetalleCentro .modal-content').html(html);
}

// Adjunta los eventos para abrir el modal y guardar los cambios
function attachDetalleEvents() {
  // Click en el icono "ojo" para detalle
  $('#centrosTable').on('click', '.btn-detalle', async function() {
    const id = $(this).data('id');
    const centro = await getCentroById(id);
    renderDetalleCentroForm(centro);
    M.updateTextFields(); // refresca labels
    // Ajuste de textarea
    $('#formDetalleCentro textarea').each(function() {
      M.textareaAutoResize($(this));
    });
    M.Modal.getInstance($('#modalDetalleCentro')).open();
  });

  // Click en "Guardar" dentro del modal
  $('#btnGuardarDetalle').on('click', async () => {
    const datos = {};
    $('#formDetalleCentro').serializeArray().forEach(({name, value}) => {
      datos[name] = name === 'coords'
        ? value.split('\n').map(s => s.trim()).filter(s => s)
        : value;
    });
    try {
      const id = datos._id;
      await updateCentro(id, datos);
      M.toast({ html: 'Guardado exitoso' });
      M.Modal.getInstance($('#modalDetalleCentro')).close();
      // Refresca toda la tabla
      await loadCentros();
    } catch (err) {
      console.error(err);
      M.toast({ html: 'Error al guardar cambios' });
    }
  });
}

// Inicializa la tabla y la configura
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
      { extend: 'copyHtml5', footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } },
      { extend: 'csvHtml5', footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } },
      { extend: 'excelHtml5', footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } },
      { extend: 'pdfHtml5', footer: true, exportOptions: { columns: ':visible', modifier: { page: 'all' } } },
    ],
    searching: false,
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json' },
    footerCallback: calcularTotalesTabla
  });

  Estado.table.draw();
  registerTablaCentrosEventos();
  attachDetalleEvents();
}

// Recarga todos los centros y refresca la tabla
export async function loadCentros() {
  Estado.centros = await getCentrosAll();

  const rows = Estado.centros.map((c, i) => {
    const cantLineas = Array.isArray(c.lines) ? c.lines.length : 0;
    const hect = parseFloat(c.hectareas) || 0;

    // SUMA de toneladas (todas las líneas)
    const tonsDisponibles = Array.isArray(c.lines)
      ? c.lines.reduce((sum, l) => sum + (+l.tons || 0), 0)
      : 0;

    // PROMEDIO Un/Kg, % Rechazo y Rdmto (solo si hay líneas)
    let sumUnKg = 0, countUnKg = 0;
    let sumRechazo = 0, countRechazo = 0;
    let sumRdmto = 0, countRdmto = 0;
    if (Array.isArray(c.lines)) {
      c.lines.forEach(l => {
        if (l.unKg != null && l.unKg !== '') {
          sumUnKg += parseFloat(l.unKg) || 0;
          countUnKg++;
        }
        if (l.porcRechazo != null && l.porcRechazo !== '') {
          sumRechazo += parseFloat(l.porcRechazo) || 0;
          countRechazo++;
        }
        if (l.rendimiento != null && l.rendimiento !== '') {
          sumRdmto += parseFloat(l.rendimiento) || 0;
          countRdmto++;
        }
      });
    }
    const avgUnKg = countUnKg ? (sumUnKg / countUnKg) : 0;
    const avgRechazo = countRechazo ? (sumRechazo / countRechazo) : 0;
    const avgRdmto = countRdmto ? (sumRdmto / countRdmto) : 0;

    // Aquí se capitaliza siempre
    const proveedor = toTitleCase(c.proveedor) || '-';
    const comuna    = toTitleCase(c.comuna)   || '-';

    // Cambia btn-coords a btn-detalle y data-id con _id
    const coordsCell = `<i class="material-icons btn-detalle" data-id="${c._id}" style="cursor:pointer">visibility</i>`;
    const accionesCell = `
      <i class="material-icons btn-toggle-lineas" data-idx="${i}" style="cursor:pointer">visibility</i>
      <i class="material-icons editar-centro" data-idx="${i}" style="cursor:pointer">edit</i>
      <i class="material-icons eliminar-centro" data-idx="${i}" style="cursor:pointer">delete</i>`;

    return [
      proveedor,
      comuna,
      c.code || '-',
      hect.toFixed(2),
      cantLineas,
      tonsDisponibles.toLocaleString('es-CL', { minimumFractionDigits: 0 }),
      avgUnKg.toFixed(2),
      avgRechazo.toFixed(1) + '%',
      avgRdmto.toFixed(1) + '%',
      coordsCell,
      accionesCell
    ];
  });

  Estado.table.clear().rows.add(rows).draw();

  if (Estado.lineAcordionOpen !== null && Estado.centros[Estado.lineAcordionOpen]) {
    const tr = $('#centrosTable tbody tr').eq(Estado.lineAcordionOpen);
    tr.find('.btn-toggle-lineas').trigger('click');
  }
}
