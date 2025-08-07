// js/mapas/control_mapa.js

import { Estado } from '../core/estado.js';
import { tabMapaActiva, hashCentros, actualizarTextoFullscreen } from '../core/utilidades_app.js';

// Módulos divididos
import { crearMapa }                     from './mapConfig.js';
import { clearMapPoints, addPointMarker, redrawPolygon } from './mapPoints.js';
import { drawCentrosInMap, focusCentroInMap }            from './mapDraw.js';
import { initSidebarFiltro }             from './mapFilter.js';

export function initMapa() {
  console.log('[control_mapa] initMapa');
  Estado.map = crearMapa(Estado.defaultLatLng);
  if (!Estado.map) {
    console.error('[control_mapa] crearMapa falló');
    return;
  }

  // Cerrar popup al click fuera de polígonos
  Estado.map.on('click', () => {
    console.log('[control_mapa] mapa clic → closePopup');
    Estado.map.closePopup();
  });

  // Fullscreen
  const fsBtn = document.getElementById('btnFullscreenMapa');
  const shell = document.getElementById('mapShell');
  if (fsBtn && shell) {
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) shell.requestFullscreen();
      else document.exitFullscreen();
    });
    document.addEventListener('fullscreenchange', () =>
      actualizarTextoFullscreen(fsBtn, shell)
    );
    actualizarTextoFullscreen(fsBtn, shell);
  }

  // Atajo "f" para fullscreen si la pestaña mapa está activa
  document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'f' && tabMapaActiva()) {
      console.log('[control_mapa] atajo "f" → fullscreen');
      fsBtn?.click();
    }
  });

  // Inicializa el filtro/sidebar flotante
  console.log('[control_mapa] initSidebarFiltro');
  initSidebarFiltro();
}

export function renderMapaAlways(force = false) {
  console.log('[control_mapa] renderMapaAlways, force=', force);
  if (!Estado.map) {
    console.error('[control_mapa] map no existe');
    return;
  }

  const h = hashCentros(Estado.centros);
  console.log('[control_mapa] hashCentros=', h, 'prev=', Estado.centrosHashRender);
  if (!force && h === Estado.centrosHashRender) {
    console.log('[control_mapa] sin cambios, sólo invalidateSize');
    Estado.map.invalidateSize();
    return;
  }

  Estado.centrosHashRender = h;
  console.log('[control_mapa] dibujando centros');
  drawCentrosInMap(Estado.centros, Estado.defaultLatLng);
  Estado.map.invalidateSize();
}

// Reexportamos sólo lo que necesitas en app.js / form_centros.js
export {
  clearMapPoints,
  addPointMarker,
  redrawPolygon,
  drawCentrosInMap,
  focusCentroInMap,
  initSidebarFiltro
};
