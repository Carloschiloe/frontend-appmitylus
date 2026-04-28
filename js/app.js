// /js/app.js — orquestador Centros
import { toast } from '/js/ui/toast.js';

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
import { renderMapaAlways } from './mapas/control-mapa.js';

// === Tabla ===
import { initTablaCentros, loadCentros as loadTablaCentros } from './centros/tabla-centros.js';

// === Formularios ===
import { openNewForm, renderPointsTable } from './centros/form-centros.js';

// === API ===
import { getCentrosAll, createCentro, updateCentro } from './core/centros-repo.js';

// === Utils app ===
import { tabMapaActiva } from './core/utilidades-app.js';

// Utils
const parseDMS = (s) => {
  const fn = (window.u && window.u.parseOneDMS) || window.parseOneDMS;
  return typeof fn === 'function' ? fn(s) : NaN;
};

const APPLOG  = (...a) => console.log('[APP]', ...a);
const APPWARN = (...a) => console.warn('[APP]', ...a);
const APPERR  = (...a) => console.error('[APP]', ...a);

const CENTROS_CACHE_KEY    = 'mmpp.centros.cache.v1';
const CENTROS_CACHE_TTL_MS = 5 * 60 * 1000;

/* ── Cache ──────────────────────────────────────────────────────────────── */
function readCentrosCache() {
  try {
    const raw = sessionStorage.getItem(CENTROS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const ts   = Number(parsed?.ts || 0);
    const data = Array.isArray(parsed?.data) ? parsed.data : [];
    if (!data.length || !ts || (Date.now() - ts) > CENTROS_CACHE_TTL_MS) return [];
    return data;
  } catch { return []; }
}

function saveCentrosCache(data = []) {
  try {
    const arr = Array.isArray(data) ? data : [];
    sessionStorage.setItem(CENTROS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: arr }));
  } catch {}
}

/* ── Init ───────────────────────────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function init() {
  APPLOG('Init start.');

  // Importador (lazy)
  const importCont = document.getElementById('importarCentrosContainer');
  if (importCont && importCont.dataset.inited !== '1') {
    importCont.dataset.inited = '1';
    const { renderImportadorCentros } = await import('./centros/importar-centros.js');
    renderImportadorCentros('importarCentrosContainer');
    APPLOG('Importador inicializado');
  }

  // Tabla y mapa
  initTablaCentros();
  try {
    APPLOG('Creando mapa…');
    Estado.map = crearMapa();
    initSidebarFiltro();
  } catch (err) {
    APPERR('Error inicializando mapa:', err);
  }

  // Carga rápida desde caché
  const cached = readCentrosCache();
  if (cached.length) {
    APPLOG('Render inmediato desde caché:', cached.length);
    Estado.centros = cached;
    loadTablaCentros(cached);
    if (tabMapaActiva()) {
      try { cargarYRenderizarCentros(cached); } catch {}
    }
  }

  await recargarCentros();

  window.addEventListener('hashchange', () => {
    if (tabMapaActiva()) {
      APPLOG('hashchange → tab mapa activa → renderMapaAlways(true)');
      renderMapaAlways(true);
    }
  });

  // Cuando se importan/sincronizan centros (SUBPESCA o Excel), refrescar tabla + mapa
  window.addEventListener('mmpp:centros-updated', () => {
    APPLOG('Evento mmpp:centros-updated → recargarCentros()');
    recargarCentros();
  });

  wireFormCentros();

  APPLOG('Init done.');
}

/* ── Recarga desde API ──────────────────────────────────────────────────── */
async function recargarCentros() {
  try {
    APPLOG('recargarCentros(): API…');
    const data = await getCentrosAll();
    Estado.centros = Array.isArray(data) ? data : [];
    saveCentrosCache(Estado.centros);
    APPLOG('Centros recibidos:', Estado.centros.length);

    loadTablaCentros(Estado.centros);

    if (tabMapaActiva()) {
      Estado.map?.invalidateSize();
      await renderMapaAlways(true);
    }
  } catch (e) {
    APPERR('Error cargando centros:', e);
    if (!Array.isArray(Estado.centros) || !Estado.centros.length) {
      toast('Error cargando centros', { variant: 'danger' });
    } else {
      APPWARN('Se mantiene data en caché por error de red.');
    }
  }
}

