// /js/app.js — bootstrap/orquestador (versión simplificada sin “líneas”)

import { Estado } from './core/estado.js';

// === Mapa ===
import {
  crearMapa,
  initSidebarFiltro,
  cargarYRenderizarCentros,
  clearMapPoints,
  addPointMarker,
  redrawPolygon,
  drawCentrosInMap,
  updateLabelVisibility,
} from './mapas/mapa.js';

// === Tabla ===
import { initTablaCentros, loadCentros as loadTablaCentros } from './centros/tabla_centros.js';

// === Formularios ===
import { openNewForm, openEditForm, renderPointsTable } from './centros/form_centros.js';

// === API ===
import { getCentrosAll, createCentro, updateCentro } from './core/centros_repo.js';

// === Utils app ===
import { tabMapaActiva } from './core/utilidades_app.js';

// === Utils (global de /js/utils.js)
const parseDMS = (s) => {
  const fn = (window.u && window.u.parseOneDMS) || window.parseOneDMS;
  return typeof fn === 'function' ? fn(s) : NaN;
};

// jQuery (solo para workaround de Materialize + DataTables)
const $ = window.$ || window.jQuery;

const APPLOG  = (...a) => console.log('[APP]', ...a);
const APPWARN = (...a) => console.warn('[APP]', ...a);
const APPERR  = (...a) => console.error('[APP]', ...a);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function init() {
  APPLOG('Init start. readyState=', document.readyState);

  // ===== Materialize =====
  const tabsEl = document.querySelector('#tabs');
  if (tabsEl) {
    M.Tabs.init(tabsEl, {
      onShow: (tabElem) => {
        APPLOG('Tabs onShow:', tabElem?.id);
        if (tabElem.id === 'tab-mapa') {
          try {
            Estado.map = crearMapa(); // idempotente
            setTimeout(() => {
              APPLOG('Tabs→map invalidate + labels');
              Estado.map?.invalidateSize();
              updateLabelVisibility();
            }, 40);
            if (Estado.centros?.length) {
              APPLOG('Tabs→ drawCentrosInMap con', Estado.centros.length);
              drawCentrosInMap(Estado.centros);
            }
          } catch (err) {
            APPERR('Error al crear mapa en cambio de pestaña:', err);
          }
        }
      },
    });
  }
  M.FormSelect.init(document.querySelectorAll('select'));
  M.Modal.init(document.querySelectorAll('.modal'));
  M.Tooltip.init(document.querySelectorAll('.tooltipped'));

  // ===== Importador (si existe en DOM) =====
  const importCont = document.getElementById('importarCentrosContainer');
  if (importCont && importCont.dataset.inited !== '1') {
    importCont.dataset.inited = '1';
    const { renderImportadorCentros } = await import('./centros/importar_centros.js');
    renderImportadorCentros('importarCentrosContainer');
    APPLOG('Importador inicializado');
  }

  // ===== Tabla y Mapa =====
  initTablaCentros();
  try {
    APPLOG('Creando mapa (fase inicial)…');
    Estado.map = crearMapa(); // instancia Leaflet y deja overlay de búsqueda
    initSidebarFiltro();
  } catch (err) {
    APPERR('Error inicializando el mapa:', err);
  }

  // ===== Carga inicial =====
  await recargarCentros();

  // ===== Formularios =====
  wireFormCentros();

  APPLOG('Init done.');
}

async function recargarCentros() {
  try {
    APPLOG('recargarCentros(): solicitando API…');
    const data = await getCentrosAll();
    Estado.centros = Array.isArray(data) ? data : [];
    APPLOG('Centros recibidos:', Estado.centros.length, Estado.centros[0] || '(sin items)');

    // Tabla
    loadTablaCentros(Estado.centros);

    // Mapa (polígonos + labels + sidebar)
    cargarYRenderizarCentros(Estado.centros);

    // Si la pestaña MAPA está activa, asegura render correcto
    if (tabMapaActiva()) {
      APPLOG('tabMapaActiva() → invalidate + draw');
      Estado.map?.invalidateSize();
      updateLabelVisibility();
      drawCentrosInMap(Estado.centros);
    }
  } catch (e) {
    APPERR('Error cargando centros:', e);
    M.toast({ html: 'Error cargando centros', classes: 'red' });
  }
}

