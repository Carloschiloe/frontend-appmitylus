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
      let sumH = 0, sumB = 0, sumL = 0;
      Estado.centros.forEach(c => {
        sumH += parseFloat(c.hectareas) || 0;
        sumB += Array.isArray(c.lines)
          ? c.lines.reduce((s, l) => s + (+l.buoys || 0), 0)
          : 0;
        sumL += Array.isArray(c.lines) ? c.lines.length : 0;
      });
      const h = document.getElementById('totalHect');
      const b = document.getElementById('totalBoyas');
      const l = document.getElementById('totalLineas');
      if (h && b && l) {
        h.textContent = sumH.toFixed(2);
        b.textContent = sumB;
        l.textContent = sumL;
      }
    }
  });

  Estado.table.draw();

  const $t2 = window.$('#centrosTable');

  // Ver coordenadas
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
  // Eliminar línea
  const tbody = acordeonCont.querySelector('table.striped tbody');
  if (tbody) {
    tbody.querySelectorAll('.btn-del-line').forEach(btn => {
      btn.onclick = async () => {
        const lineIdx = +btn.dataset.lineIdx;
        const centro = Estado.centros[idx];
        const linea = centro.lines[lineIdx];
        if (!linea) return;
        if (confirm(`¿Eliminar la línea ${linea.number}?`)) {
          await deleteLinea(centro._id, linea._id);
          await loadCentros();
          if (tabMapaActiva()) renderMapaAlways(true);
        }
      };
    });

    // Editar línea
    tbody.querySelectorAll('.btn-edit-line').forEach(btn => {
      btn.onclick = () => {
        Estado.editingLine = { idx: idx, lineIdx: +btn.dataset.lineIdx };
        // Fuerza refresco SOLO del acordeón abierto
        const tr = $('#centrosTable tbody tr').eq(idx);
        tr.find('.btn-toggle-lineas').trigger('click');
        tr.find('.btn-toggle-lineas').trigger('click'); // Vuelve a abrir el acordeón en modo edición
      };
    });

    // Cancelar edición de línea
    tbody.querySelectorAll('.btn-cancel-edit-line').forEach(btn => {
      btn.onclick = () => {
        Estado.editingLine = { idx: null, lineIdx: null };
        const tr = $('#centrosTable tbody tr').eq(idx);
        tr.find('.btn-toggle-lineas').trigger('click');
        tr.find('.btn-toggle-lineas').trigger('click');
      };
    });

    // Guardar edición de línea
    tbody.querySelectorAll('.btn-guardar-edit-line').forEach(btn => {
      btn.onclick = async () => {
        const trFila = btn.closest('tr');
        const num = trFila.querySelector('.edit-line-num').value.trim();
        const boy = parseInt(trFila.querySelector('.edit-line-buoys').value, 10);
        const long = parseFloat(trFila.querySelector('.edit-line-long').value);
        const cab = trFila.querySelector('.edit-line-cable').value.trim();
        const st = trFila.querySelector('.edit-line-state').value;
        if (!num || isNaN(boy) || isNaN(long) || !cab || !st) {
          M.toast({ html: 'Completa todos los campos', classes: 'red' });
          return;
        }
        const centro = Estado.centros[idx];
        const linea = centro.lines[+btn.dataset.lineIdx];
        await updateLinea(centro._id, linea._id, { number: num, buoys: boy, longitud: long, cable: cab, state: st });
        Estado.editingLine = { idx: null, lineIdx: null };
        const tr = $('#centrosTable tbody tr').eq(idx);
        tr.find('.btn-toggle-lineas').trigger('click');
        tr.find('.btn-toggle-lineas').trigger('click');
      };
    });
  }

  // Agregar línea nueva
  const formAdd = acordeonCont.querySelector('.form-inline-lineas');
  if (formAdd) {
    formAdd.onsubmit = async (e) => {
      e.preventDefault();
      const num = formAdd.querySelector('.line-num').value.trim();
      const boy = parseInt(formAdd.querySelector('.line-buoys').value, 10);
      const long = parseFloat(formAdd.querySelector('.line-long').value);
      const cab = formAdd.querySelector('.line-cable').value.trim();
      const st = formAdd.querySelector('.line-state').value;
      if (!num || isNaN(boy) || isNaN(long) || !cab || !st) {
        M.toast({ html: 'Completa todos los campos', classes: 'red' });
        return;
      }
      const centro = Estado.centros[idx];
      await addLinea(centro._id, { number: num, buoys: boy, longitud: long, cable: cab, state: st });
      formAdd.reset();
      // Recarga solo el child row de ese centro
      const tr = $('#centrosTable tbody tr').eq(idx);
      tr.find('.btn-toggle-lineas').trigger('click');
      tr.find('.btn-toggle-lineas').trigger('click');
    };
  }
}

export async function loadCentros() {
  Estado.centros = await getCentrosAll();

  const rows = Estado.centros.map((c, i) => {
    const totalBoyas = Array.isArray(c.lines)
      ? c.lines.reduce((sum, l) => sum + (+l.buoys || 0), 0)
      : 0;
    const cantLineas = Array.isArray(c.lines) ? c.lines.length : 0;
    const hect = parseFloat(c.hectareas) || 0;

    const coordsCell = `<i class="material-icons btn-coords" data-idx="${i}" style="cursor:pointer">visibility</i>`;
    const accionesCell = `
      <i class="material-icons btn-toggle-lineas" data-idx="${i}" style="cursor:pointer">visibility</i>
      <i class="material-icons editar-centro" data-idx="${i}" style="cursor:pointer">edit</i>
      <i class="material-icons eliminar-centro" data-idx="${i}" style="cursor:pointer">delete</i>`;

    return [
      c.name,
      c.code || '-',
      hect.toFixed(2),
      totalBoyas,
      cantLineas,
      coordsCell,
      accionesCell
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
