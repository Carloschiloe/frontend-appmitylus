import { Estado } from '../core/estado.js';
import {
  getCentrosAll,
  addLinea,
  updateLinea,
  deleteLinea,
  deleteCentro
} from '../core/centros_repo.js';
import { renderAcordeonLineas } from './lineas.js';
import { renderMapaAlways } from '../mapas/control_mapa.js';
import { tabMapaActiva } from '../core/utilidades_app.js';
import { openEditForm, renderPointsTable } from './centros_form.js';

// INICIALIZA LA TABLA
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
      {
        extend: 'copyHtml5',
        footer: true,
        exportOptions: { columns: ':visible', modifier: { page: 'all' } }
      },
      {
        extend: 'csvHtml5',
        footer: true,
        exportOptions: { columns: ':visible', modifier: { page: 'all' } }
      },
      {
        extend: 'excelHtml5',
        footer: true,
        exportOptions: { columns: ':visible', modifier: { page: 'all' } }
      },
      {
        extend: 'pdfHtml5',
        footer: true,
        exportOptions: { columns: ':visible', modifier: { page: 'all' } }
      }
    ],
    searching: false,
    language: {
      url: 'https://cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json'
    },
    footerCallback: function () {
      let sumH = 0, sumL = 0, sumTon = 0;
      Estado.centros.forEach(c => {
        sumH += parseFloat(c.hectareas) || 0;
        sumL += Array.isArray(c.lines) ? c.lines.length : 0;
        sumTon += Array.isArray(c.lines) ? c.lines.reduce((s, l) => s + (+l.tons || 0), 0) : 0;
      });
      const h = document.getElementById('totalHect');
      const l = document.getElementById('totalLineas');
      const t = document.getElementById('totalTon');
      if (h && l && t) {
        h.textContent = sumH.toFixed(2);
        l.textContent = sumL;
        t.textContent = sumTon.toLocaleString('es-CL', { minimumFractionDigits: 0 });
      }
    }
  });

  Estado.table.draw();

  // Eventos delegados (igual que antes)...
  const $t2 = window.$('#centrosTable');

  // Ver coordenadas (mantiene el botón)
  $t2
    .off('click', '.btn-coords')
    .on('click', '.btn-coords', function () {
      const idx = +this.dataset.idx;
      const c = Estado.centros[idx];
      const modal = document.getElementById('modalCoordenadas');
      if (c && modal) {
        document.getElementById('coordenadasList').innerHTML =
          c.coords.map((p, i) =>
            `<div>${i + 1}. Lat: <b>${p.lat.toFixed(6)}</b> – Lng: <b>${p.lng.toFixed(6)}</b></div>`
          ).join('');
        M.Modal.getInstance(modal).open();
      }
    });

  // Abrir/colapsar líneas (acordeón)
  $t2
    .off('click', '.btn-toggle-lineas')
    .on('click', '.btn-toggle-lineas', function () {
      const idx = +this.dataset.idx;
      const tr = $(this).closest('tr');
      const row = Estado.table.row(tr);

      if (row.child.isShown()) {
        row.child.hide();
        tr.removeClass('shown');
        return;
      }

      Estado.table.rows().every(function () {
        if (this.child.isShown()) {
          $(this.node()).removeClass('shown');
          this.child.hide();
        }
      });

      const lineasHtml = renderAcordeonLineas(idx, Estado.centros, Estado.editingLine);

      row.child(`<div class="child-row-lineas">${lineasHtml}</div>`).show();
      tr.addClass('shown');

      const acordeonCont = tr.next().find('.child-row-lineas')[0];
      if (acordeonCont) {
        const selects = acordeonCont.querySelectorAll('select');
        if (selects.length) M.FormSelect.init(selects);

        const inputBuscar = acordeonCont.querySelector('#inputBuscarLineas');
        if (inputBuscar) inputBuscar.addEventListener('input', () => filtrarLineas(acordeonCont));

        attachLineasListeners(idx, acordeonCont);
      }
    });

  // Editar centro
  $t2
    .off('click', '.editar-centro')
    .on('click', '.editar-centro', function () {
      const idx = +this.dataset.idx;
      Estado.currentCentroIdx = idx;
      const modalElem = document.getElementById('centroModal');
      const modal = M.Modal.getInstance(modalElem);
      const els = {
        formTitle: document.getElementById('formTitle'),
        inputCentroId: document.getElementById('inputCentroId'),
        inputName: document.getElementById('inputName'),
        inputEmpresa: document.getElementById('inputEmpresa'),
        inputCode: document.getElementById('inputCode'),
        inputHectareas: document.getElementById('inputHectareas'),
        inputLat: document.getElementById('inputLat'),
        inputLng: document.getElementById('inputLng'),
        pointsBody: document.getElementById('pointsBody')
      };
      openEditForm(els, Estado.map, (Estado.currentPoints = []), v => (Estado.currentCentroIdx = v));
      renderPointsTable(els.pointsBody, Estado.currentPoints);
      modal.open();
    });

  // Eliminar centro
  $t2
    .off('click', '.eliminar-centro')
    .on('click', '.eliminar-centro', async function () {
      const idx = +this.dataset.idx;
      const c = Estado.centros[idx];
      if (!c) return;
      if (confirm(`¿Eliminar el centro "${c.name}"?`)) {
        await deleteCentro(c._id);
        await loadCentros();
        if (tabMapaActiva()) renderMapaAlways(true);
      }
    });
}

