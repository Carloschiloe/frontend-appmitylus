// js/mapas/control_mapa.js
import { Estado } from '../core/estado.js';
import { hashCentros, tabMapaActiva, actualizarTextoFullscreen } from '../core/utilidades_app.js';
import {
  crearMapa, clearMapPoints, redrawPolygon, addPointMarker,
  drawCentrosInMap, focusCentroInMap, initSidebarFiltro
} from './mapa.js';

let _mapInitStarted = false;

function onTabShowInvalidate() {
  setTimeout(() => window.__mapLeaflet && window.__mapLeaflet.invalidateSize(), 60);
}

function waitForMapDom() {
  return new Promise((resolve) => {
    const tryNow = () => {
      const mapEl = document.getElementById('map');
      const tabEl = document.getElementById('tab-mapa');
      const shell = document.getElementById('mapShell');

      const exists = !!mapEl;
      const visibleTab = tabEl ? (getComputedStyle(tabEl).display !== 'none' || tabMapaActiva?.()) : true;
      const hasHeight = shell ? shell.clientHeight > 0 : (mapEl ? mapEl.clientHeight > 0 : false);

      if (exists && (visibleTab || hasHeight)) {
        resolve(true);
        return;
      }
      requestAnimationFrame(tryNow);
    };
    tryNow();
  });
}

async function ensureMapCreated() {
  if (_mapInitStarted && Estado.map) return Estado.map;
  _mapInitStarted = true;

  await waitForMapDom();

  // Crear mapa (si aún no existe)
  Estado.map = crearMapa(Estado.defaultLatLng);
  if (!Estado.map) {
    // último intento con pequeño delay por si el DOM apareció recién
    await new Promise(r => setTimeout(r, 60));
    Estado.map = crearMapa(Estado.defaultLatLng);
  }

  // Observadores de visibilidad/tamaño extra por seguridad
  const tabEl = document.getElementById('tab-mapa');
  if (tabEl) {
    const mo = new MutationObserver(onTabShowInvalidate);
    mo.observe(tabEl, { attributes: true, attributeFilter: ['style', 'class'] });
  }
  window.addEventListener('resize', onTabShowInvalidate);
  window.addEventListener('hashchange', () => {
    if (location.hash === '#tab-mapa') onTabShowInvalidate();
  });
  document.querySelectorAll('a[href="#tab-mapa"]').forEach(a => a.addEventListener('click', onTabShowInvalidate));

  // Cerrar popup al click fuera
  Estado.map.on('click', (e) => {
    // En algunos navegadores SVGPathElement puede no existir; hacemos try/catch suave
    try {
      if (!(e.originalEvent.target instanceof SVGPathElement)) {
        Estado.map.closePopup();
      }
    } catch { Estado.map.closePopup(); }
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
    if (e.key && e.key.toLowerCase() === 'f' && tabMapaActiva?.()) fsBtn?.click();
  });

  // Sidebar filtro (cuando ya hay DOM)
  setTimeout(() => { initSidebarFiltro(); }, 0);

  // Asegurar tamaño correcto tras crear
  onTabShowInvalidate();

  return Estado.map;
}

export async function initMapa() {
  await ensureMapCreated();
}

export async function renderMapaAlways(force = false) {
  await ensureMapCreated();
  if (!Estado.map) return;

  const h = hashCentros(Estado.centros);
  if (!force && h === Estado.centrosHashRender) {
    Estado.map.invalidateSize();
    return;
  }
  Estado.centrosHashRender = h;

  drawCentrosInMap(Estado.centros, Estado.defaultLatLng);
  // doble tiro por si el tab se activó recién
  setTimeout(() => Estado.map && Estado.map.invalidateSize(), 60);
  setTimeout(() => Estado.map && Estado.map.invalidateSize(), 300);
}

// Reexportar helpers de puntos para usarlos en el formulario
export { clearMapPoints, redrawPolygon, addPointMarker, focusCentroInMap };
