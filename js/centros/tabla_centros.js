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
import { openEditForm } from './centros_form.js';

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
      let sumH = 0, sumL = 0, sumTons = 0;
      let sumUnKg = 0, sumRechazo = 0, sumRdmto = 0;
      let countUnKg = 0, countRechazo = 0, countRdmto = 0;

      Estado.centros.forEach(c => {
        sumH += parseFloat(c.hectareas) || 0;
        sumL += Array.isArray(c.lines) ? c.lines.length : 0;

        if (Array.isArray(c.lines)) {
          c.lines.forEach(l => {
            sumTons += +l.tons || 0;

            // Un/Kg promedio
            if (l.unKg !== undefined && l.unKg !== null && l.unKg !== '') {
              sumUnKg += parseFloat(l.unKg) || 0;
              countUnKg++;
            }
            // % Rechazo promedio
            if (l.porcRechazo !== undefined && l.porcRechazo !== null && l.porcRechazo !== '') {
              sumRechazo += parseFloat(l.porcRechazo) || 0;
              countRechazo++;
            }
            // Rdmto promedio
            if (l.rendimiento !== undefined && l.rendimiento !== null && l.rendimiento !== '') {
              sumRdmto += parseFloat(l.rendimiento) || 0;
              countRdmto++;
            }
          });
        }
      });

      const avgUnKg = countUnKg ? (sumUnKg / countUnKg) : 0;
      const avgRechazo = countRechazo ? (sumRechazo / countRechazo) : 0;
      const avgRdmto = countRdmto ? (sumRdmto / countRdmto) : 0;

      const h = document.getElementById('totalHect');
      const l = document.getElementById('totalLineas');
      const tons = document.getElementById('totalTons');
      const unKg = document.getElementById('totalUnKg');
      const rechazo = document.getElementById('totalRechazo');
      const rdmto = document.getElementById('totalRdmto');
      if (h && l && unKg && tons && rechazo && rdmto) {
        h.textContent = sumH.toFixed(2);
        l.textContent = sumL;
        tons.textContent = sumTons;
        unKg.textContent = avgUnKg.toFixed(2);
        rechazo.textContent = avgRechazo.toFixed(1) + '%';
        rdmto.textContent = avgRdmto.toFixed(1) + '%';
      }
    }
  });

  Estado.table.draw();

  const $t2 = window.$('#centrosTable');

  // Mostrar coordenadas en modal
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
      const centro = Estado.centros[idx];
      const modalElem = document.getElementById('centroModal');
      const modal = M.Modal.getInstance(modalElem);
      const els = {
        formTitle: document.getElementById('formTitle'),
        inputCentroId: document.getElementById('inputCentroId'),
        inputName: document.getElementById('inputName'),
        inputProveedor: document.getElementById('inputProveedor'),
        inputCode: document.getElementById('inputCode'),
        inputHectareas: document.getElementById('inputHectareas'),
        inputLat: document.getElementById('inputLat'),
        inputLng: document.getElementById('inputLng'),
        pointsBody: document.getElementById('pointsBody')
      };
      els.inputCentroId.value = idx;
      openEditForm(els, Estado.map, Estado.currentPoints, v => (Estado.currentCentroIdx = v));
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
        const tr = $('#centrosTable tbody tr').eq(idx);
        tr.find('.btn-toggle-lineas').trigger('click');
        tr.find('.btn-toggle-lineas').trigger('click');
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

    // Guardar edición de línea (CORREGIDO)
    tbody.querySelectorAll('.btn-guardar-edit-line').forEach(btn => {
      btn.onclick = async () => {
        const trFila = btn.closest('tr');
        // Inputs
        const numInput  = trFila.querySelector('.edit-line-num');
        const longInput = trFila.querySelector('.edit-line-long');
        const obsInput  = trFila.querySelector('.edit-line-observaciones');
        const stateInput= trFila.querySelector('.edit-line-state');
        const tonsInput = trFila.querySelector('.edit-line-tons');
        const unkgInput = trFila.querySelector('.edit-line-unKg');
        const rechazoInput = trFila.querySelector('.edit-line-porcRechazo');
        const rendimientoInput = trFila.querySelector('.edit-line-rendimiento');

        // Línea original
        const centro = Estado.centros[idx];
        const linea = centro.lines[+btn.dataset.lineIdx];

        // VALORES: si input vacío, queda null
        const num  = numInput?.value.trim() || '';
        const long = longInput?.value.trim() ? parseFloat(longInput.value) : null;
        const obs  = obsInput?.value.trim() || '';
        const st   = stateInput?.value || '';
        const tons = tonsInput?.value.trim() ? parseFloat(tonsInput.value) : null;
        const unkg = unkgInput?.value.trim() ? parseFloat(unkgInput.value) : null;
        const rechazo = rechazoInput?.value.trim() ? parseFloat(rechazoInput.value) : null;
        const rendimiento = rendimientoInput?.value.trim() ? parseFloat(rendimientoInput.value) : null;

        // VALIDACIÓN: Solo obligatorios (N° línea, Longitud y Estado)
        if (!num || long === null || !st) {
          M.toast({ html: 'Completa N° Línea, Longitud y Estado', classes: 'red' });
          return;
        }
        if (
          (tonsInput?.value.trim() && isNaN(tons)) ||
          (unkgInput?.value.trim() && isNaN(unkg)) ||
          (rechazoInput?.value.trim() && isNaN(rechazo)) ||
          (rendimientoInput?.value.trim() && isNaN(rendimiento))
        ) {
          M.toast({ html: 'Revisa los campos numéricos', classes: 'red' });
          return;
        }

        // GUARDA línea
        await updateLinea(centro._id, linea._id, {
          number: num,
          longitud: long,
          observaciones: obs,
          state: st,
          tons,
          unKg: unkg,
          porcRechazo: rechazo,
          rendimiento,
        });
        Estado.editingLine = { idx: null, lineIdx: null };
        const tr = $('#centrosTable tbody tr').eq(idx);
        tr.find('.btn-toggle-lineas').trigger('click');
        tr.find('.btn-toggle-lineas').trigger('click');
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
      const long = parseFloat(formAdd.querySelector('.line-long').value);
      const obs = formAdd.querySelector('.line-observaciones').value.trim();
      const st = formAdd.querySelector('.line-state').value;
      const tonsStr = formAdd.querySelector('.line-tons').value.trim();
      const tons = tonsStr === '' ? 0 : parseFloat(tonsStr);
      const unkgStr = formAdd.querySelector('.line-unKg').value.trim();
      const unkg = unkgStr === '' ? null : parseFloat(unkgStr);
      const rechazoStr = formAdd.querySelector('.line-porcRechazo').value.trim();
      const rechazo = rechazoStr === '' ? null : parseFloat(rechazoStr);
      const rendimientoStr = formAdd.querySelector('.line-rendimiento').value.trim();
      const rendimiento = rendimientoStr === '' ? null : parseFloat(rendimientoStr);

      if (!num || isNaN(long) || !st) {
        M.toast({ html: 'Completa todos los campos obligatorios', classes: 'red' });
        return;
      }
      if (tonsStr !== '' && isNaN(tons)) {
        M.toast({ html: 'Toneladas debe ser un número válido', classes: 'red' });
        return;
      }
      if (unkgStr !== '' && isNaN(unkg)) {
        M.toast({ html: 'Un/kg debe ser un número válido', classes: 'red' });
        return;
      }
      if (rechazoStr !== '' && isNaN(rechazo)) {
        M.toast({ html: '% Rechazo debe ser un número válido', classes: 'red' });
        return;
      }
      if (rendimientoStr !== '' && isNaN(rendimiento)) {
        M.toast({ html: 'Rendimiento debe ser un número válido', classes: 'red' });
        return;
      }

      const centro = Estado.centros[idx];
      await addLinea(centro._id, {
        number: num,
        longitud: long,
        observaciones: obs,
        state: st,
        tons: tons,
        unKg: unkg,
        porcRechazo: rechazo,
        rendimiento: rendimiento
      });
      formAdd.reset();
      const tr = $('#centrosTable tbody tr').eq(idx);
      tr.find('.btn-toggle-lineas').trigger('click');
      tr.find('.btn-toggle-lineas').trigger('click');
      await loadCentros();
    };
  }
}

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
        if (l.unKg !== undefined && l.unKg !== null && l.unKg !== '') {
          sumUnKg += parseFloat(l.unKg) || 0;
          countUnKg++;
        }
        if (l.porcRechazo !== undefined && l.porcRechazo !== null && l.porcRechazo !== '') {
          sumRechazo += parseFloat(l.porcRechazo) || 0;
          countRechazo++;
        }
        if (l.rendimiento !== undefined && l.rendimiento !== null && l.rendimiento !== '') {
          sumRdmto += parseFloat(l.rendimiento) || 0;
          countRdmto++;
        }
      });
    }
    const avgUnKg = countUnKg ? (sumUnKg / countUnKg) : 0;
    const avgRechazo = countRechazo ? (sumRechazo / countRechazo) : 0;
    const avgRdmto = countRdmto ? (sumRdmto / countRdmto) : 0;

    const proveedor = c.proveedor || '-';

    const coordsCell = `<i class="material-icons btn-coords" data-idx="${i}" style="cursor:pointer">visibility</i>`;
    const accionesCell = `
      <i class="material-icons btn-toggle-lineas" data-idx="${i}" style="cursor:pointer">visibility</i>
      <i class="material-icons editar-centro" data-idx="${i}" style="cursor:pointer">edit</i>
      <i class="material-icons eliminar-centro" data-idx="${i}" style="cursor:pointer">delete</i>`;

    return [
      c.name,
      proveedor,
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
