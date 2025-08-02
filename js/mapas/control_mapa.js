// control_mapa.js
import { Estado } from '../core/estado.js';
import { hashCentros, tabMapaActiva, actualizarTextoFullscreen } from '../core/utilidades_app.js';
import {
  crearMapa, clearMapPoints, redrawPolygon, addPointMarker,
  drawCentrosInMap, focusCentroInMap, initSidebarFiltro
} from './mapa.js';

export function initMapa() {
  Estado.map = crearMapa(Estado.defaultLatLng);

  // Cerrar popup al click fuera
  Estado.map.on('click', (e) => {
    if (!(e.originalEvent.target instanceof SVGPathElement)) {
      Estado.map.closePopup();
    }
  });

  // Fullscreen
  const fsBtn = document.getElementById('btnFullscreenMapa');
  const shell = document.getElementById('mapShell');
  if (fsBtn && shell) {
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) shell.requestFullscreen?.();
      else document.exitFullscreen?.();
    });
    document.addEventListener('fullscreenchange', () => actualizarTextoFullscreen(fsBtn, shell));
    actualizarTextoFullscreen(fsBtn, shell);
  }

  // Atajo teclado "f"
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'f' && tabMapaActiva()) fsBtn?.click();
  });

  // Inicializa sidebar filtro y clicks
  setTimeout(() => {
    initSidebarFiltro();
  }, 500); // Espera DOM listo por si acaso
}

export function renderMapaAlways(force = false) {
  if (!Estado.map) return;
  const h = hashCentros(Estado.centros);
  if (!force && h === Estado.centrosHashRender) {
    Estado.map.invalidateSize();
    return;
  }
  Estado.centrosHashRender = h;

  drawCentrosInMap(Estado.centros, Estado.defaultLatLng);
  // El sidebar se actualiza solo desde cargarYRenderizarCentros o el filtro, no aquí.
  Estado.map.invalidateSize();
}

// Reexportar helpers de puntos para usarlos en el formulario
export { clearMapPoints, redrawPolygon, addPointMarker };
