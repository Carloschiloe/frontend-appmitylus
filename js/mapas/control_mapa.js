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

  // Cerrar popup al click fuera de polígonos
  Estado.map.on('click', () => {
    Estado.map.closePopup();
  });

  // Inicializa el filtro lateral (sidebar)
  initSidebarFiltro();
}

export function renderMapaAlways(force = false) {
  if (Estado.map && Estado.centros) {
    drawCentrosInMap(Estado.centros);
  }
  if (force && Estado.map) Estado.map.invalidateSize();
}
