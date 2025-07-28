// js/centros/tabla_centros.js

import { Estado } from '../core/estado.js';
import {
  getCentrosAll,
  addLinea, updateLinea, deleteLinea,
  createCentro, updateCentro, deleteCentro
} from '../core/centros_repo.js';
import { renderAcordeonLineas } from './lineas.js';
import { abrirModalTareas } from '../tareas/tareas.js';
import { renderMapaAlways } from '../mapas/control_mapa.js';
import { tabMapaActiva } from '../core/utilidades_app.js';
import { actualizarSelectosFiltro, refrescarEventos } from '../calendario/calendario.js';
import { openEditForm, renderPointsTable } from './centros_form.js';

export function initTablaCentros() {
  const $centrosTable = window.$('#centrosTable');
  if (!$centrosTable.length) {
    console.error('No se encontró #centrosTable');
    return;
  }
  // Restauramos dom y botones de export
  Estado.table = $centrosTable.DataTable({
    colReorder: true,
    dom: 'Bfrtip',
    buttons: ['copy', 'csv', 'excel', 'pdf'],
    searching: false,
    language: {
      url: 'https://cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json'
    }
  });
}

export async function loadCentros() {
  Estado.centros = await getCentrosAll();

  const rows = Estado.centros
    .filter(c => !!c && !!c.name)
    .map((c, i) => {
      const totalBoyas = Array.isArray(c.lines)
        ? c.lines.reduce((a, l) => a + (+l.buoys || 0), 0)
        : 0;
      const cantLineas = Array.isArray(c.lines) ? c.lines.length : 0;
      const hect = parseFloat(c.hectareas) || 0;

      // Icono ojo para Coordenadas
      const coordsCell = `
        <i class="material-icons btn-coords" data-idx="${i}" style="cursor:pointer;">
          visibility
        </i>`;

      // Tres iconos en una línea para Acciones
      const accionesCell = `
        <i class="material-icons btn-toggle-lineas" data-idx="${i}" style="cursor:pointer;">
          visibility
        </i>
        <i class="material-icons editar-centro" data-idx="${i}" style="cursor:pointer;">
          edit
        </i>
        <i class="material-icons eliminar-centro" data-idx="${i}" style="cursor:pointer;">
          delete
        </i>`;

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

  // Resto de la lógica de acordeón y eventos (sin cambios)...

  const acordeonCont = document.getElementById('acordeonLineas');
  document.querySelectorAll('.acordeon-lineas-row').forEach(r => r.remove());
  if (acordeonCont) acordeonCont.innerHTML = '';

  if (Estado.lineAcordionOpen !== null && Estado.centros[Estado.lineAcordionOpen]) {
    acordeonCont.innerHTML = renderAcordeonLineas(
      Estado.lineAcordionOpen,
      Estado.centros,
      Estado.editingLine
    );

    const selects = acordeonCont.querySelectorAll('select');
    if (selects.length) M.FormSelect.init(selects);

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
      // Borrar línea
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

      // Editar línea
      tbody.querySelectorAll('.btn-edit-line').forEach(btn => {
        btn.onclick = () => {
          Estado.editingLine = { idx: Estado.lineAcordionOpen, lineIdx: +btn.dataset.lineIdx };
          loadCentros();
        };
      });

      // Cancelar edición
      tbody.querySelectorAll('.btn-cancel-edit-line').forEach(btn => {
        btn.onclick = () => {
          Estado.editingLine = { idx: null, lineIdx: null };
          loadCentros();
        };
      });

      // Guardar edición
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
          const centro = Estado.centros[Estado.lineAcordionOpen];
          const linea = centro.lines[+btn.dataset.lineIdx];
          await updateLinea(centro._id, linea._id, { number: num, buoys: boy, longitud: long, cable: cab, state: st });
          Estado.editingLine = { idx: null, lineIdx: null };
          await loadCentros();
        };
      });

      // Ver tareas línea
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

  // Delegados en la tabla de Centros
  const $centrosTable = window.$('#centrosTable');

  // Mostrar coordenadas
  $centrosTable
    .off('click', '.btn-coords')
    .on('click', '.btn-coords', function () {
      const idx = +this.dataset.idx;
      const c = Estado.centros[idx];
      if (c && Array.isArray(c.coords)) {
        const modal = document.getElementById('coordsModal');
        if (modal) {
          document.getElementById('coordenadasList').innerHTML =
            c.coords.map((p, i) =>
              `<div>${i + 1}. Lat: <b>${p.lat.toFixed(6)}</b> – Lng: <b>${p.lng.toFixed(6)}</b></div>`
            ).join('');
          M.Modal.getInstance(modal).open();
        }
      }
    })

    // Toggle líneas
    .off('click', '.btn-toggle-lineas')
    .on('click', '.btn-toggle-lineas', function () {
      const idx = +this.dataset.idx;
      Estado.lineAcordionOpen = Estado.lineAcordionOpen === idx ? null : idx;
      loadCentros();
    })

    // Editar centro
    .off('click', '.editar-centro')
    .on('click', '.editar-centro', function () {
      const idx = +this.dataset.idx;
      Estado.currentCentroIdx = idx;
      const centroModalElem = document.getElementById('centroModal');
      if (centroModalElem) {
        const centroModal = M.Modal.getInstance(centroModalElem);
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
        centroModal.open();
      }
    })

    // Eliminar centro
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
    const numLinea = (fila.cells[0]?.textContent || '').toLowerCase();
    const estadoLinea = (fila.cells[4]?.textContent || '').toLowerCase();
    const tareasTxt = (fila.cells[5]?.textContent || '').toLowerCase();

    const txtOK = numLinea.includes(filtroTexto) || estadoLinea.includes(filtroTexto);
    let estOK = Estado.estadoFiltro === 'todos';
    if (Estado.estadoFiltro === 'pendiente')   estOK = tareasTxt.includes('pendiente');
    if (Estado.estadoFiltro === 'en curso')    estOK = tareasTxt.includes('en curso');
    if (Estado.estadoFiltro === 'completada')  estOK = tareasTxt.includes('completada');

    fila.style.display = (txtOK && estOK) ? '' : 'none';
  });
}

