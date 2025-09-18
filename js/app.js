// js/app.js (refactor)

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

// Unificamos: usamos el parseOneDMS de utils.js (cargado global como window.u)
const parseOneDMS = (window.u && window.u.parseOneDMS) || window.parseOneDMS;

// Evita reventar si no hay jQuery en algún momento
const $ = (window.$ || window.jQuery);

document.addEventListener('DOMContentLoaded', async () => {
  // ==== Materialize UI ====
  const tabsEl = document.querySelector('#tabs');
  if (tabsEl) {
    M.Tabs.init(tabsEl, {
      onShow: (tabElem) => {
        if (tabElem.id === 'tab-mapa' && Estado.map) {
          // Recalcula tamaño/tiles al cambiar a la pestaña del mapa
          Estado.map.invalidateSize();
          renderMapaAlways();
        }
      }
    });
  }
  M.FormSelect.init(document.querySelectorAll('select'));
  M.Modal.init(document.querySelectorAll('.modal'));
  M.Tooltip.init(document.querySelectorAll('.tooltipped'));

  // ==== Importador (una sola vez) ====
  const importCont = document.getElementById('importarCentrosContainer');
  if (importCont && importCont.dataset.inited !== '1') {
    importCont.dataset.inited = '1';
    const { renderImportadorCentros } = await import('./centros/importar_centros.js');
    renderImportadorCentros('importarCentrosContainer');
  }

  // ==== Tabla y Mapa ====
  initTablaCentros();
  initMapa();

  // ==== Carga inicial ====
  await cargarCentros(); // cargar tabla y, si corresponde, render mapa (adentro decide)

  // ==== Modal "Nuevo/Editar Centro" ====
  const btnNuevoCentro  = document.getElementById('btnOpenCentroModal');
  const centroModalElem = document.getElementById('centroModal');
  const centroModal     = centroModalElem
    ? (M.Modal.getInstance(centroModalElem) || M.Modal.init(centroModalElem))
    : null;

  const els = {
    formTitle:      document.getElementById('formTitle'),
    inputCentroId:  document.getElementById('inputCentroId'),
    inputProveedor: document.getElementById('inputProveedor'),
    inputComuna:    document.getElementById('inputComuna'),
    inputCode:      document.getElementById('inputCode'),
    inputHectareas: document.getElementById('inputHectareas'),
    inputLat:       document.getElementById('inputLat'),
    inputLng:       document.getElementById('inputLng'),
    btnAddPoint:    document.getElementById('btnAddPoint'),
    btnClearPoints: document.getElementById('btnClearPoints'),
    btnSaveCentro:  document.getElementById('btnSaveCentro'),
    pointsBody:     document.getElementById('pointsBody')
  };

  // Nuevo centro
  btnNuevoCentro?.addEventListener('click', () => {
    Estado.currentCentroIdx = null;
    Estado.currentPoints = [];
    openNewForm(els, Estado.map, Estado.currentPoints, v => (Estado.currentCentroIdx = v));
    renderPointsTable(els.pointsBody, Estado.currentPoints);
    centroModal?.open();
  });

  // Edición desde la tabla
  if ($) {
    const $t2 = $('#centrosTable');
    $t2.off('click', '.editar-centro').on('click', '.editar-centro', function () {
      const idx = +this.dataset.idx;
      Estado.currentCentroIdx = idx;

      const modalElem = document.getElementById('centroModal');
      const modal = modalElem ? (M.Modal.getInstance(modalElem) || M.Modal.init(modalElem)) : null;

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
        v => (Estado.currentCentroIdx = v),
        idx
      );
      modal?.open();
    });
  }

  // Agregar punto desde el formulario (DMS → decimal)
  els.btnAddPoint?.addEventListener('click', () => {
    const lat = parseOneDMS?.(els.inputLat.value.trim());
    const lng = parseOneDMS?.(els.inputLng.value.trim());
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
  document.getElementById('formCentro')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const proveedor = els.inputProveedor.value.trim();
    const comuna    = els.inputComuna.value.trim();
    const code      = els.inputCode.value.trim();
    const hectStr   = els.inputHectareas.value.trim();

    if (!proveedor || !comuna || !code) {
      M.toast({ html: 'Proveedor, comuna y código son obligatorios', classes: 'red' });
      return;
    }

    const hect = hectStr ? Number(hectStr) : null;
    if (hectStr && Number.isNaN(hect)) {
      M.toast({ html: 'Hectáreas inválidas', classes: 'red' });
      return;
    }

    const centroData = {
      proveedor,
      comuna,
      code,
      hectareas: hect,
      coords: Estado.currentPoints,
      lines:
        Estado.currentCentroIdx !== null
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
      await cargarCentros();     // refresca tabla y (si pestaña mapa está activa) redibuja mapa
      centroModal?.close();
    } catch (err) {
      M.toast({ html: err.message || 'Error al guardar centro', classes: 'red' });
    } finally {
      els.btnSaveCentro.disabled = false;
    }
  });

  // Cerrar cualquier modal con botones .modal-close
  document.querySelectorAll('.modal .modal-close').forEach((btn) => {
    btn.addEventListener('click', () => {
      const inst = M.Modal.getInstance(btn.closest('.modal'));
      inst?.close();
    });
  });
});

// Cargar centros desde API y refrescar UI
async function cargarCentros() {
  try {
    const data = await getCentrosAll();
    Estado.centros = Array.isArray(data) ? data : [];
    loadTablaCentros(Estado.centros);
    if (tabMapaActiva()) renderMapaAlways(true);
  } catch (e) {
    console.error('Error cargando centros:', e);
    M.toast({ html: 'Error cargando centros', classes: 'red' });
  }
}

// Workaround para selects de Materialize dentro de DataTables
$(document).on('mousedown focusin', '.select-wrapper input.select-dropdown', function () {
  $(this).closest('tr').addClass('editando-select');
});
$(document).on('blur', '.select-wrapper input.select-dropdown', function () {
  setTimeout(() => {
    $('.editando-select').removeClass('editando-select');
  }, 200);
});
