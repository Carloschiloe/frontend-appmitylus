// js/app.js — bootstrap/orquestador

import { Estado } from './core/estado.js';

// --- Mapa (toda la lógica vive en mapas/mapa.js) ---
import {
  crearMapa,
  initSidebarFiltro,
  setupMapSearchOverlay,   // buscador overlay (código/titular/área)
  cargarYRenderizarCentros,
  renderMapaAlways,
  clearMapPoints,
  addPointMarker,
  redrawPolygon
} from './mapas/mapa.js';

// --- Tabla (config + eventos están encapsulados en el módulo) ---
import {
  initTablaCentros,
  loadCentros as loadTablaCentros
} from './centros/tabla_centros.js';

// --- Formularios (nuevo/editar centro) ---
import {
  openNewForm,
  openEditForm,
  renderPointsTable
} from './centros/form_centros.js';

// --- API ---
import {
  getCentrosAll,
  createCentro,
  updateCentro
} from './core/centros_repo.js';

// --- Utils ---
import { tabMapaActiva } from './core/utilidades_app.js';

// Preferir módulo; si no existe, usar fallback global expuesto por /js/utils.js
let parseOneDMSFn = null;
try {
  const mod = await import('./core/utilidades.js');      // si tienes este módulo
  parseOneDMSFn = mod.parseOneDMS;
} catch (_e) {
  // fallback a globals ya cargados por /js/utils.js
  parseOneDMSFn = (window.u && window.u.parseOneDMS) || window.parseOneDMS;
}
// guard para no reventar si el util no está
const parseDMS = (s) => (typeof parseOneDMSFn === 'function' ? parseOneDMSFn(s) : NaN);

// jQuery (DataTables lo usa)
const $ = (window.$ || window.jQuery);

document.addEventListener('DOMContentLoaded', init);

async function init () {
  // ===== Materialize UI =====
  const tabsEl = document.querySelector('#tabs');
  if (tabsEl) {
    M.Tabs.init(tabsEl, {
      onShow: (tabElem) => {
        if (tabElem.id === 'tab-mapa' && Estado.map) {
          Estado.map.invalidateSize();
          renderMapaAlways();
        }
      }
    });
  }
  M.FormSelect.init(document.querySelectorAll('select'));
  M.Modal.init(document.querySelectorAll('.modal'));
  M.Tooltip.init(document.querySelectorAll('.tooltipped'));

  // ===== Importador (una sola vez) =====
  const importCont = document.getElementById('importarCentrosContainer');
  if (importCont && importCont.dataset.inited !== '1') {
    importCont.dataset.inited = '1';
    const { renderImportadorCentros } = await import('./centros/importar_centros.js');
    renderImportadorCentros('importarCentrosContainer');
  }

  // ===== Tabla y Mapa =====
  initTablaCentros();       // configura DataTable y registra eventos en eventos_centros.js
  crearMapa();              // instancia Leaflet (centrado en Chiloé y con labels por zoom)
  initSidebarFiltro();      // sidebar minimal (si lo usas)

  // ===== Carga inicial =====
  await recargarCentros();  // llena tabla + dibuja mapa + conecta buscador

  // ===== Modal “Nuevo/Editar Centro” =====
  wireFormCentros();
}

async function recargarCentros () {
  try {
    const data = await getCentrosAll();
    Estado.centros = Array.isArray(data) ? data : [];

    // Tabla
    loadTablaCentros(Estado.centros);

    // Mapa + buscador overlay
    cargarYRenderizarCentros(Estado.centros);  // dibuja polígonos y gestiona labels por zoom
    setupMapSearchOverlay(Estado.centros);     // activa búsqueda (código / titular / código de área)

    if (tabMapaActiva()) renderMapaAlways(true);
  } catch (e) {
    console.error('Error cargando centros:', e);
    M.toast({ html: 'Error cargando centros', classes: 'red' });
  }
}

function wireFormCentros () {
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

  // NOTA: El handler para “.editar-centro” ya está en eventos_centros.js → no lo duplicamos aquí

  // Agregar punto (DMS → decimal) en el formulario
  els.btnAddPoint?.addEventListener('click', () => {
    const lat = parseDMS(els.inputLat.value.trim());
    const lng = parseDMS(els.inputLng.value.trim());
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
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

  // Guardar (crear o actualizar)
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

      await recargarCentros(); // tabla + mapa + buscador
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
}

// ===== Workaround para selects de Materialize dentro de DataTables =====
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
