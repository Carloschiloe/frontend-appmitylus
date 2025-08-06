// js/centros/eventos_centros.js

import { Estado } from '../core/estado.js';
import {
  updateLinea,
  deleteLinea,
  deleteCentro
} from '../core/centros_repo.js';
import { renderAcordeonLineas } from './lineas.js';
import { openEditForm } from './form_centros.js';
import { loadCentros } from './tabla_centros.js';
import { tabMapaActiva } from '../core/utilidades_app.js';
import { renderMapaAlways } from '../mapas/control_mapa.js';

// Helper: Capitaliza tipo título
function toTitleCase(str) {
  return (str || '')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Registra todos los eventos de la tabla de centros
export function registerTablaCentrosEventos() {
  const $t2 = window.$('#centrosTable');

  // Mostrar detalles y coordenadas en modal
  $t2
    .off('click', '.btn-detalle')
    .on('click', '.btn-detalle', function () {
      const id = this.dataset.id;
      const c = Estado.centros.find(item => item._id === id);
      const modal = document.getElementById('modalDetallesCentro');
      const body = document.getElementById('detallesCentroBody');
      if (c && modal && body) {
        // --- DATOS PRINCIPALES ---
        let html = `<table class="striped"><tbody>
            <tr><th>Proveedor</th><td>${toTitleCase(c.proveedor)}</td></tr>
            <tr><th>Comuna</th><td>${toTitleCase(c.comuna)}</td></tr>
            <tr><th>Código</th><td>${c.code}</td></tr>
            <tr><th>Hectáreas</th><td>${c.hectareas}</td></tr>
          </tbody></table>`;

        // --- DETALLES EXTRAS ---
        if (c.detalles && typeof c.detalles === 'object' && Object.keys(c.detalles).length) {
          html += `<h6 style="margin-top:1.5em;">Detalles Extras</h6>
            <table class="striped"><tbody>`;
          for (const [k, v] of Object.entries(c.detalles)) {
            html += `<tr><th>${k}</th><td>${v}</td></tr>`;
          }
          html += `</tbody></table>`;
        }

        // --- COORDENADAS ---
        html += `<h6 style="margin-top:1.5em;">Coordenadas</h6>
          <table class="striped">
            <thead><tr><th>#</th><th>Latitud</th><th>Longitud</th></tr></thead>
            <tbody>`;
        if (Array.isArray(c.coords) && c.coords.length) {
          c.coords.forEach((p, i) => {
            html += `<tr>
                <td>${i + 1}</td>
                <td>${p.lat?.toFixed(6) ?? ''}</td>
                <td>${p.lng?.toFixed(6) ?? ''}</td>
              </tr>`;
          });
        } else {
          html += `<tr><td colspan="3">Sin coordenadas registradas</td></tr>`;
        }
        html += `</tbody></table>`;

        body.innerHTML = html;
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
        Estado.lineAcordionOpen = null;
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
      Estado.lineAcordionOpen = idx;

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
        inputProveedor: document.getElementById('inputProveedor'),
        inputComuna: document.getElementById('inputComuna'),
        inputCode: document.getElementById('inputCode'),
        inputHectareas: document.getElementById('inputHectareas'),
        inputLat: document.getElementById('inputLat'),
        inputLng: document.getElementById('inputLng'),
        pointsBody: document.getElementById('pointsBody')
      };
      openEditForm(els, Estado.map, Estado.currentPoints, v => (Estado.currentCentroIdx = v), idx);
      modal.open();
    });

  // Eliminar centro
  $t2
    .off('click', '.eliminar-centro')
    .on('click', '.eliminar-centro', async function () {
      const idx = +this.dataset.idx;
      const c = Estado.centros[idx];
      if (!c) return;
      const nombreRef = c.proveedor || c.comuna || 'este centro';
      if (confirm(`¿Eliminar el centro "${nombreRef}"?`)) {
        await deleteCentro(c._id);
        await loadCentros();
        if (tabMapaActiva()) renderMapaAlways(true);
      }
    });
}

// ============ LISTENERS DE LÍNEAS DENTRO DEL ACORDEÓN ============ //
function attachLineasListeners(idx, acordeonCont) {
  const tbody = acordeonCont.querySelector('table.striped tbody');
  if (!tbody) return;

  // Eliminar línea
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
      tr.find('.btn-toggle-lineas').trigger('click').trigger('click');
    };
  });

  // Cancelar edición de línea
  tbody.querySelectorAll('.btn-cancel-edit-line').forEach(btn => {
    btn.onclick = () => {
      Estado.editingLine = { idx: null, lineIdx: null };
      const tr = $('#centrosTable tbody tr').eq(idx);
      tr.find('.btn-toggle-lineas').trigger('click').trigger('click');
    };
  });

  // Guardar edición de línea
  tbody.querySelectorAll('.btn-guardar-edit-line').forEach(btn => {
    btn.onclick = async () => {
      const trFila = btn.closest('tr');
      const centro = Estado.centros[idx];
      const linea = centro.lines[+btn.dataset.lineIdx];

      const num            = trFila.querySelector('.edit-line-num').value.trim();
      const long           = parseFloat(trFila.querySelector('.edit-line-long').value);
      const obs            = trFila.querySelector('.edit-line-observaciones').value.trim();
      const st             = trFila.querySelector('.edit-line-state').value;
      const tons           = parseFloat(trFila.querySelector('.edit-line-tons').value) || null;
      const unkg           = parseFloat(trFila.querySelector('.edit-line-unKg').value) || null;
      const rechazo        = parseFloat(trFila.querySelector('.edit-line-porcRechazo').value) || null;
      const rendimiento    = parseFloat(trFila.querySelector('.edit-line-rendimiento').value) || null;

      if (!num || isNaN(long) || !st) {
        M.toast({ html: 'Completa N° Línea, Longitud y Estado', classes: 'red' });
        return;
      }

      await updateLinea(centro._id, linea._id, {
        number: num,
        longitud: long,
        observaciones: obs,
        state: st,
        tons,
        unKg: unkg,
        porcRechazo: rechazo,
        rendimiento
      });

      Estado.editingLine = { idx: null, lineIdx: null };
      const tr = $('#centrosTable tbody tr').eq(idx);
      tr.find('.btn-toggle-lineas').trigger('click').trigger('click');
      await loadCentros();
    };
  });

  // Agregar nueva línea
  const formAdd = acordeonCont.querySelector('.form-inline-lineas');
  if (formAdd) {
    formAdd.onsubmit = async (e) => {
      e.preventDefault();
      const centro = Estado.centros[idx];
      const num            = formAdd.querySelector('.line-num').value.trim();
      const long           = parseFloat(formAdd.querySelector('.line-long').value);
      const obs            = formAdd.querySelector('.line-observaciones').value.trim();
      const st             = formAdd.querySelector('.line-state').value;
      const tons           = parseFloat(formAdd.querySelector('.line-tons').value) || 0;
      const unkg           = parseFloat(formAdd.querySelector('.line-unKg').value) || null;
      const rechazo        = parseFloat(formAdd.querySelector('.line-porcRechazo').value) || null;
      const rendimiento    = parseFloat(formAdd.querySelector('.line-rendimiento').value) || null;

      if (!num || isNaN(long) || !st) {
        M.toast({ html: 'Completa todos los campos obligatorios', classes: 'red' });
        return;
      }

      await import('../core/centros_repo.js').then(m =>
        m.addLinea(centro._id, {
          number: num,
          longitud: long,
          observaciones: obs,
          state: st,
          tons,
          unKg: unkg,
          porcRechazo: rechazo,
          rendimiento
        })
      );

      formAdd.reset();
      const tr = $('#centrosTable tbody tr').eq(idx);
      tr.find('.btn-toggle-lineas').trigger('click').trigger('click');
      await loadCentros();
    };
  }
}

// Filtrar líneas por número o estado
export function filtrarLineas(contenedor) {
  const cont = contenedor || document;
  const txt = (cont.querySelector('#inputBuscarLineas')?.value || '').toLowerCase();
  cont.querySelectorAll('table.striped tbody tr').forEach(fila => {
    const num = (fila.cells[0]?.textContent || '').toLowerCase();
    const est = (fila.cells[4]?.textContent || '').toLowerCase();
    fila.style.display = (num.includes(txt) || est.includes(txt)) ? '' : 'none';
  });
}
