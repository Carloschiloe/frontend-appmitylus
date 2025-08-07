// js/mapas/control_mapa.js

import { Estado } from '../core/estado.js';
import { hashCentros, tabMapaActiva, actualizarTextoFullscreen } from '../core/utilidades_app.js';

// Módulos separados
import { crearMapa } from './mapConfig.js';
import { clearMapPoints, redrawPolygon, addPointMarker } from './mapPoints.js';
import { drawCentrosInMap, centrarMapaEnPoligonos, focusCentroInMap } from './mapDraw.js';
import { initSidebarFiltro } from './mapFilter.js';

export function initMapa() {
  // Inicializa Leaflet con la capa y centro por defecto
  Estado.map = crearMapa(Estado.defaultLatLng);

  if (!Estado.map) return;

  // Cerrar popup al click fuera de un polígono
  Estado.map.on('click', (e) => {
    Estado.map.closePopup();
  });

  // FULLSCREEN
  const fsBtn = document.getElementById('btnFullscreenMapa');
  const shell = document.getElementById('mapShell');
  if (fsBtn && shell) {
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) shell.requestFullscreen?.();
      else document.exitFullscreen?.();
    });
    document.addEventListener('fullscreenchange', () =>
      actualizarTextoFullscreen(fsBtn, shell)
    );
    actualizarTextoFullscreen(fsBtn, shell);
  }

  // Atajo de teclado "f" para fullscreen
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'f' && tabMapaActiva()) {
      fsBtn?.click();
    }
  });

  // Inicializa filtro / sidebar
  setTimeout(() => initSidebarFiltro(), 300);
}

/**
 * Redibuja los centros sobre el mapa.
 * Sólo vuelve a dibujar si cambian los datos o si forzamos.
 */
export function renderMapaAlways(force = false) {
  if (!Estado.map) return;
  const h = hashCentros(Estado.centros);
  if (!force && h === Estado.centrosHashRender) {
    // mismo hash, sólo invalidamos tamaño
    Estado.map.invalidateSize();
    return;
  }
  Estado.centrosHashRender = h;

  // Dibuja polígonos y marcadores
  drawCentrosInMap(Estado.centros, Estado.defaultLatLng);
  Estado.map.invalidateSize();
}

// Reexportamos utilidades de puntos para el formulario
export { clearMapPoints, redrawPolygon, addPointMarker };
