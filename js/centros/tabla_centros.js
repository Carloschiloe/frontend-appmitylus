// js/centros/tabla_centros.js

import { Estado } from '../core/estado.js';
import {
  getCentrosAll,
  addLinea,
  updateLinea,
  deleteLinea,
  deleteCentro
} from '../core/centros_repo.js';
import { renderAcordeonLineas } from './lineas.js';
import { abrirModalTareas } from '../tareas/tareas.js';
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

  // Inicializa DataTable con exportación de footer
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
      // Calcula los totales sumando todos los centros
      let sumH = 0, sumB = 0, sumL = 0;
      Estado.centros.forEach(c => {
        sumH += parseFloat(c.hectareas) || 0;
        sumB += Array.isArray(c.lines)
          ? c.lines.reduce((s, l) => s + (+l.buoys || 0), 0)
          : 0;
        sumL += Array.isArray(c.lines) ? c.lines.length : 0;
      });
      // Actualiza los IDs en el <tfoot>
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

  // Limpia y renderiza acordeón de líneas
  const acordeonCont = document.getElementById('acordeonLineas');
  document.querySelectorAll('.acordeon-lineas-row').forEach(r => r.remove());
  if (acordeonCont) acordeonCont.innerHTML = '';

  if (Estado.lineAcordionOpen !== null && Estado.centros[Estado.lineAcordionOpen]) {
    acordeonCont.innerHTML = renderAcordeonLineas(
      Estado.lineAcordionOpen,
      Estado.centros,
      Estado.editingLine
    );

    // Inicializar selects
    const selects = acordeonCont.querySelectorAll('select');
    if (selects.length) M.FormSelect.init(selects);

    // Filtrado de líneas
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

    // Delegados dentro del acordeón
    const tbody = acordeonCont.querySelector('table.striped tbody');
    if (tbody) {
      tbody.querySelectorAll('.btn-del-line').forEach(btn => {
        btn.onclick = async () => {
          const idx = +btn.dataset.lineIdx;
          const centro = Estado.centros[Estado.lineAcordionOpen];
          const linea = centro.lines[idx];
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

      tbody.querySelectorAll('.btn-ver-tareas').forEach(btn => {
        btn.onclick = () => {
          abrirModalTareas(
            Estado.centros[Estado.lineAcordionOpen],
            +btn.dataset.lineIdx,
            async () => {
              await loadCentros();
              refrescarEventos();
            }
          );
        };
      });
    }
  }

  if (tabMapaActiva()) renderMapaAlways();

  // Delegados en tabla general
  const $t = window.$('#centrosTable');
  $t
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
    })
    .off('click', '.btn-toggle-lineas')
    .on('click', '.btn-toggle-lineas', function () {
      const idx = +this.dataset.idx;
      Estado.lineAcordionOpen = Estado.lineAcordionOpen === idx ? null : idx;
      loadCentros();
    })
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
  const cont = document.getElementById('acordeonLineas');
  if (!cont) return;
  const txt = (document.getElementById('inputBuscarLineas')?.value || '').toLowerCase();
  cont.querySelectorAll('table.striped tbody tr').forEach(fila => {
    const num = (fila.cells[0]?.textContent || '').toLowerCase();
    const est = (fila.cells[4]?.textContent || '').toLowerCase();
    const tar = (fila.cells[5]?.textContent || '').toLowerCase();
    const okTxt = num.includes(txt) || est.includes(txt);
    const okEst =
      Estado.estadoFiltro === 'todos' ||
      (Estado.estadoFiltro === 'pendiente' && tar.includes('pendiente')) ||
      (Estado.estadoFiltro === 'en curso' && tar.includes('en curso')) ||
      (Estado.estadoFiltro === 'completada' && tar.includes('completada'));
    fila.style.display = okTxt && okEst ? '' : 'none';
  });
}

