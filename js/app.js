// js/app.js

import { Estado } from './core/estado.js';
import {
  initMapa,
  renderMapaAlways,
  clearMapPoints,
  addPointMarker,
  redrawPolygon
} from './mapas/control_mapa.js';
import {
  initTablaCentros,
  loadCentros as loadTablaCentros
} from './centros/tabla_centros.js';
import {
  openNewForm,
  openEditForm,
  renderPointsTable
} from './centros/form_centros.js';
import {
  getCentrosAll,
  createCentro,
  updateCentro
} from './core/centros_repo.js';
import { tabMapaActiva } from './core/utilidades_app.js';
import { parseOneDMS } from './core/utilidades.js';
import { renderImportadorCentros } from './centros/importar_centros.js';


document.addEventListener('DOMContentLoaded', async () => {
  // Inicializar importador de centros
  renderImportadorCentros('importarCentrosContainer');

  // Inicializar Materialize
  M.Tabs.init(document.querySelector('#tabs'), {
    onShow: (tabElem) => {
      if (tabElem.id === 'tab-mapa' && Estado.map) {
        Estado.map.invalidateSize();
        renderMapaAlways();
      }
    }
  });
  M.FormSelect.init(document.querySelectorAll('select'));
  M.Modal.init(document.querySelectorAll('.modal'));

  // Inicializar tabla y mapa
  initTablaCentros();
  initMapa();

  // Cargar datos y renderizar
  await cargarCentros();
  if (tabMapaActiva()) renderMapaAlways(true);

  // Elementos del modal de Centro
  const btnNuevoCentro  = document.getElementById('btnOpenCentroModal');
  const centroModalElem = document.getElementById('centroModal');
  const centroModal     = M.Modal.getInstance(centroModalElem);

  const els = {
    formTitle:     document.getElementById('formTitle'),
    inputCentroId: document.getElementById('inputCentroId'),
    inputProveedor:document.getElementById('inputProveedor'),
    inputComuna:   document.getElementById('inputComuna'),
    inputCode:     document.getElementById('inputCode'),
    inputHectareas:document.getElementById('inputHectareas'),
    inputLat:      document.getElementById('inputLat'),
    inputLng:      document.getElementById('inputLng'),
    btnAddPoint:   document.getElementById('btnAddPoint'),
    btnClearPoints:document.getElementById('btnClearPoints'),
    btnSaveCentro: document.getElementById('btnSaveCentro'),
    pointsBody:    document.getElementById('pointsBody')
  };

  // Nuevo centro
  btnNuevoCentro?.addEventListener('click', () => {
    Estado.currentCentroIdx = null;
    Estado.currentPoints = [];
    openNewForm(els, Estado.map, Estado.currentPoints, v => Estado.currentCentroIdx = v);
    renderPointsTable(els.pointsBody, Estado.currentPoints);
    centroModal.open();
  });

  // Listener para edición desde tabla
  const $t2 = window.$('#centrosTable');
  $t2.off('click', '.editar-centro').on('click', '.editar-centro', function() {
    const idx = +this.dataset.idx;
    Estado.currentCentroIdx = idx;
    const modalElem = document.getElementById('centroModal');
    const modal     = M.Modal.getInstance(modalElem);
    const elsEdit = {
      formTitle:      document.getElementById('formTitle'),
      inputCentroId:  document.getElementById('inputCentroId'),
      inputProveedor: document.getElementById('inputProveedor'),
      inputComuna:    document.getElementById('inputComuna'),
      inputCode:      document.getElementById('inputCode'),
      inputHectareas: document.getElementById('inputHectareas'),
      inputLat:       document.getElementById('inputLat'),
      inputLng:       document.getElementById('inputLng'),
      pointsBody:     document.getElementById('pointsBody')
    };
    openEditForm(
      elsEdit,
      Estado.map,
      Estado.currentPoints,
      v => Estado.currentCentroIdx = v,
      idx
    );
    modal.open();
  });

  // Agregar punto al formulario
  els.btnAddPoint?.addEventListener('click', () => {
    const lat = parseOneDMS(els.inputLat.value.trim());
    const lng = parseOneDMS(els.inputLng.value.trim());
    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
      M.toast({ html: 'Formato DMS inválido', classes: 'red' });
      return;
    }
    Estado.currentPoints.push({ lat, lng });
    addPointMarker(lat, lng);
    redrawPolygon(Estado.currentPoints);
    renderPointsTable(els.pointsBody, Estado.currentPoints);
    els.inputLat.value = els.inputLng.value = '';
    M.updateTextFields();
  });

  // Limpiar puntos del formulario
  els.btnClearPoints?.addEventListener('click', () => {
    Estado.currentPoints.length = 0;
    clearMapPoints();
    renderPointsTable(els.pointsBody, Estado.currentPoints);
  });

  // Guardar (crear o actualizar) centro
  document.getElementById('formCentro')?.addEventListener('submit', async e => {
    e.preventDefault();
    const proveedor = els.inputProveedor.value.trim();
    const comuna    = els.inputComuna.value.trim();
    const code      = els.inputCode.value.trim();
    const hect      = els.inputHectareas.value.trim();
    if (!proveedor || !comuna) {
      M.toast({ html: 'Proveedor y comuna son obligatorios', classes: 'red' });
      return;
    }

    const centroData = {
      proveedor,
      comuna,
      code,
      hectareas: hect,
      coords: Estado.currentPoints,
      lines: Estado.currentCentroIdx !== null
        ? (Estado.centros[Estado.currentCentroIdx]?.lines || [])
        : []
    };

    els.btnSaveCentro.disabled = true;
    try {
      if (Estado.currentCentroIdx === null) {
        const creado = await createCentro(centroData);
        if (!creado?._id) throw new Error('Error al crear centro');
        Estado.centros.push(creado);
        M.toast({ html: 'Centro creado', classes: 'green' });
      } else {
        const id = Estado.centros[Estado.currentCentroIdx]._id;
        const actualizado = await updateCentro(id, centroData);
        if (!actualizado?._id) throw new Error('Error al actualizar centro');
        Estado.centros[Estado.currentCentroIdx] = actualizado;
        M.toast({ html: 'Centro actualizado', classes: 'green' });
      }
      await cargarCentros();
      if (tabMapaActiva()) renderMapaAlways(true);
      centroModal.close();
    } catch (err) {
      M.toast({ html: err.message || 'Error al guardar centro', classes: 'red' });
    } finally {
      els.btnSaveCentro.disabled = false;
    }
  });

  // Cerrar cualquier modal con botones .modal-close
  document.querySelectorAll('.modal .modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const inst = M.Modal.getInstance(btn.closest('.modal'));
      inst?.close();
    });
  });
});

// Función para cargar centros desde API y refrescar UI
async function cargarCentros() {
  try {
    Estado.centros = await getCentrosAll();
    loadTablaCentros(Estado.centros);
    renderMapaAlways(true);
  } catch (e) {
    console.error('Error cargando centros:', e);
    M.toast({ html: 'Error cargando centros', classes: 'red' });
  }
}

// Workaround para Materialize selects dentro de DataTables
$(document).on('mousedown focusin', '.select-wrapper input.select-dropdown', function () {
  $(this).closest('tr').addClass('editando-select');
});
$(document).on('blur', '.select-wrapper input.select-dropdown', function () {
  setTimeout(() => {
    $('.editando-select').removeClass('editando-select');
  }, 200);
});

