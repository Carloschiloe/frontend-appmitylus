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
import { actualizarSelectsFiltro, refrescarEventos } from '../calendario/calendario.js';
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
      // Recalcula totales de todos los centros
      let sumH = 0, sumB = 0, sumL = 0;
      Estado.centros.forEach(c => {
        sumH += parseFloat(c.hectareas) || 0;
        sumB += Array.isArray(c.lines)
          ? c.lines.reduce((s, l) => s + (+l.buoys || 0), 0)
          : 0;
        sumL += Array.isArray(c.lines) ? c.lines.length : 0;
      });
      // Actualiza <tfoot>
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

  // Forzar un primer draw para invocar footerCallback
  Estado.table.draw();

  // Delegados en tabla general
  const $t2 = window.$('#centrosTable');

  // Coordenadas
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

  // Mostrar/ocultar líneas del centro (child row)
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

      // Cierra otros child rows abiertos (solo uno a la vez)
      Estado.table.rows().every(function () {
        if (this.child.isShown()) {
          $(this.node()).removeClass('shown');
          this.child.hide();
        }
      });

      // Renderiza el HTML de las líneas de ese centro (SIN TAREAS)
      const lineasHtml = renderAcordeonLineas(idx, Estado.centros, Estado.editingLine);

      // Abre el child row justo debajo de la fila del centro
      row.child(`<div class="child-row-lineas">${lineasHtml}</div>`).show();
      tr.addClass('shown');

      // Inicializa selects/materialize dentro del acordeón
      const acordeonCont = tr.next().find('.child-row-lineas')[0];
      if (acordeonCont) {
        // Materialize selects
        const selects = acordeonCont.querySelectorAll('select');
        if (selects.length) M.FormSelect.init(selects);

        // Filtro de líneas por texto (buscar por número de línea)
        const inputBuscar = acordeonCont.querySelector('#inputBuscarLineas');
        if (inputBuscar) inputBuscar.addEventListener('input', () => filtrarLineas(acordeonCont));

        // Delegados dentro del acordeón (eliminar, editar, guardar, cancelar)
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
        refrescarEventos();
      }
    });
}

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
          refrescarEventos();
        }
      };
    });

    // Editar línea
    tbody.querySelectorAll('.btn-edit-line').forEach(btn => {
      btn.onclick = () => {
        Estado.editingLine = { idx: idx, lineIdx: +btn.dataset.lineIdx };
        loadCentros();
      };
    });

    // Cancelar edición de línea
    tbody.querySelectorAll('.btn-cancel-edit-line').forEach(btn => {
      btn.onclick = () => {
        Estado.editingLine = { idx: null, lineIdx: null };
        loadCentros();
      };
    });

    // Guardar edición de línea
    tbody.querySelectorAll('.btn-guardar-edit-line').forEach(btn => {
      btn.onclick = async () => {
        const tr = btn.closest('tr');
        const num = tr.querySelector('.edit-line-num').value.trim();
        const boy = parseInt(tr.querySelector('.edit-line-buoys').value, 10);
        const long = parseFloat(tr.querySelector('.edit-line-long').value);
        const cab = tr.querySelector('.edit-line-cable').value.trim();
        const st = tr.querySelector('.edit-line-state').value;
        if (!num || isNaN(boy) || isNaN(long) || !cab || !st) {
          M.toast({ html: 'Completa todos los campos', classes: 'red' });
          return;
        }
        const centro = Estado.centros[idx];
        const linea = centro.lines[+btn.dataset.lineIdx];
        await updateLinea(centro._id, linea._id, { number: num, buoys: boy, longitud: long, cable: cab, state: st });
        Estado.editingLine = { idx: null, lineIdx: null };
        await loadCentros();
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

    // 🔥 Aquí lo importante:
    // Recarga todos los centros y reabre el acordeón del centro actual
    await loadCentros();

    // Busca la fila del centro y vuelve a abrir el child row
    const tr = $('#centrosTable tbody tr').eq(idx);
    const row = Estado.table.row(tr);
    if (row.child) {
      // Renderiza el HTML de líneas actualizado
      const lineasHtml = renderAcordeonLineas(idx, Estado.centros, Estado.editingLine);
      row.child(`<div class="child-row-lineas">${lineasHtml}</div>`).show();
      tr.addClass('shown');
      const acordeonContNew = tr.next().find('.child-row-lineas')[0];
      attachLineasListeners(idx, acordeonContNew);
    }
    if (tabMapaActiva()) renderMapaAlways(true);
    refrescarEventos();
  };
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

  // El child row lo maneja DataTables automáticamente
  // Si quieres forzar un centro abierto tras recarga, lo puedes hacer así:
  if (Estado.lineAcordionOpen !== null && Estado.centros[Estado.lineAcordionOpen]) {
    const tr = $('#centrosTable tbody tr').eq(Estado.lineAcordionOpen);
    tr.find('.btn-toggle-lineas').trigger('click');
  }

  if (tabMapaActiva()) renderMapaAlways();
}

// Filtra líneas SOLO en el bloque actual (no global)
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
