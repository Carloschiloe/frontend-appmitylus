// js/mapas/control_mapa.js

import { Estado } from '../core/estado.js';
import { crearMapa, setBaseLayer } from './mapConfig.js';
import { drawCentrosInMap, focusCentroInMap } from './mapDraw.js';
import { initMapFilter, setFilterData } from './mapFilter.js';
import { clearMapPoints, addPointMarker, redrawPolygon } from './mapPoints.js';

/**
 * Inicializa el mapa con controles, filtros y listeners generales.
 */
export function initMapa() {
  // 1. Crear mapa y guardar en Estado
  Estado.map = crearMapa(Estado.defaultLatLng);

  // 2. Cerrar popup al clicar fuera de un polígono
  Estado.map.on('click', e => {
    // si click no fue en un path (polígono), cerramos popup
    if (!(e.originalEvent.target instanceof SVGPathElement)) {
      Estado.map.closePopup();
    }
  });

  // 3. Fullscreen
  const fsBtn = document.getElementById('btnFullscreenMapa');
  const shell = document.getElementById('mapShell');
  if (fsBtn && shell) {
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) shell.requestFullscreen?.();
      else document.exitFullscreen?.();
    });
    document.addEventListener('fullscreenchange', () =>
      fsBtn.textContent = document.fullscreenElement ? 'Salir Fullscreen' : 'Pantalla completa'
    );
  }

  // 4. Inicializar filtro flotante
  initMapFilter();

  // 5. (Opcional) Atajo de teclado para fullscreen con "f"
  document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'f' && Estado.tabs?.active === 'mapa') {
      fsBtn?.click();
    }
  });
}

/**
 * Redibuja siempre el mapa con los datos actuales de `Estado.centros`.
 * Úsalo tras cargar o modificar el array `Estado.centros`.
 * @param {boolean} force — si true, ignora hash y forzar redraw
 */
export function renderMapaAlways(force = false) {
  if (!Estado.map) return;
  // Calcula un hash simple de tu array de centros (puede venir de utilidades_app)
  const h = JSON.stringify(Estado.centros.map(c => c._id + (c.coords?.length||0)));
  if (!force && h === Estado.centrosHashRender) {
    Estado.map.invalidateSize();
    return;
  }
  Estado.centrosHashRender = h;

  // 1. Dibuja polígonos y popups
  drawCentrosInMap(
    Estado.centros,
    Estado.defaultLatLng,
    idx => { Estado.currentCentroIdx = idx; }
  );
  // 2. Sincroniza datos del filtro
  setFilterData(Estado.centros);

  // 3. Ajusta tamaño del mapa
  Estado.map.invalidateSize();
}

// Reexportar helpers de puntos para usar en el formulario de centros
export { clearMapPoints, addPointMarker, redrawPolygon, focusCentroInMap, setBaseLayer };