function wireFormCentros() {
  APPLOG('wireFormCentros()');

  const btnNuevoCentro   = document.getElementById('btnOpenCentroModal');
  const centroModalElem  = document.getElementById('centroModal');
  const centroModal = centroModalElem
    ? M.Modal.getInstance(centroModalElem) || M.Modal.init(centroModalElem)
    : null;

  const els = {
    formTitle:        document.getElementById('formTitle'),
    inputCentroId:    document.getElementById('inputCentroId'),
    inputProveedor:   document.getElementById('inputProveedor'),
    inputComuna:      document.getElementById('inputComuna'),
    inputCode:        document.getElementById('inputCode'),
    inputHectareas:   document.getElementById('inputHectareas'),
    inputLat:         document.getElementById('inputLat'),
    inputLng:         document.getElementById('inputLng'),
    btnAddPoint:      document.getElementById('btnAddPoint'),
    btnClearPoints:   document.getElementById('btnClearPoints'),
    btnSaveCentro:    document.getElementById('btnSaveCentro'),
    pointsBody:       document.getElementById('pointsBody'),
  };

  // Nuevo centro
  btnNuevoCentro?.addEventListener('click', () => {
    APPLOG('Nuevo centro → abrir modal');
    Estado.currentCentroIdx = null;
    Estado.currentPoints = [];
    openNewForm(els, Estado.map, Estado.currentPoints, (v) => (Estado.currentCentroIdx = v));
    renderPointsTable(els.pointsBody, Estado.currentPoints);
    centroModal?.open();
  });

  // Agregar punto (DMS → decimal)
  els.btnAddPoint?.addEventListener('click', () => {
    const lat = parseDMS(els.inputLat?.value?.trim());
    const lng = parseDMS(els.inputLng?.value?.trim());
    APPLOG('AddPoint:', els.inputLat?.value, els.inputLng?.value, '→', lat, lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      M.toast({ html: 'Formato DMS inválido', classes: 'red' });
      return;
    }
    Estado.currentPoints.push({ lat, lng });
    addPointMarker(lat, lng);
    redrawPolygon(Estado.currentPoints);
    renderPointsTable(els.pointsBody, Estado.currentPoints);
    if (els.inputLat) els.inputLat.value = '';
    if (els.inputLng) els.inputLng.value = '';
    M.updateTextFields();
  });

  // Limpiar puntos
  els.btnClearPoints?.addEventListener('click', () => {
    APPLOG('ClearPoints');
    Estado.currentPoints.length = 0;
    clearMapPoints();
    renderPointsTable(els.pointsBody, Estado.currentPoints);
  });

  // Guardar (crear/actualizar) — solo datos generales + polígono
  document.getElementById('formCentro')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const proveedor = els.inputProveedor?.value?.trim();
    const comuna    = els.inputComuna?.value?.trim();
    const code      = els.inputCode?.value?.trim();
    const hectStr   = els.inputHectareas?.value?.trim();

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
      coords: Array.from(Estado.currentPoints || []), // polígono
    };

    els.btnSaveCentro && (els.btnSaveCentro.disabled = true);
    try {
      if (Estado.currentCentroIdx === null) {
        APPLOG('Crear centro →', centroData);
        const creado = await createCentro(centroData);
        if (!creado?._id) throw new Error('Error al crear centro');
        Estado.centros.push(creado);
        M.toast({ html: 'Centro creado', classes: 'green' });
      } else {
        const id = Estado.centros[Estado.currentCentroIdx]._id;
        APPLOG('Actualizar centro', id, '→', centroData);
        const actualizado = await updateCentro(id, centroData);
        if (!actualizado?._id) throw new Error('Error al actualizar centro');
        Estado.centros[Estado.currentCentroIdx] = actualizado;
        M.toast({ html: 'Centro actualizado', classes: 'green' });
      }
      await recargarCentros();
      centroModal?.close();
    } catch (err) {
      APPERR('Error guardando centro:', err);
      M.toast({ html: err.message || 'Error al guardar centro', classes: 'red' });
    } finally {
      els.btnSaveCentro && (els.btnSaveCentro.disabled = false);
    }
  });

  // Cerrar modales
  document.querySelectorAll('.modal .modal-close').forEach((btn) => {
    btn.addEventListener('click', () => {
      const inst = M.Modal.getInstance(btn.closest('.modal'));
      inst?.close();
    });
  });
}

// ===== Workaround selects Materialize dentro de DataTables =====
if ($) {
  $(document).on('mousedown focusin', '.select-wrapper input.select-dropdown', function () {
    $(this).closest('tr').addClass('editando-select');
  });
  $(document).on('blur', '.select-wrapper input.select-dropdown', function () {
    setTimeout(() => {
      $('.editando-select').removeClass('editando-select');
    }, 200);
  });
}