/* ── Formulario de Centros ─────────────────────────────────────────────── */
function wireFormCentros() {
  APPLOG('wireFormCentros()');

  const btnNuevoCentro = document.getElementById('btnOpenCentroModal');

  const els = {
    formTitle:      document.getElementById('centroModalTitle'),
    inputCentroId:  document.getElementById('inputCentroId'),
    inputProveedor: document.getElementById('inputProveedor'),
    inputComuna:    document.getElementById('inputComuna'),
    inputCode:      document.getElementById('inputCode'),
    inputCodigoArea:document.getElementById('inputCodigoArea'),
    inputHectareas: document.getElementById('inputHectareas'),
    inputLat:       document.getElementById('inputLat'),
    inputLng:       document.getElementById('inputLng'),
    btnAddPoint:    document.getElementById('btnAddPoint'),
    btnClearPoints: document.getElementById('btnClearPoints'),
    btnSaveCentro:  document.getElementById('btnSaveCentro'),
    pointsBody:     document.getElementById('pointsBody'),
  };

  // Botón "Nuevo Centro"
  btnNuevoCentro?.addEventListener('click', () => {
    APPLOG('Nuevo centro → abrir modal');
    Estado.currentCentroIdx = null;
    Estado.currentPoints = [];
    openNewForm(els, Estado.map, Estado.currentPoints, (v) => (Estado.currentCentroIdx = v));
    renderPointsTable(els.pointsBody, Estado.currentPoints);
    window.openCentroModal?.();
  });

  // Agregar punto
  els.btnAddPoint?.addEventListener('click', () => {
    const lat = parseDMS(els.inputLat?.value?.trim());
    const lng = parseDMS(els.inputLng?.value?.trim());
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast('Formato DMS inválido', { variant: 'danger' });
      return;
    }
    Estado.currentPoints.push({ lat, lng });
    addPointMarker(lat, lng);
    redrawPolygon(Estado.currentPoints);
    renderPointsTable(els.pointsBody, Estado.currentPoints);
    if (els.inputLat) els.inputLat.value = '';
    if (els.inputLng) els.inputLng.value = '';
  });

  // Limpiar puntos
  els.btnClearPoints?.addEventListener('click', () => {
    Estado.currentPoints.length = 0;
    clearMapPoints();
    renderPointsTable(els.pointsBody, Estado.currentPoints);
  });

  // Guardar (crear / actualizar)
  document.getElementById('formCentro')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const proveedor = els.inputProveedor?.value?.trim();
    const comuna    = els.inputComuna?.value?.trim();
    const code      = els.inputCode?.value?.trim();
    const hectStr   = els.inputHectareas?.value?.trim();

    if (!proveedor || !comuna || !code) {
      toast('Proveedor, comuna y código son obligatorios', 'red');
      return;
    }
    const hect = hectStr ? Number(hectStr) : null;
    if (hectStr && Number.isNaN(hect)) {
      toast('Hectáreas inválidas', 'red');
      return;
    }

    const centroData = { proveedor, comuna, code, hectareas: hect, coords: [...(Estado.currentPoints || [])] };

    if (els.btnSaveCentro) els.btnSaveCentro.disabled = true;
    try {
      if (Estado.currentCentroIdx === null) {
        const creado = await createCentro(centroData);
        if (!creado?._id) throw new Error('Error al crear centro');
        Estado.centros.push(creado);
        toast('Centro creado', { variant: 'success' });
      } else {
        const id = Estado.centros[Estado.currentCentroIdx]._id;
        const actualizado = await updateCentro(id, centroData);
        if (!actualizado?._id) throw new Error('Error al actualizar centro');
        Estado.centros[Estado.currentCentroIdx] = actualizado;
        toast('Centro actualizado', { variant: 'success' });
      }
      await recargarCentros();
      window.closeCentroModal?.();
    } catch (err) {
      APPERR('Error guardando centro:', err);
      toast(err.message || 'Error al guardar centro', { variant: 'danger' });
    } finally {
      if (els.btnSaveCentro) els.btnSaveCentro.disabled = false;
    }
  });
}
