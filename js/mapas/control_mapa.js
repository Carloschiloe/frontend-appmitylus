// js/mapas/control_mapa.js

import { Estado } from '../core/estado.js';
import { tabMapaActiva, hashCentros, actualizarTextoFullscreen } from '../core/utilidades_app.js';

// Configuración y render inicial del mapa
import { crearMapa }           from './mapConfig.js';

// Dibujo de polígonos y centrado
import { drawCentrosInMap,
         centrarMapaEnPoligonos,
         focusCentroInMap }    from './mapDraw.js';

// Filtro / sidebar flotante
import { initSidebarFiltro }   from './mapFilter.js';

// Puntos y polígono de edición en el formulario
import { clearMapPoints,
         addPointMarker,
         redrawPolygon }       from './mapPoints.js';

/**
 * Inicializa el mapa en la pestaña (botón fullscreen, atajo de teclado, click fuera cierra popup).
 */
export function initMapa() {
  // 1) Crear mapa si no existe
  Estado.map = crearMapa(Estado.defaultLatLng);

  // 2) Cerrar popup al hacer click fuera de un polígono
  Estado.map.on('click', (e) => {
    if (!(e.originalEvent.target instanceof SVGPathElement)) {
      Estado.map.closePopup();
    }
  });

  // 3) Fullscreen (botón y texto dinámico)
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
    // Estado inicial del texto/icono
    actualizarTextoFullscreen(fsBtn, shell);
  }

  // 4) Atajo de teclado "f" para fullscreen (si la pestaña mapa está activa)
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'f' && tabMapaActiva()) {
      fsBtn?.click();
    }
  });
}

/**
 * Siempre dibuja los centros en el mapa y ajusta tamaño.
 * @param {boolean} force - forzar dibujo aunque no hayan cambiado los datos.
 */
export function renderMapaAlways(force = false) {
  if (!Estado.map) return;

  // Evitar redibujos innecesarios usando hash
  const h = hashCentros(Estado.centros);
  if (!force && h === Estado.centrosHashRender) {
    Estado.map.invalidateSize();
    return;
  }
  Estado.centrosHashRender = h;

  // Volver a dibujar polígonos
  drawCentrosInMap(Estado.centros, Estado.defaultLatLng);

  // Forzar Leaflet a recalcular tamaño del contenedor
  Estado.map.invalidateSize();
}

/** Reexportamos los helpers para usarlos desde app.js o form_centros.js */
export {
  clearMapPoints,
  addPointMarker,
  redrawPolygon,
  drawCentrosInMap,
  centrarMapaEnPoligonos,
  focusCentroInMap,
  initSidebarFiltro
};