// LISTENERS DE LÍNEAS DENTRO DEL ACORDEÓN
function attachLineasListeners(idx, acordeonCont) {
  // ... Igual a como lo tienes, sin referencia a boyas ...
}

export async function loadCentros() {
  Estado.centros = await getCentrosAll();

  const rows = Estado.centros.map((c, i) => {
    const cantLineas = Array.isArray(c.lines) ? c.lines.length : 0;
    const hect = parseFloat(c.hectareas) || 0;
    const tonsDisponibles = Array.isArray(c.lines)
      ? c.lines.reduce((sum, l) => sum + (+l.tons || 0), 0)
      : 0;
    const empresa = c.empresa || c.proveedor || '-';

    // OJO: SOLO NÚMERO en toneladas, SIN botón ni ícono
    return [
      c.name,
      empresa,
      c.code || '-',
      hect.toFixed(2),
      cantLineas,
      tonsDisponibles.toLocaleString('es-CL', { minimumFractionDigits: 0 }),
      `<button class="btn-small teal btn-coords" data-idx="${i}">Ver</button>`,
      `<button class="btn-small blue btn-toggle-lineas" data-idx="${i}">Ver Líneas</button>
       <button class="btn-small orange editar-centro" data-idx="${i}">Editar</button>
       <button class="btn-small red eliminar-centro" data-idx="${i}">&times;</button>`
    ];
  });

  Estado.table.clear().rows.add(rows).draw();

  if (Estado.lineAcordionOpen !== null && Estado.centros[Estado.lineAcordionOpen]) {
    const tr = $('#centrosTable tbody tr').eq(Estado.lineAcordionOpen);
    tr.find('.btn-toggle-lineas').trigger('click');
  }

  if (tabMapaActiva()) renderMapaAlways();
}

export function filtrarLineas(contenedor) {
  const cont = contenedor || document;
  const txt = (cont.querySelector('#inputBuscarLineas')?.value || '').toLowerCase();
  cont.querySelectorAll('table.striped tbody tr').forEach(fila => {
    const num = (fila.cells[0]?.textContent || '').toLowerCase();
    const est = (fila.cells[4]?.textContent || '').toLowerCase();
    const okTxt = num.includes(txt) || est.includes(txt);
    fila.style.display = okTxt ? '' : 'none';
  });
}

