import { Estado } from '../core/estado.js';
import {
  getCentrosAll, createCentro, updateCentro, deleteCentro,
  addLinea, updateLinea, deleteLinea
} from '../core/centros_repo.js';
import { renderAcordeonLineas } from './lineas.js';
import { abrirModalTareas } from '../tareas/tareas.js';
import { renderMapaAlways } from '../mapas/control_mapa.js';
import { tabMapaActiva } from '../core/utilidades_app.js';
import { actualizarSelectsFiltro, refrescarEventos } from '../calendario/calendario.js';
import { openEditForm, renderPointsTable } from './centros_form.js';

export function initTablaCentros() {
  const $centrosTable = window.$('#centrosTable');
  if (!$centrosTable.length) {
    console.error('No se encontró #centrosTable');
    return;
  }
  Estado.table = $centrosTable.DataTable({
    colReorder: true,
    dom: 'Bfrtip',
    buttons: ['copy', 'csv', 'excel', 'pdf'],
    searching: false,
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json' }
  });
}

export async function loadCentros() {
  Estado.centros = await getCentrosAll();

  // FILTRO PARA EVITAR CENTROS NULOS O VACÍOS
  const rows = Estado.centros
    .filter(c => !!c && !!c.name)  // <<--- aquí está el filtro extra para evitar errores
    .map((c, i) => {
      const totalBoyas = Array.isArray(c.lines)
        ? c.lines.reduce((a, l) => a + (+l.buoys || 0), 0) : 0;
      const cantLineas = Array.isArray(c.lines) ? c.lines.length : 0;
      const hect       = parseFloat(c.hectareas) || 0;
      const btnText    = (Estado.lineAcordionOpen === i) ? 'OCULTAR LÍNEAS' : 'VER LÍNEAS';
      const btnClass   = (Estado.lineAcordionOpen === i) ? 'grey' : 'blue';

      return [
        c.name,
        c.code || '-',
        hect.toFixed(2),
        totalBoyas,
        cantLineas,
        `<button class="btn-small teal btn-coords" data-idx="${i}">VER COORDENADAS</button>`,
        `<button class="btn-small ${btnClass} btn-toggle-lineas" data-idx="${i}">${btnText}</button>
         <button class="btn-small orange editar-centro" data-idx="${i}">EDITAR</button>
         <button class="btn-small red eliminar-centro" data-idx="${i}">&times;</button>`
      ];
    });

  Estado.table.clear().rows.add(rows).draw();

  // Limpia acordeón
  const acordeonCont = document.getElementById('acordeonLineas');
  document.querySelectorAll('.acordeon-lineas-row').forEach(r => r.remove());
  if (acordeonCont) acordeonCont.innerHTML = '';

  if (Estado.lineAcordionOpen !== null && Estado.centros[Estado.lineAcordionOpen]) {
    acordeonCont.innerHTML = renderAcordeonLineas(Estado.lineAcordionOpen, Estado.centros, Estado.editingLine);
    M.FormSelect.init(acordeonCont.querySelectorAll('select'));

    const inputBuscar = document.getElementById('inputBuscarLineas');
    if (inputBuscar) inputBuscar.addEventListener('input', () => filtrarLineas());

    const filtroEstados = document.getElementById('filtroEstados');
    if (filtroEstados) {
      filtroEstados.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => {
          filtroEstados.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          Estado.estadoFiltro = btn.dataset.estado || 'todos';
          filtrarLineas();
        };
      });
    }
    filtrarLineas();

    const tbody = acordeonCont.querySelector('table.striped tbody');
    if (tbody) {
      const formInline = acordeonCont.querySelector('.form-inline-lineas');
      if (formInline) {
        formInline.onsubmit = async e => {
          e.preventDefault();
          const num  = formInline.querySelector('.line-num').value.trim();
          const boy  = parseInt(formInline.querySelector('.line-buoys').value, 10);
          const long = parseFloat(formInline.querySelector('.line-long').value);
          const cab  = formInline.querySelector('.line-cable').value.trim();
          const st   = formInline.querySelector('.line-state').value;
          if (!num || isNaN(boy) || isNaN(long) || !cab || !st) {
            M.toast({ html: 'Completa todos los campos de línea', classes: 'red' });
            return;
          }
          const centro = Estado.centros[Estado.lineAcordionOpen];
          await addLinea(centro._id, {
            number: num, buoys: boy, longitud: long, cable: cab, state: st, tareas: []
          });
          await loadCentros();
          if (tabMapaActiva()) renderMapaAlways(true);
          refrescarEventos();
        };
      }

      tbody.querySelectorAll('.btn-del-line').forEach(btn => {
        btn.onclick = async () => {
          const lineIdx = +btn.dataset.lineIdx;
          const centro = Estado.centros[Estado.lineAcordionOpen];
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

      tbody.querySelectorAll('.btn-edit-line').forEach(btn => {
        btn.onclick = () => {
          Estado.editingLine = { idx: Estado.lineAcordionOpen, lineIdx: +btn.dataset.lineIdx };
          loadCentros();
        };
      });

      tbody.querySelectorAll('.btn-cancel-edit-line').forEach(btn => {
        btn.onclick = () => {
          Estado.editingLine = { idx: null, lineIdx: null };
          loadCentros();
        };
      });

      tbody.querySelectorAll('.btn-guardar-edit-line').forEach(btn => {
        btn.onclick = async () => {
          const tr = btn.closest('tr');
          const num  = tr.querySelector('.edit-line-num').value.trim();
          const boy  = parseInt(tr.querySelector('.edit-line-buoys').value, 10);
          const long = parseFloat(tr.querySelector('.edit-line-long').value);
          const cab  = tr.querySelector('.edit-line-cable').value.trim();
          const st   = tr.querySelector('.edit-line-state').value;
          if (!num || isNaN(boy) || isNaN(long) || !cab || !st) {
            M.toast({ html: 'Completa todos los campos', classes: 'red' });
            return;
          }
          const centro = Estado.centros[Estado.lineAcordionOpen];
          const linea = centro.lines[+btn.dataset.lineIdx];
          await updateLinea(centro._id, linea._id, {
            number: num, buoys: boy, longitud: long, cable: cab, state: st
          });
          Estado.editingLine = { idx: null, lineIdx: null };
          await loadCentros();
        };
      });

      tbody.querySelectorAll('.btn-ver-tareas').forEach(btn => {
        btn.onclick = () => {
          const centro = Estado.centros[Estado.lineAcordionOpen];
          abrirModalTareas(centro, +btn.dataset.lineIdx, async () => {
            await loadCentros();
            refrescarEventos();
          });
        };
      });
    }
  }

  if (tabMapaActiva()) renderMapaAlways();

  // Delegados sobre la tabla
  const $centrosTable = window.$('#centrosTable');
  $centrosTable
    .off('click', '.btn-coords')
    .on('click', '.btn-coords', function () {
      const idx = +this.dataset.idx;
      const c = Estado.centros[idx];
      if (c && Array.isArray(c.coords)) {
        document.getElementById('coordenadasList').innerHTML =
          c.coords.map((p, i) =>
            `<div>${i + 1}. Lat: <b>${Number(p.lat).toFixed(6)}</b> – Lng: <b>${Number(p.lng).toFixed(6)}</b></div>`
          ).join('');
        M.Modal.getInstance(document.getElementById('coordsModal')).open();
      }
    })
    .off('click', '.btn-toggle-lineas')
    .on('click', '.btn-toggle-lineas', function () {
      const idx = +this.dataset.idx;
      Estado.lineAcordionOpen = (Estado.lineAcordionOpen === idx) ? null : idx;
      loadCentros();
    })
    .off('click', '.editar-centro')
    .on('click', '.editar-centro', function () {
      const idx = +this.dataset.idx;
      Estado.currentCentroIdx = idx;

      const centroModalElem = document.getElementById('centroModal');
      const centroModal     = M.Modal.getInstance(centroModalElem);

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

      Estado.currentPoints = [];
      els.inputCentroId.value = idx;
      openEditForm(els, Estado.map, Estado.currentPoints, (v) => Estado.currentCentroIdx = v);
      renderPointsTable(els.pointsBody, Estado.currentPoints);
      centroModal.open();
    })
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

export function filtrarLineas() {
  const acordeonCont = document.getElementById('acordeonLineas');
  if (!acordeonCont) return;
  const inputBuscarLineas = document.getElementById('inputBuscarLineas');
  if (!inputBuscarLineas) return;
  const filtroTexto = inputBuscarLineas.value.toLowerCase();
  const filas = acordeonCont.querySelectorAll('table.striped tbody tr');

  filas.forEach(fila => {
    const numLinea    = (fila.cells[0]?.textContent || '').toLowerCase();
    const estadoLinea = (fila.cells[4]?.textContent || '').toLowerCase();
    const tareasTxt   = (fila.cells[5]?.textContent || '').toLowerCase();

    const txtOK = numLinea.includes(filtroTexto) || estadoLinea.includes(filtroTexto);
    let estOK = false;
    if (Estado.estadoFiltro === 'todos') estOK = true;
    else if (Estado.estadoFiltro === 'pendiente')   estOK = tareasTxt.includes('pendiente');
    else if (Estado.estadoFiltro === 'en curso')    estOK = tareasTxt.includes('en curso');
    else if (Estado.estadoFiltro === 'completada')  estOK = tareasTxt.includes('completada');

    fila.style.display = (txtOK && estOK) ? '' : 'none';
  });
}
