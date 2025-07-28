import { Estado } from './core/estado.js';
import {
  initMapa,
  renderMapaAlways,
  clearMapPoints,
  redrawPolygon,
  addPointMarker
} from './mapas/control_mapa.js';
import { initTablaCentros, loadCentros as loadTablaCentros } from './centros/tabla_centros.js';
import { renderFiltrosSidebar } from './stock/stock_insumos.js';
// ====== NO IMPORTAR NADA DE CALENDARIO ACA ======
// import { actualizarSelectsFiltro, refrescarEventos, asegurarCalendarioVisible } from './calendario/calendario.js';
import { openNewForm, renderPointsTable } from './centros/centros_form.js';
import {
  getCentrosAll,
  createCentro,
  updateCentro
} from './core/centros_repo.js';
import { tabMapaActiva } from './core/utilidades_app.js';
import { parseOneDMS } from './core/utilidades.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Tabs Materialize
  M.Tabs.init(document.querySelector('#tabs'), {
    onShow: (tabElem) => {
      if (tabElem.id === 'tab-mapa' && Estado.map) {
        Estado.map.invalidateSize();
        renderMapaAlways();
      }
      // No debe haber referencias a calendario aquí
      if (tabElem.id === 'tab-insumos') renderFiltrosSidebar();
    }
  });

  // Materialize base
  M.FormSelect.init(document.querySelectorAll('select'));
  M.Modal.init(document.querySelectorAll('.modal'));
  // actualizarSelectsFiltro(); // <-- NO DEBE IR AQUÍ

  // Init componentes
  initTablaCentros();
  initMapa();
  renderFiltrosSidebar();

  // Cargar datos desde API
  await cargarCentros();

  if (tabMapaActiva()) renderMapaAlways(true);

  // ---------- Modal nuevo/editar centro ----------
  const btnNuevoCentro = document.getElementById('btnOpenCentroModal');
  const centroModalElem = document.getElementById('centroModal');
  const centroModal = M.Modal.getInstance(centroModalElem);

  const els = {
    formTitle: document.getElementById('formTitle'),
    inputCentroId: document.getElementById('inputCentroId'),
    inputName: document.getElementById('inputName'),
    inputCode: document.getElementById('inputCode'),
    inputHectareas: document.getElementById('inputHectareas'),
    inputLat: document.getElementById('inputLat'),
    inputLng: document.getElementById('inputLng'),
    btnAddPoint: document.getElementById('btnAddPoint'),
    btnClearPoints: document.getElementById('btnClearPoints'),
    btnSaveCentro: document.getElementById('btnSaveCentro'),
    pointsBody: document.getElementById('pointsBody')
  };

  btnNuevoCentro?.addEventListener('click', () => {
    Estado.currentCentroIdx = null; // Indicar nuevo centro
    Estado.currentPoints = [];
    openNewForm(els, Estado.map, Estado.currentPoints, (v) => (Estado.currentCentroIdx = v));
    renderPointsTable(els.pointsBody, Estado.currentPoints);
    centroModal.open();
  });

  // ---------- Puntos ----------
  if (els.btnAddPoint) {
    els.btnAddPoint.onclick = () => {
      const lat = parseOneDMS(els.inputLat.value.trim());
      const lng = parseOneDMS(els.inputLng.value.trim());
      if (isNaN(lat) || isNaN(lng)) {
        M.toast({ html: 'Formato DMS inválido', classes: 'red' });
        return;
      }
      Estado.currentPoints.push({ lat, lng });
      addPointMarker(lat, lng);
      redrawPolygon(Estado.currentPoints);
      renderPointsTable(els.pointsBody, Estado.currentPoints);
      els.inputLat.value = els.inputLng.value = '';
      M.updateTextFields();
    };
  }

  if (els.btnClearPoints) {
    els.btnClearPoints.onclick = () => {
      Estado.currentPoints.length = 0;
      clearMapPoints();
      renderPointsTable(els.pointsBody, Estado.currentPoints);
    };
  }

  // ---------- Guardar centro (crear o actualizar) ----------
  const formCentro = document.getElementById('formCentro');
  if (formCentro) {
    formCentro.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nombre = els.inputName.value.trim();
      const code = els.inputCode.value.trim();
      const hectareas = els.inputHectareas.value.trim();

      if (!nombre) {
        M.toast({ html: 'Nombre obligatorio', classes: 'red' });
        return;
      }
      if (Estado.currentPoints.length < 3) {
        M.toast({ html: 'Debe ingresar al menos 3 puntos para formar un polígono válido', classes: 'red' });
        return;
      }

      const centroData = {
        name: nombre,
        code,
        hectareas,
        coords: Estado.currentPoints,
        lines: Estado.currentCentroIdx !== null && Estado.centros[Estado.currentCentroIdx]
          ? Estado.centros[Estado.currentCentroIdx].lines || []
          : []
      };

      els.btnSaveCentro.disabled = true;
      try {
        if (Estado.currentCentroIdx === null) {
          // Crear nuevo centro
          const creado = await createCentro(centroData);
          if (creado && creado._id) {
            Estado.centros.push(creado);
            M.toast({ html: 'Centro creado', classes: 'green' });
          } else {
            throw new Error('Error al crear centro');
          }
        } else {
          // Actualizar centro existente
          const id = Estado.centros[Estado.currentCentroIdx]._id;
          const actualizado = await updateCentro(id, centroData);
          if (actualizado && actualizado._id) {
            Estado.centros[Estado.currentCentroIdx] = actualizado;
            M.toast({ html: 'Centro actualizado', classes: 'green' });
          } else {
            throw new Error('Error al actualizar centro');
          }
        }
        await cargarCentros(); // recargar tabla y estado
        // refrescarEventos(); // <-- Esto tampoco si es sólo parte de calendario
        if (tabMapaActiva()) renderMapaAlways(true);
        centroModal.close();
      } catch (error) {
        M.toast({ html: error.message || 'Error al guardar centro', classes: 'red' });
      } finally {
        els.btnSaveCentro.disabled = false;
      }
    });
  }

  // Cerrar modales (botón X)
  document.querySelectorAll('.modal .modal-close').forEach((btn) => {
    btn.onclick = () => {
      const modalElem = btn.closest('.modal');
      const instance = M.Modal.getInstance(modalElem);
      if (instance) instance.close();
    };
  });
});

async function cargarCentros() {
  try {
    Estado.centros = await getCentrosAll();
    loadTablaCentros(Estado.centros);
  } catch (e) {
    console.error('Error cargando centros:', e);
    M.toast({ html: 'Error cargando centros', classes: 'red' });
  }
}
