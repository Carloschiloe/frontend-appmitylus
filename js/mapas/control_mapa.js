// js/mapas/control_mapa.js

import { Estado } from '../core/estado.js';
import { crearMapa } from './mapConfig.js';
import { drawCentrosInMap } from './mapDraw.js';
import { initSidebarFiltro } from './mapFilter.js';

export function initMapa() {
  console.log('[control_mapa] initMapa');
  Estado.map = crearMapa(Estado.defaultLatLng);
  if (!Estado.map) {
    console.error('[control_mapa] crearMapa falló');
    return;
  }
  // Fullscreen, click para cerrar popups, etc.
  Estado.map.on('click', () => Estado.map.closePopup());
  initSidebarFiltro();
}

export function renderMapaAlways(force = false) {
  // Redibuja siempre el mapa de centros
  if (Estado.map && Estado.centros) {
    drawCentrosInMap(Estado.centros);
  }
  if (force && Estado.map) Estado.map.invalidateSize();
}
